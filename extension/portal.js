// Every MyHome.ge / SS.ge call the AgentOS site makes runs here, in the
// agent's own browser, instead of on our backend. The extension's
// host_permissions let it call these hosts without CORS getting in the way,
// photos go straight Cloudinary -> browser -> portal, and the portal token
// never leaves the agent's computer.
//
// Every op answers { status, data } with the portal's own HTTP status, so
// the site can keep treating a 401 as "token is dead, refresh it".

const MYHOME_HEADERS = { locale: 'ka', 'x-referrer-key': 'myhome', 'x-website-key': 'myhome' };
const MYHOME_CREATE_URL = 'https://api-statements.tnet.ge/v1/statements/create';
// MyHome's own form uploads to static-api-statements, not api-statements:
// the same path on api-statements answers 200 with a URL that is never stored.
const MYHOME_UPLOAD_URL = 'https://static-api-statements.tnet.ge/v1/files/upload-image';
const MYHOME_LOCATIONS_URL = 'https://api-locations.tnet.ge/v2/suggestions';
const MYHOME_LOOKUP_URLS = (uuid) => [
  `https://api-statements.tnet.ge/v1/statements/edit/${uuid}`,
  'https://api-statements.tnet.ge/v1/users/statements',
];

const SS_DRAFT_URL = 'https://api-gateway.ss.ge/v1/RealEstate/create-draft';
const SS_UPLOAD_URL = 'https://api-gateway.ss.ge/v1/RealEstate/upload-image';
const SS_CREATE_URL = 'https://api-gateway.ss.ge/v1/PaidService/create-application';
const SS_STREETS_URL = 'https://api-gateway.ss.ge/v1/RealEstate/Streets';
// Every Tbilisi subdistrict id ss.ge's own create form asks for.
const SS_TBILISI_SUBDISTRICTS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 26, 27, 28, 29, 30, 31, 32, 33,
  34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53,
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A portal call that never answers would otherwise hang until the site gives
// up on the whole publish. Bounding each fetch turns a stall into an error
// that can be retried.
async function fetchWithTimeout(url, options = {}, ms = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error(`${new URL(url).hostname} did not answer within ${ms / 1000}s`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Photo uploads only: a second try is safe (a duplicate upload just leaves an
// unused file on the portal) and usually succeeds when the first one stalled.
async function withOneRetry(attempt) {
  try {
    return await attempt();
  } catch {
    await sleep(1000);
    return attempt();
  }
}

// Portals sometimes answer an error with an empty or non-JSON body.
async function readBody(response) {
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

// Photos are only ever read from our own Cloudinary copies. Their URLs carry
// f_auto, which hands a browser AVIF/WebP; the portals want a plain JPEG.
async function fetchPhoto(sourceUrl) {
  const url = new URL(sourceUrl);
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') {
    throw new Error('Only Cloudinary photos can be published');
  }
  const jpegUrl = url.href.replace(/([/,])f_auto([,/])/, '$1f_jpg$2');
  const response = await fetchWithTimeout(jpegUrl, {}, 15000);
  if (!response.ok) throw new Error(`Photo download returned HTTP ${response.status}`);
  return response.blob();
}

async function blobToDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return `data:${blob.type || 'image/jpeg'};base64,${btoa(binary)}`;
}

// ---- MyHome ----

// The listing number is the numeric id on whichever object carries this uuid.
function findIdForUuid(node, uuid, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 6) return null;
  if (!Array.isArray(node) && node.uuid === uuid) {
    for (const k of ['id', 'statement_id', 'product_id']) {
      if (/^\d{6,10}$/.test(String(node[k] ?? ''))) return String(node[k]);
    }
  }
  for (const v of Object.values(node)) {
    const hit = findIdForUuid(v, uuid, depth + 1);
    if (hit) return hit;
  }
  return null;
}

async function lookupStatementId(token, uuid) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(2000);
    for (const url of MYHOME_LOOKUP_URLS(uuid)) {
      try {
        const res = await fetch(url, {
          headers: { ...MYHOME_HEADERS, Accept: 'application/json', 'global-authorization': token },
        });
        if (!res.ok) continue;
        const body = await res.json();
        const id = findIdForUuid(body, uuid);
        if (id) return id;
        // The edit route returns one statement; its uuid may not be echoed.
        if (url.includes('/edit/')) {
          const one = body?.data?.statement ?? body?.data;
          for (const k of ['id', 'statement_id']) {
            if (/^\d{6,10}$/.test(String(one?.[k] ?? ''))) return String(one[k]);
          }
        }
      } catch {
        // try the next route
      }
    }
  }
  return null;
}

async function myhomeCreateStatement(token, { fields }) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields || {})) form.append(key, String(value));
  const response = await fetch(MYHOME_CREATE_URL, {
    method: 'POST',
    headers: { ...MYHOME_HEADERS, 'global-authorization': token },
    body: form,
  });
  const data = await readBody(response);
  // create answers with a uuid but no listing number; look the number up so
  // the site can save the listing's ID and URL.
  const uuid = data?.data?.uuid;
  if (response.ok && data?.result && uuid && !data.data.statement_id) {
    const id = await lookupStatementId(token, uuid);
    if (id) data.data.statement_id = id;
  }
  return { status: response.status, data };
}

