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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          target: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          target?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          target?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      editions: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_active: boolean
          name: string
          slug: string
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          start_date?: string
        }
        Relationships: []
      }
      final_classifications: {
        Row: {
          edition_id: string
          kind: Database["public"]["Enums"]["classification_kind"]
          position: number
          rider_id: string
          status: Database["public"]["Enums"]["result_status"]
          updated_at: string
        }
        Insert: {
          edition_id: string
          kind: Database["public"]["Enums"]["classification_kind"]
          position: number
          rider_id: string
          status?: Database["public"]["Enums"]["result_status"]
          updated_at?: string
        }
        Update: {
          edition_id?: string
          kind?: Database["public"]["Enums"]["classification_kind"]
          position?: number
          rider_id?: string
          status?: Database["public"]["Enums"]["result_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "final_classifications_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_classifications_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_view"
            referencedColumns: ["edition_id"]
          },
          {
            foreignKeyName: "final_classifications_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      gc_picks: {
        Row: {
          edition_id: string
          position: number
          rider_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          edition_id: string
          position: number
          rider_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          edition_id?: string
          position?: number
          rider_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gc_picks_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gc_picks_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_view"
            referencedColumns: ["edition_id"]
          },
          {
            foreignKeyName: "gc_picks_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gc_picks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "gc_picks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          code: string
          created_at: string
          created_by: string
          email: string
          expires_at: string
          used_at: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          email: string
          expires_at: string
          used_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          email?: string
          expires_at?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "leaderboard_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pick_reminders_sent: {
        Row: {
          sent_at: string
          stage_id: string
          user_id: string
        }
        Insert: {
          sent_at?: string
          stage_id: string
          user_id: string
        }
        Update: {
          sent_at?: string
          stage_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pick_reminders_sent_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_reminders_sent_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "pick_reminders_sent_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      points_jersey_picks: {
        Row: {
          edition_id: string
          rider_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          edition_id: string
          rider_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          edition_id?: string
          rider_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_jersey_picks_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_jersey_picks_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_view"
            referencedColumns: ["edition_id"]
          },
          {
            foreignKeyName: "points_jersey_picks_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_jersey_picks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "points_jersey_picks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          deleted_at: string | null
          display_name: string
          email: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          display_name: string
          email?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          email?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      riders: {
        Row: {
          bib: number | null
          created_at: string
          edition_id: string
          id: string
          name: string
          pcs_slug: string
          status: Database["public"]["Enums"]["rider_status"]
          team: string | null
        }
        Insert: {
          bib?: number | null
          created_at?: string
          edition_id: string
          id?: string
          name: string
          pcs_slug: string
          status?: Database["public"]["Enums"]["rider_status"]
          team?: string | null
        }
        Update: {
          bib?: number | null
          created_at?: string
          edition_id?: string
          id?: string
          name?: string
          pcs_slug?: string
          status?: Database["public"]["Enums"]["rider_status"]
          team?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "riders_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riders_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_view"
            referencedColumns: ["edition_id"]
          },
        ]
      }
      scrape_errors: {
        Row: {
          error: string
          html_snippet: string | null
          id: string
          run_at: string
          target: string
        }
        Insert: {
          error: string
          html_snippet?: string | null
          id?: string
          run_at?: string
          target: string
        }
        Update: {
          error?: string
          html_snippet?: string | null
          id?: string
          run_at?: string
          target?: string
        }
        Relationships: []
      }
      stage_picks: {
        Row: {
          created_at: string
          id: string
          rider_id: string
          stage_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rider_id: string
          stage_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rider_id?: string
          stage_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_picks_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_picks_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_picks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "stage_picks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_results: {
        Row: {
          position: number
          rider_id: string
          stage_id: string
          status: Database["public"]["Enums"]["result_status"]
          updated_at: string
        }
        Insert: {
          position: number
          rider_id: string
          stage_id: string
          status?: Database["public"]["Enums"]["result_status"]
          updated_at?: string
        }
        Update: {
          position?: number
          rider_id?: string
          stage_id?: string
          status?: Database["public"]["Enums"]["result_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_results_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_results_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
        ]
      }
      stages: {
        Row: {
          counts_for_scoring: boolean
          created_at: string
          double_points: boolean
          edition_id: string
          id: string
          number: number
          start_time: string
          status: Database["public"]["Enums"]["stage_status"]
        }
        Insert: {
          counts_for_scoring?: boolean
          created_at?: string
          double_points?: boolean
          edition_id: string
          id?: string
          number: number
          start_time: string
          status?: Database["public"]["Enums"]["stage_status"]
        }
        Update: {
          counts_for_scoring?: boolean
          created_at?: string
          double_points?: boolean
          edition_id?: string
          id?: string
          number?: number
          start_time?: string
          status?: Database["public"]["Enums"]["stage_status"]
        }
        Relationships: [
          {
            foreignKeyName: "stages_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stages_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_view"
            referencedColumns: ["edition_id"]
          },
        ]
      }
    }
    Views: {
      leaderboard_view: {
        Row: {
          display_name: string | null
          edition_id: string | null
          exact_winners_count: number | null
          gc_points: number | null
          jersey_points: number | null
          stage_points: number | null
          total_points: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      edition_started: { Args: { edition_id: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      classification_kind: "gc" | "points_jersey"
      result_status: "draft" | "published"
      rider_status: "active" | "dnf" | "dns"
      stage_status:
        | "upcoming"
        | "locked"
        | "results_draft"
        | "published"
        | "cancelled"
      user_role: "player" | "admin"
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
      classification_kind: ["gc", "points_jersey"],
      result_status: ["draft", "published"],
      rider_status: ["active", "dnf", "dns"],
      stage_status: [
        "upcoming",
        "locked",
        "results_draft",
        "published",
        "cancelled",
      ],
      user_role: ["player", "admin"],
    },
  },
} as const

