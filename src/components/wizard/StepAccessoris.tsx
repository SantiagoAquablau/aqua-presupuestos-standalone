import { useBudgetStore } from "@/stores/budgetStore";
import { EquipmentSelector, SelectedArticle } from "@/components/wizard/EquipmentSelector";
import { ArrowLeft, ArrowRight, Info, Minus, Plus, X } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";

// --- LED variant logic (multi-select: embellidor + llum are independent axes) ---

type LedVariants = { embellidor: "blanc" | "color"; llum: "blanc" | "calida" | "intensa" };

function parseLedVariant(variantStr: string | undefined): LedVariants {
  if (!variantStr) return { embellidor: "blanc", llum: "blanc" };
  // Support legacy single-value format
  if (variantStr === "color") return { embellidor: "color", llum: "blanc" };
  if (variantStr === "calida") return { embellidor: "blanc", llum: "calida" };
  if (variantStr === "intensa") return { embellidor: "blanc", llum: "intensa" };
  if (variantStr === "blanc") return { embellidor: "blanc", llum: "blanc" };
  // New combined format: "color|calida"
  const parts = variantStr.split("|");
  return {
    embellidor: (parts[0] as LedVariants["embellidor"]) || "blanc",
    llum: (parts[1] as LedVariants["llum"]) || "blanc",
  };
}

function encodeLedVariant(v: LedVariants): string {
  return `${v.embellidor}|${v.llum}`;
}

function applyLedVariants(articleName: string, variants: LedVariants): string {
  let text = articleName;
  if (variants.embellidor === "color") {
    text = text.replace(/EMBELLIDOR BLANC/gi, "EMBELLIDOR COLOR");
  }
  if (variants.llum === "calida") {
    text = text.replace(/PUNT DE LLUM BLANC\w?\s*AC/gi, "PUNT DE LLUM CÀLIDA AC");
  } else if (variants.llum === "intensa") {
    text = text.replace(/PUNT DE LLUM BLANC\w?\s*AC/gi, "PUNT DE LLUM INTENSA AC");
  }
  return text;
}

const EMBELLIDOR_VARIANTS = [
  { key: "blanc" as const, label: "Embellidor blanc" },
  { key: "color" as const, label: "Embellidor color" },
];

const LLUM_VARIANTS = [
  { key: "blanc" as const, label: "Llum blanc AC" },
  { key: "calida" as const, label: "Llum càlida" },
  { key: "intensa" as const, label: "Llum intensa" },
];

// --- Accessory config ---

interface AccessoryConfig {
  key: string;
  name: string;
  subtipus: string;
  defaultArticleName: string;
  calcQty: (l: number, w: number) => number;
  subtitle: (l: number, w: number) => string;
}

const BASIC_ACCESSORIES: AccessoryConfig[] = [
  {
    key: "impulsors",
    name: "IMPULSORS",
    subtipus: "Impulsors",
    defaultArticleName: "BOQUILLA IMPULSIÓN MULTIFLOW (HORMIGON)",
    calcQty: (_l, w) => Math.round(w),
    subtitle: (_l, w) => `Calculat: ample piscina arrodonit (${Math.round(w)})`,
  },
  {
    key: "skimmers",
    name: "SKIMMERS",
    subtipus: "Skimmers",
    defaultArticleName: "SKIMMER BOCA STANDARD TAPA CIRCULA ASTRAL (HORMIGON)",
    calcQty: (l, w) => {
      const s = l * w;
      if (s <= 25) return 1;
      if (s <= 50) return 2;
      if (s <= 75) return 3;
      return 4;
    },
    subtitle: (l, w) => `Calculat: superfície piscina (${(l * w).toFixed(1)}m²)`,
  },
  {
    key: "embornal",
    name: "EMBORNAL",
    subtipus: "Embornal",
    defaultArticleName: "SUMIDERO 210mm STANDARD (HORMIGON)",
    calcQty: () => 1,
    subtitle: () => "Quantitat fixa: 1 unitat",
  },
  {
    key: "focus_led",
    name: "FOCUS LED",
    subtipus: "Focus LED",
    defaultArticleName: "76576 - FLEXINICHE: EMBELLIDOR BLANC + PUNT DE LLUM BLANC AC + NÍNXOL + PASSACABLES - FORMIGÓ",
    calcQty: (l) => {
      if (l <= 5) return 1;
      if (l < 7.5) return 2;
      if (l < 11) return 3;
      return 4;
    },
    subtitle: (l) => `Calculat: llarg piscina (${l}m)`,
  },
  {
    key: "projector_mini_led",
    name: "PROJECTORS MINI LED",
    subtipus: "Projectors Mini LED",
    defaultArticleName: "",
    calcQty: () => 0,
    subtitle: () => "Selecció manual",
  },
  {
    key: "regulador",
    name: "REGULADOR DE NIVELL + BOQUILLA",
    subtipus: "Regulador de nivell",
    defaultArticleName: "REGULADOR DE NIVEL ASTRAL + REGULADOR DE PRESIÓN (HORMIGON)",
    calcQty: () => 1,
    subtitle: () => "Quantitat fixa: 1 unitat",
  },
  {
    key: "netejafons",
    name: "PRESA NETEJAFONS",
    subtipus: "Presa netejafons",
    defaultArticleName: "BOQUILLA ASPIRACIÓN D50 PN10 ENCOLAR (HORMIGON)",
    calcQty: () => 1,
    subtitle: () => "Quantitat fixa: 1 unitat",
  },
];

