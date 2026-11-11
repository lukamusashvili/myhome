import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Home, Menu, X, Search, Plus, Upload, User, CheckSquare, Inbox, Bell, MoreHorizontal,
} from "lucide-react";
import { ADMIN_NAV_ITEM, NAV, NAV_BOTTOM, ROUTE_GROUP } from "../data/constants";
import { useApp } from "../store/store";
import { findPropertyMatch, propTitle } from "../lib/domain";
import { initials, usd } from "../lib/format";
import { relDay } from "../lib/dates";
import { Badge, Photo, ActionMenu } from "./ui";

export function SidebarContent({ onClose }: { onClose?: () => void }) {
    const { t } = useTranslation();
    const { route, nav, sel, settings, inquiries, clients, myRole } = useApp();
    const active = ROUTE_GROUP[route.name] || route.name;
    const counts: Record<string, number> = {
        properties: sel.visibleProperties.filter((p) => p.status !== "archived").length,
        clients: clients.filter((c) => c.status === "active").length,
        tasks: sel.todayTasks.filter((t) => !t.done).length,
        inquiries: inquiries.filter((i) => !i.converted).length,
    };
    const navBottom = myRole === "admin" ? [...NAV_BOTTOM, ADMIN_NAV_ITEM] : NAV_BOTTOM;
    return (
        <>
            <div className="sb-brand">
                <div className="sb-mark"><Home size={16} /></div>
                <div>
                    <div className="sb-name">{t("app.name")}</div>
                    <div className="sb-sub">{settings.agency || t("shell.noAgency")}</div>
                </div>
                {onClose && <button className="icon-btn plain" style={{ marginLeft: "auto" }} onClick={onClose}><X size={17} /></button>}
            </div>
            <nav className="sb-nav">
                {NAV.map((i) => (
                    <button key={i.key} className={`sb-link ${active === i.key ? "active" : ""}`} onClick={() => { nav(i.key); onClose?.(); }}>
                        <i.icon size={16} />{t(i.labelKey)}
                        {counts[i.key] ? <span className="cnt">{counts[i.key]}</span> : null}
                    </button>
                ))}
            </nav>
            <div>
                <div className="sb-div" />
                {navBottom.map((i) => (
                    <button key={i.key} className={`sb-link ${active === i.key ? "active" : ""}`} onClick={() => { nav(i.key); onClose?.(); }}>
                        <i.icon size={16} />{t(i.labelKey)}
                    </button>
                ))}
                <button className="sb-profile" style={{ width: "100%", cursor: "pointer", textAlign: "left" }} onClick={() => { nav("settings"); onClose?.(); }}>
                    <div className="avatar">{initials(settings.profile.name || settings.profile.email)}</div>
                    <div className="grow">
                        <div className="fs-12 bold" style={{ color: "var(--navy)" }}>{settings.profile.name || settings.profile.email}</div>
                        <div className="fs-11 faint">{settings.trial === "expired" ? t("shell.trialEnded") : t("shell.trialActive")}</div>
                    </div>
                </button>
            </div>
        </>
    );
}

