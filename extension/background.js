console.log('[token-grabber] background script loaded');

function decodeExpiry(token) {
  try {
    const [, payload] = token.split('.');
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.expires_at === 'number' ? json.expires_at * 1000 : null;
  } catch {
    return null;
  }
}

chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    const headerNames = details.requestHeaders?.map((h) => h.name).join(', ');
    console.log('[token-grabber] request seen:', details.url, '| headers:', headerNames);

    const header = details.requestHeaders?.find(
      (h) => h.name.toLowerCase() === 'global-authorization'
    );

    if (!header?.value) return;

    console.log('[token-grabber] captured token from', details.url);

    chrome.storage.local.set({
      token: header.value,
      capturedAt: Date.now(),
      expiresAt: decodeExpiry(header.value),
    });
  },
  { urls: ['*://*.tnet.ge/*'] },
  ['requestHeaders', 'extraHeaders']
);

chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'GET_TOKEN') return;

  chrome.storage.local.get(['token', 'capturedAt'], (data) => {
    if (!data.token) {
      sendResponse(null);
      return;
    }

    const expiresAt = decodeExpiry(data.token);
    const isExpired = expiresAt !== null && expiresAt < Date.now();

    if (isExpired) {
      sendResponse(null);
      return;
    }

    sendResponse({ token: data.token, capturedAt: data.capturedAt, expiresAt });
  });

  return true; // keep sendResponse alive for the async storage read
});
