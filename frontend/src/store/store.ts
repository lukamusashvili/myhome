import { proxy, useSnapshot } from "valtio";
import { useEffect } from "react";
import type {
    ActivityEntry, Client, ColleagueRequirement, Inquiry, ModalState, Property, Requirement, Route, SentProperty, Settings,
    Task, Toast, TrashItem,
} from "../types";
import { createRequirement, createTask } from "../data/defaults";
import { isAccessibleProperty, propTitle } from "../lib/domain";
import { uid, usd } from "../lib/format";
import { TODAY, tbilisiDateOf } from "../lib/dates";
import { newId } from "../lib/http";
import { onAuthChange } from "../lib/auth";
import { t } from "../i18n";
import { enumLabel } from "../i18n/labels";
import type enCommon from "../i18n/locales/en/common.json";
import {
    createProperty as createPropertyApi,
    deleteProperty as deletePropertyApi,
    listProperties as listPropertiesApi,
    toggleFavorite as toggleFavoriteApi,
    updateProperty as updatePropertyApi,
} from "../lib/propertiesApi";
import {
    activityApi, clientsApi, colleagueRequirementsApi, inquiriesApi, meApi, requirementsApi, sentApi, tasksApi, trashApi,
    type ActivityRow, type ClientRow,
} from "../lib/workspaceApi";

/* Testing switch: keeps the whole trial system in place but never lets it
   lock the app while real agents are trying workflows. Set to false to get
   normal trial behaviour back. */
// BACKEND: replace with real subscription entitlement from the account
export const TESTING_FULL_ACCESS = true;

/* Everything here is a cache of the database. Records are loaded once per
   signed-in agent (hydrate) and every api.* write is sent to the backend;
   a failed write reverts the local change and says so. Nothing is kept in
   browser storage. */
interface AppState {
    properties: Property[];
    clients: ClientRow[];
    requirements: Requirement[];
    colleagueRequirements: ColleagueRequirement[];
    tasks: Task[];
    sent: SentProperty[];
    inquiries: Inquiry[];
    trash: TrashItem[];
    activity: Record<string, ActivityEntry[]>;
    settings: Settings;
    toasts: Toast[];
    hydrated: boolean;
    route: Route;
    modal: ModalState | null;
    drawer: boolean;
    sheet: boolean;
    // From profiles.role (see backend/sql/002_admin_role.sql), set by AuthGate.
    myRole: string | null;
}

const EMPTY_SETTINGS: Settings = { agency: "", agencyCode: "", trial: "active", profile: { name: "", phone: "", email: "", city: "" } };

export const store = proxy<AppState>({
    properties: [],
    clients: [],
    requirements: [],
    colleagueRequirements: [],
    tasks: [],
    sent: [],
    inquiries: [],
    trash: [],
    activity: {},
    settings: EMPTY_SETTINGS,
    toasts: [],
    hydrated: false,
    route: { name: "dashboard", params: {} },
    modal: null,
    drawer: false,
    sheet: false,
    myRole: null,
});

export function setMyRole(role: string | null) {
    store.myRole = role;
}

export function isReadOnly() {
    return !TESTING_FULL_ACCESS && store.settings.trial === "expired";
}

export function toast(text: string, tone?: "warn") {
    const id = uid("to");
    store.toasts.push({ id, text, tone });
    setTimeout(() => {
        const idx = store.toasts.findIndex((t) => t.id === id);
        if (idx !== -1) store.toasts.splice(idx, 1);
    }, tone === "warn" ? 5000 : 2800);
}

function guard() {
    if (isReadOnly()) {
        toast(t("toast.readOnly"), "warn");
        return false;
    }
    return true;
}

type SaveWhat = keyof typeof enCommon.toast.what;

const errText = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

/* Runs a backend write; on failure restores the snapshot taken before the
   optimistic change and tells the agent. Concurrent edits made while the
   request is in flight are lost on revert — rare, but worth knowing. */
function persist(work: Promise<unknown>, revert: () => void, what: SaveWhat) {
    work.catch((err) => {
        revert();
        toast(t("toast.reverted", { error: errText(err, t("toast.couldntSave", { what: t(`toast.what.${what}`) })) }), "warn");
    });
}

