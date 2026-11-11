import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    AlertTriangle, Lock, Share2, Eye, Check, X, MessageCircle, Puzzle, Download, RefreshCw, Copy,
} from "lucide-react";
import type { Client, ColleagueRequirement, Inquiry, Property, Requirement, Task } from "../types";
import { useApp } from "../store/store";
import { t as tg } from "../i18n";
import { enumLabel, enumOptions } from "../i18n/labels";
import {
    ARCHIVE_REASONS, BUILDING_TYPES, CONDITIONS, CONTACT_TYPES, COMMISSION_MODELS, DISTRICTS, PROPERTY_TYPES, districtOptions,
} from "../data/constants";
import { createProperty } from "../data/defaults";
import { newId } from "../lib/http";
import { TODAY } from "../lib/dates";
import {
    calcPricing, propTitle, recommendedListingPrice, recommendedOwnerFloor, referenceOptions, runMatching,
} from "../lib/domain";
import { usd, usdRange, initials, whatsappLink } from "../lib/format";
import { portalPairError } from "../lib/photo";
import { Badge, ConfirmDialog, Field, Input, Modal, Photo, ScoreRing, Select, Stat, Textarea, Toggle, PriceCalculator } from "./ui";
import { PhotoUploader, PortalRow, PropertyPicker, type PropertyPick } from "./property";
import { publishStatementWithPhotos, publishSsApplication, type PublishSsResult, type PublishStatementResult } from "../lib/api";
import {
    MYHOME_PROJECT_TYPES, PORTAL_LABEL, buildMyhomeFields, buildSsApplication, defaultDescription, myhomeListingIdFrom, myhomeListingUrl,
    myhomeStreetName, normalizePhone, publishBlockers, ssListingUrl, streetNumberFrom,
    type MyhomeLocation, type Portal, type PublishContact, type SsStreet,
} from "../lib/publish";
import { findDistrictLocationId, getSsStreets, getUsdGelRate, searchMyhomeLocations } from "../lib/portalLookups";
import { EXTENSION_DOWNLOAD_URL, isExtensionCapableBrowser, isExtensionInstalled } from "../lib/extension";

