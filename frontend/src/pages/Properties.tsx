import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Plus, Upload, SlidersHorizontal, LayoutGrid, List as ListIcon, Car, Building2, Star, MoreHorizontal, ExternalLink,
    CheckSquare, Share2, Archive, RotateCcw,
} from "lucide-react";
import { useApp } from "../store/store";
import { DISTRICTS, PROPERTY_TYPES } from "../data/constants";
import { propTitle } from "../lib/domain";
import { fmtDate } from "../lib/dates";
import { usd } from "../lib/format";
import { enumOptions } from "../i18n/labels";
import {
    ActionMenu, EmptyState, Field, Input, PageHeader, Photo, PropertyCard, Select, SourceBadge, StatusBadge,
} from "../components/ui";

/* Tab and source ids are also passed in via route params, so they stay the
   English ids; only their labels are translated. */
const TABS = ["All", "Active", "Needs Verification", "Archived", "Favorites"] as const;
const SOURCES = ["All Properties", "My Properties", "Shared Properties"] as const;
const EMPTY_FILTERS = { district: "", priceMin: "", priceMax: "", areaMin: "", rooms: "", beds: "", type: "", parking: false };

export default function Properties() {
    const { t } = useTranslation("properties");
    const { properties, api, nav, openModal, readOnly, route } = useApp();
    const [tab, setTab] = useState((route.params?.tab as string) || "All");
    const [source, setSource] = useState((route.params?.source as string) || "All Properties");
    const [view, setView] = useState<"grid" | "table">("grid");
    const [showFilters, setShowFilters] = useState(false);
    const [f, setF] = useState(EMPTY_FILTERS);
    const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
    const activeFilters = Object.entries(f).filter(([, v]) => v !== "" && v !== false).length;

    const list = useMemo(
        () => properties.filter((p) => {
            if (p.deleted) return false;
            if (tab === "All" && p.status === "archived") return false;
            if (tab === "Active" && p.status !== "active") return false;
            if (tab === "Needs Verification" && p.status !== "needs_verification") return false;
            if (tab === "Archived" && p.status !== "archived") return false;
            if (tab === "Favorites" && !p.favorite) return false;
            if (source === "My Properties" && !p.mine) return false;
            if (source === "Shared Properties" && p.mine) return false;
            if (f.district && p.district !== f.district) return false;
            if (f.priceMin && Number(p.price) < Number(f.priceMin)) return false;
            if (f.priceMax && Number(p.price) > Number(f.priceMax)) return false;
            if (f.areaMin && Number(p.area) < Number(f.areaMin)) return false;
            if (f.rooms && Number(p.rooms) < Number(f.rooms)) return false;
            if (f.beds && Number(p.beds) < Number(f.beds)) return false;
            if (f.type && p.type !== f.type) return false;
            if (f.parking && !p.parking) return false;
            return true;
        }),
        [properties, tab, source, f],
    );

    const cardProps = (p: (typeof properties)[number]) => ({
        p, onOpen: () => nav("property", { id: p.id }),
        onFavorite: () => api.toggleFavorite(p.id),
        onTask: () => openModal("task", { initial: { propertyId: p.id, title: t("common.callOwnerTitle"), type: "Call" } }),
        onShare: () => (p.sharedWithAgency ? api.shareProperty(p.id, false) : openModal("share-property", { property: p })),
        onArchive: () => openModal("archive", { property: p }),
        readOnly,
    });

    return (
        <div className="page">
            <PageHeader title={t("list.title")} subtitle={t("list.subtitle", { count: list.length })}
                actions={<>
                    <button className="btn btn-primary" disabled={readOnly} onClick={() => openModal("property", {})}><Plus size={15} /> {t("list.addProperty")}</button>
                    <button className="btn btn-secondary" disabled={readOnly} onClick={() => nav("import")}><Upload size={15} /> {t("list.importProperty")}</button>
                </>} />

            <div className="tabs" style={{ marginBottom: 14 }}>
                {TABS.map((id) => (
                    <button key={id} className={`tab ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>{t(`list.tabs.${id}`)}</button>
                ))}
            </div>

            <div className="row wrap" style={{ justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
                <div className="segmented">
                    {SOURCES.map((s) => (
                        <button key={s} className={source === s ? "on" : ""} onClick={() => setSource(s)}>{t(`list.sources.${s}`)}</button>
                    ))}
                </div>
                <div className="row" style={{ gap: 8 }}>
                    <button className={`btn btn-sm ${showFilters || activeFilters ? "btn-primary" : "btn-secondary"}`} onClick={() => setShowFilters((v) => !v)}>
                        <SlidersHorizontal size={13} /> {t("list.filters")}{activeFilters ? ` · ${activeFilters}` : ""}
                    </button>
                    <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 9, overflow: "hidden" }}>
                        {([["grid", LayoutGrid], ["table", ListIcon]] as const).map(([v, Icon]) => (
                            <button key={v} onClick={() => setView(v)} style={{ border: "none", padding: "7px 9px", background: view === v ? "var(--navy)" : "var(--surface)", color: view === v ? "#fff" : "var(--text-soft)" }}>
                                <Icon size={14} />
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {showFilters && (
                <div className="card card-pad" style={{ marginBottom: 16 }}>
                    <div className="form-grid" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
                        <Field label={t("list.filter.location")}><Select value={f.district} onChange={set("district")} options={[{ value: "", label: t("list.filter.anyDistrict") }, ...enumOptions("district", DISTRICTS)]} /></Field>
                        <Field label={t("list.filter.priceFrom")}><Input value={f.priceMin} onChange={set("priceMin")} placeholder="80000" /></Field>
                        <Field label={t("list.filter.priceTo")}><Input value={f.priceMax} onChange={set("priceMax")} placeholder="200000" /></Field>
                        <Field label={t("list.filter.areaFrom")}><Input value={f.areaMin} onChange={set("areaMin")} placeholder="60" /></Field>
                        <Field label={t("list.filter.roomsMin")}><Input value={f.rooms} onChange={set("rooms")} placeholder="3" /></Field>
                        <Field label={t("list.filter.bedsMin")}><Input value={f.beds} onChange={set("beds")} placeholder="2" /></Field>
                        <Field label={t("list.filter.propertyType")}><Select value={f.type} onChange={set("type")} options={[{ value: "", label: t("list.filter.anyType") }, ...enumOptions("propertyType", PROPERTY_TYPES)]} /></Field>
                        <Field label={t("list.filter.parking")}>
                            <button className={`chip ${f.parking ? "on" : ""}`} style={{ height: 38, borderRadius: 9, width: "100%" }} onClick={() => setF((s) => ({ ...s, parking: !s.parking }))}>
                                <Car size={13} /> {t("list.filter.parkingOnly")}
                            </button>
                        </Field>
                    </div>
                    <div className="row" style={{ justifyContent: "flex-end" }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setF(EMPTY_FILTERS)}>{t("list.filter.clear")}</button>
                    </div>
                </div>
            )}

            {list.length === 0 ? (
                <EmptyState icon={<Building2 size={20} />} title={t("list.empty.title")}
                    body={activeFilters ? t("list.empty.filtered") : t("list.empty.none")}
                    action={activeFilters
                        ? <button className="btn btn-secondary" onClick={() => { setF(EMPTY_FILTERS); setTab("All"); }}>{t("list.filter.clear")}</button>
                        : <button className="btn btn-primary" onClick={() => nav("import")}><Upload size={14} /> {t("list.empty.import")}</button>} />
            ) : view === "grid" ? (
                <div className="prop-grid">{list.map((p) => <PropertyCard key={p.id} {...cardProps(p)} />)}</div>
            ) : (
                <div className="card tbl-wrap">
                    <table className="tbl">
                        <thead><tr>{(["id", "property", "price", "area", "beds", "floor", "status", "source", "verified"] as const).map((h) => <th key={h}>{t(`list.table.${h}`)}</th>)}<th /></tr></thead>
                        <tbody>
                            {list.map((p) => (
                                <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => nav("property", { id: p.id })}>
                                    <td className="bold">#{p.id}</td>
                                    <td>
                                        <div className="row" style={{ gap: 9 }}>
                                            <Photo src={p.photos[0]} style={{ width: 34, height: 26, flexShrink: 0 }} radius={5} />
                                            <span>{propTitle(p)}</span>
                                            {p.favorite && <Star size={12} fill="#AD7A31" color="#AD7A31" />}
                                        </div>
                                    </td>
                                    <td className="bold">{usd(Number(p.price))}</td>
                                    <td>{t("common.area", { value: p.area })}</td>
                                    <td>{p.beds}</td>
                                    <td>{p.floor}/{p.floors}</td>
                                    <td><StatusBadge status={p.status} /></td>
                                    <td><SourceBadge p={p} /></td>
                                    <td className="faint">{fmtDate(p.verifiedAt)}</td>
                                    <td onClick={(e) => e.stopPropagation()}>
                                        <ActionMenu items={[
                                            { label: t("common.open"), icon: <ExternalLink size={14} />, onClick: () => nav("property", { id: p.id }) },
                                            { label: p.favorite ? t("common.removeFavorite") : t("common.addFavorite"), icon: <Star size={14} />, onClick: () => api.toggleFavorite(p.id), disabled: readOnly },
                                            { label: t("common.addTaskLower"), icon: <CheckSquare size={14} />, onClick: () => openModal("task", { initial: { propertyId: p.id } }), disabled: readOnly },
                                            p.mine && { label: p.sharedWithAgency ? t("common.stopSharing") : t("common.shareWithAgency"), icon: <Share2 size={14} />, disabled: readOnly, onClick: () => (p.sharedWithAgency ? api.shareProperty(p.id, false) : openModal("share-property", { property: p })) },
                                            p.mine && (p.status === "archived"
                                                ? { label: t("common.reactivate"), icon: <RotateCcw size={14} />, onClick: () => api.reactivateProperty(p.id), disabled: readOnly }
                                                : { label: t("common.archive"), icon: <Archive size={14} />, onClick: () => openModal("archive", { property: p }), disabled: readOnly }),
                                        ]}>
                                            <button className="icon-btn plain"><MoreHorizontal size={16} /></button>
                                        </ActionMenu>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