/* Activity entries are stored as text, written in the language the agent was
   using at the time. */
const importedText = (p: Partial<Property>) =>
    p.sourceRef ? t("activity.importedRef", { source: p.source, ref: p.sourceRef }) : t("activity.imported", { source: p.source });
const isImportedText = (text: string) => /^(Imported from|იმპორტირებულია)/.test(text);
const snapshot = <K extends keyof AppState>(key: K) => {
    const before = store[key];
    return () => { store[key] = before; };
};

function logActivity(propertyId: string, text: string) {
    const existing = store.activity[propertyId] || [];
    store.activity[propertyId] = [{ date: TODAY, text }, ...existing];
    activityApi.create({ propertyId, text }).catch((err) => {
        toast(errText(err, t("toast.couldntSaveActivity")), "warn");
    });
}

function patchProperty(id: string, patch: Partial<Property>, what: SaveWhat = "changes") {
    const revert = snapshot("properties");
    store.properties = store.properties.map((x) => (x.id === id ? { ...x, ...patch } : x));
    // Keep the server's updatedAt, so the next form save isn't seen as stale.
    persist(updatePropertyApi(id, patch).then((saved) => {
        store.properties = store.properties.map((x) => (x.id === id ? { ...x, updatedAt: saved.updatedAt } : x));
    }), revert, what);
}

function patchClient(id: string, patch: Partial<Client>) {
    const revert = snapshot("clients");
    store.clients = store.clients.map((x) => (x.id === id ? { ...x, ...patch } : x));
    persist(clientsApi.update(id, patch), revert, "client");
}

/* Recently Deleted lives in trash_items: written on delete, removed on
   restore or purge, so a deleted record can always be found again. */
function addToTrash(kind: TrashItem["kind"], refId: string, label: string) {
    const item: TrashItem = { id: newId(), kind, label, refId, deletedAt: TODAY };
    const revert = snapshot("trash");
    store.trash = [item, ...store.trash.filter((t) => !(t.kind === kind && t.refId === refId))];
    // The real moment, not midnight: the 30-day purge counts from it.
    persist(trashApi.create({ ...item, deletedAt: new Date().toISOString() }), revert, "trash");
}
function dropFromTrash(item: TrashItem) {
    const revert = snapshot("trash");
    store.trash = store.trash.filter((t) => t.id !== item.id);
    persist(trashApi.remove(item.id), revert, "trash");
}

function patchRequirement(id: string, patch: Partial<Requirement>) {
    const revert = snapshot("requirements");
    store.requirements = store.requirements.map((x) => (x.id === id ? { ...x, ...patch } : x));
    persist(requirementsApi.update(id, patch), revert, "requirement");
}