export function PropertyFormModal({
    initial, onClose, afterSave, mode,
}: { initial?: Partial<Property>; onClose: () => void; afterSave?: (id: string | null) => void; mode?: "import" }) {
    const { t } = useTranslation(["modals", "common"]);
    const { api, properties, nav, readOnly } = useApp();
    const isNew = !properties.some((x) => x.id === initial?.id);
    const [f, setF] = useState(() =>
        createProperty({
            id: initial?.id || newId(), // placeholder; Postgres assigns the real id on create
            // Blank until the agent fills it in: a default here would be saved as fact.
            district: "", address: "", price: "" as unknown as number, area: "" as unknown as number,
            rooms: "" as unknown as number, beds: "" as unknown as number, baths: "" as unknown as number, floor: "" as unknown as number, floors: "" as unknown as number, balcony: false,
            photos: [], verifiedAt: TODAY, contactName: "", contactPhone: "",
            myHomeListingId: "", myHomeListingUrl: "", ssListingId: "", ssListingUrl: "",
            portalPrice: "" as unknown as number, ownerNet: "" as unknown as number,
            ...initial,
        }),
    );
    const [err, setErr] = useState<Record<string, string | null>>({});
    const [tab, setTab] = useState<"Property" | "Owner & Commission">("Property");
    // A field's error goes away as soon as the agent edits that field.
    const ERR_KEY: Partial<Record<string, string>> = { myHomeListingId: "myHome", myHomeListingUrl: "myHome", ssListingId: "ss", ssListingUrl: "ss" };
    const clearErr = (k: string) => setErr((e) => {
        const key = ERR_KEY[k] || k;
        return e[key] ? { ...e, [key]: null } : e;
    });
    const set = (k: keyof Property) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        clearErr(k as string);
        setF((s) => ({ ...s, [k]: e.target.value }));
    };
    const setN = (k: keyof Property) => (e: React.ChangeEvent<HTMLInputElement>) => {
        clearErr(k as string);
        // Keeps a minus sign so a negative number is rejected, not flipped.
        setF((s) => ({ ...s, [k]: e.target.value === "" ? "" : Number(String(e.target.value).replace(/[^0-9.-]/g, "")) }));
    };

    const initialPortals = useRef({
        mh: [String(initial?.myHomeListingId || ""), String(initial?.myHomeListingUrl || "")],
        ss: [String(initial?.ssListingId || ""), String(initial?.ssListingUrl || "")],
    });
    const portalRowEdited = (id: unknown, url: unknown, original: string[]) =>
        String(id || "") !== original[0] || String(url || "") !== original[1];

    const [priceTouched, setPriceTouched] = useState(false);
    const [floorTouched, setFloorTouched] = useState(
        () => initial?.negotiableTo !== null && initial?.negotiableTo !== undefined && initial?.negotiableTo !== ("" as unknown),
    );

    const num = (v: string) => (v === "" ? ("" as unknown as number) : Number(String(v).replace(/[^0-9.]/g, "")));
    const setPrice = (e: React.ChangeEvent<HTMLInputElement>) => { setPriceTouched(true); clearErr("price"); setF((s) => ({ ...s, price: num(e.target.value) })); };
    const setFloor = (e: React.ChangeEvent<HTMLInputElement>) => { setFloorTouched(true); setF((s) => ({ ...s, negotiableTo: num(e.target.value) })); };

    const repriceOn = (patch: Partial<Property>) =>
        setF((s) => {
            const merged = { ...s, ...patch };
            const portal = Number(merged.portalPrice) || 0;
            const out: Partial<Property> = { ...patch };
            if (portal) {
                if (!priceTouched) out.price = recommendedListingPrice(merged.commissionModel, merged.commissionPct, portal);
                if (!floorTouched) out.negotiableTo = recommendedOwnerFloor(merged.commissionModel, merged.commissionPct, portal);
            }
            return { ...s, ...out };
        });

    const dup = useMemo(
        () => properties.find((p) => !p.deleted && p.id !== f.id && p.district === f.district && p.address.toLowerCase().trim() === String(f.address).toLowerCase().trim() && f.address),
        [f.address, f.district, properties, f.id],
    );

    const [saving, setSaving] = useState(false);
    const save = async () => {
        const e: Record<string, string | null> = {};
        if (!f.address.trim()) e.address = t("property.errAddress");
        if (!f.district) e.district = t("property.errDistrict");
        if (!f.price) e.price = t("property.errPriceRequired");
        else if (!(Number(f.price) > 0)) e.price = t("property.errPricePositive");
        if (!f.area) e.area = t("property.errAreaRequired");
        else if (!(Number(f.area) > 0)) e.area = t("property.errAreaPositive");
        const myHome = portalRowEdited(f.myHomeListingId, f.myHomeListingUrl, initialPortals.current.mh) ? portalPairError(f.myHomeListingId, f.myHomeListingUrl) : null;
        const ss = portalRowEdited(f.ssListingId, f.ssListingUrl, initialPortals.current.ss) ? portalPairError(f.ssListingId, f.ssListingUrl) : null;
        if (myHome) e.myHome = myHome;
        if (ss) e.ss = ss;
        setErr(e);
        if (Object.values(e).some(Boolean)) { setTab("Property"); return; }
        setSaving(true);
        const id = await api.saveProperty({
            ...f, price: Number(f.price), area: Number(f.area),
            portalPrice: f.portalPrice === "" ? null : Number(f.portalPrice),
            ownerNet: f.ownerNet === "" ? null : Number(f.ownerNet),
        });
        setSaving(false);
        if (!id) return; // save failed — error already toasted, stay on the form
        onClose();
        if (afterSave) afterSave(id); else if (isNew && id) nav("property", { id });
    };

    return (
        <Modal wide
            title={mode === "import" ? t("property.titleImport") : isNew ? t("property.titleAdd") : t("property.titleEdit", { title: propTitle(f) })}
            subtitle={mode === "import"
                ? t("property.subtitleImport")
                : isNew ? t("property.subtitleAdd") : null}
            onClose={onClose}
            footer={<>
                <button className="btn btn-secondary" onClick={onClose} disabled={saving}>{t("common:actions.cancel")}</button>
                <button className="btn btn-primary" onClick={save} disabled={saving}>
                    {saving ? t("common:actions.saving") : isNew ? t("property.saveProperty") : t("form.saveChanges")}
                </button>
            </>}>
            <div className="tabs" style={{ marginBottom: 14 }}>
                {(["Property", "Owner & Commission"] as const).map((k) => (
                    <button key={k} className={`tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>{k === "Property" ? t("property.tabProperty") : t("property.tabOwner")}</button>
                ))}
            </div>

            {tab === "Property" ? (
                <>
                    <div className="form-grid">
                        <Field label={t("property.district")} error={err.district}><Select value={f.district} onChange={set("district")} options={f.district ? enumOptions("district", districtOptions(f.district)) : [{ value: "", label: t("property.chooseDistrict") }, ...enumOptions("district", districtOptions())]} /></Field>
                        <Field label={t("property.address")} error={err.address}><Input value={f.address ?? ""} onChange={set("address")} placeholder={t("property.addressPlaceholder")} error={!!err.address} maxLength={200} /></Field>
                        <Field label={t("property.price")} error={err.price} hint={t("property.priceHint")}>
                            <Input value={f.price ?? ""} onChange={setPrice} placeholder="168000" error={!!err.price} />
                        </Field>
                        <Field label={t("property.area")} error={err.area}><Input value={f.area ?? ""} onChange={setN("area")} placeholder="92" error={!!err.area} /></Field>
                        <Field label={t("form.rooms")}><Input value={f.rooms ?? ""} onChange={setN("rooms")} /></Field>
                        <Field label={t("form.bedrooms")}><Input value={f.beds ?? ""} onChange={setN("beds")} /></Field>
                        <Field label={t("property.bathrooms")}><Input value={f.baths ?? ""} onChange={setN("baths")} /></Field>
                        <Field label={t("form.dealType")}><Select value={f.dealType} onChange={set("dealType")} options={enumOptions("dealType", ["Sale", "Rent", "Daily rent"])} /></Field>
                        <Field label={t("property.floor")}><Input value={f.floor ?? ""} onChange={setN("floor")} /></Field>
                        <Field label={t("property.totalFloors")}><Input value={f.floors ?? ""} onChange={setN("floors")} /></Field>
                        <Field label={t("form.propertyType")}><Select value={f.type} onChange={set("type")} options={enumOptions("propertyType", PROPERTY_TYPES)} /></Field>
                        <Field label={t("form.condition")}><Select value={f.condition} onChange={set("condition")} options={enumOptions("condition", CONDITIONS)} /></Field>
                        <Field label={t("property.buildingType")}><Select value={f.buildingType} onChange={set("buildingType")} options={enumOptions("buildingType", BUILDING_TYPES)} /></Field>
                        <Field label={t("form.status")}>
                            <Select value={f.status} onChange={set("status")} options={enumOptions("propertyStatus", ["active", "needs_verification"])} />
                        </Field>
                    </div>
                    <Toggle label={t("property.parking")} on={!!f.parking} onChange={(v) => setF((s) => ({ ...s, parking: v }))} />
                    <Toggle label={t("property.balcony")} on={!!f.balcony} onChange={(v) => setF((s) => ({ ...s, balcony: v }))} />
                    <div style={{ marginTop: 16 }}>
                        <PhotoUploader photos={f.photos || []} toast={api.toast} disabled={readOnly} propertyId={isNew ? undefined : f.id}
                            onChange={(next) => setF((s) => ({ ...s, photos: next }))} />
                    </div>

                    <div style={{ marginTop: 6 }}>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-soft)", marginBottom: 5 }}>{t("property.myListings")}</label>
                        <div className="form-note" style={{ marginBottom: 9 }}>
                            {t("property.myListingsNote")}
                        </div>
                        <PortalRow portal="MyHome.ge" hint="1945621" disabled={readOnly} idValue={f.myHomeListingId} urlValue={f.myHomeListingUrl} error={err.myHome}
                            onId={set("myHomeListingId")} onUrl={set("myHomeListingUrl")} />
                        <PortalRow portal="SS.ge" hint="8123456" disabled={readOnly} idValue={f.ssListingId} urlValue={f.ssListingUrl} error={err.ss}
                            onId={set("ssListingId")} onUrl={set("ssListingUrl")} />
                    </div>
                    {dup && (
                        <div className="card card-pad" style={{ background: "var(--amber-tint)", border: "none", marginTop: 14 }}>
                            <div className="row fs-12 bold" style={{ color: "var(--amber)" }}><AlertTriangle size={14} /> {t("property.dupTitle")}</div>
                            <div className="fs-12" style={{ color: "var(--amber)", marginTop: 5, lineHeight: 1.5 }}>
                                {t("property.dupBody", { title: propTitle(dup) })}
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <>
                    <div className="row" style={{ gap: 7, marginBottom: 12 }}>
                        <Badge tone="brick" icon={<Lock size={11} />}>{t("property.privateBadge")}</Badge>
                    </div>
                    <div className="form-grid">
                        <Field label={t("property.contactType")}><Select value={f.contactType} onChange={set("contactType")} options={enumOptions("contactType", CONTACT_TYPES)} /></Field>
                        <Field label={t("property.contactName")}><Input value={f.contactName || ""} onChange={set("contactName")} placeholder={t("property.contactNamePlaceholder")} /></Field>
                        <Field label={t("form.phone")}><Input value={f.contactPhone || ""} onChange={set("contactPhone")} placeholder="+995 5XX XX XX XX" /></Field>
                        <Field label={t("property.cooperates")}><Select value={f.cooperates} onChange={set("cooperates")} options={enumOptions("yesNo", ["Yes", "No", "Unknown"])} /></Field>
                    </div>

                    <div className="eyebrow" style={{ margin: "6px 0 9px" }}>{t("property.pricing")}</div>
                    <div className="form-grid">
                        <Field label={t("property.commissionModel")}>
                            <Select value={f.commissionModel || ""}
                                options={f.commissionModel ? enumOptions("commissionModel", COMMISSION_MODELS) : [{ value: "", label: t("property.notConfirmed") }, ...enumOptions("commissionModel", COMMISSION_MODELS)]}
                                onChange={(e) => repriceOn({ commissionModel: e.target.value })} />
                        </Field>
                        <Field label={t("property.commissionPct")}>
                            <Input value={f.commissionPct ?? ""} onChange={(e) => repriceOn({ commissionPct: num(e.target.value) })} />
                        </Field>
                        <Field label={t("property.portalPrice")} hint={t("property.portalPriceHint")}>
                            <Input value={f.portalPrice ?? ""} placeholder="100000" onChange={(e) => repriceOn({ portalPrice: num(e.target.value) })} />
                        </Field>
                        <Field label={t("property.myListingPrice")} hint={t("property.myListingPriceHint")}>
                            <Input value={f.price ?? ""} onChange={setPrice} placeholder="103093" />
                        </Field>
                        <Field label={t("property.negotiableTo")} hint={t("property.negotiableToHint")}>
                            <Input value={f.negotiableTo ?? ""} onChange={setFloor} placeholder="100000" />
                        </Field>
                        <Field label={t("property.commissionAmount")} hint={t("property.commissionAmountHint")}>
                            <Input value={usd(calcPricing(f).commissionAmount)} disabled readOnly />
                        </Field>
                    </div>
                    <Field label={t("property.privateNotes")} hint={t("property.privateNotesHint")}>
                        <Textarea value={f.notes || ""} onChange={set("notes")} placeholder={t("property.privateNotesPlaceholder")} />
                    </Field>
                    <div style={{ marginTop: 6 }}>
                        <PriceCalculator model={f.commissionModel} pct={f.commissionPct} portal={f.portalPrice} price={f.price} />
                    </div>
                </>
            )}
        </Modal>
    );
}

export function ClientFormModal({
    initial, onClose, afterSave,
}: { initial?: Partial<Client>; onClose: () => void; afterSave?: (id: string | null) => void }) {
    const { t } = useTranslation(["modals", "common"]);
    const { api, nav } = useApp();
    const isNew = !initial?.id;
    const [f, setF] = useState({ name: "", phone: "+995 ", status: "active" as Client["status"], notes: "", ...initial });
    const [err, setErr] = useState<Record<string, string>>({});
    const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setErr((x) => { const rest = { ...x }; delete rest[k as string]; return rest; });
        setF((s) => ({ ...s, [k]: e.target.value }));
    };
    const save = () => {
        const e: Record<string, string> = {};
        if (!f.name.trim()) e.name = t("client.errName");
        if (f.phone.replace(/\D/g, "").length < 9) e.phone = t("form.phoneFormat");
        setErr(e);
        if (Object.keys(e).length) return;
        if (isNew) {
            const id = api.addClient(f);
            onClose();
            if (afterSave) afterSave(id); else nav("client", { id });
        } else {
            api.updateClient(f as Client);
            onClose();
        }
    };
    return (
        <Modal title={isNew ? t("client.titleAdd") : t("client.titleEdit")} onClose={onClose}
            subtitle={isNew ? t("client.subtitleAdd") : null}
            footer={<><button className="btn btn-secondary" onClick={onClose}>{t("common:actions.cancel")}</button>
                <button className="btn btn-primary" onClick={save}>{isNew ? t("client.saveClient") : t("form.saveChanges")}</button></>}>
            <Field label={t("client.fullName")} error={err.name}><Input value={f.name} onChange={set("name")} placeholder={t("client.namePlaceholder")} error={!!err.name} /></Field>
            <Field label={t("form.phone")} error={err.phone}><Input value={f.phone} onChange={set("phone")} placeholder="+995 599 44 21 08" error={!!err.phone} /></Field>
            <Field label={t("form.status")}>
                <Select value={f.status} onChange={set("status")} options={enumOptions("lifecycle", ["active", "paused", "closed"])} />
            </Field>
            <Field label={t("form.notes")}><Textarea value={f.notes} onChange={set("notes")} placeholder={t("client.notesPlaceholder")} /></Field>
        </Modal>
    );
}

export function TaskFormModal({ initial, onClose }: { initial?: Partial<Task>; onClose: () => void }) {
    const { t } = useTranslation(["modals", "common"]);
    const { api, clients, properties } = useApp();
    const isNew = !initial?.id;
    const [f, setF] = useState({ title: "", type: "Call", date: TODAY, time: "10:00", clientId: "", propertyId: "", notes: "", ...initial });
    const [err, setErr] = useState<{ title?: string }>({});
    const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        if (k === "title") setErr({});
        setF((s) => ({ ...s, [k]: e.target.value }));
    };

    const taskProperties = useMemo(() => properties.filter((p) => !p.deleted), [properties]);
    const [pick, setPick] = useState<PropertyPick | null>(() =>
        initial?.propertyId && properties.some((p) => !p.deleted && p.id === initial.propertyId)
            ? { id: initial.propertyId, reference: null } : null,
    );
    const orphaned = Boolean(initial?.propertyId) && !pick;

    const save = () => {
        if (!f.title.trim()) { setErr({ title: t("task.errTitle") }); return; }
        const payload = { ...f, clientId: f.clientId || null, propertyId: pick ? pick.id : null };
        if (isNew) api.addTask(payload); else api.updateTask(payload as Task);
        onClose();
    };
    return (
        <Modal title={isNew ? t("task.titleAdd") : t("task.titleEdit")} onClose={onClose}
            footer={<><button className="btn btn-secondary" onClick={onClose}>{t("common:actions.cancel")}</button>
                <button className="btn btn-primary" onClick={save}>{isNew ? t("task.createTask") : t("form.saveChanges")}</button></>}>
            <Field label={t("task.title")} error={err.title}><Input value={f.title} onChange={set("title")} placeholder={t("task.titlePlaceholder")} error={!!err.title} /></Field>
            <div className="form-grid">
                <Field label={t("task.type")}><Select value={f.type} onChange={set("type")} options={enumOptions("taskType", ["Call", "Follow-up", "Meeting", "Verification", "Other"])} /></Field>
                <Field label={t("task.date")}><Input type="date" value={f.date} onChange={set("date")} /></Field>
                <Field label={t("task.time")}><Input type="time" value={f.time} onChange={set("time")} /></Field>
                <Field label={t("task.relatedClient")}>
                    <Select value={f.clientId || ""} onChange={set("clientId")} options={[{ value: "", label: t("task.none") }, ...clients.map((c) => ({ value: c.id, label: c.name }))]} />
                </Field>
            </div>
            <Field label={t("task.relatedProperty")} hint={pick ? null : t("task.relatedPropertyHint")}>
                <PropertyPicker properties={taskProperties} value={pick} placeholder={t("task.propertyPlaceholder")} onSelect={(next) => setPick(next)} />
            </Field>
            {orphaned && (
                <div className="fs-12" style={{ color: "var(--amber)", marginTop: -6, marginBottom: 12, lineHeight: 1.5 }}>
                    {t("task.orphaned")}
                </div>
            )}
            <Field label={t("form.notes")}><Textarea value={f.notes} onChange={set("notes")} /></Field>
        </Modal>
    );
}

export function RequirementFormModal({
    initial, clientId, onClose, afterSave,
}: { initial?: Partial<Requirement>; clientId?: string; onClose: () => void; afterSave?: (id: string | null) => void }) {
    const { t } = useTranslation(["modals", "common"]);
    const { api } = useApp();
    const isNew = !initial?.id;
    const [f, setF] = useState(() => ({
        dealType: "Sale", status: "active" as Requirement["status"], shared: false, propertyType: "Apartment",
        condition: "Any", floorPref: "Any", parking: false, notes: "",
        must: { location: true, budget: false, area: false, beds: false, parking: false },
        clientId, name: "", districts: [] as string[], budgetMin: "" as unknown as number, budgetMax: "" as unknown as number,
        areaMin: "" as unknown as number, areaMax: "" as unknown as number, rooms: "" as unknown as number, beds: "" as unknown as number,
        ...initial,
    }));
    const [err, setErr] = useState<{ name?: string; districts?: string }>({});
    const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        if (k === "name") setErr((x) => ({ ...x, name: undefined }));
        setF((s) => ({ ...s, [k]: e.target.value }));
    };
    const setN = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setF((s) => ({ ...s, [k]: e.target.value === "" ? "" : Number(String(e.target.value).replace(/[^0-9.]/g, "")) }));
    const toggleDistrict = (d: string) => {
        setErr((x) => ({ ...x, districts: undefined }));
        setF((s) => ({ ...s, districts: s.districts.includes(d) ? s.districts.filter((x) => x !== d) : [...s.districts, d] }));
    };
    const setMust = (k: keyof typeof f.must, v: boolean) => setF((s) => ({ ...s, must: { ...s.must, [k]: v } }));
    const save = () => {
        const e: { name?: string; districts?: string } = {};
        if (!f.name.trim()) e.name = t("requirement.errName");
        if (!f.districts.length) e.districts = t("requirement.errDistricts");
        setErr(e);
        if (Object.keys(e).length) return;
        const id = api.saveRequirement({
            ...f, budgetMin: Number(f.budgetMin) || null, budgetMax: Number(f.budgetMax) || null,
            areaMin: Number(f.areaMin) || null, areaMax: Number(f.areaMax) || null,
        });
        onClose();
        if (afterSave) afterSave(id);
    };
    return (
        <Modal wide title={isNew ? t("requirement.titleNew") : t("requirement.titleEdit")} onClose={onClose}
            subtitle={t("requirement.subtitle")}
            footer={<><button className="btn btn-secondary" onClick={onClose}>{t("common:actions.cancel")}</button>
                <button className="btn btn-primary" onClick={save}>{isNew ? t("requirement.createRequirement") : t("form.saveChanges")}</button></>}>
            <div className="form-grid">
                <Field label={t("requirement.name")} error={err.name}><Input value={f.name} onChange={set("name")} placeholder={t("requirement.namePlaceholder")} error={!!err.name} /></Field>
                <Field label={t("form.dealType")}><Select value={f.dealType} onChange={set("dealType")} options={enumOptions("dealType", ["Sale", "Rent"])} /></Field>
            </div>
            <Field label={t("requirement.districts")} error={err.districts}>
                <div className="row wrap" style={{ gap: 6 }}>
                    {DISTRICTS.map((d) => (
                        <button key={d} className={`chip ${f.districts.includes(d) ? "on" : ""}`} onClick={() => toggleDistrict(d)}>{enumLabel("district", d)}</button>
                    ))}
                </div>
            </Field>
            <div className="form-grid">
                <Field label={t("requirement.budgetMin")}><Input value={f.budgetMin ?? ""} onChange={setN("budgetMin")} placeholder="150000" /></Field>
                <Field label={t("requirement.budgetMax")}><Input value={f.budgetMax ?? ""} onChange={setN("budgetMax")} placeholder="180000" /></Field>
                <Field label={t("requirement.areaMin")}><Input value={f.areaMin ?? ""} onChange={setN("areaMin")} placeholder="80" /></Field>
                <Field label={t("requirement.areaMax")}><Input value={f.areaMax ?? ""} onChange={setN("areaMax")} placeholder={t("requirement.optional")} /></Field>
                <Field label={t("form.rooms")}><Input value={f.rooms ?? ""} onChange={setN("rooms")} /></Field>
                <Field label={t("form.bedrooms")}><Input value={f.beds ?? ""} onChange={setN("beds")} /></Field>
                <Field label={t("form.propertyType")}><Select value={f.propertyType} onChange={set("propertyType")} options={enumOptions("propertyType", ["Any", ...PROPERTY_TYPES])} /></Field>
                <Field label={t("form.condition")}><Select value={f.condition} onChange={set("condition")} options={enumOptions("condition", ["Any", ...CONDITIONS])} /></Field>
                <Field label={t("requirement.floorPref")}><Select value={f.floorPref} onChange={set("floorPref")} options={enumOptions("floorPref", ["Any", "Not ground floor", "Not top floor", "Above 3rd floor"])} /></Field>
            </div>
            <Toggle label={t("requirement.parkingNeeded")} on={!!f.parking} onChange={(v) => setF((s) => ({ ...s, parking: v }))} />
            <div style={{ marginTop: 16 }}>
                <div className="section-title" style={{ marginBottom: 4 }}>{t("requirement.whatCanBend")}</div>
                <div className="fs-12 muted" style={{ marginBottom: 8, lineHeight: 1.5 }}>
                    {t("requirement.whatCanBendBody")}
                </div>
                <Toggle label={t("requirement.mustLocation")} on={f.must.location} onChange={(v) => setMust("location", v)} />
                <Toggle label={t("requirement.mustBeds")} on={f.must.beds} onChange={(v) => setMust("beds", v)} />
                <Toggle label={t("requirement.mustParking")} on={f.must.parking} onChange={(v) => setMust("parking", v)} />
                <Toggle label={t("requirement.mustBudget")} on={f.must.budget} onChange={(v) => setMust("budget", v)} hint={t("requirement.mustBudgetHint")} />
                <Toggle label={t("requirement.mustArea")} on={f.must.area} onChange={(v) => setMust("area", v)} />
            </div>
            <Field label={t("requirement.otherPrefs")} hint={t("requirement.otherPrefsHint")}>
                <Textarea value={f.notes} onChange={set("notes")} placeholder={t("requirement.otherPrefsPlaceholder")} />
            </Field>
        </Modal>
    );
}

export function SharePropertyModal({ property, onClose }: { property: Property; onClose: () => void }) {
    const { t } = useTranslation(["modals", "common"]);
    const { api, settings } = useApp();
    const visible = [t("shareProperty.visible.photos"), t("shareProperty.visible.details"), t("shareProperty.visible.price"), t("shareProperty.visible.contact")];
    const hidden = [t("shareProperty.hidden.ownerName"), t("shareProperty.hidden.ownerPhone"), t("shareProperty.hidden.notes"), t("shareProperty.hidden.commission")];
    return (
        <Modal title={t("shareProperty.title", { agency: settings.agency })} onClose={onClose}
            subtitle={t("shareProperty.subtitle", { agency: settings.agency })}
            footer={<><button className="btn btn-secondary" onClick={onClose}>{t("common:actions.cancel")}</button>
                <button className="btn btn-teal" onClick={() => { api.shareProperty(property.id, true); onClose(); }}><Share2 size={14} /> {t("shareProperty.share")}</button></>}>
            <div className="card card-pad" style={{ marginBottom: 12 }}>
                <div className="row fs-12 bold" style={{ color: "var(--teal)", marginBottom: 8 }}><Eye size={14} /> {t("shareProperty.willSee")}</div>
                {visible.map((v) => <div className="row fs-13" key={v} style={{ gap: 7, marginBottom: 5 }}><Check size={13} color="var(--teal)" />{v}</div>)}
            </div>
            <div className="card card-pad" style={{ background: "var(--brick-tint)", border: "none" }}>
                <div className="row fs-12 bold" style={{ color: "var(--brick)", marginBottom: 8 }}><Lock size={14} /> {t("shareProperty.neverSee")}</div>
                {hidden.map((v) => <div className="row fs-13" key={v} style={{ gap: 7, marginBottom: 5, color: "var(--brick)" }}><X size={13} />{v}</div>)}
            </div>
        </Modal>
    );
}

export function ShareRequirementModal({ requirement, client, onClose }: { requirement: Requirement; client: Client; onClose: () => void }) {
    const { t } = useTranslation(["modals", "common"]);
    const { api, settings } = useApp();
    return (
        <Modal title={t("shareRequirement.title")} onClose={onClose}
            subtitle={t("shareRequirement.subtitle", { name: client.name })}
            footer={<><button className="btn btn-secondary" onClick={onClose}>{t("common:actions.cancel")}</button>
                <button className="btn btn-teal" onClick={() => { api.shareRequirement(requirement.id, true); onClose(); }}><Share2 size={14} /> {t("shareRequirement.share")}</button></>}>
            <div className="card card-pad" style={{ marginBottom: 12 }}>
                <div className="eyebrow" style={{ marginBottom: 7 }}>{t("shareRequirement.willSee", { agency: settings.agency })}</div>
                <div className="fs-13" style={{ lineHeight: 1.6 }}>
                    {[requirement.districts.map((d) => enumLabel("district", d)).join(", ") || t("shareRequirement.anyDistrict"), requirement.beds ? t("shareRequirement.bedrooms", { count: Number(requirement.beds) }) : null, usdRange(requirement.budgetMin, requirement.budgetMax)].filter(Boolean).join(" · ")}
                    {requirement.parking ? t("shareRequirement.parkingRequired") : ""}<br />
                    <span className="faint">{t("shareRequirement.sharedBy", { name: settings.profile.name })}{settings.profile.phone ? t("shareRequirement.yourPhone", { phone: settings.profile.phone }) : ""}</span>
                </div>
            </div>
            <div className="card card-pad" style={{ background: "var(--brick-tint)", border: "none" }}>
                <div className="row fs-12 bold" style={{ color: "var(--brick)", marginBottom: 8 }}><Lock size={14} /> {t("shareRequirement.hiddenTitle")}</div>
                {[t("shareRequirement.hidden.name"), t("shareRequirement.hidden.phone"), t("shareRequirement.hidden.notes"), t("shareRequirement.hidden.sent")].map((v) =>
                    <div className="row fs-13" key={v} style={{ gap: 7, marginBottom: 5, color: "var(--brick)" }}><X size={13} />{v}</div>)}
            </div>
        </Modal>
    );
}

export function ArchiveModal({ property, onClose }: { property: Property; onClose: () => void }) {
    const { t } = useTranslation(["modals", "common"]);
    const { api } = useApp();
    const [reason, setReason] = useState("Sold");
    return (
        <Modal title={t("archive.title", { title: propTitle(property) })} onClose={onClose}
            subtitle={t("archive.subtitle")}
            footer={<><button className="btn btn-secondary" onClick={onClose}>{t("common:actions.cancel")}</button>
                <button className="btn btn-primary" onClick={() => { api.archiveProperty(property.id, reason); onClose(); }}>{t("archive.archiveProperty")}</button></>}>
            <Field label={t("archive.reason")}><Select value={reason} onChange={(e) => setReason(e.target.value)} options={enumOptions("archiveReason", ARCHIVE_REASONS)} /></Field>
        </Modal>
    );
}

export function InquiryModal({ onClose }: { onClose: () => void }) {
    const { t } = useTranslation(["modals", "common"]);
    const { api, properties } = useApp();
    const [phone, setPhone] = useState("+995 ");
    const [pick, setPick] = useState<PropertyPick | null>(null);
    const [refValue, setRefValue] = useState("");
    const [note, setNote] = useState("");
    const [err, setErr] = useState<{ phone?: string }>({});

    const own = useMemo(() => properties.filter((p) => p.mine && !p.deleted), [properties]);
    const property = pick ? own.find((p) => p.id === pick.id) : null;

    const choose = (next: PropertyPick | null) => {
        setPick(next);
        setRefValue(next?.reference ? `${next.reference.type}|${next.reference.id}` : "");
    };

    const save = () => {
        if (phone.replace(/\D/g, "").length < 9) { setErr({ phone: t("form.phoneFormat") }); return; }
        let listingReference: Inquiry["listingReference"] = null;
        if (refValue && property) {
            const [type, id] = refValue.split("|");
            const opt = referenceOptions(property).find((o) => o.value === refValue);
            listingReference = { type: type as "myhome" | "ss" | "source" | "internal", id, label: opt ? opt.label : tg("domain.internalListing") };
        }
        api.addInquiry({ phone, propertyId: property ? property.id : null, listingReference, note });
        onClose();
    };

    return (
        <Modal title={t("inquiry.title")} onClose={onClose}
            subtitle={t("inquiry.subtitle")}
            footer={<><button className="btn btn-secondary" onClick={onClose}>{t("common:actions.cancel")}</button>
                <button className="btn btn-primary" onClick={save}>{t("inquiry.save")}</button></>}>
            <Field label={t("form.phone")} error={err.phone}>
                <Input value={phone} onChange={(e) => { setPhone(e.target.value); setErr({}); }} error={!!err.phone} />
            </Field>
            <Field label={t("inquiry.regarding")} hint={pick ? null : t("inquiry.regardingHint")}>
                <PropertyPicker properties={own} value={pick} onSelect={choose} />
            </Field>
            {property && (
                <Field label={t("inquiry.referenced")} hint={t("inquiry.referencedHint")}>
                    <Select value={refValue} onChange={(e) => setRefValue(e.target.value)} options={referenceOptions(property)} />
                </Field>
            )}
            <Field label={t("inquiry.note")}>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("inquiry.notePlaceholder")} />
            </Field>
        </Modal>
    );
}

export function ConvertInquiryModal({ inquiry, onClose }: { inquiry: Inquiry; onClose: () => void }) {
    const { t } = useTranslation(["modals", "common"]);
    const { api, nav } = useApp();
    const [name, setName] = useState("");
    const [err, setErr] = useState("");
    const convert = () => {
        if (!name.trim()) { setErr(t("convert.errName")); return; }
        const id = api.convertInquiry(inquiry.id, name.trim());
        onClose();
        nav("client", { id });
    };
    return (
        <Modal title={t("convert.title")} onClose={onClose}
            subtitle={t("convert.subtitle", { phone: inquiry.phone })}
            footer={<><button className="btn btn-secondary" onClick={onClose}>{t("common:actions.cancel")}</button>
                <button className="btn btn-primary" onClick={convert}>{t("convert.create")}</button></>}>
            <Field label={t("convert.name")} error={err}><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("convert.namePlaceholder")} error={!!err} /></Field>
        </Modal>
    );
}

export function ContactAgentModal({ agent, phone, property, onClose }: { agent: string; phone?: string | null; property?: Property | null; onClose: () => void }) {
    const { t } = useTranslation(["modals", "common"]);
    // Prefilled so the colleague knows which listing it's about.
    const link = whatsappLink(phone, property ? t("contactAgent.message", { name: agent.split(" ")[0], title: propTitle(property), price: usd(Number(property.price)) }) : undefined);
    return (
        <Modal title={t("contactAgent.title", { name: agent })} onClose={onClose}
            subtitle={t("contactAgent.subtitle")}
            footer={link
                ? <a className="btn btn-teal" href={link} target="_blank" rel="noopener noreferrer" onClick={onClose}><MessageCircle size={14} /> {t("contactAgent.openWhatsapp")}</a>
                : <button className="btn btn-secondary" onClick={onClose}>{t("common:actions.close")}</button>}>
            <div className="card card-pad row" style={{ gap: 12 }}>
                <div className="avatar md teal">{initials(agent)}</div>
                <div>
                    <div className="fs-14 bold">{agent}</div>
                    <div className="fs-13 muted">{phone || t("contactAgent.noPhone")}</div>
                    {property && <div className="fs-12 faint" style={{ marginTop: 4 }}>{t("contactAgent.about", { title: propTitle(property), price: usd(Number(property.price)) })}</div>}
                </div>
            </div>
        </Modal>
    );
}

export function ExtensionModal({ onClose }: { onClose: () => void }) {
    const { t } = useTranslation(["modals", "common"]);
    const [status, setStatus] = useState<"checking" | "installed" | "missing">("checking");
    const [copied, setCopied] = useState(false);
    const capable = isExtensionCapableBrowser();

    const check = async () => {
        setStatus("checking");
        setStatus((await isExtensionInstalled()) ? "installed" : "missing");
    };
    // Chrome only connects an extension to pages loaded after it was
    // installed, so a check without chrome.runtime needs a fresh page load.
    const checkAgain = () => {
        if (capable && !window.chrome?.runtime?.sendMessage) window.location.reload();
        else void check();
    };
    useEffect(() => { void check(); }, []);

    const copyUrl = () => {
        void navigator.clipboard?.writeText("chrome://extensions");
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const steps = [t("extension.step1"), t("extension.step2"), t("extension.step3"),
        t("extension.step4"), t("extension.step5"), t("extension.step6")];

    return (
        <Modal title={t("extension.title")} onClose={onClose}
            subtitle={t("extension.subtitle")}
            footer={status === "installed"
                ? <button className="btn btn-primary" onClick={onClose}>{t("extension.done")}</button>
                : <><button className="btn btn-secondary" onClick={onClose}>{t("extension.later")}</button>
                    <button className="btn btn-primary" disabled={status === "checking"} onClick={checkAgain}>
                        <RefreshCw size={14} />{t("extension.checkAgain")}</button></>}>
            <div className="row" style={{ gap: 8, marginBottom: 12 }}>
                {status === "installed"
                    ? <span className="badge badge-teal"><Check size={12} />{t("extension.statusInstalled")}</span>
                    : status === "missing"
                        ? <span className="badge badge-amber"><AlertTriangle size={12} />{t("extension.statusMissing")}</span>
                        : <span className="badge badge-navy">{t("extension.statusChecking")}</span>}
            </div>

            {!capable && (
                <div className="card card-pad fs-13" style={{ marginBottom: 12, background: "var(--amber-tint)", lineHeight: 1.5 }}>
                    {t("extension.unsupported")}
                </div>
            )}

            {status !== "installed" && (
                <>
                    <a className="btn btn-teal btn-block" href={EXTENSION_DOWNLOAD_URL} download="agentos-extension.zip" style={{ marginBottom: 14 }}>
                        <Download size={15} />{t("extension.download")}
                    </a>
                    <div className="card card-pad">
                        <div className="row" style={{ gap: 10, marginBottom: 10 }}><Puzzle size={18} color="var(--navy-2)" /><div className="fs-13 bold">{t("extension.stepsTitle")}</div></div>
                        {steps.map((s, i) => (
                            <div className="row fs-13" key={i} style={{ gap: 8, marginBottom: 8, alignItems: "flex-start", lineHeight: 1.5 }}>
                                <span className="badge badge-navy" style={{ minWidth: 18, justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                                <span className="grow">
                                    {s}
                                    {i === 2 && (
                                        <button className="btn btn-sm btn-secondary" style={{ marginLeft: 8 }} onClick={copyUrl}>
                                            {copied ? <Check size={12} /> : <Copy size={12} />}{copied ? t("extension.copied") : t("extension.copy")}
                                        </button>
                                    )}
                                </span>
                            </div>
                        ))}
                        <div className="fs-12 faint" style={{ marginTop: 10, lineHeight: 1.5 }}>{t("extension.updateNote")}</div>
                    </div>
                </>
            )}
        </Modal>
    );
}

export function ChangeAgencyModal({ onClose }: { onClose: () => void }) {
    const { t } = useTranslation(["modals", "common"]);
    const { api, settings, properties, requirements } = useApp();
    const [name, setName] = useState(settings.agency);
    const [code, setCode] = useState("");
    const [busy, setBusy] = useState(false);
    const shared = properties.filter((p) => p.mine && p.sharedWithAgency).length + requirements.filter((r) => r.shared).length;
    const submit = async () => {
        setBusy(true);
        const ok = await api.changeAgency(name.trim(), code.trim());
        setBusy(false);
        if (ok) onClose();
    };
    return (
        <Modal title={settings.agency ? t("agency.titleChange") : t("agency.titleJoin")} onClose={onClose}
            footer={<><button className="btn btn-secondary" onClick={onClose}>{t("common:actions.cancel")}</button>
                <button className="btn btn-primary" disabled={busy || !name.trim() || name.trim() === settings.agency} onClick={submit}>{settings.agency ? t("agency.titleChange") : t("agency.join")}</button></>}>
            <Field label={t("agency.name")}><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("agency.namePlaceholder")} /></Field>
            <Field label={t("agency.code")} hint={t("agency.codeHint")}>
                <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="A1B2C3D4" />
            </Field>
            <div className="card card-pad" style={{ background: "var(--amber-tint)", border: "none" }}>
                <div className="row fs-12 bold" style={{ color: "var(--amber)", marginBottom: 6 }}><AlertTriangle size={14} /> {t("agency.whatHappens")}</div>
                <div className="fs-13" style={{ color: "var(--amber)", lineHeight: 1.55 }}>
                    {settings.agency ? t("agency.unshared", { count: shared, agency: settings.agency }) : ""}
                    {t("agency.staysYours")}
                </div>
            </div>
        </Modal>
    );
}

export function ExportModal({ onClose }: { onClose: () => void }) {
    const { t } = useTranslation(["modals", "common"]);
    const { properties, clients, requirements, tasks, sent, settings, api } = useApp();
    const payload = useMemo(
        () => JSON.stringify({
            exportedAt: TODAY, agent: settings.profile, agency: settings.agency,
            properties: properties.filter((p) => p.mine), clients, requirements, tasks, sentProperties: sent,
        }, null, 2),
        [properties, clients, requirements, tasks, sent, settings],
    );

    const download = () => {
        try {
            const blob = new Blob([payload], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = "agent-os-export.json"; a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            api.toast(t("export.downloaded"));
        } catch {
            api.toast(t("export.copyInstead"), "warn");
        }
    };
    return (
        <Modal wide title={t("export.title")} onClose={onClose}
            subtitle={t("export.subtitle")}
            footer={<><button className="btn btn-secondary" onClick={onClose}>{t("common:actions.close")}</button>
                <button className="btn btn-primary" onClick={download}><Download size={14} /> {t("export.download")}</button></>}>
            <div className="grid-4" style={{ marginBottom: 12 }}>
                <Stat label={t("export.properties")} value={properties.filter((p) => p.mine).length} />
                <Stat label={t("export.clients")} value={clients.length} />
                <Stat label={t("export.requirements")} value={requirements.length} />
                <Stat label={t("export.sent")} value={sent.length} />
            </div>
            <pre style={{ background: "var(--surface-sunk)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, fontSize: 11, maxHeight: 190, overflow: "auto", margin: 0, color: "var(--text-soft)" }}>
                {payload.slice(0, 1400)}…
            </pre>
        </Modal>
    );
}

export function ColleagueMatchesModal({ req, onClose }: { req: ColleagueRequirement; onClose: () => void }) {
    const { t } = useTranslation(["modals", "common"]);
    const { properties } = useApp();
    const results = useMemo(() => {
        const asRequirement: Requirement = {
            id: req.id, clientId: "", name: "", status: "active", dealType: req.dealType,
            districts: req.districts, budgetMin: req.budgetMin, budgetMax: req.budgetMax, areaMin: req.areaMin, areaMax: req.areaMax,
            beds: req.beds ?? "", propertyType: req.propertyType || "Any", condition: "Any", floorPref: "Any", parking: req.parking, notes: "", shared: false,
            must: { location: true, beds: true, parking: false, budget: false, area: false },
        };
        return runMatching(asRequirement, properties.filter((p) => !p.deleted && p.mine)).slice(0, 4);
    }, [properties, req]);
    return (
        <Modal wide title={t("colleagueMatches.title", { name: req.agent })} onClose={onClose}
            subtitle={t("colleagueMatches.subtitle")}
            footer={<button className="btn btn-secondary" onClick={onClose}>{t("common:actions.close")}</button>}>
            {results.length === 0 ? (
                <div className="fs-13 muted" style={{ paddingBottom: 12 }}>{t("colleagueMatches.none")}</div>
            ) : results.map(({ property: p, score, diffs }) => (
                <div className="row" key={p.id} style={{ gap: 11, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                    <ScoreRing score={score} />
                    <Photo src={p.photos[0]} style={{ width: 62, height: 48, flexShrink: 0 }} radius={8} />
                    <div className="grow">
                        <div className="fs-13 bold">{propTitle(p)}</div>
                        <div className="fs-12 faint">{t("colleagueMatches.facts", { price: usd(Number(p.price)), area: p.area, count: Number(p.beds) || 0 })}</div>
                        {diffs[0] && <div className="fs-11" style={{ color: "var(--amber)", marginTop: 3 }}>{diffs[0]}</div>}
                    </div>
                </div>
            ))}
        </Modal>
    );
}

export function PublishListingModal({ property: p, portal, onClose }: { property: Property; portal: Portal; onClose: () => void }) {
    const { t } = useTranslation(["modals", "common"]);
    const { api, settings } = useApp();
    const label = PORTAL_LABEL[portal];
    const blockers = publishBlockers(p, portal);
    const [query, setQuery] = useState("");
    const [mhResults, setMhResults] = useState<MyhomeLocation[]>([]);
    const [mhStreet, setMhStreet] = useState<MyhomeLocation | null>(null);
    const [ssStreets, setSsStreets] = useState<SsStreet[]>([]);
    const [ssStreet, setSsStreet] = useState<SsStreet | null>(null);
    const [streetNumber, setStreetNumber] = useState(() => streetNumberFrom(p.address));
    const [description, setDescription] = useState(() => defaultDescription(p));
    const [projectType, setProjectType] = useState("8");
    // Prefilled from the agent's profile (Settings). It must be the number
    // the portal approved for this account.
    const [contact, setContact] = useState<PublishContact>(() => ({ name: settings.profile.name, phone: settings.profile.phone }));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [published, setPublished] = useState<{ id: string; url: string } | null>(null);

    useEffect(() => {
        if (portal !== "ss" || blockers.length) return;
        getSsStreets().then(setSsStreets).catch((e: Error) => setError(e.message));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [portal]);

    useEffect(() => {
        if (portal !== "myhome" || query.trim().length < 2 || mhStreet) { setMhResults([]); return; }
        const timer = setTimeout(() => {
            searchMyhomeLocations(query.trim())
                .then((items) => setMhResults(items.filter((x) => x.find_point === "streets" && x.identifiers.city_id === 1)))
                .catch((e: Error) => setError(e.message));
        }, 300);
        return () => clearTimeout(timer);
    }, [portal, query, mhStreet]);

    const ssMatches = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (portal !== "ss" || q.length < 2 || ssStreet) return [];
        return ssStreets.filter((s) => s.title.toLowerCase().includes(q)).slice(0, 8);
    }, [portal, query, ssStreets, ssStreet]);

    const streetChosen = portal === "myhome" ? !!mhStreet : !!ssStreet;
    const phone = normalizePhone(contact.phone);
    const ready = !blockers.length && streetChosen && !!streetNumber.trim() && !!description.trim() && !!contact.name.trim() && phone.length === 9;

    const publish = async () => {
        setBusy(true);
        setError(null);
        try {
            const onRefreshing = () => api.toast(t("publish.tokenRefreshing", { portal: label }));
            if (portal === "myhome" && mhStreet) {
                const districtLocationId = await findDistrictLocationId(mhStreet);
                if (!districtLocationId) throw new Error(t("publish.noDistrict"));
                const fields = buildMyhomeFields({ property: p, street: mhStreet, districtLocationId, streetNumber: streetNumber.trim(), description: description.trim(), projectTypeId: Number(projectType), contact });
                const result = await publishStatementWithPhotos(fields, p.photos, onRefreshing);
                if (result.status !== "success") throw new Error(publishFailure(result));
                const id = myhomeListingIdFrom(result.data);
                if (!id) throw new Error(t("publish.noListingId"));
                const url = myhomeListingUrl(id);
                api.recordPublishedListing(p.id, "myhome", id, url);
                setPublished({ id, url });
            } else if (portal === "ss" && ssStreet) {
                const usdGelRate = await getUsdGelRate();
                const located = await searchMyhomeLocations(ssStreet.title).catch(() => []);
                const point = located.find((x) => x.find_point === "streets" && x.identifiers.city_id === 1);
                const { draftSeed, applicationFields } = buildSsApplication({
                    property: p, street: ssStreet, streetNumber: streetNumber.trim(), description: description.trim(), contact, usdGelRate,
                    coordinates: point ? { lat: point.lat, lng: point.lng } : null,
                });
                const result = await publishSsApplication(draftSeed, applicationFields, onRefreshing, p.photos);
                if (result.status !== "success") throw new Error(publishFailure(result));
                const id = String(result.applicationId);
                const url = ssListingUrl(id);
                api.recordPublishedListing(p.id, "ss", id, url);
                setPublished({ id, url });
            }
            api.toast(t("publish.publishedToast", { portal: label }));
        } catch (e) {
            setError(e instanceof Error ? e.message : t("publish.failed", { portal: label }));
        } finally {
            setBusy(false);
        }
    };

    if (published) {
        return (
            <Modal title={t("publish.publishedTitle", { portal: label })} onClose={onClose}
                footer={<button className="btn btn-primary" onClick={onClose}>{t("form.done")}</button>}>
                <div className="fs-13" style={{ lineHeight: 1.6 }}>{t("publish.listingSaved", { id: published.id })}</div>
                <a className="link-quiet" href={published.url} target="_blank" rel="noopener noreferrer">{t("publish.openListing")}</a>
            </Modal>
        );
    }

    return (
        <Modal title={t("publish.title", { portal: label })} subtitle={t("publish.subtitle")} onClose={onClose}
            footer={<>
                <button className="btn btn-secondary" onClick={onClose} disabled={busy}>{t("common:actions.cancel")}</button>
                <button className="btn btn-primary" onClick={publish} disabled={!ready || busy}>{busy ? t("publish.publishing") : t("publish.publishPublicly")}</button>
            </>}>
            {blockers.length > 0 ? (
                <div className="card card-pad" style={{ background: "var(--amber-tint)", border: "none" }}>
                    <div className="row fs-12 bold" style={{ color: "var(--amber)" }}><AlertTriangle size={14} /> {t("publish.fixFirst")}</div>
                    {blockers.map((b) => <div key={b} className="fs-12" style={{ color: "var(--amber)", marginTop: 5 }}>{b}</div>)}
                </div>
            ) : (
                <>
                    <div className="form-grid">
                        <Field label={t("publish.street", { portal: label })} hint={streetChosen ? t("publish.streetHintChosen") : t("publish.streetHint")}>
                            <Input value={portal === "myhome" ? (mhStreet ? myhomeStreetName(mhStreet) : query) : (ssStreet ? ssStreet.title : query)}
                                placeholder="პეკინის"
                                onChange={(e) => { setMhStreet(null); setSsStreet(null); setQuery(e.target.value); }} />
                        </Field>
                        <Field label={t("publish.streetNumber")}><Input value={streetNumber} onChange={(e) => setStreetNumber(e.target.value)} /></Field>
                    </div>
                    {mhResults.map((r, i) => (
                        <button key={`${i}:${r.locations.join("/")}`} type="button" className="picker-item" style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 0" }}
                            onClick={() => { setMhStreet(r); setMhResults([]); }}>{r.locations.slice(1).join(" · ")}</button>
                    ))}
                    {ssMatches.map((s) => (
                        <button key={s.id} type="button" className="picker-item" style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 0" }}
                            onClick={() => setSsStreet(s)}>{s.title}</button>
                    ))}
                    {portal === "myhome" && (
                        <Field label={t("publish.projectTypeLabel")}><Select value={projectType} onChange={(e) => setProjectType(e.target.value)}
                            options={MYHOME_PROJECT_TYPES.map((o) => ({ value: o.value, label: t(`publish.projectType.${o.value}` as never, { defaultValue: o.label }) as string }))} /></Field>
                    )}
                    <Field label={t("publish.description")} hint={t("publish.descriptionHint")}>
                        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
                    </Field>
                    <div className="form-grid">
                        <Field label={t("publish.yourName")}><Input value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} /></Field>
                        <Field label={t("publish.yourPhone")} hint={t("publish.yourPhoneHint")} error={contact.phone && phone.length !== 9 ? t("publish.phoneDigits") : null}>
                            <Input value={contact.phone} placeholder="5XX XXX XXX" onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} />
                        </Field>
                    </div>
                    <div className="card card-pad" style={{ marginTop: 10 }}>
                        <div className="fs-12 bold" style={{ marginBottom: 5 }}>{t("publish.goingLive")}</div>
                        <div className="fs-12 muted" style={{ lineHeight: 1.6 }}>
                            {t("publish.summary", {
                                deal: enumLabel("dealType", p.dealType), type: enumLabel("propertyType", p.type), price: usd(Number(p.price)), area: p.area,
                                rooms: p.rooms, beds: p.beds, floor: p.floor, floors: p.floors, condition: enumLabel("condition", p.condition), photos: (p.photos || []).length,
                            })}
                        </div>
                    </div>
                    {error && <div className="fs-12" style={{ color: "var(--brick)", marginTop: 10, lineHeight: 1.5 }}>{error}</div>}
                </>
            )}
        </Modal>
    );
}

function publishFailure(result: Exclude<PublishStatementResult | PublishSsResult, { status: "success" }>): string {
    switch (result.status) {
        case "no-extension": return tg("modals:publish.failure.noExtension", { reason: result.reason });
        case "no-token": return tg("modals:publish.failure.noToken");
        case "unauthorized": return tg("modals:publish.failure.unauthorized");
        case "network-error": return tg("modals:publish.failure.network", { message: result.message });
        default: {
            const body = result.data as { errors?: unknown } | null;
            const detail = JSON.stringify(body?.errors ?? body ?? "").slice(0, 500);
            return tg("modals:publish.failure.refused", { status: result.httpStatus, detail });
        }
    }
}

export function ModalHost() {
    const { modal, closeModal } = useApp();
    if (!modal) return null;
    const { type, props } = modal;
    const close = closeModal;
    switch (type) {
        case "property": return <PropertyFormModal {...(props as Record<string, unknown>)} onClose={close} />;
        case "client": return <ClientFormModal {...(props as Record<string, unknown>)} onClose={close} />;
        case "task": return <TaskFormModal {...(props as Record<string, unknown>)} onClose={close} />;
        case "requirement": return <RequirementFormModal {...(props as Record<string, unknown>)} onClose={close} />;
        case "publish-listing": return <PublishListingModal {...(props as { property: Property; portal: Portal })} onClose={close} />;
        case "share-property": return <SharePropertyModal {...(props as { property: Property })} onClose={close} />;
        case "share-requirement": return <ShareRequirementModal {...(props as { requirement: Requirement; client: Client })} onClose={close} />;
        case "archive": return <ArchiveModal {...(props as { property: Property })} onClose={close} />;
        case "inquiry": return <InquiryModal onClose={close} />;
        case "convert-inquiry": return <ConvertInquiryModal {...(props as { inquiry: Inquiry })} onClose={close} />;
        case "contact-agent": return <ContactAgentModal {...(props as { agent: string; phone?: string | null; property?: Property | null })} onClose={close} />;
        case "extension": return <ExtensionModal onClose={close} />;
        case "change-agency": return <ChangeAgencyModal onClose={close} />;
        case "export": return <ExportModal onClose={close} />;
        case "colleague-matches": return <ColleagueMatchesModal {...(props as { req: ColleagueRequirement })} onClose={close} />;
        case "confirm": return <ConfirmDialog {...(props as { title: string; body: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void })} onClose={close} />;
        default: return null;
    }
}
