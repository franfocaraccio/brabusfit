/**
 * Usuarios de demo para la web pública: un coach y un alumno con datos
 * inventados (clientes, plantillas, rutinas, un plan de nutrición y ~10
 * semanas de entrenamientos para que se vean los gráficos de progreso).
 *
 * Es IDEMPOTENTE: si los usuarios demo ya existen los borra (con todo lo suyo,
 * en cascada) y los vuelve a crear. Sirve también para limpiar lo que hayan
 * cambiado los visitantes.
 *
 * Usa la capa de datos de la app (`packages/supabase`) con las sesiones de
 * los propios usuarios demo, así que pasa por RLS como cualquier usuario. La
 * clave secreta solo se usa para crear/borrar los usuarios y para fechar las
 * sesiones en el pasado.
 *
 * Uso (desde la raíz; las variables NO se commitean):
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_PUBLISHABLE_KEY=sb_publishable_... \
 *   SUPABASE_SECRET_KEY=sb_secret_... \
 *   npm run seed:demo
 *
 * Opcional: DEMO_PASSWORD (por defecto la que figura en el README).
 * Ver SETUP.md → "Usuarios de demo".
 */
import { createClient } from "@supabase/supabase-js";

import {
  EMPTY_CLIENT,
  emptyItem,
  type Database,
  type PlanInput,
  type RoutineDayInput,
} from "@brabus/shared";
import {
  copyRoutine,
  createFolder,
  createNutritionFolder,
  createRoutine,
  getCatalog,
  getMyCoaches,
  getTrainingDay,
  inviteClient,
  respondInvitation,
  saveClient,
  savePlan,
  saveWorkout,
  setCurrentPlan,
  setCurrentRoutine,
  type BrabusClient,
} from "@brabus/supabase";

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "brabusfit-demo";
const COACH = {
  email: "coach.demo@brabusfit.test",
  username: "coach_demo",
  first_name: "Martina",
  last_name: "Sosa",
  is_coach: true,
};
const STUDENT = {
  email: "alumno.demo@brabusfit.test",
  username: "alumno_demo",
  first_name: "Lucas",
  last_name: "Benítez",
  is_coach: false,
};
/** Semanas de historial de entrenamientos del alumno. */
const WEEKS = 10;

function env(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(
      `Falta la variable ${name}. Ver el comentario de este archivo.`,
    );
    process.exit(1);
  }
  return v;
}

const URL = env("SUPABASE_URL");
const PUBLISHABLE = env("SUPABASE_PUBLISHABLE_KEY");
const SECRET = env("SUPABASE_SECRET_KEY");

const noSession = { persistSession: false, autoRefreshToken: false };
const admin = createClient<Database>(URL, SECRET, { auth: noSession });

function must<T>(
  res: { ok: true; data: T } | { ok: false; error: string },
  what: string,
): T {
  if (!res.ok) throw new Error(`${what}: ${res.error}`);
  return res.data;
}

// ---------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------

async function findUserId(email: string): Promise<string | null> {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    const user = data.users.find((u) => u.email === email);
    if (user) return user.id;
    if (data.users.length < 1000) return null;
  }
}

/** Borra el usuario demo y todo lo suyo (las tablas cuelgan de profiles en cascada). */
async function removeUser(email: string) {
  const id = await findUserId(email);
  if (!id) return;
  // Primero las rutinas: sus ejercicios pueden apuntar a ejercicios propios
  // del catálogo (on delete restrict).
  await admin.from("routines").delete().eq("owner_id", id);
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw error;
  console.log(`  borrado ${email}`);
}

async function createUser(
  u: typeof COACH,
): Promise<{ id: string; client: BrabusClient }> {
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    // handle_new_user arma el perfil con estos datos.
    user_metadata: {
      first_name: u.first_name,
      last_name: u.last_name,
      username: u.username,
      is_coach: u.is_coach,
    },
  });
  if (error) throw error;
  const id = data.user.id;
  await admin
    .from("profiles")
    .update({
      first_name: u.first_name,
      last_name: u.last_name,
      username: u.username,
      is_coach: u.is_coach,
      onboarded: true,
    })
    .eq("id", id);

  const client = createClient<Database>(URL, PUBLISHABLE, { auth: noSession });
  const { error: signInError } = await client.auth.signInWithPassword({
    email: u.email,
    password: DEMO_PASSWORD,
  });
  if (signInError) throw signInError;
  console.log(`  creado ${u.email}`);
  return { id, client };
}

