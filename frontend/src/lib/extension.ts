const EXTENSION_ID = import.meta.env.VITE_EXTENSION_ID;

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
          callback: (response: ExtensionToken | null) => void
        ) => void;
        lastError?: { message: string };
      };
    };
  }
}

export function checkExtension(): Promise<ExtensionCheckResult> {
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

    window.chrome.runtime.sendMessage(EXTENSION_ID, { type: 'GET_TOKEN' }, (response) => {
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
