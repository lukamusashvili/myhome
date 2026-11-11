import { lazy, Suspense, useEffect, useRef } from "react";
import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useApp, useHydration } from "./store/store";
import { getSession } from "./lib/auth";
import { SidebarContent, Topbar, MobileNav, MoreSheet, BootSkeleton } from "./components/shell";
import { ModalHost } from "./components/modals";
import { Toasts } from "./components/ui";
import { extensionConfigured, isExtensionCapableBrowser, isExtensionInstalled } from "./lib/extension";

import Dashboard from "./pages/Dashboard";
import Properties from "./pages/Properties";
import PropertyDetails from "./pages/PropertyDetails";
import Clients from "./pages/Clients";
import ClientProfile from "./pages/ClientProfile";
import Tasks from "./pages/Tasks";
import Shared from "./pages/Shared";
import Inquiries from "./pages/Inquiries";

// Less-used screens load on first visit, keeping the first download small.
const PrepareOffer = lazy(() => import("./pages/PrepareOffer"));
const Matching = lazy(() => import("./pages/Matching"));
const ImportProperty = lazy(() => import("./pages/ImportProperty"));
const ArchiveTrash = lazy(() => import("./pages/ArchiveTrash"));
const Settings = lazy(() => import("./pages/Settings"));
const TrialExpired = lazy(() => import("./pages/TrialExpired"));
const Help = lazy(() => import("./pages/Help"));
const Admin = lazy(() => import("./pages/Admin"));

function Screen() {
    const { route, myRole } = useApp();
    switch (route.name) {
        case "dashboard": return <Dashboard />;
        case "properties": return <Properties />;
        case "property": return <PropertyDetails id={route.params.id as string} />;
        case "clients": return <Clients />;
        case "client": return <ClientProfile id={route.params.id as string} />;
        case "matching": return <Matching reqId={route.params.reqId as string} />;
        case "offer": return <PrepareOffer clientId={route.params.clientId as string} ids={route.params.ids as string[]} reqId={route.params.reqId as string | undefined} />;
        case "tasks": return <Tasks />;
        case "shared": return <Shared />;
        case "import": return <ImportProperty />;
        case "inquiries": return <Inquiries />;
        case "archive": return <ArchiveTrash />;
        case "settings": return <Settings />;
        case "trial": return <TrialExpired />;
        case "help": return <Help />;
        case "admin": return myRole === "admin" ? <Admin /> : <Dashboard />;
        default: return <Dashboard />;
    }
}

// Once per page load (App remounts on language switch, so not component state).
let extensionPromptDone = false;

/* Nearly everything that touches MyHome.ge/SS.ge needs the extension, so on
   desktop Chrome/Edge the install modal opens by itself when it's missing.
   Phones and other browsers can't run it and are never prompted. */
function useExtensionInstallPrompt(hydrated: boolean, modalOpen: boolean, openModal: (type: string) => void) {
    const modalOpenRef = useRef(modalOpen);
    modalOpenRef.current = modalOpen;
    useEffect(() => {
        if (!hydrated || extensionPromptDone || !extensionConfigured || !isExtensionCapableBrowser()) return;
        extensionPromptDone = true;
        void isExtensionInstalled().then((installed) => {
            if (!installed && !modalOpenRef.current) openModal("extension");
        });
    }, [hydrated, openModal]);
}

function App() {
    // AuthGate only renders App once a session exists and is approved.
    useHydration(getSession()?.user.id ?? null);
    const { t } = useTranslation();
    const { hydrated, readOnly, route, nav, toasts, drawer, sheet, setDrawer, setSheet, modal, openModal } = useApp();
    useExtensionInstallPrompt(hydrated, modal !== null, openModal);

    return (
        <div className="ew-root">
            <div className="shell">
                <div className="sidebar"><SidebarContent /></div>
                <div className="main">
                    <Topbar onMenu={() => setDrawer(true)} />
                    {hydrated && readOnly && route.name !== "trial" && (
                        <div className="banner">
                            <Lock size={14} />
                            <span className="grow">{t("app.readOnlyBanner")}</span>
                            <button className="btn btn-sm btn-secondary" onClick={() => nav("trial")}>{t("app.seeOptions")}</button>
                        </div>
                    )}
                    {hydrated ? <Suspense fallback={<BootSkeleton />}><Screen /></Suspense> : <BootSkeleton />}
                </div>
            </div>

            {drawer && (
                <>
                    <div className="drawer-back" onClick={() => setDrawer(false)} />
                    <div className="drawer"><SidebarContent onClose={() => setDrawer(false)} /></div>
                </>
            )}
            {sheet && <MoreSheet onClose={() => setSheet(false)} />}
            <MobileNav onMore={() => setSheet(true)} />
            <ModalHost />
            <Toasts toasts={toasts} />
        </div>
    );
}

/* Switching language remounts the app, so text computed outside render
   (memoised lists, matching explanations) is rebuilt in the new language.
   The data store is untouched. */
export function LocalizedApp() {
    const { i18n } = useTranslation();
    return <App key={i18n.resolvedLanguage} />;
}

export default App;
