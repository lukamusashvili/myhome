import enCommon from "./locales/en/common.json";
import enAccount from "./locales/en/account.json";
import enProperties from "./locales/en/properties.json";
import enClients from "./locales/en/clients.json";
import enWorkspace from "./locales/en/workspace.json";
import enModals from "./locales/en/modals.json";
import enAdmin from "./locales/en/admin.json";

import kaCommon from "./locales/ka/common.json";
import kaAccount from "./locales/ka/account.json";
import kaProperties from "./locales/ka/properties.json";
import kaClients from "./locales/ka/clients.json";
import kaWorkspace from "./locales/ka/workspace.json";
import kaModals from "./locales/ka/modals.json";
import kaAdmin from "./locales/ka/admin.json";

/* One namespace per area of the app:
     common     shared words, nav, enum labels, dates, toasts, errors, ui/shell
     account    sign-in, settings, trial, help
     properties property list/details/import
     clients    clients, client profile, matching, offers
     workspace  dashboard, tasks, shared, inquiries, archive & trash
     modals     every modal in components/modals.tsx, publishing
     admin      the admin screen */
const en = {
    common: enCommon,
    account: enAccount,
    properties: enProperties,
    clients: enClients,
    workspace: enWorkspace,
    modals: enModals,
    admin: enAdmin,
};

/* Same keys as English, enforced at compile time (a missing Georgian key is
   a type error). Values are any string. */
type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };
const ka: Shape<typeof en> = {
    common: kaCommon,
    account: kaAccount,
    properties: kaProperties,
    clients: kaClients,
    workspace: kaWorkspace,
    modals: kaModals,
    admin: kaAdmin,
};

export const resources = { en, ka };
