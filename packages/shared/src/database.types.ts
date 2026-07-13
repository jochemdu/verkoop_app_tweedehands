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
          user_id: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string | null
          user_id?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string | null
          user_id?: string
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
          {
            foreignKeyName: "bundle_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "buyback_quotes_buyback_service_id_fkey"
            columns: ["buyback_service_id"]
            isOneToOne: false
            referencedRelation: "buyback_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyback_quotes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
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
          parent_slug: string | null
          preferred_buyback_services:
            | Database["public"]["Enums"]["buyback_service_slug"][]
            | null
          preferred_platforms:
            | Database["public"]["Enums"]["platform_slug"][]
            | null
          slug: string
          spec_schema: Json | null
        }
        Insert: {
          id?: string
          name: string
          parent_slug?: string | null
          preferred_buyback_services?:
            | Database["public"]["Enums"]["buyback_service_slug"][]
            | null
          preferred_platforms?:
            | Database["public"]["Enums"]["platform_slug"][]
            | null
          slug: string
          spec_schema?: Json | null
        }
        Update: {
          id?: string
          name?: string
          parent_slug?: string | null
          preferred_buyback_services?:
            | Database["public"]["Enums"]["buyback_service_slug"][]
            | null
          preferred_platforms?:
            | Database["public"]["Enums"]["platform_slug"][]
            | null
          slug?: string
          spec_schema?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_slug_fkey"
            columns: ["parent_slug"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["slug"]
          },
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
      containers: {
        Row: {
          created_at: string | null
          id: string
          label: string
          last_visited_at: string | null
          location_text: string | null
          qr_code: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          label: string
          last_visited_at?: string | null
          location_text?: string | null
          qr_code?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          label?: string
          last_visited_at?: string | null
          location_text?: string | null
          qr_code?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ean_cache: {
        Row: {
          brand: string | null
          cached_at: string | null
          category: string | null
          ean: string
          expires_at: string | null
          image_url: string | null
          product_name: string | null
          raw_response: Json | null
          source: string | null
        }
        Insert: {
          brand?: string | null
          cached_at?: string | null
          category?: string | null
          ean: string
          expires_at?: string | null
          image_url?: string | null
          product_name?: string | null
          raw_response?: Json | null
          source?: string | null
        }
        Update: {
          brand?: string | null
          cached_at?: string | null
          category?: string | null
          ean?: string
          expires_at?: string | null
          image_url?: string | null
          product_name?: string | null
          raw_response?: Json | null
          source?: string | null
        }
        Relationships: []
      }
      house_scans: {
        Row: {
          container_id: string | null
          created_at: string | null
          detected_objects: Json | null
          frame_count: number | null
          id: string
          processed_at: string | null
          user_id: string
          video_storage_path: string
        }
        Insert: {
          container_id?: string | null
          created_at?: string | null
          detected_objects?: Json | null
          frame_count?: number | null
          id?: string
          processed_at?: string | null
          user_id: string
          video_storage_path: string
        }
        Update: {
          container_id?: string | null
          created_at?: string | null
          detected_objects?: Json | null
          frame_count?: number | null
          id?: string
          processed_at?: string | null
          user_id?: string
          video_storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "house_scans_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
        ]
      }
      import_candidates: {
        Row: {
          asset_id: string
          confidence: number | null
          created_at: string | null
          detected_object: string | null
          dismissed: boolean | null
          id: string
          imported: boolean | null
          matches_product_id: string | null
          taken_at: string | null
          thumbnail_uri: string | null
          user_id: string
        }
        Insert: {
          asset_id: string
          confidence?: number | null
          created_at?: string | null
          detected_object?: string | null
          dismissed?: boolean | null
          id?: string
          imported?: boolean | null
          matches_product_id?: string | null
          taken_at?: string | null
          thumbnail_uri?: string | null
          user_id: string
        }
        Update: {
          asset_id?: string
          confidence?: number | null
          created_at?: string | null
          detected_object?: string | null
          dismissed?: boolean | null
          id?: string
          imported?: boolean | null
          matches_product_id?: string | null
          taken_at?: string | null
          thumbnail_uri?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_candidates_matches_product_id_fkey"
            columns: ["matches_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "listings_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      market_comparables: {
        Row: {
          brand: string | null
          color: string | null
          condition: string | null
          created_at: string
          currency: string
          description_snippet: string | null
          id: string
          is_sold: boolean | null
          model: string | null
          notes: string | null
          price: number | null
          product_id: string
          source: string
          title: string
          url: string | null
          user_id: string
        }
        Insert: {
          brand?: string | null
          color?: string | null
          condition?: string | null
          created_at?: string
          currency?: string
          description_snippet?: string | null
          id?: string
          is_sold?: boolean | null
          model?: string | null
          notes?: string | null
          price?: number | null
          product_id: string
          source: string
          title: string
          url?: string | null
          user_id?: string
        }
        Update: {
          brand?: string | null
          color?: string | null
          condition?: string | null
          created_at?: string
          currency?: string
          description_snippet?: string | null
          id?: string
          is_sold?: boolean | null
          model?: string | null
          notes?: string | null
          price?: number | null
          product_id?: string
          source?: string
          title?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_comparables_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      market_trends: {
        Row: {
          category: string
          expires_at: string | null
          fetched_at: string | null
          id: string
          platform: Database["public"]["Enums"]["platform_slug"]
          sample_size: number | null
          trend_data: Json
        }
        Insert: {
          category: string
          expires_at?: string | null
          fetched_at?: string | null
          id?: string
          platform: Database["public"]["Enums"]["platform_slug"]
          sample_size?: number | null
          trend_data: Json
        }
        Update: {
          category?: string
          expires_at?: string | null
          fetched_at?: string | null
          id?: string
          platform?: Database["public"]["Enums"]["platform_slug"]
          sample_size?: number | null
          trend_data?: Json
        }
        Relationships: []
      }
      oauth_clients: {
        Row: {
          client_id: string
          client_name: string | null
          created_at: string
          redirect_uris: string[]
        }
        Insert: {
          client_id: string
          client_name?: string | null
          created_at?: string
          redirect_uris: string[]
        }
        Update: {
          client_id?: string
          client_name?: string | null
          created_at?: string
          redirect_uris?: string[]
        }
        Relationships: []
      }
      oauth_authorization_codes: {
        Row: {
          client_id: string
          code_challenge: string
          code_challenge_method: string
          code_hash: string
          created_at: string
          expires_at: string
          redirect_uri: string
          scope: string | null
          user_id: string
        }
        Insert: {
          client_id: string
          code_challenge: string
          code_challenge_method?: string
          code_hash: string
          created_at?: string
          expires_at: string
          redirect_uri: string
          scope?: string | null
          user_id: string
        }
        Update: {
          client_id?: string
          code_challenge?: string
          code_challenge_method?: string
          code_hash?: string
          created_at?: string
          expires_at?: string
          redirect_uri?: string
          scope?: string | null
          user_id?: string
        }
        Relationships: []
      }
      oauth_access_tokens: {
        Row: {
          client_id: string
          created_at: string
          expires_at: string
          refresh_expires_at: string | null
          refresh_token_hash: string | null
          scope: string | null
          token_hash: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          expires_at: string
          refresh_expires_at?: string | null
          refresh_token_hash?: string | null
          scope?: string | null
          token_hash: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          expires_at?: string
          refresh_expires_at?: string | null
          refresh_token_hash?: string | null
          scope?: string | null
          token_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      photos: {
        Row: {
          capture_mode: string | null
          created_at: string | null
          cropped_from_photo_id: string | null
          deleted_at: string | null
          detected_sticker: string | null
          height: number | null
          id: string
          ocr_confidence: number | null
          order_index: number | null
          phash: number | null
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
          cropped_from_photo_id?: string | null
          deleted_at?: string | null
          detected_sticker?: string | null
          height?: number | null
          id?: string
          ocr_confidence?: number | null
          order_index?: number | null
          phash?: number | null
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
          cropped_from_photo_id?: string | null
          deleted_at?: string | null
          detected_sticker?: string | null
          height?: number | null
          id?: string
          ocr_confidence?: number | null
          order_index?: number | null
          phash?: number | null
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
          {
            foreignKeyName: "photos_cropped_from_photo_id_fkey"
            columns: ["cropped_from_photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "price_history_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      price_watches: {
        Row: {
          alert_on_below: number | null
          category_slug: string | null
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
          category_slug?: string | null
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
          category_slug?: string | null
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
          {
            foreignKeyName: "price_watches_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          analyzed_at: string | null
          barcode_type: string | null
          category_slug: string | null
          condition: Database["public"]["Enums"]["product_condition"] | null
          container_id: string | null
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
          photo_advice: string[] | null
          provenance_notes: string | null
          recommended_price: number | null
          selling_tier: string | null
          sold_at: string | null
          sold_platform_id: string | null
          sold_price: number | null
          source_photo_id: string | null
          specs: Json | null
          status: Database["public"]["Enums"]["product_status"] | null
          sticker_confidence: number | null
          sticker_id: string | null
          sticker_input_method:
            | Database["public"]["Enums"]["sticker_input_method"]
            | null
          title: string | null
          updated_at: string | null
          user_id: string | null
          working_title: string | null
        }
        Insert: {
          analyzed_at?: string | null
          barcode_type?: string | null
          category_slug?: string | null
          condition?: Database["public"]["Enums"]["product_condition"] | null
          container_id?: string | null
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
          photo_advice?: string[] | null
          provenance_notes?: string | null
          recommended_price?: number | null
          selling_tier?: string | null
          sold_at?: string | null
          sold_platform_id?: string | null
          sold_price?: number | null
          source_photo_id?: string | null
          specs?: Json | null
          status?: Database["public"]["Enums"]["product_status"] | null
          sticker_confidence?: number | null
          sticker_id?: string | null
          sticker_input_method?:
            | Database["public"]["Enums"]["sticker_input_method"]
            | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          working_title?: string | null
        }
        Update: {
          analyzed_at?: string | null
          barcode_type?: string | null
          category_slug?: string | null
          condition?: Database["public"]["Enums"]["product_condition"] | null
          container_id?: string | null
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
          photo_advice?: string[] | null
          provenance_notes?: string | null
          recommended_price?: number | null
          selling_tier?: string | null
          sold_at?: string | null
          sold_platform_id?: string | null
          sold_price?: number | null
          source_photo_id?: string | null
          specs?: Json | null
          status?: Database["public"]["Enums"]["product_status"] | null
          sticker_confidence?: number | null
          sticker_id?: string | null
          sticker_input_method?:
            | Database["public"]["Enums"]["sticker_input_method"]
            | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          working_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "products_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_sold_platform_id_fkey"
            columns: ["sold_platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_source_photo_id_fkey"
            columns: ["source_photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          display_language: string
          display_name: string | null
          household: Json
          id: string
          listing_language: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_language?: string
          display_name?: string | null
          household?: Json
          id: string
          listing_language?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_language?: string
          display_name?: string | null
          household?: Json
          id?: string
          listing_language?: string
          updated_at?: string | null
        }
        Relationships: []
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
          {
            foreignKeyName: "taxatie_exports_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taxatie_exports_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      dashboard_stats: {
        Row: {
          approved_count: number | null
          archived_count: number | null
          indexed_count: number | null
          listed_count: number | null
          pending_count: number | null
          ready_count: number | null
          refreshed_at: string | null
          sold_count: number | null
          total_est_value: number | null
          total_products: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_dashboard_stats: {
        Args: never
        Returns: {
          total_products: number
          indexed_count: number
          ready_count: number
          listed_count: number
          sold_count: number
          pending_count: number
          approved_count: number
          archived_count: number
          total_est_value: number
          refreshed_at: string
        }[]
      }
      find_similar_photos: {
        Args: {
          p_exclude_photo_id?: string
          p_max_distance?: number
          p_phash: number
          p_user_id: string
        }
        Returns: {
          distance: number
          photo_id: string
          product_id: string
          storage_path: string
        }[]
      }
      hamming_distance_bigint: {
        Args: { a: number; b: number }
        Returns: number
      }
      list_inventory_with_counts: {
        Args: {
          p_category?: string
          p_limit?: number
          p_status?: string
          p_sticker_from?: string
          p_sticker_to?: string
          p_user_id: string
        }
        Returns: {
          category_slug: string
          id: string
          indexed_at: string
          photo_count: number
          status: string
          sticker_id: string
          title: string
          working_title: string
        }[]
      }
      refresh_dashboard_stats: { Args: never; Returns: undefined }
      reserve_next_sticker: {
        Args: { p_count: number; p_user_id: string }
        Returns: string[]
      }
    }
    Enums: {
      bundle_type:
        | "ram_kit"
        | "console_bundle"
        | "card_lot"
        | "card_set"
        | "hardware_bundle"
        | "custom"
      buyback_service_slug:
        | "levelseven"
        | "nedgame"
        | "flashkaartshop"
        | "rarecards"
        | "catchcollect"
        | "itad_broker"
        | "other"
      listing_status:
        | "draft"
        | "pending_review"
        | "approved"
        | "publishing"
        | "published"
        | "sold"
        | "expired"
        | "error"
      photo_type:
        | "general"
        | "front"
        | "back"
        | "mark"
        | "detail"
        | "damage"
        | "serial"
        | "label"
        | "holo"
        | "barcode"
        | "sticker"
      platform_slug:
        | "marktplaats"
        | "tweakers"
        | "cardmarket"
        | "ebay"
        | "catawiki"
        | "2dehands"
        | "facebook"
      product_condition:
        | "mint"
        | "near_mint"
        | "excellent"
        | "very_good"
        | "good"
        | "fair"
        | "poor"
      product_status:
        | "indexed"
        | "analyzing"
        | "ready_to_list"
        | "pending_review"
        | "approved"
        | "listed"
        | "sold"
        | "archived"
      sticker_input_method:
        | "ocr_inline"
        | "ocr_separate"
        | "manual"
        | "manual_increment"
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
      bundle_type: [
        "ram_kit",
        "console_bundle",
        "card_lot",
        "card_set",
        "hardware_bundle",
        "custom",
      ],
      buyback_service_slug: [
        "levelseven",
        "nedgame",
        "flashkaartshop",
        "rarecards",
        "catchcollect",
        "itad_broker",
        "other",
      ],
      listing_status: [
        "draft",
        "pending_review",
        "approved",
        "publishing",
        "published",
        "sold",
        "expired",
        "error",
      ],
      photo_type: [
        "general",
        "front",
        "back",
        "mark",
        "detail",
        "damage",
        "serial",
        "label",
        "holo",
        "barcode",
        "sticker",
      ],
      platform_slug: [
        "marktplaats",
        "tweakers",
        "cardmarket",
        "ebay",
        "catawiki",
        "2dehands",
        "facebook",
      ],
      product_condition: [
        "mint",
        "near_mint",
        "excellent",
        "very_good",
        "good",
        "fair",
        "poor",
      ],
      product_status: [
        "indexed",
        "analyzing",
        "ready_to_list",
        "pending_review",
        "approved",
        "listed",
        "sold",
        "archived",
      ],
      sticker_input_method: [
        "ocr_inline",
        "ocr_separate",
        "manual",
        "manual_increment",
      ],
    },
  },
} as const
