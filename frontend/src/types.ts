export type PropertyType = "Apartment" | "House" | "Townhouse" | "Commercial" | "Land";
export type Condition = "Newly renovated" | "Old renovation" | "White frame" | "Green frame" | "Black frame";
export type BuildingType = "New building" | "Old build" | "Soviet series" | "Villa";
export type ContactType = "Owner" | "Agent" | "Agency" | "Unknown";
export type CommissionModel = "Commission On Top" | "Commission Included" | "";
export type ArchiveReason = "Sold" | "Rented" | "No longer available" | "Inactive" | "Other";
export type Feedback = "No Response" | "Viewed" | "Interested" | "Wants Showing" | "Too Expensive" | "Not Interested";
export type DealType = "Sale" | "Rent" | "Daily rent";
export type PropertyStatus = "active" | "needs_verification" | "archived";
export type LifecycleStatus = "active" | "paused" | "closed";

export interface Property {
    id: string;
    ownerId?: string | null;
    mine: boolean;
    sharedBy?: string | null;
    sharedByPhone?: string | null;
    agency?: string | null;
    sharedWithAgency: boolean;
    favorite: boolean;

    city: string;
    district: string;
    address: string;
    type: string;
    dealType: string;
    area: number | "";
    rooms?: number | "";
    beds?: number | "";
    baths?: number | "";
    floor?: number | "";
    floors?: number | "";
    condition: string;
    buildingType: string;
    parking: boolean;
    balcony: boolean;

    price: number | "";
    portalPrice: number | null | "";
    ownerNet?: number | null | "";
    commissionModel: string;
    commissionPct: number | "";
    negotiableTo: number | null | "";

    contactType: string;
    contactName?: string | null;
    contactPhone?: string | null;
    cooperates: string;
    notes: string | null;

    source: string;
    sourceRef: string | null;
    sourceUrl: string | null;
    importedAt: string | null;

    myHomeListingId: string;
    myHomeListingUrl: string;
    ssListingId: string;
    ssListingUrl: string;

    status: PropertyStatus;
    archiveReason: string | null;
    deleted: boolean;
    verifiedAt: string;
    nextFollowUp: string | null;

    photos: string[];

    [key: string]: unknown;
    /* Server timestamp of the last save; used to detect conflicting edits. */
    updatedAt?: string;
    expectedUpdatedAt?: string;
}

export interface Client {
    id: string;
    name: string;
    phone: string;
    status: LifecycleStatus;
    lastContact: string;
    notes: string;
    deleted?: boolean;
    [key: string]: unknown;
}

export interface RequirementMust {
    location: boolean;
    budget: boolean;
    area: boolean;
    beds: boolean;
    parking: boolean;
}

export interface Requirement {
    id: string;
    clientId: string;
    name: string;
    status: LifecycleStatus;
    dealType: string;
    districts: string[];
    budgetMin: number | null | "";
    budgetMax: number | null | "";
    areaMin: number | null | "";
    areaMax: number | null | "";
    rooms?: number | "";
    beds?: number | "";
    propertyType: string;
    condition: string;
    floorPref: string;
    parking: boolean;
    notes: string;
    shared: boolean;
    must: RequirementMust;
    [key: string]: unknown;
}

export interface Task {
    id: string;
    title: string;
    type: string;
    date: string;
    time: string;
    done: boolean;
    clientId: string | null;
    propertyId: string | null;
    notes: string;
}

export interface ListingReference {
    type: "myhome" | "ss" | "source" | "internal";
    id: string;
    label: string;
}

export interface Inquiry {
    id: string;
    phone: string;
    propertyId: string | null;
    date: string;
    note: string;
    converted: boolean;
    clientId?: string | null;
    listingReference: ListingReference | null;
}

export interface SentProperty {
    id: string;
    clientId: string;
    propertyId: string;
    date: string;
    price: number;
    feedback: Feedback;
    /* Title of the property when it was sent. Kept so the record still
       reads right after a colleague unshares or deletes the property. */
    propertyLabel?: string | null;
}

export interface TrashItem {
    id: string;
    kind: "Property" | "Client";
    label: string;
    deletedAt: string;
    refId?: string;
}

export interface ActivityEntry {
    date: string;
    text: string;
}

export interface ColleagueRequirement {
    id: string;
    agent: string;
    agentPhone: string | null;
    agency: string;
    districts: string[];
    budgetMin: number | null;
    budgetMax: number | null;
    beds: number | null;
    parking: boolean;
    areaMin: number | null;
    areaMax: number | null;
    propertyType: string;
    dealType: string;
    note: string;
}

export interface Profile {
    name: string;
    phone: string;
    email: string;
    city: string;
}

export interface Settings {
    agency: string;
    /* Join code for the agent's agency; colleagues need it to join. */
    agencyCode: string;
    trial: "active" | "expired";
    profile: Profile;
}

export interface Toast {
    id: string;
    text: string;
    tone?: "warn";
}

export interface MatchResult {
    property: Property;
    score: number;
    matched: string[];
    diffs: string[];
}

export interface Route {
    name: string;
    params: Record<string, unknown>;
}

export interface ModalState {
    type: string;
    props: Record<string, unknown>;
}
