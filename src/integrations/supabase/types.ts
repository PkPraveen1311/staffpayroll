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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      advance_repayments: {
        Row: {
          advance_id: string
          amount: number
          created_at: string
          id: string
          notes: string | null
          repaid_on: string
          updated_at: string
        }
        Insert: {
          advance_id: string
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          repaid_on?: string
          updated_at?: string
        }
        Update: {
          advance_id?: string
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          repaid_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "advance_repayments_advance_id_fkey"
            columns: ["advance_id"]
            isOneToOne: false
            referencedRelation: "employee_advances"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_attendance: {
        Row: {
          agent_id: string
          created_at: string
          date: string
          hours: number
          id: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          date: string
          hours?: number
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          date?: string
          hours?: number
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_attendance_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "commission_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      allowed_week_offs: {
        Row: {
          allowed: number
          created_at: string
          employee_id: string
          id: string
          month: number
          updated_at: string
          year: number
        }
        Insert: {
          allowed?: number
          created_at?: string
          employee_id: string
          id?: string
          month: number
          updated_at?: string
          year: number
        }
        Update: {
          allowed?: number
          created_at?: string
          employee_id?: string
          id?: string
          month?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      attendance: {
        Row: {
          created_at: string
          date: string
          employee_id: string
          hours: number
          id: string
          notes: string | null
          status: string
        }
        Insert: {
          created_at?: string
          date: string
          employee_id: string
          hours?: number
          id?: string
          notes?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          date?: string
          employee_id?: string
          hours?: number
          id?: string
          notes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_agents: {
        Row: {
          aadhaar: string | null
          address: string | null
          agent_code: string
          bank_account: string | null
          bank_name: string | null
          created_at: string
          date_of_birth: string | null
          department: string | null
          designation: string | null
          email: string | null
          full_name: string
          id: string
          ifsc_code: string | null
          joining_date: string | null
          notes: string | null
          pan: string | null
          phone: string | null
          status: string
          tds_enabled: boolean
          updated_at: string
          wedding_anniversary: string | null
        }
        Insert: {
          aadhaar?: string | null
          address?: string | null
          agent_code: string
          bank_account?: string | null
          bank_name?: string | null
          created_at?: string
          date_of_birth?: string | null
          department?: string | null
          designation?: string | null
          email?: string | null
          full_name: string
          id?: string
          ifsc_code?: string | null
          joining_date?: string | null
          notes?: string | null
          pan?: string | null
          phone?: string | null
          status?: string
          tds_enabled?: boolean
          updated_at?: string
          wedding_anniversary?: string | null
        }
        Update: {
          aadhaar?: string | null
          address?: string | null
          agent_code?: string
          bank_account?: string | null
          bank_name?: string | null
          created_at?: string
          date_of_birth?: string | null
          department?: string | null
          designation?: string | null
          email?: string | null
          full_name?: string
          id?: string
          ifsc_code?: string | null
          joining_date?: string | null
          notes?: string | null
          pan?: string | null
          phone?: string | null
          status?: string
          tds_enabled?: boolean
          updated_at?: string
          wedding_anniversary?: string | null
        }
        Relationships: []
      }
      commission_payments: {
        Row: {
          agent_id: string
          created_at: string
          gross_amount: number
          id: string
          month: number | null
          net_amount: number
          notes: string | null
          paid_on: string
          tds_amount: number
          tds_rate: number
          updated_at: string
          year: number | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          gross_amount?: number
          id?: string
          month?: number | null
          net_amount?: number
          notes?: string | null
          paid_on?: string
          tds_amount?: number
          tds_rate?: number
          updated_at?: string
          year?: number | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          gross_amount?: number
          id?: string
          month?: number | null
          net_amount?: number
          notes?: string | null
          paid_on?: string
          tds_amount?: number
          tds_rate?: number
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_payments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "commission_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_advances: {
        Row: {
          amount: number
          created_at: string
          employee_id: string
          given_on: string
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          employee_id: string
          given_on?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          employee_id?: string
          given_on?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_advances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          allowances: number
          bank_account: string | null
          basic_salary: number
          created_at: string
          date_of_birth: string | null
          department: string | null
          designation: string | null
          email: string
          employee_code: string
          esi_enabled: boolean
          esi_number: string | null
          full_name: string
          hra: number
          id: string
          ifsc_code: string | null
          joining_date: string
          leave_encashment: number
          medical_allowance: number
          pan: string | null
          pf_enabled: boolean
          pf_number: string | null
          phone: string | null
          special_allowance: number
          status: string
          statutory_bonus: number
          tds_enabled: boolean
          uan: string | null
          updated_at: string
          wedding_anniversary: string | null
        }
        Insert: {
          allowances?: number
          bank_account?: string | null
          basic_salary?: number
          created_at?: string
          date_of_birth?: string | null
          department?: string | null
          designation?: string | null
          email: string
          employee_code: string
          esi_enabled?: boolean
          esi_number?: string | null
          full_name: string
          hra?: number
          id?: string
          ifsc_code?: string | null
          joining_date?: string
          leave_encashment?: number
          medical_allowance?: number
          pan?: string | null
          pf_enabled?: boolean
          pf_number?: string | null
          phone?: string | null
          special_allowance?: number
          status?: string
          statutory_bonus?: number
          tds_enabled?: boolean
          uan?: string | null
          updated_at?: string
          wedding_anniversary?: string | null
        }
        Update: {
          allowances?: number
          bank_account?: string | null
          basic_salary?: number
          created_at?: string
          date_of_birth?: string | null
          department?: string | null
          designation?: string | null
          email?: string
          employee_code?: string
          esi_enabled?: boolean
          esi_number?: string | null
          full_name?: string
          hra?: number
          id?: string
          ifsc_code?: string | null
          joining_date?: string
          leave_encashment?: number
          medical_allowance?: number
          pan?: string | null
          pf_enabled?: boolean
          pf_number?: string | null
          phone?: string | null
          special_allowance?: number
          status?: string
          statutory_bonus?: number
          tds_enabled?: boolean
          uan?: string | null
          updated_at?: string
          wedding_anniversary?: string | null
        }
        Relationships: []
      }
      leave_status_history: {
        Row: {
          changed_by: string | null
          changed_by_email: string | null
          created_at: string
          from_status: string | null
          id: string
          leave_id: string
          note: string | null
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          leave_id: string
          note?: string | null
          to_status: string
        }
        Update: {
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          leave_id?: string
          note?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_status_history_leave_id_fkey"
            columns: ["leave_id"]
            isOneToOne: false
            referencedRelation: "leaves"
            referencedColumns: ["id"]
          },
        ]
      }
      leaves: {
        Row: {
          created_at: string
          employee_id: string
          end_date: string
          id: string
          leave_type: string
          reason: string | null
          start_date: string
          status: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          end_date: string
          id?: string
          leave_type?: string
          reason?: string | null
          start_date: string
          status?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          end_date?: string
          id?: string
          leave_type?: string
          reason?: string | null
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaves_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          created_at: string
          id: string
          month: number
          status: string
          total_net: number
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          month: number
          status?: string
          total_net?: number
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          month?: number
          status?: string
          total_net?: number
          year?: number
        }
        Relationships: []
      }
      payslips: {
        Row: {
          advance: number
          allowances: number
          basic: number
          created_at: string
          days_worked: number
          edli: number
          employee_id: string
          employer_esi: number
          employer_pf: number
          esi: number
          gross: number
          hra: number
          id: string
          incentive: number
          leave_encashment: number
          medical_allowance: number
          net_pay: number
          payroll_run_id: string
          pf: number
          pf_admin_charges: number
          special_allowance: number
          statutory_bonus: number
          tds: number
          total_deductions: number
        }
        Insert: {
          advance?: number
          allowances?: number
          basic?: number
          created_at?: string
          days_worked?: number
          edli?: number
          employee_id: string
          employer_esi?: number
          employer_pf?: number
          esi?: number
          gross?: number
          hra?: number
          id?: string
          incentive?: number
          leave_encashment?: number
          medical_allowance?: number
          net_pay?: number
          payroll_run_id: string
          pf?: number
          pf_admin_charges?: number
          special_allowance?: number
          statutory_bonus?: number
          tds?: number
          total_deductions?: number
        }
        Update: {
          advance?: number
          allowances?: number
          basic?: number
          created_at?: string
          days_worked?: number
          edli?: number
          employee_id?: string
          employer_esi?: number
          employer_pf?: number
          esi?: number
          gross?: number
          hra?: number
          id?: string
          incentive?: number
          leave_encashment?: number
          medical_allowance?: number
          net_pay?: number
          payroll_run_id?: string
          pf?: number
          pf_admin_charges?: number
          special_allowance?: number
          statutory_bonus?: number
          tds?: number
          total_deductions?: number
        }
        Relationships: [
          {
            foreignKeyName: "payslips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
