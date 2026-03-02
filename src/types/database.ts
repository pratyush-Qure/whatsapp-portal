export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      job_queue: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          failed_at: string | null
          id: string
          max_attempts: number
          message_log_id: string | null
          payload: Json
          priority: number
          scheduled_for: string
          started_at: string | null
          status: string
          trigger_id: string
          updated_at: string | null
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          max_attempts?: number
          message_log_id?: string | null
          payload: Json
          priority?: number
          scheduled_for?: string
          started_at?: string | null
          status?: string
          trigger_id: string
          updated_at?: string | null
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          max_attempts?: number
          message_log_id?: string | null
          payload?: Json
          priority?: number
          scheduled_for?: string
          started_at?: string | null
          status?: string
          trigger_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_queue_message_log_id_fkey"
            columns: ["message_log_id"]
            isOneToOne: false
            referencedRelation: "message_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_queue_trigger_id_fkey"
            columns: ["trigger_id"]
            isOneToOne: false
            referencedRelation: "triggers"
            referencedColumns: ["id"]
          },
        ]
      }
      message_logs: {
        Row: {
          created_at: string | null
          delivered_at: string | null
          error_code: string | null
          error_message: string | null
          failed_at: string | null
          id: string
          read_at: string | null
          recipient_phone: string
          resolved_params: Json
          sent_at: string | null
          status: string
          template_id: string
          trigger_id: string
          twilio_message_sid: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          delivered_at?: string | null
          error_code?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          read_at?: string | null
          recipient_phone: string
          resolved_params?: Json
          sent_at?: string | null
          status?: string
          template_id: string
          trigger_id: string
          twilio_message_sid?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          delivered_at?: string | null
          error_code?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          read_at?: string | null
          recipient_phone?: string
          resolved_params?: Json
          sent_at?: string | null
          status?: string
          template_id?: string
          trigger_id?: string
          twilio_message_sid?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_logs_trigger_id_fkey"
            columns: ["trigger_id"]
            isOneToOne: false
            referencedRelation: "triggers"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      template_variables: {
        Row: {
          compute_expr: string | null
          created_at: string | null
          id: string
          name: string
          payload_path: string | null
          position: number
          required: boolean
          source: string
          static_value: string | null
          template_id: string
          type: string
        }
        Insert: {
          compute_expr?: string | null
          created_at?: string | null
          id?: string
          name: string
          payload_path?: string | null
          position: number
          required?: boolean
          source: string
          static_value?: string | null
          template_id: string
          type: string
        }
        Update: {
          compute_expr?: string | null
          created_at?: string | null
          id?: string
          name?: string
          payload_path?: string | null
          position?: number
          required?: boolean
          source?: string
          static_value?: string | null
          template_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_variables_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          body: string
          buttons_json: Json | null
          category: string
          created_at: string | null
          footer: string | null
          header_content: string | null
          header_type: string | null
          id: string
          language: string
          name: string
          project_id: string
          twilio_content_sid: string | null
          twilio_rejected_reason: string | null
          twilio_status: string
          updated_at: string | null
          version: number
        }
        Insert: {
          body: string
          buttons_json?: Json | null
          category: string
          created_at?: string | null
          footer?: string | null
          header_content?: string | null
          header_type?: string | null
          id?: string
          language?: string
          name: string
          project_id: string
          twilio_content_sid?: string | null
          twilio_rejected_reason?: string | null
          twilio_status?: string
          updated_at?: string | null
          version?: number
        }
        Update: {
          body?: string
          buttons_json?: Json | null
          category?: string
          created_at?: string | null
          footer?: string | null
          header_content?: string | null
          header_type?: string | null
          id?: string
          language?: string
          name?: string
          project_id?: string
          twilio_content_sid?: string | null
          twilio_rejected_reason?: string | null
          twilio_status?: string
          updated_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      trigger_parameter_sets: {
        Row: {
          created_at: string | null
          id: string
          is_default: boolean
          name: string
          params_json: Json
          trigger_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_default?: boolean
          name: string
          params_json?: Json
          trigger_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_default?: boolean
          name?: string
          params_json?: Json
          trigger_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trigger_parameter_sets_trigger_id_fkey"
            columns: ["trigger_id"]
            isOneToOne: false
            referencedRelation: "triggers"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          id: string
          project_id: string
          name: string
          slug: string
          description: string | null
          default_trigger_id: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          slug: string
          description?: string | null
          default_trigger_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          slug?: string
          description?: string | null
          default_trigger_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_default_trigger_id_fkey"
            columns: ["default_trigger_id"]
            isOneToOne: false
            referencedRelation: "triggers"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          id: string
          group_id: string
          phone: string
          name: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          group_id: string
          phone: string
          name?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          group_id?: string
          phone?: string
          name?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      trigger_groups: {
        Row: {
          trigger_id: string
          group_id: string
          created_at: string | null
        }
        Insert: {
          trigger_id: string
          group_id: string
          created_at?: string | null
        }
        Update: {
          trigger_id?: string
          group_id?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trigger_groups_trigger_id_fkey"
            columns: ["trigger_id"]
            isOneToOne: false
            referencedRelation: "triggers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trigger_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      triggers: {
        Row: {
          conditions_json: Json | null
          config_json: Json
          created_at: string | null
          id: string
          name: string
          project_id: string
          recipient_path: string
          slug: string
          source_type: string
          status: string
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          conditions_json?: Json | null
          config_json?: Json
          created_at?: string | null
          id?: string
          name: string
          project_id: string
          recipient_path?: string
          slug: string
          source_type: string
          status?: string
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          conditions_json?: Json | null
          config_json?: Json
          created_at?: string | null
          id?: string
          name?: string
          project_id?: string
          recipient_path?: string
          slug?: string
          source_type?: string
          status?: string
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "triggers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "triggers_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
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