export const api = {
    /* properties */
    async saveProperty(p: Partial<Property> & { id: string }): Promise<string | null> {
        if (!guard()) return null;
        const exists = store.properties.some((x) => x.id === p.id);

        if (!exists) {
            try {
                const created = await createPropertyApi(p);
                store.properties = [created, ...store.properties];
                logActivity(created.id, p.importedAt ? importedText(p) : t("activity.created"));
                toast(t("toast.propertySaved"));
                return created.id;
            } catch (err) {
                toast(errText(err, t("toast.couldntSaveProperty")), "warn");
                return null;
            }
        }

        const before = store.properties;
        const current = store.properties.find((x) => x.id === p.id);
        try {
            // expectedUpdatedAt: refuse to overwrite a change saved meanwhile
            // in another tab or device (v3 report, N2).
            const saved = await updatePropertyApi(p.id, { ...p, expectedUpdatedAt: current?.updatedAt });
            store.properties = store.properties.map((x) => (x.id === p.id ? { ...x, ...saved, mine: x.mine, favorite: x.favorite, agency: x.agency, sharedBy: x.sharedBy } : x));
            logActivity(p.id, t("activity.updated"));
            toast(t("toast.propertyUpdated"));
            return p.id;
        } catch (err) {
            store.properties = before;
            toast(errText(err, t("toast.couldntSaveProperty")), "warn");
            return null;
        }
    },
    toggleFavorite(id: string) {
        if (!guard()) return;
        const p = store.properties.find((x) => x.id === id);
        const next = !p?.favorite;
        const revert = snapshot("properties");
        store.properties = store.properties.map((x) => (x.id === id ? { ...x, favorite: next } : x));
        toast(next ? t("toast.addedFavorite") : t("toast.removedFavorite"));
        persist(toggleFavoriteApi(id), revert, "favorite");
    },
    archiveProperty(id: string, reason: string) {
        if (!guard()) return;
        patchProperty(id, { status: "archived", archiveReason: reason, sharedWithAgency: false }, "archive");
        logActivity(id, t("activity.archived", { reason: enumLabel("archiveReason", reason) }));
        toast(t("toast.archivedAs", { reason: enumLabel("archiveReason", reason) }));
    },
    reactivateProperty(id: string) {
        if (!guard()) return;
        patchProperty(id, { status: "active", archiveReason: null });
        logActivity(id, t("activity.reactivated"));
        toast(t("toast.activeAgain"));
    },
    deleteProperty(id: string) {
        if (!guard()) return;
        const p = store.properties.find((x) => x.id === id);
        patchProperty(id, { deleted: true, sharedWithAgency: false }, "delete");
        addToTrash("Property", id, propTitle(p));
        toast(t("toast.movedToTrash"));
    },
    recordPublishedListing(id: string, portal: "myhome" | "ss", listingId: string, url: string) {
        if (!guard()) return;
        const patch = portal === "myhome"
            ? { myHomeListingId: listingId, myHomeListingUrl: url }
            : { ssListingId: listingId, ssListingUrl: url };
        patchProperty(id, patch, "publishedId");
        logActivity(id, t("activity.published", { portal: portal === "myhome" ? "MyHome.ge" : "SS.ge", id: listingId }));
    },
    shareProperty(id: string, on: boolean) {
        if (!guard()) return;
        if (on && !store.settings.agency) {
            toast(t("toast.joinAgencyFirst"), "warn");
            return;
        }
        patchProperty(id, { sharedWithAgency: on }, "sharing");
        logActivity(id, on ? t("activity.sharedWith", { agency: store.settings.agency }) : t("activity.sharingStopped"));
        toast(on ? t("toast.sharedWith", { agency: store.settings.agency }) : t("toast.stoppedSharing"));
    },
    markVerified(id: string) {
        if (!guard()) return;
        const current = store.properties.find((x) => x.id === id);
        const nextStatus = current?.status === "needs_verification" ? ("active" as const) : current?.status;
        patchProperty(id, { verifiedAt: TODAY, status: nextStatus ?? "active" });
        logActivity(id, t("activity.verified"));
        toast(t("toast.verifiedToday"));
    },
    /* clients */
    addClient(c: Partial<Client>): string | null {
        if (!guard()) return null;
        // No last-contact date until the agent records one (v3 report, D3).
        const row = { status: "active" as const, lastContact: "", notes: "", ...c, id: newId() } as ClientRow;
        const revert = snapshot("clients");
        store.clients = [row, ...store.clients];
        persist(clientsApi.create(row), revert, "client");
        toast(t("toast.clientCreated"));
        return row.id;
    },
    updateClient(c: Partial<Client> & { id: string }) {
        if (!guard()) return;
        const { id, ...patch } = c;
        patchClient(id, patch);
        toast(t("toast.clientUpdated"));
    },
    deleteClient(id: string) {
        if (!guard()) return;
        const c = store.clients.find((x) => x.id === id);
        patchClient(id, { deleted: true });
        addToTrash("Client", id, c?.name ?? "");
        store.requirements.filter((r) => r.clientId === id && r.shared).forEach((r) => patchRequirement(r.id, { shared: false }));
        toast(t("toast.movedToTrash"));
    },
    /* requirements */
    saveRequirement(r: Partial<Requirement> & { id?: string }): string | null {
        if (!guard()) return null;
        const exists = !!r.id && store.requirements.some((x) => x.id === r.id);
        if (exists) {
            const { id, ...patch } = r;
            patchRequirement(id as string, patch);
            toast(t("toast.requirementUpdated"));
            return id as string;
        }
        const row = { ...createRequirement(r), id: newId() };
        const revert = snapshot("requirements");
        store.requirements = [...store.requirements, row];
        persist(requirementsApi.create(row), revert, "requirement");
        toast(t("toast.requirementCreated"));
        return row.id;
    },
    setRequirementStatus(id: string, status: Requirement["status"]) {
        if (!guard()) return;
        patchRequirement(id, { status });
        toast(status === "active" ? t("toast.requirementResumed") : status === "paused" ? t("toast.requirementPaused") : t("toast.requirementClosed"));
    },
    shareRequirement(id: string, on: boolean) {
        if (!guard()) return;
        if (on && !store.settings.agency) {
            toast(t("toast.joinAgencyFirst"), "warn");
            return;
        }
        patchRequirement(id, { shared: on });
        toast(on ? t("toast.requirementShared", { agency: store.settings.agency }) : t("toast.requirementUnshared"));
    },
    /* tasks */
    addTask(task: Partial<Task>): string | null {
        if (!guard()) return null;
        const row = { ...createTask(task), id: newId() };
        const revert = snapshot("tasks");
        store.tasks = [...store.tasks, row];
        persist(tasksApi.create(row), revert, "task");
        toast(t("toast.taskCreated"));
        return row.id;
    },
    updateTask(task: Partial<Task> & { id: string }) {
        if (!guard()) return;
        const { id, ...patch } = task;
        const revert = snapshot("tasks");
        store.tasks = store.tasks.map((x) => (x.id === id ? { ...x, ...patch } : x));
        persist(tasksApi.update(id, patch), revert, "task");
        toast(t("toast.taskUpdated"));
    },
    toggleTask(id: string) {
        if (!guard()) return;
        const task = store.tasks.find((x) => x.id === id);
        if (!task) return;
        const revert = snapshot("tasks");
        store.tasks = store.tasks.map((x) => (x.id === id ? { ...x, done: !x.done } : x));
        persist(tasksApi.update(id, { done: !task.done }), revert, "task");
        if (!task.done) toast(t("toast.taskCompleted"));
    },
    deleteTask(id: string) {
        if (!guard()) return;
        const revert = snapshot("tasks");
        store.tasks = store.tasks.filter((x) => x.id !== id);
        persist(tasksApi.remove(id), revert, "task");
        toast(t("toast.taskDeleted"));
    },
    /* offers */
    // `price` is the figure the agent confirmed: stored as sent, never recomputed
    sendOffer(clientId: string, items: { id: string; price: number }[]) {
        if (!guard()) return;
        const recs: SentProperty[] = items.map((i) => ({
            id: newId(), clientId, propertyId: i.id, date: TODAY, price: i.price, feedback: "No Response",
            propertyLabel: propTitle(store.properties.find((p) => p.id === i.id)),
        }));
        const revert = snapshot("sent");
        store.sent = [...recs, ...store.sent];
        persist(Promise.all(recs.map((r) => sentApi.create(r))), revert, "offer");
        patchClient(clientId, { lastContact: TODAY });
        const clientName = store.clients.find((c) => c.id === clientId)?.name;
        items.forEach((i) => logActivity(i.id, t("activity.sentTo", { name: clientName, price: usd(i.price) })));
    },
    setFeedback(sentId: string, feedback: SentProperty["feedback"]) {
        if (!guard()) return;
        const revert = snapshot("sent");
        store.sent = store.sent.map((s) => (s.id === sentId ? { ...s, feedback } : s));
        persist(sentApi.update(sentId, { feedback }), revert, "feedback");
        toast(t("toast.markedAs", { feedback: enumLabel("feedback", feedback) }));
    },
    /* inquiries */
    // listingReference is a historical snapshot; never derive it from the
    // property's current portal fields
    addInquiry(i: Partial<Inquiry>): string | null {
        if (!guard()) return null;
        const row = { date: TODAY, converted: false, listingReference: null, note: "", ...i, id: newId() } as Inquiry;
        const revert = snapshot("inquiries");
        store.inquiries = [row, ...store.inquiries];
        persist(inquiriesApi.create(row), revert, "inquiry");
        toast(t("toast.inquirySaved"));
        return row.id;
    },
    convertInquiry(inqId: string, name: string): string | null {
        if (!guard()) return null;
        const inq = store.inquiries.find((x) => x.id === inqId);
        if (!inq) return null;
        const p = inq.propertyId ? store.properties.find((x) => x.id === inq.propertyId) : null;
        const client: ClientRow = {
            id: newId(), name, phone: inq.phone, status: "active", lastContact: TODAY,
            notes: `${p ? t("activity.fromInquiryAbout", { property: propTitle(p) }) : t("activity.fromInquiry")} ${inq.note}`.trim(),
        };
        const revertClients = snapshot("clients");
        const revertInquiries = snapshot("inquiries");
        store.clients = [client, ...store.clients];
        store.inquiries = store.inquiries.map((x) => (x.id === inqId ? { ...x, converted: true, clientId: client.id } : x));
        persist(
            clientsApi.create(client).then(() => inquiriesApi.update(inqId, { converted: true, clientId: client.id })),
            () => { revertClients(); revertInquiries(); },
            "client",
        );
        toast(t("toast.addedToClients", { name }));
        return client.id;
    },
    deleteInquiry(id: string) {
        if (!guard()) return;
        const revert = snapshot("inquiries");
        store.inquiries = store.inquiries.filter((x) => x.id !== id);
        persist(inquiriesApi.remove(id), revert, "inquiry");
        toast(t("toast.inquiryRemoved"));
    },
    /* trash */
    restoreTrash(item: TrashItem) {
        if (!guard() || !item.refId) return;
        if (item.kind === "Property") patchProperty(item.refId, { deleted: false }, "restore");
        else patchClient(item.refId, { deleted: false });
        dropFromTrash(item);
        toast(item.kind === "Client" ? t("toast.clientRestored", { name: item.label }) : t("toast.restored", { name: item.label }));
    },
    purgeTrash(item: TrashItem) {
        if (!guard() || !item.refId) return;
        const id = item.refId;
        const revertProps = snapshot("properties");
        const revertClients = snapshot("clients");
        const revertReqs = snapshot("requirements");
        const revertTasks = snapshot("tasks");
        const revertSent = snapshot("sent");
        const revertAll = () => { revertProps(); revertClients(); revertReqs(); revertTasks(); revertSent(); };
        if (item.kind === "Property") {
            store.properties = store.properties.filter((x) => x.id !== id);
            store.tasks = store.tasks.map((x) => (x.propertyId === id ? { ...x, propertyId: null } : x));
            store.sent = store.sent.filter((s) => s.propertyId !== id);
            persist(deletePropertyApi(id, { permanent: true }), revertAll, "permanentDelete");
        } else {
            store.clients = store.clients.filter((x) => x.id !== id);
            store.requirements = store.requirements.filter((r) => r.clientId !== id);
            store.tasks = store.tasks.map((x) => (x.clientId === id ? { ...x, clientId: null } : x));
            store.sent = store.sent.filter((s) => s.clientId !== id);
            persist(clientsApi.remove(id), revertAll, "permanentDelete");
        }
        dropFromTrash(item);
        toast(t("toast.purged"));
    },
    /* settings */
    // Atomic server-side (public.change_my_agency): revokes outgoing shares
    // and moves the agent and their stock to the new agency.
    async changeAgency(name: string, code?: string): Promise<boolean> {
        if (!guard()) return false;
        const wasShared = store.properties.filter((p) => p.mine && p.sharedWithAgency).length + store.requirements.filter((r) => r.shared).length;
        try {
            store.settings = await meApi.changeAgency(name, code);
            store.properties = store.properties.map((p) => (p.mine ? { ...p, sharedWithAgency: false, agency: store.settings.agency } : p));
            store.requirements = store.requirements.map((r) => ({ ...r, shared: false }));
            // incoming shares belong to the agency, so reload them
            const [properties, colleagueRequirements] = await Promise.all([listPropertiesApi(), colleagueRequirementsApi.list()]);
            store.properties = properties;
            store.colleagueRequirements = colleagueRequirements;
            toast(wasShared ? t("toast.agencyChanged", { agency: store.settings.agency, count: wasShared }) : t("toast.agencyChangedNone", { agency: store.settings.agency }));
            return true;
        } catch (err) {
            toast(errText(err, t("toast.couldntChangeAgency")), "warn");
            return false;
        }
    },
    // Demo walkthrough control only: flips the read-only view for this
    // session. The real trial state lives in profiles.trial_status and only
    // an admin can change it.
    setTrial(state: Settings["trial"]) {
        store.settings = { ...store.settings, trial: state };
        toast(state === "expired" ? t("toast.previewReadOnly") : t("toast.fullAccess"));
    },
    async updateProfile(p: Partial<Settings["profile"]>) {
        if (!guard()) return;
        try {
            store.settings = await meApi.update(p);
            toast(t("toast.profileSaved"));
        } catch (err) {
            toast(errText(err, t("toast.couldntSaveProfile")), "warn");
        }
    },
    toast,
    get readOnly() { return isReadOnly(); },
};

