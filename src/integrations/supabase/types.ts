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
      class_members: {
        Row: {
          class_id: string
          joined_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          class_id: string
          joined_at?: string | null
          role: string
          user_id: string
        }
        Update: {
          class_id?: string
          joined_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_members_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string | null
          id: string
          invite_code: string | null
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          invite_code?: string | null
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          invite_code?: string | null
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          class_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string | null
          updated_at: string
          user_id: string
          visibility: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id?: string | null
          updated_at?: string
          user_id: string
          visibility?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          updated_at?: string
          user_id?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collections_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversion_history: {
        Row: {
          converted_at: string
          id: string
          pitecoin_awarded: number
          pts_converted: number
          streak_bonus_pct: number
          streak_weeks: number
          user_id: string
          week_end: string
          week_start: string
        }
        Insert: {
          converted_at?: string
          id?: string
          pitecoin_awarded: number
          pts_converted: number
          streak_bonus_pct?: number
          streak_weeks?: number
          user_id: string
          week_end: string
          week_start: string
        }
        Update: {
          converted_at?: string
          id?: string
          pitecoin_awarded?: number
          pts_converted?: number
          streak_bonus_pct?: number
          streak_weeks?: number
          user_id?: string
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversion_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_activity: {
        Row: {
          actions_count: number
          activity_date: string
          created_at: string
          id: string
          pts_earned: number
          user_id: string
        }
        Insert: {
          actions_count?: number
          activity_date: string
          created_at?: string
          id?: string
          pts_earned?: number
          user_id: string
        }
        Update: {
          actions_count?: number
          activity_date?: string
          created_at?: string
          id?: string
          pts_earned?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcard_progress: {
        Row: {
          correct_count: number
          created_at: string
          flashcard_id: string
          id: string
          incorrect_count: number
          last_reviewed: string | null
          list_id: string
          next_review: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          correct_count?: number
          created_at?: string
          flashcard_id: string
          id?: string
          incorrect_count?: number
          last_reviewed?: string | null
          list_id: string
          next_review?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          correct_count?: number
          created_at?: string
          flashcard_id?: string
          id?: string
          incorrect_count?: number
          last_reviewed?: string | null
          list_id?: string
          next_review?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_progress_flashcard_id_fkey"
            columns: ["flashcard_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcard_progress_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcards: {
        Row: {
          accepted_answers_en: string[] | null
          accepted_answers_pt: string[] | null
          audio_url: string | null
          collection_id: string | null
          created_at: string
          hint: string | null
          id: string
          list_id: string | null
          term: string
          translation: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_answers_en?: string[] | null
          accepted_answers_pt?: string[] | null
          audio_url?: string | null
          collection_id?: string | null
          created_at?: string
          hint?: string | null
          id?: string
          list_id?: string | null
          term: string
          translation: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_answers_en?: string[] | null
          accepted_answers_pt?: string[] | null
          audio_url?: string | null
          collection_id?: string | null
          created_at?: string
          hint?: string | null
          id?: string
          list_id?: string | null
          term?: string
          translation?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcards_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          class_id: string | null
          created_at: string
          description: string | null
          id: string
          owner_id: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          owner_id: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          owner_id?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      lists: {
        Row: {
          class_id: string | null
          created_at: string
          description: string | null
          folder_id: string
          id: string
          order_index: number
          owner_id: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          description?: string | null
          folder_id: string
          id?: string
          order_index?: number
          owner_id: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          description?: string | null
          folder_id?: string
          id?: string
          order_index?: number
          owner_id?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "lists_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      pitecoin_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          source: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          id?: string
          source: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          source?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pitecoin_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_sessions: {
        Row: {
          collection_id: string
          created_at: string
          id: string
          mode: string
          score: number | null
          total: number | null
          user_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          id?: string
          mode: string
          score?: number | null
          total?: number | null
          user_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          id?: string
          mode?: string
          score?: number | null
          total?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_sessions_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_skin_id: string | null
          balance_pitecoin: number
          best_streak: number
          created_at: string | null
          current_streak: number
          email: string | null
          first_name: string | null
          id: string
          is_primary: boolean | null
          last_conversion: string | null
          last_daily_reward: string | null
          level: number
          mascot_skin_id: string | null
          pts_weekly: number
          public_access_enabled: boolean | null
          public_slug: string | null
          role: string | null
          updated_at: string | null
          xp_total: number
        }
        Insert: {
          avatar_skin_id?: string | null
          balance_pitecoin?: number
          best_streak?: number
          created_at?: string | null
          current_streak?: number
          email?: string | null
          first_name?: string | null
          id: string
          is_primary?: boolean | null
          last_conversion?: string | null
          last_daily_reward?: string | null
          level?: number
          mascot_skin_id?: string | null
          pts_weekly?: number
          public_access_enabled?: boolean | null
          public_slug?: string | null
          role?: string | null
          updated_at?: string | null
          xp_total?: number
        }
        Update: {
          avatar_skin_id?: string | null
          balance_pitecoin?: number
          best_streak?: number
          created_at?: string | null
          current_streak?: number
          email?: string | null
          first_name?: string | null
          id?: string
          is_primary?: boolean | null
          last_conversion?: string | null
          last_daily_reward?: string | null
          level?: number
          mascot_skin_id?: string | null
          pts_weekly?: number
          public_access_enabled?: boolean | null
          public_slug?: string | null
          role?: string | null
          updated_at?: string | null
          xp_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_avatar_skin_id_fkey"
            columns: ["avatar_skin_id"]
            isOneToOne: false
            referencedRelation: "skins_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_mascot_skin_id_fkey"
            columns: ["mascot_skin_id"]
            isOneToOne: false
            referencedRelation: "skins_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      skins_catalog: {
        Row: {
          avatar_img: string
          card_img: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          price_pitecoin: number
          rarity: string
        }
        Insert: {
          avatar_img: string
          card_img: string
          created_at?: string
          description?: string | null
          id: string
          is_active?: boolean
          name: string
          price_pitecoin?: number
          rarity: string
        }
        Update: {
          avatar_img?: string
          card_img?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price_pitecoin?: number
          rarity?: string
        }
        Relationships: []
      }
      study_sessions: {
        Row: {
          cards_order: Json
          completed: boolean
          created_at: string
          current_index: number
          id: string
          list_id: string
          mode: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cards_order: Json
          completed?: boolean
          created_at?: string
          current_index?: number
          id?: string
          list_id: string
          mode: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cards_order?: Json
          completed?: boolean
          created_at?: string
          current_index?: number
          id?: string
          list_id?: string
          mode?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          id: string
          student_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          student_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: []
      }
      user_inventory: {
        Row: {
          acquired_at: string
          id: string
          skin_id: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          id?: string
          skin_id: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          id?: string
          skin_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_inventory_skin_id_fkey"
            columns: ["skin_id"]
            isOneToOne: false
            referencedRelation: "skins_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      videos: {
        Row: {
          created_at: string
          created_by: string
          folder_id: string
          id: string
          is_published: boolean
          order_index: number
          provider: string
          thumbnail_url: string
          title: string | null
          updated_at: string
          url: string
          video_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          folder_id: string
          id?: string
          is_published?: boolean
          order_index?: number
          provider?: string
          thumbnail_url: string
          title?: string | null
          updated_at?: string
          url: string
          video_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          folder_id?: string
          id?: string
          is_published?: boolean
          order_index?: number
          provider?: string
          thumbnail_url?: string
          title?: string | null
          updated_at?: string
          url?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "videos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_portal_counts: {
        Args: { _folder_id: string }
        Returns: {
          card_count: number
          list_count: number
        }[]
      }
      get_portal_flashcards: {
        Args: { _list_id: string }
        Returns: {
          accepted_answers_en: string[] | null
          accepted_answers_pt: string[] | null
          audio_url: string | null
          collection_id: string | null
          created_at: string
          hint: string | null
          id: string
          list_id: string | null
          term: string
          translation: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "flashcards"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_portal_folder: {
        Args: { _id: string }
        Returns: {
          class_id: string | null
          created_at: string
          description: string | null
          id: string
          owner_id: string
          title: string
          updated_at: string
          visibility: string
        }
        SetofOptions: {
          from: "*"
          to: "folders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_portal_folders: {
        Args: never
        Returns: {
          class_id: string | null
          created_at: string
          description: string | null
          id: string
          owner_id: string
          title: string
          updated_at: string
          visibility: string
        }[]
        SetofOptions: {
          from: "*"
          to: "folders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_portal_lists: {
        Args: { _folder_id: string }
        Returns: {
          class_id: string | null
          created_at: string
          description: string | null
          folder_id: string
          id: string
          order_index: number
          owner_id: string
          title: string
          updated_at: string
          visibility: string
        }[]
        SetofOptions: {
          from: "*"
          to: "lists"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      is_class_member: {
        Args: { _class_id: string; _user_id: string }
        Returns: boolean
      }
      is_class_owner: {
        Args: { _class_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "student"
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
      app_role: ["owner", "student"],
    },
  },
} as const
