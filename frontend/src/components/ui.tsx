import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
    Camera, X, Check, AlertTriangle, CheckCircle2, ArrowLeft, MoreHorizontal, Star, MapPin, ChevronRight,
    CheckSquare, Share2, Archive, ShieldCheck, User, Building2, Pencil, Trash2,
} from "lucide-react";
import type { Property, Task } from "../types";
import { propTitle, calcPricing } from "../lib/domain";
import { usd } from "../lib/format";
import { fmtDate, relDay, daysAgo, nearDay } from "../lib/dates";
import { useApp } from "../store/store";
import { LANGUAGES, setLanguage, currentLanguage } from "../i18n";
import { enumLabel } from "../i18n/labels";

/* Images are remote, so every one of them falls back instead of breaking a demo. */
export function Photo({
    src, alt = "", className = "", style, radius, cover = true,
}: { src?: string | null; alt?: string; className?: string; style?: React.CSSProperties; radius?: number; cover?: boolean }) {
    const { t } = useTranslation();
    const [failed, setFailed] = useState(false);
    useEffect(() => setFailed(false), [src]);
    const base = { borderRadius: radius, ...style };
    if (!src || failed) {
        return (
            <div className={`photo-fallback ${className}`} style={base} aria-label={t("ui.noPhoto")}>
                <Camera size={16} />
            </div>
        );
    }
    return (
        <img src={src} alt={alt} className={className} style={{ ...base, objectFit: cover ? "cover" : "contain" }}
            onError={() => setFailed(true)} loading="lazy" />
    );
}

export const Badge = ({ children, tone = "gray", icon }: { children: ReactNode; tone?: string; icon?: ReactNode }) => (
    <span className={`badge badge-${tone}`}>{icon}{children}</span>
);

export function StatusBadge({ status }: { status: string }) {
    const { t } = useTranslation();
    if (status === "active") return <Badge tone="teal">{t("ui.badge.active")}</Badge>;
    if (status === "needs_verification") return <Badge tone="amber">{t("ui.badge.needsVerification")}</Badge>;
    if (status === "archived") return <Badge tone="gray">{t("ui.badge.archived")}</Badge>;
    return <Badge tone="gray">{status}</Badge>;
}

export function SourceBadge({ p }: { p: Property }) {
    const { t } = useTranslation();
    if (!p.mine) return <Badge tone="teal" icon={<Share2 size={11} />}>{t("ui.badge.shared", { name: p.sharedBy })}</Badge>;
    if (p.sharedWithAgency) return <Badge tone="navy" icon={<Share2 size={11} />}>{t("ui.badge.myPropertyShared")}</Badge>;
    return <Badge tone="navy">{t("ui.badge.myProperty")}</Badge>;
}

export const FeedbackChip = ({ value }: { value: string }) => {
    const tone = value === "Interested" || value === "Wants Showing" ? "teal"
        : value === "Too Expensive" || value === "Not Interested" ? "brick"
        : value === "Viewed" ? "navy" : "gray";
    return <Badge tone={tone}>{enumLabel("feedback", value)}</Badge>;
};

export function Modal({
    title, subtitle, children, onClose, footer, wide,
}: { title: ReactNode; subtitle?: ReactNode; children: ReactNode; onClose: () => void; footer?: ReactNode; wide?: boolean }) {
    useEffect(() => {
        const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    }, [onClose]);
    return (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className={`modal ${wide ? "wide" : ""}`}>
                <div className="modal-head">
                    <div>
                        <h2 style={{ fontSize: 17, fontWeight: 600 }}>{title}</h2>
                        {subtitle && <div className="fs-12 muted" style={{ marginTop: 4, lineHeight: 1.5 }}>{subtitle}</div>}
                    </div>
                    <button className="icon-btn plain" onClick={onClose}><X size={17} /></button>
                </div>
                <div className="modal-body">{children}</div>
                {footer && <div className="modal-foot">{footer}</div>}
            </div>
        </div>
    );
}

export function ConfirmDialog({
    title, body, confirmLabel, danger, onConfirm, onClose,
}: { title: ReactNode; body: ReactNode; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onClose: () => void }) {
    const { t } = useTranslation();
    return (
        <Modal title={title} onClose={onClose} footer={
            <>
                <button className="btn btn-secondary" onClick={onClose}>{t("actions.cancel")}</button>
                <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel ?? t("actions.confirm")}</button>
            </>
        }>
            <div className="fs-13 muted" style={{ lineHeight: 1.55 }}>{body}</div>
        </Modal>
    );
}