export function GlobalSearch() {
    const { t } = useTranslation();
    const { properties, clients, tasks, nav } = useApp();
    const [q, setQ] = useState("");
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);
    const term = q.trim().toLowerCase();
    const results = useMemo(() => {
        if (term.length < 1) return null;
        const props: { p: (typeof properties)[number]; reason: string | null }[] = [];
        for (const p of properties) {
            if (p.deleted) continue;
            const hit = findPropertyMatch(p, term);
            if (hit) props.push({ p, reason: hit.reference ? hit.reference.label : null });
            if (props.length >= 5) break;
        }
        const cls = clients.filter((c) => c.name.toLowerCase().includes(term) || c.phone.replace(/\s/g, "").includes(term.replace(/\s/g, ""))).slice(0, 4);
        const tks = tasks.filter((x) => x.title.toLowerCase().includes(term)).slice(0, 3);
        return { props, cls, tks, total: props.length + cls.length + tks.length };
    }, [term, properties, clients, tasks]);

    const go = (fn: () => void) => { fn(); setQ(""); setOpen(false); };

    return (
        <div className="search-box" ref={ref}>
            <Search size={15} />
            <input placeholder={t("shell.searchPlaceholder")} value={q}
                onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} />
            {q && <button className="icon-btn plain" style={{ width: 22, height: 22 }} onClick={() => setQ("")}><X size={13} /></button>}
            {open && results && (
                <div className="dropdown left" style={{ right: 0, minWidth: 0, maxHeight: 380, overflowY: "auto" }}>
                    {results.total === 0 && <div className="fs-13 muted" style={{ padding: "10px 12px" }}>{t("shell.noResults", { query: q })}</div>}
                    {results.props.length > 0 && <div className="eyebrow" style={{ padding: "7px 10px 3px" }}>{t("shell.properties")}</div>}
                    {results.props.map(({ p, reason }) => (
                        <button key={p.id} className="dd-item" style={{ alignItems: "flex-start" }} onClick={() => go(() => nav("property", { id: p.id }))}>
                            <Photo src={p.photos[0]} style={{ width: 28, height: 22, flexShrink: 0, marginTop: 2 }} radius={5} />
                            <span className="grow">
                                <span className="row" style={{ gap: 6 }}>
                                    {propTitle(p)}
                                    {p.status === "archived" && <Badge tone="gray">{t("ui.badge.archived")}</Badge>}
                                </span>
                                <span className="faint fs-12">{usd(Number(p.price))}{reason ? ` · ${reason}` : ""}</span>
                            </span>
                        </button>
                    ))}
                    {results.cls.length > 0 && <div className="eyebrow" style={{ padding: "7px 10px 3px" }}>{t("shell.clients")}</div>}
                    {results.cls.map((c) => (
                        <button key={c.id} className="dd-item" onClick={() => go(() => nav("client", { id: c.id }))}>
                            <div className="avatar sm">{initials(c.name)}</div>
                            <span className="grow">{c.name}<span className="faint"> · {c.phone}</span></span>
                        </button>
                    ))}
                    {results.tks.length > 0 && <div className="eyebrow" style={{ padding: "7px 10px 3px" }}>{t("shell.tasks")}</div>}
                    {results.tks.map((x) => (
                        <button key={x.id} className="dd-item" onClick={() => go(() => nav("tasks"))}>
                            <CheckSquare size={14} /><span className="grow">{x.title}<span className="faint"> · {relDay(x.date)}</span></span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
    const { t } = useTranslation();
    const { nav, openModal, readOnly, sel, settings } = useApp();
    const overdue = sel.overdueTasks.length;
    return (
        <div className="topbar">
            <button className="hamburger" onClick={onMenu}><Menu size={20} /></button>
            <GlobalSearch />
            <div className="grow" />
            <ActionMenu items={[
                { label: t("shell.addProperty"), icon: <Plus size={14} />, onClick: () => openModal("property", {}), disabled: readOnly },
                { label: t("shell.importProperty"), icon: <Upload size={14} />, onClick: () => nav("import"), disabled: readOnly },
                { label: t("shell.addClient"), icon: <User size={14} />, onClick: () => openModal("client", {}), disabled: readOnly },
                { label: t("shell.addTask"), icon: <CheckSquare size={14} />, onClick: () => openModal("task", {}), disabled: readOnly },
                "sep",
                { label: t("shell.logInquiry"), icon: <Inbox size={14} />, onClick: () => openModal("inquiry", {}), disabled: readOnly },
            ]}>
                <button className="btn btn-primary btn-sm"><Plus size={14} /> {t("shell.quickAdd")}</button>
            </ActionMenu>
            <button className="icon-btn desk-only" title={t("shell.overdueTasks", { count: overdue })} onClick={() => nav("tasks", { tab: "Overdue" })} style={{ position: "relative" }}>
                <Bell size={15} />
                {overdue > 0 && <span style={{ position: "absolute", top: 4, right: 4, width: 6, height: 6, borderRadius: 3, background: "var(--brick)" }} />}
            </button>
            <button className="avatar sm" style={{ border: "none" }} title={settings.profile.name || settings.profile.email} onClick={() => nav("settings")}>{initials(settings.profile.name || settings.profile.email) || "?"}</button>
        </div>
    );
}

export function MobileNav({ onMore }: { onMore: () => void }) {
    const { t } = useTranslation();
    const { route, nav } = useApp();
    const active = ROUTE_GROUP[route.name] || route.name;
    const items = [
        { key: "dashboard", label: t("nav.home"), icon: Home },
        { key: "properties", label: t("nav.properties"), icon: NAV[1].icon },
        { key: "clients", label: t("nav.clients"), icon: NAV[2].icon },
        { key: "tasks", label: t("nav.tasks"), icon: NAV[3].icon },
    ];
    return (
        <div className="mobile-nav">
            {items.map((i) => (
                <button key={i.key} className={`mn-item ${active === i.key ? "on" : ""}`} onClick={() => nav(i.key)}>
                    <i.icon size={19} />{i.label}
                </button>
            ))}
            <button className="mn-item" onClick={onMore}><MoreHorizontal size={19} />{t("nav.more")}</button>
        </div>
    );
}

export function MoreSheet({ onClose }: { onClose: () => void }) {
    const { t } = useTranslation();
    const { nav, settings, myRole } = useApp();
    const items = [...NAV.slice(4), ...NAV_BOTTOM, ...(myRole === "admin" ? [ADMIN_NAV_ITEM] : [])];
    return (
        <>
            <div className="drawer-back" onClick={onClose} />
            <div className="sheet">
                <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                    <div className="section-title">{settings.agency}</div>
                    <button className="icon-btn plain" onClick={onClose}><X size={18} /></button>
                </div>
                {items.map((i) => (
                    <button key={i.key} className="sb-link" onClick={() => { nav(i.key); onClose(); }}><i.icon size={17} />{t(i.labelKey)}</button>
                ))}
            </div>
        </>
    );
}

export function BootSkeleton() {
    return (
        <div className="page">
            <div className="skel" style={{ height: 30, maxWidth: 260, marginBottom: 10 }} />
            <div className="skel" style={{ height: 14, maxWidth: 150, marginBottom: 24 }} />
            <div className="grid-4" style={{ marginBottom: 22 }}>
                {[0, 1, 2, 3].map((i) => <div className="skel" key={i} style={{ height: 74 }} />)}
            </div>
            <div className="grid-2">
                <div className="skel" style={{ height: 300 }} />
                <div className="skel" style={{ height: 220 }} />
            </div>
        </div>
    );
}
