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
      action_items: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          metadata: Json | null
          priority: number | null
          related_update_id: string | null
          status: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json | null
          priority?: number | null
          related_update_id?: string | null
          status?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json | null
          priority?: number | null
          related_update_id?: string | null
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_items_related_update_id_fkey"
            columns: ["related_update_id"]
            isOneToOne: false
            referencedRelation: "processed_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      actions: {
        Row: {
          created_at: string | null
          executed_at: string | null
          executed_by_user: boolean | null
          id: string
          payload: Json | null
          status: string | null
          suggestion_id: string | null
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          executed_at?: string | null
          executed_by_user?: boolean | null
          id?: string
          payload?: Json | null
          status?: string | null
          suggestion_id?: string | null
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          executed_at?: string | null
          executed_by_user?: boolean | null
          id?: string
          payload?: Json | null
          status?: string | null
          suggestion_id?: string | null
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "actions_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "llm_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company: string | null
          context: string | null
          created_at: string | null
          email: string
          frequency: number | null
          id: string
          name: string
          role: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          company?: string | null
          context?: string | null
          created_at?: string | null
          email: string
          frequency?: number | null
          id?: string
          name: string
          role?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          company?: string | null
          context?: string | null
          created_at?: string | null
          email?: string
          frequency?: number | null
          id?: string
          name?: string
          role?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      conversation_history: {
        Row: {
          context: Json | null
          created_at: string
          id: string
          message: string
          response: string | null
          user_id: string
        }
        Insert: {
          context?: Json | null
          created_at?: string
          id?: string
          message: string
          response?: string | null
          user_id: string
        }
        Update: {
          context?: Json | null
          created_at?: string
          id?: string
          message?: string
          response?: string | null
          user_id?: string
        }
        Relationships: []
      }
      daily_summaries: {
        Row: {
          action_items: string[] | null
          calendar_count: number | null
          created_at: string
          email_count: number | null
          id: string
          slack_count: number | null
          summary_date: string
          summary_text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_items?: string[] | null
          calendar_count?: number | null
          created_at?: string
          email_count?: number | null
          id?: string
          slack_count?: number | null
          summary_date: string
          summary_text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_items?: string[] | null
          calendar_count?: number | null
          created_at?: string
          email_count?: number | null
          id?: string
          slack_count?: number | null
          summary_date?: string
          summary_text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      embeddings: {
        Row: {
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          metadata: Json | null
          source_id: string
          source_type: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          source_id: string
          source_type: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          source_id?: string
          source_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      event_audit_log: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          raw_event_id: string | null
          stage: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          raw_event_id?: string | null
          stage?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          raw_event_id?: string | null
          stage?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_audit_log_raw_event_id_fkey"
            columns: ["raw_event_id"]
            isOneToOne: false
            referencedRelation: "raw_events"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_fetch_logs: {
        Row: {
          created_at: string | null
          id: string
          last_fetch_time: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_fetch_time: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_fetch_time?: string
          user_id?: string | null
        }
        Relationships: []
      }
      integration_sync_log: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          integration_id: string | null
          last_synced_at: string | null
          metadata: Json | null
          status: string | null
          sync_type: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          integration_id?: string | null
          last_synced_at?: string | null
          metadata?: Json | null
          status?: string | null
          sync_type?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          integration_id?: string | null
          last_synced_at?: string | null
          metadata?: Json | null
          status?: string | null
          sync_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_sync_log_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "user_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      llm_suggestions: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          id: string
          payload: Json | null
          prompt: string | null
          requires_confirmation: boolean | null
          summary_id: string | null
          type: string | null
          user_id: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          payload?: Json | null
          prompt?: string | null
          requires_confirmation?: boolean | null
          summary_id?: string | null
          type?: string | null
          user_id: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          payload?: Json | null
          prompt?: string | null
          requires_confirmation?: boolean | null
          summary_id?: string | null
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "llm_suggestions_summary_id_fkey"
            columns: ["summary_id"]
            isOneToOne: false
            referencedRelation: "summaries"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          priority: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          priority?: string | null
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          priority?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          integration_type: string
          redirect_uri: string | null
          state_token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          integration_type: string
          redirect_uri?: string | null
          state_token: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          integration_type?: string
          redirect_uri?: string | null
          state_token?: string
          user_id?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          body: string
          embedding: string | null
          id: number
          title: string
        }
        Insert: {
          body: string
          embedding?: string | null
          id?: number
          title: string
        }
        Update: {
          body?: string
          embedding?: string | null
          id?: number
          title?: string
        }
        Relationships: []
      }
      processed_integration_data: {
        Row: {
          created_at: string | null
          id: string
          is_viewed: boolean | null
          processed_data: Json
          raw_data: Json
          source: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_viewed?: boolean | null
          processed_data: Json
          raw_data: Json
          source: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_viewed?: boolean | null
          processed_data?: Json
          raw_data?: Json
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      processed_updates: {
        Row: {
          action_suggestions: string[] | null
          content: Json
          created_at: string
          id: string
          is_read: boolean | null
          priority: number | null
          processed_at: string
          source: string
          source_id: string
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_suggestions?: string[] | null
          content: Json
          created_at?: string
          id?: string
          is_read?: boolean | null
          priority?: number | null
          processed_at?: string
          source: string
          source_id: string
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_suggestions?: string[] | null
          content?: Json
          created_at?: string
          id?: string
          is_read?: boolean | null
          priority?: number | null
          processed_at?: string
          source?: string
          source_id?: string
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          custom_address: string | null
          first_name: string | null
          id: number
          last_name: string | null
          onboarding_completed: boolean | null
          preferred_address: string | null
          pronouns: string | null
          updated_at: string | null
          user_id: string | null
          wake_up_time: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          custom_address?: string | null
          first_name?: string | null
          id?: never
          last_name?: string | null
          onboarding_completed?: boolean | null
          preferred_address?: string | null
          pronouns?: string | null
          updated_at?: string | null
          user_id?: string | null
          wake_up_time?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          custom_address?: string | null
          first_name?: string | null
          id?: never
          last_name?: string | null
          onboarding_completed?: boolean | null
          preferred_address?: string | null
          pronouns?: string | null
          updated_at?: string | null
          user_id?: string | null
          wake_up_time?: string | null
        }
        Relationships: []
      }
      raw_events: {
        Row: {
          content: string | null
          content_hash: string | null
          created_at: string | null
          event_type: string | null
          id: string
          integration_id: string | null
          source: string
          status: string | null
          timestamp: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          content_hash?: string | null
          created_at?: string | null
          event_type?: string | null
          id?: string
          integration_id?: string | null
          source: string
          status?: string | null
          timestamp?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          content_hash?: string | null
          created_at?: string | null
          event_type?: string | null
          id?: string
          integration_id?: string | null
          source?: string
          status?: string | null
          timestamp?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "user_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_tasks: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_completed: boolean | null
          metadata: Json | null
          scheduled_for: string
          task_type: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_completed?: boolean | null
          metadata?: Json | null
          scheduled_for: string
          task_type: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_completed?: boolean | null
          metadata?: Json | null
          scheduled_for?: string
          task_type?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      summaries: {
        Row: {
          entities: string[] | null
          id: string
          importance: string | null
          is_viewed: boolean | null
          llm_model_used: string | null
          model_version: string | null
          processed_at: string | null
          raw_event_id: string | null
          summary: string | null
          topic: string | null
          user_id: string
        }
        Insert: {
          entities?: string[] | null
          id?: string
          importance?: string | null
          is_viewed?: boolean | null
          llm_model_used?: string | null
          model_version?: string | null
          processed_at?: string | null
          raw_event_id?: string | null
          summary?: string | null
          topic?: string | null
          user_id: string
        }
        Update: {
          entities?: string[] | null
          id?: string
          importance?: string | null
          is_viewed?: boolean | null
          llm_model_used?: string | null
          model_version?: string | null
          processed_at?: string | null
          raw_event_id?: string | null
          summary?: string | null
          topic?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "summaries_raw_event_id_fkey"
            columns: ["raw_event_id"]
            isOneToOne: false
            referencedRelation: "raw_events"
            referencedColumns: ["id"]
          },
        ]
      }
      updates: {
        Row: {
          created_at: string
          id: string
          integration_type: string
          is_read: boolean | null
          priority: number | null
          raw_data: Json | null
          summary: string
          title: string
          update_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          integration_type: string
          is_read?: boolean | null
          priority?: number | null
          raw_data?: Json | null
          summary: string
          title: string
          update_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          integration_type?: string
          is_read?: boolean | null
          priority?: number | null
          raw_data?: Json | null
          summary?: string
          title?: string
          update_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_documents: {
        Row: {
          content: string | null
          created_at: string
          file_size: number | null
          file_type: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          file_size?: number | null
          file_type: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          file_size?: number | null
          file_type?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_feedback: {
        Row: {
          comments: string | null
          created_at: string | null
          feedback_type: string | null
          id: string
          suggestion_id: string | null
          user_id: string
        }
        Insert: {
          comments?: string | null
          created_at?: string | null
          feedback_type?: string | null
          id?: string
          suggestion_id?: string | null
          user_id: string
        }
        Update: {
          comments?: string | null
          created_at?: string | null
          feedback_type?: string | null
          id?: string
          suggestion_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_feedback_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "llm_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_integrations: {
        Row: {
          access_token: string | null
          created_at: string
          id: string
          integration_data: Json | null
          integration_type: string
          is_active: boolean | null
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          id?: string
          integration_data?: Json | null
          integration_type: string
          is_active?: boolean | null
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          id?: string
          integration_data?: Json | null
          integration_type?: string
          is_active?: boolean | null
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          common_topics: string[] | null
          communication_patterns: string[] | null
          contacts_extracted: number | null
          created_at: string | null
          email_analysis_completed: boolean | null
          formality_level: string | null
          id: string
          length_preference: string | null
          tone: string | null
          total_emails_analyzed: number | null
          updated_at: string | null
          user_id: string | null
          writing_style: string | null
        }
        Insert: {
          common_topics?: string[] | null
          communication_patterns?: string[] | null
          contacts_extracted?: number | null
          created_at?: string | null
          email_analysis_completed?: boolean | null
          formality_level?: string | null
          id?: string
          length_preference?: string | null
          tone?: string | null
          total_emails_analyzed?: number | null
          updated_at?: string | null
          user_id?: string | null
          writing_style?: string | null
        }
        Update: {
          common_topics?: string[] | null
          communication_patterns?: string[] | null
          contacts_extracted?: number | null
          created_at?: string | null
          email_analysis_completed?: boolean | null
          formality_level?: string | null
          id?: string
          length_preference?: string | null
          tone?: string | null
          total_emails_analyzed?: number | null
          updated_at?: string | null
          user_id?: string | null
          writing_style?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      setup_cron_job: {
        Args: { job_name: string; job_schedule: string; job_command: string }
        Returns: boolean
      }
      test_db_connection: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
