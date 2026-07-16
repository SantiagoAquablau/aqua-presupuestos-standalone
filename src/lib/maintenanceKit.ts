import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { BudgetDraft } from "@/stores/budgetStore";

/** Fixed kit articles always included (by exact article name). */
export const KIT_FIXED_ARTICLE_NAMES = [
  "RECOGE HOJAS CLIP",
  "RACORD LIMPIAFONDOS",
  "LIMPIAFONDO METALICO CLIP",
  "CEPILLO CLIP",
];

const MANGUERA_NAME: Record<string, string> = {
  "8": "MANGUERA AUTOFLOTANTE 8M",
  "10": "MANGUERA AUTOFLOTANTE 10M",
  "12": "MANGUERA AUTOFLOTANTE 12M",
};
const PERTIGA_NAME: Record<string, string> = {
  petita: "PERTIGA PEQUEÑA CLIP",
  mitjana: "PERTIGA MEDIANA CLIP",
  gran: "PERTIGA GRANDE CLIP",
};

export interface KitArticle {
  name: string;
  unitSale: number; // euros
}

export interface KitSummary {
  items: KitArticle[];
  total: number;
}

export function computeMaintenanceKit(
  draft: BudgetDraft,
  articles: Array<{ name: string; sale_price: number | null }>,
): KitSummary {
  const byName: Record<string, number> = {};
  for (const a of articles) {
    byName[a.name.trim().toUpperCase()] = Number(a.sale_price || 0) / 100;
  }
  const lookup = (n: string): KitArticle | null => {
    const sale = byName[n.toUpperCase()];
    if (sale == null) return null;
    return { name: n, unitSale: sale };
  };
  const items: KitArticle[] = [];
  for (const n of KIT_FIXED_ARTICLE_NAMES) {
    const it = lookup(n);
    if (it) items.push(it);
  }
  if (draft.kitMangueraSize) {
    const it = lookup(MANGUERA_NAME[draft.kitMangueraSize]);
    if (it) items.push(it);
  }
  if (draft.kitPertigaSize) {
    const it = lookup(PERTIGA_NAME[draft.kitPertigaSize]);
    if (it) items.push(it);
  }
  const total = items.reduce((s, it) => s + it.unitSale, 0);
  return { items, total };
}

/** Hook that fetches the Manteniment category articles and computes the kit. */
export function useMaintenanceKit(draft: BudgetDraft): KitSummary {
  const { data: articles = [] } = useQuery({
    queryKey: ["manteniment-kit-articles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("articles")
        .select("name, sale_price")
        .eq("category", "Manteniment");
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
  return computeMaintenanceKit(draft, articles as any);
}