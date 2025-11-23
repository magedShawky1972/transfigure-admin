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
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
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
          ticket_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
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
          created_at: string
          customer_api_url: string
          id: string
          is_active: boolean
          product_api_url: string | null
          updated_at: string
        }
        Insert: {
          api_key: string
          created_at?: string
          customer_api_url: string
          id?: string
          is_active?: boolean
          product_api_url?: string | null
          updated_at?: string
        }
        Update: {
          api_key?: string
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
      shift_types: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          type_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          type_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          type_name?: string
          updated_at?: string
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
        Relationships: []
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
