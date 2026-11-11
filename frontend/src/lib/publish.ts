import type { Property } from "../types";
import type { SsDraftSeed } from "./api";
import { t } from "../i18n";
import { enumLabel } from "../i18n/labels";

// Maps an Agent OS property onto each portal's create-listing payload. Every
// id below was read from the portal's own form, not guessed. Only public
// fields are used: contactName, contactPhone, notes, portalPrice, commission
// fields and negotiableTo must never appear in a published advert.

export type Portal = "myhome" | "ss";

export const PORTAL_LABEL: Record<Portal, string> = { myhome: "MyHome.ge", ss: "SS.ge" };

const MYHOME_TYPE: Record<string, number> = { Apartment: 1, House: 2 };
const MYHOME_DEAL: Record<string, number> = { Sale: 1, Rent: 2, "Daily rent": 7 };
const MYHOME_CONDITION: Record<string, number> = {
    "Newly renovated": 1, "Old renovation": 2, "White frame": 5, "Black frame": 6, "Green frame": 7,
};
const MYHOME_STATUS_NEW = 2;
const MYHOME_STATUS_OLD = 1;
const MYHOME_USD = 2;
// MyHome skips id 6: "6 rooms" is 7 and so on up to "10+", which is 11.
const myhomeRoomType = (rooms: number) => (rooms <= 5 ? rooms : Math.min(rooms + 1, 11));
const myhomeBedroomType = (beds: number) => Math.min(beds, 10);

/* `label` is the English fallback; the modal shows modals:publish.projectType.<value>. */
export const MYHOME_PROJECT_TYPES = [
    { value: "8", label: "Nonstandard" }, { value: "6", label: "City" }, { value: "5", label: "Czech" },
    { value: "4", label: "Khrushchev" }, { value: "18", label: "Leningrad" }, { value: "1", label: "Lvov" },
    { value: "7", label: "Moscow" }, { value: "3", label: "Tukhareli" }, { value: "2", label: "Kavlashvili" },
];

const SS_TYPE: Record<string, number> = { Apartment: 5, House: 4 };
const SS_DEAL: Record<string, number> = { Sale: 4, Rent: 1, "Daily rent": 3 };
const SS_STATE: Record<string, number> = {
    "Newly renovated": 16, "Old renovation": 12, "White frame": 9, "Green frame": 35, "Black frame": 8,
};
const SS_STATUS_NEW = 2;
const SS_STATUS_OLD = 453;
const SS_TBILISI = 95;
const SS_GEL = 1;
const SS_USD = 2;
// The only bathroom and balcony ids captured so far ("1" of each). Other
// counts are left unset rather than guessed.
const SS_ONE_BATHROOM = 418;
const SS_ONE_BALCONY = 412;
// Required by ss.ge. Taken from a known-good form capture (the old ssTestStatement.ts);
// which project type its label is hasn't been confirmed.
const SS_DEFAULT_PROJECT = 28;

export interface MyhomeLocation {
    locations: string[];
    identifiers: { city_id: number; district_id?: number; urban_id?: number; grouped_street_streets?: number[]; street_id?: number };
    find_point: string;
    lat: number;
    lng: number;
    location_id: number | null;
}

export interface SsStreet { id: number; title: string; subDistrictId: number }

export interface PublishContact { name: string; phone: string }

export function streetNumberFrom(address: string): string {
    const match = String(address || "").match(/(\d+[a-zA-Zა-ჿ]?)\s*$/);
    return match ? match[1] : "";
}

// Portal phone numbers are local 9-digit numbers, with no +995 prefix.
export function normalizePhone(phone: string): string {
    return String(phone || "").replace(/\D/g, "").replace(/^995/, "");
}

// What stops this property being published at all. Portals reject these
// anyway, later and with a far less useful error.
export function publishBlockers(p: Property, portal: Portal): string[] {
    const out: string[] = [];
    if (!p.mine) out.push(t("modals:publish.blockers.notMine"));
    // SS.ge imports store the city in Georgian.
    if (p.city && p.city !== "Tbilisi" && p.city !== "თბილისი") out.push(t("modals:publish.blockers.notTbilisi"));
    if (!MYHOME_TYPE[p.type]) out.push(t("modals:publish.blockers.type", { type: enumLabel("propertyType", p.type) }));
    if (!MYHOME_DEAL[p.dealType]) out.push(t("modals:publish.blockers.deal", { deal: enumLabel("dealType", p.dealType) }));
    if (!MYHOME_CONDITION[p.condition]) out.push(t("modals:publish.blockers.condition", { condition: enumLabel("condition", p.condition) }));
    if (!(Number(p.price) > 0)) out.push(t("modals:publish.blockers.price"));
    if (!(Number(p.area) > 0)) out.push(t("modals:publish.blockers.area"));
    if (!(Number(p.rooms) > 0)) out.push(t("modals:publish.blockers.rooms"));
    if (!(Number(p.beds) > 0)) out.push(t("modals:publish.blockers.beds"));
    // A house has storeys but no "floor it's on".
    if (p.type === "House") {
        if (!(Number(p.floors) > 0)) out.push(t("modals:publish.blockers.floors"));
    } else if (!(Number(p.floor) > 0) || !(Number(p.floors) > 0)) out.push(t("modals:publish.blockers.floorAndFloors"));
    if (portal === "myhome" && !(p.photos || []).length) out.push(t("modals:publish.blockers.photo"));
    return out;
}

