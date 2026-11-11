import { request } from "./http";
import type {
    Client, ColleagueRequirement, Inquiry, Requirement, SentProperty, Settings, Task, TrashItem,
} from "../types";

/* CRUD for one backend resource (see backend/src/lib/crud.js). */
function resource<T extends { id: string }>(path: string, label: string) {
    return {
        list: () => request<T[]>("GET", path, undefined, `Loading ${label}`),
        create: (item: Partial<T>) => request<T>("POST", path, item, `Saving ${label}`),
        update: (id: string, patch: Partial<T>) => request<T>("PATCH", `${path}/${id}`, patch, `Saving ${label}`),
        remove: (id: string) => request<void>("DELETE", `${path}/${id}`, undefined, `Deleting ${label}`),
    };
}

export type ClientRow = Client;
export interface ActivityRow { id: string; propertyId: string | null; text: string; occurredAt: string }

export const clientsApi = resource<ClientRow>("/api/clients", "clients");
export const requirementsApi = resource<Requirement>("/api/requirements", "requirements");
export const tasksApi = resource<Task>("/api/tasks", "tasks");
export const inquiriesApi = resource<Inquiry>("/api/inquiries", "inquiries");
export const sentApi = resource<SentProperty>("/api/sent", "sent properties");
export const trashApi = {
    list: () => request<TrashItem[]>("GET", "/api/trash", undefined, "Loading Recently Deleted"),
    create: (t: TrashItem) => request<TrashItem>("POST", "/api/trash", t, "Saving to Recently Deleted"),
    remove: (id: string) => request<void>("DELETE", `/api/trash/${id}`, undefined, "Updating Recently Deleted"),
};
export const activityApi = {
    list: () => request<ActivityRow[]>("GET", "/api/activity", undefined, "Loading activity"),
    create: (a: { propertyId: string; text: string }) => request<ActivityRow>("POST", "/api/activity", a, "Saving activity"),
};

export const colleagueRequirementsApi = {
    list: () => request<ColleagueRequirement[]>("GET", "/api/colleague-requirements", undefined, "Loading shared requirements"),
};

export const meApi = {
    get: () => request<Settings>("GET", "/api/me", undefined, "Loading your profile"),
    update: (p: Partial<Settings["profile"]>) => request<Settings>("PATCH", "/api/me", p, "Saving your profile"),
    changeAgency: (name: string, code?: string) => request<Settings>("POST", "/api/me/agency", { name, code }, "Changing agency"),
};
