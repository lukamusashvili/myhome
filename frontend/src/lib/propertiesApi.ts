import { request } from "./http";
import type { Property } from "../types";

export const listProperties = () => request<Property[]>("GET", "/api/properties", undefined, "Loading properties");

// Used by the admin properties tab. RLS, not this call, decides whether
// "page" means everyone's listings (admin) or just one agent's own + shared.
export const listPropertiesPage = (page: number, pageSize: number) =>
    request<{ items: Property[]; count: number }>("GET", `/api/properties?page=${page}&pageSize=${pageSize}`, undefined, "Loading properties");

// id is ignored server-side on create -- Postgres assigns the real one.
export const createProperty = (p: Record<string, unknown>) => request<Property>("POST", "/api/properties", p, "Creating property");

export const updateProperty = (id: string, patch: Record<string, unknown>) =>
    request<Property>("PATCH", `/api/properties/${id}`, patch, "Saving property");

export const deleteProperty = (id: string, opts?: { permanent?: boolean }) =>
    request<void>("DELETE", `/api/properties/${id}${opts?.permanent ? "?permanent=true" : ""}`, undefined, "Deleting property");

export const toggleFavorite = (id: string) =>
    request<{ favorite: boolean }>("POST", `/api/properties/${id}/favorite`, undefined, "Updating favorite");
