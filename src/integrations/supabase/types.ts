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
      activity_progress: {
        Row: {
          activity_id: string
          attempts: number
          best_score: number
          created_at: string
          id: string
          last_answer_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          attempts?: number
          best_score?: number
          created_at?: string
          id?: string
          last_answer_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          attempts?: number
          best_score?: number
          created_at?: string
          id?: string
          last_answer_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_progress_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "kingdom_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_logs: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json | null
          id: string
          target: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          archived_at: string | null
          author_id: string
          body: string
          class_id: string
          created_at: string
          id: string
          pinned: boolean
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          author_id: string
          body: string
          class_id: string
          created_at?: string
          id?: string
          pinned?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          author_id?: string
          body?: string
          class_id?: string
          created_at?: string
          id?: string
          pinned?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      atribuicoes: {
        Row: {
          created_at: string
          data_limite: string | null
          descricao: string | null
          fonte_id: string
          fonte_tipo: Database["public"]["Enums"]["atribuicao_fonte_tipo"]
          id: string
          pontos_vale: number
          titulo: string
          turma_id: string
        }
        Insert: {
          created_at?: string
          data_limite?: string | null
          descricao?: string | null
          fonte_id: string
          fonte_tipo: Database["public"]["Enums"]["atribuicao_fonte_tipo"]
          id?: string
          pontos_vale?: number
          titulo: string
          turma_id: string
        }
        Update: {
          created_at?: string
          data_limite?: string | null
          descricao?: string | null
          fonte_id?: string
          fonte_tipo?: Database["public"]["Enums"]["atribuicao_fonte_tipo"]
          id?: string
          pontos_vale?: number
          titulo?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "atribuicoes_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      atribuicoes_status: {
        Row: {
          aluno_id: string
          atribuicao_id: string
          id: string
          progresso: number
          status: Database["public"]["Enums"]["atribuicao_status"]
          updated_at: string
        }
        Insert: {
          aluno_id: string
          atribuicao_id: string
          id?: string
          progresso?: number
          status?: Database["public"]["Enums"]["atribuicao_status"]
          updated_at?: string
        }
        Update: {
          aluno_id?: string
          atribuicao_id?: string
          id?: string
          progresso?: number
          status?: Database["public"]["Enums"]["atribuicao_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "atribuicoes_status_atribuicao_id_fkey"
            columns: ["atribuicao_id"]
            isOneToOne: false
            referencedRelation: "atribuicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_goal_assignments: {
        Row: {
          aluno_id: string
          created_at: string
          goal_id: string
          id: string
          reviewed_at: string | null
          reviewer_notes: string | null
          status: Database["public"]["Enums"]["class_goal_assignment_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          aluno_id: string
          created_at?: string
          goal_id: string
          id?: string
          reviewed_at?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["class_goal_assignment_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          aluno_id?: string
          created_at?: string
          goal_id?: string
          id?: string
          reviewed_at?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["class_goal_assignment_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_goal_assignments_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "class_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      class_goal_targets: {
        Row: {
          created_at: string
          goal_id: string
          id: string
          percent_required: number
          target_id: string
          target_type: Database["public"]["Enums"]["class_goal_target_type"]
        }
        Insert: {
          created_at?: string
          goal_id: string
          id?: string
          percent_required?: number
          target_id: string
          target_type: Database["public"]["Enums"]["class_goal_target_type"]
        }
        Update: {
          created_at?: string
          goal_id?: string
          id?: string
          percent_required?: number
          target_id?: string
          target_type?: Database["public"]["Enums"]["class_goal_target_type"]
        }
        Relationships: [
          {
            foreignKeyName: "class_goal_targets_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "class_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      class_goals: {
        Row: {
          created_at: string
          created_by: string
          descricao: string | null
          due_at: string | null
          id: string
          titulo: string
          turma_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          descricao?: string | null
          due_at?: string | null
          id?: string
          titulo: string
          turma_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          descricao?: string | null
          due_at?: string | null
          id?: string
          titulo?: string
          turma_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_goals_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      class_members: {
        Row: {
          class_id: string
          joined_at: string | null
          role: string
          status: string
          user_id: string
        }
        Insert: {
          class_id: string
          joined_at?: string | null
          role: string
          status?: string
          user_id: string
        }
        Update: {
          class_id?: string
          joined_at?: string | null
          role?: string
          status?: string
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
          archived_at: string | null
          code: string | null
          created_at: string | null
          id: string
          name: string
          owner_id: string
          visibility: string
        }
        Insert: {
          archived_at?: string | null
          code?: string | null
          created_at?: string | null
          id?: string
          name: string
          owner_id: string
          visibility?: string
        }
        Update: {
          archived_at?: string | null
          code?: string | null
          created_at?: string | null
          id?: string
          name?: string
          owner_id?: string
          visibility?: string
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
      dms: {
        Row: {
          aluno_id: string
          created_at: string
          id: string
          teacher_id: string
          turma_id: string
        }
        Insert: {
          aluno_id: string
          created_at?: string
          id?: string
          teacher_id: string
          turma_id: string
        }
        Update: {
          aluno_id?: string
          created_at?: string
          id?: string
          teacher_id?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dms_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      equip_logs: {
        Row: {
          created_at: string
          id: string
          kind: string
          operation_id: string
          skin_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          operation_id: string
          skin_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          operation_id?: string
          skin_id?: string
          user_id?: string
        }
        Relationships: []
      }
      exchange_logs: {
        Row: {
          created_at: string
          id: string
          operation_id: string
          ppc_received: number
          pts_spent: number
          rate: number
          user_id: string
          ymd: string
        }
        Insert: {
          created_at?: string
          id?: string
          operation_id: string
          ppc_received: number
          pts_spent: number
          rate: number
          user_id: string
          ymd?: string
        }
        Update: {
          created_at?: string
          id?: string
          operation_id?: string
          ppc_received?: number
          pts_spent?: number
          rate?: number
          user_id?: string
          ymd?: string
        }
        Relationships: []
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
          display_text: string | null
          eval_text: string | null
          hint: string | null
          id: string
          lang: string | null
          list_id: string | null
          note_text: string[] | null
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
          display_text?: string | null
          eval_text?: string | null
          hint?: string | null
          id?: string
          lang?: string | null
          list_id?: string | null
          note_text?: string[] | null
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
          display_text?: string | null
          eval_text?: string | null
          hint?: string | null
          id?: string
          lang?: string | null
          list_id?: string | null
          note_text?: string[] | null
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
      folder_texts: {
        Row: {
          content: string
          created_at: string
          created_by: string
          folder_id: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          created_by: string
          folder_id: string
          id?: string
          title?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          folder_id?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "folder_texts_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
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
          institution_id: string | null
          labels_a: string | null
          labels_b: string | null
          lang_a: string | null
          lang_b: string | null
          owner_id: string
          study_type: string
          title: string
          tts_enabled: boolean
          updated_at: string
          visibility: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          institution_id?: string | null
          labels_a?: string | null
          labels_b?: string | null
          lang_a?: string | null
          lang_b?: string | null
          owner_id: string
          study_type?: string
          title: string
          tts_enabled?: boolean
          updated_at?: string
          visibility?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          institution_id?: string | null
          labels_a?: string | null
          labels_b?: string | null
          lang_a?: string | null
          lang_b?: string | null
          owner_id?: string
          study_type?: string
          title?: string
          tts_enabled?: boolean
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_offers: {
        Row: {
          claimed_at: string | null
          created_at: string
          expires_at: string | null
          id: string
          message: string | null
          recipient_user_id: string
          request_id: string | null
          sent_by: string
          skin_id: string
          status: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          message?: string | null
          recipient_user_id: string
          request_id?: string | null
          sent_by?: string
          skin_id: string
          status?: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          message?: string | null
          recipient_user_id?: string
          request_id?: string | null
          sent_by?: string
          skin_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_offers_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ingest_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          operation_id: string
          payload: Json | null
          sku: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          operation_id: string
          payload?: Json | null
          sku: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          operation_id?: string
          payload?: Json | null
          sku?: string
        }
        Relationships: []
      }
      institutions: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      kingdom_activities: {
        Row: {
          activity_type: string
          alt_answers: Json | null
          canonical_answer: string
          choices: Json | null
          created_at: string
          hint: string | null
          id: string
          kingdom_code: string
          lang: string
          level_code: string
          points: number | null
          prompt: string
          tags: string[] | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          activity_type: string
          alt_answers?: Json | null
          canonical_answer: string
          choices?: Json | null
          created_at?: string
          hint?: string | null
          id?: string
          kingdom_code: string
          lang?: string
          level_code: string
          points?: number | null
          prompt: string
          tags?: string[] | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          activity_type?: string
          alt_answers?: Json | null
          canonical_answer?: string
          choices?: Json | null
          created_at?: string
          hint?: string | null
          id?: string
          kingdom_code?: string
          lang?: string
          level_code?: string
          points?: number | null
          prompt?: string
          tags?: string[] | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kingdom_activities_kingdom_code_fkey"
            columns: ["kingdom_code"]
            isOneToOne: false
            referencedRelation: "kingdoms"
            referencedColumns: ["code"]
          },
        ]
      }
      kingdom_progress: {
        Row: {
          accuracy_pct: number
          completed_count: number
          created_at: string
          id: string
          kingdom_code: string
          last_played_at: string | null
          total_count: number
          updated_at: string
          user_id: string
          xp_earned: number
        }
        Insert: {
          accuracy_pct?: number
          completed_count?: number
          created_at?: string
          id?: string
          kingdom_code: string
          last_played_at?: string | null
          total_count?: number
          updated_at?: string
          user_id: string
          xp_earned?: number
        }
        Update: {
          accuracy_pct?: number
          completed_count?: number
          created_at?: string
          id?: string
          kingdom_code?: string
          last_played_at?: string | null
          total_count?: number
          updated_at?: string
          user_id?: string
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "kingdom_progress_kingdom_code_fkey"
            columns: ["kingdom_code"]
            isOneToOne: false
            referencedRelation: "kingdoms"
            referencedColumns: ["code"]
          },
        ]
      }
      kingdoms: {
        Row: {
          code: string
          created_at: string
          icon_url: string | null
          id: string
          name: string
          order_index: number
          unlock_rule: Json | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          icon_url?: string | null
          id?: string
          name: string
          order_index?: number
          unlock_rule?: Json | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          icon_url?: string | null
          id?: string
          name?: string
          order_index?: number
          unlock_rule?: Json | null
          updated_at?: string
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
          institution_id: string | null
          labels_a: string | null
          labels_b: string | null
          lang: string | null
          lang_a: string | null
          lang_b: string | null
          order_index: number
          owner_id: string
          study_type: string
          title: string
          tts_enabled: boolean
          updated_at: string
          visibility: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          description?: string | null
          folder_id: string
          id?: string
          institution_id?: string | null
          labels_a?: string | null
          labels_b?: string | null
          lang?: string | null
          lang_a?: string | null
          lang_b?: string | null
          order_index?: number
          owner_id: string
          study_type?: string
          title: string
          tts_enabled?: boolean
          updated_at?: string
          visibility?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          description?: string | null
          folder_id?: string
          id?: string
          institution_id?: string | null
          labels_a?: string | null
          labels_b?: string | null
          lang?: string | null
          lang_a?: string | null
          lang_b?: string | null
          order_index?: number
          owner_id?: string
          study_type?: string
          title?: string
          tts_enabled?: boolean
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
          {
            foreignKeyName: "lists_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens: {
        Row: {
          anexos: Json | null
          created_at: string
          deleted: boolean
          edited_at: string | null
          id: string
          sender_id: string
          texto: string
          thread_chave: string
          thread_tipo: Database["public"]["Enums"]["thread_tipo"]
          turma_id: string
        }
        Insert: {
          anexos?: Json | null
          created_at?: string
          deleted?: boolean
          edited_at?: string | null
          id?: string
          sender_id: string
          texto: string
          thread_chave: string
          thread_tipo: Database["public"]["Enums"]["thread_tipo"]
          turma_id: string
        }
        Update: {
          anexos?: Json | null
          created_at?: string
          deleted?: boolean
          edited_at?: string | null
          id?: string
          sender_id?: string
          texto?: string
          thread_chave?: string
          thread_tipo?: Database["public"]["Enums"]["thread_tipo"]
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens_leituras: {
        Row: {
          id: string
          lido_em: string
          mensagem_id: string
          user_id: string
        }
        Insert: {
          id?: string
          lido_em?: string
          mensagem_id: string
          user_id: string
        }
        Update: {
          id?: string
          lido_em?: string
          mensagem_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_leituras_mensagem_id_fkey"
            columns: ["mensagem_id"]
            isOneToOne: false
            referencedRelation: "mensagens"
            referencedColumns: ["id"]
          },
        ]
      }
      message_rate_limits: {
        Row: {
          message_count: number
          thread_key: string
          user_id: string
          window_start: string
        }
        Insert: {
          message_count?: number
          thread_key: string
          user_id: string
          window_start?: string
        }
        Update: {
          message_count?: number
          thread_key?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          client_msg_id: string
          created_at: string
          id: string
          sender_id: string
          thread_id: string
        }
        Insert: {
          body: string
          client_msg_id: string
          created_at?: string
          id?: string
          sender_id: string
          thread_id: string
        }
        Update: {
          body?: string
          client_msg_id?: string
          created_at?: string
          id?: string
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          content: string
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          mensagem: string
          metadata: Json | null
          recipient_id: string
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          mensagem: string
          metadata?: Json | null
          recipient_id: string
          tipo: string
          titulo: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          mensagem?: string
          metadata?: Json | null
          recipient_id?: string
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          ref_id: string
          ref_type: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          ref_id: string
          ref_type: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          ref_id?: string
          ref_type?: string
          type?: string
          user_id?: string
        }
        Relationships: []
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
          account_id: string | null
          ape_id: string | null
          avatar_skin_id: string | null
          avatar_url: string | null
          balance_pitecoin: number
          best_streak: number
          created_at: string | null
          current_streak: number
          email: string | null
          first_name: string | null
          google_connect_prompt_dont_show: boolean | null
          google_connect_prompt_version_seen: number | null
          google_connected_at: string | null
          id: string
          is_primary: boolean | null
          is_teacher: boolean | null
          last_active_at: string | null
          last_conversion: string | null
          last_daily_reward: string | null
          level: number
          mascot_skin_id: string | null
          pts_weekly: number
          public_access_enabled: boolean | null
          public_slug: string | null
          role: string | null
          updated_at: string | null
          user_tag: string | null
          user_type: Database["public"]["Enums"]["user_type"] | null
          xp_total: number
        }
        Insert: {
          account_id?: string | null
          ape_id?: string | null
          avatar_skin_id?: string | null
          avatar_url?: string | null
          balance_pitecoin?: number
          best_streak?: number
          created_at?: string | null
          current_streak?: number
          email?: string | null
          first_name?: string | null
          google_connect_prompt_dont_show?: boolean | null
          google_connect_prompt_version_seen?: number | null
          google_connected_at?: string | null
          id: string
          is_primary?: boolean | null
          is_teacher?: boolean | null
          last_active_at?: string | null
          last_conversion?: string | null
          last_daily_reward?: string | null
          level?: number
          mascot_skin_id?: string | null
          pts_weekly?: number
          public_access_enabled?: boolean | null
          public_slug?: string | null
          role?: string | null
          updated_at?: string | null
          user_tag?: string | null
          user_type?: Database["public"]["Enums"]["user_type"] | null
          xp_total?: number
        }
        Update: {
          account_id?: string | null
          ape_id?: string | null
          avatar_skin_id?: string | null
          avatar_url?: string | null
          balance_pitecoin?: number
          best_streak?: number
          created_at?: string | null
          current_streak?: number
          email?: string | null
          first_name?: string | null
          google_connect_prompt_dont_show?: boolean | null
          google_connect_prompt_version_seen?: number | null
          google_connected_at?: string | null
          id?: string
          is_primary?: boolean | null
          is_teacher?: boolean | null
          last_active_at?: string | null
          last_conversion?: string | null
          last_daily_reward?: string | null
          level?: number
          mascot_skin_id?: string | null
          pts_weekly?: number
          public_access_enabled?: boolean | null
          public_slug?: string | null
          role?: string | null
          updated_at?: string | null
          user_tag?: string | null
          user_type?: Database["public"]["Enums"]["user_type"] | null
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
      public_catalog: {
        Row: {
          approved: boolean
          approved_by: string | null
          avatar_final: string
          card_final: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          price_pitecoin: number
          rarity: string
          sku: string | null
          slug: string | null
          type: string | null
          updated_at: string
          version: number | null
        }
        Insert: {
          approved?: boolean
          approved_by?: string | null
          avatar_final: string
          card_final: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id: string
          is_active?: boolean
          name: string
          price_pitecoin: number
          rarity: string
          sku?: string | null
          slug?: string | null
          type?: string | null
          updated_at?: string
          version?: number | null
        }
        Update: {
          approved?: boolean
          approved_by?: string | null
          avatar_final?: string
          card_final?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price_pitecoin?: number
          rarity?: string
          sku?: string | null
          slug?: string | null
          type?: string | null
          updated_at?: string
          version?: number | null
        }
        Relationships: []
      }
      purchase_logs: {
        Row: {
          balance_after: number
          balance_before: number
          buyer_id: string
          created_at: string
          error_message: string | null
          id: string
          operation_id: string
          price_pitecoin: number
          skin_id: string
          status: string
        }
        Insert: {
          balance_after: number
          balance_before: number
          buyer_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          operation_id: string
          price_pitecoin: number
          skin_id: string
          status?: string
        }
        Update: {
          balance_after?: number
          balance_before?: number
          buyer_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          operation_id?: string
          price_pitecoin?: number
          skin_id?: string
          status?: string
        }
        Relationships: []
      }
      quarantine_logs: {
        Row: {
          actor: string
          created_at: string
          filename: string
          id: string
          metadata: Json | null
          moved_to: string
          original_path: string
          reason: string
        }
        Insert: {
          actor?: string
          created_at?: string
          filename: string
          id?: string
          metadata?: Json | null
          moved_to: string
          original_path: string
          reason: string
        }
        Update: {
          actor?: string
          created_at?: string
          filename?: string
          id?: string
          metadata?: Json | null
          moved_to?: string
          original_path?: string
          reason?: string
        }
        Relationships: []
      }
      read_receipts: {
        Row: {
          last_read_message_id: string | null
          thread_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          last_read_message_id?: string | null
          thread_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          last_read_message_id?: string | null
          thread_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "read_receipts_last_read_message_id_fkey"
            columns: ["last_read_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "read_receipts_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      skins_catalog: {
        Row: {
          avatar_img: string
          avatar_src: string | null
          card_img: string
          card_src: string | null
          created_at: string
          current_supply: number | null
          description: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          max_supply: number | null
          name: string
          price_pitecoin: number
          rarity: string
          starts_at: string | null
          status: string | null
        }
        Insert: {
          avatar_img: string
          avatar_src?: string | null
          card_img: string
          card_src?: string | null
          created_at?: string
          current_supply?: number | null
          description?: string | null
          ends_at?: string | null
          id: string
          is_active?: boolean
          max_supply?: number | null
          name: string
          price_pitecoin?: number
          rarity: string
          starts_at?: string | null
          status?: string | null
        }
        Update: {
          avatar_img?: string
          avatar_src?: string | null
          card_img?: string
          card_src?: string | null
          created_at?: string
          current_supply?: number | null
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_supply?: number | null
          name?: string
          price_pitecoin?: number
          rarity?: string
          starts_at?: string | null
          status?: string | null
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
      threads: {
        Row: {
          announcement_id: string | null
          assignment_id: string | null
          class_id: string
          created_at: string
          id: string
          student_id: string | null
          type: string
          user_a_id: string
          user_b_id: string
        }
        Insert: {
          announcement_id?: string | null
          assignment_id?: string | null
          class_id: string
          created_at?: string
          id?: string
          student_id?: string | null
          type?: string
          user_a_id: string
          user_b_id: string
        }
        Update: {
          announcement_id?: string | null
          assignment_id?: string | null
          class_id?: string
          created_at?: string
          id?: string
          student_id?: string | null
          type?: string
          user_a_id?: string
          user_b_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "threads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      turma_membros: {
        Row: {
          ativo: boolean
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["turma_role"]
          turma_id: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["turma_role"]
          turma_id: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["turma_role"]
          turma_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "turma_membros_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      turma_student_activity: {
        Row: {
          created_at: string
          id: string
          last_activity_at: string
          list_id: string | null
          mode: string | null
          progress_pct: number | null
          student_id: string
          turma_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_activity_at?: string
          list_id?: string | null
          mode?: string | null
          progress_pct?: number | null
          student_id: string
          turma_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_activity_at?: string
          list_id?: string | null
          mode?: string | null
          progress_pct?: number | null
          student_id?: string
          turma_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "turma_student_activity_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_student_activity_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      turmas: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          institution_id: string | null
          nome: string
          owner_teacher_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          institution_id?: string | null
          nome: string
          owner_teacher_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          institution_id?: string | null
          nome?: string
          owner_teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "turmas_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_favorites: {
        Row: {
          created_at: string
          resource_id: string
          resource_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          resource_id: string
          resource_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          resource_id?: string
          resource_type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_favorites_old: {
        Row: {
          created_at: string
          flashcard_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          flashcard_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          flashcard_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_favorites_flashcard_id_fkey"
            columns: ["flashcard_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
        ]
      }
      user_goal_step_completions: {
        Row: {
          created_at: string
          id: string
          step_id: string
          study_session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          step_id: string
          study_session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          step_id?: string
          study_session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_goal_step_completions_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "user_goal_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_goal_step_completions_study_session_id_fkey"
            columns: ["study_session_id"]
            isOneToOne: false
            referencedRelation: "study_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_goal_steps: {
        Row: {
          created_at: string
          current_count: number
          folder_id: string | null
          goal_id: string
          id: string
          list_id: string | null
          mode: string | null
          order_index: number
          step_type: string
          target_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_count?: number
          folder_id?: string | null
          goal_id: string
          id?: string
          list_id?: string | null
          mode?: string | null
          order_index?: number
          step_type?: string
          target_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_count?: number
          folder_id?: string | null
          goal_id?: string
          id?: string
          list_id?: string | null
          mode?: string | null
          order_index?: number
          step_type?: string
          target_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_goal_steps_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "user_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_goals: {
        Row: {
          created_at: string
          due_at: string | null
          id: string
          start_at: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          due_at?: string | null
          id?: string
          start_at?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          due_at?: string | null
          id?: string
          start_at?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
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
            referencedRelation: "public_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      user_list_activity: {
        Row: {
          last_opened_at: string | null
          last_studied_at: string | null
          list_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          last_opened_at?: string | null
          last_studied_at?: string | null
          list_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          last_opened_at?: string | null
          last_studied_at?: string | null
          list_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      can_access_thread: {
        Args: {
          _thread_chave: string
          _thread_tipo: Database["public"]["Enums"]["thread_tipo"]
          _turma_id: string
          _user_id: string
        }
        Returns: boolean
      }
      check_message_rate_limit: {
        Args: { _thread_key: string; _user_id: string }
        Returns: boolean
      }
      claim_gift_atomic: {
        Args: { p_gift_id: string; p_user_id: string }
        Returns: Json
      }
      create_notification: {
        Args: {
          p_mensagem: string
          p_metadata?: Json
          p_recipient_id: string
          p_tipo: string
          p_titulo: string
        }
        Returns: string
      }
      equip_skin_atomic: {
        Args: {
          p_kind: string
          p_operation_id: string
          p_skin_id: string
          p_user_id: string
        }
        Returns: Json
      }
      generate_ape_id: { Args: never; Returns: string }
      generate_class_code: { Args: never; Returns: string }
      generate_public_id: { Args: { p_user_type: string }; Returns: string }
      generate_user_tag: { Args: never; Returns: string }
      get_exchange_config: { Args: never; Returns: Json }
      get_exchange_quote: {
        Args: { p_pts: number; p_user_id: string }
        Returns: Json
      }
      get_lists_with_card_counts: {
        Args: { _folder_id: string }
        Returns: {
          card_count: number
          class_id: string
          created_at: string
          description: string
          folder_id: string
          id: string
          institution_id: string
          lang: string
          order_index: number
          owner_id: string
          title: string
          updated_at: string
          visibility: string
        }[]
      }
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
          display_text: string | null
          eval_text: string | null
          hint: string | null
          id: string
          lang: string | null
          list_id: string | null
          note_text: string[] | null
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
          institution_id: string | null
          labels_a: string | null
          labels_b: string | null
          lang_a: string | null
          lang_b: string | null
          owner_id: string
          study_type: string
          title: string
          tts_enabled: boolean
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
          institution_id: string | null
          labels_a: string | null
          labels_b: string | null
          lang_a: string | null
          lang_b: string | null
          owner_id: string
          study_type: string
          title: string
          tts_enabled: boolean
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
          institution_id: string | null
          labels_a: string | null
          labels_b: string | null
          lang: string | null
          lang_a: string | null
          lang_b: string | null
          order_index: number
          owner_id: string
          study_type: string
          title: string
          tts_enabled: boolean
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
      get_portal_lists_with_counts: {
        Args: { _folder_id: string }
        Returns: {
          card_count: number
          class_id: string
          created_at: string
          description: string
          folder_id: string
          id: string
          institution_id: string
          lang: string
          order_index: number
          owner_id: string
          title: string
          updated_at: string
          visibility: string
        }[]
      }
      get_public_profile: { Args: { p_public_id: string }; Returns: Json }
      get_rarity_fallback_price: { Args: { p_rarity: string }; Returns: number }
      get_subscribed_teachers_with_stats: {
        Args: { _student_id: string }
        Returns: {
          avatar_url: string
          first_name: string
          folder_count: number
          teacher_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      init_public_id: { Args: { p_user_id: string }; Returns: Json }
      is_class_member: {
        Args: { _class_id: string; _user_id: string }
        Returns: boolean
      }
      is_class_owner: {
        Args: { _class_id: string; _user_id: string }
        Returns: boolean
      }
      is_developer_admin: { Args: { _user_id: string }; Returns: boolean }
      is_turma_member: {
        Args: { _turma_id: string; _user_id: string }
        Returns: boolean
      }
      is_turma_owner: {
        Args: { _turma_id: string; _user_id: string }
        Returns: boolean
      }
      process_exchange: {
        Args: { p_operation_id: string; p_pts: number; p_user_id: string }
        Returns: Json
      }
      process_skin_purchase: {
        Args: {
          p_buyer_id: string
          p_operation_id: string
          p_price: number
          p_skin_id: string
        }
        Returns: Json
      }
      publish_skin_to_store: { Args: { p_skin_id: string }; Returns: Json }
      search_users: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_query: string
          p_user_type?: string
        }
        Returns: Json
      }
      swap_list_sides: { Args: { _list_id: string }; Returns: Json }
    }
    Enums: {
      app_role: "owner" | "student" | "developer_admin"
      atribuicao_fonte_tipo: "lista" | "pasta" | "cardset"
      atribuicao_status: "pendente" | "em_andamento" | "concluida"
      class_goal_assignment_status:
        | "assigned"
        | "submitted"
        | "approved"
        | "needs_revision"
      class_goal_target_type: "folder" | "list"
      thread_tipo: "turma" | "atribuicao" | "dm"
      turma_role: "aluno" | "professor_assistente"
      user_type: "professor" | "aluno"
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
      app_role: ["owner", "student", "developer_admin"],
      atribuicao_fonte_tipo: ["lista", "pasta", "cardset"],
      atribuicao_status: ["pendente", "em_andamento", "concluida"],
      class_goal_assignment_status: [
        "assigned",
        "submitted",
        "approved",
        "needs_revision",
      ],
      class_goal_target_type: ["folder", "list"],
      thread_tipo: ["turma", "atribuicao", "dm"],
      turma_role: ["aluno", "professor_assistente"],
      user_type: ["professor", "aluno"],
    },
  },
} as const
