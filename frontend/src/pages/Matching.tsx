import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Info, SlidersHorizontal, MapPin, Check, AlertTriangle, MessageCircle } from "lucide-react";
import { useApp } from "../store/store";
import { runMatching } from "../lib/domain";
import { areaRange, usd, usdRange } from "../lib/format";
import { fmtDate } from "../lib/dates";
import { propTitle } from "../lib/domain";
import { enumLabel } from "../i18n/labels";
import { Checkbox, EmptyState, PageHeader, Photo, ScoreRing, SourceBadge, Badge } from "../components/ui";

export default function Matching({ reqId }: { reqId: string }) {
    const { t } = useTranslation("clients");
    const { sel, nav, properties, openModal, readOnly } = useApp();
    const req = sel.requirement(reqId);
    const client = req ? sel.client(req.clientId) : null;
    const results = useMemo(() => (req ? runMatching(req, properties.filter((p) => !p.deleted)) : []), [req, properties]);
    const [selected, setSelected] = useState<string[]>([]);
    const [onlyMine, setOnlyMine] = useState(false);
    // Preselect the top four once per requirement, not on every re-score.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { setSelected(results.slice(0, 4).map((r) => r.property.id)); }, [reqId]);

    if (!req || !client) return <div className="page"><EmptyState icon={<AlertTriangle size={20} />} title={t("matching.notFoundTitle")} body={t("matching.notFoundBody")} /></div>;
    const shown = onlyMine ? results.filter((r) => r.property.mine) : results;
    const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    const summary = [req.districts.map((d) => enumLabel("district", d)).join(", "), req.beds ? t("matching.bedsShort", { count: Number(req.beds) }) : null, usdRange(req.budgetMin, req.budgetMax),
        areaRange(req.areaMin, req.areaMax), req.parking ? t("matching.parkingRequired") : null].filter(Boolean).join(" · ");

    return (
        <div className="page page-with-bar">
            <PageHeader back={{ label: t("matching.backTo", { name: client.name }), onClick: () => nav("client", { id: client.id }) }}
                title={t("matching.title", { name: client.name })}
                subtitle={t("matching.subtitle", { count: results.length })} />

            <div className="card card-pad row wrap" style={{ background: "var(--navy-tint)", gap: 10, marginBottom: 16, justifyContent: "space-between" }}>
                <div className="row" style={{ gap: 10 }}>
                    <Info size={16} color="var(--navy-2)" />
                    <div>
                        <div className="fs-13 bold">{req.name} · {summary}</div>
                        <div className="fs-11" style={{ color: "var(--navy-2)", marginTop: 3 }}>
                            {t("matching.explainer")}
                        </div>
                    </div>
                </div>
                <button className="btn btn-secondary btn-sm" disabled={readOnly} onClick={() => openModal("requirement", { initial: req, clientId: client.id })}>
                    <SlidersHorizontal size={12} /> {t("matching.adjustCriteria")}</button>
            </div>

            <div className="row wrap" style={{ justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
                <div className="segmented">
                    <button className={!onlyMine ? "on" : ""} onClick={() => setOnlyMine(false)}>{t("matching.allSources")}</button>
                    <button className={onlyMine ? "on" : ""} onClick={() => setOnlyMine(true)}>{t("matching.myOnly")}</button>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setSelected(shown.map((r) => r.property.id))}>{t("matching.selectAll")}</button>
            </div>

            {shown.length === 0 ? (
                <EmptyState icon={<AlertTriangle size={20} />} title={t("matching.emptyTitle")}
                    body={t("matching.emptyBody")}
                    action={<button className="btn btn-primary" disabled={readOnly} onClick={() => openModal("requirement", { initial: req, clientId: client.id })}>{t("matching.adjustRequirement")}</button>} />
            ) : (
                <div className="stack" style={{ gap: 13 }}>
                    {shown.map(({ property: p, score, matched, diffs }) => {
                        const checked = selected.includes(p.id);
                        const already = sel.lastSent(client.id, p.id);
                        return (
                            <div className="match-row" key={p.id} style={{ borderColor: checked ? "var(--navy-2)" : "var(--border)" }}>
                                <Checkbox checked={checked} onChange={() => toggle(p.id)} style={{ marginTop: 4 }} disabled={readOnly} />
                                <ScoreRing score={score} />
                                <div className="match-photo" onClick={() => nav("property", { id: p.id })}>
                                    <Photo src={p.photos[0]} alt={propTitle(p)} style={{ width: "100%", height: "100%" }} />
                                </div>
                                <div className="grow" style={{ minWidth: 190 }}>
                                    <div className="row wrap" style={{ gap: 7, marginBottom: 6 }}>
                                        <SourceBadge p={p} />
                                        {already && <Badge tone="amber">{t("matching.sentBadge", { date: fmtDate(already.date) })}</Badge>}
                                    </div>
                                    <div className="row fs-12 muted" style={{ gap: 4 }}><MapPin size={12} /> {propTitle(p)}</div>
                                    <div className="ew-serif" style={{ fontSize: 19, fontWeight: 600, margin: "3px 0" }}>{usd(Number(p.price))}</div>
                                    <div className="fs-12 faint">{t("facts", { area: p.area, count: Number(p.beds) || 0, floor: p.floor, floors: p.floors })}{p.parking ? t("factsParking") : ""}</div>
                                </div>
                                <div className="match-why" style={{ width: 232, flexShrink: 0 }}>
                                    <div className="eyebrow" style={{ marginBottom: 6 }}>{t("matching.whyScore", { score })}</div>
                                    {matched.map((m, i) => (
                                        <div className="row fs-12" key={i} style={{ gap: 6, marginBottom: 4, color: "var(--teal)" }}><Check size={12} /> {m}</div>
                                    ))}
                                    {diffs.map((d, i) => (
                                        <div className="row fs-12" key={i} style={{ gap: 6, marginTop: 5, color: "var(--amber)", alignItems: "flex-start" }}>
                                            <AlertTriangle size={12} style={{ marginTop: 1, flexShrink: 0 }} /> {d}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="sticky-bar">
                <div className="fs-13 bold">{t("matching.selected", { count: selected.length })}</div>
                <div className="row" style={{ gap: 9 }}>
                    <button className="btn btn-secondary" disabled={!selected.length} onClick={() => setSelected([])}>{t("matching.clearSelection")}</button>
                    <button className="btn btn-primary" disabled={!selected.length || readOnly} onClick={() => nav("offer", { clientId: client.id, ids: selected, reqId })}>
                        <MessageCircle size={14} /> {t("matching.prepareOffer")}</button>
                </div>
            </div>
        </div>
    );
}