/* Everything the UI may see. Actions keep using raw state so nothing is lost. */
function computeAccessible(properties: Property[], agency: string) {
    return properties.filter((p) => isAccessibleProperty(p, agency));
}

function buildSelectors(accessible: Property[], allProperties: Property[], clients: Client[], requirements: Requirement[], tasks: Task[], sent: SentProperty[], activity: Record<string, ActivityEntry[]>) {
    const visibleProperties = accessible.filter((p) => !p.deleted);
    return {
        visibleProperties,
        myProperties: accessible.filter((p) => !p.deleted && p.mine),
        sharedInventory: accessible.filter((p) => !p.deleted && !p.mine),
        property: (id: string) => accessible.find((p) => p.id === id),
        client: (id: string) => clients.find((c) => c.id === id),
        clientRequirements: (cid: string) => requirements.filter((r) => r.clientId === cid),
        requirement: (id: string) => requirements.find((r) => r.id === id),
        clientSent: (cid: string) => sent.filter((s) => s.clientId === cid),
        propertySent: (pid: string) => sent.filter((s) => s.propertyId === pid),
        lastSent: (cid: string, pid: string) =>
            sent.filter((s) => s.clientId === cid && s.propertyId === pid).sort((a, b) => b.date.localeCompare(a.date))[0],
        todayTasks: tasks.filter((t) => t.date === TODAY),
        overdueTasks: tasks.filter((t) => !t.done && !!t.date && t.date < TODAY),
        // Undated tasks are open with no deadline: listed last under Upcoming.
        upcomingTasks: tasks.filter((t) => !t.done && (!t.date || t.date > TODAY))
            .sort((a, b) => (a.date ? a.date + a.time : "~").localeCompare(b.date ? b.date + b.time : "~")),
        completedTasks: tasks.filter((t) => t.done),
        // Only what was really recorded. Older properties created before the
        // activity log existed get their import as the one known event.
        activityFor: (pid: string) => {
            const logged = activity[pid] || [];
            const p = allProperties.find((x) => x.id === pid);
            const importedLogged = logged.some((a) => isImportedText(a.text));
            const base: ActivityEntry[] = p && p.importedAt && !importedLogged
                ? [{ date: p.importedAt, text: importedText(p) }]
                : [];
            return [...logged, ...base].sort((a, b) => b.date.localeCompare(a.date));
        },
    };
}

