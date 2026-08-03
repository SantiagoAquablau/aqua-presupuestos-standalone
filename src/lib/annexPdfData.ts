/**
 * Build the `AnnexPdfDocumentData` consumed by `AnnexPdfDocument` from the
 * annex + items + parent budget + comercial profile. Groups items by the
 * `assisted_seeds` saved on the annex; items without a matching seed fall
 * back to a "manual" block titled after the annex.
 */
import { supabase } from "@/integrations/supabase/client";
import type { PdfData } from "@/components/pdf/pdfTypes";
import type {
  AnnexPdfBlock,
  AnnexPdfDocumentData,
  AnnexBlockKind,
} from "@/components/pdf/AnnexPdfDocument";

export type AssistedSeed =
  | "bomba_calor"
  | "robot"
  | "cobertor"
  | "gespa"
  | "paviment"
  | "accessoris_basics"
  | "accessoris_opcionals";

interface SeedMeta {
  label: string;
  subtitle?: string;
  background?: string;
  kind: AnnexBlockKind;
  /** Predicate to attribute an annex item to this seed when we cannot rely on
   *  article category (e.g. user typed it manually but it clearly fits a seed). */
  matches: (descriptionLower: string, articleSubtipus?: string | null, articleCategory?: string | null) => boolean;
}

const SEED_META: Record<AssistedSeed, SeedMeta> = {
  bomba_calor: {
    label: "Climatització",
    subtitle: "BOMBA DE CALOR PER ALLARGAR LA TEMPORADA DE BANY",
    background: "/pdf/fondo_climatizacion.webp",
    kind: "bomba_calor",
    matches: (d, st) => /bomba.*calor|climatitz/i.test(d) || (st || "").toLowerCase().includes("bombes de calor"),
  },
  robot: {
    label: "Robot neteja fons",
    subtitle: "ROBOT NETEJA FONS AUTOMÀTIC",
    kind: "robot",
    matches: (d, st) => /robot/i.test(d) || (st || "").toLowerCase().includes("robots"),
  },
  cobertor: {
    label: "Coberta automàtica",
    subtitle: "COBERTA AUTOMÀTICA DE LAMEL·LES",
    kind: "cobertor",
    matches: (d) => /cobertor|coberta\s+autom/i.test(d),
  },
  gespa: {
    label: "Gespa artificial",
    subtitle: "GESPA ARTIFICIAL DE QUALITAT PREMIUM",
    kind: "gespa",
    matches: (d) => /gespa|c[èe]spede/i.test(d),
  },
  paviment: {
    label: "Paviment perimetral",
    subtitle: "PAVIMENT PERIMETRAL DE LA PISCINA",
    kind: "paviment",
    matches: (d) => /paviment|aplacat|fusta\s+tec|formig[oó]/i.test(d),
  },
  accessoris_basics: {
    label: "Accessoris bàsics",
    subtitle: "ACCESSORIS BÀSICS DE LA PISCINA",
    kind: "accessoris",
    matches: (d, _st, cat) =>
      (cat || "").toLowerCase().includes("accessor") ||
      /impulsor|skimmer|embornal|focus\s+led|regulador|neteja\s*fons|projector/i.test(d),
  },
  accessoris_opcionals: {
    label: "Accessoris opcionals",
    subtitle: "ACCESSORIS OPCIONALS DE LA PISCINA",
    kind: "accessoris",
    matches: (d) => /escala\s+inox|dutxa|cascada|salvavides|barana/i.test(d),
  },
};

function fmtType(t?: string) {
  switch (t) {
    case "obra_nueva":
      return "Obra Nova";
    case "rehabilitacion":
      return "Rehabilitació";
    case "mantenimiento":
      return "Manteniment";
    default:
      return "Obra Nova";
  }
}

