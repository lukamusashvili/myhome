import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Building, ChevronRight, Lock, MapPin, Search, Share2, Users } from "lucide-react";
import { useApp } from "../store/store";
import { propTitle } from "../lib/domain";
import { areaRange, usd, usdRange, initials } from "../lib/format";
import { enumLabel } from "../i18n/labels";
import { EmptyState, PageHeader, Photo } from "../components/ui";

export default function Shared() {
    const { properties, requirements, colleagueRequirements, settings, nav, openModal, api, readOnly, clients } = useApp();
    const { t } = useTranslation("workspace");
    const { t: tc } = useTranslation();
    const [tab, setTab] = useState<"properties" | "requirements">("properties");
    const districtList = (ds: string[]) => ds.map((d) => enumLabel("district", d)).join(", ");
    const fromColleagues = properties.filter((p) => !p.deleted && !p.mine);
    const mineShared = properties.filter((p) => !p.deleted && p.mine && p.sharedWithAgency);
    const myShared = requirements.filter((r) => r.shared);

    return (
        <div className="page">
            <PageHeader title={t("shared.title")} subtitle={t("shared.subtitle", { agency: settings.agency || t("shared.noAgency") })}
                actions={<button className="btn btn-secondary" onClick={() => nav("settings")}><Building size={14} /> {t("shared.agencySettings")}</button>} />

            <div className="tabs" style={{ marginBottom: 16 }}>
                {(["properties", "requirements"] as const).map((key) => (
                    <button key={key} className={`tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>{t(`shared.tabs.${key}`)}</button>
                ))}
            </div>

            {tab === "properties" && (
                <>
                    <div className="section-head"><div className="section-title">{t("shared.fromColleagues")}</div><span className="faint fs-12">{t("shared.propertyCount", { count: fromColleagues.length })}</span></div>
                    {fromColleagues.length === 0 ? (
                        <EmptyState icon={<Share2 size={20} />} title={t("shared.noColleagueProps")}
                            body={t("shared.noColleaguePropsBody")} />
                    ) : (
                        <div className="prop-grid" style={{ marginBottom: 26 }}>
                            {fromColleagues.map((p) => (
                                <div className="prop-card shared" key={p.id}>
                                    <div className="prop-photo" onClick={() => nav("property", { id: p.id })}>
                                        <Photo src={p.photos[0]} alt={propTitle(p)} style={{ width: "100%", height: "100%" }} />
                                    </div>
                                    <div className="prop-body">
                                        <div className="row fs-12 muted" style={{ gap: 4 }}><MapPin size={12} /> {propTitle(p)}</div>
                                        <div className="prop-price" style={{ marginTop: 3 }}>{usd(Number(p.price))}</div>
                                        <div className="fs-12 faint" style={{ marginTop: 4 }}>{tc("ui.card.facts", { area: p.area, count: Number(p.beds) || 0, floor: p.floor, floors: p.floors })}</div>
                                        <div className="row" style={{ gap: 8, marginTop: 10 }}>
                                            <div className="avatar sm teal">{initials(p.sharedBy)}</div>
                                            <div className="fs-12 muted grow">{t("shared.sharedBy", { name: p.sharedBy })}</div>
                                        </div>
                                        <div className="fs-11 faint" style={{ marginTop: 8, lineHeight: 1.5 }}>
                                            <Lock size={10} style={{ verticalAlign: -1 }} /> {t("shared.ownerContactStays", { name: (p.sharedBy || "").split(" ")[0] })}
                                        </div>
                                        <div className="prop-foot">
                                            <button className="link-quiet" onClick={() => nav("property", { id: p.id })}>{t("shared.open")} <ChevronRight size={12} /></button>
                                            <button className="btn btn-secondary btn-sm" onClick={() => openModal("contact-agent", { agent: p.sharedBy, phone: p.sharedByPhone, property: p })}>
                                                {t("shared.contact", { name: (p.sharedBy || "").split(" ")[0] })}</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="section-head"><div className="section-title">{t("shared.sharedByYou")}</div><span className="faint fs-12">{t("shared.propertyCount", { count: mineShared.length })}</span></div>
                    {mineShared.length === 0 ? (
                        <div className="card card-pad fs-13 muted">{t("shared.noneSharedProps")}</div>
                    ) : (
                        <div className="card tbl-wrap">
                            <table className="tbl">
                                <thead><tr>{[t("shared.cols.property"), t("shared.cols.price"), t("shared.cols.area"), t("shared.cols.beds"), t("shared.cols.shared"), ""].map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                                <tbody>
                                    {mineShared.map((p) => (
                                        <tr key={p.id}>
                                            <td><button className="bold" style={{ background: "none", border: "none", padding: 0 }} onClick={() => nav("property", { id: p.id })}>{propTitle(p)}</button></td>
                                            <td>{usd(Number(p.price))}</td><td>{tc("format.area", { value: p.area })}</td><td>{p.beds}</td>
                                            <td><span className="badge badge-navy">{t("shared.visibleTo", { agency: settings.agency.toUpperCase() })}</span></td>
                                            <td><button className="btn btn-secondary btn-sm" disabled={readOnly} onClick={() => api.shareProperty(p.id, false)}>{t("shared.stopSharing")}</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {tab === "requirements" && (
                <>
                    <div className="card card-pad" style={{ background: "var(--brick-tint)", border: "none", marginBottom: 16 }}>
                        <div className="row fs-12 bold" style={{ color: "var(--brick)", gap: 7 }}>
                            <Lock size={14} /> {t("shared.privacyNote")}
                        </div>
                    </div>

                    <div className="section-head"><div className="section-title">{t("shared.fromColleagues")}</div></div>
                    <div className="stack" style={{ gap: 12, marginBottom: 26 }}>
                        {colleagueRequirements.length === 0 && (
                            <EmptyState icon={<Users size={20} />} title={t("shared.noColleagueReqs", { agency: settings.agency })}
                                body={t("shared.noColleagueReqsBody")} />
                        )}
                        {colleagueRequirements.map((r) => (
                            <div className="card card-pad" key={r.id}>
                                <div className="row wrap" style={{ justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                                    <div>
                                        <div className="eyebrow" style={{ marginBottom: 5 }}>{t("shared.lookingFor")}</div>
                                        <div className="fs-14 bold">{[districtList(r.districts) || t("shared.anyDistrict"), r.beds ? t("shared.bedrooms", { count: r.beds }) : null, usdRange(r.budgetMin, r.budgetMax)].filter(Boolean).join(" · ")}</div>
                                        <div className="fs-13 muted" style={{ marginTop: 4 }}>{[areaRange(r.areaMin, r.areaMax), r.parking ? t("shared.parkingRequired") : null, enumLabel("dealType", r.dealType)].filter(Boolean).join(" · ")}</div>
                                        <div className="row" style={{ gap: 8, marginTop: 10 }}>
                                            <div className="avatar sm teal">{initials(r.agent)}</div>
                                            <button className="link-quiet fs-12" onClick={() => openModal("contact-agent", { agent: r.agent, phone: r.agentPhone })}>{t("shared.sharedBy", { name: r.agent })}</button>
                                            <span className="badge badge-gray"><Lock size={10} /> {t("shared.clientHidden")}</span>
                                        </div>
                                    </div>
                                    <button className="btn btn-primary btn-sm" disabled={readOnly} onClick={() => openModal("colleague-matches", { req: r })}>
                                        <Search size={12} /> {t("shared.viewMatches")}</button>
                                </div>
                                {r.note && <div className="fs-12 faint" style={{ marginTop: 10 }}>{r.note}</div>}
                            </div>
                        ))}
                    </div>

                    <div className="section-head"><div className="section-title">{t("shared.sharedByYou")}</div></div>
                    {myShared.length === 0 ? (
                        <div className="card card-pad fs-13 muted">
                            {t("shared.noneSharedReqs")}
                        </div>
                    ) : (
                        <div className="stack" style={{ gap: 12 }}>
                            {myShared.map((r) => {
                                const c = clients.find((x) => x.id === r.clientId);
                                return (
                                    <div className="card card-pad row wrap" key={r.id} style={{ justifyContent: "space-between", gap: 10 }}>
                                        <div>
                                            <div className="fs-14 bold">{[districtList(r.districts), r.beds ? t("shared.bedrooms", { count: Number(r.beds) }) : null, usdRange(r.budgetMin, r.budgetMax)].filter(Boolean).join(" · ")}</div>
                                            <div className="fs-12 faint" style={{ marginTop: 4 }}>{t("shared.criteriaOnly", { name: c?.name })}</div>
                                        </div>
                                        <button className="btn btn-secondary btn-sm" disabled={readOnly} onClick={() => api.shareRequirement(r.id, false)}>{t("shared.stopSharing")}</button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
