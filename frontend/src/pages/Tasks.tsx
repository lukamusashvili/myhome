import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, CheckSquare } from "lucide-react";
import { useApp, useTaskHandlers } from "../store/store";
import { EmptyState, PageHeader, TaskRow } from "../components/ui";

export default function Tasks() {
    const { t } = useTranslation("workspace");
    const { sel, route, openModal, readOnly } = useApp();
    const [tab, setTab] = useState((route.params?.tab as string) || "Today");
    const h = useTaskHandlers();
    const lists = {
        Today: [...sel.todayTasks].sort((a, b) => a.time.localeCompare(b.time)),
        Upcoming: sel.upcomingTasks,
        Overdue: sel.overdueTasks,
        Completed: sel.completedTasks,
    };
    const list = lists[tab as keyof typeof lists];
    return (
        <div className="page">
            <PageHeader title={t("tasks.title")} subtitle={t("tasks.subtitle")}
                actions={<button className="btn btn-primary" disabled={readOnly} onClick={() => openModal("task", {})}><Plus size={15} /> {t("tasks.addTask")}</button>} />
            <div className="tabs" style={{ marginBottom: 16 }}>
                {(Object.keys(lists) as (keyof typeof lists)[]).map((key) => (
                    <button key={key} className={`tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
                        {t(`tasks.tabs.${key}`)} <span className="faint">{lists[key].length}</span>
                    </button>
                ))}
            </div>
            {list.length ? (
                <div className="card card-pad">{list.map((x) => <TaskRow key={x.id} t={x} {...h(x)} showDate={tab !== "Today"} />)}</div>
            ) : (
                <EmptyState icon={<CheckSquare size={20} />}
                    title={tab === "Overdue" ? t("tasks.emptyOverdueTitle") : tab === "Completed" ? t("tasks.emptyCompletedTitle") : t("tasks.emptyTitle")}
                    body={tab === "Overdue" ? t("tasks.emptyOverdueBody") : t("tasks.emptyBody")}
                    action={<button className="btn btn-primary" disabled={readOnly} onClick={() => openModal("task", {})}><Plus size={14} /> {t("tasks.addTaskLower")}</button>} />
            )}
        </div>
    );
}