export async function buildAnnexPdfData(annexId: string): Promise<AnnexPdfDocumentData> {
  // 1. Load annex + items
  const { data: annex, error: annexErr } = await supabase
    .from("pressupost_annexos" as any)
    .select("*")
    .eq("id", annexId)
    .single();
  if (annexErr || !annex) throw new Error(annexErr?.message || "Annex no trobat");
  const annexAny = annex as any;

  const { data: items, error: itemsErr } = await supabase
    .from("pressupost_annex_items" as any)
    .select("*")
    .eq("annex_id", annexId)
    .order("order", { ascending: true });
  if (itemsErr) throw new Error(itemsErr.message);
  const itemsAny = (items || []) as any[];

  // 2. Load parent budget (for cover info)
  const { data: budget, error: budgetErr } = await supabase
    .from("budgets")
    .select(
      "id, number, type, client_name, client_nif, client_address, client_town, client_phone, client_email, pool_length, pool_width, pool_depth_min, pool_depth_max, pool_volume_liters, pool_surface_irregular, pool_type, pool_shape, interior_stairs_type, has_exterior_stairs, ext_stairs_length, ext_stairs_width, comercial_id",
    )
    .eq("id", annexAny.budget_id)
    .single();
  if (budgetErr || !budget) throw new Error(budgetErr?.message || "Pressupost no trobat");
  const b: any = budget;

  // 3. Resolve articles (for image_url + subtipus + category) referenced by items
  const articleIds = itemsAny
    .map((it) => it.article_id)
    .filter((v): v is string => !!v);
  const articlesMap = new Map<string, any>();
  if (articleIds.length > 0) {
    const { data: arts } = await supabase
      .from("articles")
      .select("id, name, image_url, category, subtipus")
      .in("id", articleIds);
    (arts || []).forEach((a: any) => articlesMap.set(a.id, a));
  }

  // 4. Comercial info (annex.comercial_id with fallback to budget.comercial_id)
  let comercialName: string | undefined;
  let comercialEmail: string | undefined;
  const comercialId = annexAny.comercial_id || b.comercial_id;
  if (comercialId) {
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", comercialId)
        .maybeSingle();
      if (prof) {
        comercialName = (prof as any).full_name || undefined;
        comercialEmail = (prof as any).email || undefined;
      }
    } catch {
      /* ignore */
    }
    if (!comercialName && !comercialEmail) {
      try {
        const { data: list } = await supabase.rpc("list_comercials");
        const m = (list || []).find((r: any) => r.id === comercialId);
        if (m) {
          comercialName = (m as any).full_name || undefined;
          comercialEmail = (m as any).email || undefined;
        }
      } catch {
        /* ignore */
      }
    }
  }

  // 5. Group items into blocks
  const seeds: AssistedSeed[] = Array.isArray(annexAny.assisted_seeds)
    ? (annexAny.assisted_seeds as AssistedSeed[])
    : [];
  const assistedMeta: Record<string, any> = (annexAny.assisted_meta as any) || {};

  const used = new Set<string>();
  const globalPct = Number(annexAny.global_pct || 0);
  const pctFactor = 1 + globalPct / 100;

  // Raw line total in EUROS (qty × unit_sale × global_pct). unit_sale is in cents.
  const itemRawSaleEuros = (it: any) =>
    ((Number(it.quantity) || 0) * (Number(it.unit_sale) || 0) * pctFactor) / 100;
  // Per-line CEIL rounding to whole euros — matches wizard's "Total venda" column,
  // so the PDF shows the same values the comercial sees in the annex table.
  const itemCeilSale = (it: any) => Math.ceil(itemRawSaleEuros(it));

  const itemToBullet = (it: any) => {
    const art = it.article_id ? articlesMap.get(it.article_id) : undefined;
    return {
      description: it.description || art?.name || "—",
      quantity: Number(it.quantity) || 0,
      unit: it.unit || "ud",
      totalSale: itemCeilSale(it),
      imageUrl: art?.image_url || undefined,
    };
  };

  const blocks: AnnexPdfBlock[] = [];

  for (const seed of seeds) {
    const meta = SEED_META[seed];
    if (!meta) continue;
    const savedMeta = assistedMeta[seed] || {};
    // Prefer explicit article_ids saved by the assisted flow; fall back to regex.
    const savedIds: string[] = Array.isArray(savedMeta.article_ids)
      ? savedMeta.article_ids
      : savedMeta.article_id
        ? [savedMeta.article_id]
        : [];
    const idSet = new Set(savedIds);
    const matching = itemsAny.filter((it) => {
      if (used.has(it.id)) return false;
      if (idSet.size > 0) {
        return it.article_id && idSet.has(it.article_id);
      }
      const art = it.article_id ? articlesMap.get(it.article_id) : undefined;
      const desc = String(it.description || "").toLowerCase();
      return meta.matches(desc, art?.subtipus, art?.category);
    });
    if (matching.length === 0) continue;
    matching.forEach((it) => used.add(it.id));
    const bullets = matching.map(itemToBullet);
    const totalEuros = matching.reduce((s, it) => s + itemCeilSale(it), 0);
    const seedMeta = savedMeta;
    blocks.push({
      key: seed,
      kind: meta.kind,
      sectionLabel: meta.label,
      subtitle: meta.subtitle,
      bullets,
      total: totalEuros,
      backgroundImageUrl: meta.background,
      pdfData: buildSeedPdfData(seed, seedMeta, matching, articlesMap, totalEuros, b),
      accessorisVariant:
        seed === "accessoris_basics"
          ? "basics"
          : seed === "accessoris_opcionals"
            ? "opcionals"
            : undefined,
    });
  }

  // Remaining items → manual block (one only, titled after the annex)
  const leftover = itemsAny.filter((it) => !used.has(it.id));
  if (leftover.length > 0) {
    const bullets = leftover.map(itemToBullet);
    const totalEuros = leftover.reduce((s, it) => s + itemCeilSale(it), 0);
    blocks.push({
      key: "manual",
      kind: "manual",
      sectionLabel: annexAny.title || "Treballs a realitzar",
      subtitle: undefined,
      bullets,
      total: totalEuros,
      reason: annexAny.reason || undefined,
    });
  }

  // 6. Build cover PdfData with the minimum fields PageCover needs
  const depthAvg =
    b.pool_depth_min && b.pool_depth_max ? (b.pool_depth_min + b.pool_depth_max) / 2 : 0;
  const volumeM3 =
    b.pool_shape === "irregular"
      ? b.pool_surface_irregular && depthAvg
        ? Math.round(b.pool_surface_irregular * depthAvg)
        : undefined
      : b.pool_length && b.pool_width && depthAvg
        ? Math.round(b.pool_length * b.pool_width * depthAvg)
        : undefined;

  const cover: PdfData = {
    budgetNumber: annexAny.number,
    budgetDate: annexAny.annex_date || new Date().toISOString(),
    type: `Annex · ${fmtType(b.type)}`,
    clientName: b.client_name || "—",
    clientNif: b.client_nif,
    clientAddress: b.client_address,
    clientTown: b.client_town,
    clientPhone: b.client_phone,
    clientEmail: b.client_email,
    comercialName,
    comercialEmail,
    poolLength: b.pool_length,
    poolWidth: b.pool_width,
    poolDepthMin: b.pool_depth_min,
    poolDepthMax: b.pool_depth_max,
    poolVolumeM3: volumeM3,
    poolSurfaceM2: b.pool_shape === "irregular" ? b.pool_surface_irregular ?? undefined : undefined,
    poolType: b.pool_type,
    poolShape: b.pool_shape,
    interiorStairsType: b.interior_stairs_type,
    hasInteriorStairs: !!b.interior_stairs_type && b.interior_stairs_type !== "sense",
    hasExteriorStairs: b.has_exterior_stairs,
    extStairsLength: b.ext_stairs_length,
    extStairsWidth: b.ext_stairs_width,
    // The remaining PdfData fields are not used by PageCover / PageContacte.
    phaseStructuralTotal: 0,
    phaseAcabatsTotal: 0,
    phaseDepuracioTotal: 0,
    phaseElectricitatTotal: 0,
    totalSale: 0,
  };

  // 7. Total = sum of CEILED block totals (matches per-line wizard display).
  const total = blocks.reduce((s, blk) => s + (blk.total || 0), 0);

  return {
    cover,
    annexNumber: annexAny.number,
    budgetNumber: b.number,
    reason: annexAny.reason || undefined,
    blocks,
    total,
    globalPct: globalPct || undefined,
    comercialName,
    comercialEmail,
  };
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Per-seed PdfData builder. Pulls from assisted_meta when present, otherwise
 * falls back to the items themselves (legacy annexes without saved meta).
 * ────────────────────────────────────────────────────────────────────────────── */
