import { request } from "./http";
import type { Client } from "../types";

export type AdminClient = Client & { ownerId: string | null };

// Used by the admin customers tab -- the same /api/clients the Clients page
// uses. RLS, not this call, decides whether "page" means everyone's clients
// (admin) or just one agent's own.
export const listClientsPage = (page: number, pageSize: number) =>
    request<{ items: AdminClient[]; count: number }>("GET", `/api/clients?page=${page}&pageSize=${pageSize}`, undefined, "Loading clients");

export const createClient = (c: Record<string, unknown>) => request<AdminClient>("POST", "/api/clients", c, "Creating client");

export const updateClient = (id: string, patch: Record<string, unknown>) =>
    request<AdminClient>("PATCH", `/api/clients/${id}`, patch, "Saving client");

export const deleteClient = (id: string) => request<void>("DELETE", `/api/clients/${id}`, undefined, "Deleting client");