// Georgian text built from public fields only. The agent can edit it first.
export function defaultDescription(p: Property): string {
    const deal = p.dealType === "Sale" ? "იყიდება" : p.dealType === "Daily rent" ? "ქირავდება დღიურად" : "ქირავდება";
    const type = p.type === "House" ? "სახლი" : "ბინა";
    const floors = p.type === "House" ? `${p.floors} სართულიანი` : `${p.floor}/${p.floors} სართული`;
    return `${deal} ${p.rooms} ოთახიანი ${type}, ${p.area} მ², ${floors}.`;
}

export function myhomeStreetName(location: MyhomeLocation): string {
    return location.locations[location.locations.length - 1] || "";
}

export function myhomeStreetId(location: MyhomeLocation): number | null {
    const group = location.identifiers.grouped_street_streets;
    if (group?.length) return group[group.length - 1];
    return location.identifiers.street_id ?? null;
}

export function buildMyhomeFields(args: {
    property: Property;
    street: MyhomeLocation;
    districtLocationId: number;
    streetNumber: string;
    description: string;
    projectTypeId: number;
    contact: PublishContact;
}): Record<string, unknown> {
    const { property: p, street, districtLocationId, streetNumber, description, projectTypeId, contact } = args;
    const price = Number(p.price);
    const area = Number(p.area);
    const address = `${myhomeStreetName(street)} ${streetNumber}, თბილისი, საქართველო`;

    const fields: Record<string, unknown> = {
        real_estate_type_id: MYHOME_TYPE[p.type],
        deal_type_id: MYHOME_DEAL[p.dealType],
        city_id: street.identifiers.city_id,
        street_id: myhomeStreetId(street),
        location_id: districtLocationId,
        district_id: street.identifiers.district_id,
        urban_id: street.identifiers.urban_id,
        rs_code: "",
        appear_rs_code: 0,
        longitude: street.lng,
        latitude: street.lat,
        duration_id: 1,
        status_id: p.buildingType === "New building" ? MYHOME_STATUS_NEW : MYHOME_STATUS_OLD,
        project_type_id: projectTypeId,
        room_type_id: myhomeRoomType(Number(p.rooms)),
        bedroom_type_id: myhomeBedroomType(Number(p.beds)),
        // Left out for a house with no floor set (see publishBlockers).
        ...(Number(p.floor) > 0 ? { floor: Number(p.floor) } : {}),
        total_floors: Number(p.floors),
        condition_id: MYHOME_CONDITION[p.condition],
        area,
        area_type_id: 1,
        price_type_id: 3,
        total_price: price,
        square_price: Math.round((price / area) * 100) / 100,
        currency_id: MYHOME_USD,
        // MyHome rejects can_exchanged (HTTP 422) on anything but a sale.
        ...(MYHOME_DEAL[p.dealType] === MYHOME_DEAL.Sale ? { can_exchanged: 0 } : {}),
        phone_number: normalizePhone(contact.phone),
        is_phone_number_visible: 1,
        "websites[0]": 2, // myhome only
    };
    for (const lang of ["ka", "en", "ru"]) {
        fields[`${lang}[address]`] = address;
        fields[`${lang}[owner_name]`] = contact.name;
        fields[`${lang}[street_number]`] = streetNumber;
        fields[`${lang}[comment]`] = lang === "ka" ? description : "";
    }
    return fields;
}

