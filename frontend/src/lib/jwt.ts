export function decodeJwtExpiry(token: string): number | null {
  try {
    const [, payload] = token.split('.');
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.expires_at === 'number' ? json.expires_at * 1000 : null;
  } catch {
    return null;
  }
}
