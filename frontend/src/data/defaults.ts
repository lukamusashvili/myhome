import type { Property, Requirement, RequirementMust, Task } from "../types";

/* Defaults for a brand-new record before the agent fills it in. Nothing here
   is data — real records come from the database (see store.ts). */

export const createProperty = (o: Partial<Property>): Property =>
    ({
        dealType: "Sale", city: "Tbilisi", type: "Apartment", balcony: false, parking: false,
        status: "active", favorite: false, mine: true, sharedWithAgency: false, sharedBy: null,
        condition: "Newly renovated", buildingType: "New building", source: "Manual",
        sourceUrl: null,
        myHomeListingId: "", myHomeListingUrl: "", ssListingId: "", ssListingUrl: "",
        contactType: "Owner", cooperates: "Yes", commissionModel: "Commission On Top", commissionPct: 3,
        notes: "", negotiableTo: null, nextFollowUp: null, deleted: false, archiveReason: null,
        importedAt: null, photos: [], sourceRef: null, agency: null,
        ...o,
    }) as Property;

const DEFAULT_MUST: RequirementMust = { location: true, budget: false, area: false, beds: false, parking: false };

export const createRequirement = (o: Partial<Requirement>): Requirement =>
    ({
        dealType: "Sale", status: "active", shared: false, propertyType: "Apartment",
        condition: "Any", floorPref: "Any", parking: false, notes: "", name: "", districts: [],
        budgetMin: null, budgetMax: null, areaMin: null, areaMax: null,
        must: { ...DEFAULT_MUST },
        ...o,
    }) as Requirement;

export const createTask = (o: Partial<Task>): Task =>
    ({ done: false, notes: "", clientId: null, propertyId: null, type: "Call", time: "", ...o }) as Task;
