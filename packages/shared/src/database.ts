/**
 * Tipos de la base de datos. Mantener en sync con supabase/migrations.
 * (Se puede regenerar con `supabase gen types typescript` cuando se use el CLI.)
 */

export type ShareStatus = "pending" | "accepted";
export type SessionStatus = "in_progress" | "finished" | "abandoned";

// Estado de un email al validarlo para compartir (RPC validate_share_email).
export type ShareEmailStatus =
  | "invalid"
  | "forbidden"
  | "self"
  | "coach"
  | "already"
  | "existing"
  | "new";

// Estado de un username al validarlo para compartir (RPC validate_share_username).
export type ShareUsernameStatus =
  | "invalid"
  | "forbidden"
  | "not_found"
  | "self"
  | "coach"
  | "already"
  | "existing";

// Forma del payload que reciben las RPC create_full_routine / update_full_routine.
export type ExerciseInput = {
  id?: string;
  name: string;
  sets_reps: string;
};
export type RoutineDayInput = {
  id?: string;
  name: string;
  exercises: ExerciseInput[];
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          birth_date: string | null;
          height_cm: number | null;
          weight_kg: number | null;
          is_coach: boolean;
          onboarded: boolean;
          username: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          first_name: string;
          last_name: string;
          birth_date?: string | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          is_coach?: boolean;
          onboarded?: boolean;
          username?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      folders: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          parent_folder_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          parent_folder_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["folders"]["Insert"]>;
        Relationships: [];
      };
      routines: {
        Row: {
          id: string;
          owner_id: string;
          folder_id: string | null;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          folder_id?: string | null;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["routines"]["Insert"]>;
        Relationships: [];
      };
      routine_days: {
        Row: {
          id: string;
          routine_id: string;
          name: string;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          routine_id: string;
          name: string;
          position?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["routine_days"]["Insert"]>;
        Relationships: [];
      };
      exercises: {
        Row: {
          id: string;
          day_id: string;
          name: string;
          sets_reps: string;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          day_id: string;
          name: string;
          sets_reps: string;
          position?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["exercises"]["Insert"]>;
        Relationships: [];
      };
      routine_shares: {
        Row: {
          id: string;
          routine_id: string;
          shared_by: string;
          shared_with_email: string;
          shared_with_user_id: string | null;
          status: ShareStatus;
          created_at: string;
          accepted_at: string | null;
        };
        Insert: {
          id?: string;
          routine_id: string;
          shared_by: string;
          shared_with_email: string;
          shared_with_user_id?: string | null;
          status?: ShareStatus;
          created_at?: string;
          accepted_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["routine_shares"]["Insert"]
        >;
        Relationships: [];
      };
      workout_sessions: {
        Row: {
          id: string;
          user_id: string;
          routine_id: string;
          day_id: string;
          started_at: string;
          finished_at: string | null;
          status: SessionStatus;
        };
        Insert: {
          id?: string;
          user_id: string;
          routine_id: string;
          day_id: string;
          started_at?: string;
          finished_at?: string | null;
          status?: SessionStatus;
        };
        Update: Partial<
          Database["public"]["Tables"]["workout_sessions"]["Insert"]
        >;
        Relationships: [];
      };
      exercise_logs: {
        Row: {
          id: string;
          session_id: string;
          exercise_id: string;
          completed: boolean;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          exercise_id: string;
          completed?: boolean;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["exercise_logs"]["Insert"]
        >;
        Relationships: [];
      };
      set_logs: {
        Row: {
          id: string;
          exercise_log_id: string;
          set_number: number;
          weight: number | null;
          reps: number | null;
        };
        Insert: {
          id?: string;
          exercise_log_id: string;
          set_number: number;
          weight?: number | null;
          reps?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["set_logs"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      create_full_routine: {
        Args: {
          p_name: string;
          p_folder_id: string | null;
          p_days: RoutineDayInput[];
        };
        Returns: string;
      };
      update_full_routine: {
        Args: {
          p_routine_id: string;
          p_name: string;
          p_folder_id: string | null;
          p_days: RoutineDayInput[];
        };
        Returns: string;
      };
      share_routine: {
        Args: { p_routine_id: string; p_email: string };
        Returns: { existed: boolean; email: string };
      };
      validate_share_email: {
        Args: { p_routine_id: string; p_email: string };
        Returns: ShareEmailStatus;
      };
      validate_share_username: {
        Args: { p_routine_id: string; p_username: string };
        Returns: ShareUsernameStatus;
      };
      share_routine_by_username: {
        Args: { p_routine_id: string; p_username: string };
        Returns: { existed: boolean; email: string };
      };
      username_available: {
        Args: { p_username: string };
        Returns: boolean;
      };
    };
    Enums: {
      share_status: ShareStatus;
      session_status: SessionStatus;
    };
    CompositeTypes: Record<never, never>;
  };
};

// Helpers de conveniencia.
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Profile = Tables<"profiles">;
export type Folder = Tables<"folders">;
export type Routine = Tables<"routines">;
export type RoutineDay = Tables<"routine_days">;
export type Exercise = Tables<"exercises">;
export type RoutineShare = Tables<"routine_shares">;
export type WorkoutSession = Tables<"workout_sessions">;
export type ExerciseLog = Tables<"exercise_logs">;
export type SetLog = Tables<"set_logs">;
