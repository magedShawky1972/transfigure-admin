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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      brands: {
        Row: {
          brand_name: string
          created_at: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          brand_name: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          brand_name?: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_customer_followup: {
        Row: {
          created_at: string
          created_by: string | null
          customer_name: string | null
          customer_phone: string
          id: string
          next_action: string | null
          notes: string | null
          reminder_date: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          customer_phone: string
          id?: string
          next_action?: string | null
          notes?: string | null
          reminder_date?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          customer_phone?: string
          id?: string
          next_action?: string | null
          notes?: string | null
          reminder_date?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          block_reason: string | null
          created_at: string
          creation_date: string
          customer_name: string
          customer_phone: string
          id: string
          is_blocked: boolean
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          block_reason?: string | null
          created_at?: string
          creation_date: string
          customer_name: string
          customer_phone: string
          id?: string
          is_blocked?: boolean
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          block_reason?: string | null
          created_at?: string
          creation_date?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          is_blocked?: boolean
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      excel_column_mappings: {
        Row: {
          created_at: string
          data_type: string
          excel_column: string
          id: string
          sheet_id: string
          table_column: string
        }
        Insert: {
          created_at?: string
          data_type: string
          excel_column: string
          id?: string
          sheet_id: string
          table_column: string
        }
        Update: {
          created_at?: string
          data_type?: string
          excel_column?: string
          id?: string
          sheet_id?: string
          table_column?: string
        }
        Relationships: [
          {
            foreignKeyName: "excel_column_mappings_sheet_id_fkey"
            columns: ["sheet_id"]
            isOneToOne: false
            referencedRelation: "excel_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      excel_sheets: {
        Row: {
          created_at: string
          file_name: string
          id: string
          sheet_code: string
          sheet_name: string
          status: string | null
          target_table: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          sheet_code: string
          sheet_name: string
          status?: string | null
          target_table?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          sheet_code?: string
          sheet_name?: string
          status?: string | null
          target_table?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      generated_tables: {
        Row: {
          columns: Json
          created_at: string
          id: string
          status: string | null
          table_name: string
          updated_at: string
        }
        Insert: {
          columns: Json
          created_at?: string
          id?: string
          status?: string | null
          table_name: string
          updated_at?: string
        }
        Update: {
          columns?: Json
          created_at?: string
          id?: string
          status?: string | null
          table_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          brand_name: string | null
          created_at: string
          id: string
          product_cost: string | null
          product_id: string | null
          product_name: string
          product_price: string | null
          status: string
          updated_at: string
        }
        Insert: {
          brand_name?: string | null
          created_at?: string
          id?: string
          product_cost?: string | null
          product_id?: string | null
          product_name: string
          product_price?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          brand_name?: string | null
          created_at?: string
          id?: string
          product_cost?: string | null
          product_id?: string | null
          product_name?: string
          product_price?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          mobile_number: string | null
          must_change_password: boolean
          updated_at: string
          user_id: string
          user_name: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          mobile_number?: string | null
          must_change_password?: boolean
          updated_at?: string
          user_id: string
          user_name: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          mobile_number?: string | null
          must_change_password?: boolean
          updated_at?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      purpletransaction: {
        Row: {
          brand_name: string | null
          coins_number: number | null
          cost_price: number | null
          cost_sold: number | null
          created_at: string
          created_at_date: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          order_number: string | null
          order_status: string | null
          payment_brand: string | null
          payment_method: string | null
          payment_type: string | null
          product_id: string | null
          product_name: string | null
          profit: number | null
          qty: number | null
          total: number | null
          unit_price: number | null
          updated_at: string
          user_name: string | null
          vendor_name: string | null
        }
        Insert: {
          brand_name?: string | null
          coins_number?: number | null
          cost_price?: number | null
          cost_sold?: number | null
          created_at?: string
          created_at_date?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          order_number?: string | null
          order_status?: string | null
          payment_brand?: string | null
          payment_method?: string | null
          payment_type?: string | null
          product_id?: string | null
          product_name?: string | null
          profit?: number | null
          qty?: number | null
          total?: number | null
          unit_price?: number | null
          updated_at?: string
          user_name?: string | null
          vendor_name?: string | null
        }
        Update: {
          brand_name?: string | null
          coins_number?: number | null
          cost_price?: number | null
          cost_sold?: number | null
          created_at?: string
          created_at_date?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          order_number?: string | null
          order_status?: string | null
          payment_brand?: string | null
          payment_method?: string | null
          payment_type?: string | null
          product_id?: string | null
          product_name?: string | null
          profit?: number | null
          qty?: number | null
          total?: number | null
          unit_price?: number | null
          updated_at?: string
          user_name?: string | null
          vendor_name?: string | null
        }
        Relationships: []
      }
      query_cache: {
        Row: {
          cache_data: Json
          cache_key: string
          created_at: string
          expires_at: string
          id: string
        }
        Insert: {
          cache_data: Json
          cache_key: string
          created_at?: string
          expires_at: string
          id?: string
        }
        Update: {
          cache_data?: Json
          cache_key?: string
          created_at?: string
          expires_at?: string
          id?: string
        }
        Relationships: []
      }
      upload_logs: {
        Row: {
          created_at: string
          error_message: string | null
          excel_dates: Json | null
          file_name: string
          id: string
          new_customers_count: number | null
          records_processed: number | null
          sheet_id: string | null
          status: string
          updated_at: string
          upload_date: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          excel_dates?: Json | null
          file_name: string
          id?: string
          new_customers_count?: number | null
          records_processed?: number | null
          sheet_id?: string | null
          status?: string
          updated_at?: string
          upload_date?: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          excel_dates?: Json | null
          file_name?: string
          id?: string
          new_customers_count?: number | null
          records_processed?: number | null
          sheet_id?: string | null
          status?: string
          updated_at?: string
          upload_date?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "upload_logs_sheet_id_fkey"
            columns: ["sheet_id"]
            isOneToOne: false
            referencedRelation: "excel_sheets"
            referencedColumns: ["id"]
          },
        ]
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
      customer_totals: {
        Row: {
          block_reason: string | null
          creation_date: string | null
          customer_name: string | null
          customer_phone: string | null
          is_blocked: boolean | null
          last_trans_date: string | null
          status: string | null
          total: number | null
        }
        Relationships: []
      }
      notin_customer_incustomer: {
        Row: {
          creation_date: string | null
          customer_name: string | null
          customer_phone: string | null
        }
        Relationships: []
      }
      purpletransaction_enriched: {
        Row: {
          brand_name: string | null
          coins_number: number | null
          cost_price: number | null
          cost_price_num: number | null
          cost_sold: number | null
          cost_sold_num: number | null
          created_at: string | null
          created_at_date: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string | null
          order_number: string | null
          order_status: string | null
          payment_brand: string | null
          payment_method: string | null
          payment_type: string | null
          product_id: string | null
          product_name: string | null
          profit: number | null
          profit_num: number | null
          qty: number | null
          qty_num: number | null
          total: number | null
          total_num: number | null
          unit_price: number | null
          unit_price_num: number | null
          updated_at: string | null
          user_name: string | null
          vendor_name: string | null
        }
        Insert: {
          brand_name?: string | null
          coins_number?: number | null
          cost_price?: number | null
          cost_price_num?: number | null
          cost_sold?: number | null
          cost_sold_num?: number | null
          created_at?: string | null
          created_at_date?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string | null
          order_number?: string | null
          order_status?: string | null
          payment_brand?: string | null
          payment_method?: string | null
          payment_type?: string | null
          product_id?: string | null
          product_name?: string | null
          profit?: number | null
          profit_num?: number | null
          qty?: number | null
          qty_num?: number | null
          total?: number | null
          total_num?: number | null
          unit_price?: number | null
          unit_price_num?: number | null
          updated_at?: string | null
          user_name?: string | null
          vendor_name?: string | null
        }
        Update: {
          brand_name?: string | null
          coins_number?: number | null
          cost_price?: number | null
          cost_price_num?: number | null
          cost_sold?: number | null
          cost_sold_num?: number | null
          created_at?: string | null
          created_at_date?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string | null
          order_number?: string | null
          order_status?: string | null
          payment_brand?: string | null
          payment_method?: string | null
          payment_type?: string | null
          product_id?: string | null
          product_name?: string | null
          profit?: number | null
          profit_num?: number | null
          qty?: number | null
          qty_num?: number | null
          total?: number | null
          total_num?: number | null
          unit_price?: number | null
          unit_price_num?: number | null
          updated_at?: string | null
          user_name?: string | null
          vendor_name?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      clean_expired_cache: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      customer_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          customer_phone: string
          last_transaction: string
          total_spend: number
        }[]
      }
      customer_stats_by_phones: {
        Args: { _phones: string[] }
        Returns: {
          customer_phone: string
          last_transaction: string
          total_spend: number
        }[]
      }
      exec_sql: {
        Args: { sql: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      sales_trend: {
        Args: { date_from: string; date_to: string }
        Returns: {
          created_at_date: string
          total_sum: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