interface OptionalConfig {
  key: string;
  name: string;
  subtitle: string;
  subtipus: string;
  hasModel: boolean;
  fixedPrice?: number;
}

const OPTIONAL_ACCESSORIES: OptionalConfig[] = [
  {
    key: "escala",
    name: "ESCALA INOX",
    subtitle: "Escala d'acer inoxidable exterior",
    subtipus: "Escala inox",
    hasModel: true,
  },
  {
    key: "dutxa",
    name: "DUTXA EXTERIOR",
    subtitle: "Dutxa de jardí amb connexió",
    subtipus: "Dutxa exterior",
    hasModel: true,
  },
  {
    key: "plat_dutxa",
    name: "PLAT DE DUTXA",
    subtitle: "Plat de dutxa exterior",
    subtipus: "Plat de dutxa",
    hasModel: false,
    fixedPrice: 550,
  },
  { key: "cascada", name: "CASCADA", subtitle: "Cascada decorativa", subtipus: "Cascada", hasModel: true },
  {
    key: "salvavides",
    name: "SALVAVIDES + SUPORT PARET",
    subtitle: "Salvavides amb suport de paret",
    subtipus: "Salvavides + Suport paret",
    hasModel: true,
  },
  {
    key: "barana",
    name: "BARANA ANCORADA EXTERIOR",
    subtitle: "Barana d'acer inoxidable ancorada a l'exterior",
    subtipus: "Barana",
    hasModel: true,
  },
];

// --- Store key maps ---
const basicQtyKey = (k: string) => {
  const map: Record<string, string> = {
    impulsors: "accImpulsorsQty",
    skimmers: "accSkimmersQty",
    embornal: "accEmbornalQty",
    focus_led: "accFocusLedQty",
    projector_mini_led: "accProjectorMiniLedQty",
    regulador: "accReguladorQty",
    netejafons: "accNetejafonsQty",
  };
  return map[k];
};
const basicModelKey = (k: string) => {
  const map: Record<string, string> = {
    impulsors: "accImpulsorsModelId",
    skimmers: "accSkimmersModelId",
    embornal: "accEmbornalModelId",
    focus_led: "accFocusLedModelId",
    projector_mini_led: "accProjectorMiniLedModelId",
    regulador: "accReguladorModelId",
    netejafons: "accNetejafonsModelId",
  };
  return map[k];
};

const optEnabledKey = (k: string) => {
  const map: Record<string, string> = {
    escala: "accEscalaEnabled",
    dutxa: "accDutxaEnabled",
    plat_dutxa: "accPlatDutxaEnabled",
    cascada: "accCascadaEnabled",
    salvavides: "accSalvavidesEnabled",
    barana: "accBaranaEnabled",
  };
  return map[k];
};
const optQtyKey = (k: string) => {
  const map: Record<string, string> = {
    escala: "accEscalaQty",
    dutxa: "accDutxaQty",
    plat_dutxa: "accPlatDutxaQty",
    cascada: "accCascadaQty",
    salvavides: "accSalvavidesQty",
    barana: "accBaranaQty",
  };
  return map[k];
};
const optModelKey = (k: string) => {
  const map: Record<string, string> = {
    escala: "accEscalaModelId",
    dutxa: "accDutxaModelId",
    cascada: "accCascadaModelId",
    salvavides: "accSalvavidesModelId",
    barana: "accBaranaModelId",
  };
  return map[k];
};

