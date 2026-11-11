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

const PLATFORMS = [
  { key: 'myhome', label: 'myhome.ge', statusId: 'myhome-status', tokenId: 'myhome-token', copyId: 'myhome-copy' },
  { key: 'ss', label: 'ss.ge', statusId: 'ss-status', tokenId: 'ss-token', copyId: 'ss-copy' },
];

chrome.storage.local.get(['tokens'], ({ tokens }) => {
  for (const platform of PLATFORMS) {
    const entry = tokens?.[platform.key];
    const statusEl = document.getElementById(platform.statusId);
    const tokenEl = document.getElementById(platform.tokenId);

    if (!entry?.token) {
      statusEl.textContent = `No token captured yet — browse ${platform.label} while logged in.`;
      statusEl.className = 'status none';
      continue;
    }

    tokenEl.value = entry.token;

    const expiresAt = decodeExpiry(entry.token);
    const now = Date.now();
    const age = Math.round((now - entry.capturedAt) / 1000);

    statusEl.className = 'status ok';
    statusEl.textContent = expiresAt
      ? `Captured ${age}s ago (expiry claim: ${new Date(expiresAt).toLocaleString()}).`
      : `Captured ${age}s ago.`;
  }
});

for (const platform of PLATFORMS) {
  document.getElementById(platform.copyId)?.addEventListener('click', () => {
    const tokenEl = document.getElementById(platform.tokenId);
    if (!tokenEl.value) return;
    navigator.clipboard.writeText(tokenEl.value);
  });
}
