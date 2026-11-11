import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Trans, useTranslation } from "react-i18next";
import { getMyAccess, onAuthChange, onRecoveryChange, requestPasswordReset, setNewPassword, signInWithPassword, signOut, signUpWithPassword } from "../lib/auth";
import { setMyRole } from "../store/store";
import { Field, Input, LanguageSwitcher } from "./ui";

// How often the pending-approval screen re-checks on its own, so an agent
// who gets approved doesn't have to manually refresh. Not aggressive enough
// to matter as backend load for how few people will ever sit on this screen.
const APPROVAL_POLL_MS = 20000;

type Approval = "checking" | boolean;

// Gates the whole app behind a Supabase session AND the Agent OS approval
// flag (see backend/sql/001_agent_approval.sql) -- properties live in
// Postgres now, so there's no local-only fallback the way there was before.
// Four states: signed out -> sign-in/sign-up form; signed up, waiting on
// Supabase's own email-confirmation link -> check-your-email screen; signed
// in but not yet approved -> waiting screen; signed in and approved -> the
// real app.
export function AuthGate({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null | "loading">("loading");
    const [approved, setApproved] = useState<Approval>("checking");
    // Lives here, not inside SignInScreen, so it reacts to `session` rather
    // than sitting frozen once set. Supabase syncs a new session across tabs
    // of the same browser via localStorage, so if the confirmation link is
    // opened in a second tab, this tab's `session` updates too and the
    // `!session` branch below stops rendering this screen on its own --
    // no polling needed, unlike the approval wait below it.
    const [awaitingEmailConfirmFor, setAwaitingEmailConfirmFor] = useState<string | null>(null);

    const [recovering, setRecovering] = useState(false);

    useEffect(() => onAuthChange(setSession), []);
    useEffect(() => onRecoveryChange(setRecovering), []);

    useEffect(() => {
        if (session === "loading" || !session) {
            setApproved("checking");
            setMyRole(null);
            return;
        }

        let cancelled = false;
        const check = () => {
            getMyAccess(session.user.id)
                .then((access) => {
                    if (cancelled) return;
                    setApproved(access.approved);
                    setMyRole(access.approved ? access.role : null);
                })
                .catch(() => { if (!cancelled) setApproved(false); });
        };
        check();

        const interval = setInterval(check, APPROVAL_POLL_MS);
        return () => { cancelled = true; clearInterval(interval); };
    }, [session]);

    if (session === "loading") return null;
    if (!session) {
        if (awaitingEmailConfirmFor) {
            return <CheckEmailScreen email={awaitingEmailConfirmFor} onBack={() => setAwaitingEmailConfirmFor(null)} />;
        }
        return <SignInScreen onSignedUpUnconfirmed={setAwaitingEmailConfirmFor} />;
    }
    if (recovering) return <NewPasswordScreen />;
    if (approved === "checking") return null;
    if (!approved) return <PendingApprovalScreen email={session.user.email ?? ""} />;
    return <>{children}</>;
}

function PendingApprovalScreen({ email }: { email: string }) {
    const { t } = useTranslation("account");
    return (
        <div className="auth-screen">
            <div className="auth-card">
                <h1 className="auth-title">Agent OS</h1>
                <p className="fs-13" style={{ lineHeight: 1.6, marginTop: 8 }}>
                    {t("auth.pendingTitle")}
                </p>
                <p className="fs-12 muted" style={{ lineHeight: 1.6, marginTop: 8 }}>
                    <Trans t={t} i18nKey="auth.pendingBody" values={{ email }} components={{ strong: <strong /> }} />
                </p>
                <button className="btn btn-secondary" style={{ width: "100%", marginTop: 18 }} onClick={signOut}>
                    {t("auth.signOut")}
                </button>
                <AuthLanguage />
            </div>
        </div>
    );
}

function CheckEmailScreen({ email, onBack }: { email: string; onBack: () => void }) {
    const { t } = useTranslation("account");
    return (
        <div className="auth-screen">
            <div className="auth-card">
                <h1 className="auth-title">Agent OS</h1>
                <p className="fs-13" style={{ lineHeight: 1.6, marginTop: 8 }}>
                    <Trans t={t} i18nKey="auth.checkEmail" values={{ email }} components={{ strong: <strong /> }} />
                </p>
                <p className="fs-12 muted" style={{ lineHeight: 1.6, marginTop: 8 }}>{t("auth.alreadyRegistered")}</p>
                <button className="btn btn-secondary" style={{ width: "100%", marginTop: 14 }} onClick={onBack}>
                    {t("auth.backToSignIn")}
                </button>
                <AuthLanguage />
            </div>
        </div>
    );
}

function SignInScreen({ onSignedUpUnconfirmed }: { onSignedUpUnconfirmed: (email: string) => void }) {
    const { t } = useTranslation("account");
    const [mode, setMode] = useState<"sign-in" | "sign-up" | "reset">("sign-in");
    const [resetSentTo, setResetSentTo] = useState<string | null>(null);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [err, setErr] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErr(null);
        setBusy(true);
        try {
            if (mode === "reset") {
                const { error } = await requestPasswordReset(email);
                if (error) setErr(error.message);
                else setResetSentTo(email);
                return;
            }
            const result =
                mode === "sign-in" ? await signInWithPassword(email, password) : await signUpWithPassword(email, password);
            if (result.error) {
                // Supabase answers in English; known codes are shown translated.
                const code = result.error.code ?? "";
                setErr(t(`auth.errors.${code}` as "auth.errors.invalid_credentials", { defaultValue: result.error.message }));
                return;
            }
            // No session back means Supabase's own "Confirm email" is on and
            // hasn't happened yet -- the expected path here, since we're
            // deliberately keeping that verification rather than relying on
            // Agent OS approval alone.
            if (mode === "sign-up" && !result.data.session) onSignedUpUnconfirmed(email);
        } finally {
            setBusy(false);
        }
    };

    if (resetSentTo) {
        return (
            <div className="auth-screen">
                <div className="auth-card">
                    <h1 className="auth-title">Agent OS</h1>
                    <p className="fs-13" style={{ lineHeight: 1.6, marginTop: 8 }}>
                        <Trans t={t} i18nKey="auth.resetSent" values={{ email: resetSentTo }} components={{ strong: <strong /> }} />
                    </p>
                    <button className="btn btn-secondary" style={{ width: "100%", marginTop: 14 }} onClick={() => { setResetSentTo(null); setMode("sign-in"); }}>
                        {t("auth.backToSignIn")}
                    </button>
                    <AuthLanguage />
                </div>
            </div>
        );
    }

    return (
        <div className="auth-screen">
            <div className="auth-card">
                <h1 className="auth-title">Agent OS</h1>
                <p className="fs-12 muted" style={{ marginBottom: 18 }}>
                    {mode === "sign-in" ? t("auth.signInIntro") : mode === "sign-up" ? t("auth.signUpIntro") : t("auth.resetIntro")}
                </p>

                <form onSubmit={submit}>
                    <Field label={t("auth.email")}>
                        <Input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("auth.emailPlaceholder")} />
                    </Field>
                    {mode !== "reset" ? (
                        <Field label={t("auth.password")} error={err}>
                            <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                        </Field>
                    ) : err ? <div className="fs-12" style={{ color: "var(--brick)", marginBottom: 10 }}>{err}</div> : null}
                    <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: 6 }} disabled={busy}>
                        {busy ? t("auth.pleaseWait") : mode === "sign-in" ? t("auth.signIn") : mode === "sign-up" ? t("auth.signUp") : t("auth.sendResetLink")}
                    </button>
                    {mode === "sign-in" && (
                        <button type="button" className="link-quiet fs-12" style={{ display: "block", margin: "10px auto 0" }}
                            onClick={() => { setErr(null); setMode("reset"); }}>
                            {t("auth.forgotPassword")}
                        </button>
                    )}
                    <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ width: "100%", marginTop: 8 }}
                        onClick={() => { setErr(null); setMode(mode === "sign-in" ? "sign-up" : "sign-in"); }}
                    >
                        {mode === "sign-in" ? t("auth.switchToSignUp") : t("auth.switchToSignIn")}
                    </button>
                </form>
                <AuthLanguage />
            </div>
        </div>
    );
}

/* Shown after opening a password-reset link. */
function NewPasswordScreen() {
    const { t } = useTranslation("account");
    const [password, setPassword] = useState("");
    const [err, setErr] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErr(null);
        setBusy(true);
        const { error } = await setNewPassword(password);
        setBusy(false);
        if (error) setErr(t(`auth.errors.${error.code ?? ""}` as "auth.errors.invalid_credentials", { defaultValue: error.message }));
    };
    return (
        <div className="auth-screen">
            <div className="auth-card">
                <h1 className="auth-title">Agent OS</h1>
                <p className="fs-13" style={{ marginBottom: 18 }}>{t("auth.newPasswordTitle")}</p>
                <form onSubmit={submit}>
                    <Field label={t("auth.newPassword")} error={err}>
                        <Input type="password" required minLength={6} autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                    </Field>
                    <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: 6 }} disabled={busy}>
                        {busy ? t("auth.pleaseWait") : t("auth.savePassword")}
                    </button>
                </form>
                <AuthLanguage />
            </div>
        </div>
    );
}

/* Language can be picked before signing in. */
function AuthLanguage() {
    return (
        <div className="row" style={{ justifyContent: "center", marginTop: 16 }}>
            <LanguageSwitcher />
        </div>
    );
}
