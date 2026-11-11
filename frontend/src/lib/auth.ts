import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

type Listener = (session: Session | null) => void;

let currentSession: Session | null = null;
let initialized = false;
const listeners = new Set<Listener>();

supabase.auth.getSession().then(({ data }) => {
    currentSession = data.session;
    initialized = true;
    listeners.forEach((l) => l(currentSession));
});

// True between opening a password-reset link and saving the new password:
// the link signs the user in, but they must set a password before using the app.
let recovering = false;
const recoveryListeners = new Set<(on: boolean) => void>();
export function onRecoveryChange(listener: (on: boolean) => void): () => void {
    recoveryListeners.add(listener);
    listener(recovering);
    return () => recoveryListeners.delete(listener);
}
function setRecovering(on: boolean) {
    recovering = on;
    recoveryListeners.forEach((l) => l(on));
}

supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") setRecovering(true);
    currentSession = session;
    initialized = true;
    listeners.forEach((l) => l(session));
});

export function getSession(): Session | null {
    return currentSession;
}

// The cached JWT can be expired: supabase-js pauses its refresh timer while
// the tab is hidden, so the first save after a long idle went out with a
// dead token and was rolled back. getSession() refreshes an expired one first.
export async function getFreshAccessToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    if (data.session) currentSession = data.session;
    return data.session?.access_token ?? null;
}

// Used by anything outside React (lib/propertiesApi.ts) that needs the
// current JWT for an Authorization header on a request to our backend.
export function getAccessToken(): string | null {
    return currentSession?.access_token ?? null;
}

// Fires once immediately with whatever's known right now (null before the
// initial getSession() resolves), then again on every real change.
export function onAuthChange(listener: Listener): () => void {
    listeners.add(listener);
    if (initialized) listener(currentSession);
    return () => listeners.delete(listener);
}

export async function signInWithPassword(email: string, password: string) {
    return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithPassword(email: string, password: string) {
    // emailRedirectTo: send the confirmation link back to wherever the app
    // is actually running (localhost during dev, the real domain once
    // deployed) instead of whatever static "Site URL" is set in the
    // Supabase dashboard. That URL must also be added to the dashboard's
    // Auth -> URL Configuration -> Redirect URLs allow-list, or Supabase
    // will reject it and fall back to the Site URL anyway.
    return supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
}

// Emails a link back to this app; opening it fires PASSWORD_RECOVERY.
// The origin must be in Supabase's Auth -> Redirect URLs allow-list.
export async function requestPasswordReset(email: string) {
    return supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
}

export async function setNewPassword(password: string) {
    const result = await supabase.auth.updateUser({ password });
    if (!result.error) setRecovering(false);
    return result;
}

export async function signOut() {
    await supabase.auth.signOut();
}

export interface AgentAccess {
    approved: boolean;
    role: string;
}

// Agent OS's own approval gate and role -- separate from Supabase's session
// validity. See backend/sql/001_agent_approval.sql (approval: a signup is
// auto-approved if its email was pre-whitelisted, otherwise it sits at
// approved=false until someone flips it by hand) and 002_admin_role.sql
// (role). Both enforced for real in requireAgent.js/requireAdmin.js on the
// backend; this is just what drives the UI.
export async function getMyAccess(userId: string): Promise<AgentAccess> {
    const { data, error } = await supabase.from("profiles").select("approved, role").eq("id", userId).maybeSingle();
    if (error) throw error;
    return { approved: !!data?.approved, role: data?.role ?? "agent" };
}
