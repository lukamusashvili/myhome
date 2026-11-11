const EXTENSION_ID = import.meta.env.VITE_AGENTOS_EXTENSION_ID;

// Where the install modal's Download button points. Defaults to the zip
// built by build-extension-zip.ps1 into public/; set
// VITE_AGENTOS_EXTENSION_DOWNLOAD_URL to host it elsewhere (e.g. Drive).
export const EXTENSION_DOWNLOAD_URL: string =
  import.meta.env.VITE_AGENTOS_EXTENSION_DOWNLOAD_URL || '/agentos-extension.zip';

// chrome.runtime only exists on a page when an installed extension lists the
// page's origin in externally_connectable — so a missing runtime on desktop
// Chrome/Edge almost always means "not installed". The extension is
// desktop-only; phones and tablets never get it.
export const extensionConfigured = Boolean(EXTENSION_ID);

// The first build that runs MyHome/SS calls itself (the PORTAL message).
// Bump together with extension/manifest.json whenever the site starts
// relying on something new in the extension.
export const MIN_EXTENSION_VERSION = '1.1.0';

function isAtLeast(version: string | undefined, min: string): boolean {
  if (!version) return false;
  const a = version.split('.').map(Number);
  const b = min.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff) return diff > 0;
  }
  return true;
}

export function isExtensionCapableBrowser(): boolean {
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return false;
  return /Chrome\/|Edg\//.test(ua);
}

// Resolves true only when the AgentOS extension answers a PING. Separate from
// checkExtension(): installed-but-no-token-yet still counts as installed.
export function isExtensionInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!EXTENSION_ID || !window.chrome?.runtime?.sendMessage) {
      resolve(false);
      return;
    }
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(false);
    }, 3000);
    window.chrome.runtime.sendMessage(EXTENSION_ID, { type: 'PING' }, (response) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      const version = (response as { version?: string } | null)?.version;
      // An older build answers PING but can't run portal calls (PORTAL), so
      // it counts as missing and the install modal asks for the new zip.
      resolve(!window.chrome?.runtime?.lastError && Boolean(response) && isAtLeast(version, MIN_EXTENSION_VERSION));
    });
  });
}

export type ExtensionPlatform = 'myhome' | 'ss';

export interface ExtensionToken {
  token: string;
  capturedAt: number;
}

type ExtensionCheckResult =
  | { status: 'ok'; token: string; capturedAt: number }
  | { status: 'no-extension-id' }
  | { status: 'runtime-unavailable' }
  | { status: 'not-connected'; message: string }
  | { status: 'no-token' }
  | { status: 'timeout' };

declare global {
  interface Window {
    chrome?: {
      runtime?: {
        sendMessage: (
          extensionId: string,
          message: unknown,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each message type answers its own shape
        callback: (response: any) => void
        ) => void;
        lastError?: { message: string };
      };
    };
  }
}

export function checkExtension(platform: ExtensionPlatform = 'myhome'): Promise<ExtensionCheckResult> {
  return new Promise((resolve) => {
    if (!EXTENSION_ID) {
      resolve({ status: 'no-extension-id' });
      return;
    }

    if (!window.chrome?.runtime?.sendMessage) {
      resolve({ status: 'runtime-unavailable' });
      return;
    }

    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ status: 'timeout' });
    }, 3000);

    window.chrome.runtime.sendMessage(EXTENSION_ID, { type: 'GET_TOKEN', platform }, (response) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      const lastError = window.chrome?.runtime?.lastError;
      if (lastError) {
        resolve({ status: 'not-connected', message: lastError.message });
        return;
      }

      if (!response?.token) {
        resolve({ status: 'no-token' });
        return;
      }

      resolve({ status: 'ok', token: response.token, capturedAt: response.capturedAt });
    });
  });
}

export interface FreshToken {
  token: string;
  capturedAt: number;
}

// A page on each portal that a logged-in agent can just load to produce an
// authenticated request the extension can capture — myhome.ge's own
// homepage for myhome (matches the existing "browse myhome.ge while logged
// in" guidance), home.ss.ge's homepage for ss.ge (confirmed live: it fires
// favorites-count/visibleCities/etc. with the Authorization header on
// load, no need to visit the create-listing form).
const PLATFORM_REFRESH_URL: Record<ExtensionPlatform, string> = {
  myhome: 'https://www.myhome.ge/',
  ss: 'https://home.ss.ge/ka',
};

// Recovers from a rejected (expired) token without asking the agent to do
// anything by hand, and without stealing focus: asks the extension's
// background script to open the portal's own site in a background tab (only
// it can do that — a page can only window.open a focused, popup-blockable
// tab), wait for its own listeners to capture a token newer than the stale
// one, close the tab, and hand it back. The agent's session on the portal
// almost always outlives the short-lived API token, so this is silent and
// fast; it only comes up empty if they're actually logged out there.
export function refreshTokenViaNewTab(platform: ExtensionPlatform, sinceCapturedAt: number): Promise<FreshToken | null> {
  return new Promise((resolve) => {
    if (!EXTENSION_ID || !window.chrome?.runtime?.sendMessage) {
      resolve(null);
      return;
    }

    let settled = false;
    // Longer than the background script's own 15s poll deadline, to leave
    // room for the tab-creation and message round trip.
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(null);
    }, 20000);

    window.chrome.runtime.sendMessage(
      EXTENSION_ID,
      { type: 'REFRESH_TOKEN', platform, url: PLATFORM_REFRESH_URL[platform], sinceCapturedAt },
      (response) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);

        if (window.chrome?.runtime?.lastError || !response?.token) {
          resolve(null);
          return;
        }

        resolve({ token: response.token, capturedAt: response.capturedAt });
      }
    );
  });
}

// ---- Portal calls run by the extension (extension/portal.js) ----

export type PortalOp =
  | 'myhome.createStatement'
  | 'myhome.uploadImage'
  | 'myhome.locations'
  | 'myhome.getStatement'
  | 'ss.createDraft'
  | 'ss.uploadImage'
  | 'ss.createApplication'
  | 'ss.streets'
  | 'ss.getListing';

// `status` is the portal's own HTTP status. The promise rejects only when the
// call never got an HTTP answer: extension missing or outdated, network down,
// or the extension's own error (e.g. the photo couldn't be downloaded).
export interface PortalResponse {
  status: number;
  data: unknown;
}

export function callPortal(
  op: PortalOp,
  token: string,
  args: Record<string, unknown> = {},
  timeoutMs = 60000
): Promise<PortalResponse> {
  return new Promise((resolve, reject) => {
    if (!EXTENSION_ID || !window.chrome?.runtime?.sendMessage) {
      reject(new Error('AgentOS extension is not installed'));
      return;
    }
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('The AgentOS extension took too long to answer'));
    }, timeoutMs);

    window.chrome.runtime.sendMessage(EXTENSION_ID, { type: 'PORTAL', op, token, args }, (response) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      const lastError = window.chrome?.runtime?.lastError;
      const result = response as { status?: number; data?: unknown; error?: string } | undefined;
      // An extension older than MIN_EXTENSION_VERSION ignores PORTAL, which
      // surfaces as an empty response.
      if (lastError || !result || typeof result.status !== 'number') {
        reject(new Error('Update the AgentOS extension: download it again and reload it in chrome://extensions'));
        return;
      }
      if (result.status === 0) {
        reject(new Error(result.error || 'The AgentOS extension could not reach the portal'));
        return;
      }
      resolve({ status: result.status, data: result.data ?? null });
    });
  });
}
