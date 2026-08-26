import { useEffect, useState } from 'react';
import { useBudgetStore } from '@/stores/budgetStore';
import { supabase } from '@/integrations/supabase/client';
import { create } from 'zustand';

export interface QuadreRecommendation {
  article: { id: string; name: string; cost_price: number; sale_price: number } | null;
  transformer: '100W' | '300W';
  cvRange: string;
  cvBomba: number | null;
  wattsPerFocus: number;
  totalWatts: number;
  notFound: boolean;
}

interface QuadreState {
  recommendation: QuadreRecommendation | null;
  loading: boolean;
  set: (s: Partial<QuadreState>) => void;
}

export const useQuadreRecommendationStore = create<QuadreState>((set) => ({
  recommendation: null,
  loading: false,
  set: (s) => set(s),
}));

/**
 * Globally watches inputs that affect the electrical panel selection
 * and keeps the draft + recommendation store in sync — independent of
 * which wizard step is currently mounted. This way changes made in
 * Step 6 (Accessoris) or Step 7 (Annex) immediately update the panel
 * shown in Step 5 (Instal·lacions) and in the financial summary.
 */
export function useQuadreElectricAuto() {
  const draft = useBudgetStore((s) => s.draft);
  const updateDraft = useBudgetStore((s) => s.updateDraft);
  const setStore = useQuadreRecommendationStore((s) => s.set);

  // Only run for obra_nueva (the only type that uses Step 5)
  const enabled = draft.type === 'obra_nueva';

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setStore({ loading: true });
    const timer = setTimeout(async () => {
      try {
        // ---- Wattage / transformer ----
        const focusQty = Number(draft.accFocusLedQty ?? 0);
        let wattsPerFocus = 28;
        if (focusQty > 0 && draft.accFocusLedModelId) {
          const { data: focusArt } = await supabase
            .from('articles')
            .select('name')
            .eq('id', draft.accFocusLedModelId)
            .maybeSingle();
          const fname = (focusArt?.name || '').toLowerCase();
          wattsPerFocus = /mini/i.test(fname) ? 9 : 28;
        }
        const miniQty = Number(draft.accProjectorMiniLedQty ?? 0);
        const wattsPerMini = 9;
        const totalWatts = focusQty * wattsPerFocus + miniQty * wattsPerMini;
        const transformer: '100W' | '300W' = totalWatts <= 100 ? '100W' : '300W';

        // ---- Pump CV ----
        let cvBomba: number | null = null;
        const onoffIncluded =
          !!draft.instalBombaOnoffId && !draft.instalBombaOnoffOpcional;
        const variableIncluded =
          !!draft.instalBombaVariableId && !draft.instalBombaVariableOpcional;
        if (onoffIncluded) {
          const { data: pump } = await supabase
            .from('articles')
            .select('technical_specs')
            .eq('id', draft.instalBombaOnoffId!)
            .maybeSingle();
          const cv = (pump?.technical_specs as any)?.cv;
          if (typeof cv === 'number') cvBomba = cv;
          else if (typeof cv === 'string' && !isNaN(parseFloat(cv))) cvBomba = parseFloat(cv);
        } else if (variableIncluded) {
          const { data: pump } = await supabase
            .from('articles')
            .select('technical_specs')
            .eq('id', draft.instalBombaVariableId!)
            .maybeSingle();
          const cv = (pump?.technical_specs as any)?.cv_equivalent;
          if (typeof cv === 'number') cvBomba = cv;
          else if (typeof cv === 'string' && !isNaN(parseFloat(cv))) cvBomba = parseFloat(cv);
        }

        let cvRange = '0,75 CV - 1 CV';
        const cvForRange = cvBomba ?? 1.0;
        if (cvForRange <= 1.0) cvRange = '0,75 CV - 1 CV';
        else if (cvForRange <= 2.0) cvRange = '1,5 CV - 2 CV';
        else cvRange = '3 CV';

        // ---- Find panel article ----
        const { data: candidates } = await supabase
          .from('articles')
          .select('id, name, cost_price, sale_price')
          .eq('category', 'Elèctric')
          .eq('subtipus', 'Quadre elèctric')
          .ilike('name', `%${transformer.replace('W', ' W')}%`);
        const matched = (candidates || []).find((a: any) =>
          (a.name || '').includes(cvRange),
        );

        if (cancelled) return;

        const recommendation: QuadreRecommendation = {
          article: matched
            ? {
                id: matched.id,
                name: matched.name,
                cost_price: matched.cost_price,
                sale_price: matched.sale_price,
              }
            : null,
          transformer,
          cvRange,
          cvBomba,
          wattsPerFocus,
          totalWatts,
          notFound: !matched,
        };

        // ---- Compute display text + addons ----
        const baseName = matched?.name || '';
        const baseCost = matched ? matched.cost_price / 100 : 0;
        const baseSale = matched ? matched.sale_price / 100 : 0;

        let displayText = baseName;
        const bombaQty = onoffIncluded
          ? Number(draft.instalBombaOnoffQty ?? 1)
          : variableIncluded
            ? Number(draft.instalBombaVariableQty ?? 1)
            : 1;
        if (bombaQty > 1) {
          displayText += ` (per a ${bombaQty} bombes)`;
        }
        let addonNfCost = 0;
        let addonNfSale = 0;
        let addonBcCost = 0;
        let addonBcSale = 0;

        if (draft.annexNetejafonsEstat === 'inclos') {
          const boquilles = Number(draft.annexNetejafonsTotal ?? 0);
          const distancia = Number(draft.instalFontaneriaDistancia ?? 10);
          const needs15 = boquilles / 6 >= 4 || distancia > 20;
          const cvNf = needs15 ? '1,5' : '1';
          displayText += ` + PROTECCIÓ I MANIOBRA NET 'N' CLEAN BOMBA ${cvNf} CV AMB PROGRAMADOR`;
          addonNfCost = 100;
          addonNfSale = 200;
        }

        if (draft.annexBombaCalorEstat === 'inclos' && draft.annexBombaCalorArticleId) {
          const { data: bcArt } = await supabase
            .from('articles')
            .select('name')
            .eq('id', draft.annexBombaCalorArticleId)
            .maybeSingle();
          const bcName = bcArt?.name || '';
          const kwMatch = bcName.match(/(\d+[,.]?\d*)\s*KW/i);
          const kwBc = kwMatch ? kwMatch[1].replace(',', '.') : '?';
          let elType = 'MONOFÀSICA';
          if (/trif[áà]sica/i.test(bcName)) elType = 'TRIFÀSICA';
          else if (/monof[áà]sica/i.test(bcName)) elType = 'MONOFÀSICA';
          displayText += ` + PROTECCIÓ PER A BOMBA DE CALOR DE ${kwBc} KW ${elType}`;
          addonBcCost = 90;
          addonBcSale = 180;
        }

        if (draft.accCascadaEnabled && draft.accCascadaBombaArticleId) {
          const { data: cascadaBombaArt } = await supabase
            .from('articles')
            .select('technical_specs')
            .eq('id', draft.accCascadaBombaArticleId)
            .maybeSingle();
          const cv = (cascadaBombaArt?.technical_specs as any)?.cv;
          let cvCascada: string | null = null;
          if (typeof cv === 'number') cvCascada = String(cv).replace('.', ',');
          else if (typeof cv === 'string' && !isNaN(parseFloat(cv))) cvCascada = cv.replace('.', ',');
          if (cvCascada) {
            displayText += ` + PROTECCIÓ I MANIOBRA BOMBA CASCADA ${cvCascada} CV`;
          }
        }

        const finalCost = baseCost + addonNfCost + addonBcCost;
        const finalSale = baseSale + addonNfSale + addonBcSale;

        if (cancelled) return;

        const updates: Record<string, unknown> = {
          instalQuadreRecommendedId: matched?.id || undefined,
          instalQuadreDisplayText: matched ? displayText : undefined,
          instalQuadreBaseCost: matched ? baseCost : undefined,
          instalQuadreBaseSale: matched ? baseSale : undefined,
          instalQuadreAddonNfCost: addonNfCost,
          instalQuadreAddonNfSale: addonNfSale,
          instalQuadreAddonBcCost: addonBcCost,
          instalQuadreAddonBcSale: addonBcSale,
          instalQuadreFinalCost: matched ? finalCost : undefined,
          instalQuadreFinalSale: matched ? finalSale : undefined,
        };

        if (matched && !draft.instalQuadreManualOverride) {
          updates.instalQuadreId = matched.id;
        }

        // Skip update if nothing actually changed (avoids re-render loops)
        const changed =
          draft.instalQuadreDisplayText !== updates.instalQuadreDisplayText ||
          draft.instalQuadreFinalCost !== updates.instalQuadreFinalCost ||
          draft.instalQuadreFinalSale !== updates.instalQuadreFinalSale ||
          draft.instalQuadreRecommendedId !== updates.instalQuadreRecommendedId ||
          (matched && !draft.instalQuadreManualOverride && draft.instalQuadreId !== matched.id);

        if (changed) updateDraft(updates);
        setStore({ recommendation, loading: false });
      } catch (e) {
        if (!cancelled) setStore({ loading: false });
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    draft.accFocusLedQty,
    draft.accFocusLedModelId,
    draft.accProjectorMiniLedQty,
    draft.instalBombaOnoffId,
    draft.instalBombaOnoffOpcional,
    draft.instalBombaOnoffQty,
    draft.instalBombaVariableId,
    draft.instalBombaVariableOpcional,
    draft.instalBombaVariableQty,
    draft.annexNetejafonsEstat,
    draft.annexNetejafonsTotal,
    draft.instalFontaneriaDistancia,
    draft.annexBombaCalorArticleId,
    draft.annexBombaCalorEstat,
    draft.accCascadaEnabled,
    draft.accCascadaBombaArticleId,
    draft.instalQuadreManualOverride,
  ]);
}