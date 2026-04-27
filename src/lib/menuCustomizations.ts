import { supabase } from "@/integrations/supabase/client";

export type MenuCustomKind = "group" | "item";

export interface MenuCustomization {
  key: string;
  kind: MenuCustomKind;
  sort_order: number;
  name_en: string | null;
  name_ar: string | null;
  hidden: boolean;
  icon: string | null;
}

export type CustomMap = Record<string, MenuCustomization>;

export const groupKey = (label: string) => `group:${label}`;
export const itemKey = (url: string) => `item:${url}`;

export async function fetchMenuCustomizations(): Promise<CustomMap> {
  const { data, error } = await supabase
    .from("menu_customizations")
    .select("key, kind, sort_order, name_en, name_ar, hidden, icon");
  if (error || !data) return {};
  const map: CustomMap = {};
  for (const row of data as MenuCustomization[]) map[row.key] = row;
  return map;
}
