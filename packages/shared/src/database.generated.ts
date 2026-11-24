export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      coach_students: {
        Row: {
          accepted_at: string | null;
          archived_at: string | null;
          birth_date: string | null;
          coach_id: string;
          created_at: string;
          first_name: string;
          goal: string | null;
          height_cm: number | null;
          id: string;
          initial_weight_kg: number | null;
          injuries: string | null;
          last_name: string;
          level: string | null;
          notes: string | null;
          phone: string | null;
          sex: string | null;
          status: string;
          student_email: string | null;
          student_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          archived_at?: string | null;
          birth_date?: string | null;
          coach_id: string;
          created_at?: string;
          first_name?: string;
          goal?: string | null;
          height_cm?: number | null;
          id?: string;
          initial_weight_kg?: number | null;
          injuries?: string | null;
          last_name?: string;
          level?: string | null;
          notes?: string | null;
          phone?: string | null;
          sex?: string | null;
          status?: string;
          student_email?: string | null;
          student_id?: string | null;
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          archived_at?: string | null;
          birth_date?: string | null;
          coach_id?: string;
          created_at?: string;
          first_name?: string;
          goal?: string | null;
          height_cm?: number | null;
          id?: string;
          initial_weight_kg?: number | null;
          injuries?: string | null;
          last_name?: string;
          level?: string | null;
          notes?: string | null;
          phone?: string | null;
          sex?: string | null;
          status?: string;
          student_email?: string | null;
          student_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "coach_students_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coach_students_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      exercise_catalog: {
        Row: {
          created_at: string;
          id: string;
          muscle_group: string;
          name: string;
          name_key: string | null;
          owner_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          muscle_group: string;
          name: string;
          name_key?: never;
          owner_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          muscle_group?: string;
          name?: string;
          name_key?: never;
          owner_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "exercise_catalog_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      exercise_logs: {
        Row: {
          completed: boolean;
          created_at: string;
          exercise_id: string;
          id: string;
          note: string | null;
          session_id: string;
          variant: string | null;
        };
        ComputedFields: never;
        Insert: {
          completed?: boolean;
          created_at?: string;
          exercise_id: string;
          id?: string;
          note?: string | null;
          session_id: string;
          variant?: string | null;
        };
        Update: {
          completed?: boolean;
          created_at?: string;
          exercise_id?: string;
          id?: string;
          note?: string | null;
          session_id?: string;
          variant?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "exercise_logs_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exercise_logs_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "workout_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      exercises: {
        Row: {
          catalog_id: string;
          created_at: string;
          day_id: string;
          id: string;
          name: string;
          position: number;
          rest_seconds: number | null;
          sets_reps: string;
          variant: string | null;
        };
        ComputedFields: never;
        Insert: {
          catalog_id: string;
          created_at?: string;
          day_id: string;
          id?: string;
          name: string;
          position?: number;
          rest_seconds?: number | null;
          sets_reps?: string;
          variant?: string | null;
        };
        Update: {
          catalog_id?: string;
          created_at?: string;
          day_id?: string;
          id?: string;
          name?: string;
          position?: number;
          rest_seconds?: number | null;
          sets_reps?: string;
          variant?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "exercises_catalog_id_fkey";
            columns: ["catalog_id"];
            isOneToOne: false;
            referencedRelation: "exercise_catalog";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exercises_day_id_fkey";
            columns: ["day_id"];
            isOneToOne: false;
            referencedRelation: "routine_days";
            referencedColumns: ["id"];
          },
        ];
      };
      folders: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          owner_id: string;
          parent_folder_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          owner_id: string;
          parent_folder_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          owner_id?: string;
          parent_folder_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "folders_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "folders_parent_folder_id_fkey";
            columns: ["parent_folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
        ];
      };
      nutrition_folders: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          owner_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          owner_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          owner_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nutrition_folders_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      nutrition_items: {
        Row: {
          amount: string | null;
          carbs: number | null;
          fat: number | null;
          food: string;
          id: string;
          kcal: number | null;
          option_id: string;
          position: number;
          protein: number | null;
          unit: string | null;
        };
        ComputedFields: never;
        Insert: {
          amount?: string | null;
          carbs?: number | null;
          fat?: number | null;
          food: string;
          id?: string;
          kcal?: number | null;
          option_id: string;
          position?: number;
          protein?: number | null;
          unit?: string | null;
        };
        Update: {
          amount?: string | null;
          carbs?: number | null;
          fat?: number | null;
          food?: string;
          id?: string;
          kcal?: number | null;
          option_id?: string;
          position?: number;
          protein?: number | null;
          unit?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "nutrition_items_option_id_fkey";
            columns: ["option_id"];
            isOneToOne: false;
            referencedRelation: "nutrition_options";
            referencedColumns: ["id"];
          },
        ];
      };
      nutrition_meals: {
        Row: {
          id: string;
          name: string;
          plan_id: string;
          position: number;
          time_label: string | null;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          name: string;
          plan_id: string;
          position?: number;
          time_label?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          plan_id?: string;
          position?: number;
          time_label?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "nutrition_meals_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "nutrition_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      nutrition_options: {
        Row: {
          id: string;
          meal_id: string;
          position: number;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          meal_id: string;
          position?: number;
        };
        Update: {
          id?: string;
          meal_id?: string;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "nutrition_options_meal_id_fkey";
            columns: ["meal_id"];
            isOneToOne: false;
            referencedRelation: "nutrition_meals";
            referencedColumns: ["id"];
          },
        ];
      };
      nutrition_plans: {
        Row: {
          client_id: string | null;
          created_at: string;
          folder_id: string | null;
          guidelines: string | null;
          id: string;
          is_current: boolean;
          name: string;
          owner_id: string;
          target_carbs: number | null;
          target_fat: number | null;
          target_kcal: number | null;
          target_protein: number | null;
          target_water_l: number | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          client_id?: string | null;
          created_at?: string;
          folder_id?: string | null;
          guidelines?: string | null;
          id?: string;
          is_current?: boolean;
          name: string;
          owner_id: string;
          target_carbs?: number | null;
          target_fat?: number | null;
          target_kcal?: number | null;
          target_protein?: number | null;
          target_water_l?: number | null;
          updated_at?: string;
        };
        Update: {
          client_id?: string | null;
          created_at?: string;
          folder_id?: string | null;
          guidelines?: string | null;
          id?: string;
          is_current?: boolean;
          name?: string;
          owner_id?: string;
          target_carbs?: number | null;
          target_fat?: number | null;
          target_kcal?: number | null;
          target_protein?: number | null;
          target_water_l?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nutrition_plans_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "coach_students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nutrition_plans_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "nutrition_folders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nutrition_plans_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          birth_date: string | null;
          created_at: string;
          first_name: string;
          height_cm: number | null;
          id: string;
          is_coach: boolean;
          last_name: string;
          onboarded: boolean;
          updated_at: string;
          username: string | null;
          weight_kg: number | null;
        };
        ComputedFields: never;
        Insert: {
          birth_date?: string | null;
          created_at?: string;
          first_name?: string;
          height_cm?: number | null;
          id: string;
          is_coach?: boolean;
          last_name?: string;
          onboarded?: boolean;
          updated_at?: string;
          username?: string | null;
          weight_kg?: number | null;
        };
        Update: {
          birth_date?: string | null;
          created_at?: string;
          first_name?: string;
          height_cm?: number | null;
          id?: string;
          is_coach?: boolean;
          last_name?: string;
          onboarded?: boolean;
          updated_at?: string;
          username?: string | null;
          weight_kg?: number | null;
        };
        Relationships: [];
      };
      routine_days: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          position: number;
          routine_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          position?: number;
          routine_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          position?: number;
          routine_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "routine_days_routine_id_fkey";
            columns: ["routine_id"];
            isOneToOne: false;
            referencedRelation: "routines";
            referencedColumns: ["id"];
          },
        ];
      };
      routines: {
        Row: {
          client_id: string | null;
          created_at: string;
          folder_id: string | null;
          id: string;
          is_current: boolean;
          name: string;
          owner_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          client_id?: string | null;
          created_at?: string;
          folder_id?: string | null;
          id?: string;
          is_current?: boolean;
          name: string;
          owner_id: string;
          updated_at?: string;
        };
        Update: {
          client_id?: string | null;
          created_at?: string;
          folder_id?: string | null;
          id?: string;
          is_current?: boolean;
          name?: string;
          owner_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "routines_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "coach_students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "routines_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "routines_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      set_logs: {
        Row: {
          exercise_log_id: string;
          id: string;
          reps: number | null;
          set_number: number;
          weight: number | null;
        };
        ComputedFields: never;
        Insert: {
          exercise_log_id: string;
          id?: string;
          reps?: number | null;
          set_number: number;
          weight?: number | null;
        };
        Update: {
          exercise_log_id?: string;
          id?: string;
          reps?: number | null;
          set_number?: number;
          weight?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "set_logs_exercise_log_id_fkey";
            columns: ["exercise_log_id"];
            isOneToOne: false;
            referencedRelation: "exercise_logs";
            referencedColumns: ["id"];
          },
        ];
      };
      workout_sessions: {
        Row: {
          day_id: string;
          finished_at: string | null;
          id: string;
          routine_id: string;
          started_at: string;
          status: Database["public"]["Enums"]["session_status"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          day_id: string;
          finished_at?: string | null;
          id?: string;
          routine_id: string;
          started_at?: string;
          status?: Database["public"]["Enums"]["session_status"];
          user_id: string;
        };
        Update: {
          day_id?: string;
          finished_at?: string | null;
          id?: string;
          routine_id?: string;
          started_at?: string;
          status?: Database["public"]["Enums"]["session_status"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_sessions_day_id_fkey";
            columns: ["day_id"];
            isOneToOne: false;
            referencedRelation: "routine_days";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_sessions_routine_id_fkey";
            columns: ["routine_id"];
            isOneToOne: false;
            referencedRelation: "routines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      _copy_plan: {
        Args: {
          p_client_id: string;
          p_folder_id: string;
          p_name: string;
          p_owner?: string;
          p_src: string;
        };
        Returns: string;
      };
      _copy_routine: {
        Args: {
          p_client_id: string;
          p_folder_id: string;
          p_name: string;
          p_owner?: string;
          p_src: string;
        };
        Returns: Json;
      };
      _end_access: { Args: { p_client: string }; Returns: undefined };
      _hand_over_plans: {
        Args: { p_client: string; p_student: string };
        Returns: undefined;
      };
      _hand_over_routines: {
        Args: { p_client: string; p_student: string };
        Returns: undefined;
      };
      _log_variant: { Args: { p_variant: string }; Returns: string };
      _rest_seconds: { Args: { p_ex: Json }; Returns: number };
      add_student: { Args: { p_mode: string; p_value: string }; Returns: Json };
      can_view_exercise_log: { Args: { p_log_id: string }; Returns: boolean };
      can_view_session: { Args: { p_session_id: string }; Returns: boolean };
      catalog_used_in_my_routines: {
        Args: { p_catalog_id: string };
        Returns: boolean;
      };
      copy_nutrition_plan: {
        Args: { p_client_id?: string; p_plan_id: string };
        Returns: string;
      };
      copy_routine: {
        Args: { p_link_id?: string; p_routine_id: string };
        Returns: string;
      };
      create_full_routine: {
        Args: {
          p_days: Json;
          p_folder_id: string;
          p_link_id?: string;
          p_name: string;
        };
        Returns: string;
      };
      delete_client: { Args: { p_client_id: string }; Returns: undefined };
      exercise_key: { Args: { p: string }; Returns: string };
      get_my_coaches: {
        Args: Record<PropertyKey, never>;
        Returns: {
          coach_id: string;
          created_at: string;
          link_id: string;
          status: string;
        }[];
      };
      has_day_access: { Args: { p_day_id: string }; Returns: boolean };
      has_exercise_access: {
        Args: { p_exercise_id: string };
        Returns: boolean;
      };
      has_plan_access: { Args: { p_plan_id: string }; Returns: boolean };
      has_routine_access: { Args: { p_routine_id: string }; Returns: boolean };
      invite_client: {
        Args: { p_client_id: string; p_mode: string; p_value: string };
        Returns: Json;
      };
      is_active_link: {
        Args: { p_coach: string; p_student: string };
        Returns: boolean;
      };
      is_day_owner: { Args: { p_day_id: string }; Returns: boolean };
      is_exercise_owner: { Args: { p_exercise_id: string }; Returns: boolean };
      is_my_student: { Args: { p_profile_id: string }; Returns: boolean };
      is_plan_owner: { Args: { p_plan_id: string }; Returns: boolean };
      is_routine_owner: { Args: { p_routine_id: string }; Returns: boolean };
      leave_coach: { Args: { p_link_id: string }; Returns: undefined };
      meal_plan: { Args: { p_meal_id: string }; Returns: string };
      option_plan: { Args: { p_option_id: string }; Returns: string };
      owns_exercise_log: { Args: { p_log_id: string }; Returns: boolean };
      owns_session: { Args: { p_session_id: string }; Returns: boolean };
      remove_client_access: {
        Args: { p_client_id: string };
        Returns: undefined;
      };
      resolve_catalog_entry: {
        Args: { p_name: string; p_owner: string };
        Returns: string;
      };
      respond_invitation: {
        Args: { p_accept: boolean; p_link_id: string };
        Returns: undefined;
      };
      save_client: { Args: { p_data: Json; p_id: string }; Returns: string };
      save_full_plan: {
        Args: { p_data: Json; p_plan_id: string };
        Returns: string;
      };
      set_client_archived: {
        Args: { p_archived: boolean; p_client_id: string };
        Returns: undefined;
      };
      set_current_plan: { Args: { p_plan_id: string }; Returns: undefined };
      set_current_routine: {
        Args: { p_routine_id: string };
        Returns: undefined;
      };
      shared_a_routine_with_me: {
        Args: { p_profile_id: string };
        Returns: boolean;
      };
      trained_day: { Args: { p_day_id: string }; Returns: boolean };
      trained_exercise: { Args: { p_exercise_id: string }; Returns: boolean };
      unlink_student: {
        Args: { p_keep_routines?: boolean; p_link_id: string };
        Returns: undefined;
      };
      update_full_routine: {
        Args: {
          p_days: Json;
          p_folder_id: string;
          p_name: string;
          p_routine_id: string;
        };
        Returns: string;
      };
      update_session_logs: {
        Args: { p_logs: Json; p_session_id: string };
        Returns: undefined;
      };
      username_available: { Args: { p_username: string }; Returns: boolean };
      validate_add_student: {
        Args: { p_mode: string; p_value: string };
        Returns: string;
      };
      validate_invite_client: {
        Args: { p_client_id: string; p_mode: string; p_value: string };
        Returns: string;
      };
    };
    Enums: {
      session_status: "in_progress" | "finished" | "abandoned";
      share_status: "pending" | "accepted";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      session_status: ["in_progress", "finished", "abandoned"],
      share_status: ["pending", "accepted"],
    },
  },
} as const;
