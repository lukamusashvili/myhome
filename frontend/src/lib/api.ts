import { callPortal, checkExtension, refreshTokenViaNewTab, type ExtensionPlatform, type PortalOp } from './extension';
import { t } from '../i18n';

// VITE_PRODUCTION=1 talks to the deployed backend on Render, anything else
// (0 or unset) to a backend running locally with `npm run dev`.
export const IS_PRODUCTION = import.meta.env.VITE_PRODUCTION === '1';
const API_URLS = {
  dev: 'http://localhost:3000',
  prod: 'https://agentos-backend-91rb.onrender.com',
};
export const API_BASE_URL = IS_PRODUCTION ? API_URLS.prod : API_URLS.dev;

// Every MyHome/SS call below runs inside the AgentOS extension, in the
// agent's own browser (extension/portal.js), not on our backend: photos go
// straight Cloudinary -> browser -> portal, and the portal token never leaves
// the agent's computer.

export interface StatementResult {
  status: number;
  data: unknown;
}

type PortalCallResult = StatementResult | { networkError: string };

// Photos uploaded at once. Portals handle a few in parallel fine; more than
// this mostly just competes for the agent's upload bandwidth.
const PHOTO_CONCURRENCY = 3;
// Creating a MyHome statement also polls for its listing number (~15s worst case),
// and MyHome's create endpoint alone has been seen taking 7-50s.
const CREATE_TIMEOUT_MS = 90000;
// The extension bounds each photo fetch and retries a stalled upload once
// (extension/portal.js), which can take ~75s in the worst case, so this has
// to outlast it rather than cut a retry off half-way.
const UPLOAD_TIMEOUT_MS = 90000;

// A create call that timed out may still have gone live on the portal, so
// the agent must check before pressing publish again.
function createFailure(result: PortalCallResult): Failure {
  const failure = failureOf(result);
  if (failure.status !== 'network-error') return failure;
  return { status: 'network-error', message: t('modals:publish.failure.mayBeLive', { message: failure.message }) };
}

async function tryPortal(
  op: PortalOp,
  token: string,
  args: Record<string, unknown>,
  timeoutMs?: number
): Promise<PortalCallResult> {
  try {
    return await callPortal(op, token, args, timeoutMs);
  } catch (err) {
    return { networkError: err instanceof Error ? err.message : String(err) };
  }
}

// Holds the portal token for one publish. The decoded expiry claim is not
// trusted (captured tokens keep working for days past it): only a 401 from
// the portal means it's dead. Then the extension opens the portal in a
// background tab to capture a fresh one — once per publish, shared by
// every parallel photo upload that hit the same 401.
function tokenKeeper(platform: ExtensionPlatform, first: { token: string; capturedAt: number }, onRefreshing?: () => void) {
  let token = first.token;
  let refreshing: Promise<boolean> | null = null;
  const refresh = () => {
    refreshing ??= (async () => {
      onRefreshing?.();
      const fresh = await refreshTokenViaNewTab(platform, first.capturedAt);
      if (fresh) token = fresh.token;
      return !!fresh;
    })();
    return refreshing;
  };
  // One portal call, retried once with a fresh token on a 401.
  const call = async (op: PortalOp, args: Record<string, unknown>, timeoutMs?: number): Promise<PortalCallResult> => {
    const result = await tryPortal(op, token, args, timeoutMs);
    if ('networkError' in result || result.status !== 401) return result;
    if (!(await refresh())) return result;
    return tryPortal(op, token, args, timeoutMs);
  };
  return { call };
}

