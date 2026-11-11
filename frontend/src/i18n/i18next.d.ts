import "i18next";
import type { resources } from "./resources";

/* English is the source of truth for keys: t("...") only accepts keys that
   exist in the English JSON. resources.ts checks Georgian has the same keys. */
declare module "i18next" {
    interface CustomTypeOptions {
        defaultNS: "common";
        resources: (typeof resources)["en"];
        returnNull: false;
    }
}
