import { useEffect, useState } from "react";
import { useSnapshot } from "valtio";
import { formStore } from "./store/formStore";
import { submitStatement, statementLookupUrl } from "./lib/api";
import { checkExtension } from "./lib/extension";
import { decodeJwtExpiry } from "./lib/jwt";

const MYHOME_LOGIN_URL =
    "https://statements.myhome.ge/ka/user-profile/my-statements?referrer=myhome";

const STATUS_MESSAGES: Record<string, string> = {
    "no-extension-id": "VITE_EXTENSION_ID is not set in frontend/.env.",
    "runtime-unavailable":
        "Extension not reachable — is it installed and enabled in this browser?",
    "no-token":
        "Extension has no token yet — open myhome.ge above while logged in, then retry.",
    timeout:
        "No response from the extension after 3s — check its ID and that it's enabled.",
};

async function refreshTokenFromExtension() {
    formStore.extensionChecking = true;
    const result = await checkExtension();
    formStore.extensionChecking = false;

    if (result.status === "ok") {
        formStore.token = result.token;
        formStore.tokenCapturedAt = result.capturedAt;
        formStore.tokenExpiresAt = decodeJwtExpiry(result.token);
        formStore.extensionMessage = "Token found.";
        return;
    }

    // Any non-"ok" result means the extension has nothing valid right now —
    // clear stale state instead of leaving the last-known token displayed.
    formStore.token = "";
    formStore.tokenCapturedAt = null;
    formStore.tokenExpiresAt = null;

    if (result.status === "not-connected") {
        formStore.extensionMessage = `Not connected: ${result.message} (check VITE_EXTENSION_ID matches chrome://extensions).`;
        return;
    }

    formStore.extensionMessage =
        STATUS_MESSAGES[result.status] ?? "Unknown error.";
}

function StatementLookup() {
    const [id, setId] = useState("");
    const isValid = /^\d+$/.test(id.trim());

    function handleLookup(e: React.FormEvent) {
        e.preventDefault();
        if (!isValid) return;
        window.open(
            statementLookupUrl(id.trim()),
            "_blank",
            "noopener,noreferrer",
        );
    }

    return (
        <form
            onSubmit={handleLookup}
            className="rounded-lg border border-gray-300 dark:border-gray-700 p-4 space-y-3 bg-linear-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800"
        >
            <h2 className="text-sm font-semibold text-white">
                Look up a statement by ID
            </h2>
            <div className="flex gap-2">
                <input
                    type="text"
                    inputMode="numeric"
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    placeholder="e.g. 25505302"
                    className="flex-1 text-white rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                    type="submit"
                    disabled={!isValid}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    Open JSON
                </button>
            </div>
            <p className="text-xs text-gray-500">
                Opens the raw statement data in a new tab. No token needed —
                this is public data.
            </p>
        </form>
    );
}

function App() {
    const snap = useSnapshot(formStore);

    useEffect(() => {
        refreshTokenFromExtension();
        const interval = setInterval(refreshTokenFromExtension, 10_000);
        return () => clearInterval(interval);
    }, []);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        formStore.error = null;
        formStore.result = null;

        let fields: Record<string, unknown>;
        try {
            fields = JSON.parse(formStore.fieldsJson);
        } catch {
            formStore.error = "Listing fields must be valid JSON";
            return;
        }

        if (!formStore.token.trim()) {
            formStore.error = "Paste your current myhome.ge token first";
            return;
        }

        if (formStore.dryRun) {
            formStore.result = { status: 0, data: fields };
            return;
        }

        formStore.submitting = true;
        try {
            formStore.result = await submitStatement(
                formStore.token.trim(),
                fields,
            );
        } catch (err) {
            formStore.error =
                err instanceof Error ? err.message : "Request failed";
        } finally {
            formStore.submitting = false;
        }
    }

    return (
        <div className="mx-auto max-w-2xl p-6 space-y-6">
            <h1 className="text-2xl font-semibold">
                myhome.ge listing submitter
            </h1>

            <StatementLookup />

            <div className="rounded border border-gray-300 dark:border-gray-700 p-3 space-y-2">
                <div className="flex items-center gap-2">
                    <a
                        href={MYHOME_LOGIN_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded bg-gray-800 px-3 py-1.5 text-sm text-white"
                    >
                        Open myhome.ge
                    </a>
                    <button
                        type="button"
                        onClick={() => refreshTokenFromExtension()}
                        disabled={snap.extensionChecking}
                        className="rounded border border-gray-400 px-3 py-1.5 text-sm disabled:opacity-50"
                    >
                        {snap.extensionChecking
                            ? "Checking…"
                            : "Refresh token from extension"}
                    </button>
                </div>
                <p
                    className={`text-xs ${snap.tokenExpiresAt && snap.tokenExpiresAt < Date.now() ? "text-red-600" : "text-gray-500"}`}
                >
                    {snap.extensionMessage}
                    {snap.tokenExpiresAt &&
                        (snap.tokenExpiresAt > Date.now()
                            ? ` Valid for ${Math.round((snap.tokenExpiresAt - Date.now()) / 1000)}s more (expires ${new Date(snap.tokenExpiresAt).toLocaleTimeString()}).`
                            : ` Expired ${Math.round((Date.now() - snap.tokenExpiresAt) / 1000)}s ago — revisit myhome.ge.`)}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label
                        htmlFor="token"
                        className="block text-sm font-medium mb-1"
                    >
                        Auth token (global-authorization)
                    </label>
                    <input
                        id="token"
                        type="text"
                        value={snap.token}
                        onChange={(e) => (formStore.token = e.target.value)}
                        placeholder="Paste the current bearer token from DevTools, or use the extension above"
                        className="w-full rounded border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        This expires ~11 minutes after it was issued, grab a
                        fresh one if requests start failing.
                    </p>
                </div>

                <div>
                    <label
                        htmlFor="fields"
                        className="block text-sm font-medium mb-1"
                    >
                        Listing fields (JSON)
                    </label>
                    <textarea
                        id="fields"
                        value={snap.fieldsJson}
                        onChange={(e) =>
                            (formStore.fieldsJson = e.target.value)
                        }
                        rows={16}
                        spellCheck={false}
                        className="w-full rounded border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm font-mono"
                    />
                </div>

                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={snap.dryRun}
                        onChange={(e) => (formStore.dryRun = e.target.checked)}
                    />
                    Dry run (show payload, don't submit)
                </label>

                <button
                    type="submit"
                    disabled={snap.submitting}
                    className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                    {snap.submitting
                        ? "Submitting…"
                        : snap.dryRun
                          ? "Preview payload"
                          : "Submit listing"}
                </button>
            </form>

            {snap.error && <p className="text-sm text-red-600">{snap.error}</p>}

            {snap.result && (
                <pre className="rounded border border-gray-300 dark:border-gray-700 p-3 text-xs overflow-auto">
                    {JSON.stringify(snap.result, null, 2)}
                </pre>
            )}
        </div>
    );
}

export default App;
