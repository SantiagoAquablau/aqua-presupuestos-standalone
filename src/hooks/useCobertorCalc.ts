import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  calcCobertor,
  findCompatibleModels,
  type CobertorCalcResult,
  type CoverLamaPriceRow,
  type CoverModelPriceRow,
  type CoverSettings,
} from '@/lib/cobertorCalc';

export function useCobertorPricingData() {
  const modelPricesQ = useQuery({
    queryKey: ['cover_model_prices'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cover_model_prices').select('*');
      if (error) throw error;
      return data as CoverModelPriceRow[];
    },
  });

  const lamaPricesQ = useQuery({
    queryKey: ['cover_lama_prices'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cover_lama_prices').select('*');
      if (error) throw error;
      return data as CoverLamaPriceRow[];
    },
  });

  const settingsQ = useQuery({
    queryKey: ['cover_settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cover_settings').select('*').limit(1).maybeSingle();
      if (error) throw error;
      return data as CoverSettings | null;
    },
  });

  return {
    modelPrices: modelPricesQ.data ?? [],
    lamaPrices: lamaPricesQ.data ?? [],
    settings: settingsQ.data,
    isLoading: modelPricesQ.isLoading || lamaPricesQ.isLoading || settingsQ.isLoading,
  };
}

export function useCobertorCalc(args: {
  modelId?: string;
  modelName?: string;
  modelCode?: string;
  coverType?: 'fora_aigua' | 'submergit';
  material?: 'pvc' | 'policarbonat';
  poolWidth?: number;
  poolLength?: number;
}) {
  const { modelPrices, lamaPrices, settings, isLoading } = useCobertorPricingData();

  const result: CobertorCalcResult | null = useMemo(() => {
    if (!settings) return null;
    return calcCobertor({ ...args, modelPrices, lamaPrices, settings });
  }, [args.modelId, args.modelName, args.modelCode, args.coverType, args.material, args.poolWidth, args.poolLength, modelPrices, lamaPrices, settings]);

  return { result, modelPrices, lamaPrices, settings, isLoading };
}

export { findCompatibleModels };