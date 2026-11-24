import type { MergeDeep } from "type-fest";

import type { ClientInput } from "./clients";
import type { Database as GeneratedDatabase } from "./database.generated";
import type { PlanInput } from "./nutrition";

/**
 * Tipos de la base de datos.
 *
 * - `database.generated.ts` sale de la base (`npm run db:types` con el
 *   Supabase local levantado). No se edita a mano; el CI falla si no coincide
 *   con las migraciones.
 * - Acá se agregan los tipos de dominio y se afinan, con `MergeDeep`, los
 *   tipos que Postgres no puede expresar: columnas `text` con `check`
 *   (estados, sexo, objetivo…), argumentos de RPC que aceptan null y payloads
 *   JSON con forma conocida.
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
  /** Descanso entre series en segundos (null = sin descanso). */
  rest_seconds?: number | null;
};
export type RoutineDayInput = {
  id?: string;
  name: string;
  exercises: ExerciseInput[];
};

/** Invitación del coach vista por el alumno: pendiente o aceptada. */
export type LinkStatus = "pending" | "active";

/** Acceso a la app de un cliente: sin app, invitado o usándola. */
export type AppAccess = "none" | LinkStatus;

export type ClientSex = "femenino" | "masculino" | "otro";
export type ClientGoal =
  "bajar_peso" | "ganar_masa" | "tonificar" | "rendimiento" | "salud" | "otro";
export type ClientLevel = "principiante" | "intermedio" | "avanzado";

/** Validación en vivo al invitar un cliente a la app. */
export type InviteStatus =
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

export type { Json } from "./database.generated";

type Narrow<Row, Insert = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Row>;
};

export type Database = MergeDeep<
  GeneratedDatabase,
  {
    public: {
      Tables: {
        coach_students: Narrow<{
          status: AppAccess;
          sex: ClientSex | null;
          goal: ClientGoal | null;
          level: ClientLevel | null;
        }>;
        exercise_catalog: Narrow<
          { muscle_group: MuscleGroup },
          { muscle_group: MuscleGroup }
        >;
      };
      Functions: {
        create_full_routine: {
          Args: {
            p_folder_id: string | null;
            p_days: RoutineDayInput[];
            p_link_id?: string | null;
          };
        };
        update_full_routine: {
          Args: { p_folder_id: string | null; p_days: RoutineDayInput[] };
        };
        copy_routine: { Args: { p_link_id?: string | null } };
        copy_nutrition_plan: { Args: { p_client_id?: string | null } };
        update_session_logs: { Args: { p_logs: SessionLogUpdate[] } };
        save_client: { Args: { p_id: string | null; p_data: ClientInput } };
        save_full_plan: {
          Args: { p_plan_id: string | null; p_data: PlanInput };
        };
        validate_invite_client: {
          Args: { p_mode: "email" | "username" };
          Returns: InviteStatus;
        };
        invite_client: {
          Args: { p_mode: "email" | "username" };
          Returns: { existed: boolean; email: string };
        };
        get_my_coaches: {
          Returns: {
            link_id: string;
            coach_id: string;
            status: LinkStatus;
            created_at: string;
          }[];
        };
      };
    };
  }
>;

// Helpers de conveniencia.
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Profile = Tables<"profiles">;
export type Folder = Tables<"folders">;
export type Routine = Tables<"routines">;
export type NutritionPlan = Tables<"nutrition_plans">;
export type RoutineDay = Tables<"routine_days">;
export type Exercise = Tables<"exercises">;
export type WorkoutSession = Tables<"workout_sessions">;
export type ExerciseLog = Tables<"exercise_logs">;
export type SetLog = Tables<"set_logs">;
