import type { ListingReference, MatchResult, Property, Requirement } from "../types";
import { normalizeModel } from "../data/constants";
import { daysAgo } from "./dates";
import { usd } from "./format";
import { t } from "../i18n";
import { enumLabel } from "../i18n/labels";

/* Callers quote listing IDs in whatever shape they read them: "1945621",
   "#1945621", "MH-1945621". Normalise before comparing. */
export const normRef = (v: unknown) =>
    String(v ?? "").toLowerCase().replace(/\s+/g, "").replace(/^#/, "").replace(/^(mh|ss)-/, "");
export const refMatches = (ref: unknown, query: string) => {
    const a = normRef(ref), b = normRef(query);
    if (!a || !b) return false;
    // 2 characters is enough to start narrowing during a live call; 1 would be noise
    return a === b || (b.length >= 2 && a.startsWith(b));
};
export const hasPortalListings = (p: Property) => Boolean(p.myHomeListingId || p.ssListingId);

/* Own stock is always yours. Incoming colleague stock belongs to the agency it
   was shared inside, so it disappears the moment you move agencies — and comes
   back if you move back, because it is filtered rather than destroyed. */
// BACKEND: authorization must enforce this server-side; keep this filter only
// as defence in depth. Shared records must omit private owner/commission fields.
export const isAccessibleProperty = (p: Property, currentAgency: string) => p.mine || p.agency === currentAgency;

/* The pasted import URL is always the SOURCE advert — the owner's or another
   agent's — never the user's own published listing. */
export function parsePortalListingUrl(url: string | null | undefined) {
    const raw = String(url || "").trim();
    if (!raw) return null;
    const isMyHome = /myhome\.ge/i.test(raw);
    const isSS = /(^|\/\/|\.)ss\.ge/i.test(raw);
    if (!isMyHome && !isSS) return null;
    const source = isMyHome ? "MyHome.ge" : "SS.ge";
    const prefix = isMyHome ? "MH" : "SS";
    const explicit = isMyHome ? raw.match(/\/pr\/(\d{4,})/i) : raw.match(/\/(?:real-estate|ad)\/[^/]*?(\d{5,})/i);
    let id = explicit ? explicit[1] : null;
    if (!id) {
        const runs = raw.match(/\d{5,}/g) || [];
        id = runs.sort((a, b) => b.length - a.length || raw.lastIndexOf(b) - raw.lastIndexOf(a))[0] || null;
    }
    return { source, sourceRef: id ? `${prefix}-${id}` : null, sourceUrl: raw };
}

/* Which identifier a query hit, or null. Used by Global Search and by the
   inquiry picker so the two never drift apart. */
export function matchedReference(p: Property, query: string): ListingReference | null {
    if (refMatches(p.myHomeListingId, query))
        return { type: "myhome", id: p.myHomeListingId, label: `MyHome #${p.myHomeListingId}` };
    if (refMatches(p.ssListingId, query))
        return { type: "ss", id: p.ssListingId, label: `SS.ge #${p.ssListingId}` };
    if (refMatches(p.sourceRef, query))
        return { type: "source", id: p.sourceRef as string, label: t("domain.sourceRef", { source: p.source, ref: p.sourceRef }) };
    return null;
}

/* Address/district/internal-ID hit, or a portal/source hit with its label. */
export function findPropertyMatch(p: Property, term: string): { property: Property; reference: ListingReference | null } | null {
    const t = String(term || "").trim().toLowerCase();
    if (!t) return null;
    if (p.address.toLowerCase().includes(t) || p.district.toLowerCase().includes(t)
        || enumLabel("district", p.district).toLowerCase().includes(t) || p.id.includes(t))
        return { property: p, reference: null };
    const reference = matchedReference(p, t);
    return reference ? { property: p, reference } : null;
}

/* Every identifier a property actually has — never invents missing ones. */
export const referenceOptions = (p: Property | null | undefined) =>
    !p
        ? []
        : [
              { value: "", label: t("domain.notSpecified") },
              { value: `internal|${p.id}`, label: t("domain.internalListing") },
              ...(p.sourceRef ? [{ value: `source|${p.sourceRef}`, label: t("domain.sourceRef", { source: p.source, ref: p.sourceRef }) }] : []),
              ...(p.myHomeListingId ? [{ value: `myhome|${p.myHomeListingId}`, label: `MyHome #${p.myHomeListingId}` }] : []),
              ...(p.ssListingId ? [{ value: `ss|${p.ssListingId}`, label: `SS.ge #${p.ssListingId}` }] : []),
          ];
export const portalListings = (p: Property) =>
    [
        { portal: "MyHome.ge", id: p.myHomeListingId, url: p.myHomeListingUrl },
        { portal: "SS.ge", id: p.ssListingId, url: p.ssListingUrl },
    ].filter((x) => x.id);

/* District shown in the active language; the stored value stays English. */
export const propTitle = (p: Property | null | undefined) =>
    (p ? `${enumLabel("district", p.district)} · ${p.address}` : t("domain.propertyRemoved"));

/* --- commission calculator (pure) --- */
export const clampPct = (v: unknown) => {
    const n = Number(v);
    return !isFinite(n) || n < 0 ? 0 : Math.min(n, 99);
};

/* What Agent OS suggests the agent should advertise, given the owner's price. */
export function recommendedListingPrice(commissionModel: string, commissionPct: unknown, portalPrice: unknown) {
    const portal = Number(portalPrice) || 0;
    const r = clampPct(commissionPct) / 100;
    if (normalizeModel(commissionModel) === "Commission Included") return Math.round(portal);
    return r >= 1 ? Math.round(portal) : Math.round(portal / (1 - r));
}

/* The least the OWNER is willing to take home — a starting suggestion only. */
export function recommendedOwnerFloor(commissionModel: string, commissionPct: unknown, portalPrice: unknown) {
    const portal = Number(portalPrice) || 0;
    const r = clampPct(commissionPct) / 100;
    if (normalizeModel(commissionModel) === "Commission Included") return Math.round(portal - portal * r);
    return Math.round(portal);
}

export interface PricingInput {
    commissionModel: string;
    commissionPct: unknown;
    portalPrice: unknown;
    price: unknown;
}

/* Reads the real current state of a property. `price` is the agent's public
   listing price — the single value used everywhere else in the app. */
export function calcPricing({ commissionModel, commissionPct, portalPrice, price }: PricingInput) {
    const model = normalizeModel(commissionModel);
    const pct = clampPct(commissionPct);
    const portal = Number(portalPrice) || 0;
    const listing = Number(price) || 0;

    if (model === "Commission Included") {
        const commissionAmount = Math.round((listing * pct) / 100);
        return {
            model, commissionPct: pct, portalPrice: portal, listingPrice: listing, commissionAmount,
            ownerReceives: listing - commissionAmount,
            recommendedPrice: recommendedListingPrice(model, pct, portal),
            explain: t("ui.calc.explainIncluded"),
        };
    }
    // Without the owner's price there is nothing to subtract: the commission
    // is unknown, not the whole listing price.
    const commissionAmount = portal ? Math.round(listing - portal) : null;
    return {
        model, commissionPct: pct, portalPrice: portal, listingPrice: listing, commissionAmount,
        ownerReceives: portal || null,
        recommendedPrice: recommendedListingPrice(model, pct, portal),
        explain: t("ui.calc.explainOnTop"),
    };
}

/* --- matching engine: deterministic, weighted, explainable --- */
// BACKEND: keep client-side for now. If it ever moves, reproduce this scoring
// exactly — the matched/diffs strings are shown verbatim to the agent.
export function runMatching(req: Requirement, properties: Property[]): MatchResult[] {
    const must = req.must || ({} as Requirement["must"]);
    const out: MatchResult[] = [];
    for (const p of properties) {
        if (p.deleted || p.status === "archived") continue;
        const matched: string[] = [], diffs: string[] = [];
        let penalty = 0, excluded: string | null = null;

        const locOk = !req.districts?.length || req.districts.includes(p.district);
        if (locOk) matched.push(enumLabel("district", p.district));
        else if (must.location) excluded = "location";
        else { penalty += 22; diffs.push(t("domain.match.differentDistrict", { district: enumLabel("district", p.district) })); }

        const beds = Number(req.beds) || 0;
        const pBeds = Number(p.beds) || 0;
        const bedsOk = !beds || pBeds >= beds;
        if (bedsOk) matched.push(t("domain.match.bedrooms", { count: pBeds }));
        else if (must.beds) excluded = excluded || "beds";
        else { penalty += 10 * (beds - pBeds); diffs.push(t("domain.match.bedroomsShort", { count: beds - pBeds })); }

        if (req.parking) {
            if (p.parking) matched.push(t("domain.match.parking"));
            else if (must.parking) excluded = excluded || "parking";
            else { penalty += 8; diffs.push(t("domain.match.noParking")); }
        }

        const budgetMin = Number(req.budgetMin) || 0;
        const budgetMax = Number(req.budgetMax) || 0;
        const price = Number(p.price) || 0;
        if (budgetMax && price > budgetMax) {
            if (must.budget) excluded = excluded || "budget";
            else {
                const over = price - budgetMax;
                penalty += Math.min(25, Math.round((over / budgetMax) * 110));
                diffs.push(t("domain.match.aboveBudget", { amount: usd(over) }));
            }
        } else if (budgetMin && price < budgetMin) {
            // Cheaper than the client wants usually means smaller or worse
            // than they expect: flagged, and lighter than going over.
            if (must.budget) excluded = excluded || "budget";
            else {
                const under = budgetMin - price;
                penalty += Math.min(15, Math.round((under / budgetMin) * 60));
                diffs.push(t("domain.match.belowBudget", { amount: usd(under) }));
            }
        } else if (budgetMin || budgetMax) matched.push(t("domain.match.withinBudget"));

        const areaMin = Number(req.areaMin) || 0;
        const areaMax = Number(req.areaMax) || 0;
        const area = Number(p.area) || 0;
        if (areaMin && area < areaMin) {
            if (must.area) excluded = excluded || "area";
            else {
                const short = areaMin - area;
                penalty += Math.min(20, Math.round((short / areaMin) * 180));
                diffs.push(t("domain.match.belowArea", { value: short }));
            }
        } else if (areaMax && area > areaMax) {
            if (must.area) excluded = excluded || "area";
            else {
                const extra = area - areaMax;
                penalty += Math.min(12, Math.round((extra / areaMax) * 60));
                diffs.push(t("domain.match.aboveArea", { value: extra }));
            }
        } else if (areaMin || areaMax) matched.push(t("format.area", { value: p.area }));

        if (req.propertyType && req.propertyType !== "Any" && p.type !== req.propertyType) {
            penalty += 12; diffs.push(t("domain.match.typeIs", { type: enumLabel("propertyType", p.type) }));
        }

        const age = daysAgo(p.verifiedAt);
        if (p.status === "needs_verification") { penalty += 4; diffs.push(t("domain.match.needsVerification")); }
        else if (age > 21) { penalty += 2; diffs.push(t("domain.match.lastVerified", { count: age })); }

        if (excluded) continue;
        out.push({ property: p, score: Math.max(40, 100 - penalty), matched, diffs });
    }
    return out.sort((a, b) => b.score - a.score || (Number(a.property.price) || 0) - (Number(b.property.price) || 0));
}
