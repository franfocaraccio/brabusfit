/**
 * Tests de tipos: los afinados de database.ts sobre los tipos generados. Si
 * alguno deja de aplicar (por ejemplo, al regenerar), falla el typecheck.
 */
import { describe, expectTypeOf, it } from "vitest";

import type {
  AppAccess,
  ClientGoal,
  Database,
  InviteStatus,
  LinkStatus,
  MuscleGroup,
  RoutineDayInput,
  SessionStatus,
  Tables,
} from "./database";

type Fn<N extends keyof Database["public"]["Functions"]> =
  Database["public"]["Functions"][N];

describe("Database types", () => {
  it("narrows text columns with check constraints", () => {
    expectTypeOf<Tables<"coach_students">["status"]>().toEqualTypeOf<AppAccess>();
    expectTypeOf<Tables<"coach_students">["goal"]>().toEqualTypeOf<ClientGoal | null>();
    expectTypeOf<Tables<"exercise_catalog">["muscle_group"]>().toEqualTypeOf<MuscleGroup>();
    expectTypeOf<Tables<"workout_sessions">["status"]>().toEqualTypeOf<SessionStatus>();
  });

  it("keeps the generated columns", () => {
    expectTypeOf<Tables<"exercises">["rest_seconds"]>().toEqualTypeOf<number | null>();
    expectTypeOf<Tables<"exercise_logs">["variant"]>().toEqualTypeOf<string | null>();
  });

  it("types RPC arguments and results", () => {
    expectTypeOf<Fn<"create_full_routine">["Args"]["p_days"]>().toEqualTypeOf<
      RoutineDayInput[]
    >();
    expectTypeOf<Fn<"create_full_routine">["Args"]["p_folder_id"]>().toEqualTypeOf<
      string | null
    >();
    expectTypeOf<Fn<"validate_invite_client">["Returns"]>().toEqualTypeOf<InviteStatus>();
    expectTypeOf<
      Fn<"get_my_coaches">["Returns"][number]["status"]
    >().toEqualTypeOf<LinkStatus>();
  });
});
