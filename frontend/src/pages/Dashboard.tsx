import { useTranslation } from "react-i18next";
import { Plus, Upload, CheckSquare, AlertTriangle, ChevronRight, Clock } from "lucide-react";
import { useApp, useTaskHandlers } from "../store/store";
import { propTitle } from "../lib/domain";
import { fmtLong, relDay, TODAY, daysAgo, greeting } from "../lib/dates";
import { Checkbox, EmptyState, Photo, Stat, TaskRow } from "../components/ui";
import type { Task } from "../types";
import { enumLabel } from "../i18n/labels";

export default function Dashboard() {
    const { t } = useTranslation("workspace");
    const { sel, nav, openModal, readOnly, settings, clients, properties } = useApp();
    const h = useTaskHandlers();
    const today = [...sel.todayTasks].sort((a, b) => a.time.localeCompare(b.time));
    const overdue = sel.overdueTasks;
    const upcoming = sel.upcomingTasks.slice(0, 5);
    const activeProps = properties.filter((p) => !p.deleted && p.status !== "archived").length;
    const activeClients = clients.filter((c) => c.status === "active").length;
    const needsCheck = properties.filter((p) => !p.deleted && (p.status === "needs_verification" || daysAgo(p.verifiedAt) > 21)).slice(0, 4);

    const upcomingByDay = upcoming.reduce<Record<string, Task[]>>((acc, x) => { (acc[x.date] = acc[x.date] || []).push(x); return acc; }, {});

    return (
        <div className="page">
            <div className="page-head">
                <div>
                    <h1 style={{ fontSize: 27, fontWeight: 600 }}>{settings.profile.name ? t("dashboard.greetingName", { greeting: greeting(), name: settings.profile.name.split(" ")[0] }) : greeting()}</h1>
                    <div className="muted fs-13" style={{ marginTop: 4 }}>{fmtLong(TODAY)}</div>
                </div>
                <div className="row wrap" style={{ gap: 8 }}>
                    <button className="btn btn-primary" disabled={readOnly} onClick={() => openModal("property", {})}><Plus size={15} /> {t("dashboard.addProperty")}</button>
                    <button className="btn btn-secondary" disabled={readOnly} onClick={() => nav("import")}><Upload size={15} /> {t("dashboard.importProperty")}</button>
                    <button className="btn btn-secondary" disabled={readOnly} onClick={() => openModal("client", {})}><Plus size={15} /> {t("dashboard.addClient")}</button>
                    <button className="btn btn-secondary" disabled={readOnly} onClick={() => openModal("task", {})}><Plus size={15} /> {t("dashboard.addTask")}</button>
                </div>
            </div>

            <div className="grid-4" style={{ marginBottom: 22 }}>
                <Stat label={t("dashboard.stats.activeProperties")} value={activeProps} />
                <Stat label={t("dashboard.stats.activeClients")} value={activeClients} />
                <Stat label={t("dashboard.stats.tasksToday")} value={today.filter((x) => !x.done).length} />
                <Stat label={t("dashboard.stats.overdue")} value={overdue.length} tone={overdue.length ? "brick" : undefined} />
            </div>

            <div className="grid-2">
                <div>
                    <div className="section-head">
                        <div className="section-title">{t("dashboard.today")}</div>
                        <span className="faint fs-12">{t("dashboard.leftOf", { left: today.filter((x) => !x.done).length, total: today.length })}</span>
                    </div>
                    {today.length ? (
                        <div className="card card-pad">{today.map((x) => <TaskRow key={x.id} t={x} {...h(x)} />)}</div>
                    ) : (
                        <EmptyState icon={<CheckSquare size={20} />} title={t("dashboard.clearTitle")}
                            body={t("dashboard.clearBody")}
                            action={<button className="btn btn-primary" disabled={readOnly} onClick={() => openModal("task", {})}><Plus size={14} /> {t("dashboard.addTaskLower")}</button>} />
                    )}

                    {overdue.length > 0 && (
                        <>
                            <div className="section-head" style={{ marginTop: 22 }}>
                                <div className="section-title" style={{ color: "var(--brick)" }}>{t("dashboard.overdue")}</div>
                                <span className="faint fs-12">{t("dashboard.taskCount", { count: overdue.length })}</span>
                            </div>
                            <div className="card card-pad" style={{ borderColor: "#F0DDD8" }}>
                                {overdue.map((x) => (
                                    <div className="task-row" key={x.id}>
                                        <Checkbox checked={x.done} onChange={() => h(x).onToggle()} style={{ marginTop: 1 }} disabled={readOnly} />
                                        <AlertTriangle size={15} color="var(--brick)" style={{ marginTop: 3, flexShrink: 0 }} />
                                        <div className="grow">
                                            <div className="fs-13 bold">{x.title}</div>
                                            <div className="fs-12 muted" style={{ marginTop: 2 }}>
                                                {x.clientId ? sel.client(x.clientId)?.name
                                                    : x.propertyId ? propTitle(sel.property(x.propertyId))
                                                    : enumLabel("taskType", x.type)}
                                            </div>
                                        </div>
                                        <span className="badge badge-brick">{relDay(x.date)}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <div>
                    <div className="section-head">
                        <div className="section-title">{t("dashboard.upcoming")}</div>
                        <button className="link-quiet" onClick={() => nav("tasks", { tab: "Upcoming" })}>{t("dashboard.allTasks")} <ChevronRight size={12} /></button>
                    </div>
                    <div className="card card-pad stack" style={{ gap: 15 }}>
                        {upcoming.length === 0 && <div className="fs-13 muted">{t("dashboard.nothingUpcoming")}</div>}
                        {Object.entries(upcomingByDay).map(([date, list]) => (
                            <div key={date}>
                                <div className="eyebrow" style={{ marginBottom: 7 }}>{relDay(date)}</div>
                                {list.map((x) => (
                                    <div className="row" key={x.id} style={{ gap: 8, alignItems: "flex-start", marginBottom: 7 }}>
                                        <Clock size={13} color="var(--text-faint)" style={{ marginTop: 2, flexShrink: 0 }} />
                                        <div className="fs-13 grow">{x.title}
                                            <span className="faint"> · {x.clientId ? sel.client(x.clientId)?.name : x.propertyId ? propTitle(sel.property(x.propertyId)) : x.time}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>

                    <div className="section-head" style={{ marginTop: 22 }}>
                        <div className="section-title">{t("dashboard.needsCheck")}</div>
                    </div>
                    <div className="card card-pad stack" style={{ gap: 11 }}>
                        {needsCheck.length === 0 && <div className="fs-13 muted">{t("dashboard.allVerified")}</div>}
                        {needsCheck.map((p) => (
                            <button key={p.id} className="row" style={{ gap: 10, background: "none", border: "none", padding: 0, textAlign: "left" }} onClick={() => nav("property", { id: p.id })}>
                                <Photo src={p.photos[0]} style={{ width: 42, height: 34, flexShrink: 0 }} radius={7} />
                                <div className="grow">
                                    <div className="fs-13 bold">{propTitle(p)}</div>
                                    <div className="fs-11 faint">{t("dashboard.verifiedDaysAgo", { count: daysAgo(p.verifiedAt) })}</div>
                                </div>
                                <ChevronRight size={15} color="var(--text-faint)" />
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