// ---------------------------------------------------------------------------
// Contenido
// ---------------------------------------------------------------------------

type Ex = { name: string; sets: string; rest?: number; variant?: string };

function days(
  catalog: Map<string, string>,
  spec: [string, Ex[]][],
): RoutineDayInput[] {
  return spec.map(([name, exercises]) => ({
    name,
    exercises: exercises.map((e) => {
      const id = catalog.get(e.name);
      if (!id) throw new Error(`No está en el catálogo: ${e.name}`);
      return {
        catalog_id: id,
        variant: e.variant ?? null,
        sets_reps: e.sets,
        rest_seconds: e.rest ?? null,
      };
    }),
  }));
}

const FULL_BODY: [string, Ex[]][] = [
  [
    "Día A - Empuje",
    [
      { name: "Press banca con barra", sets: "4x6-8", rest: 120 },
      { name: "Press militar con mancuernas", sets: "3x8-10", rest: 90 },
      { name: "Extensión de tríceps en polea", sets: "3x12", rest: 60 },
    ],
  ],
  [
    "Día B - Tirón",
    [
      { name: "Remo con barra", sets: "4x8", rest: 120 },
      { name: "Jalón al pecho", sets: "3x10", rest: 90 },
      { name: "Curl con barra", sets: "3x10-12", rest: 60 },
    ],
  ],
  [
    "Día C - Pierna",
    [
      { name: "Sentadilla con barra", sets: "4x5", rest: 150 },
      { name: "Peso muerto", sets: "3x5", rest: 150 },
      { name: "Sentadilla goblet", sets: "3x12", rest: 60 },
    ],
  ],
];

const TORSO_PIERNA: [string, Ex[]][] = [
  [
    "Torso",
    [
      { name: "Press inclinado con mancuernas", sets: "4x8-10", rest: 90 },
      { name: "Remo en polea baja", sets: "4x10", rest: 90 },
      { name: "Vuelos laterales", sets: "3x15", rest: 45 },
    ],
  ],
  [
    "Pierna",
    [
      { name: "Sentadilla con barra", sets: "4x8", rest: 120 },
      { name: "Sentadilla búlgara", sets: "3x10", rest: 90 },
    ],
  ],
];

const item = (
  food: string,
  amount: string,
  unit: string,
  kcal: string,
  protein: string,
  carbs: string,
  fat: string,
) => ({ ...emptyItem(), food, amount, unit, kcal, protein, carbs, fat });

const PLAN: PlanInput = {
  name: "Recomposición 2400",
  folder_id: null,
  guidelines:
    "Tomar 2,5 L de agua por día.\nPriorizar proteína en cada comida.\nEvitar ultraprocesados.",
  target_kcal: "2400",
  target_protein: "160",
  target_carbs: "260",
  target_fat: "75",
  target_water_l: "2.5",
  meals: [
    {
      name: "Desayuno",
      time_label: "8:00",
      options: [
        {
          items: [
            item("Avena", "80", "g", "300", "11", "54", "6"),
            item("Yogur griego", "170", "g", "160", "17", "6", "8"),
            item("Banana", "1", "unidad", "105", "1", "27", "0"),
          ],
        },
        {
          items: [
            item("Tostadas integrales", "2", "rebanada", "160", "8", "28", "2"),
            item("Huevos", "3", "unidades", "210", "18", "2", "15"),
          ],
        },
      ],
    },
    {
      name: "Almuerzo",
      time_label: "13:00",
      options: [
        {
          items: [
            item("Pechuga de pollo", "200", "g", "330", "62", "0", "7"),
            item("Arroz integral", "150", "g", "170", "4", "36", "1"),
            item("Ensalada mixta", "1", "porción", "60", "2", "10", "1"),
          ],
        },
      ],
    },
    {
      name: "Merienda",
      time_label: "17:00",
      options: [
        {
          items: [
            item("Leche descremada", "250", "ml", "90", "9", "12", "0"),
            item("Mantequilla de maní", "1", "cda", "95", "4", "3", "8"),
          ],
        },
      ],
    },
    {
      name: "Cena",
      time_label: "21:00",
      options: [
        {
          items: [
            item("Salmón", "180", "g", "370", "40", "0", "22"),
            item("Papa", "200", "g", "155", "4", "35", "0"),
            item("Brócoli", "150", "g", "50", "4", "10", "0"),
          ],
        },
      ],
    },
  ],
};

