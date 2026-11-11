import {
    Home, Building2, Users, CheckSquare, Share2, Upload, HelpCircle, Settings as SettingsIcon, Archive, Inbox,
    ShieldCheck,
} from "lucide-react";
import type { ComponentType } from "react";
import type enCommon from "../i18n/locales/en/common.json";

type NavLabelKey = `nav.${keyof typeof enCommon.nav}`;

/* Tbilisi districts. A property elsewhere keeps whatever district its source
   gave it (see lib/import.ts) — it is never forced into one of these. */
export const DISTRICTS = [
    "Vake", "Saburtalo", "Vera", "Mtatsminda", "Sololaki", "Old Tbilisi", "Avlabari", "Chugureti", "Didube",
    "Dighomi", "Didi Dighomi", "Digomi Massive", "Vashlijvari", "Nadzaladevi", "Gldani", "Mukhiani", "Isani",
    "Samgori", "Varketili", "Vazisubani", "Krtsanisi", "Ortachala", "Lisi", "Bagebi", "Tskneti",
];
/* The list plus a value that isn't on it, so a select never silently shows a different district. */
export const districtOptions = (current?: string | null) =>
    current && !DISTRICTS.includes(current) ? [current, ...DISTRICTS] : DISTRICTS;
export const PROPERTY_TYPES = ["Apartment", "House", "Townhouse", "Commercial", "Land"];
export const CONDITIONS = ["Newly renovated", "Old renovation", "White frame", "Green frame", "Black frame"];
export const BUILDING_TYPES = ["New building", "Old build", "Soviet series", "Villa"];
export const CONTACT_TYPES = ["Owner", "Agent", "Agency", "Unknown"];
export const COMMISSION_MODELS = ["Commission On Top", "Commission Included"];
/* Older demo data may still carry the retired third model. */
export const normalizeModel = (m: string | null | undefined) =>
    m && COMMISSION_MODELS.includes(m) ? m : "Commission On Top";
export const ARCHIVE_REASONS = ["Sold", "Rented", "No longer available", "Inactive", "Other"];
export const FEEDBACKS = ["No Response", "Viewed", "Interested", "Wants Showing", "Too Expensive", "Not Interested"];

export interface NavItem {
    key: string;
    /* common.json key; render with t(item.labelKey). */
    labelKey: NavLabelKey;
    icon: ComponentType<{ size?: number }>;
}

export const NAV: NavItem[] = [
    { key: "dashboard", labelKey: "nav.dashboard", icon: Home },
    { key: "properties", labelKey: "nav.properties", icon: Building2 },
    { key: "clients", labelKey: "nav.clients", icon: Users },
    { key: "tasks", labelKey: "nav.tasks", icon: CheckSquare },
    { key: "shared", labelKey: "nav.shared", icon: Share2 },
    { key: "import", labelKey: "nav.import", icon: Upload },
    { key: "inquiries", labelKey: "nav.inquiries", icon: Inbox },
];
export const NAV_BOTTOM: NavItem[] = [
    { key: "archive", labelKey: "nav.archive", icon: Archive },
    { key: "settings", labelKey: "nav.settings", icon: SettingsIcon },
    { key: "help", labelKey: "nav.help", icon: HelpCircle },
];
// Shown only to admins (profiles.role === "admin") -- appended by shell.tsx,
// not part of NAV_BOTTOM itself so it never renders for anyone else.
export const ADMIN_NAV_ITEM: NavItem = { key: "admin", labelKey: "nav.admin", icon: ShieldCheck };
export const ROUTE_GROUP: Record<string, string> = {
    property: "properties", client: "clients", matching: "clients", offer: "clients", requirement: "clients",
};
