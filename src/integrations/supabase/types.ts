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
      aggregated_order_mapping: {
        Row: {
          aggregated_order_number: string
          aggregation_date: string
          brand_name: string | null
          created_at: string
          id: string
          original_order_number: string
          payment_brand: string | null
          payment_method: string | null
          user_name: string | null
        }
        Insert: {
          aggregated_order_number: string
          aggregation_date: string
          brand_name?: string | null
          created_at?: string
          id?: string
          original_order_number: string
          payment_brand?: string | null
          payment_method?: string | null
          user_name?: string | null
        }
        Update: {
          aggregated_order_number?: string
          aggregation_date?: string
          brand_name?: string | null
          created_at?: string
          id?: string
          original_order_number?: string
          payment_brand?: string | null
          payment_method?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      api_consumption_logs: {
        Row: {
          api_key_description: string | null
          api_key_id: string | null
          created_at: string | null
          endpoint: string
          execution_time_ms: number | null
          id: string
          method: string
          request_body: Json | null
          response_message: string | null
          response_status: number | null
          source_ip: string | null
          success: boolean | null
        }
        Insert: {
          api_key_description?: string | null
          api_key_id?: string | null
          created_at?: string | null
          endpoint: string
          execution_time_ms?: number | null
          id?: string
          method?: string
          request_body?: Json | null
          response_message?: string | null
          response_status?: number | null
          source_ip?: string | null
          success?: boolean | null
        }
        Update: {
          api_key_description?: string | null
          api_key_id?: string | null
          created_at?: string | null
          endpoint?: string
          execution_time_ms?: number | null
          id?: string
          method?: string
          request_body?: Json | null
          response_message?: string | null
          response_status?: number | null
          source_ip?: string | null
          success?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "api_consumption_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
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
      api_integration_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
          updated_by?: string | null
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
          allow_zk_attendance: boolean | null
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
          allow_zk_attendance?: boolean | null
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
          allow_zk_attendance?: boolean | null
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
      attendance_types: {
        Row: {
          allow_early_exit_minutes: number | null
          allow_late_minutes: number | null
          created_at: string
          description: string | null
          fixed_end_time: string | null
          fixed_start_time: string | null
          id: string
          is_active: boolean
          is_shift_based: boolean
          type_code: string
          type_name: string
          type_name_ar: string | null
          updated_at: string
        }
        Insert: {
          allow_early_exit_minutes?: number | null
          allow_late_minutes?: number | null
          created_at?: string
          description?: string | null
          fixed_end_time?: string | null
          fixed_start_time?: string | null
          id?: string
          is_active?: boolean
          is_shift_based?: boolean
          type_code: string
          type_name: string
          type_name_ar?: string | null
          updated_at?: string
        }
        Update: {
          allow_early_exit_minutes?: number | null
          allow_late_minutes?: number | null
          created_at?: string
          description?: string | null
          fixed_end_time?: string | null
          fixed_start_time?: string | null
          id?: string
          is_active?: boolean
          is_shift_based?: boolean
          type_code?: string
          type_name?: string
          type_name_ar?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      background_sync_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          current_order_number: string | null
          email_sent: boolean | null
          error_message: string | null
          failed_orders: number | null
          force_kill: boolean | null
          from_date: string
          id: string
          processed_orders: number | null
          skipped_orders: number | null
          started_at: string | null
          status: string
          successful_orders: number | null
          sync_run_id: string | null
          sync_type: string | null
          to_date: string
          total_orders: number | null
          updated_at: string
          user_email: string
          user_id: string
          user_name: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_order_number?: string | null
          email_sent?: boolean | null
          error_message?: string | null
          failed_orders?: number | null
          force_kill?: boolean | null
          from_date: string
          id?: string
          processed_orders?: number | null
          skipped_orders?: number | null
          started_at?: string | null
          status?: string
          successful_orders?: number | null
          sync_run_id?: string | null
          sync_type?: string | null
          to_date: string
          total_orders?: number | null
          updated_at?: string
          user_email: string
          user_id: string
          user_name: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_order_number?: string | null
          email_sent?: boolean | null
          error_message?: string | null
          failed_orders?: number | null
          force_kill?: boolean | null
          from_date?: string
          id?: string
          processed_orders?: number | null
          skipped_orders?: number | null
          started_at?: string | null
          status?: string
          successful_orders?: number | null
          sync_run_id?: string | null
          sync_type?: string | null
          to_date?: string
          total_orders?: number | null
          updated_at?: string
          user_email?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "background_sync_jobs_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "odoo_sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_schedule: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_enabled: boolean
          last_run_at: string | null
          next_run_at: string | null
          retention_days: number
          schedule_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_enabled?: boolean
          last_run_at?: string | null
          next_run_at?: string | null
          retention_days?: number
          schedule_time?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_enabled?: boolean
          last_run_at?: string | null
          next_run_at?: string | null
          retention_days?: number
          schedule_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      bank_entries: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          balance_after: number | null
          bank_charges: number | null
          bank_id: string
          check_number: string | null
          converted_amount: number | null
          created_at: string | null
          created_by: string
          description: string | null
          entry_date: string | null
          entry_number: string
          entry_type: string
          exchange_rate: number | null
          expense_request_id: string | null
          from_currency_id: string | null
          id: string
          other_charges: number | null
          posted_at: string | null
          posted_by: string | null
          reference_id: string | null
          reference_type: string | null
          status: string | null
          to_bank_id: string | null
          to_currency_id: string | null
          to_treasury_id: string | null
          transfer_type: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          balance_after?: number | null
          bank_charges?: number | null
          bank_id: string
          check_number?: string | null
          converted_amount?: number | null
          created_at?: string | null
          created_by: string
          description?: string | null
          entry_date?: string | null
          entry_number: string
          entry_type: string
          exchange_rate?: number | null
          expense_request_id?: string | null
          from_currency_id?: string | null
          id?: string
          other_charges?: number | null
          posted_at?: string | null
          posted_by?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string | null
          to_bank_id?: string | null
          to_currency_id?: string | null
          to_treasury_id?: string | null
          transfer_type?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          balance_after?: number | null
          bank_charges?: number | null
          bank_id?: string
          check_number?: string | null
          converted_amount?: number | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          entry_date?: string | null
          entry_number?: string
          entry_type?: string
          exchange_rate?: number | null
          expense_request_id?: string | null
          from_currency_id?: string | null
          id?: string
          other_charges?: number | null
          posted_at?: string | null
          posted_by?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string | null
          to_bank_id?: string | null
          to_currency_id?: string | null
          to_treasury_id?: string | null
          transfer_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_entries_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_entries_expense_request_id_fkey"
            columns: ["expense_request_id"]
            isOneToOne: false
            referencedRelation: "expense_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_entries_from_currency_id_fkey"
            columns: ["from_currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_entries_to_bank_id_fkey"
            columns: ["to_bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_entries_to_currency_id_fkey"
            columns: ["to_currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_entries_to_treasury_id_fkey"
            columns: ["to_treasury_id"]
            isOneToOne: false
            referencedRelation: "treasuries"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_ledger: {
        Row: {
          balance_after: number | null
          bank_id: string
          clearinginstitutename: string | null
          created_at: string
          created_by: string | null
          currency_id: string | null
          customercountry: string | null
          description: string | null
          entry_date: string
          entry_date_int: number | null
          exchange_rate: number | null
          id: string
          in_amount: number | null
          out_amount: number | null
          paymentrefrence: string | null
          reference_id: string | null
          reference_number: string | null
          reference_type: string
          result: string | null
          riskfrauddescription: string | null
          transaction_receipt: string | null
          transactionid: string | null
        }
        Insert: {
          balance_after?: number | null
          bank_id: string
          clearinginstitutename?: string | null
          created_at?: string
          created_by?: string | null
          currency_id?: string | null
          customercountry?: string | null
          description?: string | null
          entry_date?: string
          entry_date_int?: number | null
          exchange_rate?: number | null
          id?: string
          in_amount?: number | null
          out_amount?: number | null
          paymentrefrence?: string | null
          reference_id?: string | null
          reference_number?: string | null
          reference_type: string
          result?: string | null
          riskfrauddescription?: string | null
          transaction_receipt?: string | null
          transactionid?: string | null
        }
        Update: {
          balance_after?: number | null
          bank_id?: string
          clearinginstitutename?: string | null
          created_at?: string
          created_by?: string | null
          currency_id?: string | null
          customercountry?: string | null
          description?: string | null
          entry_date?: string
          entry_date_int?: number | null
          exchange_rate?: number | null
          id?: string
          in_amount?: number | null
          out_amount?: number | null
          paymentrefrence?: string | null
          reference_id?: string | null
          reference_number?: string | null
          reference_type?: string
          result?: string | null
          riskfrauddescription?: string | null
          transaction_receipt?: string | null
          transactionid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_ledger_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_ledger_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_ledger_update_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_message: string | null
          error_records: number | null
          force_kill: boolean | null
          from_date_int: number | null
          id: string
          job_type: string
          processed_records: number | null
          started_at: string | null
          status: string
          to_date_int: number | null
          total_records: number | null
          updated_at: string
          updated_records: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          error_records?: number | null
          force_kill?: boolean | null
          from_date_int?: number | null
          id?: string
          job_type: string
          processed_records?: number | null
          started_at?: string | null
          status?: string
          to_date_int?: number | null
          total_records?: number | null
          updated_at?: string
          updated_records?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          error_records?: number | null
          force_kill?: boolean | null
          from_date_int?: number | null
          id?: string
          job_type?: string
          processed_records?: number | null
          started_at?: string | null
          status?: string
          to_date_int?: number | null
          total_records?: number | null
          updated_at?: string
          updated_records?: number | null
        }
        Relationships: []
      }
      banks: {
        Row: {
          account_number: string | null
          bank_code: string
          bank_name: string
          bank_name_ar: string | null
          branch_name: string | null
          created_at: string | null
          created_by: string | null
          currency_id: string | null
          current_balance: number | null
          iban: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          opening_balance: number | null
          swift_code: string | null
          updated_at: string | null
        }
        Insert: {
          account_number?: string | null
          bank_code: string
          bank_name: string
          bank_name_ar?: string | null
          branch_name?: string | null
          created_at?: string | null
          created_by?: string | null
          currency_id?: string | null
          current_balance?: number | null
          iban?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          opening_balance?: number | null
          swift_code?: string | null
          updated_at?: string | null
        }
        Update: {
          account_number?: string | null
          bank_code?: string
          bank_name?: string
          bank_name_ar?: string | null
          branch_name?: string | null
          created_at?: string | null
          created_by?: string | null
          currency_id?: string | null
          current_balance?: number | null
          iban?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          opening_balance?: number | null
          swift_code?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "banks_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
        ]
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
      company_news: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          image_url: string | null
          is_published: boolean
          published_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          image_url?: string | null
          is_published?: boolean
          published_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          image_url?: string | null
          is_published?: boolean
          published_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cost_centers: {
        Row: {
          cost_center_code: string
          cost_center_name: string
          cost_center_name_ar: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cost_center_code: string
          cost_center_name: string
          cost_center_name_ar?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cost_center_code?: string
          cost_center_name?: string
          cost_center_name_ar?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
          updated_by?: string | null
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
          conversion_operator: string
          created_at: string
          currency_id: string
          effective_date: string
          id: string
          rate_to_base: number
          updated_at: string
        }
        Insert: {
          conversion_operator?: string
          created_at?: string
          currency_id: string
          effective_date?: string
          id?: string
          rate_to_base?: number
          updated_at?: string
        }
        Update: {
          conversion_operator?: string
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
      daily_sync_jobs: {
        Row: {
          completed_at: string | null
          completed_days: number | null
          created_at: string
          current_day: string | null
          day_statuses: Json | null
          error_message: string | null
          failed_days: number | null
          failed_orders: number | null
          from_date: string
          id: string
          skipped_orders: number | null
          started_at: string | null
          status: string
          successful_orders: number | null
          to_date: string
          total_days: number | null
          total_orders: number | null
          updated_at: string
          user_email: string
          user_id: string
          user_name: string
        }
        Insert: {
          completed_at?: string | null
          completed_days?: number | null
          created_at?: string
          current_day?: string | null
          day_statuses?: Json | null
          error_message?: string | null
          failed_days?: number | null
          failed_orders?: number | null
          from_date: string
          id?: string
          skipped_orders?: number | null
          started_at?: string | null
          status?: string
          successful_orders?: number | null
          to_date: string
          total_days?: number | null
          total_orders?: number | null
          updated_at?: string
          user_email: string
          user_id: string
          user_name: string
        }
        Update: {
          completed_at?: string | null
          completed_days?: number | null
          created_at?: string
          current_day?: string | null
          day_statuses?: Json | null
          error_message?: string | null
          failed_days?: number | null
          failed_orders?: number | null
          from_date?: string
          id?: string
          skipped_orders?: number | null
          started_at?: string | null
          status?: string
          successful_orders?: number | null
          to_date?: string
          total_days?: number | null
          total_orders?: number | null
          updated_at?: string
          user_email?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      deduction_rules: {
        Row: {
          created_at: string
          deduction_type: string
          deduction_value: number
          id: string
          is_active: boolean
          is_overtime: boolean | null
          max_minutes: number | null
          min_minutes: number | null
          overtime_multiplier: number | null
          rule_name: string
          rule_name_ar: string | null
          rule_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deduction_type: string
          deduction_value: number
          id?: string
          is_active?: boolean
          is_overtime?: boolean | null
          max_minutes?: number | null
          min_minutes?: number | null
          overtime_multiplier?: number | null
          rule_name: string
          rule_name_ar?: string | null
          rule_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deduction_type?: string
          deduction_value?: number
          id?: string
          is_active?: boolean
          is_overtime?: boolean | null
          max_minutes?: number | null
          min_minutes?: number | null
          overtime_multiplier?: number | null
          rule_name?: string
          rule_name_ar?: string | null
          rule_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      deleted_email_ids: {
        Row: {
          deleted_at: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          deleted_at?: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          deleted_at?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: []
      }
      department_admins: {
        Row: {
          admin_order: number
          approve_employee_request: boolean
          created_at: string
          department_id: string
          id: string
          is_department_manager: boolean
          is_purchase_admin: boolean
          requires_cost_center: boolean
          user_id: string
        }
        Insert: {
          admin_order?: number
          approve_employee_request?: boolean
          created_at?: string
          department_id: string
          id?: string
          is_department_manager?: boolean
          is_purchase_admin?: boolean
          requires_cost_center?: boolean
          user_id: string
        }
        Update: {
          admin_order?: number
          approve_employee_request?: boolean
          created_at?: string
          department_id?: string
          id?: string
          is_department_manager?: boolean
          is_purchase_admin?: boolean
          requires_cost_center?: boolean
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
      department_task_phases: {
        Row: {
          created_at: string
          department_id: string
          id: string
          is_active: boolean
          phase_color: string
          phase_key: string
          phase_name: string
          phase_name_ar: string | null
          phase_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          is_active?: boolean
          phase_color?: string
          phase_key: string
          phase_name: string
          phase_name_ar?: string | null
          phase_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          is_active?: boolean
          phase_color?: string
          phase_key?: string
          phase_name?: string
          phase_name_ar?: string | null
          phase_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_task_phases_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          color: string | null
          created_at: string
          department_code: string
          department_name: string
          department_name_ar: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean
          is_outsource: boolean
          parent_department_id: string | null
          position_x: number | null
          position_y: number | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          department_code: string
          department_name: string
          department_name_ar?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean
          is_outsource?: boolean
          parent_department_id?: string | null
          position_x?: number | null
          position_y?: number | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          department_code?: string
          department_name?: string
          department_name_ar?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean
          is_outsource?: boolean
          parent_department_id?: string | null
          position_x?: number | null
          position_y?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_parent_department_id_fkey"
            columns: ["parent_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      document_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          is_mandatory: boolean | null
          type_name: string
          type_name_ar: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_mandatory?: boolean | null
          type_name: string
          type_name_ar?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_mandatory?: boolean | null
          type_name?: string
          type_name_ar?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_attachments: {
        Row: {
          content_type: string | null
          created_at: string
          email_id: string
          filename: string
          id: string
          size_bytes: number | null
          storage_path: string | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          email_id: string
          filename: string
          id?: string
          size_bytes?: number | null
          storage_path?: string | null
        }
        Update: {
          content_type?: string | null
          created_at?: string
          email_id?: string
          filename?: string
          id?: string
          size_bytes?: number | null
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_attachments_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
        ]
      }
      email_contacts: {
        Row: {
          created_at: string
          created_by: string | null
          display_name: string | null
          email: string
          id: string
          is_active: boolean
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          email: string
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          email?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      emails: {
        Row: {
          bcc_addresses: Json | null
          body_html: string | null
          body_text: string | null
          cc_addresses: Json | null
          config_id: string | null
          created_at: string
          email_date: string
          folder: string
          from_address: string
          from_name: string | null
          has_attachments: boolean
          id: string
          is_draft: boolean
          is_read: boolean
          is_starred: boolean
          linked_task_id: string | null
          linked_ticket_id: string | null
          message_id: string
          subject: string | null
          to_addresses: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          bcc_addresses?: Json | null
          body_html?: string | null
          body_text?: string | null
          cc_addresses?: Json | null
          config_id?: string | null
          created_at?: string
          email_date: string
          folder?: string
          from_address: string
          from_name?: string | null
          has_attachments?: boolean
          id?: string
          is_draft?: boolean
          is_read?: boolean
          is_starred?: boolean
          linked_task_id?: string | null
          linked_ticket_id?: string | null
          message_id: string
          subject?: string | null
          to_addresses?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          bcc_addresses?: Json | null
          body_html?: string | null
          body_text?: string | null
          cc_addresses?: Json | null
          config_id?: string | null
          created_at?: string
          email_date?: string
          folder?: string
          from_address?: string
          from_name?: string | null
          has_attachments?: boolean
          id?: string
          is_draft?: boolean
          is_read?: boolean
          is_starred?: boolean
          linked_task_id?: string | null
          linked_ticket_id?: string | null
          message_id?: string
          subject?: string | null
          to_addresses?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emails_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "user_email_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_linked_task_id_fkey"
            columns: ["linked_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_linked_ticket_id_fkey"
            columns: ["linked_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_contacts: {
        Row: {
          contact_address: string | null
          contact_name: string
          contact_phone: string | null
          contact_type: string
          created_at: string
          employee_id: string
          id: string
          is_emergency_contact: boolean | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          contact_address?: string | null
          contact_name: string
          contact_phone?: string | null
          contact_type: string
          created_at?: string
          employee_id: string
          id?: string
          is_emergency_contact?: boolean | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          contact_address?: string | null
          contact_name?: string
          contact_phone?: string | null
          contact_type?: string
          created_at?: string
          employee_id?: string
          id?: string
          is_emergency_contact?: boolean | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_contacts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          created_at: string
          document_type_id: string
          employee_id: string
          expiry_date: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          notes: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          document_type_id: string
          employee_id: string
          expiry_date?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          notes?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          document_type_id?: string
          employee_id?: string
          expiry_date?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          notes?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_job_history: {
        Row: {
          change_reason: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          employee_id: string
          end_date: string | null
          id: string
          job_position_id: string | null
          notes: string | null
          salary: number | null
          start_date: string
        }
        Insert: {
          change_reason?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          employee_id: string
          end_date?: string | null
          id?: string
          job_position_id?: string | null
          notes?: string | null
          salary?: number | null
          start_date: string
        }
        Update: {
          change_reason?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          employee_id?: string
          end_date?: string | null
          id?: string
          job_position_id?: string | null
          notes?: string | null
          salary?: number | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_job_history_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_job_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_job_history_job_position_id_fkey"
            columns: ["job_position_id"]
            isOneToOne: false
            referencedRelation: "job_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_requests: {
        Row: {
          actual_arrival_time: string | null
          attachment_url: string | null
          created_at: string | null
          current_approval_level: number | null
          current_phase: string | null
          delay_date: string | null
          delay_minutes: number | null
          department_id: string | null
          employee_id: string
          end_date: string | null
          expense_amount: number | null
          expense_currency_id: string | null
          expense_description: string | null
          expense_receipt_url: string | null
          hr_approved_at: string | null
          hr_approved_by: string | null
          id: string
          manager_approved_at: string | null
          manager_approved_by: string | null
          reason: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          request_date: string | null
          request_number: string
          request_type: string
          start_date: string | null
          status: string
          total_days: number | null
          updated_at: string | null
          vacation_code_id: string | null
        }
        Insert: {
          actual_arrival_time?: string | null
          attachment_url?: string | null
          created_at?: string | null
          current_approval_level?: number | null
          current_phase?: string | null
          delay_date?: string | null
          delay_minutes?: number | null
          department_id?: string | null
          employee_id: string
          end_date?: string | null
          expense_amount?: number | null
          expense_currency_id?: string | null
          expense_description?: string | null
          expense_receipt_url?: string | null
          hr_approved_at?: string | null
          hr_approved_by?: string | null
          id?: string
          manager_approved_at?: string | null
          manager_approved_by?: string | null
          reason?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          request_date?: string | null
          request_number: string
          request_type: string
          start_date?: string | null
          status?: string
          total_days?: number | null
          updated_at?: string | null
          vacation_code_id?: string | null
        }
        Update: {
          actual_arrival_time?: string | null
          attachment_url?: string | null
          created_at?: string | null
          current_approval_level?: number | null
          current_phase?: string | null
          delay_date?: string | null
          delay_minutes?: number | null
          department_id?: string | null
          employee_id?: string
          end_date?: string | null
          expense_amount?: number | null
          expense_currency_id?: string | null
          expense_description?: string | null
          expense_receipt_url?: string | null
          hr_approved_at?: string | null
          hr_approved_by?: string | null
          id?: string
          manager_approved_at?: string | null
          manager_approved_by?: string | null
          reason?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          request_date?: string | null
          request_number?: string
          request_type?: string
          start_date?: string | null
          status?: string
          total_days?: number | null
          updated_at?: string | null
          vacation_code_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_requests_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_requests_expense_currency_id_fkey"
            columns: ["expense_currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_requests_vacation_code_id_fkey"
            columns: ["vacation_code_id"]
            isOneToOne: false
            referencedRelation: "vacation_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_vacation_types: {
        Row: {
          balance: number | null
          created_at: string
          custom_days: number | null
          employee_id: string
          id: string
          updated_at: string | null
          used_days: number | null
          vacation_code_id: string
          year: number | null
        }
        Insert: {
          balance?: number | null
          created_at?: string
          custom_days?: number | null
          employee_id: string
          id?: string
          updated_at?: string | null
          used_days?: number | null
          vacation_code_id: string
          year?: number | null
        }
        Update: {
          balance?: number | null
          created_at?: string
          custom_days?: number | null
          employee_id?: string
          id?: string
          updated_at?: string | null
          used_days?: number | null
          vacation_code_id?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_vacation_types_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_vacation_types_vacation_code_id_fkey"
            columns: ["vacation_code_id"]
            isOneToOne: false
            referencedRelation: "vacation_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: string | null
          attendance_type_id: string | null
          basic_salary: number | null
          created_at: string
          currency: string | null
          date_of_birth: string | null
          department_id: string | null
          email: string | null
          employee_number: string
          employment_status: Database["public"]["Enums"]["employment_status"]
          first_name: string
          first_name_ar: string | null
          fixed_shift_end: string | null
          fixed_shift_start: string | null
          gender: string | null
          id: string
          insurance_end_date: string | null
          insurance_start_date: string | null
          job_position_id: string | null
          job_start_date: string
          last_name: string
          last_name_ar: string | null
          manager_id: string | null
          marital_status: string | null
          medical_insurance_plan_id: string | null
          mobile: string | null
          national_id: string | null
          nationality: string | null
          notes: string | null
          passport_number: string | null
          phone: string | null
          photo_url: string | null
          religion: string | null
          requires_attendance_signin: boolean | null
          shift_plan_id: string | null
          shift_type: Database["public"]["Enums"]["shift_type"]
          termination_date: string | null
          updated_at: string
          user_id: string | null
          vacation_balance: number | null
          vacation_code_id: string | null
          zk_employee_code: string | null
        }
        Insert: {
          address?: string | null
          attendance_type_id?: string | null
          basic_salary?: number | null
          created_at?: string
          currency?: string | null
          date_of_birth?: string | null
          department_id?: string | null
          email?: string | null
          employee_number: string
          employment_status?: Database["public"]["Enums"]["employment_status"]
          first_name: string
          first_name_ar?: string | null
          fixed_shift_end?: string | null
          fixed_shift_start?: string | null
          gender?: string | null
          id?: string
          insurance_end_date?: string | null
          insurance_start_date?: string | null
          job_position_id?: string | null
          job_start_date: string
          last_name: string
          last_name_ar?: string | null
          manager_id?: string | null
          marital_status?: string | null
          medical_insurance_plan_id?: string | null
          mobile?: string | null
          national_id?: string | null
          nationality?: string | null
          notes?: string | null
          passport_number?: string | null
          phone?: string | null
          photo_url?: string | null
          religion?: string | null
          requires_attendance_signin?: boolean | null
          shift_plan_id?: string | null
          shift_type?: Database["public"]["Enums"]["shift_type"]
          termination_date?: string | null
          updated_at?: string
          user_id?: string | null
          vacation_balance?: number | null
          vacation_code_id?: string | null
          zk_employee_code?: string | null
        }
        Update: {
          address?: string | null
          attendance_type_id?: string | null
          basic_salary?: number | null
          created_at?: string
          currency?: string | null
          date_of_birth?: string | null
          department_id?: string | null
          email?: string | null
          employee_number?: string
          employment_status?: Database["public"]["Enums"]["employment_status"]
          first_name?: string
          first_name_ar?: string | null
          fixed_shift_end?: string | null
          fixed_shift_start?: string | null
          gender?: string | null
          id?: string
          insurance_end_date?: string | null
          insurance_start_date?: string | null
          job_position_id?: string | null
          job_start_date?: string
          last_name?: string
          last_name_ar?: string | null
          manager_id?: string | null
          marital_status?: string | null
          medical_insurance_plan_id?: string | null
          mobile?: string | null
          national_id?: string | null
          nationality?: string | null
          notes?: string | null
          passport_number?: string | null
          phone?: string | null
          photo_url?: string | null
          religion?: string | null
          requires_attendance_signin?: boolean | null
          shift_plan_id?: string | null
          shift_type?: Database["public"]["Enums"]["shift_type"]
          termination_date?: string | null
          updated_at?: string
          user_id?: string | null
          vacation_balance?: number | null
          vacation_code_id?: string | null
          zk_employee_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_attendance_type_id_fkey"
            columns: ["attendance_type_id"]
            isOneToOne: false
            referencedRelation: "attendance_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_job_position_id_fkey"
            columns: ["job_position_id"]
            isOneToOne: false
            referencedRelation: "job_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_medical_insurance_plan_id_fkey"
            columns: ["medical_insurance_plan_id"]
            isOneToOne: false
            referencedRelation: "medical_insurance_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_shift_plan_id_fkey"
            columns: ["shift_plan_id"]
            isOneToOne: false
            referencedRelation: "shift_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_vacation_code_id_fkey"
            columns: ["vacation_code_id"]
            isOneToOne: false
            referencedRelation: "vacation_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      encryption_keys: {
        Row: {
          created_at: string | null
          id: string
          key_name: string
          key_value: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          key_name: string
          key_value: string
        }
        Update: {
          created_at?: string | null
          id?: string
          key_name?: string
          key_value?: string
        }
        Relationships: []
      }
      excel_column_mappings: {
        Row: {
          created_at: string
          data_type: string
          excel_column: string
          id: string
          is_json_column: boolean
          is_pk: boolean
          json_split_keys: string[] | null
          sheet_id: string
          table_column: string
        }
        Insert: {
          created_at?: string
          data_type: string
          excel_column: string
          id?: string
          is_json_column?: boolean
          is_pk?: boolean
          json_split_keys?: string[] | null
          sheet_id: string
          table_column: string
        }
        Update: {
          created_at?: string
          data_type?: string
          excel_column?: string
          id?: string
          is_json_column?: boolean
          is_pk?: boolean
          json_split_keys?: string[] | null
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
          check_brand: boolean
          check_customer: boolean
          check_product: boolean
          created_at: string
          file_name: string
          id: string
          sheet_code: string
          sheet_name: string
          skip_first_row: boolean
          status: string | null
          target_table: string | null
          updated_at: string
        }
        Insert: {
          check_brand?: boolean
          check_customer?: boolean
          check_product?: boolean
          created_at?: string
          file_name: string
          id?: string
          sheet_code: string
          sheet_name: string
          skip_first_row?: boolean
          status?: string | null
          target_table?: string | null
          updated_at?: string
        }
        Update: {
          check_brand?: boolean
          check_customer?: boolean
          check_product?: boolean
          created_at?: string
          file_name?: string
          id?: string
          sheet_code?: string
          sheet_name?: string
          skip_first_row?: boolean
          status?: string | null
          target_table?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          category_code: string
          category_name: string
          category_name_ar: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          parent_category_id: string | null
          updated_at: string | null
        }
        Insert: {
          category_code: string
          category_name: string
          category_name_ar?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          parent_category_id?: string | null
          updated_at?: string | null
        }
        Update: {
          category_code?: string
          category_name?: string
          category_name_ar?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          parent_category_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_entries: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          bank_id: string | null
          cost_center_id: string | null
          created_at: string | null
          created_by: string | null
          currency_id: string | null
          entry_date: string
          entry_number: string
          exchange_rate: number | null
          expense_reference: string | null
          grand_total: number | null
          id: string
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          payment_method: string
          status: string | null
          subtotal: number | null
          total_vat: number | null
          treasury_id: string | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          bank_id?: string | null
          cost_center_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency_id?: string | null
          entry_date?: string
          entry_number: string
          exchange_rate?: number | null
          expense_reference?: string | null
          grand_total?: number | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_method: string
          status?: string | null
          subtotal?: number | null
          total_vat?: number | null
          treasury_id?: string | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          bank_id?: string | null
          cost_center_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency_id?: string | null
          entry_date?: string
          entry_number?: string
          exchange_rate?: number | null
          expense_reference?: string | null
          grand_total?: number | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_method?: string
          status?: string | null
          subtotal?: number | null
          total_vat?: number | null
          treasury_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_entries_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_entries_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_entries_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_entries_treasury_id_fkey"
            columns: ["treasury_id"]
            isOneToOne: false
            referencedRelation: "treasuries"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_entry_lines: {
        Row: {
          created_at: string | null
          description: string | null
          expense_entry_id: string
          expense_type_id: string | null
          id: string
          line_number: number
          line_total: number | null
          quantity: number | null
          total: number | null
          unit_price: number | null
          vat_amount: number | null
          vat_percent: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          expense_entry_id: string
          expense_type_id?: string | null
          id?: string
          line_number: number
          line_total?: number | null
          quantity?: number | null
          total?: number | null
          unit_price?: number | null
          vat_amount?: number | null
          vat_percent?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          expense_entry_id?: string
          expense_type_id?: string | null
          id?: string
          line_number?: number
          line_total?: number | null
          quantity?: number | null
          total?: number | null
          unit_price?: number | null
          vat_amount?: number | null
          vat_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_entry_lines_expense_entry_id_fkey"
            columns: ["expense_entry_id"]
            isOneToOne: false
            referencedRelation: "expense_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_entry_lines_expense_type_id_fkey"
            columns: ["expense_type_id"]
            isOneToOne: false
            referencedRelation: "expense_types"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_requests: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          bank_id: string | null
          base_currency_amount: number | null
          classified_at: string | null
          classified_by: string | null
          cost_center_id: string | null
          created_at: string | null
          currency_id: string | null
          description: string
          exchange_rate: number | null
          expense_type_id: string | null
          id: string
          is_asset: boolean | null
          net_total: number | null
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          payment_method: string | null
          purchase_item_id: string | null
          quantity: number | null
          request_date: string | null
          request_number: string
          requester_id: string
          status: string | null
          tax_percent: number | null
          ticket_id: string | null
          treasury_id: string | null
          unit_price: number | null
          uom_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          bank_id?: string | null
          base_currency_amount?: number | null
          classified_at?: string | null
          classified_by?: string | null
          cost_center_id?: string | null
          created_at?: string | null
          currency_id?: string | null
          description: string
          exchange_rate?: number | null
          expense_type_id?: string | null
          id?: string
          is_asset?: boolean | null
          net_total?: number | null
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_method?: string | null
          purchase_item_id?: string | null
          quantity?: number | null
          request_date?: string | null
          request_number: string
          requester_id: string
          status?: string | null
          tax_percent?: number | null
          ticket_id?: string | null
          treasury_id?: string | null
          unit_price?: number | null
          uom_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          bank_id?: string | null
          base_currency_amount?: number | null
          classified_at?: string | null
          classified_by?: string | null
          cost_center_id?: string | null
          created_at?: string | null
          currency_id?: string | null
          description?: string
          exchange_rate?: number | null
          expense_type_id?: string | null
          id?: string
          is_asset?: boolean | null
          net_total?: number | null
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_method?: string | null
          purchase_item_id?: string | null
          quantity?: number | null
          request_date?: string | null
          request_number?: string
          requester_id?: string
          status?: string | null
          tax_percent?: number | null
          ticket_id?: string | null
          treasury_id?: string | null
          unit_price?: number | null
          uom_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_requests_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_requests_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_requests_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_requests_expense_type_id_fkey"
            columns: ["expense_type_id"]
            isOneToOne: false
            referencedRelation: "expense_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_requests_purchase_item_id_fkey"
            columns: ["purchase_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_requests_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_requests_treasury_id_fkey"
            columns: ["treasury_id"]
            isOneToOne: false
            referencedRelation: "treasuries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_requests_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_types: {
        Row: {
          category_id: string | null
          created_at: string | null
          default_account_code: string | null
          expense_code: string
          expense_name: string
          expense_name_ar: string | null
          id: string
          is_active: boolean | null
          is_asset: boolean | null
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          default_account_code?: string | null
          expense_code: string
          expense_name: string
          expense_name_ar?: string | null
          id?: string
          is_active?: boolean | null
          is_asset?: boolean | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          default_account_code?: string | null
          expense_code?: string
          expense_name?: string
          expense_name_ar?: string | null
          id?: string
          is_active?: boolean | null
          is_asset?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_types_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
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
      hierarchy_assignments: {
        Row: {
          created_at: string
          department_id: string
          employee_id: string
          id: string
          job_position_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id: string
          employee_id: string
          id?: string
          job_position_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string
          employee_id?: string
          id?: string
          job_position_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hierarchy_assignments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hierarchy_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hierarchy_assignments_job_position_id_fkey"
            columns: ["job_position_id"]
            isOneToOne: false
            referencedRelation: "job_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      holiday_attendance_types: {
        Row: {
          attendance_type_id: string
          created_at: string
          holiday_id: string
          id: string
        }
        Insert: {
          attendance_type_id: string
          created_at?: string
          holiday_id: string
          id?: string
        }
        Update: {
          attendance_type_id?: string
          created_at?: string
          holiday_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "holiday_attendance_types_attendance_type_id_fkey"
            columns: ["attendance_type_id"]
            isOneToOne: false
            referencedRelation: "attendance_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holiday_attendance_types_holiday_id_fkey"
            columns: ["holiday_id"]
            isOneToOne: false
            referencedRelation: "official_holidays"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_managers: {
        Row: {
          admin_order: number
          created_at: string | null
          id: string
          is_active: boolean
          user_id: string
        }
        Insert: {
          admin_order?: number
          created_at?: string | null
          id?: string
          is_active?: boolean
          user_id: string
        }
        Update: {
          admin_order?: number
          created_at?: string | null
          id?: string
          is_active?: boolean
          user_id?: string
        }
        Relationships: []
      }
      hyberpaystatement: {
        Row: {
          accountcountry: string | null
          accountholder: string | null
          accountnumberlast4: string | null
          acquirerresponse: string | null
          action: string | null
          authorizationresponse_stan: string | null
          avsresult: string | null
          bankcode: string | null
          bin: string | null
          brand: string | null
          bulkid: string | null
          cardholderinitiatedtransactionid: string | null
          channelid: string | null
          channelname: string | null
          clearinginstitutename: string | null
          connectordataid: string | null
          connectorid: string | null
          connectortxid1: string | null
          connectortxid2: string | null
          created_at: string
          credit: string | null
          currency: string | null
          customercountry: string | null
          customername: string | null
          debit: string | null
          email: string | null
          extendeddescription: string | null
          external_system_link: string | null
          id: string
          invoiceid: string | null
          ip: string | null
          merchantcategorycode: string | null
          mobile: string | null
          mode: string | null
          paymentmethod: string | null
          paymenttype: string | null
          reasoncode: string | null
          reconciliationid: string | null
          request_date: string | null
          requesttimestamp: string | null
          response_acquirercode: string | null
          response_acquirermessage: string | null
          result: string | null
          returncode: string | null
          riskfrauddescription: string | null
          riskfraudstatuscode: string | null
          riskorderid: string | null
          riskreport: string | null
          riskrulecategory: string | null
          riskscore: string | null
          shopperid: string | null
          shortid: string | null
          source: string | null
          statuscode: string | null
          transaction_acquirer_settlementdate: string | null
          transaction_authorizationcode: string | null
          transaction_receipt: string | null
          transactionid: string | null
          transactionid_2: string | null
          uniqueid: string | null
          updated_at: string
          usage: string | null
        }
        Insert: {
          accountcountry?: string | null
          accountholder?: string | null
          accountnumberlast4?: string | null
          acquirerresponse?: string | null
          action?: string | null
          authorizationresponse_stan?: string | null
          avsresult?: string | null
          bankcode?: string | null
          bin?: string | null
          brand?: string | null
          bulkid?: string | null
          cardholderinitiatedtransactionid?: string | null
          channelid?: string | null
          channelname?: string | null
          clearinginstitutename?: string | null
          connectordataid?: string | null
          connectorid?: string | null
          connectortxid1?: string | null
          connectortxid2?: string | null
          created_at?: string
          credit?: string | null
          currency?: string | null
          customercountry?: string | null
          customername?: string | null
          debit?: string | null
          email?: string | null
          extendeddescription?: string | null
          external_system_link?: string | null
          id?: string
          invoiceid?: string | null
          ip?: string | null
          merchantcategorycode?: string | null
          mobile?: string | null
          mode?: string | null
          paymentmethod?: string | null
          paymenttype?: string | null
          reasoncode?: string | null
          reconciliationid?: string | null
          request_date?: string | null
          requesttimestamp?: string | null
          response_acquirercode?: string | null
          response_acquirermessage?: string | null
          result?: string | null
          returncode?: string | null
          riskfrauddescription?: string | null
          riskfraudstatuscode?: string | null
          riskorderid?: string | null
          riskreport?: string | null
          riskrulecategory?: string | null
          riskscore?: string | null
          shopperid?: string | null
          shortid?: string | null
          source?: string | null
          statuscode?: string | null
          transaction_acquirer_settlementdate?: string | null
          transaction_authorizationcode?: string | null
          transaction_receipt?: string | null
          transactionid?: string | null
          transactionid_2?: string | null
          uniqueid?: string | null
          updated_at?: string
          usage?: string | null
        }
        Update: {
          accountcountry?: string | null
          accountholder?: string | null
          accountnumberlast4?: string | null
          acquirerresponse?: string | null
          action?: string | null
          authorizationresponse_stan?: string | null
          avsresult?: string | null
          bankcode?: string | null
          bin?: string | null
          brand?: string | null
          bulkid?: string | null
          cardholderinitiatedtransactionid?: string | null
          channelid?: string | null
          channelname?: string | null
          clearinginstitutename?: string | null
          connectordataid?: string | null
          connectorid?: string | null
          connectortxid1?: string | null
          connectortxid2?: string | null
          created_at?: string
          credit?: string | null
          currency?: string | null
          customercountry?: string | null
          customername?: string | null
          debit?: string | null
          email?: string | null
          extendeddescription?: string | null
          external_system_link?: string | null
          id?: string
          invoiceid?: string | null
          ip?: string | null
          merchantcategorycode?: string | null
          mobile?: string | null
          mode?: string | null
          paymentmethod?: string | null
          paymenttype?: string | null
          reasoncode?: string | null
          reconciliationid?: string | null
          request_date?: string | null
          requesttimestamp?: string | null
          response_acquirercode?: string | null
          response_acquirermessage?: string | null
          result?: string | null
          returncode?: string | null
          riskfrauddescription?: string | null
          riskfraudstatuscode?: string | null
          riskorderid?: string | null
          riskreport?: string | null
          riskrulecategory?: string | null
          riskscore?: string | null
          shopperid?: string | null
          shortid?: string | null
          source?: string | null
          statuscode?: string | null
          transaction_acquirer_settlementdate?: string | null
          transaction_authorizationcode?: string | null
          transaction_receipt?: string | null
          transactionid?: string | null
          transactionid_2?: string | null
          uniqueid?: string | null
          updated_at?: string
          usage?: string | null
        }
        Relationships: []
      }
      internal_conversation_participants: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "internal_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_conversations: {
        Row: {
          conversation_name: string | null
          created_at: string
          created_by: string
          group_id: string | null
          id: string
          is_group: boolean
          updated_at: string
        }
        Insert: {
          conversation_name?: string | null
          created_at?: string
          created_by: string
          group_id?: string | null
          id?: string
          is_group?: boolean
          updated_at?: string
        }
        Update: {
          conversation_name?: string | null
          created_at?: string
          created_by?: string
          group_id?: string | null
          id?: string
          is_group?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_conversations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          media_type: string | null
          media_url: string | null
          message_text: string | null
          sender_id: string
          updated_at: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          media_type?: string | null
          media_url?: string | null
          message_text?: string | null
          sender_id: string
          updated_at?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          media_type?: string | null
          media_url?: string | null
          message_text?: string | null
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "internal_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_positions: {
        Row: {
          created_at: string
          department_id: string | null
          id: string
          is_active: boolean
          position_name: string
          position_name_ar: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          id?: string
          is_active?: boolean
          position_name: string
          position_name_ar?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          id?: string
          is_active?: boolean
          position_name?: string
          position_name_ar?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_positions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      login_history: {
        Row: {
          created_at: string
          device_info: Json | null
          device_name: string | null
          id: string
          ip_address: string | null
          is_active: boolean | null
          login_at: string
          logout_at: string | null
          session_duration_minutes: number | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: Json | null
          device_name?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          login_at?: string
          logout_at?: string | null
          session_duration_minutes?: number | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: Json | null
          device_name?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          login_at?: string
          logout_at?: string | null
          session_duration_minutes?: number | null
          user_agent?: string | null
          user_id?: string
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
      mail_types: {
        Row: {
          created_at: string
          id: string
          imap_host: string
          imap_port: number
          imap_secure: boolean
          is_active: boolean
          smtp_host: string
          smtp_port: number
          smtp_secure: boolean
          type_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          imap_host: string
          imap_port?: number
          imap_secure?: boolean
          is_active?: boolean
          smtp_host: string
          smtp_port?: number
          smtp_secure?: boolean
          type_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          imap_host?: string
          imap_port?: number
          imap_secure?: boolean
          is_active?: boolean
          smtp_host?: string
          smtp_port?: number
          smtp_secure?: boolean
          type_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      medical_insurance_plans: {
        Row: {
          coverage_type: string | null
          created_at: string
          description: string | null
          employee_contribution: number | null
          employer_contribution: number | null
          id: string
          includes_family: boolean | null
          is_active: boolean
          max_coverage_amount: number | null
          plan_name: string
          plan_name_ar: string | null
          provider: string | null
          updated_at: string
        }
        Insert: {
          coverage_type?: string | null
          created_at?: string
          description?: string | null
          employee_contribution?: number | null
          employer_contribution?: number | null
          id?: string
          includes_family?: boolean | null
          is_active?: boolean
          max_coverage_amount?: number | null
          plan_name: string
          plan_name_ar?: string | null
          provider?: string | null
          updated_at?: string
        }
        Update: {
          coverage_type?: string | null
          created_at?: string
          description?: string | null
          employee_contribution?: number | null
          employer_contribution?: number | null
          id?: string
          includes_family?: boolean | null
          is_active?: boolean
          max_coverage_amount?: number | null
          plan_name?: string
          plan_name_ar?: string | null
          provider?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          email_id: string | null
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
          email_id?: string | null
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
          email_id?: string | null
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
            foreignKeyName: "notifications_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
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
          api_key_test: string | null
          brand_api_url: string | null
          brand_api_url_test: string | null
          created_at: string
          customer_api_url: string
          customer_api_url_test: string | null
          id: string
          is_active: boolean
          is_production_mode: boolean
          payment_method_api_url: string | null
          payment_method_api_url_test: string | null
          product_api_url: string | null
          product_api_url_test: string | null
          purchase_order_api_url: string | null
          purchase_order_api_url_test: string | null
          sales_order_api_url: string | null
          sales_order_api_url_test: string | null
          supplier_api_url: string | null
          supplier_api_url_test: string | null
          updated_at: string
        }
        Insert: {
          api_key: string
          api_key_test?: string | null
          brand_api_url?: string | null
          brand_api_url_test?: string | null
          created_at?: string
          customer_api_url: string
          customer_api_url_test?: string | null
          id?: string
          is_active?: boolean
          is_production_mode?: boolean
          payment_method_api_url?: string | null
          payment_method_api_url_test?: string | null
          product_api_url?: string | null
          product_api_url_test?: string | null
          purchase_order_api_url?: string | null
          purchase_order_api_url_test?: string | null
          sales_order_api_url?: string | null
          sales_order_api_url_test?: string | null
          supplier_api_url?: string | null
          supplier_api_url_test?: string | null
          updated_at?: string
        }
        Update: {
          api_key?: string
          api_key_test?: string | null
          brand_api_url?: string | null
          brand_api_url_test?: string | null
          created_at?: string
          customer_api_url?: string
          customer_api_url_test?: string | null
          id?: string
          is_active?: boolean
          is_production_mode?: boolean
          payment_method_api_url?: string | null
          payment_method_api_url_test?: string | null
          product_api_url?: string | null
          product_api_url_test?: string | null
          purchase_order_api_url?: string | null
          purchase_order_api_url_test?: string | null
          sales_order_api_url?: string | null
          sales_order_api_url_test?: string | null
          supplier_api_url?: string | null
          supplier_api_url_test?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      odoo_sync_run_details: {
        Row: {
          brand_name: string | null
          created_at: string
          customer_phone: string | null
          error_message: string | null
          id: string
          order_date: string | null
          order_error_message: string | null
          order_number: string
          order_sync_failed: boolean | null
          original_orders: string[] | null
          payment_brand: string | null
          payment_method: string | null
          product_names: string | null
          purchase_error_message: string | null
          purchase_sync_failed: boolean | null
          run_id: string
          step_brand: string | null
          step_customer: string | null
          step_order: string | null
          step_product: string | null
          step_purchase: string | null
          sync_status: string
          total_amount: number | null
        }
        Insert: {
          brand_name?: string | null
          created_at?: string
          customer_phone?: string | null
          error_message?: string | null
          id?: string
          order_date?: string | null
          order_error_message?: string | null
          order_number: string
          order_sync_failed?: boolean | null
          original_orders?: string[] | null
          payment_brand?: string | null
          payment_method?: string | null
          product_names?: string | null
          purchase_error_message?: string | null
          purchase_sync_failed?: boolean | null
          run_id: string
          step_brand?: string | null
          step_customer?: string | null
          step_order?: string | null
          step_product?: string | null
          step_purchase?: string | null
          sync_status: string
          total_amount?: number | null
        }
        Update: {
          brand_name?: string | null
          created_at?: string
          customer_phone?: string | null
          error_message?: string | null
          id?: string
          order_date?: string | null
          order_error_message?: string | null
          order_number?: string
          order_sync_failed?: boolean | null
          original_orders?: string[] | null
          payment_brand?: string | null
          payment_method?: string | null
          product_names?: string | null
          purchase_error_message?: string | null
          purchase_sync_failed?: boolean | null
          run_id?: string
          step_brand?: string | null
          step_customer?: string | null
          step_order?: string | null
          step_product?: string | null
          step_purchase?: string | null
          sync_status?: string
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "odoo_sync_run_details_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "odoo_sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      odoo_sync_runs: {
        Row: {
          created_at: string
          created_by: string | null
          end_time: string | null
          failed_orders: number
          from_date: string
          id: string
          run_date: string
          skipped_orders: number
          start_time: string
          status: string
          successful_orders: number
          to_date: string
          total_orders: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          failed_orders?: number
          from_date: string
          id?: string
          run_date?: string
          skipped_orders?: number
          start_time: string
          status?: string
          successful_orders?: number
          to_date: string
          total_orders?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          failed_orders?: number
          from_date?: string
          id?: string
          run_date?: string
          skipped_orders?: number
          start_time?: string
          status?: string
          successful_orders?: number
          to_date?: string
          total_orders?: number
          updated_at?: string
        }
        Relationships: []
      }
      official_holidays: {
        Row: {
          country: string | null
          created_at: string
          description: string | null
          holiday_date: string
          holiday_name: string
          holiday_name_ar: string | null
          id: string
          is_recurring: boolean
          religion: string | null
          updated_at: string
          year: number | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          description?: string | null
          holiday_date: string
          holiday_name: string
          holiday_name_ar?: string | null
          id?: string
          is_recurring?: boolean
          religion?: string | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          country?: string | null
          created_at?: string
          description?: string | null
          holiday_date?: string
          holiday_name?: string
          holiday_name_ar?: string | null
          id?: string
          is_recurring?: boolean
          religion?: string | null
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
      order_payment: {
        Row: {
          create_at: string | null
          created_at: string
          created_at_int: number | null
          id: string
          ordernumber: string | null
          paymentrefrence: string | null
          updated_at: string
        }
        Insert: {
          create_at?: string | null
          created_at?: string
          created_at_int?: number | null
          id?: string
          ordernumber?: string | null
          paymentrefrence?: string | null
          updated_at?: string
        }
        Update: {
          create_at?: string | null
          created_at?: string
          created_at_int?: number | null
          id?: string
          ordernumber?: string | null
          paymentrefrence?: string | null
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
          order_date_int: number | null
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
          order_date_int?: number | null
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
          order_date_int?: number | null
          order_number?: string
          payment_brand?: string | null
          payment_method?: string | null
          payment_type?: string | null
          total?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      password_access_logs: {
        Row: {
          access_type: string
          accessed_record_id: string | null
          accessed_table: string
          created_at: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string
        }
        Insert: {
          access_type?: string
          accessed_record_id?: string | null
          accessed_table: string
          created_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id: string
        }
        Update: {
          access_type?: string
          accessed_record_id?: string | null
          accessed_table?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          bank_id: string | null
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
          bank_id?: string | null
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
          bank_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "payment_methods_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
        ]
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
          non_stock: boolean
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
          non_stock?: boolean
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
          non_stock?: boolean
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
          avatar_url: string | null
          can_view_all_tickets: boolean | null
          created_at: string
          default_department_id: string | null
          email: string
          email_password: string | null
          id: string
          is_active: boolean
          job_position_id: string | null
          mail_type_id: string | null
          mobile_number: string | null
          must_change_password: boolean
          salesman_code: string | null
          transaction_column_order: Json | null
          transaction_column_visibility: Json | null
          transaction_group_by: Json | null
          updated_at: string
          user_id: string
          user_name: string
        }
        Insert: {
          avatar_url?: string | null
          can_view_all_tickets?: boolean | null
          created_at?: string
          default_department_id?: string | null
          email: string
          email_password?: string | null
          id?: string
          is_active?: boolean
          job_position_id?: string | null
          mail_type_id?: string | null
          mobile_number?: string | null
          must_change_password?: boolean
          salesman_code?: string | null
          transaction_column_order?: Json | null
          transaction_column_visibility?: Json | null
          transaction_group_by?: Json | null
          updated_at?: string
          user_id: string
          user_name: string
        }
        Update: {
          avatar_url?: string | null
          can_view_all_tickets?: boolean | null
          created_at?: string
          default_department_id?: string | null
          email?: string
          email_password?: string | null
          id?: string
          is_active?: boolean
          job_position_id?: string | null
          mail_type_id?: string | null
          mobile_number?: string | null
          must_change_password?: boolean
          salesman_code?: string | null
          transaction_column_order?: Json | null
          transaction_column_visibility?: Json | null
          transaction_group_by?: Json | null
          updated_at?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_department_id_fkey"
            columns: ["default_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_job_position_id_fkey"
            columns: ["job_position_id"]
            isOneToOne: false
            referencedRelation: "job_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_mail_type_id_fkey"
            columns: ["mail_type_id"]
            isOneToOne: false
            referencedRelation: "mail_types"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          created_by: string
          department_id: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          department_id: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          department_id?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          item_code: string | null
          item_name: string
          item_name_ar: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          item_code?: string | null
          item_name: string
          item_name_ar?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          item_code?: string | null
          item_name?: string
          item_name_ar?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purpletransaction: {
        Row: {
          bank_fee: number | null
          brand_code: string | null
          brand_name: string | null
          coins_number: number | null
          company: string | null
          cost_price: number | null
          cost_sold: number | null
          created_at: string
          created_at_date: string | null
          created_at_date_int: number | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          is_deleted: boolean
          order_number: string | null
          order_status: string | null
          payment_brand: string | null
          payment_method: string | null
          payment_type: string | null
          product_id: string | null
          product_name: string | null
          profit: number | null
          qty: number | null
          sendodoo: boolean | null
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
          company?: string | null
          cost_price?: number | null
          cost_sold?: number | null
          created_at?: string
          created_at_date?: string | null
          created_at_date_int?: number | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          is_deleted?: boolean
          order_number?: string | null
          order_status?: string | null
          payment_brand?: string | null
          payment_method?: string | null
          payment_type?: string | null
          product_id?: string | null
          product_name?: string | null
          profit?: number | null
          qty?: number | null
          sendodoo?: boolean | null
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
          company?: string | null
          cost_price?: number | null
          cost_sold?: number | null
          created_at?: string
          created_at_date?: string | null
          created_at_date_int?: number | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          is_deleted?: boolean
          order_number?: string | null
          order_status?: string | null
          payment_brand?: string | null
          payment_method?: string | null
          payment_type?: string | null
          product_id?: string | null
          product_name?: string | null
          profit?: number | null
          qty?: number | null
          sendodoo?: boolean | null
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
      riyadbankstatement: {
        Row: {
          acquirer_private_data: string | null
          agg_fee: string | null
          agg_vat: string | null
          auth_code: string | null
          card_number: string | null
          card_type: string | null
          created_at: string
          fee: string | null
          id: string
          merchant_account: string | null
          merchant_name: string | null
          net_amount: string | null
          payment_date: string | null
          payment_number: string | null
          payment_reference: string | null
          posting_date: string | null
          rb_fee: string | null
          rb_vat: string | null
          terminal_id: string | null
          txn_amount: string | null
          txn_certificate: string | null
          txn_date: string | null
          txn_date_only: string | null
          txn_number: string | null
          txn_type: string | null
          updated_at: string
          vat: string | null
          vat_2: string | null
        }
        Insert: {
          acquirer_private_data?: string | null
          agg_fee?: string | null
          agg_vat?: string | null
          auth_code?: string | null
          card_number?: string | null
          card_type?: string | null
          created_at?: string
          fee?: string | null
          id?: string
          merchant_account?: string | null
          merchant_name?: string | null
          net_amount?: string | null
          payment_date?: string | null
          payment_number?: string | null
          payment_reference?: string | null
          posting_date?: string | null
          rb_fee?: string | null
          rb_vat?: string | null
          terminal_id?: string | null
          txn_amount?: string | null
          txn_certificate?: string | null
          txn_date?: string | null
          txn_date_only?: string | null
          txn_number?: string | null
          txn_type?: string | null
          updated_at?: string
          vat?: string | null
          vat_2?: string | null
        }
        Update: {
          acquirer_private_data?: string | null
          agg_fee?: string | null
          agg_vat?: string | null
          auth_code?: string | null
          card_number?: string | null
          card_type?: string | null
          created_at?: string
          fee?: string | null
          id?: string
          merchant_account?: string | null
          merchant_name?: string | null
          net_amount?: string | null
          payment_date?: string | null
          payment_number?: string | null
          payment_reference?: string | null
          posting_date?: string | null
          rb_fee?: string | null
          rb_vat?: string | null
          terminal_id?: string | null
          txn_amount?: string | null
          txn_certificate?: string | null
          txn_date?: string | null
          txn_date_only?: string | null
          txn_number?: string | null
          txn_type?: string | null
          updated_at?: string
          vat?: string | null
          vat_2?: string | null
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
          is_point: boolean | null
          media: string | null
          order_date: string
          order_number: string
          payment_term: string | null
          player_id: string | null
          point_value: number | null
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
          is_point?: boolean | null
          media?: string | null
          order_date: string
          order_number: string
          payment_term?: string | null
          player_id?: string | null
          point_value?: number | null
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
          is_point?: boolean | null
          media?: string | null
          order_date?: string
          order_number?: string
          payment_term?: string | null
          player_id?: string | null
          point_value?: number | null
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
      saved_attendance: {
        Row: {
          attendance_date: string
          batch_id: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          deduction_amount: number | null
          deduction_rule_id: string | null
          difference_hours: number | null
          employee_code: string
          expected_hours: number | null
          filter_from_date: string | null
          filter_to_date: string | null
          id: string
          in_time: string | null
          is_confirmed: boolean | null
          notes: string | null
          out_time: string | null
          record_status: string | null
          saved_at: string
          saved_by: string
          total_hours: number | null
          updated_at: string
          updated_by: string | null
          vacation_type: string | null
        }
        Insert: {
          attendance_date: string
          batch_id?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          deduction_amount?: number | null
          deduction_rule_id?: string | null
          difference_hours?: number | null
          employee_code: string
          expected_hours?: number | null
          filter_from_date?: string | null
          filter_to_date?: string | null
          id?: string
          in_time?: string | null
          is_confirmed?: boolean | null
          notes?: string | null
          out_time?: string | null
          record_status?: string | null
          saved_at?: string
          saved_by: string
          total_hours?: number | null
          updated_at?: string
          updated_by?: string | null
          vacation_type?: string | null
        }
        Update: {
          attendance_date?: string
          batch_id?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          deduction_amount?: number | null
          deduction_rule_id?: string | null
          difference_hours?: number | null
          employee_code?: string
          expected_hours?: number | null
          filter_from_date?: string | null
          filter_to_date?: string | null
          id?: string
          in_time?: string | null
          is_confirmed?: boolean | null
          notes?: string | null
          out_time?: string | null
          record_status?: string | null
          saved_at?: string
          saved_by?: string
          total_hours?: number | null
          updated_at?: string
          updated_by?: string | null
          vacation_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_attendance_deduction_rule_id_fkey"
            columns: ["deduction_rule_id"]
            isOneToOne: false
            referencedRelation: "deduction_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      security_alert_config: {
        Row: {
          alert_recipients: string[] | null
          alert_type: string
          created_at: string | null
          id: string
          is_enabled: boolean
          threshold: number
          time_window_minutes: number
          updated_at: string | null
        }
        Insert: {
          alert_recipients?: string[] | null
          alert_type: string
          created_at?: string | null
          id?: string
          is_enabled?: boolean
          threshold?: number
          time_window_minutes?: number
          updated_at?: string | null
        }
        Update: {
          alert_recipients?: string[] | null
          alert_type?: string
          created_at?: string | null
          id?: string
          is_enabled?: boolean
          threshold?: number
          time_window_minutes?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      security_alerts_sent: {
        Row: {
          alert_type: string
          details: Json | null
          id: string
          sent_at: string | null
          user_id: string | null
        }
        Insert: {
          alert_type: string
          details?: Json | null
          id?: string
          sent_at?: string | null
          user_id?: string | null
        }
        Update: {
          alert_type?: string
          details?: Json | null
          id?: string
          sent_at?: string | null
          user_id?: string | null
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
          opening_balance: number | null
          opening_image_path: string | null
          receipt_image_path: string | null
          shift_session_id: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          closing_balance?: number
          created_at?: string
          id?: string
          opening_balance?: number | null
          opening_image_path?: string | null
          receipt_image_path?: string | null
          shift_session_id: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          closing_balance?: number
          created_at?: string
          id?: string
          opening_balance?: number | null
          opening_image_path?: string | null
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
      shift_plan_details: {
        Row: {
          break_duration_minutes: number | null
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_off_day: boolean | null
          shift_plan_id: string
          start_time: string
        }
        Insert: {
          break_duration_minutes?: number | null
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_off_day?: boolean | null
          shift_plan_id: string
          start_time: string
        }
        Update: {
          break_duration_minutes?: number | null
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_off_day?: boolean | null
          shift_plan_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_plan_details_shift_plan_id_fkey"
            columns: ["shift_plan_id"]
            isOneToOne: false
            referencedRelation: "shift_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_plans: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          plan_name: string
          plan_name_ar: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          plan_name: string
          plan_name_ar?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          plan_name?: string
          plan_name_ar?: string | null
          updated_at?: string
        }
        Relationships: []
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
          admin_notes: string | null
          closed_at: string | null
          closing_notes: string | null
          created_at: string
          first_order_number: string | null
          id: string
          last_order_number: string | null
          opened_at: string
          salla_first_order_number: string | null
          salla_last_order_number: string | null
          shift_assignment_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          closed_at?: string | null
          closing_notes?: string | null
          created_at?: string
          first_order_number?: string | null
          id?: string
          last_order_number?: string | null
          opened_at?: string
          salla_first_order_number?: string | null
          salla_last_order_number?: string | null
          shift_assignment_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          closed_at?: string | null
          closing_notes?: string | null
          created_at?: string
          first_order_number?: string | null
          id?: string
          last_order_number?: string | null
          opened_at?: string
          salla_first_order_number?: string | null
          salla_last_order_number?: string | null
          shift_assignment_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_sessions_shift_assignment_id_fkey"
            columns: ["shift_assignment_id"]
            isOneToOne: true
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
      software_license_invoices: {
        Row: {
          ai_extraction_error: string | null
          ai_extraction_status: string | null
          cost_currency: string | null
          cost_sar: number | null
          created_at: string
          created_by: string | null
          extracted_cost: number | null
          file_name: string | null
          file_path: string
          id: string
          invoice_date: string
          license_id: string
          notes: string | null
        }
        Insert: {
          ai_extraction_error?: string | null
          ai_extraction_status?: string | null
          cost_currency?: string | null
          cost_sar?: number | null
          created_at?: string
          created_by?: string | null
          extracted_cost?: number | null
          file_name?: string | null
          file_path: string
          id?: string
          invoice_date: string
          license_id: string
          notes?: string | null
        }
        Update: {
          ai_extraction_error?: string | null
          ai_extraction_status?: string | null
          cost_currency?: string | null
          cost_sar?: number | null
          created_at?: string
          created_by?: string | null
          extracted_cost?: number | null
          file_name?: string | null
          file_path?: string
          id?: string
          invoice_date?: string
          license_id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "software_license_invoices_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "software_licenses"
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
          cost_center_id: string | null
          created_at: string
          created_by: string | null
          currency_id: string | null
          domain_name: string | null
          expiry_date: string | null
          id: string
          invoice_file_path: string | null
          license_key: string | null
          mails: string | null
          notes: string | null
          notification_days: number[] | null
          payment_method: string | null
          project_id: string | null
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
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          currency_id?: string | null
          domain_name?: string | null
          expiry_date?: string | null
          id?: string
          invoice_file_path?: string | null
          license_key?: string | null
          mails?: string | null
          notes?: string | null
          notification_days?: number[] | null
          payment_method?: string | null
          project_id?: string | null
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
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          currency_id?: string | null
          domain_name?: string | null
          expiry_date?: string | null
          id?: string
          invoice_file_path?: string | null
          license_key?: string | null
          mails?: string | null
          notes?: string | null
          notification_days?: number[] | null
          payment_method?: string | null
          project_id?: string | null
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
            foreignKeyName: "software_licenses_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "software_licenses_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "software_licenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
          partner_profile_id: number | null
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
          partner_profile_id?: number | null
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
          partner_profile_id?: number | null
          status?: string
          supplier_code?: string
          supplier_email?: string | null
          supplier_name?: string
          supplier_phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      system_backups: {
        Row: {
          backup_type: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_message: string | null
          file_name: string
          file_path: string
          file_size: number | null
          force_kill: boolean | null
          id: string
          parent_backup_id: string | null
          progress_percent: number | null
          progress_phase: string | null
          rows_processed: number | null
          rows_total: number | null
          status: string
          tables_processed: number | null
          tables_total: number | null
        }
        Insert: {
          backup_type: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          force_kill?: boolean | null
          id?: string
          parent_backup_id?: string | null
          progress_percent?: number | null
          progress_phase?: string | null
          rows_processed?: number | null
          rows_total?: number | null
          status?: string
          tables_processed?: number | null
          tables_total?: number | null
        }
        Update: {
          backup_type?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          force_kill?: boolean | null
          id?: string
          parent_backup_id?: string | null
          progress_percent?: number | null
          progress_phase?: string | null
          rows_processed?: number | null
          rows_total?: number | null
          status?: string
          tables_processed?: number | null
          tables_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "system_backups_parent_backup_id_fkey"
            columns: ["parent_backup_id"]
            isOneToOne: false
            referencedRelation: "system_backups"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      task_time_entries: {
        Row: {
          created_at: string
          duration_minutes: number | null
          end_time: string | null
          id: string
          notes: string | null
          start_time: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          notes?: string | null
          start_time?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          notes?: string | null
          start_time?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string
          created_at: string
          created_by: string
          deadline: string | null
          department_id: string
          dependency_task_id: string | null
          description: string | null
          end_time: string | null
          external_links: string[] | null
          file_attachments: Json | null
          id: string
          is_milestone: boolean
          priority: string
          project_id: string | null
          seq_number: number
          start_date: string | null
          start_time: string | null
          status: string
          ticket_id: string | null
          title: string
          updated_at: string
          video_attachments: Json | null
        }
        Insert: {
          assigned_to: string
          created_at?: string
          created_by: string
          deadline?: string | null
          department_id: string
          dependency_task_id?: string | null
          description?: string | null
          end_time?: string | null
          external_links?: string[] | null
          file_attachments?: Json | null
          id?: string
          is_milestone?: boolean
          priority?: string
          project_id?: string | null
          seq_number?: number
          start_date?: string | null
          start_time?: string | null
          status?: string
          ticket_id?: string | null
          title: string
          updated_at?: string
          video_attachments?: Json | null
        }
        Update: {
          assigned_to?: string
          created_at?: string
          created_by?: string
          deadline?: string | null
          department_id?: string
          dependency_task_id?: string | null
          description?: string | null
          end_time?: string | null
          external_links?: string[] | null
          file_attachments?: Json | null
          id?: string
          is_milestone?: boolean
          priority?: string
          project_id?: string | null
          seq_number?: number
          start_date?: string | null
          start_time?: string | null
          status?: string
          ticket_id?: string | null
          title?: string
          updated_at?: string
          video_attachments?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_dependency_task_id_fkey"
            columns: ["dependency_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
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
      testbrands: {
        Row: {
          brand_code: string | null
          brand_name: string | null
          brand_parent: string | null
          created_at: string
          id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          brand_code?: string | null
          brand_name?: string | null
          brand_parent?: string | null
          created_at?: string
          id?: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          brand_code?: string | null
          brand_name?: string | null
          brand_parent?: string | null
          created_at?: string
          id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      testcustomers: {
        Row: {
          block_reason: string | null
          created_at: string
          customer_group: string | null
          customer_name: string | null
          customer_phone: string | null
          email: string | null
          id: string
          is_blocked: boolean | null
          last_transaction: string | null
          register_date: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          block_reason?: string | null
          created_at?: string
          customer_group?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          email?: string | null
          id?: string
          is_blocked?: boolean | null
          last_transaction?: string | null
          register_date?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          block_reason?: string | null
          created_at?: string
          customer_group?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          email?: string | null
          id?: string
          is_blocked?: boolean | null
          last_transaction?: string | null
          register_date?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      testpayment: {
        Row: {
          bank_transaction_id: string | null
          created_at: string
          id: string
          order_number: string | null
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
          order_number?: string | null
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
          order_number?: string | null
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
      testproducts: {
        Row: {
          brand_code: string | null
          created_at: string
          id: string
          maximum_order_quantity: number | null
          meta_description_ar: string | null
          meta_description_en: string | null
          meta_keywords_ar: string | null
          meta_keywords_en: string | null
          meta_title_ar: string | null
          meta_title_en: string | null
          minimum_order_quantity: number | null
          product_cost: string | null
          product_id: string | null
          product_name: string | null
          product_price: string | null
          reorder_point: number | null
          sku: string | null
          uom: string | null
          updated_at: string
        }
        Insert: {
          brand_code?: string | null
          created_at?: string
          id?: string
          maximum_order_quantity?: number | null
          meta_description_ar?: string | null
          meta_description_en?: string | null
          meta_keywords_ar?: string | null
          meta_keywords_en?: string | null
          meta_title_ar?: string | null
          meta_title_en?: string | null
          minimum_order_quantity?: number | null
          product_cost?: string | null
          product_id?: string | null
          product_name?: string | null
          product_price?: string | null
          reorder_point?: number | null
          sku?: string | null
          uom?: string | null
          updated_at?: string
        }
        Update: {
          brand_code?: string | null
          created_at?: string
          id?: string
          maximum_order_quantity?: number | null
          meta_description_ar?: string | null
          meta_description_en?: string | null
          meta_keywords_ar?: string | null
          meta_keywords_en?: string | null
          meta_title_ar?: string | null
          meta_title_en?: string | null
          minimum_order_quantity?: number | null
          product_cost?: string | null
          product_id?: string | null
          product_name?: string | null
          product_price?: string | null
          reorder_point?: number | null
          sku?: string | null
          uom?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      testsalesheader: {
        Row: {
          company: string | null
          created_at: string
          customer_ip: string | null
          customer_phone: string | null
          device_fingerprint: string | null
          id: string
          is_point: boolean | null
          media: string | null
          order_date: string | null
          order_number: string | null
          payment_term: string | null
          player_id: string | null
          point_value: number | null
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
          customer_phone?: string | null
          device_fingerprint?: string | null
          id?: string
          is_point?: boolean | null
          media?: string | null
          order_date?: string | null
          order_number?: string | null
          payment_term?: string | null
          player_id?: string | null
          point_value?: number | null
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
          customer_phone?: string | null
          device_fingerprint?: string | null
          id?: string
          is_point?: boolean | null
          media?: string | null
          order_date?: string | null
          order_number?: string | null
          payment_term?: string | null
          player_id?: string | null
          point_value?: number | null
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
      testsalesline: {
        Row: {
          coins_number: number | null
          cost_price: number | null
          created_at: string
          id: string
          line_number: number | null
          line_status: number | null
          order_number: string | null
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
          line_number?: number | null
          line_status?: number | null
          order_number?: string | null
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
          line_number?: number | null
          line_status?: number | null
          order_number?: string | null
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
      testsupplierproducts: {
        Row: {
          created_at: string
          date_from: string | null
          date_to: string | null
          id: string
          price: number | null
          sku: string | null
          supplier_code: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          id?: string
          price?: number | null
          sku?: string | null
          supplier_code?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          id?: string
          price?: number | null
          sku?: string | null
          supplier_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      testsuppliers: {
        Row: {
          created_at: string
          id: string
          status: number | null
          supplier_code: string | null
          supplier_email: string | null
          supplier_name: string | null
          supplier_phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: number | null
          supplier_code?: string | null
          supplier_email?: string | null
          supplier_name?: string | null
          supplier_phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: number | null
          supplier_code?: string | null
          supplier_email?: string | null
          supplier_name?: string | null
          supplier_phone?: string | null
          updated_at?: string
        }
        Relationships: []
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
      ticket_cc_users: {
        Row: {
          created_at: string
          id: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_cc_users_ticket_id_fkey"
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
          budget_value: number | null
          cost_center_id: string | null
          created_at: string
          currency_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          department_id: string
          description: string
          external_link: string | null
          id: string
          is_deleted: boolean
          is_purchase_ticket: boolean
          item_id: string | null
          next_admin_order: number | null
          priority: string
          purchase_type: string | null
          qty: number | null
          status: string
          subject: string
          ticket_number: string
          uom: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          budget_value?: number | null
          cost_center_id?: string | null
          created_at?: string
          currency_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          department_id: string
          description: string
          external_link?: string | null
          id?: string
          is_deleted?: boolean
          is_purchase_ticket?: boolean
          item_id?: string | null
          next_admin_order?: number | null
          priority: string
          purchase_type?: string | null
          qty?: number | null
          status?: string
          subject: string
          ticket_number: string
          uom?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          budget_value?: number | null
          cost_center_id?: string | null
          created_at?: string
          currency_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          department_id?: string
          description?: string
          external_link?: string | null
          id?: string
          is_deleted?: boolean
          is_purchase_ticket?: boolean
          item_id?: string | null
          next_admin_order?: number | null
          priority?: string
          purchase_type?: string | null
          qty?: number | null
          status?: string
          subject?: string
          ticket_number?: string
          uom?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "purchase_items"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheets: {
        Row: {
          absence_reason: string | null
          actual_end: string | null
          actual_start: string | null
          approved_at: string | null
          approved_by: string | null
          break_duration_minutes: number | null
          created_at: string
          deduction_amount: number | null
          early_leave_minutes: number | null
          employee_id: string
          id: string
          is_absent: boolean | null
          late_minutes: number | null
          notes: string | null
          overtime_amount: number | null
          overtime_minutes: number | null
          scheduled_end: string | null
          scheduled_start: string | null
          status: string
          total_work_minutes: number | null
          updated_at: string
          work_date: string
        }
        Insert: {
          absence_reason?: string | null
          actual_end?: string | null
          actual_start?: string | null
          approved_at?: string | null
          approved_by?: string | null
          break_duration_minutes?: number | null
          created_at?: string
          deduction_amount?: number | null
          early_leave_minutes?: number | null
          employee_id: string
          id?: string
          is_absent?: boolean | null
          late_minutes?: number | null
          notes?: string | null
          overtime_amount?: number | null
          overtime_minutes?: number | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          status?: string
          total_work_minutes?: number | null
          updated_at?: string
          work_date: string
        }
        Update: {
          absence_reason?: string | null
          actual_end?: string | null
          actual_start?: string | null
          approved_at?: string | null
          approved_by?: string | null
          break_duration_minutes?: number | null
          created_at?: string
          deduction_amount?: number | null
          early_leave_minutes?: number | null
          employee_id?: string
          id?: string
          is_absent?: boolean | null
          late_minutes?: number | null
          notes?: string | null
          overtime_amount?: number | null
          overtime_minutes?: number | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          status?: string
          total_work_minutes?: number | null
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      treasuries: {
        Row: {
          created_at: string | null
          created_by: string | null
          currency_id: string | null
          current_balance: number | null
          department_id: string | null
          id: string
          is_active: boolean | null
          max_balance: number | null
          notes: string | null
          opening_balance: number | null
          responsible_user_id: string | null
          treasury_code: string
          treasury_name: string
          treasury_name_ar: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          currency_id?: string | null
          current_balance?: number | null
          department_id?: string | null
          id?: string
          is_active?: boolean | null
          max_balance?: number | null
          notes?: string | null
          opening_balance?: number | null
          responsible_user_id?: string | null
          treasury_code: string
          treasury_name: string
          treasury_name_ar?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          currency_id?: string | null
          current_balance?: number | null
          department_id?: string | null
          id?: string
          is_active?: boolean | null
          max_balance?: number | null
          notes?: string | null
          opening_balance?: number | null
          responsible_user_id?: string | null
          treasury_code?: string
          treasury_name?: string
          treasury_name_ar?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treasuries_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasuries_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_entries: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          balance_after: number | null
          balance_before: number | null
          bank_charges: number | null
          converted_amount: number | null
          cost_center_id: string | null
          created_at: string | null
          created_by: string
          description: string | null
          entry_date: string | null
          entry_number: string
          entry_type: string
          exchange_rate: number | null
          expense_request_id: string | null
          from_currency_id: string | null
          id: string
          other_charges: number | null
          posted_at: string | null
          posted_by: string | null
          reference_id: string | null
          reference_type: string | null
          status: string | null
          to_bank_id: string | null
          to_currency_id: string | null
          to_treasury_id: string | null
          transfer_type: string | null
          treasury_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          balance_after?: number | null
          balance_before?: number | null
          bank_charges?: number | null
          converted_amount?: number | null
          cost_center_id?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          entry_date?: string | null
          entry_number: string
          entry_type: string
          exchange_rate?: number | null
          expense_request_id?: string | null
          from_currency_id?: string | null
          id?: string
          other_charges?: number | null
          posted_at?: string | null
          posted_by?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string | null
          to_bank_id?: string | null
          to_currency_id?: string | null
          to_treasury_id?: string | null
          transfer_type?: string | null
          treasury_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          balance_after?: number | null
          balance_before?: number | null
          bank_charges?: number | null
          converted_amount?: number | null
          cost_center_id?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          entry_date?: string | null
          entry_number?: string
          entry_type?: string
          exchange_rate?: number | null
          expense_request_id?: string | null
          from_currency_id?: string | null
          id?: string
          other_charges?: number | null
          posted_at?: string | null
          posted_by?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string | null
          to_bank_id?: string | null
          to_currency_id?: string | null
          to_treasury_id?: string | null
          transfer_type?: string | null
          treasury_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treasury_entries_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_entries_expense_request_id_fkey"
            columns: ["expense_request_id"]
            isOneToOne: false
            referencedRelation: "expense_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_entries_from_currency_id_fkey"
            columns: ["from_currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_entries_to_bank_id_fkey"
            columns: ["to_bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_entries_to_currency_id_fkey"
            columns: ["to_currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_entries_to_treasury_id_fkey"
            columns: ["to_treasury_id"]
            isOneToOne: false
            referencedRelation: "treasuries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_entries_treasury_id_fkey"
            columns: ["treasury_id"]
            isOneToOne: false
            referencedRelation: "treasuries"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_ledger: {
        Row: {
          balance_after: number | null
          bank_id: string | null
          created_at: string
          created_by: string | null
          credit_amount: number | null
          currency_id: string | null
          debit_amount: number | null
          description: string | null
          entry_date: string
          exchange_rate: number | null
          id: string
          reference_id: string
          reference_number: string | null
          reference_type: string
          treasury_id: string | null
        }
        Insert: {
          balance_after?: number | null
          bank_id?: string | null
          created_at?: string
          created_by?: string | null
          credit_amount?: number | null
          currency_id?: string | null
          debit_amount?: number | null
          description?: string | null
          entry_date?: string
          exchange_rate?: number | null
          id?: string
          reference_id: string
          reference_number?: string | null
          reference_type: string
          treasury_id?: string | null
        }
        Update: {
          balance_after?: number | null
          bank_id?: string | null
          created_at?: string
          created_by?: string | null
          credit_amount?: number | null
          currency_id?: string | null
          debit_amount?: number | null
          description?: string | null
          entry_date?: string
          exchange_rate?: number | null
          id?: string
          reference_id?: string
          reference_number?: string | null
          reference_type?: string
          treasury_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treasury_ledger_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_ledger_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_ledger_treasury_id_fkey"
            columns: ["treasury_id"]
            isOneToOne: false
            referencedRelation: "treasuries"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_opening_balances: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          entered_by: string
          fiscal_year: number
          id: string
          notes: string | null
          opening_date: string
          treasury_id: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          entered_by: string
          fiscal_year: number
          id?: string
          notes?: string | null
          opening_date: string
          treasury_id: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          entered_by?: string
          fiscal_year?: number
          id?: string
          notes?: string | null
          opening_date?: string
          treasury_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treasury_opening_balances_treasury_id_fkey"
            columns: ["treasury_id"]
            isOneToOne: false
            referencedRelation: "treasuries"
            referencedColumns: ["id"]
          },
        ]
      }
      uom: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          uom_code: string
          uom_name: string
          uom_name_ar: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          uom_code: string
          uom_name: string
          uom_name_ar?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          uom_code?: string
          uom_name?: string
          uom_name_ar?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      upload_logs: {
        Row: {
          created_at: string
          date_range_end: string | null
          date_range_start: string | null
          duplicate_records_count: number | null
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
          duplicate_records_count?: number | null
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
          duplicate_records_count?: number | null
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
      user_certificates: {
        Row: {
          certificate_hash: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          is_active: boolean
          issued_at: string
          revoked_at: string | null
          revoked_reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          certificate_hash: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean
          issued_at?: string
          revoked_at?: string | null
          revoked_reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          certificate_hash?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean
          issued_at?: string
          revoked_at?: string | null
          revoked_reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_device_activations: {
        Row: {
          activated_at: string
          certificate_id: string | null
          created_at: string
          deactivated_at: string | null
          device_fingerprint: string
          device_info: Json | null
          device_name: string | null
          id: string
          is_active: boolean
          last_login_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string
          certificate_id?: string | null
          created_at?: string
          deactivated_at?: string | null
          device_fingerprint: string
          device_info?: Json | null
          device_name?: string | null
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string
          certificate_id?: string | null
          created_at?: string
          deactivated_at?: string | null
          device_fingerprint?: string
          device_info?: Json | null
          device_name?: string | null
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_device_activations_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "user_certificates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_email_configs: {
        Row: {
          created_at: string
          display_name: string | null
          email_address: string
          email_password: string
          email_username: string
          id: string
          imap_host: string
          imap_port: number
          imap_secure: boolean
          is_active: boolean
          last_sync_at: string | null
          smtp_host: string
          smtp_port: number
          smtp_secure: boolean
          sync_error: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email_address: string
          email_password: string
          email_username: string
          id?: string
          imap_host: string
          imap_port?: number
          imap_secure?: boolean
          is_active?: boolean
          last_sync_at?: string | null
          smtp_host: string
          smtp_port?: number
          smtp_secure?: boolean
          sync_error?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email_address?: string
          email_password?: string
          email_username?: string
          id?: string
          imap_host?: string
          imap_port?: number
          imap_secure?: boolean
          is_active?: boolean
          last_sync_at?: string | null
          smtp_host?: string
          smtp_port?: number
          smtp_secure?: boolean
          sync_error?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_emails: {
        Row: {
          created_at: string
          description: string | null
          email: string
          host: string
          id: string
          is_active: boolean | null
          last_checked_at: string | null
          last_error: string | null
          owner: string | null
          password: string | null
          updated_at: string
          user_id: string | null
          user_name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          email: string
          host?: string
          id?: string
          is_active?: boolean | null
          last_checked_at?: string | null
          last_error?: string | null
          owner?: string | null
          password?: string | null
          updated_at?: string
          user_id?: string | null
          user_name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          email?: string
          host?: string
          id?: string
          is_active?: boolean | null
          last_checked_at?: string | null
          last_error?: string | null
          owner?: string | null
          password?: string | null
          updated_at?: string
          user_id?: string | null
          user_name?: string
        }
        Relationships: []
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
      user_logins: {
        Row: {
          application: string
          created_at: string
          created_by: string | null
          description: string | null
          google_account: string | null
          id: string
          needs_otp: boolean
          otp_mobile_number: string | null
          password: string | null
          updated_at: string
          user_name: string | null
          website: string | null
        }
        Insert: {
          application: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          google_account?: string | null
          id?: string
          needs_otp?: boolean
          otp_mobile_number?: string | null
          password?: string | null
          updated_at?: string
          user_name?: string | null
          website?: string | null
        }
        Update: {
          application?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          google_account?: string | null
          id?: string
          needs_otp?: boolean
          otp_mobile_number?: string | null
          password?: string | null
          updated_at?: string
          user_name?: string | null
          website?: string | null
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
      vacation_codes: {
        Row: {
          code: string
          created_at: string
          default_days: number
          description: string | null
          id: string
          is_active: boolean
          is_paid: boolean
          name_ar: string | null
          name_en: string
          requires_approval: boolean
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          default_days?: number
          description?: string | null
          id?: string
          is_active?: boolean
          is_paid?: boolean
          name_ar?: string | null
          name_en: string
          requires_approval?: boolean
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          default_days?: number
          description?: string | null
          id?: string
          is_active?: boolean
          is_paid?: boolean
          name_ar?: string | null
          name_en?: string
          requires_approval?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      vacation_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          employee_id: string
          end_date: string
          id: string
          reason: string | null
          rejection_reason: string | null
          start_date: string
          status: string
          total_days: number
          updated_at: string
          vacation_code_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          employee_id: string
          end_date: string
          id?: string
          reason?: string | null
          rejection_reason?: string | null
          start_date: string
          status?: string
          total_days: number
          updated_at?: string
          vacation_code_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          employee_id?: string
          end_date?: string
          id?: string
          reason?: string | null
          rejection_reason?: string | null
          start_date?: string
          status?: string
          total_days?: number
          updated_at?: string
          vacation_code_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacation_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacation_requests_vacation_code_id_fkey"
            columns: ["vacation_code_id"]
            isOneToOne: false
            referencedRelation: "vacation_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      void_payment_history: {
        Row: {
          created_at: string
          currency_code: string | null
          description: string | null
          expense_request_id: string
          id: string
          original_amount: number
          original_paid_at: string | null
          reason: string | null
          request_number: string
          treasury_amount: number | null
          treasury_currency_code: string | null
          treasury_entry_number: string | null
          treasury_id: string | null
          treasury_name: string | null
          void_number: string
          voided_at: string
          voided_by: string
          voided_by_name: string | null
        }
        Insert: {
          created_at?: string
          currency_code?: string | null
          description?: string | null
          expense_request_id: string
          id?: string
          original_amount: number
          original_paid_at?: string | null
          reason?: string | null
          request_number: string
          treasury_amount?: number | null
          treasury_currency_code?: string | null
          treasury_entry_number?: string | null
          treasury_id?: string | null
          treasury_name?: string | null
          void_number: string
          voided_at?: string
          voided_by: string
          voided_by_name?: string | null
        }
        Update: {
          created_at?: string
          currency_code?: string | null
          description?: string | null
          expense_request_id?: string
          id?: string
          original_amount?: number
          original_paid_at?: string | null
          reason?: string | null
          request_number?: string
          treasury_amount?: number | null
          treasury_currency_code?: string | null
          treasury_entry_number?: string | null
          treasury_id?: string | null
          treasury_name?: string | null
          void_number?: string
          voided_at?: string
          voided_by?: string
          voided_by_name?: string | null
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
      zk_attendance_logs: {
        Row: {
          api_key_id: string | null
          attendance_date: string
          attendance_time: string
          created_at: string
          employee_code: string
          id: string
          is_processed: boolean | null
          processed_at: string | null
          raw_data: Json | null
          record_type: string | null
        }
        Insert: {
          api_key_id?: string | null
          attendance_date: string
          attendance_time: string
          created_at?: string
          employee_code: string
          id?: string
          is_processed?: boolean | null
          processed_at?: string | null
          raw_data?: Json | null
          record_type?: string | null
        }
        Update: {
          api_key_id?: string | null
          attendance_date?: string
          attendance_time?: string
          created_at?: string
          employee_code?: string
          id?: string
          is_processed?: boolean | null
          processed_at?: string | null
          raw_data?: Json | null
          record_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zk_attendance_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
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
      check_and_run_scheduled_backup: { Args: never; Returns: undefined }
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
      decrypt_email_password: {
        Args: { encrypted_password: string }
        Returns: string
      }
      decrypt_email_password_aes: {
        Args: { encrypted_password: string }
        Returns: string
      }
      detect_bulk_password_access: {
        Args: { p_threshold?: number; p_time_window_minutes?: number }
        Returns: {
          access_count: number
          first_access: string
          last_access: string
          user_email: string
          user_id: string
        }[]
      }
      detect_new_user_password_access: {
        Args: { p_time_window_minutes?: number }
        Returns: {
          access_count: number
          user_created_at: string
          user_email: string
          user_id: string
        }[]
      }
      encrypt_email_password: {
        Args: { plain_password: string }
        Returns: string
      }
      encrypt_email_password_aes: {
        Args: { plain_password: string }
        Returns: string
      }
      exec_sql: { Args: { sql: string }; Returns: undefined }
      find_or_create_direct_conversation: {
        Args: { other_user_id: string }
        Returns: string
      }
      format_date_to_int: { Args: { d: string }; Returns: number }
      generate_bank_entry_number: { Args: never; Returns: string }
      generate_expense_request_number: { Args: never; Returns: string }
      generate_ludo_order_number: { Args: never; Returns: string }
      generate_ticket_number: { Args: never; Returns: string }
      generate_treasury_entry_number: { Args: never; Returns: string }
      generate_void_number: { Args: never; Returns: string }
      get_audit_logs: {
        Args: {
          p_action?: string
          p_from_date?: string
          p_limit?: number
          p_table_name?: string
          p_to_date?: string
          p_user_id?: string
        }
        Returns: {
          action: string
          created_at: string
          id: string
          new_data: Json
          old_data: Json
          record_id: string
          table_name: string
          user_email: string
          user_id: string
        }[]
      }
      get_bank_balance_report: {
        Args: {
          p_bank_id: string
          p_from_date_int: number
          p_to_date_int: number
        }
        Returns: {
          description: string
          order_count: number
          payment_type: string
          total_amount: number
        }[]
      }
      get_cost_of_sales:
        | { Args: { date_from: string; date_to: string }; Returns: number }
        | {
            Args: { date_from: string; date_to: string; p_brand_name?: string }
            Returns: number
          }
      get_db_functions_info: {
        Args: never
        Returns: {
          function_definition: string
          function_name: string
        }[]
      }
      get_distinct_payment_methods: {
        Args: never
        Returns: {
          payment_method: string
        }[]
      }
      get_email_config_password: {
        Args: { config_id: string }
        Returns: string
      }
      get_epayment_charges:
        | { Args: { date_from: string; date_to: string }; Returns: number }
        | {
            Args: { date_from: string; date_to: string; p_brand_name?: string }
            Returns: number
          }
      get_foreign_keys_info: {
        Args: never
        Returns: {
          column_name: string
          constraint_name: string
          foreign_column_name: string
          foreign_table_name: string
          table_name: string
        }[]
      }
      get_indexes_info: {
        Args: never
        Returns: {
          indexdef: string
          indexname: string
          tablename: string
        }[]
      }
      get_my_email_password: { Args: never; Returns: string }
      get_next_task_seq_number: {
        Args: { p_department_id: string }
        Returns: number
      }
      get_password_access_logs: {
        Args: {
          p_from_date?: string
          p_limit?: number
          p_table_name?: string
          p_to_date?: string
          p_user_id?: string
        }
        Returns: {
          access_type: string
          accessed_record_id: string
          accessed_table: string
          created_at: string
          id: string
          user_email: string
          user_id: string
        }[]
      }
      get_points_summary:
        | {
            Args: { date_from: string; date_to: string }
            Returns: {
              total_cost: number
              total_sales: number
            }[]
          }
        | {
            Args: { date_from: string; date_to: string; p_brand_name?: string }
            Returns: {
              total_cost: number
              total_sales: number
            }[]
          }
      get_primary_keys_info: {
        Args: never
        Returns: {
          column_name: string
          table_name: string
        }[]
      }
      get_rls_policies_info: {
        Args: never
        Returns: {
          cmd: string
          permissive: string
          policyname: string
          qual: string
          roles: string
          tablename: string
          with_check: string
        }[]
      }
      get_table_columns_info: {
        Args: never
        Returns: {
          character_maximum_length: number
          column_default: string
          column_name: string
          data_type: string
          is_nullable: string
          numeric_precision: number
          numeric_scale: number
          ordinal_position: number
          table_name: string
          udt_name: string
        }[]
      }
      get_triggers_info: {
        Args: never
        Returns: {
          action_statement: string
          action_timing: string
          event_manipulation: string
          event_object_table: string
          trigger_name: string
        }[]
      }
      get_user_defined_types_info: {
        Args: never
        Returns: {
          base_type: string
          enum_values: string[]
          type_name: string
          type_schema: string
          type_type: string
        }[]
      }
      get_user_email_password: { Args: { email_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_conversation_participant: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: boolean
      }
      is_project_manager: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: boolean
      }
      is_project_member: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: boolean
      }
      log_password_access: {
        Args: { p_accessed_record_id?: string; p_accessed_table: string }
        Returns: undefined
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
      transactions_summary:
        | {
            Args: { date_from: string; date_to: string }
            Returns: {
              total_profit: number
              total_sales: number
              tx_count: number
            }[]
          }
        | {
            Args: { date_from: string; date_to: string; p_brand_name?: string }
            Returns: {
              total_profit: number
              total_sales: number
              tx_count: number
            }[]
          }
      update_bank_fees_from_payment_brand: { Args: never; Returns: number }
      update_ordertotals_bank_fees: { Args: never; Returns: number }
      update_ordertotals_bank_fees_by_brand:
        | { Args: { brand_name: string }; Returns: number }
        | { Args: { batch_size?: number; brand_name: string }; Returns: number }
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
      employment_status: "active" | "on_leave" | "terminated" | "suspended"
      shift_type: "fixed" | "rotating"
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
      employment_status: ["active", "on_leave", "terminated", "suspended"],
      shift_type: ["fixed", "rotating"],
    },
  },
} as const