/** Peso inicial (kg) de cada ejercicio; sube a lo largo de las semanas. */
const START_WEIGHT: Record<string, number> = {
  "Press banca con barra": 50,
  "Press militar con mancuernas": 14,
  "Extensión de tríceps en polea": 20,
  "Remo con barra": 45,
  "Jalón al pecho": 40,
  "Curl con barra": 22.5,
  "Sentadilla con barra": 60,
  "Peso muerto": 70,
  "Sentadilla goblet": 16,
};

/** Fecha de la sesión: semanas atrás, lunes/miércoles/viernes, 19 h. */
function sessionDate(weeksAgo: number, dayIndex: number): Date {
  const d = new Date();
  d.setHours(19, 0, 0, 0);
  const sinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - sinceMonday - weeksAgo * 7 + dayIndex * 2);
  return d;
}

// ---------------------------------------------------------------------------

async function main() {
  console.log(`Supabase: ${URL}`);
  console.log("1) Borrando usuarios demo anteriores…");
  await removeUser(STUDENT.email);
  await removeUser(COACH.email);

  console.log("2) Creando usuarios…");
  const coach = await createUser(COACH);
  const student = await createUser(STUDENT);

  const catalog = new Map(
    (await getCatalog(coach.client, coach.id)).map((c) => [c.name, c.id]),
  );

  console.log("3) Carpetas y plantillas del coach…");
  must(await createFolder(coach.client, "Fuerza"), "carpeta Fuerza");
  must(await createFolder(coach.client, "Hipertrofia"), "carpeta Hipertrofia");
  const { data: folders } = await coach.client
    .from("folders")
    .select("id, name")
    .eq("owner_id", coach.id);
  const folderId = (name: string) =>
    folders?.find((f) => f.name === name)?.id ?? null;

  const fullBody = must(
    await createRoutine(coach.client, {
      name: "Full body 3 días",
      folderId: folderId("Fuerza"),
      days: days(catalog, FULL_BODY),
    }),
    "plantilla Full body",
  );
  must(
    await createRoutine(coach.client, {
      name: "Torso / Pierna",
      folderId: folderId("Hipertrofia"),
      days: days(catalog, TORSO_PIERNA),
    }),
    "plantilla Torso / Pierna",
  );

  console.log("4) Clientes…");
  const lucas = must(
    await saveClient(coach.client, null, {
      ...EMPTY_CLIENT,
      first_name: STUDENT.first_name,
      last_name: STUDENT.last_name,
      email: STUDENT.email,
      birth_date: "1996-03-14",
      sex: "masculino",
      height_cm: "178",
      initial_weight_kg: "81",
      goal: "ganar_masa",
      level: "intermedio",
      notes: "Entrena después del trabajo. Quiere llegar a 100 kg en banca.",
    }),
    "cliente Lucas",
  ).id;
  const sofia = must(
    await saveClient(coach.client, null, {
      ...EMPTY_CLIENT,
      first_name: "Sofía",
      last_name: "Gómez",
      phone: "+54 9 11 5555-0102",
      birth_date: "1992-08-02",
      sex: "femenino",
      height_cm: "165",
      initial_weight_kg: "63",
      goal: "tonificar",
      level: "principiante",
      injuries: "Molestia en rodilla derecha: evitar saltos.",
    }),
    "cliente Sofía",
  ).id;
  must(
    await saveClient(coach.client, null, {
      ...EMPTY_CLIENT,
      first_name: "Martín",
      last_name: "Pérez",
      goal: "salud",
      level: "principiante",
    }),
    "cliente Martín",
  );

  // Lucas usa la app: invitación + aceptación.
  must(
    await inviteClient(coach.client, lucas, "email", STUDENT.email),
    "invitar a Lucas",
  );
  const link = (await getMyCoaches(student.client, student.id)).find(
    (c) => c.coachId === coach.id,
  );
  if (!link) throw new Error("No llegó la invitación al alumno demo.");
  must(await respondInvitation(student.client, link.linkId, true), "aceptar");

  console.log("5) Rutinas y plan de los clientes…");
  const lucasRoutine = must(
    await copyRoutine(coach.client, fullBody.id, lucas),
    "copia para Lucas",
  ).id;
  must(await setCurrentRoutine(coach.client, lucasRoutine), "rutina vigente");
  const sofiaRoutine = must(
    await copyRoutine(coach.client, fullBody.id, sofia),
    "copia para Sofía",
  ).id;
  must(await setCurrentRoutine(coach.client, sofiaRoutine), "rutina vigente");

  const plansFolder = must(
    await createNutritionFolder(coach.client, "Planes base"),
    "carpeta de planes",
  ).id;
  must(
    await savePlan(coach.client, null, { ...PLAN, folder_id: plansFolder }),
    "plantilla de plan",
  );
  const lucasPlan = must(
    await savePlan(coach.client, null, { ...PLAN, client_id: lucas }),
    "plan de Lucas",
  ).id;
  must(await setCurrentPlan(coach.client, lucasPlan), "plan vigente");

  console.log(`6) ${WEEKS} semanas de entrenamientos de Lucas…`);
  const { data: routineDays } = await student.client
    .from("routine_days")
    .select("id, position")
    .eq("routine_id", lucasRoutine)
    .order("position");
  let sessions = 0;
  for (let week = WEEKS - 1; week >= 0; week--) {
    for (const [i, day] of (routineDays ?? []).entries()) {
      // Se saltea algún día suelto, como en la vida real, y los días de esta
      // semana que todavía no pasaron.
      if ((week * 3 + i) % 7 === 5) continue;
      const start = sessionDate(week, i);
      if (start.getTime() > Date.now() - 2 * 3_600_000) continue;
      const training = await getTrainingDay(student.client, {
        userId: student.id,
        routineId: lucasRoutine,
        dayId: day.id,
      });
      if (!training) throw new Error("No se encontró el día de la rutina.");
      const progress = WEEKS - 1 - week; // 0 → 9
      const logs = training.exercises.map((ex) => {
        const base = START_WEIGHT[ex.name] ?? 20;
        const step = base >= 40 ? 2.5 : 1;
        const weight = base + Math.floor(progress / 2) * step;
        const reps = [8, 8, 7, 6].slice(0, ex.setsReps.startsWith("4") ? 4 : 3);
        return {
          exerciseId: ex.id,
          note: null,
          variant: null,
          sets: reps.map((r, n) => ({
            set_number: n + 1,
            weight,
            reps: r + (progress % 2),
          })),
        };
      });
      must(
        await saveWorkout(
          student.client,
          lucasRoutine,
          day.id,
          logs,
          start.toISOString(),
        ),
        "guardar sesión",
      );
      // saveWorkout la cierra "ahora": se lleva al día que corresponde.
      const { data: last } = await admin
        .from("workout_sessions")
        .select("id")
        .eq("user_id", student.id)
        .order("finished_at", { ascending: false })
        .limit(1)
        .single();
      const end = new Date(start.getTime() + (55 + ((i * 7) % 15)) * 60_000);
      await admin
        .from("workout_sessions")
        .update({
          started_at: start.toISOString(),
          finished_at: end.toISOString(),
        })
        .eq("id", last!.id);
      sessions++;
    }
  }

  await coach.client.auth.signOut();
  await student.client.auth.signOut();
  console.log(`Listo: ${sessions} sesiones.`);
  console.log(`  Coach:  ${COACH.email}`);
  console.log(`  Alumno: ${STUDENT.email}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
