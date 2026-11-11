import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { t as tr } from "../i18n";
import { enumLabel, enumOptions } from "../i18n/labels";
import { Building2, ChevronLeft, ChevronRight, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useApp } from "../store/store";
import { Badge, ConfirmDialog, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea, Toggle } from "../components/ui";
import { listAgents, updateAgent, type AdminAgent } from "../lib/adminAgentsApi";
import { listClientsPage, createClient, updateClient, deleteClient, type AdminClient } from "../lib/clientsApi";
import { listPropertiesPage, createProperty, updateProperty, deleteProperty } from "../lib/propertiesApi";
import type { Client, Property } from "../types";
import { DISTRICTS, PROPERTY_TYPES, CONDITIONS, BUILDING_TYPES } from "../data/constants";
import { usd } from "../lib/format";
import { fmtDate } from "../lib/dates";

// Desktop-only (no mobile card layout, unlike the agent-facing list pages) --
// this is a moderation tool, not something an agent reaches for day to day.
const PAGE_SIZE = 20;

function Pager({ page, setPage, count, pageSize }: { page: number; setPage: (p: number) => void; count: number; pageSize: number }) {
    const { t } = useTranslation("admin");
    const pages = Math.max(1, Math.ceil(count / pageSize));
    return (
        <div className="row" style={{ justifyContent: "space-between", marginTop: 14 }}>
            <div className="fs-12 muted">{t("pager.total", { count })}</div>
            <div className="row" style={{ gap: 8, alignItems: "center" }}>
                <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={14} /></button>
                <div className="fs-12 muted">{t("pager.page", { page, pages })}</div>
                <button className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight size={14} /></button>
            </div>
        </div>
    );
}

/* Every agent, for showing owners by name and picking one. */
function useAgentDirectory() {
    const [agents, setAgents] = useState<AdminAgent[]>([]);
    useEffect(() => {
        listAgents(1, 500).then((r) => setAgents(r.items)).catch(() => setAgents([]));
    }, []);
    return agents;
}
const agentLabel = (a: AdminAgent | undefined) => (a ? a.name || a.email || tr("admin:unnamedAgent") : "—");
const roleLabel = (role: string) => tr(`admin:role.${role}` as "admin:role.agent", { defaultValue: role });
const trialLabel = (s: string) => tr(`admin:trialStatus.${s}` as "admin:trialStatus.active", { defaultValue: s });

