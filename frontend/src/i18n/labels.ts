import type enCommon from "./locales/en/common.json";
import { t } from "./index";

/* Stored values (districts, property types, feedback, …) stay in English in
   the database — they are identifiers. Only their on-screen label is
   translated, through these helpers. A value with no translation (e.g. a
   district outside Tbilisi that came from an import) shows as-is. */
export type EnumGroup = keyof typeof enCommon.enums;

export function enumLabel(group: EnumGroup, value: string | null | undefined): string {
    if (value === null || value === undefined || value === "") return "";
    return t(`enums.${group}.${value}` as never, { defaultValue: value }) as string;
}

/* Options for <Select>: the value stays the stored English string. */
export const enumOptions = (group: EnumGroup, values: readonly string[]) =>
    values.map((value) => ({ value, label: enumLabel(group, value) }));
