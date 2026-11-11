import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Building, Download, KeyRound, Languages, LogOut, ShieldCheck, Sparkles } from "lucide-react";
import { TESTING_FULL_ACCESS, useApp } from "../store/store";
import { Badge, Field, Input, LanguageSwitcher, PageHeader } from "../components/ui";
import { requestPasswordReset, signOut } from "../lib/auth";

const PRIVACY = ["ownerPrivate", "clientPrivate", "privateRequirements", "nothingSent"] as const;

export default function Settings() {
    const { t } = useTranslation("account");
    const { settings, api, openModal, properties, requirements, nav, readOnly } = useApp();
    const [p, setP] = useState(settings.profile);
    const sharedCount = properties.filter((x) => x.mine && x.sharedWithAgency).length + requirements.filter((r) => r.shared).length;
    const set = (k: keyof typeof p) => (e: React.ChangeEvent<HTMLInputElement>) => setP((s) => ({ ...s, [k]: e.target.value }));

    return (
        <div className="page">
            <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />
            <div className="grid-2">
                <div className="stack" style={{ gap: 18 }}>
                    <div className="card card-pad">
                        <div className="section-title" style={{ marginBottom: 12 }}>{t("settings.profile.title")}</div>
                        <div className="form-grid">
                            <Field label={t("settings.profile.name")}><Input value={p.name} onChange={set("name")} disabled={readOnly} /></Field>
                            <Field label={t("settings.profile.phone")}><Input value={p.phone} onChange={set("phone")} disabled={readOnly} /></Field>
                        </div>
                        <div className="form-grid">
                            <Field label={t("settings.profile.city")}><Input value={p.city} onChange={set("city")} disabled={readOnly} /></Field>
                            <Field label={t("settings.profile.email")} hint={t("settings.profile.emailHint")}><Input value={p.email} disabled readOnly /></Field>
                        </div>
                        <button className="btn btn-primary" disabled={readOnly} onClick={() => api.updateProfile({ name: p.name, phone: p.phone, city: p.city })}>{t("settings.profile.save")}</button>
                    </div>

                    <div className="card card-pad">
                        <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                            <Languages size={15} color="var(--navy-2)" /><div className="section-title">{t("settings.language.title")}</div>
                        </div>
                        <div className="fs-12 muted" style={{ marginBottom: 11, lineHeight: 1.5 }}>{t("settings.language.hint")}</div>
                        <LanguageSwitcher />
                    </div>

                    <div className="card card-pad">
                        <div className="section-title" style={{ marginBottom: 10 }}>{t("settings.agency.title")}</div>
                        <div className="kv"><span className="kv-l">{t("settings.agency.current")}</span><span className="kv-v">{settings.agency || t("settings.agency.none")}</span></div>
                        {settings.agencyCode && (
                            <div className="kv"><span className="kv-l">{t("settings.agency.joinCode")}</span><span className="kv-v" style={{ fontFamily: "monospace", letterSpacing: 1 }}>{settings.agencyCode}</span></div>
                        )}
                        {settings.agencyCode && <div className="form-note">{t("settings.agency.joinCodeNote")}</div>}
                        <div className="kv"><span className="kv-l">{t("settings.agency.sharedNow")}</span><span className="kv-v">{sharedCount}</span></div>
                        <div className="card card-pad" style={{ background: "var(--amber-tint)", border: "none", margin: "13px 0" }}>
                            <div className="fs-13" style={{ color: "var(--amber)", lineHeight: 1.55 }}>
                                {settings.agency
                                    ? t("settings.agency.changeWarning", { agency: settings.agency })
                                    : t("settings.agency.joinPrompt")}
                                {" "}{t("settings.agency.staysPut")}
                            </div>
                        </div>
                        <button className="btn btn-secondary" disabled={readOnly} onClick={() => openModal("change-agency", {})}><Building size={14} /> {settings.agency ? t("settings.agency.change") : t("settings.agency.join")}</button>
                    </div>

                    <div className="card card-pad">
                        <div className="section-title" style={{ marginBottom: 10 }}>{t("settings.privacy.title")}</div>
                        {PRIVACY.map((k) => (
                            <div className="row fs-13" key={k} style={{ gap: 8, marginBottom: 7, alignItems: "flex-start" }}>
                                <ShieldCheck size={14} color="var(--teal)" style={{ marginTop: 2, flexShrink: 0 }} />{t(`settings.privacy.${k}`)}
                            </div>
                        ))}
                        <button className="btn btn-secondary" style={{ marginTop: 10 }} onClick={() => openModal("export", {})}><Download size={14} /> {t("settings.privacy.export")}</button>
                    </div>
                </div>

                <div className="stack" style={{ gap: 18 }}>
                    <div className="card card-pad">
                        <div className="section-title" style={{ marginBottom: 10 }}>{t("settings.subscription.title")}</div>
                        <div className="row wrap" style={{ justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                            <div>
                                <div className="fs-14 bold">{settings.trial === "expired" ? t("settings.subscription.trialEnded") : t("settings.subscription.freeTrial")}</div>
                                <div className="fs-12 faint" style={{ marginTop: 3 }}>{settings.trial === "expired" ? t("settings.subscription.readOnlyUntilUpgrade") : t("settings.subscription.fullAccess")}</div>
                            </div>
                            <Badge tone={settings.trial === "expired" ? "brick" : "teal"}>{settings.trial === "expired" ? t("settings.subscription.badgeReadOnly") : t("settings.subscription.badgeActive")}</Badge>
                        </div>
                        <div className="kv"><span className="kv-l">{t("settings.subscription.currentPlan")}</span><span className="kv-v">{t("settings.subscription.freeTrial")}</span></div>
                        <div className="kv"><span className="kv-l">{t("settings.subscription.afterTrial")}</span><span className="kv-v">{t("settings.subscription.agentPlan")}</span></div>
                        <div className="kv"><span className="kv-l">{t("settings.subscription.includes")}</span><span className="kv-v">{t("settings.subscription.fullWorkspace")}</span></div>
                        <div className="form-note" style={{ marginTop: 8 }}>{t("settings.subscription.pricingNote")}</div>
                        <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={() => api.toast(t("settings.subscription.checkoutLater"))}>{t("settings.subscription.upgrade")}</button>
                    </div>

                    <div className="card card-pad">
                        <div className="section-title" style={{ marginBottom: 10 }}>{t("settings.security.title")}</div>
                        <div className="kv"><span className="kv-l">{t("settings.security.signIn")}</span><span className="kv-v">{p.email}</span></div>
                        <div className="kv"><span className="kv-l">{t("settings.security.twoFactor")}</span><span className="kv-v">{t("settings.security.notEnabled")}</span></div>
                        <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
                            <button className="btn btn-secondary" disabled={readOnly} onClick={() => { void requestPasswordReset(p.email).then(({ error }) => api.toast(error ? error.message : t("settings.security.resetLinkToast"), error ? "warn" : undefined)); }}><KeyRound size={14} /> {t("settings.security.changePassword")}</button>
                            <button className="btn btn-secondary" disabled={readOnly} onClick={() => api.toast(t("settings.security.signedOutToast"))}><LogOut size={14} /> {t("settings.security.signOutEverywhere")}</button>
                            <button className="btn btn-secondary" onClick={signOut}><LogOut size={14} /> {t("settings.security.signOut")}</button>
                        </div>
                    </div>

                    <div className="card card-pad" style={{ borderStyle: "dashed" }}>
                        <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                            <Sparkles size={15} color="var(--navy-2)" /><div className="section-title">{t("settings.demo.title")}</div>
                        </div>
                        <div className="fs-12 muted" style={{ marginBottom: 11, lineHeight: 1.5 }}>
                            {t("settings.demo.body")}
                        </div>
                        <div className="segmented" style={{ width: "fit-content" }}>
                            <button className={settings.trial === "active" ? "on" : ""} onClick={() => api.setTrial("active")}>{t("settings.demo.trialActive")}</button>
                            <button className={settings.trial === "expired" ? "on" : ""} onClick={() => { api.setTrial("expired"); nav("trial"); }}>{t("settings.demo.trialExpired")}</button>
                        </div>
                        {TESTING_FULL_ACCESS && (
                            <div className="fs-12" style={{ marginTop: 9, color: "var(--amber)", lineHeight: 1.5 }}>
                                {t("settings.demo.overrideNote")}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