/* --- loading: once per signed-in agent --- */
let hydratedFor: string | null = null;
let hydrating: Promise<void> | null = null;

function groupActivity(rows: ActivityRow[]): Record<string, ActivityEntry[]> {
    const out: Record<string, ActivityEntry[]> = {};
    for (const r of rows) {
        if (!r.propertyId) continue;
        (out[r.propertyId] = out[r.propertyId] || []).push({ date: tbilisiDateOf(r.occurredAt), text: r.text });
    }
    return out;
}

function resetStore() {
    store.properties = [];
    store.clients = [];
    store.requirements = [];
    store.colleagueRequirements = [];
    store.tasks = [];
    store.sent = [];
    store.inquiries = [];
    store.trash = [];
    store.activity = {};
    store.settings = EMPTY_SETTINGS;
    store.route = { name: "dashboard", params: {} };
    store.modal = null;
    store.hydrated = false;
}

async function hydrate(userId: string) {
    if (hydratedFor === userId && hydrating) return hydrating;
    if (hydratedFor !== userId) resetStore();
    hydratedFor = userId;
    hydrating = (async () => {
        const load = async <T>(work: Promise<T>, apply: (v: T) => void, label: SaveWhat) => {
            try { apply(await work); } catch (err) { toast(t("toast.couldntLoad", { what: t(`toast.what.${label}`), error: errText(err, t("toast.serverError")) }), "warn"); }
        };
        await Promise.all([
            load(meApi.get(), (v) => { store.settings = v; }, "profile"),
            load(listPropertiesApi(), (v) => { store.properties = v; }, "properties"),
            load(clientsApi.list(), (v) => { store.clients = v; }, "clients"),
            load(requirementsApi.list(), (v) => { store.requirements = v.reverse(); }, "requirements"),
            load(colleagueRequirementsApi.list(), (v) => { store.colleagueRequirements = v; }, "sharedRequirements"),
            load(tasksApi.list(), (v) => { store.tasks = v; }, "tasks"),
            load(sentApi.list(), (v) => { store.sent = v; }, "sentOffers"),
            load(inquiriesApi.list(), (v) => { store.inquiries = v; }, "inquiries"),
            load(trashApi.list(), (v) => { store.trash = v; }, "trash"),
            load(activityApi.list(), (v) => { store.activity = groupActivity(v); }, "activity"),
        ]);
        if (hydratedFor === userId) store.hydrated = true;
    })();
    return hydrating;
}

