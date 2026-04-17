export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string | null
          user_id: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string | null
          user_id?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string | null
          user_id?: string | null
          value?: Json
        }
        Relationships: []
      }
      bundle_items: {
        Row: {
          bundle_id: string
          position: number | null
          product_id: string
          user_id: string | null
        }
        Insert: {
          bundle_id: string
          position?: number | null
          product_id: string
          user_id?: string | null
        }
        Update: {
          bundle_id?: string
          position?: number | null
          product_id?: string
          user_id?: string | null
        }
        Relationships: [
          { foreignKeyName: "bundle_items_bundle_id_fkey"; columns: ["bundle_id"]; isOneToOne: false; referencedRelation: "bundles"; referencedColumns: ["id"] },
          { foreignKeyName: "bundle_items_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] }
        ]
      }
      bundles: {
        Row: {
          bundle_type: Database["public"]["Enums"]["bundle_type"] | null
          claude_reasoning: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["product_status"] | null
          suggested_by: string | null
          suggested_price: number | null
          title: string
          total_individual_value: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          bundle_type?: Database["public"]["Enums"]["bundle_type"] | null
          claude_reasoning?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["product_status"] | null
          suggested_by?: string | null
          suggested_price?: number | null
          title: string
          total_individual_value?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          bundle_type?: Database["public"]["Enums"]["bundle_type"] | null
          claude_reasoning?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["product_status"] | null
          suggested_by?: string | null
          suggested_price?: number | null
          title?: string
          total_individual_value?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      buyback_quotes: {
        Row: {
          buyback_service_id: string
          conditions: string | null
          fetched_at: string | null
          id: string
          product_id: string
          quote_source: string | null
          quote_url: string | null
          quoted_price: number | null
          user_id: string | null
          valid_until: string | null
        }
        Insert: {
          buyback_service_id: string
          conditions?: string | null
          fetched_at?: string | null
          id?: string
          product_id: string
          quote_source?: string | null
          quote_url?: string | null
          quoted_price?: number | null
          user_id?: string | null
          valid_until?: string | null
        }
        Update: {
          buyback_service_id?: string
          conditions?: string | null
          fetched_at?: string | null
          id?: string
          product_id?: string
          quote_source?: string | null
          quote_url?: string | null
          quoted_price?: number | null
          user_id?: string | null
          valid_until?: string | null
        }
        Relationships: [
          { foreignKeyName: "buyback_quotes_buyback_service_id_fkey"; columns: ["buyback_service_id"]; isOneToOne: false; referencedRelation: "buyback_services"; referencedColumns: ["id"] },
          { foreignKeyName: "buyback_quotes_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] }
        ]
      }
      buyback_services: {
        Row: {
          api_available: boolean | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          slug: Database["public"]["Enums"]["buyback_service_slug"]
          specialization: string | null
          typical_discount: number | null
          website_url: string | null
        }
        Insert: {
          api_available?: boolean | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          slug: Database["public"]["Enums"]["buyback_service_slug"]
          specialization?: string | null
          typical_discount?: number | null
          website_url?: string | null
        }
        Update: {
          api_available?: boolean | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          slug?: Database["public"]["Enums"]["buyback_service_slug"]
          specialization?: string | null
          typical_discount?: number | null
          website_url?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          name: string
          parent_slug: Database["public"]["Enums"]["category_slug"] | null
          preferred_buyback_services: Database["public"]["Enums"]["buyback_service_slug"][] | null
          preferred_platforms: Database["public"]["Enums"]["platform_slug"][] | null
          slug: Database["public"]["Enums"]["category_slug"]
          spec_schema: Json | null
        }
        Insert: {
          id?: string
          name: string
          parent_slug?: Database["public"]["Enums"]["category_slug"] | null
          preferred_buyback_services?: Database["public"]["Enums"]["buyback_service_slug"][] | null
          preferred_platforms?: Database["public"]["Enums"]["platform_slug"][] | null
          slug: Database["public"]["Enums"]["category_slug"]
          spec_schema?: Json | null
        }
        Update: {
          id?: string
          name?: string
          parent_slug?: Database["public"]["Enums"]["category_slug"] | null
          preferred_buyback_services?: Database["public"]["Enums"]["buyback_service_slug"][] | null
          preferred_platforms?: Database["public"]["Enums"]["platform_slug"][] | null
          slug?: Database["public"]["Enums"]["category_slug"]
          spec_schema?: Json | null
        }
        Relationships: [
          { foreignKeyName: "categories_parent_slug_fkey"; columns: ["parent_slug"]; isOneToOne: false; referencedRelation: "categories"; referencedColumns: ["slug"] }
        ]
      }
      claude_analyses: {
        Row: {
          analysis_type: string | null
          applied: boolean | null
          claude_response: Json | null
          claude_source: string | null
          created_at: string | null
          id: string
          subject_products: string[] | null
          user_id: string | null
          user_prompt: string | null
        }
        Insert: {
          analysis_type?: string | null
          applied?: boolean | null
          claude_response?: Json | null
          claude_source?: string | null
          created_at?: string | null
          id?: string
          subject_products?: string[] | null
          user_id?: string | null
          user_prompt?: string | null
        }
        Update: {
          analysis_type?: string | null
          applied?: boolean | null
          claude_response?: Json | null
          claude_source?: string | null
          created_at?: string | null
          id?: string
          subject_products?: string[] | null
          user_id?: string | null
          user_prompt?: string | null
        }
        Relationships: []
      }
      listings: {
        Row: {
          approved_at: string | null
          created_at: string | null
          deleted_at: string | null
          error_message: string | null
          expires_at: string | null
          external_id: string | null
          final_description: string | null
          final_title: string | null
          generated_description: string | null
          generated_title: string | null
          id: string
          listing_url: string | null
          platform_attrs: Json | null
          platform_category_id: string | null
          platform_id: string
          price: number
          product_id: string
          published_at: string | null
          shipping_price: number | null
          sold_at: string | null
          status: Database["public"]["Enums"]["listing_status"] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          approved_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          error_message?: string | null
          expires_at?: string | null
          external_id?: string | null
          final_description?: string | null
          final_title?: string | null
          generated_description?: string | null
          generated_title?: string | null
          id?: string
          listing_url?: string | null
          platform_attrs?: Json | null
          platform_category_id?: string | null
          platform_id: string
          price: number
          product_id: string
          published_at?: string | null
          shipping_price?: number | null
          sold_at?: string | null
          status?: Database["public"]["Enums"]["listing_status"] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          approved_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          error_message?: string | null
          expires_at?: string | null
          external_id?: string | null
          final_description?: string | null
          final_title?: string | null
          generated_description?: string | null
          generated_title?: string | null
          id?: string
          listing_url?: string | null
          platform_attrs?: Json | null
          platform_category_id?: string | null
          platform_id?: string
          price?: number
          product_id?: string
          published_at?: string | null
          shipping_price?: number | null
          sold_at?: string | null
          status?: Database["public"]["Enums"]["listing_status"] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          { foreignKeyName: "listings_platform_id_fkey"; columns: ["platform_id"]; isOneToOne: false; referencedRelation: "platforms"; referencedColumns: ["id"] },
          { foreignKeyName: "listings_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] }
        ]
      }
      photos: {
        Row: {
          capture_mode: string | null
          created_at: string | null
          deleted_at: string | null
          detected_sticker: string | null
          height: number | null
          id: string
          ocr_confidence: number | null
          order_index: number | null
          photo_type: Database["public"]["Enums"]["photo_type"] | null
          product_id: string
          size_bytes: number | null
          sticker_visible: boolean | null
          storage_path: string
          thumbnail_path: string | null
          user_id: string | null
          width: number | null
        }
        Insert: {
          capture_mode?: string | null
          created_at?: string | null
          deleted_at?: string | null
          detected_sticker?: string | null
          height?: number | null
          id?: string
          ocr_confidence?: number | null
          order_index?: number | null
          photo_type?: Database["public"]["Enums"]["photo_type"] | null
          product_id: string
          size_bytes?: number | null
          sticker_visible?: boolean | null
          storage_path: string
          thumbnail_path?: string | null
          user_id?: string | null
          width?: number | null
        }
        Update: {
          capture_mode?: string | null
          created_at?: string | null
          deleted_at?: string | null
          detected_sticker?: string | null
          height?: number | null
          id?: string
          ocr_confidence?: number | null
          order_index?: number | null
          photo_type?: Database["public"]["Enums"]["photo_type"] | null
          product_id?: string
          size_bytes?: number | null
          sticker_visible?: boolean | null
          storage_path?: string
          thumbnail_path?: string | null
          user_id?: string | null
          width?: number | null
        }
        Relationships: [
          { foreignKeyName: "photos_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] }
        ]
      }
      platforms: {
        Row: {
          api_available: boolean | null
          api_type: string | null
          base_url: string | null
          commission_rate: number | null
          fixed_fee: number | null
          id: string
          is_active: boolean | null
          name: string
          slug: Database["public"]["Enums"]["platform_slug"]
          supports_bulk: boolean | null
        }
        Insert: {
          api_available?: boolean | null
          api_type?: string | null
          base_url?: string | null
          commission_rate?: number | null
          fixed_fee?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: Database["public"]["Enums"]["platform_slug"]
          supports_bulk?: boolean | null
        }
        Update: {
          api_available?: boolean | null
          api_type?: string | null
          base_url?: string | null
          commission_rate?: number | null
          fixed_fee?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: Database["public"]["Enums"]["platform_slug"]
          supports_bulk?: boolean | null
        }
        Relationships: []
      }
      price_history: {
        Row: {
          currency: string | null
          fetched_at: string | null
          id: string
          platform_id: string | null
          price_avg: number | null
          price_high: number | null
          price_low: number | null
          price_trend: number | null
          product_id: string | null
          sample_count: number | null
          search_query: string | null
          source_url: string | null
          user_id: string | null
        }
        Insert: {
          currency?: string | null
          fetched_at?: string | null
          id?: string
          platform_id?: string | null
          price_avg?: number | null
          price_high?: number | null
          price_low?: number | null
          price_trend?: number | null
          product_id?: string | null
          sample_count?: number | null
          search_query?: string | null
          source_url?: string | null
          user_id?: string | null
        }
        Update: {
          currency?: string | null
          fetched_at?: string | null
          id?: string
          platform_id?: string | null
          price_avg?: number | null
          price_high?: number | null
          price_low?: number | null
          price_trend?: number | null
          product_id?: string | null
          sample_count?: number | null
          search_query?: string | null
          source_url?: string | null
          user_id?: string | null
        }
        Relationships: [
          { foreignKeyName: "price_history_platform_id_fkey"; columns: ["platform_id"]; isOneToOne: false; referencedRelation: "platforms"; referencedColumns: ["id"] },
          { foreignKeyName: "price_history_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] }
        ]
      }
      price_watches: {
        Row: {
          alert_on_below: number | null
          category_slug: Database["public"]["Enums"]["category_slug"] | null
          check_interval_hours: number | null
          created_at: string | null
          current_lowest: number | null
          id: string
          is_active: boolean | null
          last_checked_at: string | null
          name: string | null
          platform_id: string | null
          search_query: string
          target_price: number | null
          user_id: string | null
        }
        Insert: {
          alert_on_below?: number | null
          category_slug?: Database["public"]["Enums"]["category_slug"] | null
          check_interval_hours?: number | null
          created_at?: string | null
          current_lowest?: number | null
          id?: string
          is_active?: boolean | null
          last_checked_at?: string | null
          name?: string | null
          platform_id?: string | null
          search_query: string
          target_price?: number | null
          user_id?: string | null
        }
        Update: {
          alert_on_below?: number | null
          category_slug?: Database["public"]["Enums"]["category_slug"] | null
          check_interval_hours?: number | null
          created_at?: string | null
          current_lowest?: number | null
          id?: string
          is_active?: boolean | null
          last_checked_at?: string | null
          name?: string | null
          platform_id?: string | null
          search_query?: string
          target_price?: number | null
          user_id?: string | null
        }
        Relationships: [
          { foreignKeyName: "price_watches_platform_id_fkey"; columns: ["platform_id"]; isOneToOne: false; referencedRelation: "platforms"; referencedColumns: ["id"] }
        ]
      }
      products: {
        Row: {
          analyzed_at: string | null
          barcode_type: string | null
          category_slug: Database["public"]["Enums"]["category_slug"] | null
          condition: Database["public"]["Enums"]["product_condition"] | null
          created_at: string | null
          defects: string[] | null
          deleted_at: string | null
          description: string | null
          ean: string | null
          estimated_value_max: number | null
          estimated_value_min: number | null
          id: string
          identified_via: string | null
          included_accessories: string[] | null
          indexed_at: string | null
          indexing_notes: string | null
          missing_items: string[] | null
          new_price: number | null
          new_price_source_url: string | null
          provenance_notes: string | null
          recommended_price: number | null
          selling_tier: string | null
          sold_at: string | null
          sold_platform_id: string | null
          sold_price: number | null
          specs: Json | null
          status: Database["public"]["Enums"]["product_status"] | null
          sticker_confidence: number | null
          sticker_id: string | null
          sticker_input_method: Database["public"]["Enums"]["sticker_input_method"] | null
          title: string | null
          updated_at: string | null
          user_id: string | null
          working_title: string | null
        }
        Insert: {
          analyzed_at?: string | null
          barcode_type?: string | null
          category_slug?: Database["public"]["Enums"]["category_slug"] | null
          condition?: Database["public"]["Enums"]["product_condition"] | null
          created_at?: string | null
          defects?: string[] | null
          deleted_at?: string | null
          description?: string | null
          ean?: string | null
          estimated_value_max?: number | null
          estimated_value_min?: number | null
          id?: string
          identified_via?: string | null
          included_accessories?: string[] | null
          indexed_at?: string | null
          indexing_notes?: string | null
          missing_items?: string[] | null
          new_price?: number | null
          new_price_source_url?: string | null
          provenance_notes?: string | null
          recommended_price?: number | null
          selling_tier?: string | null
          sold_at?: string | null
          sold_platform_id?: string | null
          sold_price?: number | null
          specs?: Json | null
          status?: Database["public"]["Enums"]["product_status"] | null
          sticker_confidence?: number | null
          sticker_id?: string | null
          sticker_input_method?: Database["public"]["Enums"]["sticker_input_method"] | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          working_title?: string | null
        }
        Update: {
          analyzed_at?: string | null
          barcode_type?: string | null
          category_slug?: Database["public"]["Enums"]["category_slug"] | null
          condition?: Database["public"]["Enums"]["product_condition"] | null
          created_at?: string | null
          defects?: string[] | null
          deleted_at?: string | null
          description?: string | null
          ean?: string | null
          estimated_value_max?: number | null
          estimated_value_min?: number | null
          id?: string
          identified_via?: string | null
          included_accessories?: string[] | null
          indexed_at?: string | null
          indexing_notes?: string | null
          missing_items?: string[] | null
          new_price?: number | null
          new_price_source_url?: string | null
          provenance_notes?: string | null
          recommended_price?: number | null
          selling_tier?: string | null
          sold_at?: string | null
          sold_platform_id?: string | null
          sold_price?: number | null
          specs?: Json | null
          status?: Database["public"]["Enums"]["product_status"] | null
          sticker_confidence?: number | null
          sticker_id?: string | null
          sticker_input_method?: Database["public"]["Enums"]["sticker_input_method"] | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          working_title?: string | null
        }
        Relationships: [
          { foreignKeyName: "products_category_slug_fkey"; columns: ["category_slug"]; isOneToOne: false; referencedRelation: "categories"; referencedColumns: ["slug"] },
          { foreignKeyName: "products_sold_platform_id_fkey"; columns: ["sold_platform_id"]; isOneToOne: false; referencedRelation: "platforms"; referencedColumns: ["id"] }
        ]
      }
      sticker_sheets: {
        Row: {
          created_at: string | null
          end_number: number
          id: string
          notes: string | null
          pdf_storage_path: string | null
          printed_at: string | null
          sheet_count: number | null
          start_number: number
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          end_number: number
          id?: string
          notes?: string | null
          pdf_storage_path?: string | null
          printed_at?: string | null
          sheet_count?: number | null
          start_number: number
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          end_number?: number
          id?: string
          notes?: string | null
          pdf_storage_path?: string | null
          printed_at?: string | null
          sheet_count?: number | null
          start_number?: number
          user_id?: string | null
        }
        Relationships: []
      }
      taxatie_exports: {
        Row: {
          bundle_id: string | null
          exported_at: string | null
          id: string
          pdf_storage_path: string | null
          product_id: string | null
          recipient_email: string | null
          recipient_name: string | null
          user_id: string | null
        }
        Insert: {
          bundle_id?: string | null
          exported_at?: string | null
          id?: string
          pdf_storage_path?: string | null
          product_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          user_id?: string | null
        }
        Update: {
          bundle_id?: string | null
          exported_at?: string | null
          id?: string
          pdf_storage_path?: string | null
          product_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          user_id?: string | null
        }
        Relationships: [
          { foreignKeyName: "taxatie_exports_bundle_id_fkey"; columns: ["bundle_id"]; isOneToOne: false; referencedRelation: "bundles"; referencedColumns: ["id"] },
          { foreignKeyName: "taxatie_exports_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] }
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      reserve_next_sticker: {
        Args: { p_count: number; p_user_id: string }
        Returns: string[]
      }
    }
    Enums: {
      bundle_type: "ram_kit" | "console_bundle" | "card_lot" | "card_set" | "hardware_bundle" | "custom"
      buyback_service_slug: "levelseven" | "nedgame" | "flashkaartshop" | "rarecards" | "catchcollect" | "itad_broker" | "other"
      category_slug: "ram_dimm" | "ram_sodimm" | "cpu" | "gpu" | "console" | "console_game" | "smartphone" | "laptop" | "pokemon_card" | "antique_tin" | "antique_silver" | "antique_other" | "electronics_other" | "unknown" | "other"
      listing_status: "draft" | "pending_review" | "approved" | "publishing" | "published" | "sold" | "expired" | "error"
      photo_type: "general" | "front" | "back" | "mark" | "detail" | "damage" | "serial" | "label" | "holo" | "barcode" | "sticker"
      platform_slug: "marktplaats" | "tweakers" | "cardmarket" | "ebay" | "catawiki" | "2dehands" | "facebook"
      product_condition: "mint" | "near_mint" | "excellent" | "very_good" | "good" | "fair" | "poor"
      product_status: "indexed" | "analyzing" | "ready_to_list" | "pending_review" | "approved" | "listed" | "sold" | "archived"
      sticker_input_method: "ocr_inline" | "ocr_separate" | "manual" | "manual_increment"
    }
    CompositeTypes: { [_ in never]: never }
  }
}

export const Constants = {
  public: {
    Enums: {
      bundle_type: ["ram_kit", "console_bundle", "card_lot", "card_set", "hardware_bundle", "custom"],
      buyback_service_slug: ["levelseven", "nedgame", "flashkaartshop", "rarecards", "catchcollect", "itad_broker", "other"],
      category_slug: ["ram_dimm", "ram_sodimm", "cpu", "gpu", "console", "console_game", "smartphone", "laptop", "pokemon_card", "antique_tin", "antique_silver", "antique_other", "electronics_other", "unknown", "other"],
      listing_status: ["draft", "pending_review", "approved", "publishing", "published", "sold", "expired", "error"],
      photo_type: ["general", "front", "back", "mark", "detail", "damage", "serial", "label", "holo", "barcode", "sticker"],
      platform_slug: ["marktplaats", "tweakers", "cardmarket", "ebay", "catawiki", "2dehands", "facebook"],
      product_condition: ["mint", "near_mint", "excellent", "very_good", "good", "fair", "poor"],
      product_status: ["indexed", "analyzing", "ready_to_list", "pending_review", "approved", "listed", "sold", "archived"],
      sticker_input_method: ["ocr_inline", "ocr_separate", "manual", "manual_increment"],
    },
  },
} as const