// A 200 alone isn't proof MyHome stored the file, and publishing with a
// broken image wastes a free-listing slot.
async function isPhotoStored(url) {
  // Only checkable on a host the manifest covers (tnet.ge, my.ge, ...);
  // anywhere else CORS would fail every fetch and block the publish, so
  // trust MyHome's 200 there instead.
  const origin = new URL(url).origin;
  if (!(await chrome.permissions.contains({ origins: [`${origin}/*`] }))) return true;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(1500);
    try {
      if ((await fetchWithTimeout(url, {}, 5000)).ok) return true;
    } catch {
      // retry
    }
  }
  return false;
}

async function myhomeUploadImage(token, { sourceUrl }) {
  const photo = await fetchPhoto(sourceUrl);
  const response = await withOneRetry(() => {
    const form = new FormData();
    form.append('image', photo, 'photo.jpg');
    form.append('type', '1'); // what MyHome's own form sends for gallery photos
    return fetchWithTimeout(MYHOME_UPLOAD_URL, {
      method: 'POST',
      headers: { ...MYHOME_HEADERS, 'global-authorization': token },
      body: form,
    });
  });
  const data = await readBody(response);
  const url = data?.data?.url;
  if (response.ok && url && !(await isPhotoStored(url))) {
    return { status: 502, data: { error: 'MyHome accepted the photo but did not store it, so nothing was published' } };
  }
  return { status: response.status, data };
}

async function myhomeLocations(_token, { q }) {
  const query = String(q || '').trim();
  if (query.length < 2) return { status: 200, data: [] };
  // No with_visible_in_cities: with it, Latin queries ("pekini") return nothing.
  const response = await fetch(`${MYHOME_LOCATIONS_URL}?q=${encodeURIComponent(query)}`, { headers: { locale: 'ka' } });
  const data = await readBody(response);
  return { status: response.status, data: Array.isArray(data?.data) ? data.data : data };
}

// Reads a public listing from the page's own __NEXT_DATA__. Sent with the
// agent's cookies, so Cloudflare sees a normal browser visit.
async function fetchNextData(url) {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) return { status: response.status, next: null };
  const html = await response.text();
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/s);
  return { status: match ? 200 : 404, next: match ? JSON.parse(match[1]) : null };
}

async function myhomeGetStatement(_token, { id }) {
  if (!/^\d+$/.test(String(id))) return { status: 400, data: { error: 'id must be numeric' } };
  const { status, next } = await fetchNextData(`https://www.myhome.ge/udzravi-qoneba/${id}/x/`);
  const query = next?.props?.pageProps?.dehydratedState?.queries?.find((q) => q.queryKey.includes('details'));
  const statement = query?.state?.data?.data?.statement ?? null;
  return statement ? { status: 200, data: statement } : { status: status === 200 ? 404 : status, data: null };
}

// ---- SS.ge ----

// No timeout by default: aborting create-application could still leave a
// live ad behind, so that call is left to the site's own (longer) limit.
async function ssRequest(url, token, { method = 'POST', body, timeoutMs } = {}) {
  const doFetch = timeoutMs ? (u, o) => fetchWithTimeout(u, o, timeoutMs) : fetch;
  const response = await doFetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'accept-language': 'ka',
      os: 'web',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await readBody(response) };
}

async function ssUploadImage(token, { applicationId, sourceUrl }) {
  const content = await blobToDataUrl(await fetchPhoto(sourceUrl));
  return withOneRetry(() =>
    ssRequest(SS_UPLOAD_URL, token, { body: { applicationId, content, is360: false, isGif: false }, timeoutMs: 20000 })
  );
}

async function ssStreets(token) {
  const query = SS_TBILISI_SUBDISTRICTS.map((id) => `subdistricts=${id}`).join('&');
  return ssRequest(`${SS_STREETS_URL}?${query}`, token, { method: 'GET' });
}

async function ssGetListing(_token, { id }) {
  if (!/^\d+$/.test(String(id))) return { status: 400, data: { error: 'id must be numeric' } };
  // ss.ge/en/real-estate/{id} redirects to home.ss.ge; fetch follows it.
  const { status, next } = await fetchNextData(`https://ss.ge/en/real-estate/${id}`);
  const listing = next?.props?.pageProps?.applicationData ?? null;
  return listing ? { status: 200, data: listing } : { status: status === 200 ? 404 : status, data: null };
}

const PORTAL_OPS = {
  'myhome.createStatement': myhomeCreateStatement,
  'myhome.uploadImage': myhomeUploadImage,
  'myhome.locations': myhomeLocations,
  'myhome.getStatement': myhomeGetStatement,
  'ss.createDraft': (token, { draft }) => ssRequest(SS_DRAFT_URL, token, { body: draft }),
  'ss.uploadImage': ssUploadImage,
  'ss.createApplication': (token, { application }) => ssRequest(SS_CREATE_URL, token, { body: application }),
  'ss.streets': ssStreets,
  'ss.getListing': ssGetListing,
};

// status 0 means the call never got an HTTP answer (network down, bad photo
// URL, unknown op) and `error` says why.
async function runPortalOp(message) {
  const op = PORTAL_OPS[message?.op];
  if (!op) return { status: 0, error: `Unknown portal op: ${message?.op}` };
  try {
    return await op(message.token || '', message.args || {});
  } catch (err) {
    return { status: 0, error: err instanceof Error ? err.message : String(err) };
  }
}