// Signing out drops the cached records so the next agent on this browser
// never sees the previous one's data.
onAuthChange((session) => {
    if (!session && hydratedFor) {
        hydratedFor = null;
        hydrating = null;
        resetStore();
    }
});

/* Safe under StrictMode's double effect: hydrate() is idempotent per user. */
export function useHydration(userId: string | null) {
    useEffect(() => {
        if (userId) void hydrate(userId);
    }, [userId]);
}

/* --- UI navigation / modal state --- */
export function nav(name: string, params: Record<string, unknown> = {}) {
    store.route = { name, params };
    store.drawer = false;
    store.sheet = false;
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
}
export function openModal(type: string, props: Record<string, unknown> = {}) {
    if (isReadOnly() && !["export", "contact-agent", "extension"].includes(type)) {
        toast(t("toast.readOnly"), "warn");
        return;
    }
    store.modal = { type, props };
}
export function closeModal() {
    store.modal = null;
}
export function setDrawer(v: boolean) {
    store.drawer = v;
}
export function setSheet(v: boolean) {
    store.sheet = v;
}

/* --- the single hook every screen uses, mirroring the original useApp() shape --- */
export function useApp() {
    const snap = useSnapshot(store);
    const accessible = computeAccessible(snap.properties as Property[], snap.settings.agency);
    const sel = buildSelectors(
        accessible, snap.properties as Property[], snap.clients as Client[], snap.requirements as Requirement[],
        snap.tasks as Task[], snap.sent as SentProperty[], snap.activity as Record<string, ActivityEntry[]>,
    );
    return {
        properties: accessible,
        clients: (snap.clients as Client[]).filter((c) => !c.deleted),
        requirements: snap.requirements as Requirement[],
        colleagueRequirements: snap.colleagueRequirements as ColleagueRequirement[],
        tasks: snap.tasks as Task[],
        sent: snap.sent as SentProperty[],
        inquiries: snap.inquiries as Inquiry[],
        trash: snap.trash as TrashItem[],
        settings: snap.settings as Settings,
        toasts: snap.toasts as Toast[],
        readOnly: isReadOnly(),
        hydrated: snap.hydrated,
        myRole: snap.myRole as string | null,
        api,
        sel,
        route: snap.route as Route,
        modal: snap.modal as ModalState | null,
        nav,
        openModal,
        closeModal,
        drawer: snap.drawer,
        sheet: snap.sheet,
        setDrawer,
        setSheet,
    };
}

export function useTaskHandlers() {
    const { readOnly } = useApp();
    return (t: Task) => ({
        onToggle: () => api.toggleTask(t.id),
        onOpenClient: () => nav("client", { id: t.clientId }),
        onOpenProperty: () => nav("property", { id: t.propertyId }),
        onEdit: () => openModal("task", { initial: t }),
        onDelete: () => api.deleteTask(t.id),
        readOnly,
    });
}