export default function Admin() {
    const { t } = useTranslation("admin");
    const [tab, setTab] = useState<"agents" | "customers" | "properties">("agents");
    const agents = useAgentDirectory();
    const pending = agents.filter((a) => !a.approved).length;
    return (
        <div className="page">
            <PageHeader title={t("title")} subtitle={t("subtitle")} />
            <div className="tabs" style={{ marginBottom: 16 }}>
                {(["agents", "customers", "properties"] as const).map((k) => (
                    <button key={k} className={`tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>
                        {t(`tabs.${k}`)}{k === "agents" && pending > 0 && <Badge tone="amber">{t("waiting", { count: pending })}</Badge>}
                    </button>
                ))}
            </div>
            {tab === "agents" && <AgentsTab />}
            {tab === "customers" && <CustomersTab agents={agents} />}
            {tab === "properties" && <PropertiesTab agents={agents} />}
        </div>
    );
}

/* ---------------- Agents ---------------- */
// Read + update only, deliberately no create/delete here -- see
// backend/src/controllers/adminAgentsController.js for why.

function AgentsTab() {
    const { t } = useTranslation("admin");
    const { api } = useApp();
    const [page, setPage] = useState(1);
    const [items, setItems] = useState<AdminAgent[]>([]);
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<AdminAgent | null>(null);

    useEffect(() => {
        setLoading(true);
        listAgents(page, PAGE_SIZE)
            .then((res) => { setItems(res.items); setCount(res.count); })
            .catch((err) => api.toast(err instanceof Error ? err.message : t("agents.loadFailed"), "warn"))
            .finally(() => setLoading(false));
    }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

    const save = async (patch: Partial<AdminAgent>) => {
        if (!editing) return;
        try {
            const updated = await updateAgent(editing.id, patch);
            setItems((xs) => xs.map((x) => (x.id === updated.id ? updated : x)));
            api.toast(t("agents.updated"));
            setEditing(null);
        } catch (err) {
            api.toast(err instanceof Error ? err.message : t("agents.saveFailed"), "warn");
        }
    };

    if (!loading && items.length === 0) {
        return <EmptyState icon={<Users size={20} />} title={t("agents.emptyTitle")} body={t("agents.emptyBody")} />;
    }

    return (
        <>
            <div className="card tbl-wrap">
                <table className="tbl">
                    <thead><tr>{[t("agents.cols.name"), t("agents.cols.email"), t("agents.cols.role"), t("agents.cols.approved"), t("agents.cols.trial"), t("agents.cols.joined"), ""].map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                    <tbody>
                        {items.map((a) => (
                            <tr key={a.id}>
                                <td className="bold">{a.name || <span className="faint">{t("agents.noName")}</span>}</td>
                                <td className="muted">{a.email}</td>
                                <td><Badge tone={a.role === "admin" ? "navy" : "gray"}>{roleLabel(a.role).toUpperCase()}</Badge></td>
                                <td><Badge tone={a.approved ? "teal" : "amber"}>{a.approved ? t("agents.approvedBadge") : t("agents.pendingBadge")}</Badge></td>
                                <td className="muted">{trialLabel(a.trialStatus)}</td>
                                <td className="faint">{fmtDate(a.createdAt)}</td>
                                <td><button className="icon-btn plain" onClick={() => setEditing(a)}><Pencil size={14} /></button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Pager page={page} setPage={setPage} count={count} pageSize={PAGE_SIZE} />
            {editing && <AgentEditModal agent={editing} onClose={() => setEditing(null)} onSave={save} />}
        </>
    );
}

function AgentEditModal({
    agent, onClose, onSave,
}: { agent: AdminAgent; onClose: () => void; onSave: (patch: Partial<AdminAgent>) => void }) {
    const { t } = useTranslation(["admin", "common"]);
    const [name, setName] = useState(agent.name);
    const [phone, setPhone] = useState(agent.phone || "");
    const [city, setCity] = useState(agent.city || "");
    const [role, setRole] = useState(agent.role);
    const [approved, setApproved] = useState(agent.approved);
    const [trialStatus, setTrialStatus] = useState(agent.trialStatus);

    return (
        <Modal title={agent.email || t("agents.editTitle")} onClose={onClose} footer={<>
            <button className="btn btn-secondary" onClick={onClose}>{t("common:actions.cancel")}</button>
            <button className="btn btn-primary" onClick={() => onSave({ name, phone, city, role, approved, trialStatus })}>{t("common:actions.save")}</button>
        </>}>
            <div className="form-grid">
                <Field label={t("agents.name")}><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
                <Field label={t("agents.phone")}><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
                <Field label={t("agents.city")}><Input value={city} onChange={(e) => setCity(e.target.value)} /></Field>
                <Field label={t("agents.roleLabel")}><Select value={role} onChange={(e) => setRole(e.target.value)} options={["agent", "admin"].map((v) => ({ value: v, label: roleLabel(v) }))} /></Field>
                <Field label={t("agents.trialLabel")}><Select value={trialStatus} onChange={(e) => setTrialStatus(e.target.value)} options={["active", "expired"].map((v) => ({ value: v, label: trialLabel(v) }))} /></Field>
            </div>
            <Toggle label={t("agents.approvedLabel")} hint={t("agents.approvedHint")} on={approved} onChange={setApproved} />
        </Modal>
    );
}

/* ---------------- Customers (clients) ---------------- */

function CustomersTab({ agents }: { agents: AdminAgent[] }) {
    const { t } = useTranslation("admin");
    const { api } = useApp();
    const [page, setPage] = useState(1);
    const [items, setItems] = useState<AdminClient[]>([]);
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<AdminClient | "new" | null>(null);
    const [deleting, setDeleting] = useState<AdminClient | null>(null);

    const load = () => {
        setLoading(true);
        listClientsPage(page, PAGE_SIZE)
            .then((res) => { setItems(res.items); setCount(res.count); })
            .catch((err) => api.toast(err instanceof Error ? err.message : t("clients.loadFailed"), "warn"))
            .finally(() => setLoading(false));
    };
    useEffect(load, [page]); // eslint-disable-line react-hooks/exhaustive-deps

    const save = async (patch: Record<string, unknown>) => {
        try {
            if (editing === "new") {
                await createClient(patch);
                api.toast(t("clients.created"));
                setEditing(null);
                load();
                return;
            }
            if (editing) {
                const updated = await updateClient(editing.id, patch);
                setItems((xs) => xs.map((x) => (x.id === updated.id ? updated : x)));
                api.toast(t("clients.updated"));
            }
            setEditing(null);
        } catch (err) {
            api.toast(err instanceof Error ? err.message : t("clients.saveFailed"), "warn");
        }
    };

    const remove = async () => {
        if (!deleting) return;
        try {
            await deleteClient(deleting.id);
            setItems((xs) => xs.filter((x) => x.id !== deleting.id));
            setCount((c) => c - 1);
            api.toast(t("clients.deleted"));
        } catch (err) {
            api.toast(err instanceof Error ? err.message : t("clients.deleteFailed"), "warn");
        } finally {
            setDeleting(null);
        }
    };

    return (
        <>
            <div className="row" style={{ justifyContent: "flex-end", marginBottom: 10 }}>
                <button className="btn btn-primary btn-sm" onClick={() => setEditing("new")}><Plus size={14} /> {t("clients.add")}</button>
            </div>
            {!loading && items.length === 0 ? (
                <EmptyState icon={<Users size={20} />} title={t("clients.emptyTitle")} body={t("clients.emptyBody")} />
            ) : (
                <div className="card tbl-wrap">
                    <table className="tbl">
                        <thead><tr>{[t("clients.cols.name"), t("clients.cols.phone"), t("clients.cols.status"), t("clients.cols.lastContact"), t("clients.cols.owner"), ""].map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                        <tbody>
                            {items.map((c) => (
                                <tr key={c.id}>
                                    <td className="bold">{c.name}{c.deleted ? <Badge tone="brick">{t("deletedBadge")}</Badge> : null}</td>
                                    <td className="muted">{c.phone}</td>
                                    <td><Badge tone={c.status === "active" ? "teal" : c.status === "paused" ? "amber" : "gray"}>{enumLabel("lifecycle", c.status).toUpperCase()}</Badge></td>
                                    <td className="faint">{c.lastContact ? fmtDate(c.lastContact) : "—"}</td>
                                    <td className="faint">{agentLabel(agents.find((a) => a.id === c.ownerId))}</td>
                                    <td>
                                        <div className="row" style={{ gap: 6 }}>
                                            <button className="icon-btn plain" onClick={() => setEditing(c)}><Pencil size={14} /></button>
                                            <button className="icon-btn plain" onClick={() => setDeleting(c)}><Trash2 size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <Pager page={page} setPage={setPage} count={count} pageSize={PAGE_SIZE} />
            {editing && <ClientEditModal client={editing === "new" ? null : editing} agents={agents} onClose={() => setEditing(null)} onSave={save} />}
            {deleting && (
                <ConfirmDialog title={t("clients.deleteTitle")} danger confirmLabel={tr("common:actions.delete")}
                    body={t("clients.deleteBody", { name: deleting.name })}
                    onConfirm={remove} onClose={() => setDeleting(null)} />
            )}
        </>
    );
}

function ClientEditModal({
    client, agents, onClose, onSave,
}: { client: AdminClient | null; agents: AdminAgent[]; onClose: () => void; onSave: (patch: Record<string, unknown>) => void }) {
    const { t } = useTranslation(["admin", "common"]);
    const [ownerId, setOwnerId] = useState("");
    const [name, setName] = useState(client?.name || "");
    const [phone, setPhone] = useState(client?.phone || "");
    const [status, setStatus] = useState<Client["status"]>(client?.status || "active");
    const [notes, setNotes] = useState(client?.notes || "");

    return (
        <Modal title={client ? client.name : t("clients.add")} onClose={onClose} footer={<>
            <button className="btn btn-secondary" onClick={onClose}>{t("common:actions.cancel")}</button>
            <button className="btn btn-primary" onClick={() => onSave({ name, phone, status, notes, ...(client ? {} : ownerId ? { ownerId } : {}) })}>{t("common:actions.save")}</button>
        </>}>
            <div className="form-grid">
                <Field label={t("clients.name")}><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
                <Field label={t("clients.phone")}><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
                <Field label={t("clients.status")}><Select value={status} onChange={(e) => setStatus(e.target.value as Client["status"])} options={enumOptions("lifecycle", ["active", "paused", "closed"])} /></Field>
                {!client && (
                    <Field label={t("clients.owner")} hint={t("clients.ownerHint")}>
                        <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}
                            options={[{ value: "", label: t("clients.me") }, ...agents.map((a) => ({ value: a.id, label: agentLabel(a) }))]} />
                    </Field>
                )}
            </div>
            <Field label={t("clients.notes")}><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </Modal>
    );
}

/* ---------------- Properties ---------------- */
// Covers the core identifying/business fields, not every nuance the regular
// property form has (commission split, portal listing refs, source
// tracking, private notes) -- this is a moderation tool, not a replacement
// for the agent's own edit form.

function PropertiesTab({ agents }: { agents: AdminAgent[] }) {
    const { t } = useTranslation("admin");
    const { api } = useApp();
    const [page, setPage] = useState(1);
    const [items, setItems] = useState<Property[]>([]);
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<Property | "new" | null>(null);
    const [deleting, setDeleting] = useState<Property | null>(null);

    const load = () => {
        setLoading(true);
        listPropertiesPage(page, PAGE_SIZE)
            .then((res) => { setItems(res.items); setCount(res.count); })
            .catch((err) => api.toast(err instanceof Error ? err.message : t("properties.loadFailed"), "warn"))
            .finally(() => setLoading(false));
    };
    useEffect(load, [page]); // eslint-disable-line react-hooks/exhaustive-deps

    const save = async (patch: Record<string, unknown>) => {
        try {
            if (editing === "new") {
                await createProperty(patch);
                api.toast(t("properties.created"));
                setEditing(null);
                load();
                return;
            }
            if (editing) {
                const updated = await updateProperty(editing.id, patch);
                setItems((xs) => xs.map((x) => (x.id === updated.id ? updated : x)));
                api.toast(t("properties.updated"));
            }
            setEditing(null);
        } catch (err) {
            api.toast(err instanceof Error ? err.message : t("properties.saveFailed"), "warn");
        }
    };

    const remove = async () => {
        if (!deleting) return;
        try {
            await deleteProperty(deleting.id, { permanent: true });
            setItems((xs) => xs.filter((x) => x.id !== deleting.id));
            setCount((c) => c - 1);
            api.toast(t("properties.deleted"));
        } catch (err) {
            api.toast(err instanceof Error ? err.message : t("properties.deleteFailed"), "warn");
        } finally {
            setDeleting(null);
        }
    };

    return (
        <>
            <div className="row" style={{ justifyContent: "flex-end", marginBottom: 10 }}>
                <button className="btn btn-primary btn-sm" onClick={() => setEditing("new")}><Plus size={14} /> {t("properties.add")}</button>
            </div>
            {!loading && items.length === 0 ? (
                <EmptyState icon={<Building2 size={20} />} title={t("properties.emptyTitle")} body={t("properties.emptyBody")} />
            ) : (
                <div className="card tbl-wrap">
                    <table className="tbl">
                        <thead><tr>{[t("properties.cols.address"), t("properties.cols.district"), t("properties.cols.type"), t("properties.cols.deal"), t("properties.cols.price"), t("properties.cols.status"), t("properties.cols.owner"), ""].map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                        <tbody>
                            {items.map((p) => (
                                <tr key={p.id}>
                                    <td className="bold">{p.address}{p.deleted ? <Badge tone="brick">{t("deletedBadge")}</Badge> : null}</td>
                                    <td className="muted">{enumLabel("district", p.district)}</td>
                                    <td className="muted">{enumLabel("propertyType", p.type)}</td>
                                    <td className="muted">{enumLabel("dealType", p.dealType)}</td>
                                    <td>{p.price ? usd(Number(p.price)) : "—"}</td>
                                    <td><Badge tone={p.status === "active" ? "teal" : p.status === "archived" ? "gray" : "amber"}>{enumLabel("propertyStatus", String(p.status)).toUpperCase()}</Badge></td>
                                    <td className="faint">{agentLabel(agents.find((a) => a.id === p.ownerId))}</td>
                                    <td>
                                        <div className="row" style={{ gap: 6 }}>
                                            <button className="icon-btn plain" onClick={() => setEditing(p)}><Pencil size={14} /></button>
                                            <button className="icon-btn plain" onClick={() => setDeleting(p)}><Trash2 size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <Pager page={page} setPage={setPage} count={count} pageSize={PAGE_SIZE} />
            {editing && <PropertyEditModal property={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSave={save} />}
            {deleting && (
                <ConfirmDialog title={t("properties.deleteTitle")} danger confirmLabel={tr("common:actions.delete")}
                    body={t("properties.deleteBody", { address: deleting.address })}
                    onConfirm={remove} onClose={() => setDeleting(null)} />
            )}
        </>
    );
}

function PropertyEditModal({
    property, onClose, onSave,
}: { property: Property | null; onClose: () => void; onSave: (patch: Record<string, unknown>) => void }) {
    const { t } = useTranslation(["admin", "common"]);
    const [f, setF] = useState({
        district: property?.district || DISTRICTS[0],
        city: property?.city || "Tbilisi",
        address: property?.address || "",
        type: property?.type || PROPERTY_TYPES[0],
        dealType: property?.dealType || "Sale",
        area: property?.area ?? ("" as number | ""),
        rooms: property?.rooms ?? ("" as number | ""),
        beds: property?.beds ?? ("" as number | ""),
        baths: property?.baths ?? ("" as number | ""),
        floor: property?.floor ?? ("" as number | ""),
        floors: property?.floors ?? ("" as number | ""),
        condition: property?.condition || CONDITIONS[0],
        buildingType: property?.buildingType || BUILDING_TYPES[0],
        price: property?.price ?? ("" as number | ""),
        portalPrice: property?.portalPrice ?? ("" as number | ""),
        status: property?.status || "active",
        parking: !!property?.parking,
        balcony: !!property?.balcony,
        deleted: !!property?.deleted,
    });
    const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setF((s) => ({ ...s, [k]: e.target.value }));
    const setNum = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setF((s) => ({ ...s, [k]: e.target.value === "" ? "" : Number(e.target.value) }));

    const submit = () => onSave({
        ...f,
        area: f.area === "" ? "" : Number(f.area),
        price: f.price === "" ? "" : Number(f.price),
        portalPrice: f.portalPrice === "" ? null : Number(f.portalPrice),
    });

    return (
        <Modal wide title={property ? t("properties.editTitle", { title: [enumLabel("district", property.district), property.address].filter(Boolean).join(" · ") || t("properties.property") }) : t("properties.add")} onClose={onClose} footer={<>
            <button className="btn btn-secondary" onClick={onClose}>{t("common:actions.cancel")}</button>
            <button className="btn btn-primary" onClick={submit}>{t("common:actions.save")}</button>
        </>}>
            <div className="form-grid">
                <Field label={t("properties.fields.district")}><Select value={f.district} onChange={set("district")} options={enumOptions("district", DISTRICTS)} /></Field>
                <Field label={t("properties.fields.city")}><Input value={f.city} onChange={set("city")} /></Field>
                <Field label={t("properties.fields.address")}><Input value={f.address} onChange={set("address")} /></Field>
                <Field label={t("properties.fields.type")}><Select value={f.type} onChange={set("type")} options={enumOptions("propertyType", PROPERTY_TYPES)} /></Field>
                <Field label={t("properties.fields.dealType")}><Select value={f.dealType} onChange={set("dealType")} options={enumOptions("dealType", ["Sale", "Rent", "Daily rent"])} /></Field>
                <Field label={t("properties.fields.status")}>
                    <Select value={f.status} onChange={set("status")}
                        options={enumOptions("propertyStatus", ["active", "needs_verification", "archived"])} />
                </Field>
                <Field label={t("properties.fields.area")}><Input value={f.area} onChange={setNum("area")} /></Field>
                <Field label={t("properties.fields.rooms")}><Input value={f.rooms} onChange={setNum("rooms")} /></Field>
                <Field label={t("properties.fields.beds")}><Input value={f.beds} onChange={setNum("beds")} /></Field>
                <Field label={t("properties.fields.baths")}><Input value={f.baths} onChange={setNum("baths")} /></Field>
                <Field label={t("properties.fields.floor")}><Input value={f.floor} onChange={setNum("floor")} /></Field>
                <Field label={t("properties.fields.floors")}><Input value={f.floors} onChange={setNum("floors")} /></Field>
                <Field label={t("properties.fields.condition")}><Select value={f.condition} onChange={set("condition")} options={enumOptions("condition", CONDITIONS)} /></Field>
                <Field label={t("properties.fields.buildingType")}><Select value={f.buildingType} onChange={set("buildingType")} options={enumOptions("buildingType", BUILDING_TYPES)} /></Field>
                <Field label={t("properties.fields.price")}><Input value={f.price} onChange={setNum("price")} /></Field>
                <Field label={t("properties.fields.portalPrice")}><Input value={f.portalPrice} onChange={setNum("portalPrice")} /></Field>
            </div>
            <Toggle label={t("properties.fields.parking")} on={f.parking} onChange={(v) => setF((s) => ({ ...s, parking: v }))} />
            <Toggle label={t("properties.fields.balcony")} on={f.balcony} onChange={(v) => setF((s) => ({ ...s, balcony: v }))} />
            <Toggle label={t("properties.fields.deleted")} hint={t("properties.fields.deletedHint")} on={f.deleted} onChange={(v) => setF((s) => ({ ...s, deleted: v }))} />
        </Modal>
    );
}