// Runs `task` over `items`, `limit` at a time, keeping results in input
// order. Stops starting new tasks once one result fails `ok`.
async function mapLimited<T, R>(items: T[], limit: number, task: (item: T, index: number) => Promise<R>, ok: (r: R) => boolean): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < items.length) {
      const index = next++;
      results[index] = await task(items[index], index);
      if (!ok(results[index])) failed = true;
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const isOk = (r: PortalCallResult) => !('networkError' in r) && r.status >= 200 && r.status < 300;

export type PublishStatementResult =
  | { status: 'success'; data: unknown }
  // Extension not installed, disabled, or unreachable from this page.
  // `reason` is the raw checkExtension() sub-status, for debugging exactly
  // which precondition failed.
  | { status: 'no-extension'; reason: string }
  // Extension is reachable but hasn't captured a token yet for this agent —
  // they need to browse myhome.ge while logged in at least once.
  | { status: 'no-token' }
  // The portal rejected the token, and re-grabbing a fresh one didn't
  // help — the agent's session on the portal is actually dead.
  | { status: 'unauthorized' }
  | { status: 'error'; httpStatus: number; data: unknown }
  // The call never got an HTTP answer (extension outdated, network down,
  // photo couldn't be downloaded) — distinct from 'error', which is a real
  // response from the portal.
  | { status: 'network-error'; message: string };

type Failure = Exclude<PublishStatementResult, { status: 'success' }>;

// Also covers a 2xx that lacks what we needed (e.g. no image id): it's
// reported as a portal 'error' with that status and body.
function failureOf(result: PortalCallResult): Failure {
  if ('networkError' in result) return { status: 'network-error', message: result.networkError };
  if (result.status === 401) return { status: 'unauthorized' };
  return { status: 'error', httpStatus: result.status, data: result.data };
}

async function startPublish(platform: ExtensionPlatform) {
  const first = await checkExtension(platform);
  if (first.status === 'ok') return first;
  if (first.status === 'no-token') return { status: 'no-token' as const };
  const reason = first.status === 'not-connected' ? `not-connected: ${first.message}` : first.status;
  return { status: 'no-extension' as const, reason };
}

interface MyhomeUploadResponse { data?: { id?: number; url?: string } }

// A real property's publish: uploads its photos to MyHome, then creates the
// statement that references them.
export async function publishStatementWithPhotos(
  fields: Record<string, unknown>,
  photos: string[],
  onRefreshing?: () => void
): Promise<PublishStatementResult> {
  const first = await startPublish('myhome');
  if (first.status !== 'ok') return first;
  const portal = tokenKeeper('myhome', first, onRefreshing);

  const uploads = await mapLimited(photos, PHOTO_CONCURRENCY, (sourceUrl) => portal.call('myhome.uploadImage', { sourceUrl }, UPLOAD_TIMEOUT_MS), (r) =>
    isOk(r) && !!(r as StatementResult & { data: MyhomeUploadResponse | null }).data?.data?.id
  );

  const allFields = { ...fields };
  for (const [index, upload] of uploads.entries()) {
    if (!upload) continue; // never started: an earlier upload failed
    const image = 'networkError' in upload ? null : (upload.data as MyhomeUploadResponse | null)?.data;
    if (!isOk(upload) || !image?.id || !image.url) {
      return failureOf(upload);
    }
    allFields[`images[${index}][image_id]`] = image.id;
    allFields[`images[${index}][url]`] = image.url;
  }

  const result = await portal.call('myhome.createStatement', { fields: allFields }, CREATE_TIMEOUT_MS);
  return isOk(result) ? { status: 'success', data: (result as StatementResult).data } : createFailure(result);
}

// --- ss.ge ---

export type PublishSsResult =
  | { status: 'success'; applicationId: number; data: unknown }
  | { status: 'no-extension'; reason: string }
  // Extension reachable, but no ss.ge token yet — the agent needs to browse
  // home.ss.ge while logged in at least once.
  | { status: 'no-token' }
  | { status: 'unauthorized' }
  // The draft call succeeded but didn't hand back an applicationId — can't
  // proceed to publish without one.
  | { status: 'draft-failed'; httpStatus: number; data: unknown }
  | { status: 'error'; httpStatus: number; data: unknown }
  | { status: 'network-error'; message: string };

// Required draft fields, mirrored from the fields ss.ge's own create-draft
// call needs to produce a usable applicationId. A stale/reused
// realEstateApplicationId has been observed to silently drop later field
// updates — always create fresh with id 0.
export interface SsDraftSeed {
  realEstateTypeId: number;
  realEstateDealTypeId: number;
  cityId: number;
  subdistrictId?: number;
  streetId?: number;
  streetNumber?: string;
  locationLatitude?: number;
  locationLongitude?: number;
  priceType?: number;
  price?: number;
  currencyId?: number;
  showSiteCurrencyId?: number;
  rooms?: number;
  bedrooms?: number;
  totalArea?: number;
  floor?: number;
  floors?: number;
  status?: number;
  priceUsd?: number;
  descriptionGe?: string;
  phoneNumbers?: { phoneNumber: string; hasViber: boolean; hasWhatsapp: boolean; isApproved: boolean; isMain: boolean }[];
  messagingOn?: boolean;
  phoneCallsOn?: boolean;
}

interface SsImageResponse { imageId?: number; fileName?: string }

// Publishes a listing to ss.ge: a fresh draft, its photos, then the real
// publish call with the draft's applicationId.
export async function publishSsApplication(
  draftSeed: SsDraftSeed,
  applicationFields: Record<string, unknown>,
  onRefreshing?: () => void,
  photos: string[] = []
): Promise<PublishSsResult> {
  const first = await startPublish('ss');
  if (first.status !== 'ok') return first;
  const portal = tokenKeeper('ss', first, onRefreshing);

  const draft = {
    realEstateApplicationId: 0,
    ...draftSeed,
    applicationStatus: 6,
    images: [],
    moderationBlockCategories: [],
  };
  const draftResult = await portal.call('ss.createDraft', { draft });
  if (!isOk(draftResult)) {
    const failure = failureOf(draftResult);
    return failure.status === 'error' ? { ...failure, status: 'draft-failed' } : failure;
  }
  const draftOk = draftResult as StatementResult;
  const applicationId = (draftOk.data as { applicationId?: number } | null)?.applicationId;
  if (!applicationId) return { status: 'draft-failed', httpStatus: draftOk.status, data: draftOk.data };

  const uploads = await mapLimited(photos, PHOTO_CONCURRENCY, (sourceUrl) => portal.call('ss.uploadImage', { applicationId, sourceUrl }, UPLOAD_TIMEOUT_MS), (r) =>
    isOk(r) && !!((r as StatementResult).data as SsImageResponse | null)?.imageId
  );

  const images: Record<string, unknown>[] = [];
  for (const [orderNo, upload] of uploads.entries()) {
    if (!upload) continue; // never started: an earlier upload failed
    const image = 'networkError' in upload ? null : (upload.data as SsImageResponse | null);
    if (!isOk(upload) || !image?.imageId) {
      return failureOf(upload);
    }
    images.push({
      applicationImageId: image.imageId,
      fileName: image.fileName,
      isMain: orderNo === 0,
      is360: false,
      orderNo,
      imageRotation: 0,
    });
  }

  const application = {
    application: {
      userType: 'Individual',
      ...applicationFields,
      ...(photos.length ? { images } : {}),
      realEstateApplicationId: applicationId,
      applicationStatus: 6,
      moderationBlockCategories: null,
    },
    paidServices: {
      source: 'Create Application',
      // What SS.ge's own form sends; the one value it has been seen with on
      // ads that went public.
      sourceDevice: 'Windows/Chrome',
      isCreate: true,
      items: [
        {
          applicationId,
          rubric: 'RealEstate',
          realEstateDealTypeId: draftSeed.realEstateDealTypeId,
          cityId: draftSeed.cityId,
          paidServices: [],
        },
      ],
      // flow 1 (balance) skips the card payment gateway entirely — safe
      // here since items[].paidServices is always empty (no paid add-ons),
      // so the charge is 0.
      purchaseOptions: { flow: 1, cardId: null },
    },
  };

  const result = await portal.call('ss.createApplication', { application }, CREATE_TIMEOUT_MS);
  if (isOk(result)) return { status: 'success', applicationId, data: (result as StatementResult).data };
  return createFailure(result);
}