function emptyPdfData(): PdfData {
  return {
    budgetNumber: "",
    budgetDate: new Date().toISOString(),
    type: "Annex",
    clientName: "",
    phaseStructuralTotal: 0,
    phaseAcabatsTotal: 0,
    phaseDepuracioTotal: 0,
    phaseElectricitatTotal: 0,
    totalSale: 0,
  };
}

function buildSeedPdfData(
  seed: AssistedSeed,
  meta: any,
  items: any[],
  articlesMap: Map<string, any>,
  totalEuros: number,
  budget: any,
): PdfData {
  const d = emptyPdfData();
  const firstItem = items[0];
  const firstArticle = firstItem?.article_id ? articlesMap.get(firstItem.article_id) : undefined;

  switch (seed) {
    case "robot": {
      const name = meta.name || firstArticle?.name || firstItem?.description || "Robot netejafons";
      d.annexRobotName = name;
      d.annexRobotImageUrl = meta.image_url || firstArticle?.image_url || undefined;
      d.annexRobotQty = meta.qty || Number(firstItem?.quantity) || 1;
      d.annexRobotAmount = totalEuros;
      d.annexRobotModel = /P\s*7/i.test(name) ? "P7" : "P3";
      break;
    }
    case "bomba_calor": {
      const name = meta.name || firstArticle?.name || firstItem?.description || "Bomba de calor";
      d.annexBombaCalorName = name;
      d.annexBombaCalorImageUrl = meta.image_url || firstArticle?.image_url || undefined;
      d.annexBombaCalorAmount = totalEuros;
      d.annexBombaCalorCoberta = !!meta.coberta;
      d.annexBombaCalorTemperatura = meta.temperatura ?? 27;
      const y = new Date().getFullYear();
      d.annexBombaCalorDesde = meta.desde || `${y}-05-01`;
      d.annexBombaCalorFinsA = meta.fins_a || `${y}-09-30`;
      break;
    }
    case "gespa": {
      d.annexGespaModelName = meta.model_name || firstArticle?.name || firstItem?.description;
      d.annexGespaModelMm = (meta.model_mm as 35 | 38 | 45) || 35;
      const m2 = Number(meta.m2 || firstItem?.quantity || 0);
      d.annexGespaM2 = m2;
      // unit_sale stored in cents
      const unitSaleEuros = firstItem ? Number(firstItem.unit_sale || 0) / 100 : 0;
      d.annexGespaPricePerM2 = meta.price_per_m2 ?? unitSaleEuros;
      d.annexGespaPreparacioIncluded = !!meta.preparacio_inclosa;
      d.annexGespaAmount = totalEuros;
      break;
    }
    case "paviment": {
      d.annexPavimentMaterial = meta.material || "aplacat";
      d.annexPavimentFormat = meta.format || "48 × 98 cm";
      d.annexPavimentNouEnabled = true;
      d.annexPavimentActuacio = meta.actuacio || "suministre_col";
      d.annexPavimentM2 = Number(meta.m2 || 0);
      d.annexPavimentModelName = meta.model_name || firstArticle?.name;
      d.annexPavimentNouTotal = Number(meta.nou_total ?? totalEuros);
      d.annexPavimentFormigoEnabled = !!meta.formigo_enabled;
      d.annexPavimentFormigoM2 = Number(meta.formigo_m2 || 0);
      d.annexPavimentFormigoTotal = Number(meta.formigo_total || 0);
      d.annexPavimentAmount = totalEuros;
      break;
    }
    case "cobertor": {
      d.annexCobertorTipus = (meta.tipus as any) || "fora_aigua";
      d.annexCobertorLames = (meta.lames as any) || "pvc";
      d.annexCobertorModelName = meta.model_name || firstItem?.description;
      d.annexCobertorModelCode = meta.model_code || "";
      d.annexCobertorAmount = totalEuros;
      d.poolLength = budget?.pool_length;
      d.poolWidth = budget?.pool_width;
      break;
    }
  }
  return d;
}