export const Field = ({ label, children, hint, error }: { label?: ReactNode; children: ReactNode; hint?: ReactNode; error?: ReactNode }) => (
    <div className="field">
        {label && <label>{label}</label>}
        {children}
        {error ? <div className="field-err">{error}</div> : hint ? <div className="form-note">{hint}</div> : null}
    </div>
);

export const Input = ({ error, className, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) => (
    <input {...rest} className={`input ${error ? "err" : ""} ${className || ""}`} />
);
export const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} className="textarea" />;

export type SelectOption = string | { value: string; label: string };
export const Select = ({ options, error, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: SelectOption[]; error?: boolean }) => (
    <select {...rest} className={`select ${error ? "err" : ""}`}>
        {options.map((o) => (typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
    </select>
);

export const Toggle = ({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) => (
    <div className="row" style={{ justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
        <div>
            <div className="fs-13 bold">{label}</div>
            {hint && <div className="fs-11 faint" style={{ marginTop: 2 }}>{hint}</div>}
        </div>
        <button className={`switch ${on ? "on" : ""}`} onClick={() => onChange(!on)} aria-pressed={on}><span /></button>
    </div>
);

export const Checkbox = ({
    checked, onChange, style, disabled,
}: { checked: boolean; onChange: () => void; style?: React.CSSProperties; disabled?: boolean }) => (
    <button className={`chk ${checked ? "checked" : ""}`} style={style} onClick={onChange} disabled={disabled} aria-checked={checked} role="checkbox">
        {checked && <Check size={13} />}
    </button>
);

export const EmptyState = ({
    icon, title, body, action,
}: { icon: ReactNode; title: ReactNode; body: ReactNode; action?: ReactNode }) => (
    <div className="card empty">
        <div className="empty-mark">{icon}</div>
        <div className="section-title" style={{ marginBottom: 5 }}>{title}</div>
        <div className="fs-13 muted" style={{ maxWidth: 340, margin: "0 auto 14px auto", lineHeight: 1.55 }}>{body}</div>
        {action}
    </div>
);

export interface ActionMenuItem {
    label: ReactNode;
    icon?: ReactNode;
    onClick: () => void;
    danger?: boolean;
    disabled?: boolean;
}
export function ActionMenu({
    items, children, align = "right",
}: { items: (ActionMenuItem | "sep" | false | null | undefined)[]; children: ReactNode; align?: "left" | "right" }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);
    return (
        <div style={{ position: "relative" }} ref={ref}>
            <div onClick={() => setOpen((o) => !o)}>{children}</div>
            {open && (
                <div className={`dropdown ${align === "left" ? "left" : ""}`}>
                    {items.filter(Boolean).map((it, i) =>
                        it === "sep" ? (
                            <div className="dd-sep" key={i} />
                        ) : (
                            <button key={i} className={`dd-item ${(it as ActionMenuItem).danger ? "danger" : ""}`} disabled={(it as ActionMenuItem).disabled}
                                onClick={() => { setOpen(false); (it as ActionMenuItem).onClick(); }}>
                                {(it as ActionMenuItem).icon}{(it as ActionMenuItem).label}
                            </button>
                        ),
                    )}
                </div>
            )}
        </div>
    );
}

export function Toasts({ toasts }: { toasts: { id: string; text: string; tone?: string }[] }) {
    return (
        <div className="toast-wrap">
            {toasts.map((t) => (
                <div className={`toast ${t.tone === "warn" ? "warn" : ""}`} key={t.id}>
                    {t.tone === "warn" ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}{t.text}
                </div>
            ))}
        </div>
    );
}

export function PageHeader({
    title, subtitle, back, actions,
}: { title: ReactNode; subtitle?: ReactNode; back?: { label: string; onClick: () => void }; actions?: ReactNode }) {
    return (
        <div style={{ marginBottom: 18 }}>
            {back && (
                <button className="btn btn-ghost btn-sm" style={{ paddingLeft: 0, marginBottom: 8 }} onClick={back.onClick}>
                    <ArrowLeft size={14} /> {back.label}
                </button>
            )}
            <div className="page-head" style={{ marginBottom: 0 }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 600 }}>{title}</h1>
                    {subtitle && <div className="muted fs-13" style={{ marginTop: 4 }}>{subtitle}</div>}
                </div>
                {actions && <div className="row wrap" style={{ gap: 8 }}>{actions}</div>}
            </div>
        </div>
    );
}

export const Stat = ({ label, value, tone }: { label: ReactNode; value: ReactNode; tone?: "brick" }) => (
    <div className="card card-pad">
        <div className="faint fs-12">{label}</div>
        <div className="ew-serif" style={{ fontSize: 25, fontWeight: 600, marginTop: 3, color: tone === "brick" ? "var(--brick)" : "var(--navy)" }}>{value}</div>
    </div>
);

/* --- property card (shared between screens) --- */
export function PropertyCard({
    p, onOpen, onFavorite, onTask, onShare, onArchive, readOnly,
}: {
    p: Property; onOpen: () => void; onFavorite: () => void; onTask: () => void; onShare: () => void; onArchive: () => void; readOnly: boolean;
}) {
    const { t } = useTranslation();
    const age = daysAgo(p.verifiedAt);
    const stale = p.status === "needs_verification" || age > 21;
    return (
        <div className={`prop-card ${!p.mine ? "shared" : ""}`}>
            <div className="prop-photo" onClick={onOpen}>
                <Photo src={p.photos[0]} alt={propTitle(p)} style={{ width: "100%", height: "100%" }} />
                <div className="prop-badges"><StatusBadge status={p.status} /><SourceBadge p={p} /></div>
                {p.mine && (
                    <button className="prop-fav" onClick={(e) => { e.stopPropagation(); onFavorite(); }} title={t("ui.card.favorite")}>
                        <Star size={14} fill={p.favorite ? "#AD7A31" : "none"} color={p.favorite ? "#AD7A31" : "#8A8F86"} />
                    </button>
                )}
            </div>
            <div className="prop-body">
                <div className="row fs-12 muted" style={{ gap: 4 }}><MapPin size={12} /> {propTitle(p)}</div>
                <div className="prop-price" style={{ marginTop: 3 }}>{usd(Number(p.price))}</div>
                <div className="fs-12 faint" style={{ marginTop: 4 }}>
                    {t("ui.card.facts", { area: p.area, count: Number(p.beds) || 0, floor: p.floor, floors: p.floors })}{p.parking ? t("ui.card.parking") : ""}
                </div>
                <div className="row fs-11" style={{ marginTop: 6, gap: 5, color: stale ? "var(--amber)" : "var(--text-faint)" }}>
                    {stale ? <AlertTriangle size={11} /> : <ShieldCheck size={11} />}
                    {stale ? t("ui.card.needsCheck", { date: fmtDate(p.verifiedAt) }) : t("ui.card.verified", { date: fmtDate(p.verifiedAt) })}
                </div>
                <div className="prop-foot">
                    <button className="link-quiet" onClick={onOpen}>{t("ui.card.open")} <ChevronRight size={12} /></button>
                    <div className="row" style={{ gap: 4 }}>
                        <button className="icon-btn" title={t("ui.card.addTask")} disabled={readOnly} onClick={onTask}><CheckSquare size={14} /></button>
                        {p.mine && <button className="icon-btn" title={p.sharedWithAgency ? t("ui.card.stopSharing") : t("ui.card.shareWithAgency")} disabled={readOnly} onClick={onShare}><Share2 size={14} /></button>}
                        {p.mine && <button className="icon-btn" title={t("ui.card.archive")} disabled={readOnly} onClick={onArchive}><Archive size={14} /></button>}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* --- task row --- */
export function TaskRow({
    t, onToggle, onOpenClient, onOpenProperty, onEdit, onDelete, readOnly, showDate,
}: {
    t: Task; onToggle: () => void; onOpenClient: () => void; onOpenProperty: () => void; onEdit: () => void; onDelete: () => void;
    readOnly: boolean; showDate?: boolean;
}) {
    const { t: tr } = useTranslation();
    const { sel } = useApp();
    const client = t.clientId ? sel.client(t.clientId) : null;
    const prop = t.propertyId ? sel.property(t.propertyId) : null;
    const rel = [client && client.name, prop && propTitle(prop)].filter(Boolean).join(" · ");
    return (
        <div className="task-row">
            <Checkbox checked={t.done} onChange={onToggle} style={{ marginTop: 1 }} disabled={readOnly} />
            <div className="task-time">{showDate ? (!t.date ? "—" : nearDay(t.date) !== null ? relDay(t.date) : fmtDate(t.date)) : t.time}</div>
            <div className="grow">
                <div className="fs-13 bold" style={{ textDecoration: t.done ? "line-through" : "none", opacity: t.done ? 0.5 : 1 }}>{t.title}</div>
                <div className="fs-12 muted" style={{ marginTop: 2, opacity: t.done ? 0.5 : 1 }}>
                    {rel || enumLabel("taskType", t.type)}{showDate ? ` · ${relDay(t.date)} ${t.time}` : ""}
                </div>
                {t.notes && <div className="fs-12 faint" style={{ marginTop: 4, lineHeight: 1.45 }}>{t.notes}</div>}
            </div>
            <ActionMenu items={[
                client && { label: tr("ui.task.openClient", { name: client.name }), icon: <User size={14} />, onClick: onOpenClient },
                prop && { label: tr("ui.task.openProperty"), icon: <Building2 size={14} />, onClick: onOpenProperty },
                { label: t.done ? tr("ui.task.markNotDone") : tr("ui.task.markComplete"), icon: <Check size={14} />, onClick: onToggle, disabled: readOnly },
                { label: tr("ui.task.edit"), icon: <Pencil size={14} />, onClick: onEdit, disabled: readOnly },
                "sep",
                { label: tr("ui.task.delete"), icon: <Trash2 size={14} />, onClick: onDelete, danger: true, disabled: readOnly },
            ]}>
                <button className="icon-btn plain"><MoreHorizontal size={16} /></button>
            </ActionMenu>
        </div>
    );
}

/* --- private commission calculator card --- */
export function PriceCalculator({ model, pct, portal, price }: { model: string; pct: unknown; portal: unknown; price: unknown }) {
    const { t } = useTranslation();
    const c = calcPricing({ commissionModel: model, commissionPct: pct, portalPrice: portal, price });
    const offRecommendation = c.recommendedPrice > 0 && c.listingPrice > 0 && c.listingPrice !== c.recommendedPrice;
    return (
        <div className="card card-pad" style={{ background: "var(--navy-tint)" }}>
            <div className="section-title" style={{ marginBottom: 10 }}>{t("ui.calc.title")}</div>
            <div className="kv" style={{ borderColor: "rgba(20,30,45,.09)" }}>
                <span className="kv-l">{t("ui.calc.portalPrice")}</span><span className="kv-v">{usd(c.portalPrice)}</span>
            </div>
            <div className="kv" style={{ borderColor: "rgba(20,30,45,.09)" }}>
                <span className="kv-l">{t("ui.calc.ownerReceives")}</span><span className="kv-v">{usd(c.ownerReceives)}</span>
            </div>
            <div className="kv" style={{ borderColor: "rgba(20,30,45,.09)" }}>
                <span className="kv-l">{t("ui.calc.yourCommission")}</span><span className="kv-v">{c.commissionPct}% · {usd(c.commissionAmount)}</span>
            </div>
            <div className="row" style={{ justifyContent: "space-between", paddingTop: 11 }}>
                <span className="fs-13 bold">{t("ui.calc.myListingPrice")}</span>
                <span className="ew-serif" style={{ fontSize: 21, fontWeight: 600 }}>{usd(c.listingPrice)}</span>
            </div>
            {offRecommendation && (
                <div className="fs-11" style={{ marginTop: 7, color: "var(--amber)" }}>
                    {t("ui.calc.suggests", { price: usd(c.recommendedPrice) })}
                </div>
            )}
            <div className="fs-11 faint" style={{ marginTop: 8, lineHeight: 1.5 }}>{c.explain}</div>
        </div>
    );
}

export function ScoreRing({ score }: { score: number }) {
    const color = score >= 97 ? "var(--teal)" : score >= 90 ? "var(--navy-2)" : score >= 75 ? "var(--amber)" : "var(--text-faint)";
    return <div className="score-ring" style={{ borderColor: color, color }}>{score}%</div>;
}

export const Fact = ({ icon, label, value }: { icon: ReactNode; label: ReactNode; value: ReactNode }) => (
    <div className="row" style={{ gap: 9 }}>
        <div style={{ width: 31, height: 31, borderRadius: 8, background: "var(--surface-alt)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--navy-2)", flexShrink: 0 }}>{icon}</div>
        <div><div className="fs-11 faint">{label}</div><div className="fs-13 bold">{value}</div></div>
    </div>
);

/* English / ქართული toggle. The choice is remembered on this browser. */
export function LanguageSwitcher() {
    const { i18n } = useTranslation();
    const active = i18n.resolvedLanguage ?? currentLanguage();
    return (
        <div className="segmented" style={{ width: "fit-content" }}>
            {LANGUAGES.map((l) => (
                <button key={l.code} lang={l.code} className={active === l.code ? "on" : ""} onClick={() => setLanguage(l.code)}>{l.label}</button>
            ))}
        </div>
    );
}
