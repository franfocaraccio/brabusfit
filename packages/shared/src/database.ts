/**
 * Tipos de la base de datos. Mantener en sync con supabase/migrations.
 * (Se puede regenerar con `supabase gen types typescript` cuando se use el CLI.)
 */

export type ShareStatus = "pending" | "accepted";
export type SessionStatus = "in_progress" | "finished" | "abandoned";

// Forma del payload que reciben las RPC create_full_routine / update_full_routine.
export type ExerciseInput = {
  id?: string;
  /** Ejercicio del catálogo (la app actual siempre lo manda). */
  catalog_id?: string;
  /** Aclaración opcional: "Mancuernas / Smith". */
  variant?: string | null;
  /** Solo para compatibilidad: sin catalog_id, la base busca por nombre. */
  name?: string;
  sets_reps: string;
};
export type RoutineDayInput = {
  id?: string;
  name: string;
  exercises: ExerciseInput[];
};

/** Vínculo coach ↔ alumno: invitación pendiente o activo. */
export type LinkStatus = "pending" | "active";

/** Validación en vivo al agregar un alumno. */
export type AddStudentStatus =
  | "forbidden"
  | "invalid"
  | "not_found"
  | "self"
  | "coach"
  | "already"
  | "existing"
  | "new";

export type MuscleGroup =
  | "pecho"
  | "espalda"
  | "hombros"
  | "biceps"
  | "triceps"
  | "antebrazos"
  | "cuadriceps"
  | "isquiotibiales"
  | "gluteos"
  | "aductores"
  | "pantorrillas"
  | "core"
  | "full_body"
  | "otros";

/** Payload de update_session_logs: series y detalle nuevos de un ejercicio. */
export type SessionLogUpdate = {
  log_id: string;
  note: string | null;
  sets: { weight: number | null; reps: number | null }[];
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
          /** Alumno al que el coach le asignó la rutina (null = plantilla o rutina propia). */
          student_id: string | null;
          /** Email del alumno asignado (también mientras no tiene cuenta). */
          student_email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          folder_id?: string | null;
          name: string;
          student_id?: string | null;
          student_email?: string | null;
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
          /** Etiqueta calculada por la base: "Nombre del catálogo (variante)". */
          name: string;
          catalog_id: string;
          variant: string | null;
          sets_reps: string;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          day_id: string;
          name?: string;
          catalog_id?: string;
          variant?: string | null;
          sets_reps: string;
          position?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["exercises"]["Insert"]>;
        Relationships: [];
      };
      exercise_catalog: {
        Row: {
          id: string;
          name: string;
          muscle_group: MuscleGroup;
          /** null = catálogo general; si no, ejercicio propio de ese usuario. */
          owner_id: string | null;
          name_key: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          muscle_group: MuscleGroup;
          owner_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["exercise_catalog"]["Insert"]>;
        Relationships: [];
      };
      coach_students: {
        Row: {
          id: string;
          coach_id: string;
          /** null mientras el email invitado no tiene cuenta. */
          student_id: string | null;
          student_email: string;
          status: LinkStatus;
          created_at: string;
          accepted_at: string | null;
        };
        // Altas y cambios solo por RPC (add_student, respond_invitation, ...).
        Insert: { coach_id: string; student_email: string };
        Update: Record<string, never>;
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
          /** Vínculo con el alumno: crea la rutina asignada a él. */
          p_link_id?: string | null;
        };
        Returns: string;
      };
      copy_routine: {
        /** Sin p_link_id: copia como plantilla nueva. */
        Args: { p_routine_id: string; p_link_id?: string | null };
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
      username_available: {
        Args: { p_username: string };
        Returns: boolean;
      };
      update_session_logs: {
        Args: { p_session_id: string; p_logs: SessionLogUpdate[] };
        Returns: undefined;
      };
      validate_add_student: {
        Args: { p_mode: "email" | "username"; p_value: string };
        Returns: AddStudentStatus;
      };
      add_student: {
        Args: { p_mode: "email" | "username"; p_value: string };
        Returns: { id: string; existed: boolean; email: string };
      };
      respond_invitation: {
        Args: { p_link_id: string; p_accept: boolean };
        Returns: undefined;
      };
      unlink_student: {
        Args: { p_link_id: string };
        Returns: undefined;
      };
      leave_coach: {
        Args: { p_link_id: string };
        Returns: undefined;
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
export type WorkoutSession = Tables<"workout_sessions">;
export type ExerciseLog = Tables<"exercise_logs">;
export type SetLog = Tables<"set_logs">;
