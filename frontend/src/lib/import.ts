import { TODAY } from "./dates";
import { API_BASE_URL } from "./api";
import { getFreshAccessToken } from "./auth";
import type { Property } from "../types";
import { t } from "../i18n";
import { callPortal, extensionConfigured, type PortalOp } from "./extension";

/* Listings are read by the AgentOS extension in the agent's browser
   (extension/portal.js), so importing works whenever it's configured. */
export const IMPORT_AVAILABLE = extensionConfigured;

/* Copies the previewed portal photos into our own storage. Only called once
   the agent confirms the import, so an abandoned preview uploads nothing. */
export async function persistImportPhotos(urls: string[]): Promise<string[]> {
    if (!urls.length) return [];
    const token = await getFreshAccessToken();
    const res = await fetch(`${API_BASE_URL}/api/properties/import/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ urls }),
    });
    if (!res.ok) throw new Error(t("properties:import.copyPhotosFailed", { status: res.status }));
    return ((await res.json()) as { urls: string[] }).urls;
}

/* ---- value mapping: external wording -> Agent OS vocabulary ---- */
const TYPE_MAP: Record<string, string> = {
    apartment: "Apartment", flat: "Apartment", "ბინა": "Apartment", "квартира": "Apartment",
    house: "House", villa: "House", "სახლი": "House", "дом": "House",
    townhouse: "Townhouse", "თაუნჰაუსი": "Townhouse",
    commercial: "Commercial", office: "Commercial", "კომერციული": "Commercial",
    land: "Land", plot: "Land", "მიწა": "Land",
};
const DEAL_MAP: Record<string, string> = {
    sale: "Sale", sell: "Sale", "for sale": "Sale", "იყიდება": "Sale", "продажа": "Sale",
    rent: "Rent", "for rent": "Rent", "ქირავდება": "Rent", "аренда": "Rent",
    "daily rent": "Daily rent", daily: "Daily rent", "დღიურად": "Daily rent",
};
const CONDITION_MAP: Record<string, string> = {
    "newly renovated": "Newly renovated", "new renovation": "Newly renovated", "ახალი გარემონტებული": "Newly renovated",
    "old renovation": "Old renovation", "ძველი გარემონტებული": "Old renovation",
    "white frame": "White frame", "თეთრი კარკასი": "White frame",
    "green frame": "Green frame", "მწვანე კარკასი": "Green frame",
    "black frame": "Black frame", "შავი კარკასი": "Black frame",
};
/* Tbilisi districts only (see DISTRICTS in data/constants.ts). Anything
   else keeps the portal's own wording instead of being guessed. */
const DISTRICT_MAP: Record<string, string> = {
    vake: "Vake", "ვაკე": "Vake",
    saburtalo: "Saburtalo", "საბურთალო": "Saburtalo",
    vera: "Vera", "ვერა": "Vera",
    mtatsminda: "Mtatsminda", "მთაწმინდა": "Mtatsminda",
    sololaki: "Sololaki", "სოლოლაკი": "Sololaki",
    "old tbilisi": "Old Tbilisi", "ძველი თბილისი": "Old Tbilisi",
    avlabari: "Avlabari", "ავლაბარი": "Avlabari",
    chugureti: "Chugureti", "ჩუღურეთი": "Chugureti",
    didube: "Didube", "დიდუბე": "Didube",
    dighomi: "Dighomi", "დიღომი": "Dighomi",
    "didi dighomi": "Didi Dighomi", "დიდი დიღომი": "Didi Dighomi",
    "digomi massive": "Digomi Massive", "dighomi massive": "Digomi Massive", "დიღომის მასივი": "Digomi Massive",
    vashlijvari: "Vashlijvari", "ვაშლიჯვარი": "Vashlijvari",
    nadzaladevi: "Nadzaladevi", "ნაძალადევი": "Nadzaladevi",
    gldani: "Gldani", "გლდანი": "Gldani",
    mukhiani: "Mukhiani", "მუხიანი": "Mukhiani",
    isani: "Isani", "ისანი": "Isani",
    samgori: "Samgori", "სამგორი": "Samgori",
    varketili: "Varketili", "ვარკეთილი": "Varketili",
    vazisubani: "Vazisubani", "ვაზისუბანი": "Vazisubani",
    krtsanisi: "Krtsanisi", "კრწანისი": "Krtsanisi",
    ortachala: "Ortachala", "ორთაჭალა": "Ortachala",
    lisi: "Lisi", "ლისი": "Lisi",
    bagebi: "Bagebi", "ბაგები": "Bagebi",
    tskneti: "Tskneti", "წყნეთი": "Tskneti",
};
const TBILISI = /tbilisi|თბილისი|тбилиси/i;
const CURRENCY_MAP: Record<string, string> = { usd: "USD", $: "USD", "დოლარი": "USD", gel: "GEL", "₾": "GEL", "ლარი": "GEL" };

/* Unmapped values stay null rather than being guessed into something wrong. */
const mapValue = (map: Record<string, string>, raw: unknown): string | null => {
    if (raw === null || raw === undefined) return null;
    const key = String(raw).trim().toLowerCase();
    if (!key) return null;
    if (map[key]) return map[key];
    // Longest key first, so "daily rent" beats "rent" and "დიდი დიღომი"
    // beats "დიღომი" (daily rentals used to come through as monthly Rent).
    const hit = Object.keys(map).sort((a, b) => b.length - a.length).find((k) => key.includes(k));
    return hit ? map[hit] : null;
};

/* "4 ოთახიანი ბინა", "3-room apartment", "2-х комнатная": MyHome often
   leaves the rooms field empty but says it in the title. */
const roomsFromTitle = (title: unknown): number | null => {
    const m = String(title ?? "").match(/(\d{1,2})\s*-?\s*(?:ოთახ|room|комн|-?х\s*комн)/i);
    const n = m ? Number(m[1]) : NaN;
    return n > 0 && n < 30 ? n : null;
};
const toNumber = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const m = String(v).replace(/\s/g, "").match(/\d+(?:[.,]\d+)*/);
    if (!m) return null;
    const n = Number(m[0].replace(/,/g, ""));
    return isFinite(n) && n > 0 ? n : null;
};
/* External text is untrusted: strip tags and entities, never inject HTML. */
const HTML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'", "#039": "'" };
const sanitizeText = (v: unknown, max = 1200): string => {
    if (v === null || v === undefined) return "";
    const strip = (t: string) =>
        t.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]*>/g, " ");
    const decoded = strip(String(v)).replace(/&([a-z#0-9]+);/gi, (_m, e) => HTML_ENTITIES[e.toLowerCase()] ?? " ");
    return strip(decoded).replace(/\s+/g, " ").trim().slice(0, max);
};

export class ImportError extends Error {
    code: string;
    constructor(code: string, message?: string) {
        super(message);
        this.code = code;
    }
}

/* Codes with their own message; every other failure (parse_failed, network,
   timeout, unknown) reads as a generic server-side error. */
const IMPORT_MESSAGE_CODES = ["invalid_input", "unsupported_source", "service_unavailable", "not_found"] as const;
type ImportMessageCode = (typeof IMPORT_MESSAGE_CODES)[number] | "unknown";
export const importMessage = (code: string | undefined) => {
    const key: ImportMessageCode = (IMPORT_MESSAGE_CODES as readonly string[]).includes(code || "") ? (code as ImportMessageCode) : "unknown";
    return t(`properties:import.errors.${key}`);
};

/* ---- providers ---- */
export interface ParsedListing {
    provider: string;
    externalId: string | null;
    externalUrl: string;
}
export interface Provider {
    id: string;
    label: string;
    prefix: string;
    simulated: boolean;
    canHandle(input: string): boolean;
    parse(input: string): ParsedListing | null;
}

function makePortalProvider({
    id, label, prefix, hostPattern, idFromUrl, urlFromId,
}: {
    id: string; label: string; prefix: string; hostPattern: RegExp;
    idFromUrl: (u: string) => string | null; urlFromId: (id: string) => string;
}): Provider {
    return {
        id, label, prefix, simulated: false,
        canHandle(input: string) {
            const raw = String(input || "").trim();
            if (hostPattern.test(raw)) return true;
            return /^#?\d{4,}$/.test(raw); // bare ID — only with an explicit source choice
        },
        parse(input: string) {
            const raw = String(input || "").trim();
            if (hostPattern.test(raw)) {
                const externalId = idFromUrl(raw);
                return { provider: id, externalId, externalUrl: raw };
            }
            const bare = raw.replace(/^#/, "").replace(/^(mh|ss)-/i, "");
            if (!/^\d{4,}$/.test(bare)) return null;
            return { provider: id, externalId: bare, externalUrl: urlFromId(bare) };
        },
    };
}

export const MY_HOME_PROVIDER = makePortalProvider({
    id: "myhome.ge", label: "MyHome.ge", prefix: "MH",
    hostPattern: /myhome\.ge/i,
    idFromUrl: (u) => (u.match(/\/pr\/(\d{4,})/i) || [])[1] || (u.match(/\d{5,}/g) || []).sort((a, b) => b.length - a.length)[0] || null,
    urlFromId: (id) => `https://www.myhome.ge/pr/${id}/`,
});
export const SS_PROVIDER = makePortalProvider({
    id: "ss.ge", label: "SS.ge", prefix: "SS",
    hostPattern: /(^|\/\/|\.)ss\.ge/i,
    idFromUrl: (u) => (u.match(/\/(?:real-estate|ad)\/[^/]*?(\d{5,})/i) || [])[1] || (u.match(/\d{5,}/g) || []).sort((a, b) => b.length - a.length)[0] || null,
    urlFromId: (id) => `https://ss.ge/en/real-estate/${id}`,
});
export const PROVIDERS: Provider[] = [MY_HOME_PROVIDER, SS_PROVIDER];
const providerById = (id: string | null) => PROVIDERS.find((p) => p.id === id) || null;

