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
      api_field_configs: {
        Row: {
          api_endpoint: string
          created_at: string | null
          field_name: string
          field_note: string | null
          field_order: number
          field_type: string
          id: string
          is_required: boolean
          updated_at: string | null
        }
        Insert: {
          api_endpoint: string
          created_at?: string | null
          field_name: string
          field_note?: string | null
          field_order?: number
          field_type: string
          id?: string
          is_required?: boolean
          updated_at?: string | null
        }
        Update: {
          api_endpoint?: string
          created_at?: string | null
          field_name?: string
          field_note?: string | null
          field_order?: number
          field_type?: string
          id?: string
          is_required?: boolean
          updated_at?: string | null
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          allow_brand: boolean
          allow_customer: boolean
          allow_payment: boolean
          allow_product: boolean
          allow_sales_header: boolean
          allow_sales_line: boolean
          allow_supplier: boolean
          allow_supplier_product: boolean
          api_key: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          allow_brand?: boolean
          allow_customer?: boolean
          allow_payment?: boolean
          allow_product?: boolean
          allow_sales_header?: boolean
          allow_sales_line?: boolean
          allow_supplier?: boolean
          allow_supplier_product?: boolean
          api_key: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          allow_brand?: boolean
          allow_customer?: boolean
          allow_payment?: boolean
          allow_product?: boolean
          allow_sales_header?: boolean
          allow_sales_line?: boolean
          allow_supplier?: boolean
          allow_supplier_product?: boolean
          api_key?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      brand_closing_training: {
        Row: {
          brand_id: string
          created_at: string
          created_by: string | null
          device_type: string | null
          display_mode: string | null
          expected_number: number | null
          id: string
          image_path: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          created_by?: string | null
          device_type?: string | null
          display_mode?: string | null
          expected_number?: number | null
          id?: string
          image_path: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          created_by?: string | null
          device_type?: string | null
          display_mode?: string | null
          expected_number?: number | null
          id?: string
          image_path?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_closing_training_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_type: {
        Row: {
          created_at: string
          id: string
          status: string
          type_code: string
          type_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          type_code: string
          type_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          type_code?: string
          type_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      brands: {
        Row: {
          abc_analysis: string | null
          average_consumption_per_day: number | null
          average_consumption_per_month: number | null
          brand_code: string | null
          brand_name: string
          brand_type_id: string | null
          created_at: string
          id: string
          leadtime: number | null
          odoo_category_id: number | null
          recharge_usd_value: number | null
          reorder_point: number | null
          safety_stock: number | null
          short_name: string | null
          status: string
          updated_at: string
          usd_value_for_coins: number | null
        }
        Insert: {
          abc_analysis?: string | null
          average_consumption_per_day?: number | null
          average_consumption_per_month?: number | null
          brand_code?: string | null
          brand_name: string
          brand_type_id?: string | null
          created_at?: string
          id?: string
          leadtime?: number | null
          odoo_category_id?: number | null
          recharge_usd_value?: number | null
          reorder_point?: number | null
          safety_stock?: number | null
          short_name?: string | null
          status?: string
          updated_at?: string
          usd_value_for_coins?: number | null
        }
        Update: {
          abc_analysis?: string | null
          average_consumption_per_day?: number | null
          average_consumption_per_month?: number | null
          brand_code?: string | null
          brand_name?: string
          brand_type_id?: string | null
          created_at?: string
          id?: string
          leadtime?: number | null
          odoo_category_id?: number | null
          recharge_usd_value?: number | null
          reorder_point?: number | null
          safety_stock?: number | null
          short_name?: string | null
          status?: string
          updated_at?: string
          usd_value_for_coins?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "brands_brand_type_id_fkey"
            columns: ["brand_type_id"]
            isOneToOne: false
            referencedRelation: "brand_type"
            referencedColumns: ["id"]
          },
        ]
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
      currencies: {
        Row: {
          created_at: string
          currency_code: string
          currency_name: string
          currency_name_ar: string | null
          id: string
          is_active: boolean
          is_base: boolean
          symbol: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency_code: string
          currency_name: string
          currency_name_ar?: string | null
          id?: string
          is_active?: boolean
          is_base?: boolean
          symbol?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency_code?: string
          currency_name?: string
          currency_name_ar?: string | null
          id?: string
          is_active?: boolean
          is_base?: boolean
          symbol?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      currency_rates: {
        Row: {
          created_at: string
          currency_id: string
          effective_date: string
          id: string
          rate_to_base: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency_id: string
          effective_date?: string
          id?: string
          rate_to_base?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency_id?: string
          effective_date?: string
          id?: string
          rate_to_base?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "currency_rates_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          block_reason: string | null
          created_at: string
          creation_date: string
          customer_name: string
          customer_phone: string
          email: string | null
          id: string
          is_blocked: boolean
          partner_id: number | null
          partner_profile_id: number | null
          res_partner_id: number | null
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
          email?: string | null
          id?: string
          is_blocked?: boolean
          partner_id?: number | null
          partner_profile_id?: number | null
          res_partner_id?: number | null
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
          email?: string | null
          id?: string
          is_blocked?: boolean
          partner_id?: number | null
          partner_profile_id?: number | null
          res_partner_id?: number | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      department_admins: {
        Row: {
          admin_order: number
          created_at: string
          department_id: string
          id: string
          is_purchase_admin: boolean
          user_id: string
        }
        Insert: {
          admin_order?: number
          created_at?: string
          department_id: string
          id?: string
          is_purchase_admin?: boolean
          user_id: string
        }
        Update: {
          admin_order?: number
          created_at?: string
          department_id?: string
          id?: string
          is_purchase_admin?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_admins_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      department_members: {
        Row: {
          created_at: string
          department_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_members_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          department_code: string
          department_name: string
          description: string | null
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_code: string
          department_name: string
          description?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_code?: string
          department_name?: string
          description?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
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
      job_positions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          position_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          position_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          position_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      ludo_training: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          image_path: string
          notes: string | null
          product_sku: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          image_path: string
          notes?: string | null
          product_sku: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          image_path?: string
          notes?: string | null
          product_sku?: string
          updated_at?: string
        }
        Relationships: []
      }
      ludo_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          image_path: string | null
          order_number: string
          player_id: string | null
          product_sku: string
          shift_session_id: string
          transaction_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          image_path?: string | null
          order_number: string
          player_id?: string | null
          product_sku: string
          shift_session_id: string
          transaction_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          image_path?: string | null
          order_number?: string
          player_id?: string | null
          product_sku?: string
          shift_session_id?: string
          transaction_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ludo_transactions_shift_session_id_fkey"
            columns: ["shift_session_id"]
            isOneToOne: false
            referencedRelation: "shift_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          parent_notification_id: string | null
          sender_id: string | null
          sender_name: string | null
          ticket_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          parent_notification_id?: string | null
          sender_id?: string | null
          sender_name?: string | null
          ticket_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          parent_notification_id?: string | null
          sender_id?: string | null
          sender_name?: string | null
          ticket_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_parent_notification_id_fkey"
            columns: ["parent_notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      odoo_api_config: {
        Row: {
          api_key: string
          brand_api_url: string | null
          created_at: string
          customer_api_url: string
          id: string
          is_active: boolean
          product_api_url: string | null
          updated_at: string
        }
        Insert: {
          api_key: string
          brand_api_url?: string | null
          created_at?: string
          customer_api_url: string
          id?: string
          is_active?: boolean
          product_api_url?: string | null
          updated_at?: string
        }
        Update: {
          api_key?: string
          brand_api_url?: string | null
          created_at?: string
          customer_api_url?: string
          id?: string
          is_active?: boolean
          product_api_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ordertotals: {
        Row: {
          bank_fee: number | null
          created_at: string
          id: string
          order_date: string | null
          order_number: string
          payment_brand: string | null
          payment_method: string | null
          payment_type: string | null
          total: number | null
          updated_at: string
        }
        Insert: {
          bank_fee?: number | null
          created_at?: string
          id?: string
          order_date?: string | null
          order_number: string
          payment_brand?: string | null
          payment_method?: string | null
          payment_type?: string | null
          total?: number | null
          updated_at?: string
        }
        Update: {
          bank_fee?: number | null
          created_at?: string
          id?: string
          order_date?: string | null
          order_number?: string
          payment_brand?: string | null
          payment_method?: string | null
          payment_type?: string | null
          total?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          created_at: string
          fixed_value: number
          gateway_fee: number
          id: string
          is_active: boolean
          payment_method: string
          payment_type: string | null
          updated_at: string
          vat_fee: number
        }
        Insert: {
          created_at?: string
          fixed_value?: number
          gateway_fee?: number
          id?: string
          is_active?: boolean
          payment_method: string
          payment_type?: string | null
          updated_at?: string
          vat_fee?: number
        }
        Update: {
          created_at?: string
          fixed_value?: number
          gateway_fee?: number
          id?: string
          is_active?: boolean
          payment_method?: string
          payment_type?: string | null
          updated_at?: string
          vat_fee?: number
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          bank_transaction_id: string | null
          created_at: string
          id: string
          order_number: string
          payment_amount: number | null
          payment_brand: string | null
          payment_card_number: string | null
          payment_location: string | null
          payment_method: string | null
          payment_reference: string | null
          redemption_ip: string | null
          updated_at: string
        }
        Insert: {
          bank_transaction_id?: string | null
          created_at?: string
          id?: string
          order_number: string
          payment_amount?: number | null
          payment_brand?: string | null
          payment_card_number?: string | null
          payment_location?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          redemption_ip?: string | null
          updated_at?: string
        }
        Update: {
          bank_transaction_id?: string | null
          created_at?: string
          id?: string
          order_number?: string
          payment_amount?: number | null
          payment_brand?: string | null
          payment_card_number?: string | null
          payment_location?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          redemption_ip?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          abc_analysis: string | null
          barcode: string | null
          brand_code: string | null
          brand_name: string | null
          brand_type: string | null
          category: string | null
          coins_number: number | null
          created_at: string
          customer_group_prices: Json | null
          description: string | null
          discounts: Json | null
          free_coins: Json | null
          id: string
          leadtime: number | null
          max_coins: number | null
          maximum_order_quantity: number | null
          meta_description_ar: string | null
          meta_description_en: string | null
          meta_keywords_ar: string | null
          meta_keywords_en: string | null
          meta_title_ar: string | null
          meta_title_en: string | null
          min_coins: number | null
          minimum_order_quantity: number | null
          mobile_enabled: boolean | null
          notes: string | null
          odoo_product_id: number | null
          odoo_sync_status: string | null
          odoo_synced_at: string | null
          options: Json | null
          product_cost: string | null
          product_id: string | null
          product_name: string
          product_price: string | null
          reorder_point: number | null
          safety_stock: number | null
          sku: string | null
          status: string
          stock_quantity: number | null
          supplier: string | null
          tax_type: string | null
          updated_at: string
          weight: number | null
        }
        Insert: {
          abc_analysis?: string | null
          barcode?: string | null
          brand_code?: string | null
          brand_name?: string | null
          brand_type?: string | null
          category?: string | null
          coins_number?: number | null
          created_at?: string
          customer_group_prices?: Json | null
          description?: string | null
          discounts?: Json | null
          free_coins?: Json | null
          id?: string
          leadtime?: number | null
          max_coins?: number | null
          maximum_order_quantity?: number | null
          meta_description_ar?: string | null
          meta_description_en?: string | null
          meta_keywords_ar?: string | null
          meta_keywords_en?: string | null
          meta_title_ar?: string | null
          meta_title_en?: string | null
          min_coins?: number | null
          minimum_order_quantity?: number | null
          mobile_enabled?: boolean | null
          notes?: string | null
          odoo_product_id?: number | null
          odoo_sync_status?: string | null
          odoo_synced_at?: string | null
          options?: Json | null
          product_cost?: string | null
          product_id?: string | null
          product_name: string
          product_price?: string | null
          reorder_point?: number | null
          safety_stock?: number | null
          sku?: string | null
          status?: string
          stock_quantity?: number | null
          supplier?: string | null
          tax_type?: string | null
          updated_at?: string
          weight?: number | null
        }
        Update: {
          abc_analysis?: string | null
          barcode?: string | null
          brand_code?: string | null
          brand_name?: string | null
          brand_type?: string | null
          category?: string | null
          coins_number?: number | null
          created_at?: string
          customer_group_prices?: Json | null
          description?: string | null
          discounts?: Json | null
          free_coins?: Json | null
          id?: string
          leadtime?: number | null
          max_coins?: number | null
          maximum_order_quantity?: number | null
          meta_description_ar?: string | null
          meta_description_en?: string | null
          meta_keywords_ar?: string | null
          meta_keywords_en?: string | null
          meta_title_ar?: string | null
          meta_title_en?: string | null
          min_coins?: number | null
          minimum_order_quantity?: number | null
          mobile_enabled?: boolean | null
          notes?: string | null
          odoo_product_id?: number | null
          odoo_sync_status?: string | null
          odoo_synced_at?: string | null
          options?: Json | null
          product_cost?: string | null
          product_id?: string | null
          product_name?: string
          product_price?: string | null
          reorder_point?: number | null
          safety_stock?: number | null
          sku?: string | null
          status?: string
          stock_quantity?: number | null
          supplier?: string | null
          tax_type?: string | null
          updated_at?: string
          weight?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          job_position_id: string | null
          mobile_number: string | null
          must_change_password: boolean
          transaction_column_order: Json | null
          transaction_column_visibility: Json | null
          transaction_group_by: Json | null
          updated_at: string
          user_id: string
          user_name: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          job_position_id?: string | null
          mobile_number?: string | null
          must_change_password?: boolean
          transaction_column_order?: Json | null
          transaction_column_visibility?: Json | null
          transaction_group_by?: Json | null
          updated_at?: string
          user_id: string
          user_name: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          job_position_id?: string | null
          mobile_number?: string | null
          must_change_password?: boolean
          transaction_column_order?: Json | null
          transaction_column_visibility?: Json | null
          transaction_group_by?: Json | null
          updated_at?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_job_position_id_fkey"
            columns: ["job_position_id"]
            isOneToOne: false
            referencedRelation: "job_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      purpletransaction: {
        Row: {
          bank_fee: number | null
          brand_code: string | null
          brand_name: string | null
          coins_number: number | null
          cost_price: number | null
          cost_sold: number | null
          created_at: string
          created_at_date: string | null
          created_at_date_int: number | null
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
          trans_type: string | null
          unit_price: number | null
          updated_at: string
          user_name: string | null
          vendor_name: string | null
        }
        Insert: {
          bank_fee?: number | null
          brand_code?: string | null
          brand_name?: string | null
          coins_number?: number | null
          cost_price?: number | null
          cost_sold?: number | null
          created_at?: string
          created_at_date?: string | null
          created_at_date_int?: number | null
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
          trans_type?: string | null
          unit_price?: number | null
          updated_at?: string
          user_name?: string | null
          vendor_name?: string | null
        }
        Update: {
          bank_fee?: number | null
          brand_code?: string | null
          brand_name?: string | null
          coins_number?: number | null
          cost_price?: number | null
          cost_sold?: number | null
          created_at?: string
          created_at_date?: string | null
          created_at_date_int?: number | null
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
          trans_type?: string | null
          unit_price?: number | null
          updated_at?: string
          user_name?: string | null
          vendor_name?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
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
      sales_order_header: {
        Row: {
          company: string | null
          created_at: string
          customer_ip: string | null
          customer_phone: string
          device_fingerprint: string | null
          id: string
          media: string | null
          order_date: string
          order_number: string
          payment_term: string | null
          profit_center: string | null
          register_user_id: string | null
          sales_person: string | null
          status: number | null
          status_description: string | null
          transaction_location: string | null
          transaction_type: string | null
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          customer_ip?: string | null
          customer_phone: string
          device_fingerprint?: string | null
          id?: string
          media?: string | null
          order_date: string
          order_number: string
          payment_term?: string | null
          profit_center?: string | null
          register_user_id?: string | null
          sales_person?: string | null
          status?: number | null
          status_description?: string | null
          transaction_location?: string | null
          transaction_type?: string | null
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          customer_ip?: string | null
          customer_phone?: string
          device_fingerprint?: string | null
          id?: string
          media?: string | null
          order_date?: string
          order_number?: string
          payment_term?: string | null
          profit_center?: string | null
          register_user_id?: string | null
          sales_person?: string | null
          status?: number | null
          status_description?: string | null
          transaction_location?: string | null
          transaction_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sales_order_line: {
        Row: {
          coins_number: number | null
          cost_price: number | null
          created_at: string
          id: string
          line_number: number
          line_status: number
          order_number: string
          point: number | null
          product_id: number | null
          product_sku: string | null
          quantity: number | null
          total: number | null
          total_cost: number | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          coins_number?: number | null
          cost_price?: number | null
          created_at?: string
          id?: string
          line_number: number
          line_status?: number
          order_number: string
          point?: number | null
          product_id?: number | null
          product_sku?: string | null
          quantity?: number | null
          total?: number | null
          total_cost?: number | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          coins_number?: number | null
          cost_price?: number | null
          created_at?: string
          id?: string
          line_number?: number
          line_status?: number
          order_number?: string
          point?: number | null
          product_id?: number | null
          product_sku?: string | null
          quantity?: number | null
          total?: number | null
          total_cost?: number | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      shift_admins: {
        Row: {
          admin_order: number
          created_at: string
          id: string
          shift_id: string
          user_id: string
        }
        Insert: {
          admin_order?: number
          created_at?: string
          id?: string
          shift_id: string
          user_id: string
        }
        Update: {
          admin_order?: number
          created_at?: string
          id?: string
          shift_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_admins_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_assignments: {
        Row: {
          assignment_date: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          shift_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assignment_date: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          shift_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assignment_date?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          shift_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_assignments_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_brand_balances: {
        Row: {
          brand_id: string
          closing_balance: number
          created_at: string
          id: string
          receipt_image_path: string | null
          shift_session_id: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          closing_balance?: number
          created_at?: string
          id?: string
          receipt_image_path?: string | null
          shift_session_id: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          closing_balance?: number
          created_at?: string
          id?: string
          receipt_image_path?: string | null
          shift_session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_brand_balances_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_brand_balances_shift_session_id_fkey"
            columns: ["shift_session_id"]
            isOneToOne: false
            referencedRelation: "shift_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_hard_close_logs: {
        Row: {
          admin_user_id: string
          admin_user_name: string
          closed_at: string
          created_at: string
          id: string
          shift_assignment_id: string
          shift_date: string
          shift_name: string
          shift_session_id: string
        }
        Insert: {
          admin_user_id: string
          admin_user_name: string
          closed_at?: string
          created_at?: string
          id?: string
          shift_assignment_id: string
          shift_date: string
          shift_name: string
          shift_session_id: string
        }
        Update: {
          admin_user_id?: string
          admin_user_name?: string
          closed_at?: string
          created_at?: string
          id?: string
          shift_assignment_id?: string
          shift_date?: string
          shift_name?: string
          shift_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_hard_close_logs_shift_assignment_id_fkey"
            columns: ["shift_assignment_id"]
            isOneToOne: false
            referencedRelation: "shift_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_hard_close_logs_shift_session_id_fkey"
            columns: ["shift_session_id"]
            isOneToOne: false
            referencedRelation: "shift_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_job_positions: {
        Row: {
          created_at: string
          id: string
          job_position_id: string
          shift_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_position_id: string
          shift_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_position_id?: string
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_job_positions_job_position_id_fkey"
            columns: ["job_position_id"]
            isOneToOne: false
            referencedRelation: "job_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_job_positions_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_reopen_logs: {
        Row: {
          admin_user_id: string
          admin_user_name: string
          created_at: string
          id: string
          reopened_at: string
          shift_assignment_id: string
          shift_date: string
          shift_name: string
          shift_session_id: string
        }
        Insert: {
          admin_user_id: string
          admin_user_name: string
          created_at?: string
          id?: string
          reopened_at?: string
          shift_assignment_id: string
          shift_date: string
          shift_name: string
          shift_session_id: string
        }
        Update: {
          admin_user_id?: string
          admin_user_name?: string
          created_at?: string
          id?: string
          reopened_at?: string
          shift_assignment_id?: string
          shift_date?: string
          shift_name?: string
          shift_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_reopen_logs_shift_assignment_id_fkey"
            columns: ["shift_assignment_id"]
            isOneToOne: false
            referencedRelation: "shift_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_reopen_logs_shift_session_id_fkey"
            columns: ["shift_session_id"]
            isOneToOne: false
            referencedRelation: "shift_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_sessions: {
        Row: {
          closed_at: string | null
          created_at: string
          id: string
          opened_at: string
          shift_assignment_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: string
          opened_at?: string
          shift_assignment_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: string
          opened_at?: string
          shift_assignment_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_sessions_shift_assignment_id_fkey"
            columns: ["shift_assignment_id"]
            isOneToOne: false
            referencedRelation: "shift_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_types: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          type: string | null
          updated_at: string
          zone_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          type?: string | null
          updated_at?: string
          zone_name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          type?: string | null
          updated_at?: string
          zone_name?: string
        }
        Relationships: []
      }
      shifts: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          shift_end_time: string
          shift_name: string
          shift_order: number
          shift_start_time: string
          shift_type_id: string | null
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          shift_end_time: string
          shift_name: string
          shift_order?: number
          shift_start_time: string
          shift_type_id?: string | null
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          shift_end_time?: string
          shift_name?: string
          shift_order?: number
          shift_start_time?: string
          shift_type_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_shift_type_id_fkey"
            columns: ["shift_type_id"]
            isOneToOne: false
            referencedRelation: "shift_types"
            referencedColumns: ["id"]
          },
        ]
      }
      software_licenses: {
        Row: {
          assigned_department: string | null
          assigned_to: string | null
          category: string
          cost: number
          created_at: string
          created_by: string | null
          currency_id: string | null
          expiry_date: string | null
          id: string
          invoice_file_path: string | null
          license_key: string | null
          notes: string | null
          notification_days: number[] | null
          payment_method: string | null
          purchase_date: string
          renewal_cycle: string
          software_name: string
          status: string
          updated_at: string
          updated_by: string | null
          vendor_portal_url: string | null
          vendor_provider: string
          version: string | null
        }
        Insert: {
          assigned_department?: string | null
          assigned_to?: string | null
          category: string
          cost?: number
          created_at?: string
          created_by?: string | null
          currency_id?: string | null
          expiry_date?: string | null
          id?: string
          invoice_file_path?: string | null
          license_key?: string | null
          notes?: string | null
          notification_days?: number[] | null
          payment_method?: string | null
          purchase_date: string
          renewal_cycle: string
          software_name: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          vendor_portal_url?: string | null
          vendor_provider: string
          version?: string | null
        }
        Update: {
          assigned_department?: string | null
          assigned_to?: string | null
          category?: string
          cost?: number
          created_at?: string
          created_by?: string | null
          currency_id?: string | null
          expiry_date?: string | null
          id?: string
          invoice_file_path?: string | null
          license_key?: string | null
          notes?: string | null
          notification_days?: number[] | null
          payment_method?: string | null
          purchase_date?: string
          renewal_cycle?: string
          software_name?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          vendor_portal_url?: string | null
          vendor_provider?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "software_licenses_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_products: {
        Row: {
          created_at: string
          date_from: string | null
          date_to: string | null
          id: string
          price: number | null
          sku: string
          supplier_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          id?: string
          price?: number | null
          sku: string
          supplier_code: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          id?: string
          price?: number | null
          sku?: string
          supplier_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          created_at: string
          id: string
          status: string
          supplier_code: string
          supplier_email: string | null
          supplier_name: string
          supplier_phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          supplier_code: string
          supplier_email?: string | null
          supplier_name: string
          supplier_phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          supplier_code?: string
          supplier_email?: string | null
          supplier_name?: string
          supplier_phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      temp_ludo_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          image_path: string | null
          player_id: string | null
          product_sku: string
          shift_session_id: string
          transaction_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          image_path?: string | null
          player_id?: string | null
          product_sku: string
          shift_session_id: string
          transaction_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          image_path?: string | null
          player_id?: string | null
          product_sku?: string
          shift_session_id?: string
          transaction_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "temp_ludo_transactions_shift_session_id_fkey"
            columns: ["shift_session_id"]
            isOneToOne: false
            referencedRelation: "shift_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_activity_logs: {
        Row: {
          activity_type: string
          created_at: string
          description: string | null
          id: string
          recipient_id: string | null
          recipient_name: string | null
          ticket_id: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          activity_type: string
          created_at?: string
          description?: string | null
          id?: string
          recipient_id?: string | null
          recipient_name?: string | null
          ticket_id: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string | null
          id?: string
          recipient_id?: string | null
          recipient_name?: string | null
          ticket_id?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_activity_logs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          is_internal: boolean
          ticket_id: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assigned_to: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          department_id: string
          description: string
          external_link: string | null
          id: string
          is_deleted: boolean
          is_purchase_ticket: boolean
          next_admin_order: number | null
          priority: string
          status: string
          subject: string
          ticket_number: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          department_id: string
          description: string
          external_link?: string | null
          id?: string
          is_deleted?: boolean
          is_purchase_ticket?: boolean
          next_admin_order?: number | null
          priority: string
          status?: string
          subject: string
          ticket_number: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          department_id?: string
          description?: string
          external_link?: string | null
          id?: string
          is_deleted?: boolean
          is_purchase_ticket?: boolean
          next_admin_order?: number | null
          priority?: string
          status?: string
          subject?: string
          ticket_number?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_logs: {
        Row: {
          created_at: string
          date_range_end: string | null
          date_range_start: string | null
          error_message: string | null
          excel_dates: Json | null
          file_name: string
          id: string
          new_brands_count: number | null
          new_customers_count: number | null
          new_products_count: number | null
          records_processed: number | null
          sheet_id: string | null
          status: string
          total_value: number | null
          updated_at: string
          upload_date: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          created_at?: string
          date_range_end?: string | null
          date_range_start?: string | null
          error_message?: string | null
          excel_dates?: Json | null
          file_name: string
          id?: string
          new_brands_count?: number | null
          new_customers_count?: number | null
          new_products_count?: number | null
          records_processed?: number | null
          sheet_id?: string | null
          status?: string
          total_value?: number | null
          updated_at?: string
          upload_date?: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          created_at?: string
          date_range_end?: string | null
          date_range_start?: string | null
          error_message?: string | null
          excel_dates?: Json | null
          file_name?: string
          id?: string
          new_brands_count?: number | null
          new_customers_count?: number | null
          new_products_count?: number | null
          records_processed?: number | null
          sheet_id?: string | null
          status?: string
          total_value?: number | null
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
      user_group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_groups: {
        Row: {
          created_at: string
          description: string | null
          group_code: string
          group_name: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          group_code: string
          group_name: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          group_code?: string
          group_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string
          has_access: boolean
          id: string
          menu_item: string
          parent_menu: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          has_access?: boolean
          id?: string
          menu_item: string
          parent_menu?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          has_access?: boolean
          id?: string
          menu_item?: string
          parent_menu?: string | null
          updated_at?: string
          user_id?: string
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
      whatsapp_config: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          mobile_number: string
          status_callback_url: string | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          mobile_number: string
          status_callback_url?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          mobile_number?: string
          status_callback_url?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          created_at: string
          customer_name: string | null
          customer_phone: string
          id: string
          last_message_at: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          customer_phone: string
          id?: string
          last_message_at?: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string
          id?: string
          last_message_at?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          media_type: string | null
          media_url: string | null
          message_status: string | null
          message_text: string
          sender_type: string
          twilio_sid: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_status?: string | null
          message_text: string
          sender_type: string
          twilio_sid?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_status?: string | null
          message_text?: string
          sender_type?: string
          twilio_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
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
          cost_price_num?: never
          cost_sold?: number | null
          cost_sold_num?: never
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
          profit_num?: never
          qty?: number | null
          qty_num?: never
          total?: number | null
          total_num?: never
          unit_price?: number | null
          unit_price_num?: never
          updated_at?: string | null
          user_name?: string | null
          vendor_name?: string | null
        }
        Update: {
          brand_name?: string | null
          coins_number?: number | null
          cost_price?: number | null
          cost_price_num?: never
          cost_sold?: number | null
          cost_sold_num?: never
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
          profit_num?: never
          qty?: number | null
          qty_num?: never
          total?: number | null
          total_num?: never
          unit_price?: number | null
          unit_price_num?: never
          updated_at?: string | null
          user_name?: string | null
          vendor_name?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      clean_expired_cache: { Args: never; Returns: undefined }
      cost_by_brand_type: {
        Args: { date_from: string; date_to: string; p_brand_type?: string }
        Returns: {
          brand_type_name: string
          total_cost: number
          transaction_count: number
        }[]
      }
      customer_stats: {
        Args: never
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
      exec_sql: { Args: { sql: string }; Returns: undefined }
      format_date_to_int: { Args: { d: string }; Returns: number }
      generate_ludo_order_number: { Args: never; Returns: string }
      generate_ticket_number: { Args: never; Returns: string }
      get_cost_of_sales: {
        Args: { date_from: string; date_to: string }
        Returns: number
      }
      get_epayment_charges: {
        Args: { date_from: string; date_to: string }
        Returns: number
      }
      get_points_summary: {
        Args: { date_from: string; date_to: string }
        Returns: {
          total_cost: number
          total_sales: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      revenue_by_brand_type: {
        Args: { date_from: string; date_to: string; p_brand_type?: string }
        Returns: {
          brand_type_name: string
          total_revenue: number
          transaction_count: number
        }[]
      }
      sales_trend: {
        Args: { date_from: string; date_to: string }
        Returns: {
          created_at_date: string
          total_sum: number
        }[]
      }
      transactions_summary: {
        Args: { date_from: string; date_to: string }
        Returns: {
          total_profit: number
          total_sales: number
          tx_count: number
        }[]
      }
      update_bank_fees_from_payment_brand: { Args: never; Returns: number }
      update_ordertotals_bank_fees: { Args: never; Returns: number }
      update_ordertotals_bank_fees_by_brand:
        | { Args: { batch_size?: number; brand_name: string }; Returns: number }
        | { Args: { brand_name: string }; Returns: number }
      update_ordertotals_bank_fees_by_pair: {
        Args: {
          batch_size?: number
          p_brand_name: string
          p_payment_type: string
        }
        Returns: number
      }
      update_software_license_status: { Args: never; Returns: undefined }
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
