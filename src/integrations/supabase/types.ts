export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      article_price_history: {
        Row: {
          article_id: string
          changed_at: string
          changed_by: string | null
          cost_price: number
          id: string
          sale_price: number
          supplier_id: string | null
        }
        Insert: {
          article_id: string
          changed_at?: string
          changed_by?: string | null
          cost_price: number
          id?: string
          sale_price: number
          supplier_id?: string | null
        }
        Update: {
          article_id?: string
          changed_at?: string
          changed_by?: string | null
          cost_price?: number
          id?: string
          sale_price?: number
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "article_price_history_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_price_history_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          acabat_type: string | null
          beurada_color: string | null
          beurada_color_epoxi: string | null
          beurada_color_normal: string | null
          category: string
          cost_price: number
          created_at: string
          fase: string | null
          format: string | null
          id: string
          image_url: string | null
          linia_preferent: boolean
          name: string
          quality: string | null
          reference: string | null
          sale_price: number
          sale_price_supply_only: number
          subtipus: string | null
          supplier_id: string | null
          technical_specs: Json | null
          unit: string
          updated_at: string
        }
        Insert: {
          acabat_type?: string | null
          beurada_color?: string | null
          beurada_color_epoxi?: string | null
          beurada_color_normal?: string | null
          category?: string
          cost_price?: number
          created_at?: string
          fase?: string | null
          format?: string | null
          id?: string
          image_url?: string | null
          linia_preferent?: boolean
          name: string
          quality?: string | null
          reference?: string | null
          sale_price?: number
          sale_price_supply_only?: number
          subtipus?: string | null
          supplier_id?: string | null
          technical_specs?: Json | null
          unit?: string
          updated_at?: string
        }
        Update: {
          acabat_type?: string | null
          beurada_color?: string | null
          beurada_color_epoxi?: string | null
          beurada_color_normal?: string | null
          category?: string
          cost_price?: number
          created_at?: string
          fase?: string | null
          format?: string | null
          id?: string
          image_url?: string | null
          linia_preferent?: boolean
          name?: string
          quality?: string | null
          reference?: string | null
          sale_price?: number
          sale_price_supply_only?: number
          subtipus?: string | null
          supplier_id?: string | null
          technical_specs?: Json | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "articles_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      autoportant_prices: {
        Row: {
          altura_aigua_m: number
          altura_total_m: number
          ample_m: number
          cost_price: number
          created_at: string
          id: string
          llarg_m: number
          model: string
          sale_price: number
          updated_at: string
        }
        Insert: {
          altura_aigua_m: number
          altura_total_m: number
          ample_m: number
          cost_price?: number
          created_at?: string
          id?: string
          llarg_m: number
          model: string
          sale_price?: number
          updated_at?: string
        }
        Update: {
          altura_aigua_m?: number
          altura_total_m?: number
          ample_m?: number
          cost_price?: number
          created_at?: string
          id?: string
          llarg_m?: number
          model?: string
          sale_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      autoportant_transport_config: {
        Row: {
          base_fee_cents: number
          created_at: string
          id: string
          margin_multiplier: number
          narrow_width_threshold_m: number
          provider_address: string
          rate_narrow_cents_per_km: number
          rate_wide_cents_per_km: number
          updated_at: string
          wide_width_threshold_m: number
        }
        Insert: {
          base_fee_cents?: number
          created_at?: string
          id?: string
          margin_multiplier?: number
          narrow_width_threshold_m?: number
          provider_address?: string
          rate_narrow_cents_per_km?: number
          rate_wide_cents_per_km?: number
          updated_at?: string
          wide_width_threshold_m?: number
        }
        Update: {
          base_fee_cents?: number
          created_at?: string
          id?: string
          margin_multiplier?: number
          narrow_width_threshold_m?: number
          provider_address?: string
          rate_narrow_cents_per_km?: number
          rate_wide_cents_per_km?: number
          updated_at?: string
          wide_width_threshold_m?: number
        }
        Relationships: []
      }
      budget_items: {
        Row: {
          article_id: string | null
          description: string
          formula_rule_id: string | null
          id: string
          order: number | null
          phase_id: string
          quantity: number | null
          source: string | null
          sub_phase: string | null
          unit: string
          unit_cost: number | null
          unit_sale: number | null
          user_edited: boolean | null
          wizard_key: string | null
        }
        Insert: {
          article_id?: string | null
          description?: string
          formula_rule_id?: string | null
          id?: string
          order?: number | null
          phase_id: string
          quantity?: number | null
          source?: string | null
          sub_phase?: string | null
          unit?: string
          unit_cost?: number | null
          unit_sale?: number | null
          user_edited?: boolean | null
          wizard_key?: string | null
        }
        Update: {
          article_id?: string | null
          description?: string
          formula_rule_id?: string | null
          id?: string
          order?: number | null
          phase_id?: string
          quantity?: number | null
          source?: string | null
          sub_phase?: string | null
          unit?: string
          unit_cost?: number | null
          unit_sale?: number | null
          user_edited?: boolean | null
          wizard_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "budget_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_phases: {
        Row: {
          budget_id: string
          id: string
          name: string
          order: number
          total_cost: number | null
          total_sale: number | null
        }
        Insert: {
          budget_id: string
          id?: string
          name: string
          order?: number
          total_cost?: number | null
          total_sale?: number | null
        }
        Update: {
          budget_id?: string
          id?: string
          name?: string
          order?: number
          total_cost?: number | null
          total_sale?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_phases_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          acc_barana_enabled: boolean | null
          acc_barana_model_id: string | null
          acc_barana_qty: number | null
          acc_basics_color: string | null
          acc_cascada_bomba_article_id: string | null
          acc_cascada_enabled: boolean | null
          acc_cascada_model_id: string | null
          acc_cascada_pulsador_article_id: string | null
          acc_cascada_pulsador_qty: number | null
          acc_cascada_qty: number | null
          acc_control_rgb_model_id: string | null
          acc_control_rgb_qty: number | null
          acc_dutxa_enabled: boolean | null
          acc_dutxa_model_id: string | null
          acc_dutxa_qty: number | null
          acc_embornal_model_id: string | null
          acc_embornal_qty: number | null
          acc_escala_enabled: boolean | null
          acc_escala_model_id: string | null
          acc_escala_qty: number | null
          acc_focus_led_model_id: string | null
          acc_focus_led_qty: number | null
          acc_focus_led_text: string | null
          acc_focus_led_variant: string | null
          acc_impulsors_model_id: string | null
          acc_impulsors_qty: number | null
          acc_netejafons_model_id: string | null
          acc_netejafons_qty: number | null
          acc_plat_dutxa_ample: number | null
          acc_plat_dutxa_enabled: boolean | null
          acc_plat_dutxa_llarg: number | null
          acc_plat_dutxa_manual_override: boolean | null
          acc_plat_dutxa_qty: number | null
          acc_plat_dutxa_sale: number | null
          acc_plat_dutxa_sale_manual_override: boolean | null
          acc_projector_mini_led_model_id: string | null
          acc_projector_mini_led_qty: number | null
          acc_regulador_model_id: string | null
          acc_regulador_qty: number | null
          acc_salvavides_enabled: boolean | null
          acc_salvavides_model_id: string | null
          acc_salvavides_qty: number | null
          acc_skimmers_model_id: string | null
          acc_skimmers_qty: number | null
          access_platform_height: number
          access_platform_length: number
          access_platform_width: number
          access_stair_height: number
          access_stair_length: number
          access_stair_width: number
          altura_vista: number
          annex_bomba_calor_article_id: string | null
          annex_bomba_calor_coberta: boolean | null
          annex_bomba_calor_des_de: string | null
          annex_bomba_calor_estat: string | null
          annex_bomba_calor_fins_a: string | null
          annex_bomba_calor_kw_required: number | null
          annex_bomba_calor_temperatura: number | null
          annex_cobertor_calc_breakdown: Json | null
          annex_cobertor_calc_cost: number | null
          annex_cobertor_calc_sale: number | null
          annex_cobertor_color_id: string | null
          annex_cobertor_estat: string | null
          annex_cobertor_lames: string | null
          annex_cobertor_manual_amount: number | null
          annex_cobertor_manual_override: boolean | null
          annex_cobertor_model_code: string | null
          annex_cobertor_model_id: string | null
          annex_cobertor_mur_m2: number | null
          annex_cobertor_mur_nou: boolean | null
          annex_cobertor_tipus: string | null
          annex_excavacio_estat: string | null
          annex_excavacio_import: number | null
          annex_excavacio_mano_obra_override: number | null
          annex_excavacio_pill1_title: string | null
          annex_excavacio_pill2_title: string | null
          annex_excavacio_reompliment: number | null
          annex_excavacio_reompliment_override: number | null
          annex_excavacio_text1: string | null
          annex_excavacio_text2: string | null
          annex_gespa_article_id: string | null
          annex_gespa_estat: string | null
          annex_gespa_m2: number | null
          annex_gespa_model: string | null
          annex_gespa_preparacio_enabled: boolean | null
          annex_gespa_preparacio_m2: number | null
          annex_netejafons_article_id: string | null
          annex_netejafons_escala: number | null
          annex_netejafons_estat: string | null
          annex_netejafons_extra_cost: number | null
          annex_netejafons_fons: number | null
          annex_netejafons_plataforma: number | null
          annex_netejafons_total: number | null
          annex_notes: string | null
          annex_paviment_actuacio: string | null
          annex_paviment_estat: string | null
          annex_paviment_format: string | null
          annex_paviment_formigo_enabled: boolean | null
          annex_paviment_formigo_m2: number | null
          annex_paviment_m2: number | null
          annex_paviment_material: string | null
          annex_paviment_model_a_determinar: boolean | null
          annex_paviment_model_id: string | null
          annex_paviment_nou_enabled: boolean | null
          annex_paviment_reforma_enabled: boolean | null
          annex_paviment_regularitzacio_enabled: boolean | null
          annex_paviment_regularitzacio_m2: number | null
          annex_paviment_retirada_enabled: boolean | null
          annex_paviment_retirada_m2: number | null
          annex_paviment_tipus: string | null
          annex_projecte_article_id: string | null
          annex_projecte_estat: string | null
          annex_projecte_qty: number | null
          annex_robot_article_id: string | null
          annex_robot_estat: string | null
          annex_robot_qty: number | null
          autoportant_altura_aigua: string | null
          autoportant_ample: string | null
          autoportant_corona_key: string | null
          autoportant_llarg: string | null
          autoportant_model: string | null
          autoportant_morter_color: string | null
          autoportant_opc_asiento_acrilico_qty: number | null
          autoportant_opc_asiento_porcelanico_qty: number | null
          autoportant_opc_banco_gresite_qty: number | null
          autoportant_opc_cascada: boolean | null
          autoportant_opc_colchoneta: boolean | null
          autoportant_opc_cristal: boolean | null
          autoportant_opc_cubierta_electrica: boolean | null
          autoportant_opc_spa: boolean | null
          autoportant_revestiment_exterior_key: string | null
          autoportant_revestiment_key: string | null
          autoportant_transport_cost: number | null
          autoportant_transport_km: number | null
          autoportant_transport_km_override: boolean | null
          autoportant_transport_sale: number | null
          autoportant_transport_user_edited: boolean | null
          bench_height: number | null
          bench_length: number | null
          bench_width: number | null
          budget_date: string | null
          client_address: string | null
          client_email: string | null
          client_name: string
          client_nif: string | null
          client_phone: string | null
          client_town: string | null
          comercial_id: string | null
          construction_system: string | null
          construction_year: number | null
          contractant_address: string | null
          contractant_name: string | null
          contractant_nif: string | null
          contractant_town: string | null
          coronament_actuacio: string | null
          coronament_beurada: string | null
          coronament_beurada_color: string | null
          coronament_encofrat_ml: number | null
          coronament_format: string | null
          coronament_inclos: boolean
          coronament_ml: number | null
          coronament_model_a_determinar: boolean | null
          coronament_model_id: string | null
          coronament_observacions: string | null
          coronament_peces: number | null
          coronament_tipus: string | null
          created_at: string
          current_coating: string | null
          deleted: boolean | null
          detected_problems: Json | null
          ext_stairs_length: number | null
          ext_stairs_width: number | null
          filtration_system: string | null
          general_condition: string | null
          gunite_distancia_km: number | null
          gunite_manguera_metres: number | null
          has_access_stair: boolean
          has_cover: boolean | null
          has_electrolisi: boolean | null
          has_electrolisi_2: boolean | null
          has_exterior_stairs: boolean | null
          has_jacuzzi: boolean | null
          has_manual_material_entry: boolean | null
          has_rebaix: boolean
          has_robot: boolean | null
          has_second_pool: boolean | null
          id: string
          instal_afm_article_id: string | null
          instal_afm_enabled: boolean | null
          instal_afm_qty: number | null
          instal_bomba_enabled: boolean | null
          instal_bomba_onoff_id: string | null
          instal_bomba_onoff_opcional: boolean | null
          instal_bomba_onoff_qty: number | null
          instal_bomba_variable_id: string | null
          instal_bomba_variable_opcional: boolean | null
          instal_bomba_variable_qty: number | null
          instal_canvi_medi_article_id: string | null
          instal_canvi_medi_filtre: string | null
          instal_canvi_sorra_article_id: string | null
          instal_canvi_sorra_enabled: boolean | null
          instal_caseta_enabled: boolean | null
          instal_caseta_obra_alt: number | null
          instal_caseta_obra_ample: number | null
          instal_caseta_obra_llarg: number | null
          instal_caseta_obra_portes: string | null
          instal_caseta_observacions: string | null
          instal_caseta_ubicacio: string | null
          instal_depuracio_enabled: boolean | null
          instal_dosificacio_enabled: boolean | null
          instal_dosificacio_hc_option: string | null
          instal_dosificacio_std_id: string | null
          instal_dosificacio_std_opcional: boolean | null
          instal_dosificacio_std_qty: number | null
          instal_electrica_base_article_id: string | null
          instal_electrica_distancia: number | null
          instal_electrica_enabled: boolean | null
          instal_electrica_extra_cost: number | null
          instal_electrica_text: string | null
          instal_electrica_total: number | null
          instal_filtre_especial_id: string | null
          instal_filtre_especial_opcional: boolean | null
          instal_filtre_especial_qty: number | null
          instal_filtre_polies_id: string | null
          instal_filtre_polies_opcional: boolean | null
          instal_filtre_polies_qty: number | null
          instal_fontaneria_base_article_id: string | null
          instal_fontaneria_caseta_tipus: string | null
          instal_fontaneria_distancia: number | null
          instal_fontaneria_enabled: boolean | null
          instal_fontaneria_extra_cost: number | null
          instal_fontaneria_local_tecnic: string | null
          instal_fontaneria_perforacions: boolean | null
          instal_fontaneria_perforacions_article_id: string | null
          instal_fontaneria_rasas: string | null
          instal_fontaneria_text: string | null
          instal_fontaneria_total: number | null
          instal_hidrolisi_id: string | null
          instal_hidrolisi_opcional: boolean | null
          instal_hidrolisi_qty: number | null
          instal_prefiltre_article_id: string | null
          instal_prefiltre_enabled: boolean | null
          instal_prefiltre_qty: number | null
          instal_quadre_addon_bc_cost: number | null
          instal_quadre_addon_bc_sale: number | null
          instal_quadre_addon_nf_cost: number | null
          instal_quadre_addon_nf_sale: number | null
          instal_quadre_base_cost: number | null
          instal_quadre_base_sale: number | null
          instal_quadre_display_text: string | null
          instal_mo_hores_bomba: number | null
          instal_mo_hores_depuracio: number | null
          instal_mo_hores_dosificacio: number | null
          instal_mo_hores_quadre: number | null
          instal_quadre_enabled: boolean | null
          instal_quadre_final_cost: number | null
          instal_quadre_final_sale: number | null
          instal_quadre_id: string | null
          instal_quadre_manual_override: boolean | null
          instal_quadre_recommended_id: string | null
          instal_wifi_article_id: string | null
          instal_wifi_enabled: boolean | null
          interior_stairs_type: string | null
          internal_notes: string | null
          jacuzzi_air_jets_count: number | null
          jacuzzi_air_jets_intake_count: number | null
          jacuzzi_air_pump_article_id: string | null
          jacuzzi_air_pump_qty: number | null
          jacuzzi_bench_count: number | null
          jacuzzi_bench_depth: number | null
          jacuzzi_bench_height: number | null
          jacuzzi_depth: number | null
          jacuzzi_filter_article_id: string | null
          jacuzzi_filter_qty: number | null
          jacuzzi_filtration_pump_article_id: string | null
          jacuzzi_filtration_pump_qty: number | null
          jacuzzi_heat_pump_article_id: string | null
          jacuzzi_heat_pump_qty: number | null
          jacuzzi_led_article_id: string | null
          jacuzzi_led_count: number | null
          jacuzzi_length: number | null
          jacuzzi_piezo_buttons_count: number | null
          jacuzzi_position: string | null
          jacuzzi_saline_electrolysis_article_id: string | null
          jacuzzi_saline_electrolysis_qty: number | null
          jacuzzi_stairs_count: number | null
          jacuzzi_stairs_tread: number | null
          jacuzzi_type: string | null
          jacuzzi_water_jets_count: number | null
          jacuzzi_water_jets_intake_count: number | null
          jacuzzi_water_pump_article_id: string | null
          jacuzzi_water_pump_qty: number | null
          jacuzzi_width: number | null
          kit_manguera_size: string | null
          kit_pertiga_size: string | null
          maintenance_periodicity: string | null
          maintenance_plan: Json | null
          maintenance_price: number | null
          maintenance_services: Json | null
          manual_material_entry_cost: number | null
          manual_material_entry_sale: number | null
          margin_pct: number | null
          margin_pct_adjustment: number
          new_coating: string | null
          number: string
          obra_location: string | null
          observations: string | null
          opcional_revestiment_beurada: string | null
          opcional_revestiment_beurada_color: string | null
          opcional_revestiment_format: string | null
          opcional_revestiment_model_id: string | null
          opcional_revestiment_tipus: string | null
          payment_conditions: string | null
          photo_url: string | null
          platform_height: number | null
          platform_length: number | null
          platform_width: number | null
          pool_depth_avg: number | null
          pool_depth_avg_2: number | null
          pool_depth_max: number | null
          pool_depth_min: number | null
          pool_disposition: string
          pool_length: number | null
          pool_length_2: number | null
          pool_shape: string | null
          pool_surface_irregular: number | null
          pool_surface_m2: number | null
          pool_type: string | null
          pool_volume_liters: number | null
          pool_width: number | null
          pool_width_2: number | null
          rebaix_amount: number
          rehab_notes: Json | null
          rehab_works: Json | null
          revestiment_actuacio: string | null
          revestiment_beurada: string | null
          revestiment_beurada_color: string | null
          revestiment_exterior_beurada: string | null
          revestiment_exterior_beurada_color: string | null
          revestiment_exterior_format: string | null
          revestiment_exterior_inclos: boolean
          revestiment_exterior_model_a_determinar: boolean | null
          revestiment_exterior_model_id: string | null
          revestiment_format: string | null
          revestiment_inclos: boolean
          revestiment_mig_canya: boolean | null
          revestiment_model_a_determinar: boolean | null
          revestiment_model_id: string | null
          revestiment_peces_especials: boolean | null
          revestiment_qualitat: string | null
          revestiment_tipus: string | null
          stairs_height: number | null
          stairs_length: number | null
          stairs_width: number | null
          status: string
          total_cost: number | null
          total_sale: number | null
          type: string
          updated_at: string
          waterproofing_system: string | null
        }
        Insert: {
          acc_barana_enabled?: boolean | null
          acc_barana_model_id?: string | null
          acc_barana_qty?: number | null
          acc_basics_color?: string | null
          acc_cascada_bomba_article_id?: string | null
          acc_cascada_enabled?: boolean | null
          acc_cascada_model_id?: string | null
          acc_cascada_pulsador_article_id?: string | null
          acc_cascada_pulsador_qty?: number | null
          acc_cascada_qty?: number | null
          acc_control_rgb_model_id?: string | null
          acc_control_rgb_qty?: number | null
          acc_dutxa_enabled?: boolean | null
          acc_dutxa_model_id?: string | null
          acc_dutxa_qty?: number | null
          acc_embornal_model_id?: string | null
          acc_embornal_qty?: number | null
          acc_escala_enabled?: boolean | null
          acc_escala_model_id?: string | null
          acc_escala_qty?: number | null
          acc_focus_led_model_id?: string | null
          acc_focus_led_qty?: number | null
          acc_focus_led_text?: string | null
          acc_focus_led_variant?: string | null
          acc_impulsors_model_id?: string | null
          acc_impulsors_qty?: number | null
          acc_netejafons_model_id?: string | null
          acc_netejafons_qty?: number | null
          acc_plat_dutxa_ample?: number | null
          acc_plat_dutxa_enabled?: boolean | null
          acc_plat_dutxa_llarg?: number | null
          acc_plat_dutxa_manual_override?: boolean | null
          acc_plat_dutxa_qty?: number | null
          acc_plat_dutxa_sale?: number | null
          acc_plat_dutxa_sale_manual_override?: boolean | null
          acc_projector_mini_led_model_id?: string | null
          acc_projector_mini_led_qty?: number | null
          acc_regulador_model_id?: string | null
          acc_regulador_qty?: number | null
          acc_salvavides_enabled?: boolean | null
          acc_salvavides_model_id?: string | null
          acc_salvavides_qty?: number | null
          acc_skimmers_model_id?: string | null
          acc_skimmers_qty?: number | null
          access_platform_height?: number
          access_platform_length?: number
          access_platform_width?: number
          access_stair_height?: number
          access_stair_length?: number
          access_stair_width?: number
          altura_vista?: number
          annex_bomba_calor_article_id?: string | null
          annex_bomba_calor_coberta?: boolean | null
          annex_bomba_calor_des_de?: string | null
          annex_bomba_calor_estat?: string | null
          annex_bomba_calor_fins_a?: string | null
          annex_bomba_calor_kw_required?: number | null
          annex_bomba_calor_temperatura?: number | null
          annex_cobertor_calc_breakdown?: Json | null
          annex_cobertor_calc_cost?: number | null
          annex_cobertor_calc_sale?: number | null
          annex_cobertor_color_id?: string | null
          annex_cobertor_estat?: string | null
          annex_cobertor_lames?: string | null
          annex_cobertor_manual_amount?: number | null
          annex_cobertor_manual_override?: boolean | null
          annex_cobertor_model_code?: string | null
          annex_cobertor_model_id?: string | null
          annex_cobertor_mur_m2?: number | null
          annex_cobertor_mur_nou?: boolean | null
          annex_cobertor_tipus?: string | null
          annex_excavacio_estat?: string | null
          annex_excavacio_import?: number | null
          annex_excavacio_mano_obra_override?: number | null
          annex_excavacio_pill1_title?: string | null
          annex_excavacio_pill2_title?: string | null
          annex_excavacio_reompliment?: number | null
          annex_excavacio_reompliment_override?: number | null
          annex_excavacio_text1?: string | null
          annex_excavacio_text2?: string | null
          annex_gespa_article_id?: string | null
          annex_gespa_estat?: string | null
          annex_gespa_m2?: number | null
          annex_gespa_model?: string | null
          annex_gespa_preparacio_enabled?: boolean | null
          annex_gespa_preparacio_m2?: number | null
          annex_netejafons_article_id?: string | null
          annex_netejafons_escala?: number | null
          annex_netejafons_estat?: string | null
          annex_netejafons_extra_cost?: number | null
          annex_netejafons_fons?: number | null
          annex_netejafons_plataforma?: number | null
          annex_netejafons_total?: number | null
          annex_notes?: string | null
          annex_paviment_actuacio?: string | null
          annex_paviment_estat?: string | null
          annex_paviment_format?: string | null
          annex_paviment_formigo_enabled?: boolean | null
          annex_paviment_formigo_m2?: number | null
          annex_paviment_m2?: number | null
          annex_paviment_material?: string | null
          annex_paviment_model_a_determinar?: boolean | null
          annex_paviment_model_id?: string | null
          annex_paviment_nou_enabled?: boolean | null
          annex_paviment_reforma_enabled?: boolean | null
          annex_paviment_regularitzacio_enabled?: boolean | null
          annex_paviment_regularitzacio_m2?: number | null
          annex_paviment_retirada_enabled?: boolean | null
          annex_paviment_retirada_m2?: number | null
          annex_paviment_tipus?: string | null
          annex_projecte_article_id?: string | null
          annex_projecte_estat?: string | null
          annex_projecte_qty?: number | null
          annex_robot_article_id?: string | null
          annex_robot_estat?: string | null
          annex_robot_qty?: number | null
          autoportant_altura_aigua?: string | null
          autoportant_ample?: string | null
          autoportant_corona_key?: string | null
          autoportant_llarg?: string | null
          autoportant_model?: string | null
          autoportant_morter_color?: string | null
          autoportant_opc_asiento_acrilico_qty?: number | null
          autoportant_opc_asiento_porcelanico_qty?: number | null
          autoportant_opc_banco_gresite_qty?: number | null
          autoportant_opc_cascada?: boolean | null
          autoportant_opc_colchoneta?: boolean | null
          autoportant_opc_cristal?: boolean | null
          autoportant_opc_cubierta_electrica?: boolean | null
          autoportant_opc_spa?: boolean | null
          autoportant_revestiment_exterior_key?: string | null
          autoportant_revestiment_key?: string | null
          autoportant_transport_cost?: number | null
          autoportant_transport_km?: number | null
          autoportant_transport_km_override?: boolean | null
          autoportant_transport_sale?: number | null
          autoportant_transport_user_edited?: boolean | null
          bench_height?: number | null
          bench_length?: number | null
          bench_width?: number | null
          budget_date?: string | null
          client_address?: string | null
          client_email?: string | null
          client_name?: string
          client_nif?: string | null
          client_phone?: string | null
          client_town?: string | null
          comercial_id?: string | null
          construction_system?: string | null
          construction_year?: number | null
          contractant_address?: string | null
          contractant_name?: string | null
          contractant_nif?: string | null
          contractant_town?: string | null
          coronament_actuacio?: string | null
          coronament_beurada?: string | null
          coronament_beurada_color?: string | null
          coronament_encofrat_ml?: number | null
          coronament_format?: string | null
          coronament_inclos?: boolean
          coronament_ml?: number | null
          coronament_model_a_determinar?: boolean | null
          coronament_model_id?: string | null
          coronament_observacions?: string | null
          coronament_peces?: number | null
          coronament_tipus?: string | null
          created_at?: string
          current_coating?: string | null
          deleted?: boolean | null
          detected_problems?: Json | null
          ext_stairs_length?: number | null
          ext_stairs_width?: number | null
          filtration_system?: string | null
          general_condition?: string | null
          gunite_distancia_km?: number | null
          gunite_manguera_metres?: number | null
          has_access_stair?: boolean
          has_cover?: boolean | null
          has_electrolisi?: boolean | null
          has_electrolisi_2?: boolean | null
          has_exterior_stairs?: boolean | null
          has_jacuzzi?: boolean | null
          has_manual_material_entry?: boolean | null
          has_rebaix?: boolean
          has_robot?: boolean | null
          has_second_pool?: boolean | null
          id?: string
          instal_afm_article_id?: string | null
          instal_afm_enabled?: boolean | null
          instal_afm_qty?: number | null
          instal_bomba_enabled?: boolean | null
          instal_bomba_onoff_id?: string | null
          instal_bomba_onoff_opcional?: boolean | null
          instal_bomba_onoff_qty?: number | null
          instal_bomba_variable_id?: string | null
          instal_bomba_variable_opcional?: boolean | null
          instal_bomba_variable_qty?: number | null
          instal_canvi_medi_article_id?: string | null
          instal_canvi_medi_filtre?: string | null
          instal_canvi_sorra_article_id?: string | null
          instal_canvi_sorra_enabled?: boolean | null
          instal_caseta_enabled?: boolean | null
          instal_caseta_obra_alt?: number | null
          instal_caseta_obra_ample?: number | null
          instal_caseta_obra_llarg?: number | null
          instal_caseta_obra_portes?: string | null
          instal_caseta_observacions?: string | null
          instal_caseta_ubicacio?: string | null
          instal_depuracio_enabled?: boolean | null
          instal_dosificacio_enabled?: boolean | null
          instal_dosificacio_hc_option?: string | null
          instal_dosificacio_std_id?: string | null
          instal_dosificacio_std_opcional?: boolean | null
          instal_dosificacio_std_qty?: number | null
          instal_electrica_base_article_id?: string | null
          instal_electrica_distancia?: number | null
          instal_electrica_enabled?: boolean | null
          instal_electrica_extra_cost?: number | null
          instal_electrica_text?: string | null
          instal_electrica_total?: number | null
          instal_filtre_especial_id?: string | null
          instal_filtre_especial_opcional?: boolean | null
          instal_filtre_especial_qty?: number | null
          instal_filtre_polies_id?: string | null
          instal_filtre_polies_opcional?: boolean | null
          instal_filtre_polies_qty?: number | null
          instal_fontaneria_base_article_id?: string | null
          instal_fontaneria_caseta_tipus?: string | null
          instal_fontaneria_distancia?: number | null
          instal_fontaneria_enabled?: boolean | null
          instal_fontaneria_extra_cost?: number | null
          instal_fontaneria_local_tecnic?: string | null
          instal_fontaneria_perforacions?: boolean | null
          instal_fontaneria_perforacions_article_id?: string | null
          instal_fontaneria_rasas?: string | null
          instal_fontaneria_text?: string | null
          instal_fontaneria_total?: number | null
          instal_hidrolisi_id?: string | null
          instal_hidrolisi_opcional?: boolean | null
          instal_hidrolisi_qty?: number | null
          instal_prefiltre_article_id?: string | null
          instal_prefiltre_enabled?: boolean | null
          instal_prefiltre_qty?: number | null
          instal_quadre_addon_bc_cost?: number | null
          instal_quadre_addon_bc_sale?: number | null
          instal_quadre_addon_nf_cost?: number | null
          instal_quadre_addon_nf_sale?: number | null
          instal_quadre_base_cost?: number | null
          instal_quadre_base_sale?: number | null
          instal_quadre_display_text?: string | null
          instal_mo_hores_bomba?: number | null
          instal_mo_hores_depuracio?: number | null
          instal_mo_hores_dosificacio?: number | null
          instal_mo_hores_quadre?: number | null
          instal_quadre_enabled?: boolean | null
          instal_quadre_final_cost?: number | null
          instal_quadre_final_sale?: number | null
          instal_quadre_id?: string | null
          instal_quadre_manual_override?: boolean | null
          instal_quadre_recommended_id?: string | null
          instal_wifi_article_id?: string | null
          instal_wifi_enabled?: boolean | null
          interior_stairs_type?: string | null
          internal_notes?: string | null
          jacuzzi_air_jets_count?: number | null
          jacuzzi_air_jets_intake_count?: number | null
          jacuzzi_air_pump_article_id?: string | null
          jacuzzi_air_pump_qty?: number | null
          jacuzzi_bench_count?: number | null
          jacuzzi_bench_depth?: number | null
          jacuzzi_bench_height?: number | null
          jacuzzi_depth?: number | null
          jacuzzi_filter_article_id?: string | null
          jacuzzi_filter_qty?: number | null
          jacuzzi_filtration_pump_article_id?: string | null
          jacuzzi_filtration_pump_qty?: number | null
          jacuzzi_heat_pump_article_id?: string | null
          jacuzzi_heat_pump_qty?: number | null
          jacuzzi_led_article_id?: string | null
          jacuzzi_led_count?: number | null
          jacuzzi_length?: number | null
          jacuzzi_piezo_buttons_count?: number | null
          jacuzzi_position?: string | null
          jacuzzi_saline_electrolysis_article_id?: string | null
          jacuzzi_saline_electrolysis_qty?: number | null
          jacuzzi_stairs_count?: number | null
          jacuzzi_stairs_tread?: number | null
          jacuzzi_type?: string | null
          jacuzzi_water_jets_count?: number | null
          jacuzzi_water_jets_intake_count?: number | null
          jacuzzi_water_pump_article_id?: string | null
          jacuzzi_water_pump_qty?: number | null
          jacuzzi_width?: number | null
          kit_manguera_size?: string | null
          kit_pertiga_size?: string | null
          maintenance_periodicity?: string | null
          maintenance_plan?: Json | null
          maintenance_price?: number | null
          maintenance_services?: Json | null
          manual_material_entry_cost?: number | null
          manual_material_entry_sale?: number | null
          margin_pct?: number | null
          margin_pct_adjustment?: number
          new_coating?: string | null
          number: string
          obra_location?: string | null
          observations?: string | null
          opcional_revestiment_beurada?: string | null
          opcional_revestiment_beurada_color?: string | null
          opcional_revestiment_format?: string | null
          opcional_revestiment_model_id?: string | null
          opcional_revestiment_tipus?: string | null
          payment_conditions?: string | null
          photo_url?: string | null
          platform_height?: number | null
          platform_length?: number | null
          platform_width?: number | null
          pool_depth_avg?: number | null
          pool_depth_avg_2?: number | null
          pool_depth_max?: number | null
          pool_depth_min?: number | null
          pool_disposition?: string
          pool_length?: number | null
          pool_length_2?: number | null
          pool_shape?: string | null
          pool_surface_irregular?: number | null
          pool_surface_m2?: number | null
          pool_type?: string | null
          pool_volume_liters?: number | null
          pool_width?: number | null
          pool_width_2?: number | null
          rebaix_amount?: number
          rehab_notes?: Json | null
          rehab_works?: Json | null
          revestiment_actuacio?: string | null
          revestiment_beurada?: string | null
          revestiment_beurada_color?: string | null
          revestiment_exterior_beurada?: string | null
          revestiment_exterior_beurada_color?: string | null
          revestiment_exterior_format?: string | null
          revestiment_exterior_inclos?: boolean
          revestiment_exterior_model_a_determinar?: boolean | null
          revestiment_exterior_model_id?: string | null
          revestiment_format?: string | null
          revestiment_inclos?: boolean
          revestiment_mig_canya?: boolean | null
          revestiment_model_a_determinar?: boolean | null
          revestiment_model_id?: string | null
          revestiment_peces_especials?: boolean | null
          revestiment_qualitat?: string | null
          revestiment_tipus?: string | null
          stairs_height?: number | null
          stairs_length?: number | null
          stairs_width?: number | null
          status?: string
          total_cost?: number | null
          total_sale?: number | null
          type?: string
          updated_at?: string
          waterproofing_system?: string | null
        }
        Update: {
          acc_barana_enabled?: boolean | null
          acc_barana_model_id?: string | null
          acc_barana_qty?: number | null
          acc_basics_color?: string | null
          acc_cascada_bomba_article_id?: string | null
          acc_cascada_enabled?: boolean | null
          acc_cascada_model_id?: string | null
          acc_cascada_pulsador_article_id?: string | null
          acc_cascada_pulsador_qty?: number | null
          acc_cascada_qty?: number | null
          acc_control_rgb_model_id?: string | null
          acc_control_rgb_qty?: number | null
          acc_dutxa_enabled?: boolean | null
          acc_dutxa_model_id?: string | null
          acc_dutxa_qty?: number | null
          acc_embornal_model_id?: string | null
          acc_embornal_qty?: number | null
          acc_escala_enabled?: boolean | null
          acc_escala_model_id?: string | null
          acc_escala_qty?: number | null
          acc_focus_led_model_id?: string | null
          acc_focus_led_qty?: number | null
          acc_focus_led_text?: string | null
          acc_focus_led_variant?: string | null
          acc_impulsors_model_id?: string | null
          acc_impulsors_qty?: number | null
          acc_netejafons_model_id?: string | null
          acc_netejafons_qty?: number | null
          acc_plat_dutxa_ample?: number | null
          acc_plat_dutxa_enabled?: boolean | null
          acc_plat_dutxa_llarg?: number | null
          acc_plat_dutxa_manual_override?: boolean | null
          acc_plat_dutxa_qty?: number | null
          acc_plat_dutxa_sale?: number | null
          acc_plat_dutxa_sale_manual_override?: boolean | null
          acc_projector_mini_led_model_id?: string | null
          acc_projector_mini_led_qty?: number | null
          acc_regulador_model_id?: string | null
          acc_regulador_qty?: number | null
          acc_salvavides_enabled?: boolean | null
          acc_salvavides_model_id?: string | null
          acc_salvavides_qty?: number | null
          acc_skimmers_model_id?: string | null
          acc_skimmers_qty?: number | null
          access_platform_height?: number
          access_platform_length?: number
          access_platform_width?: number
          access_stair_height?: number
          access_stair_length?: number
          access_stair_width?: number
          altura_vista?: number
          annex_bomba_calor_article_id?: string | null
          annex_bomba_calor_coberta?: boolean | null
          annex_bomba_calor_des_de?: string | null
          annex_bomba_calor_estat?: string | null
          annex_bomba_calor_fins_a?: string | null
          annex_bomba_calor_kw_required?: number | null
          annex_bomba_calor_temperatura?: number | null
          annex_cobertor_calc_breakdown?: Json | null
          annex_cobertor_calc_cost?: number | null
          annex_cobertor_calc_sale?: number | null
          annex_cobertor_color_id?: string | null
          annex_cobertor_estat?: string | null
          annex_cobertor_lames?: string | null
          annex_cobertor_manual_amount?: number | null
          annex_cobertor_manual_override?: boolean | null
          annex_cobertor_model_code?: string | null
          annex_cobertor_model_id?: string | null
          annex_cobertor_mur_m2?: number | null
          annex_cobertor_mur_nou?: boolean | null
          annex_cobertor_tipus?: string | null
          annex_excavacio_estat?: string | null
          annex_excavacio_import?: number | null
          annex_excavacio_mano_obra_override?: number | null
          annex_excavacio_pill1_title?: string | null
          annex_excavacio_pill2_title?: string | null
          annex_excavacio_reompliment?: number | null
          annex_excavacio_reompliment_override?: number | null
          annex_excavacio_text1?: string | null
          annex_excavacio_text2?: string | null
          annex_gespa_article_id?: string | null
          annex_gespa_estat?: string | null
          annex_gespa_m2?: number | null
          annex_gespa_model?: string | null
          annex_gespa_preparacio_enabled?: boolean | null
          annex_gespa_preparacio_m2?: number | null
          annex_netejafons_article_id?: string | null
          annex_netejafons_escala?: number | null
          annex_netejafons_estat?: string | null
          annex_netejafons_extra_cost?: number | null
          annex_netejafons_fons?: number | null
          annex_netejafons_plataforma?: number | null
          annex_netejafons_total?: number | null
          annex_notes?: string | null
          annex_paviment_actuacio?: string | null
          annex_paviment_estat?: string | null
          annex_paviment_format?: string | null
          annex_paviment_formigo_enabled?: boolean | null
          annex_paviment_formigo_m2?: number | null
          annex_paviment_m2?: number | null
          annex_paviment_material?: string | null
          annex_paviment_model_a_determinar?: boolean | null
          annex_paviment_model_id?: string | null
          annex_paviment_nou_enabled?: boolean | null
          annex_paviment_reforma_enabled?: boolean | null
          annex_paviment_regularitzacio_enabled?: boolean | null
          annex_paviment_regularitzacio_m2?: number | null
          annex_paviment_retirada_enabled?: boolean | null
          annex_paviment_retirada_m2?: number | null
          annex_paviment_tipus?: string | null
          annex_projecte_article_id?: string | null
          annex_projecte_estat?: string | null
          annex_projecte_qty?: number | null
          annex_robot_article_id?: string | null
          annex_robot_estat?: string | null
          annex_robot_qty?: number | null
          autoportant_altura_aigua?: string | null
          autoportant_ample?: string | null
          autoportant_corona_key?: string | null
          autoportant_llarg?: string | null
          autoportant_model?: string | null
          autoportant_morter_color?: string | null
          autoportant_opc_asiento_acrilico_qty?: number | null
          autoportant_opc_asiento_porcelanico_qty?: number | null
          autoportant_opc_banco_gresite_qty?: number | null
          autoportant_opc_cascada?: boolean | null
          autoportant_opc_colchoneta?: boolean | null
          autoportant_opc_cristal?: boolean | null
          autoportant_opc_cubierta_electrica?: boolean | null
          autoportant_opc_spa?: boolean | null
          autoportant_revestiment_exterior_key?: string | null
          autoportant_revestiment_key?: string | null
          autoportant_transport_cost?: number | null
          autoportant_transport_km?: number | null
          autoportant_transport_km_override?: boolean | null
          autoportant_transport_sale?: number | null
          autoportant_transport_user_edited?: boolean | null
          bench_height?: number | null
          bench_length?: number | null
          bench_width?: number | null
          budget_date?: string | null
          client_address?: string | null
          client_email?: string | null
          client_name?: string
          client_nif?: string | null
          client_phone?: string | null
          client_town?: string | null
          comercial_id?: string | null
          construction_system?: string | null
          construction_year?: number | null
          contractant_address?: string | null
          contractant_name?: string | null
          contractant_nif?: string | null
          contractant_town?: string | null
          coronament_actuacio?: string | null
          coronament_beurada?: string | null
          coronament_beurada_color?: string | null
          coronament_encofrat_ml?: number | null
          coronament_format?: string | null
          coronament_inclos?: boolean
          coronament_ml?: number | null
          coronament_model_a_determinar?: boolean | null
          coronament_model_id?: string | null
          coronament_observacions?: string | null
          coronament_peces?: number | null
          coronament_tipus?: string | null
          created_at?: string
          current_coating?: string | null
          deleted?: boolean | null
          detected_problems?: Json | null
          ext_stairs_length?: number | null
          ext_stairs_width?: number | null
          filtration_system?: string | null
          general_condition?: string | null
          gunite_distancia_km?: number | null
          gunite_manguera_metres?: number | null
          has_access_stair?: boolean
          has_cover?: boolean | null
          has_electrolisi?: boolean | null
          has_electrolisi_2?: boolean | null
          has_exterior_stairs?: boolean | null
          has_jacuzzi?: boolean | null
          has_manual_material_entry?: boolean | null
          has_rebaix?: boolean
          has_robot?: boolean | null
          has_second_pool?: boolean | null
          id?: string
          instal_afm_article_id?: string | null
          instal_afm_enabled?: boolean | null
          instal_afm_qty?: number | null
          instal_bomba_enabled?: boolean | null
          instal_bomba_onoff_id?: string | null
          instal_bomba_onoff_opcional?: boolean | null
          instal_bomba_onoff_qty?: number | null
          instal_bomba_variable_id?: string | null
          instal_bomba_variable_opcional?: boolean | null
          instal_bomba_variable_qty?: number | null
          instal_canvi_medi_article_id?: string | null
          instal_canvi_medi_filtre?: string | null
          instal_canvi_sorra_article_id?: string | null
          instal_canvi_sorra_enabled?: boolean | null
          instal_caseta_enabled?: boolean | null
          instal_caseta_obra_alt?: number | null
          instal_caseta_obra_ample?: number | null
          instal_caseta_obra_llarg?: number | null
          instal_caseta_obra_portes?: string | null
          instal_caseta_observacions?: string | null
          instal_caseta_ubicacio?: string | null
          instal_depuracio_enabled?: boolean | null
          instal_dosificacio_enabled?: boolean | null
          instal_dosificacio_hc_option?: string | null
          instal_dosificacio_std_id?: string | null
          instal_dosificacio_std_opcional?: boolean | null
          instal_dosificacio_std_qty?: number | null
          instal_electrica_base_article_id?: string | null
          instal_electrica_distancia?: number | null
          instal_electrica_enabled?: boolean | null
          instal_electrica_extra_cost?: number | null
          instal_electrica_text?: string | null
          instal_electrica_total?: number | null
          instal_filtre_especial_id?: string | null
          instal_filtre_especial_opcional?: boolean | null
          instal_filtre_especial_qty?: number | null
          instal_filtre_polies_id?: string | null
          instal_filtre_polies_opcional?: boolean | null
          instal_filtre_polies_qty?: number | null
          instal_fontaneria_base_article_id?: string | null
          instal_fontaneria_caseta_tipus?: string | null
          instal_fontaneria_distancia?: number | null
          instal_fontaneria_enabled?: boolean | null
          instal_fontaneria_extra_cost?: number | null
          instal_fontaneria_local_tecnic?: string | null
          instal_fontaneria_perforacions?: boolean | null
          instal_fontaneria_perforacions_article_id?: string | null
          instal_fontaneria_rasas?: string | null
          instal_fontaneria_text?: string | null
          instal_fontaneria_total?: number | null
          instal_hidrolisi_id?: string | null
          instal_hidrolisi_opcional?: boolean | null
          instal_hidrolisi_qty?: number | null
          instal_prefiltre_article_id?: string | null
          instal_prefiltre_enabled?: boolean | null
          instal_prefiltre_qty?: number | null
          instal_quadre_addon_bc_cost?: number | null
          instal_quadre_addon_bc_sale?: number | null
          instal_quadre_addon_nf_cost?: number | null
          instal_quadre_addon_nf_sale?: number | null
          instal_quadre_base_cost?: number | null
          instal_quadre_base_sale?: number | null
          instal_quadre_display_text?: string | null
          instal_mo_hores_bomba?: number | null
          instal_mo_hores_depuracio?: number | null
          instal_mo_hores_dosificacio?: number | null
          instal_mo_hores_quadre?: number | null
          instal_quadre_enabled?: boolean | null
          instal_quadre_final_cost?: number | null
          instal_quadre_final_sale?: number | null
          instal_quadre_id?: string | null
          instal_quadre_manual_override?: boolean | null
          instal_quadre_recommended_id?: string | null
          instal_wifi_article_id?: string | null
          instal_wifi_enabled?: boolean | null
          interior_stairs_type?: string | null
          internal_notes?: string | null
          jacuzzi_air_jets_count?: number | null
          jacuzzi_air_jets_intake_count?: number | null
          jacuzzi_air_pump_article_id?: string | null
          jacuzzi_air_pump_qty?: number | null
          jacuzzi_bench_count?: number | null
          jacuzzi_bench_depth?: number | null
          jacuzzi_bench_height?: number | null
          jacuzzi_depth?: number | null
          jacuzzi_filter_article_id?: string | null
          jacuzzi_filter_qty?: number | null
          jacuzzi_filtration_pump_article_id?: string | null
          jacuzzi_filtration_pump_qty?: number | null
          jacuzzi_heat_pump_article_id?: string | null
          jacuzzi_heat_pump_qty?: number | null
          jacuzzi_led_article_id?: string | null
          jacuzzi_led_count?: number | null
          jacuzzi_length?: number | null
          jacuzzi_piezo_buttons_count?: number | null
          jacuzzi_position?: string | null
          jacuzzi_saline_electrolysis_article_id?: string | null
          jacuzzi_saline_electrolysis_qty?: number | null
          jacuzzi_stairs_count?: number | null
          jacuzzi_stairs_tread?: number | null
          jacuzzi_type?: string | null
          jacuzzi_water_jets_count?: number | null
          jacuzzi_water_jets_intake_count?: number | null
          jacuzzi_water_pump_article_id?: string | null
          jacuzzi_water_pump_qty?: number | null
          jacuzzi_width?: number | null
          kit_manguera_size?: string | null
          kit_pertiga_size?: string | null
          maintenance_periodicity?: string | null
          maintenance_plan?: Json | null
          maintenance_price?: number | null
          maintenance_services?: Json | null
          manual_material_entry_cost?: number | null
          manual_material_entry_sale?: number | null
          margin_pct?: number | null
          margin_pct_adjustment?: number
          new_coating?: string | null
          number?: string
          obra_location?: string | null
          observations?: string | null
          opcional_revestiment_beurada?: string | null
          opcional_revestiment_beurada_color?: string | null
          opcional_revestiment_format?: string | null
          opcional_revestiment_model_id?: string | null
          opcional_revestiment_tipus?: string | null
          payment_conditions?: string | null
          photo_url?: string | null
          platform_height?: number | null
          platform_length?: number | null
          platform_width?: number | null
          pool_depth_avg?: number | null
          pool_depth_avg_2?: number | null
          pool_depth_max?: number | null
          pool_depth_min?: number | null
          pool_disposition?: string
          pool_length?: number | null
          pool_length_2?: number | null
          pool_shape?: string | null
          pool_surface_irregular?: number | null
          pool_surface_m2?: number | null
          pool_type?: string | null
          pool_volume_liters?: number | null
          pool_width?: number | null
          pool_width_2?: number | null
          rebaix_amount?: number
          rehab_notes?: Json | null
          rehab_works?: Json | null
          revestiment_actuacio?: string | null
          revestiment_beurada?: string | null
          revestiment_beurada_color?: string | null
          revestiment_exterior_beurada?: string | null
          revestiment_exterior_beurada_color?: string | null
          revestiment_exterior_format?: string | null
          revestiment_exterior_inclos?: boolean
          revestiment_exterior_model_a_determinar?: boolean | null
          revestiment_exterior_model_id?: string | null
          revestiment_format?: string | null
          revestiment_inclos?: boolean
          revestiment_mig_canya?: boolean | null
          revestiment_model_a_determinar?: boolean | null
          revestiment_model_id?: string | null
          revestiment_peces_especials?: boolean | null
          revestiment_qualitat?: string | null
          revestiment_tipus?: string | null
          stairs_height?: number | null
          stairs_length?: number | null
          stairs_width?: number | null
          status?: string
          total_cost?: number | null
          total_sale?: number | null
          type?: string
          updated_at?: string
          waterproofing_system?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budgets_annex_cobertor_color_id_fkey"
            columns: ["annex_cobertor_color_id"]
            isOneToOne: false
            referencedRelation: "cover_colors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_annex_cobertor_model_id_fkey"
            columns: ["annex_cobertor_model_id"]
            isOneToOne: false
            referencedRelation: "cover_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_instal_prefiltre_article_id_fkey"
            columns: ["instal_prefiltre_article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_jacuzzi_air_pump_article_id_fkey"
            columns: ["jacuzzi_air_pump_article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_jacuzzi_water_pump_article_id_fkey"
            columns: ["jacuzzi_water_pump_article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_jacuzzi_filtration_pump_article_id_fkey"
            columns: ["jacuzzi_filtration_pump_article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_jacuzzi_filter_article_id_fkey"
            columns: ["jacuzzi_filter_article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_jacuzzi_led_article_id_fkey"
            columns: ["jacuzzi_led_article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_jacuzzi_heat_pump_article_id_fkey"
            columns: ["jacuzzi_heat_pump_article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_jacuzzi_saline_electrolysis_article_id_fkey"
            columns: ["jacuzzi_saline_electrolysis_article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address: string | null
          budget_number_format: string | null
          cif: string | null
          company_name: string | null
          default_iva: number | null
          default_payment_conditions: string | null
          email: string | null
          id: string
          logo_url: string | null
          phone: string | null
          town: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          budget_number_format?: string | null
          cif?: string | null
          company_name?: string | null
          default_iva?: number | null
          default_payment_conditions?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          town?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          budget_number_format?: string | null
          cif?: string | null
          company_name?: string | null
          default_iva?: number | null
          default_payment_conditions?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          town?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      cover_colors: {
        Row: {
          code: string
          created_at: string
          id: string
          image_url: string | null
          material: string
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          image_url?: string | null
          material: string
          name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          image_url?: string | null
          material?: string
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      cover_lama_prices: {
        Row: {
          created_at: string
          id: string
          material: string
          price_per_m: number
          updated_at: string
          width_m: number
        }
        Insert: {
          created_at?: string
          id?: string
          material: string
          price_per_m?: number
          updated_at?: string
          width_m: number
        }
        Update: {
          created_at?: string
          id?: string
          material?: string
          price_per_m?: number
          updated_at?: string
          width_m?: number
        }
        Relationships: []
      }
      cover_model_colors: {
        Row: {
          color_id: string
          id: string
          model_id: string
        }
        Insert: {
          color_id: string
          id?: string
          model_id: string
        }
        Update: {
          color_id?: string
          id?: string
          model_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cover_model_colors_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "cover_colors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cover_model_colors_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "cover_models"
            referencedColumns: ["id"]
          },
        ]
      }
      cover_model_prices: {
        Row: {
          created_at: string
          id: string
          max_length_m: number
          model_id: string
          notes: string | null
          price_eur: number
          updated_at: string
          width_m: number
        }
        Insert: {
          created_at?: string
          id?: string
          max_length_m?: number
          model_id: string
          notes?: string | null
          price_eur?: number
          updated_at?: string
          width_m: number
        }
        Update: {
          created_at?: string
          id?: string
          max_length_m?: number
          model_id?: string
          notes?: string | null
          price_eur?: number
          updated_at?: string
          width_m?: number
        }
        Relationships: [
          {
            foreignKeyName: "cover_model_prices_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "cover_models"
            referencedColumns: ["id"]
          },
        ]
      }
      cover_models: {
        Row: {
          code: string
          cover_type: string
          created_at: string
          id: string
          image_url: string | null
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          code: string
          cover_type: string
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          code?: string
          cover_type?: string
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      cover_settings: {
        Row: {
          cost_factor: number
          embalatge_eur: number
          id: string
          installation_fora_aigua_eur: number
          installation_submergit_eur: number
          transport_eur: number
          updated_at: string
        }
        Insert: {
          cost_factor?: number
          embalatge_eur?: number
          id?: string
          installation_fora_aigua_eur?: number
          installation_submergit_eur?: number
          transport_eur?: number
          updated_at?: string
        }
        Update: {
          cost_factor?: number
          embalatge_eur?: number
          id?: string
          installation_fora_aigua_eur?: number
          installation_submergit_eur?: number
          transport_eur?: number
          updated_at?: string
        }
        Relationships: []
      }
      formula_execution_log: {
        Row: {
          budget_id: string
          executed_at: string
          formula_used: string
          id: string
          result_cost: number
          result_sale: number
          rule_id: string
          variables_snapshot: Json
        }
        Insert: {
          budget_id: string
          executed_at?: string
          formula_used: string
          id?: string
          result_cost?: number
          result_sale?: number
          rule_id: string
          variables_snapshot?: Json
        }
        Update: {
          budget_id?: string
          executed_at?: string
          formula_used?: string
          id?: string
          result_cost?: number
          result_sale?: number
          rule_id?: string
          variables_snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "formula_execution_log_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formula_execution_log_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "formula_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      formula_rules: {
        Row: {
          article_ref: string | null
          budget_type: string
          condition_field: string | null
          condition_value: string | null
          created_at: string
          description: string | null
          formula_cost: string | null
          formula_quantity: string | null
          formula_sale: string
          id: string
          is_active: boolean
          is_conditional: boolean
          name: string
          notes: string | null
          order_index: number
          phase: string
          sub_phase: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          article_ref?: string | null
          budget_type?: string
          condition_field?: string | null
          condition_value?: string | null
          created_at?: string
          description?: string | null
          formula_cost?: string | null
          formula_quantity?: string | null
          formula_sale?: string
          id?: string
          is_active?: boolean
          is_conditional?: boolean
          name: string
          notes?: string | null
          order_index?: number
          phase: string
          sub_phase?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          article_ref?: string | null
          budget_type?: string
          condition_field?: string | null
          condition_value?: string | null
          created_at?: string
          description?: string | null
          formula_cost?: string | null
          formula_quantity?: string | null
          formula_sale?: string
          id?: string
          is_active?: boolean
          is_conditional?: boolean
          name?: string
          notes?: string | null
          order_index?: number
          phase?: string
          sub_phase?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      formula_variables: {
        Row: {
          category: string
          description: string | null
          example_value: number | null
          id: string
          label: string
          source_field: string | null
          variable_name: string
        }
        Insert: {
          category?: string
          description?: string | null
          example_value?: number | null
          id?: string
          label: string
          source_field?: string | null
          variable_name: string
        }
        Update: {
          category?: string
          description?: string | null
          example_value?: number | null
          id?: string
          label?: string
          source_field?: string | null
          variable_name?: string
        }
        Relationships: []
      }
      obra_activity: {
        Row: {
          created_at: string
          id: string
          kind: string
          message: string
          obra_id: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          message: string
          obra_id: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          message?: string
          obra_id?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "obra_activity_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_cost_items: {
        Row: {
          article_id: string | null
          created_at: string
          created_by: string | null
          description: string
          estimated_qty: number | null
          estimated_total_cost: number | null
          estimated_unit_cost: number | null
          id: string
          invoice_date: string | null
          invoice_ref: string | null
          is_extra: boolean
          notes: string | null
          obra_id: string
          phase_id: string
          real_qty: number | null
          real_total_cost: number | null
          real_unit_cost: number | null
          supplier_name: string | null
          updated_at: string
        }
        Insert: {
          article_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          estimated_qty?: number | null
          estimated_total_cost?: number | null
          estimated_unit_cost?: number | null
          id?: string
          invoice_date?: string | null
          invoice_ref?: string | null
          is_extra?: boolean
          notes?: string | null
          obra_id: string
          phase_id: string
          real_qty?: number | null
          real_total_cost?: number | null
          real_unit_cost?: number | null
          supplier_name?: string | null
          updated_at?: string
        }
        Update: {
          article_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          estimated_qty?: number | null
          estimated_total_cost?: number | null
          estimated_unit_cost?: number | null
          id?: string
          invoice_date?: string | null
          invoice_ref?: string | null
          is_extra?: boolean
          notes?: string | null
          obra_id?: string
          phase_id?: string
          real_qty?: number | null
          real_total_cost?: number | null
          real_unit_cost?: number | null
          supplier_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_cost_items_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_cost_items_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "obra_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_phases: {
        Row: {
          cost_estimated: number
          cost_real: number
          created_at: string
          id: string
          obra_id: string
          order_index: number
          phase_name: string
          sale_estimated: number
          status: string
          updated_at: string
        }
        Insert: {
          cost_estimated?: number
          cost_real?: number
          created_at?: string
          id?: string
          obra_id: string
          order_index?: number
          phase_name: string
          sale_estimated?: number
          status?: string
          updated_at?: string
        }
        Update: {
          cost_estimated?: number
          cost_real?: number
          created_at?: string
          id?: string
          obra_id?: string
          order_index?: number
          phase_name?: string
          sale_estimated?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_phases_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          budget_id: string
          budget_number: string
          client_name: string
          client_town: string
          comercial_id: string | null
          created_at: string
          end_date_estimated: string | null
          end_date_real: string | null
          id: string
          margin_estimated_pct: number
          margin_real_pct: number
          notes: string | null
          start_date: string | null
          status: string
          total_cost_estimated: number
          total_cost_real: number
          total_sale_estimated: number
          updated_at: string
        }
        Insert: {
          budget_id: string
          budget_number: string
          client_name?: string
          client_town?: string
          comercial_id?: string | null
          created_at?: string
          end_date_estimated?: string | null
          end_date_real?: string | null
          id?: string
          margin_estimated_pct?: number
          margin_real_pct?: number
          notes?: string | null
          start_date?: string | null
          status?: string
          total_cost_estimated?: number
          total_cost_real?: number
          total_sale_estimated?: number
          updated_at?: string
        }
        Update: {
          budget_id?: string
          budget_number?: string
          client_name?: string
          client_town?: string
          comercial_id?: string | null
          created_at?: string
          end_date_estimated?: string | null
          end_date_real?: string | null
          id?: string
          margin_estimated_pct?: number
          margin_real_pct?: number
          notes?: string | null
          start_date?: string | null
          status?: string
          total_cost_estimated?: number
          total_cost_real?: number
          total_sale_estimated?: number
          updated_at?: string
        }
        Relationships: []
      }
      pressupost_annex_items: {
        Row: {
          annex_id: string
          article_id: string | null
          created_at: string
          description: string
          id: string
          order: number
          quantity: number
          unit: string
          unit_cost: number
          unit_sale: number
        }
        Insert: {
          annex_id: string
          article_id?: string | null
          created_at?: string
          description?: string
          id?: string
          order?: number
          quantity?: number
          unit?: string
          unit_cost?: number
          unit_sale?: number
        }
        Update: {
          annex_id?: string
          article_id?: string | null
          created_at?: string
          description?: string
          id?: string
          order?: number
          quantity?: number
          unit?: string
          unit_cost?: number
          unit_sale?: number
        }
        Relationships: [
          {
            foreignKeyName: "pressupost_annex_items_annex_id_fkey"
            columns: ["annex_id"]
            isOneToOne: false
            referencedRelation: "pressupost_annexos"
            referencedColumns: ["id"]
          },
        ]
      }
      pressupost_annexos: {
        Row: {
          accepted_at: string | null
          annex_date: string | null
          annex_index: number
          assisted_meta: Json
          assisted_seeds: string[]
          budget_id: string
          comercial_id: string | null
          created_at: string
          deleted: boolean
          description: string | null
          global_pct: number
          id: string
          margin_pct: number
          number: string
          obra_id: string | null
          observations: string | null
          payment_conditions: string | null
          reason: string | null
          sent_at: string | null
          status: string
          title: string
          total_cost: number
          total_sale: number
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          annex_date?: string | null
          annex_index?: number
          assisted_meta?: Json
          assisted_seeds?: string[]
          budget_id: string
          comercial_id?: string | null
          created_at?: string
          deleted?: boolean
          description?: string | null
          global_pct?: number
          id?: string
          margin_pct?: number
          number: string
          obra_id?: string | null
          observations?: string | null
          payment_conditions?: string | null
          reason?: string | null
          sent_at?: string | null
          status?: string
          title?: string
          total_cost?: number
          total_sale?: number
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          annex_date?: string | null
          annex_index?: number
          assisted_meta?: Json
          assisted_seeds?: string[]
          budget_id?: string
          comercial_id?: string | null
          created_at?: string
          deleted?: boolean
          description?: string | null
          global_pct?: number
          id?: string
          margin_pct?: number
          number?: string
          obra_id?: string | null
          observations?: string | null
          payment_conditions?: string | null
          reason?: string | null
          sent_at?: string | null
          status?: string
          title?: string
          total_cost?: number
          total_sale?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          full_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      stair_images: {
        Row: {
          id: string
          image_url: string | null
          stair_type: string
          updated_at: string
        }
        Insert: {
          id?: string
          image_url?: string | null
          stair_type: string
          updated_at?: string
        }
        Update: {
          id?: string
          image_url?: string | null
          stair_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          contact_email: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_comercials: {
        Args: never
        Returns: {
          email: string
          full_name: string
          id: string
        }[]
      }
      recalc_annex_totals: { Args: { _annex_id: string }; Returns: undefined }
      recalc_obra_totals: { Args: { _obra_id: string }; Returns: undefined }
      recompute_obra_realtime: {
        Args: { _obra_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "comercial" | "administrativa"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "comercial", "administrativa"],
    },
  },
} as const