export function buildSsApplication(args: {
    property: Property;
    street: SsStreet;
    streetNumber: string;
    description: string;
    contact: PublishContact;
    usdGelRate: number;
    coordinates: { lat: number; lng: number } | null;
}): { draftSeed: SsDraftSeed; applicationFields: Record<string, unknown> } {
    const { property: p, street, streetNumber, description, contact, usdGelRate, coordinates } = args;
    const priceUsd = Number(p.price);
    const area = Number(p.area);
    // `price` is sent in GEL, so currencyId must say GEL: claiming USD here made
    // ss.ge store a null price and show the advert as "price by agreement".
    // showSiteCurrencyId only chooses which currency the advert displays.
    const priceGel = Math.round(priceUsd * usdGelRate);
    const status = p.buildingType === "New building" ? SS_STATUS_NEW : SS_STATUS_OLD;

    const draftSeed: SsDraftSeed = {
        realEstateTypeId: SS_TYPE[p.type],
        realEstateDealTypeId: SS_DEAL[p.dealType],
        cityId: SS_TBILISI,
        subdistrictId: street.subDistrictId,
        streetId: street.id,
        streetNumber,
        locationLatitude: coordinates?.lat,
        locationLongitude: coordinates?.lng,
        priceType: 1,
        price: priceGel,
        currencyId: SS_GEL,
        showSiteCurrencyId: SS_USD,
        rooms: Number(p.rooms),
        bedrooms: Number(p.beds),
        totalArea: area,
        ...(Number(p.floor) > 0 ? { floor: Number(p.floor) } : {}),
        floors: Number(p.floors),
        status,
        // SS.ge's own form saves these on the draft already. Drafts created
        // without them were accepted and shown as Active in the account, but
        // never became public (v3 report, B4).
        priceUsd,
        descriptionGe: description,
        phoneNumbers: [{ phoneNumber: normalizePhone(contact.phone), hasViber: false, hasWhatsapp: false, isApproved: true, isMain: true }],
        messagingOn: true,
        phoneCallsOn: true,
    };

    const applicationFields: Record<string, unknown> = {
        ...draftSeed,
        cadastralCode: null,
        priceUsd,
        unitPrice: Math.round((priceGel / area) * 100) / 100,
        unitPriceUsd: Math.round((priceUsd / area) * 100) / 100,
        descriptionEn: null,
        descriptionRu: null,
        contactPerson: contact.name,
        images: [],
        videos: [],
        applicationVideoLink: null,
        kitchenArea: null,
        // These enums reject null outright ("could not be converted"), so an
        // unset one is left out of the JSON via undefined instead.
        toilet: Number(p.baths) === 1 ? SS_ONE_BATHROOM : undefined,
        project: SS_DEFAULT_PROJECT,
        balconyLoggia: p.balcony ? SS_ONE_BALCONY : undefined,
        state: SS_STATE[p.condition],
        landType: null,
        willLiveInHouse: 0, // must be 0, not null, when unset
        commercialRealEstateType: 0,
        viewOnTheYard: false, viewOnTheStreet: false, comfortable: false, light: false, airConditioning: false,
        balcony: !!p.balcony, basement: false, cableTelevision: false, drinkingWater: false, electricity: false,
        elevator: false, fridge: false, furniture: false, withBuiltInKitchen: false, garage: !!p.parking,
        glazedWindows: false, heating: false, hotWater: false, internet: false, ironDoor: false, lastFloor: false,
        naturalGas: false, securityAlarm: false, sewage: false, storage: false, telephone: false, tv: false,
        washingMachine: false, water: false, wiFi: false, withPool: false,
        hasRemoteViewing: false, isPetFriendly: false,
        watermarkPosition: null, hasCustomWatermark: null,
    };

    return { draftSeed, applicationFields };
}

export const myhomeListingUrl = (id: string | number) => `https://www.myhome.ge/pr/${id}/`;
export const ssListingUrl = (id: string | number) => `https://home.ss.ge/ka/udzravi-qoneba/${id}`;

// MyHome's create response isn't documented, so look in the places an id is
// known or likely to be rather than assuming one shape.
export function myhomeListingIdFrom(data: unknown): string | null {
    const root = data as { data?: Record<string, unknown>; id?: unknown; statement_id?: unknown } | null;
    const inner = root?.data as { id?: unknown; statement_id?: unknown; statement?: { id?: unknown } } | undefined;
    const id = inner?.statement?.id ?? inner?.statement_id ?? inner?.id ?? root?.statement_id ?? root?.id;
    if (id !== undefined && id !== null) return String(id);
    // The one live publish returned none of the shapes above (report bug 3),
    // and its response wasn't captured. Fall back to any statement-looking
    // id nested anywhere in the response: an "id"/"statement_id" key holding
    // a listing-sized number (MyHome IDs are 8 digits today).
    return findListingId(data, 0);
}

function findListingId(node: unknown, depth: number): string | null {
    if (!node || typeof node !== "object" || depth > 5) return null;
    const entries = Object.entries(node as Record<string, unknown>);
    for (const [k, v] of entries) {
        if (/^(statement_?id|id)$/i.test(k) && /^\d{6,10}$/.test(String(v))) return String(v);
    }
    for (const [, v] of entries) {
        const hit = findListingId(v, depth + 1);
        if (hit) return hit;
    }
    return null;
}
