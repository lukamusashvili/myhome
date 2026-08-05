function decodeExpiry(token) {
  try {
    const [, payload] = token.split('.');
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return json.expires_at ? json.expires_at * 1000 : null;
  } catch {
    return null;
  }
}

chrome.storage.local.get(['token', 'capturedAt'], ({ token, capturedAt }) => {
  const statusEl = document.getElementById('status');
  const tokenEl = document.getElementById('token');

  if (!token) {
    statusEl.textContent = 'No token captured yet — browse myhome.ge while logged in.';
    statusEl.className = 'status none';
    return;
  }

  tokenEl.value = token;

  const expiresAt = decodeExpiry(token);
  const now = Date.now();

  if (expiresAt && expiresAt < now) {
    statusEl.textContent = `Expired ${Math.round((now - expiresAt) / 1000)}s ago — revisit myhome.ge.`;
    statusEl.className = 'status stale';
  } else if (expiresAt) {
    statusEl.textContent = `Valid for ${Math.round((expiresAt - now) / 1000)}s more.`;
    statusEl.className = 'status ok';
  } else {
    statusEl.textContent = `Captured ${Math.round((now - capturedAt) / 1000)}s ago.`;
    statusEl.className = 'status ok';
  }
});

document.getElementById('copy').addEventListener('click', () => {
  const tokenEl = document.getElementById('token');
  if (!tokenEl.value) return;
  navigator.clipboard.writeText(tokenEl.value);
});
