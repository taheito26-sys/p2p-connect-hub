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
      assets: {
        Row: {
          binance_symbol: string | null
          category: string | null
          coingecko_id: string | null
          created_at: string | null
          id: string
          name: string
          precision_price: number | null
          precision_qty: number | null
          symbol: string
        }
        Insert: {
          binance_symbol?: string | null
          category?: string | null
          coingecko_id?: string | null
          created_at?: string | null
          id?: string
          name: string
          precision_price?: number | null
          precision_qty?: number | null
          symbol: string
        }
        Update: {
          binance_symbol?: string | null
          category?: string | null
          coingecko_id?: string | null
          created_at?: string | null
          id?: string
          name?: string
          precision_price?: number | null
          precision_qty?: number | null
          symbol?: string
        }
        Relationships: []
      }
      imported_files: {
        Row: {
          exchange: string
          export_type: string
          file_hash: string
          file_name: string
          id: string
          imported_at: string | null
          row_count: number | null
          user_id: string
        }
        Insert: {
          exchange: string
          export_type: string
          file_hash: string
          file_name: string
          id?: string
          imported_at?: string | null
          row_count?: number | null
          user_id: string
        }
        Update: {
          exchange?: string
          export_type?: string
          file_hash?: string
          file_name?: string
          id?: string
          imported_at?: string | null
          row_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      price_cache: {
        Row: {
          asset_id: string
          market_cap: number | null
          price: number
          price_change_1h: number | null
          price_change_24h: number | null
          price_change_7d: number | null
          source: string | null
          timestamp: string | null
          volume_24h: number | null
        }
        Insert: {
          asset_id: string
          market_cap?: number | null
          price: number
          price_change_1h?: number | null
          price_change_24h?: number | null
          price_change_7d?: number | null
          source?: string | null
          timestamp?: string | null
          volume_24h?: number | null
        }
        Update: {
          asset_id?: string
          market_cap?: number | null
          price?: number
          price_change_1h?: number | null
          price_change_24h?: number | null
          price_change_7d?: number | null
          source?: string | null
          timestamp?: string | null
          volume_24h?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "price_cache_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_preferences: {
        Row: {
          asset_id: string | null
          id: string
          tracking_mode: string
          user_id: string
        }
        Insert: {
          asset_id?: string | null
          id?: string
          tracking_mode?: string
          user_id: string
        }
        Update: {
          asset_id?: string | null
          id?: string
          tracking_mode?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_preferences_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          asset_id: string
          created_at: string | null
          external_id: string | null
          fee_amount: number
          fee_currency: string | null
          id: string
          note: string | null
          qty: number
          source: string | null
          tags: string[] | null
          timestamp: string
          type: string
          unit_price: number
          updated_at: string | null
          user_id: string
          venue: string | null
        }
        Insert: {
          asset_id: string
          created_at?: string | null
          external_id?: string | null
          fee_amount?: number
          fee_currency?: string | null
          id?: string
          note?: string | null
          qty: number
          source?: string | null
          tags?: string[] | null
          timestamp: string
          type: string
          unit_price?: number
          updated_at?: string | null
          user_id: string
          venue?: string | null
        }
        Update: {
          asset_id?: string
          created_at?: string | null
          external_id?: string | null
          fee_amount?: number
          fee_currency?: string | null
          id?: string
          note?: string | null
          qty?: number
          source?: string | null
          tags?: string[] | null
          timestamp?: string
          type?: string
          unit_price?: number
          updated_at?: string | null
          user_id?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
