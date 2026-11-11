importScripts('portal.js');

function decodeExpiry(token) {
  try {
    const [, payload] = token.split('.');
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    const seconds =
      typeof json.expires_at === 'number' ? json.expires_at : typeof json.exp === 'number' ? json.exp : null;
    return seconds !== null ? seconds * 1000 : null;
  } catch {
    return null;
  }
}

// The extension's own portal calls (portal.js) carry the token too; they
// must not count as a fresh capture, or a token the portal just rejected
// would look "newer" to REFRESH_TOKEN and be handed straight back.
function isOwnRequest(details) {
  return typeof details.initiator === 'string' && details.initiator.startsWith('chrome-extension://');
}

function storeToken(platform, token) {
  chrome.storage.local.get(['tokens'], (data) => {
    const tokens = data.tokens || {};
    if (tokens[platform]?.token === token) return;
    tokens[platform] = { token, capturedAt: Date.now() };
    chrome.storage.local.set({ tokens });
  });
}

// myhome.ge: custom `global-authorization` header, carries the raw JWT.
chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    if (isOwnRequest(details)) return;
    const header = details.requestHeaders?.find((h) => h.name.toLowerCase() === 'global-authorization');
    if (!header?.value) return;
    storeToken('myhome', header.value);
  },
  { urls: ['*://*.tnet.ge/*'] },
  ['requestHeaders', 'extraHeaders']
);

// ss.ge: standard `Authorization: Bearer <token>` header, sent only on
// api-gateway.ss.ge calls (favorites-count, visibleCities,
// user-applications-count, etc. all carry it on page load — no need to visit
// the create-listing form). Matched against *.ss.ge rather than the exact
// api-gateway host: the narrower pattern reproducibly failed to fire in
// testing even with matching host_permissions, for reasons not pinned down.
// Safe to leave broad — home.ss.ge's own page/asset requests only ever send
// a Cookie header, never Authorization, so nothing else gets captured here.
chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    if (isOwnRequest(details)) return;
    const header = details.requestHeaders?.find((h) => h.name.toLowerCase() === 'authorization');
    const token = header?.value?.replace(/^Bearer\s+/i, '');
    if (!token) return;
    storeToken('ss', token);
  },
  { urls: ['*://*.ss.ge/*'] },
  ['requestHeaders', 'extraHeaders']
);

chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  // Lets the AgentOS site check the extension is installed, independent of
  // whether any portal token has been captured yet.
  if (message?.type === 'PING') {
    sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
    return;
  }

  // Runs a MyHome/SS call here in the browser (see portal.js). The site
  // passes the token it already got from GET_TOKEN, so its own 401 ->
  // REFRESH_TOKEN -> retry logic stays where it is.
  if (message?.type === 'PORTAL') {
    runPortalOp(message).then(sendResponse);
    return true;
  }

  if (message?.type === 'GET_TOKEN') {
    const platform = message.platform === 'ss' ? 'ss' : 'myhome';

    // The decoded expiry claim is not trusted as a gate (myhome's keeps
    // working days past it). Whoever calls the real API is the source of
    // truth on whether the token still works; on a 401 they re-call
    // GET_TOKEN to pick up anything fresher that's been captured since.
    chrome.storage.local.get(['tokens'], (data) => {
      const entry = data.tokens?.[platform];
      if (!entry?.token) {
        sendResponse(null);
        return;
      }

      sendResponse({
        token: entry.token,
        capturedAt: entry.capturedAt,
        expiresAt: decodeExpiry(entry.token),
      });
    });

    return true; // keep sendResponse alive for the async storage read
  }

  if (message?.type === 'REFRESH_TOKEN') {
    const platform = message.platform === 'ss' ? 'ss' : 'myhome';
    const sinceCapturedAt = typeof message.sinceCapturedAt === 'number' ? message.sinceCapturedAt : 0;
    const url = typeof message.url === 'string' ? message.url : null;
    if (!url) {
      sendResponse(null);
      return;
    }

    // Opens the portal's own site in a background tab — never focused, so
    // nothing jumps — purely so a real authenticated request fires and the
    // listeners above capture a fresh token the normal way. Polls storage
    // for it, closes the tab either way, and never leaves it open on failure.
    chrome.tabs.create({ url, active: false }, (tab) => {
      const tabId = tab?.id;
      const deadline = Date.now() + 15000;
      let settled = false;

      const finish = (response) => {
        if (settled) return;
        settled = true;
        if (tabId !== undefined) chrome.tabs.remove(tabId, () => void chrome.runtime.lastError);
        sendResponse(response);
      };

      const poll = () => {
        chrome.storage.local.get(['tokens'], (data) => {
          if (settled) return;
          const entry = data.tokens?.[platform];
          if (entry?.token && entry.capturedAt > sinceCapturedAt) {
            finish({ token: entry.token, capturedAt: entry.capturedAt, expiresAt: decodeExpiry(entry.token) });
            return;
          }
          if (Date.now() > deadline) {
            finish(null);
            return;
          }
          setTimeout(poll, 500);
        });
      };
      poll();
    });

    return true; // keep sendResponse alive across the tab lifecycle
  }
});