export function StepAccessoris() {
  const { setStep, currentStep, draft, updateDraft } = useBudgetStore();
  const poolLength = draft.poolLength || 0;
  const poolWidth = draft.poolWidth || 0;
  const isMobile = useIsMobile();
  const isTablet = !isMobile && typeof window !== "undefined" && window.innerWidth < 1024;

  const [articleCache, setArticleCache] = useState<Record<string, SelectedArticle>>({});
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);

  // Load cached articles for already-selected models on mount
  useEffect(() => {
    const allIds = [
      ...BASIC_ACCESSORIES.map((a) => (draft as any)[basicModelKey(a.key)]),
      ...OPTIONAL_ACCESSORIES.filter((a) => a.hasModel).map((a) => (draft as any)[optModelKey(a.key)]),
      draft.accControlRgbModelId,
      draft.accCascadaBombaArticleId,
      draft.accCascadaPulsadorArticleId,
    ].filter(Boolean) as string[];
    if (allIds.length === 0) return;
    supabase
      .from("articles")
      .select("id, name, reference, image_url, suppliers:supplier_id(name)")
      .in("id", allIds)
      .then(({ data }) => {
        const cache: Record<string, SelectedArticle> = {};
        data?.forEach((a: any) => {
          cache[a.id] = {
            id: a.id,
            name: a.name,
            reference: a.reference,
            image_url: a.image_url,
            supplierName: a.suppliers?.name,
          };
        });
        setArticleCache((prev) => ({ ...prev, ...cache }));
      });
  }, []);

  // FIX 3: Auto-select default models for new budgets
  useEffect(() => {
    if (defaultsLoaded) return;
    // Only for new budgets (no saved model ids yet)
    const hasAnyModel = BASIC_ACCESSORIES.some((a) => (draft as any)[basicModelKey(a.key)]);
    if (hasAnyModel) {
      setDefaultsLoaded(true);
      return;
    }

    const defaultNames = BASIC_ACCESSORIES.map((a) => a.defaultArticleName);
    supabase
      .from("articles")
      .select("id, name, reference, image_url, suppliers:supplier_id(name)")
      .eq("category", "Accessoris")
      .in("name", defaultNames)
      .then(({ data }) => {
        if (!data || data.length === 0) {
          setDefaultsLoaded(true);
          return;
        }
        const updates: Record<string, any> = {};
        const newCache: Record<string, SelectedArticle> = {};
        for (const acc of BASIC_ACCESSORIES) {
          const match = data.find((a: any) => a.name === acc.defaultArticleName);
          if (match) {
            const article: SelectedArticle = {
              id: match.id,
              name: match.name,
              reference: match.reference,
              image_url: match.image_url,
              supplierName: (match as any).suppliers?.name,
            };
            updates[basicModelKey(acc.key)] = match.id;
            newCache[match.id] = article;
            // For focus_led, also set the variant text
            if (acc.key === "focus_led") {
              const variants = parseLedVariant(draft.accFocusLedVariant);
              updates.accFocusLedText = applyLedVariants(match.name, variants);
            }
          }
        }
        if (Object.keys(updates).length > 0) {
          updateDraft(updates);
          setArticleCache((prev) => ({ ...prev, ...newCache }));
        }
        setDefaultsLoaded(true);
      });
  }, [defaultsLoaded]);

  // Auto-calculate quantities on mount if not yet set
  useEffect(() => {
    if (poolLength <= 0 || poolWidth <= 0) return;
    const updates: Record<string, any> = {};
    for (const acc of BASIC_ACCESSORIES) {
      const qKey = basicQtyKey(acc.key);
      const currentQty = (draft as any)[qKey];
      if (currentQty === undefined || currentQty === null || currentQty === 0) {
        updates[qKey] = acc.calcQty(poolLength, poolWidth);
      }
    }
    if (Object.keys(updates).length > 0) updateDraft(updates);
  }, [poolLength, poolWidth]);

  const getBasicQty = (key: string) => (draft as any)[basicQtyKey(key)] || 0;
  const getBasicModel = (key: string): SelectedArticle | null => {
    const id = (draft as any)[basicModelKey(key)];
    return id ? articleCache[id] || null : null;
  };

  const handleBasicQtyChange = (key: string, delta: number) => {
    const current = getBasicQty(key);
    const next = Math.max(0, current + delta);
    const updates: Record<string, any> = { [basicQtyKey(key)]: next };
    if (next === 0) updates[basicModelKey(key)] = undefined;
    updateDraft(updates);
  };

  const handleBasicModelChange = (key: string, article: SelectedArticle | null) => {
    if (article) {
      setArticleCache((prev) => ({ ...prev, [article.id]: article }));
      const updates: Record<string, any> = { [basicModelKey(key)]: article.id };
      if (key === "focus_led") {
        const variants = parseLedVariant(draft.accFocusLedVariant);
        updates.accFocusLedText = applyLedVariants(article.name, variants);
      }
      updateDraft(updates);
    } else {
      const updates: Record<string, any> = { [basicModelKey(key)]: undefined };
      if (key === "focus_led") updates.accFocusLedText = undefined;
      updateDraft(updates);
    }
  };

  const handleLedEmbellidorChange = (key: "blanc" | "color") => {
    const model = getBasicModel("focus_led");
    const current = parseLedVariant(draft.accFocusLedVariant);
    const updated = { ...current, embellidor: key };
    const encoded = encodeLedVariant(updated);
    updateDraft({
      accFocusLedVariant: encoded,
      accFocusLedText: model ? applyLedVariants(model.name, updated) : undefined,
    });
  };

  const handleLedLlumChange = (key: "blanc" | "calida" | "intensa") => {
    const model = getBasicModel("focus_led");
    const current = parseLedVariant(draft.accFocusLedVariant);
    const updated = { ...current, llum: key };
    const encoded = encodeLedVariant(updated);
    updateDraft({
      accFocusLedVariant: encoded,
      accFocusLedText: model ? applyLedVariants(model.name, updated) : undefined,
    });
  };

  // When the user toggles the basic accessories color (blanc/color), keep the
  // Focus LED "embellidor" variant in sync so the visual finish matches the
  // rest of the basic accessories automatically.
  useEffect(() => {
    const desired: "blanc" | "color" = (draft.accBasicsColor ?? "blanc") === "color" ? "color" : "blanc";
    const current = parseLedVariant(draft.accFocusLedVariant);
    if (current.embellidor === desired) return;
    const updated = { ...current, embellidor: desired };
    const model = getBasicModel("focus_led");
    updateDraft({
      accFocusLedVariant: encodeLedVariant(updated),
      accFocusLedText: model ? applyLedVariants(model.name, updated) : draft.accFocusLedText,
    });
  }, [draft.accBasicsColor, articleCache, draft.accFocusLedModelId]);

  // Auto-select RGB control based on the chosen Focus LED / Projector Mini LED model.
  // Mappings (only when the focus model name contains "RGB"):
  //   - "PLUG & PLAY"          → 76292 - CONTROL REMOT PLUG & PLAY
  //   - "METRE TIRA LED NEON T2 RGB" → EMISOR BS-66209 + RECEPTOR BS-31501 (TIRAS LED)
  //   - "BSLIGHT RGB"          → CONTROL 16 BSLIGHT
  //   - any other RGB          → 76290 - CONTROL·LADOR LUMIPLUS CONNECT (WIFI-APP) + CONTROL REMOTO PLUG & PLAY 76292
  // The user can still manually override the selection.
  // A lighting model triggers RGB control selection when its name contains
  // "RGB" OR when it is a "FLEXI CONNECT" lamp (which uses the LUMIPLUS
  // CONNECT WIFI-APP controller even though the name does not include RGB).
  const isRgbTrigger = (name?: string | null) => {
    const n = (name || '').toUpperCase();
    return /RGB/.test(n) || /FLEXI\s*CONNECT/.test(n);
  };
  const [rgbAutoAppliedFor, setRgbAutoAppliedFor] = useState<string | null>(null);
  useEffect(() => {
    const candidates: Array<{ name?: string } | null> = [
      getBasicModel('focus_led'),
      getBasicModel('projector_mini_led'),
    ];
    const rgbModel = candidates.find((m) => m && isRgbTrigger(m.name));
    const triggerKey = rgbModel ? String((rgbModel as any).id || rgbModel.name) : '';
    if (!rgbModel) {
      if (rgbAutoAppliedFor !== null) setRgbAutoAppliedFor(null);
      // Clear any previously auto-selected RGB controller and qty so it
      // doesn't keep showing up in the financial summary when the user
      // switches to non-RGB lighting.
      if (draft.accControlRgbModelId || (draft.accControlRgbQty ?? 0) > 0) {
        updateDraft({ accControlRgbModelId: undefined, accControlRgbQty: 0 });
      }
      return;
    }
    if (triggerKey === rgbAutoAppliedFor) return;

    const name = (rgbModel.name || '').toUpperCase();
    let targetMatchers: string[] = [];
    if (name.includes('FLEXI CONNECT') || name.includes('FLEXICONNECT')) {
      // LUMIPLUS CONNECT controller (76290) only — no PLUG & PLAY remote.
      targetMatchers = ['76290', 'LUMIPLUS CONNECT'];
    } else if (name.includes('PLUG & PLAY') || name.includes('PLUG&PLAY')) {
      targetMatchers = ['76292', 'CONTROL REMOT PLUG'];
    } else if (name.includes('METRE TIRA LED NEON T2')) {
      targetMatchers = ['BS-66209', 'TIRAS LED'];
    } else if (name.includes('BSLIGHT')) {
      targetMatchers = ['CONTROL 16 BSLIGHT', 'BSLIGHT'];
    } else {
      // Combined controller: "76290 ... + CONTROL REMOTO PLUG & PLAY 76292"
      targetMatchers = ['76292', 'PLUG & PLAY 76292', '76290'];
    }

    let cancelled = false;
    (async () => {
      const orFilter = targetMatchers.map((t) => `name.ilike.%${t}%`).join(',');
      const { data } = await supabase
        .from('articles')
        .select('id, name, reference, image_url, suppliers:supplier_id(name)')
        .eq('subtipus', 'Control RGB')
        .or(orFilter)
        .limit(5);
      if (cancelled || !data || data.length === 0) {
        setRgbAutoAppliedFor(triggerKey);
        return;
      }
      // Prefer the article matching ALL strong tokens (combined model wins
      // over the standalone 76290). Fall back to first matcher otherwise.
      const upper = (s: string) => (s || '').toUpperCase();
      // For FLEXI CONNECT we want the standalone 76290 controller, NOT the
      // combined "76290 + PLUG & PLAY 76292" article.
      const isFlexiConnect = name.includes('FLEXI CONNECT') || name.includes('FLEXICONNECT');
      const pool = isFlexiConnect
        ? data.filter((a: any) => !upper(a.name).includes('PLUG'))
        : data;
      const source = pool.length > 0 ? pool : data;
      const allMatch = source.find((a: any) =>
        targetMatchers.every((t) => upper(a.name).includes(t.toUpperCase()))
      );
      const primary = targetMatchers[0].toUpperCase();
      const best =
        allMatch ||
        source.find((a: any) => upper(a.name).includes(primary)) ||
        source[0];
      const article: SelectedArticle = {
        id: best.id,
        name: best.name,
        reference: best.reference,
        image_url: best.image_url,
        supplierName: (best as any).suppliers?.name,
      };
      setArticleCache((prev) => ({ ...prev, [article.id]: article }));
      updateDraft({ accControlRgbModelId: article.id });
      setRgbAutoAppliedFor(triggerKey);
    })();
    return () => {
      cancelled = true;
    };
  }, [draft.accFocusLedModelId, draft.accProjectorMiniLedModelId, articleCache]);

  const getOptEnabled = (key: string) => (draft as any)[optEnabledKey(key)] || false;
  const getOptQty = (key: string) => (draft as any)[optQtyKey(key)] || 1;
  const getOptModel = (key: string): SelectedArticle | null => {
    const mk = optModelKey(key);
    if (!mk) return null;
    const id = (draft as any)[mk];
    return id ? articleCache[id] || null : null;
  };

  const handleOptToggle = (key: string) => {
    updateDraft({ [optEnabledKey(key)]: !getOptEnabled(key) });
  };
  const handleOptQtyChange = (key: string, delta: number) => {
    const next = Math.max(1, Math.min(99, getOptQty(key) + delta));
    updateDraft({ [optQtyKey(key)]: next });
  };
  const handleOptModelChange = (key: string, article: SelectedArticle | null) => {
    const mk = optModelKey(key);
    if (!mk) return;
    if (article) {
      setArticleCache((prev) => ({ ...prev, [article.id]: article }));
      updateDraft({ [mk]: article.id });
    } else {
      updateDraft({ [mk]: undefined });
    }
  };

  // --- Cascada extras: bomba + pulsador piezoelèctric + mà d'obra ---
  const cascadaBombaModel: SelectedArticle | null = draft.accCascadaBombaArticleId
    ? articleCache[draft.accCascadaBombaArticleId] || null
    : null;
  const handleCascadaBombaChange = (article: SelectedArticle | null) => {
    if (article) {
      setArticleCache((prev) => ({ ...prev, [article.id]: article }));
      updateDraft({ accCascadaBombaArticleId: article.id });
    } else {
      updateDraft({ accCascadaBombaArticleId: undefined });
    }
  };

  const cascadaPulsadorModel: SelectedArticle | null = draft.accCascadaPulsadorArticleId
    ? articleCache[draft.accCascadaPulsadorArticleId] || null
    : null;
  const cascadaPulsadorQty = draft.accCascadaPulsadorQty ?? 1;
  const handleCascadaPulsadorChange = (article: SelectedArticle | null) => {
    if (article) {
      setArticleCache((prev) => ({ ...prev, [article.id]: article }));
      updateDraft({ accCascadaPulsadorArticleId: article.id });
    } else {
      updateDraft({ accCascadaPulsadorArticleId: undefined });
    }
  };
  const handleCascadaPulsadorQtyChange = (qty: number) => {
    updateDraft({ accCascadaPulsadorQty: Math.max(1, Math.min(10, qty)) });
  };

  // Auto-select default bomba + polsador piezoelèctric when the user enables
  // Cascada and picks a model, without overriding any manual selection the
  // user may already have made (same "only if empty" pattern as the RGB
  // control auto-selection above).
  useEffect(() => {
    if (!draft.accCascadaEnabled || !draft.accCascadaModelId) return;
    if (draft.accCascadaBombaArticleId && draft.accCascadaPulsadorArticleId) return;

    let cancelled = false;
    (async () => {
      const updates: Record<string, any> = {};
      const newCache: Record<string, SelectedArticle> = {};

      if (!draft.accCascadaBombaArticleId) {
        const { data } = await supabase
          .from('articles')
          .select('id, name, reference, image_url, suppliers:supplier_id(name)')
          .eq('category', 'Bomba')
          .eq('subtipus', 'On/Off')
          .ilike('name', '%DOLFI 150M%')
          .limit(1);
        const match = data?.[0];
        if (match) {
          const article: SelectedArticle = {
            id: match.id,
            name: match.name,
            reference: match.reference,
            image_url: match.image_url,
            supplierName: (match as any).suppliers?.name,
          };
          updates.accCascadaBombaArticleId = article.id;
          newCache[article.id] = article;
        }
      }

      if (!draft.accCascadaPulsadorArticleId) {
        const { data } = await supabase
          .from('articles')
          .select('id, name, reference, image_url, suppliers:supplier_id(name)')
          .eq('category', 'Accessoris')
          .eq('subtipus', 'Pulsador piezoelèctric')
          .limit(1);
        const match = data?.[0];
        if (match) {
          const article: SelectedArticle = {
            id: match.id,
            name: match.name,
            reference: match.reference,
            image_url: match.image_url,
            supplierName: (match as any).suppliers?.name,
          };
          updates.accCascadaPulsadorArticleId = article.id;
          updates.accCascadaPulsadorQty = draft.accCascadaPulsadorQty ?? 1;
          newCache[article.id] = article;
        }
      }

      if (cancelled || Object.keys(updates).length === 0) return;
      setArticleCache((prev) => ({ ...prev, ...newCache }));
      updateDraft(updates);
    })();

    return () => {
      cancelled = true;
    };
  }, [draft.accCascadaEnabled, draft.accCascadaModelId, draft.accCascadaBombaArticleId, draft.accCascadaPulsadorArticleId]);

  const hasDimensions = poolLength > 0 && poolWidth > 0;
  const isCompact = isMobile || isTablet;

  // Detect if any lighting model contains "RGB" to show control RGB section
  const focusLedModel = getBasicModel("focus_led");
  const projectorMiniLedModel = getBasicModel("projector_mini_led");
  const focusLedQty = getBasicQty("focus_led");
  const projectorMiniLedQty = getBasicQty("projector_mini_led");
  const needsRgbControl =
    (focusLedModel && focusLedQty > 0 && isRgbTrigger(focusLedModel.name)) ||
    (projectorMiniLedModel && projectorMiniLedQty > 0 && isRgbTrigger(projectorMiniLedModel.name));

  // RGB control model
  const rgbControlModel: SelectedArticle | null = draft.accControlRgbModelId
    ? articleCache[draft.accControlRgbModelId] || null
    : null;
  const rgbControlQty = draft.accControlRgbQty ?? 1;

  const handleRgbModelChange = (article: SelectedArticle | null) => {
    if (article) {
      setArticleCache((prev) => ({ ...prev, [article.id]: article }));
      updateDraft({ accControlRgbModelId: article.id });
    } else {
      updateDraft({ accControlRgbModelId: undefined });
    }
  };
  const handleRgbQtyChange = (delta: number) => {
    const next = Math.max(1, Math.min(99, rgbControlQty + delta));
    updateDraft({ accControlRgbQty: next });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Accessoris</h2>
        <p className="text-sm text-muted-foreground mt-1">Selecció d'accessoris de la piscina</p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/10 rounded-xl">
        <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          Les quantitats s'han calculat automàticament segons les dimensions de la piscina. Pots modificar-les
          manualment.
        </p>
      </div>

      {!hasDimensions && (
        <div className="flex items-start gap-3 p-4 bg-warning/10 border border-warning/20 rounded-xl">
          <Info className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <p className="text-sm text-warning">
            ⚠️ Introdueix les dimensions de la piscina a l'Estructura per calcular les quantitats automàtiques.
          </p>
        </div>
      )}

      {/* SECTION 1 — Accessoris bàsics */}
      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex flex-wrap items-center gap-3">
          <h3 className="font-semibold text-foreground">Accessoris bàsics</h3>
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            Càlcul automàtic
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Color:</span>
            {[
              { value: 'blanc', label: 'Blancs' },
              { value: 'color', label: 'De color' },
            ].map((opt) => {
              const current = draft.accBasicsColor ?? 'blanc';
              const active = current === opt.value;
              return (
                <label
                  key={opt.value}
                  className={cn(
                    "flex items-center gap-1.5 cursor-pointer px-2.5 py-1 rounded-full border text-xs font-medium transition-all",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-muted-foreground/40",
                  )}
                >
                  <input
                    type="radio"
                    name="accBasicsColor"
                    value={opt.value}
                    checked={active}
                    onChange={() => updateDraft({ accBasicsColor: opt.value as 'blanc' | 'color' })}
                    className="accent-primary w-3 h-3"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </div>

        <div className="divide-y divide-border">
          {BASIC_ACCESSORIES.map((acc) => {
            const qty = getBasicQty(acc.key);
            const model = getBasicModel(acc.key);
            const autoQty = hasDimensions ? acc.calcQty(poolLength, poolWidth) : 0;
            const isDimmed = qty === 0;

            return (
              <div key={acc.key} className={cn("p-3.5 md:p-4 space-y-3", isDimmed && "opacity-40")}>
                {isCompact ? (
                  /* --- Tablet/mobile card layout --- */
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{acc.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{acc.subtitle(poolLength, poolWidth)}</p>
                      </div>
                      {qty > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            updateDraft({ [basicQtyKey(acc.key)]: 0, [basicModelKey(acc.key)]: undefined });
                          }}
                          className="p-1.5 rounded hover:bg-destructive/10 transition-colors flex-shrink-0"
                        >
                          <X className="w-4 h-4 text-destructive" />
                        </button>
                      )}
                    </div>
                    {/* Quantity */}
                    <div className="flex flex-col items-start gap-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleBasicQtyChange(acc.key, -1)}
                          className="w-11 h-11 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors"
                        >
                          <Minus className="w-4 h-4 text-muted-foreground" />
                        </button>
                        <span className="text-sm font-bold text-foreground w-8 text-center">{qty}</span>
                        <button
                          type="button"
                          onClick={() => handleBasicQtyChange(acc.key, 1)}
                          className="w-11 h-11 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors"
                        >
                          <Plus className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>
                      {hasDimensions && <span className="text-[10px] text-primary/70">auto: {autoQty}</span>}
                    </div>
                    {/* Model */}
                    <div className="w-full">
                      <EquipmentSelector
                        label="Model"
                        placeholder="Cercar accessori..."
                        categoryFilter="Accessoris"
                        subtipusFilter={acc.subtipus}
                        value={model}
                        onChange={(a) => handleBasicModelChange(acc.key, a)}
                        noneLabel="A determinar"
                      />
                    </div>
                  </div>
                ) : (
                  /* --- Desktop row layout --- */
                  <div className="flex items-start gap-4">
                    <div className="w-1/4 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{acc.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{acc.subtitle(poolLength, poolWidth)}</p>
                    </div>
                    <div className="flex flex-col items-start gap-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleBasicQtyChange(acc.key, -1)}
                          className="w-7 h-7 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <span className="text-sm font-bold text-foreground w-8 text-center">{qty}</span>
                        <button
                          type="button"
                          onClick={() => handleBasicQtyChange(acc.key, 1)}
                          className="w-7 h-7 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </div>
                      {hasDimensions && <span className="text-[10px] text-primary/70">auto: {autoQty}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <EquipmentSelector
                        label="Model"
                        placeholder="Cercar accessori..."
                        categoryFilter="Accessoris"
                        subtipusFilter={acc.subtipus}
                        value={model}
                        onChange={(a) => handleBasicModelChange(acc.key, a)}
                        noneLabel="A determinar"
                      />
                    </div>
                    {qty > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          updateDraft({ [basicQtyKey(acc.key)]: 0, [basicModelKey(acc.key)]: undefined });
                        }}
                        className="self-start p-1.5 rounded hover:bg-destructive/10 transition-colors flex-shrink-0"
                      >
                        <X className="w-4 h-4 text-destructive" />
                      </button>
                    )}
                  </div>
                )}

                {/* Focus LED variants — two independent axes */}
                {acc.key === "focus_led" &&
                  model &&
                  qty > 0 &&
                  (() => {
                    const currentVariants = parseLedVariant(draft.accFocusLedVariant);
                    return (
                      <div
                        className={cn("space-y-3 pt-2 border-t border-dashed border-border", !isCompact && "ml-[25%]")}
                      >
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1.5">Embellidor:</p>
                          <div className="flex flex-wrap gap-2">
                            {EMBELLIDOR_VARIANTS.map((v) => (
                              <button
                                key={v.key}
                                type="button"
                                onClick={() => handleLedEmbellidorChange(v.key)}
                                className={cn(
                                  "text-xs px-3 py-1.5 rounded-full border transition-colors",
                                  currentVariants.embellidor === v.key
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-card text-muted-foreground border-border hover:bg-muted",
                                )}
                              >
                                {v.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1.5">Llum:</p>
                          <div className="flex flex-wrap gap-2">
                            {LLUM_VARIANTS.map((v) => (
                              <button
                                key={v.key}
                                type="button"
                                onClick={() => handleLedLlumChange(v.key)}
                                className={cn(
                                  "text-xs px-3 py-1.5 rounded-full border transition-colors",
                                  currentVariants.llum === v.key
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-card text-muted-foreground border-border hover:bg-muted",
                                )}
                              >
                                {v.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        {draft.accFocusLedText && (
                          <p className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
                            {draft.accFocusLedText}
                          </p>
                        )}
                      </div>
                    );
                  })()}
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION — Sistema de control RGB (conditional) */}
      {needsRgbControl && (
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-3">
            <h3 className="font-semibold text-foreground">Sistema de control RGB</h3>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
              Requerit per model RGB
            </span>
          </div>
          <div className="p-3.5 md:p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              S'ha detectat un model RGB als focus LED o projectors mini LED. Selecciona el sistema de control RGB:
            </p>
            {isCompact ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRgbQtyChange(-1)}
                    className="w-11 h-11 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    <Minus className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <span className="text-sm font-bold text-foreground w-8 text-center">{rgbControlQty}</span>
                  <button
                    type="button"
                    onClick={() => handleRgbQtyChange(1)}
                    className="w-11 h-11 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    <Plus className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                <div className="w-full">
                  <EquipmentSelector
                    label="Model control RGB"
                    placeholder="Cercar sistema control RGB..."
                    categoryFilter="Accessoris"
                    subtipusFilter="Control RGB"
                    value={rgbControlModel}
                    onChange={handleRgbModelChange}
                    noneLabel="A determinar"
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-4">
                <div className="w-1/4 min-w-0">
                  <p className="text-sm font-semibold text-foreground">CONTROL RGB</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Controlador per il·luminació RGB</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRgbQtyChange(-1)}
                    className="w-7 h-7 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <span className="text-sm font-bold text-foreground w-8 text-center">{rgbControlQty}</span>
                  <button
                    type="button"
                    onClick={() => handleRgbQtyChange(1)}
                    className="w-7 h-7 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <EquipmentSelector
                    label="Model control RGB"
                    placeholder="Cercar sistema control RGB..."
                    categoryFilter="Accessoris"
                    subtipusFilter="Control RGB"
                    value={rgbControlModel}
                    onChange={handleRgbModelChange}
                    noneLabel="A determinar"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          <h3 className="font-semibold text-foreground">Accessoris opcionals</h3>
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
            A elecció del client
          </span>
        </div>

        <div className="divide-y divide-border">
          {OPTIONAL_ACCESSORIES.map((acc) => {
            const enabled = getOptEnabled(acc.key);
            const qty = getOptQty(acc.key);
            const model = acc.hasModel ? getOptModel(acc.key) : null;

            return (
              <div key={acc.key} className="p-3.5 md:p-4">
                {isCompact ? (
                  /* --- Tablet/mobile card layout --- */
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{acc.name}</p>
                        <p className="text-xs text-muted-foreground">{acc.subtitle}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOptToggle(acc.key)}
                        className={cn(
                          "mt-0.5 w-10 h-5 rounded-full relative transition-colors flex-shrink-0",
                          enabled ? "bg-primary" : "bg-muted-foreground/20",
                        )}
                      >
                        <div
                          className={cn(
                            "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                            enabled ? "translate-x-5" : "translate-x-0.5",
                          )}
                        />
                      </button>
                    </div>
                    {enabled && (
                      <>
                        {/* Quantity */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOptQtyChange(acc.key, -1)}
                            className="w-11 h-11 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors"
                          >
                            <Minus className="w-4 h-4 text-muted-foreground" />
                          </button>
                          <span className="text-sm font-bold text-foreground w-8 text-center">{qty}</span>
                          <button
                            type="button"
                            onClick={() => handleOptQtyChange(acc.key, 1)}
                            className="w-11 h-11 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors"
                          >
                            <Plus className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </div>
                        {/* Model or fixed price */}
                        {acc.hasModel ? (
                          <div className="w-full">
                            <EquipmentSelector
                              label="Model"
                              placeholder="Cercar accessori..."
                              categoryFilter="Accessoris"
                              subtipusFilter={acc.subtipus}
                              value={model}
                              onChange={(a) => handleOptModelChange(acc.key, a)}
                              noneLabel="A determinar"
                            />
                          </div>
                        ) : acc.fixedPrice ? (
                          <p className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
                            Preu fix: {acc.fixedPrice.toFixed(2)} €
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : (
                  /* --- Desktop row layout --- */
                  <div className="flex items-start gap-4">
                    <div className="flex items-start gap-3 w-1/4">
                      <button
                        type="button"
                        onClick={() => handleOptToggle(acc.key)}
                        className={cn(
                          "mt-0.5 w-10 h-5 rounded-full relative transition-colors flex-shrink-0",
                          enabled ? "bg-primary" : "bg-muted-foreground/20",
                        )}
                      >
                        <div
                          className={cn(
                            "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                            enabled ? "translate-x-5" : "translate-x-0.5",
                          )}
                        />
                      </button>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{acc.name}</p>
                        <p className="text-xs text-muted-foreground">{acc.subtitle}</p>
                      </div>
                    </div>
                    {/* Quantity */}
                    <div className={cn("flex items-center gap-2", !enabled && "opacity-40 pointer-events-none")}>
                      <button
                        type="button"
                        onClick={() => handleOptQtyChange(acc.key, -1)}
                        className="w-7 h-7 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <span className="text-sm font-bold text-foreground w-8 text-center">{qty}</span>
                      <button
                        type="button"
                        onClick={() => handleOptQtyChange(acc.key, 1)}
                        className="w-7 h-7 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                    {/* Model or fixed price */}
                    <div className={cn("flex-1 min-w-0", !enabled && "opacity-40 pointer-events-none")}>
                      {acc.hasModel ? (
                        <EquipmentSelector
                          label="Model"
                          placeholder="Cercar accessori..."
                          categoryFilter="Accessoris"
                          subtipusFilter={acc.subtipus}
                          value={model}
                          onChange={(a) => handleOptModelChange(acc.key, a)}
                          noneLabel="A determinar"
                        />
                      ) : acc.fixedPrice ? (
                        <div className="pt-5">
                          <p className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
                            Preu fix: {acc.fixedPrice.toFixed(2)} €
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}

                {/* Cascada extras: bomba + pulsador piezoelèctric.
                    Mà d'obra d'instal·lació NO es configura aquí — es genera
                    automàticament via una regla condicional del Motor de
                    Càlcul (Configuració → Motor de Càlcul) quan
                    acc_cascada_enabled és true. */}
                {acc.key === "cascada" && enabled && (
                  <div
                    className={cn(
                      "space-y-4 pt-3 mt-3 border-t border-dashed border-border",
                      !isCompact && "ml-[25%]",
                    )}
                  >
                    <div className={cn(isCompact ? "w-full" : "max-w-md")}>
                      <EquipmentSelector
                        label="Bomba per a cascada"
                        placeholder="Cercar bomba..."
                        categoryFilter="Bomba"
                        subtipusFilter="On/Off"
                        value={cascadaBombaModel}
                        onChange={handleCascadaBombaChange}
                        noneLabel="A determinar"
                      />
                    </div>
                    <div className={cn(isCompact ? "w-full" : "max-w-md")}>
                      <EquipmentSelector
                        label="Pulsador piezoelèctric"
                        placeholder="Cercar pulsador..."
                        categoryFilter="Accessoris"
                        subtipusFilter="Pulsador piezoelèctric"
                        value={cascadaPulsadorModel}
                        onChange={handleCascadaPulsadorChange}
                        noneLabel="A determinar"
                        quantity={cascadaPulsadorQty}
                        onQuantityChange={handleCascadaPulsadorQtyChange}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={() => setStep(currentStep - 1)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Enrere
        </button>
        <button
          type="button"
          onClick={() => setStep(currentStep + 1)}
          className="gradient-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity shadow-md"
        >
          Següent <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