export function detectSource(input: string): string | null {
    const raw = String(input || "").trim();
    if (!raw) return null;
    const hit = PROVIDERS.find((p) => (p.id === "myhome.ge" ? /myhome\.ge/i : /(^|\/\/|\.)ss\.ge/i).test(raw));
    return hit ? hit.id : null; // a bare number is ambiguous: caller must pick
}

export function parseListingInput(input: string, sourceHint: string | null) {
    const raw = String(input || "").trim();
    if (!raw) throw new ImportError("invalid_input");
    if (/^https?:\/\//i.test(raw) && !detectSource(raw)) throw new ImportError("unsupported_source");
    const provider = providerById(detectSource(raw) || sourceHint);
    if (!provider) throw new ImportError("invalid_input");
    const parsed = provider.parse(raw);
    if (!parsed) throw new ImportError("invalid_input");
    return { ...parsed, providerLabel: provider.label, prefix: provider.prefix };
}

type ParsedWithLabel = ReturnType<typeof parseListingInput>;

/* ---- transport: the extension reads the portal's own listing page ---- */

/* Both portals serve a watermarked image at the plain URL and an
   unwatermarked one at the same path with a suffix before the extension --
   myhome lowercase, ss.ge capital T. Confirmed against live examples. */
const EXT_RE = /(\.[a-zA-Z0-9]+)(\?.*)?$/;
const myhomeUnwatermarked = (url: string) => url.replace(EXT_RE, "_thumb$1$2");
const ssUnwatermarked = (url: string) => url.replace(EXT_RE, "_Thumb$1$2");
const MAX_IMPORT_PHOTOS = 16;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untrusted portal JSON, every field is checked where read
type Raw = Record<string, any>;

const previewImages = (images: { url: string; order: number }[], unwatermark: (u: string) => string) =>
    images.slice(0, MAX_IMPORT_PHOTOS).map((im) => ({ url: unwatermark(im.url), order: im.order }));

function toMyhomePreview(statement: Raw): Record<string, unknown> {
    const typeAndDealText = String(statement.href_lang?.en || statement.dynamic_title || "").replace(/-/g, " ");
    const images = Array.isArray(statement.images) ? statement.images.map((im: Raw, i: number) => ({ url: im.large, order: i })) : [];
    return {
        simulated: false,
        title: statement.dynamic_title || null,
        propertyType: typeAndDealText || null,
        dealType: typeAndDealText || null,
        // MyHome sends the same price in every currency; price[2] is USD.
        price: statement.price?.[2]?.price_total ?? (statement.currency_id === 2 ? statement.total_price : null) ?? null,
        currency: "USD",
        city: statement.city_id === 1 ? "Tbilisi" : statement.city_name || null,
        district: statement.urban_name || statement.district_name || null,
        address: statement.address || null,
        area: statement.area ?? null,
        rooms: null, // room_type_id is an undocumented enum; roomsFromTitle fills it in
        floor: statement.floor ?? null,
        totalFloors: statement.total_floors ?? null,
        condition: statement.condition || null,
        description: statement.comment || null,
        features: Array.isArray(statement.parameters)
            ? statement.parameters.map((x: unknown) => (typeof x === "string" ? x : (x as Raw)?.display_name || (x as Raw)?.key)).filter(Boolean)
            : [],
        contactPhone: statement.user_phone_number || "",
        images: previewImages(images, myhomeUnwatermarked),
    };
}

const SS_FEATURE_FLAGS: Record<string, string> = {
    balcony: "Balcony", elevator: "Elevator", furniture: "Furnished", naturalGas: "Natural gas",
    heating: "Heating", hotWater: "Hot water", internet: "Internet", wiFi: "WiFi", tv: "TV",
    airConditioning: "Air conditioning", garage: "Garage", withPool: "Pool", securityAlarm: "Security alarm",
    ironDoor: "Iron door", cableTelevision: "Cable TV", washingMachine: "Washing machine", fridge: "Fridge",
    telephone: "Telephone", drinkingWater: "Drinking water", sewage: "Sewage", storage: "Storage",
    glazedWindows: "Glazed windows", basement: "Basement", electricity: "Electricity", water: "Water",
};

function toSsPreview(listing: Raw): Record<string, unknown> {
    const streetAddress = [listing.address?.streetTitle, listing.address?.streetNumber].filter(Boolean).join(" ");
    const images = Array.isArray(listing.appImages)
        ? listing.appImages.map((im: Raw, i: number) => ({ url: im.fileName, order: im.orderNo ?? i }))
        : [];
    return {
        simulated: false,
        title: listing.title || null,
        propertyType: listing.realEstateType || null,
        dealType: listing.realEstateDealType || null,
        price: listing.price?.priceUsd ?? null, // ss.ge always sends priceUsd too
        currency: "USD",
        city: listing.address?.cityTitle || null,
        district: listing.address?.subdistrictTitle || listing.address?.districtTitle || null,
        address: streetAddress || null,
        area: listing.totalArea ? Number(listing.totalArea) : null,
        rooms: listing.rooms ? Number(listing.rooms) : null,
        bedrooms: typeof listing.bedrooms === "number" ? listing.bedrooms : null,
        floor: listing.floor ? Number(listing.floor) : null,
        totalFloors: listing.floors ? Number(listing.floors) : null,
        condition: listing.state || null,
        description: listing.description?.ka || listing.description?.text || null,
        features: Object.entries(SS_FEATURE_FLAGS).filter(([key]) => listing[key] === true).map(([, label]) => label),
        // ss.ge does not mask this for anonymous requests, unlike myhome.
        contactPhone: listing.applicationPhones?.[0]?.phoneNumber || "",
        images: previewImages(images, ssUnwatermarked),
    };
}

const READERS: Record<string, { op: PortalOp; toPreview: (raw: Raw) => Record<string, unknown> }> = {
    "myhome.ge": { op: "myhome.getStatement", toPreview: toMyhomePreview },
    "ss.ge": { op: "ss.getListing", toPreview: toSsPreview },
};

async function fetchFromImportService(parsed: ParsedWithLabel, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const reader = READERS[parsed.provider];
    if (!reader) throw new ImportError("unsupported_source");
    if (!parsed.externalId) throw new ImportError("invalid_input");
    if (!IMPORT_AVAILABLE) throw new ImportError("service_unavailable");
    let res;
    try {
        res = await callPortal(reader.op, "", { id: parsed.externalId }, 30000);
    } catch (e) {
        // Extension missing or outdated, or the portal page couldn't be loaded.
        if (import.meta.env.DEV) console.warn("Import fetch failed", e);
        throw new ImportError("service_unavailable");
    }
    if (signal?.aborted) throw new ImportError("timeout");
    if (res.status === 404) throw new ImportError("not_found");
    if (res.status !== 200 || !res.data || typeof res.data !== "object") throw new ImportError("parse_failed");
    try {
        return reader.toPreview(res.data as Raw);
    } catch {
        throw new ImportError("parse_failed");
    }
}

export interface NormalizedImage { url: string; order: number }
export interface NormalizedListing {
    source: string; sourceRef: string | null; sourceUrl: string | null; externalId: string | null; simulated: boolean;
    title: string | null; type: string | null; dealType: string | null; price: number | null; currency: string | null;
    city: string | null; district: string | null; districtRaw: string | null; address: string | null;
    area: number | null; rooms: number | null; beds: number | null; baths: number | null;
    floor: number | null; floors: number | null; condition: string | null; description: string;
    features: string[]; contactPhone: string; images: NormalizedImage[]; raw: Record<string, unknown>;
}

/* ---- normalisation: external payload -> Agent OS property draft ---- */
function normalizeImported(rawListing: Record<string, unknown> | null | undefined, parsed: ParsedWithLabel): NormalizedListing {
    const r = rawListing || {};
    const rawImages = r.images;
    const images: NormalizedImage[] = Array.isArray(rawImages)
        ? rawImages
              .map((im: unknown, i: number) => {
                  const url = typeof im === "string" ? im : (im as { url?: string })?.url;
                  const order = typeof im === "object" && im !== null && "order" in im ? (im as { order?: number }).order ?? i : i;
                  return { url, order };
              })
              .filter((im): im is { url: string; order: number } => typeof im.url === "string" && /^(https?:\/\/|data:image\/)/i.test(im.url))
              .sort((a, b) => a.order - b.order)
        : [];
    return {
        source: parsed.providerLabel,
        sourceRef: parsed.externalId ? `${parsed.prefix}-${parsed.externalId}` : null,
        sourceUrl: parsed.externalUrl || null,
        externalId: parsed.externalId || null,
        simulated: Boolean(r.simulated),

        title: sanitizeText(r.title, 160) || null,
        type: mapValue(TYPE_MAP, r.propertyType),
        // checked first: "ქირავდება დღიურად" also contains the plain-rent word
        dealType: /daily|დღიურ|посуточ/i.test(String(r.dealType ?? "")) ? "Daily rent" : mapValue(DEAL_MAP, r.dealType),
        price: toNumber(r.price),
        currency: mapValue(CURRENCY_MAP, r.currency),
        city: sanitizeText(r.city, 60) || null,
        district: mapValue(DISTRICT_MAP, r.district),
        districtRaw: sanitizeText(r.district, 60) || null,
        address: sanitizeText(r.address, 120) || null,
        area: toNumber(r.area),
        rooms: toNumber(r.rooms) ?? roomsFromTitle(r.title),
        beds: toNumber(r.bedrooms),
        baths: toNumber(r.bathrooms),
        floor: toNumber(r.floor),
        floors: toNumber(r.totalFloors),
        condition: mapValue(CONDITION_MAP, r.condition),
        description: sanitizeText(r.description),
        features: Array.isArray(r.features) ? r.features.map((f) => sanitizeText(f, 40)).filter(Boolean).slice(0, 20) : [],
        contactPhone: sanitizeText(r.contactPhone, 40) || "",
        images,
        raw: r,
    };
}

/* The single entry point the UI uses. */
export async function importListing(
    input: string,
    sourceHint: string | null,
    { onStage, signal }: { onStage?: (s: string) => void; signal?: AbortSignal } = {},
): Promise<NormalizedListing> {
    const stage = (s: string) => onStage && onStage(s);
    stage("fetching");
    const parsed = parseListingInput(input, sourceHint);
    const listing = await fetchFromImportService(parsed, signal);
    stage("parsing");
    const normalized = normalizeImported(listing, parsed);
    stage("preparing");
    return normalized;
}

/* A public advert tells you nothing about cooperation or commission — those
   only become real after the agent speaks to whoever placed it. */
export const IMPORT_UNKNOWN_PRIVATE: Partial<Property> = {
    contactType: "Unknown", contactName: "", contactPhone: "", cooperates: "Unknown",
    commissionModel: "", commissionPct: "", negotiableTo: null, ownerNet: null, notes: "",
};

export const importStageText = (stage: string) =>
    stage === "fetching" || stage === "parsing" || stage === "preparing" ? t(`properties:import.stage.${stage}`) : "";

/* Turn a normalised import into the Agent OS property shape. Anything the
   portal could not tell us is left blank rather than defaulted. */
export function importToPropertyDraft(imported: NormalizedListing, id: string): Partial<Property> {
    // ss.ge sends "თბილისი", MyHome "Tbilisi": store one spelling.
    const city = !imported.city || TBILISI.test(imported.city) ? "Tbilisi" : imported.city;
    // A Tbilisi district we recognise, otherwise the portal's own wording
    // (a Batumi or Sololaki listing used to silently become "Vake").
    const district = (TBILISI.test(city) ? imported.district : null) || imported.districtRaw || imported.district || "";
    return {
        ...IMPORT_UNKNOWN_PRIVATE,
        id,
        type: imported.type || "Apartment",
        dealType: imported.dealType || "Sale",
        city,
        district,
        address: imported.address || imported.title || "",
        price: imported.price ?? ("" as unknown as number),
        portalPrice: imported.price ?? "",
        area: imported.area ?? ("" as unknown as number),
        rooms: imported.rooms ?? "",
        beds: imported.beds ?? "",
        baths: imported.baths ?? 1,
        floor: imported.floor ?? "",
        floors: imported.floors ?? "",
        condition: imported.condition || "Newly renovated",
        photos: imported.images.map((im) => im.url),
        source: imported.source,
        sourceRef: imported.sourceRef,
        sourceUrl: imported.sourceUrl,
        importedAt: TODAY,
        verifiedAt: TODAY,
        status: "needs_verification",
    };
}
