-- ============================================================================
-- Brabus Fit — Catálogo de ejercicios
-- ============================================================================
-- - exercise_catalog: ejercicios generales (owner_id null) + propios de cada
--   usuario (solo los ve quien los creó).
-- - exercises (el ejercicio dentro de un día de rutina) pasa a apuntar al
--   catálogo (catalog_id) con una variante opcional ("Mancuernas / Smith").
-- - exercises.name se mantiene como etiqueta calculada ("Nombre (variante)"),
--   así todo lo que ya lee "name" sigue funcionando.
-- - Compatibilidad: si llega un ejercicio solo con nombre (app vieja), se busca
--   en el catálogo y, si no existe, se crea como ejercicio propio del dueño.
-- ============================================================================

-- Clave de comparación: sin tildes, minúsculas, espacios simples ------------
create or replace function public.exercise_key(p text)
returns text language sql immutable as $$
  select btrim(regexp_replace(
    lower(translate(coalesce(p, ''), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')),
    '\s+', ' ', 'g'))
$$;

-- Catálogo ------------------------------------------------------------------
create table if not exists public.exercise_catalog (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (btrim(name) <> ''),
  muscle_group text not null check (muscle_group in (
    'pecho', 'espalda', 'hombros', 'biceps', 'triceps', 'antebrazos',
    'cuadriceps', 'isquiotibiales', 'gluteos', 'aductores', 'pantorrillas',
    'core', 'full_body', 'otros')),
  owner_id     uuid references public.profiles(id) on delete cascade,
  name_key     text generated always as (public.exercise_key(name)) stored,
  created_at   timestamptz not null default now()
);

-- Un nombre por dueño (y uno solo en el catálogo general).
create unique index if not exists exercise_catalog_name_unique
  on public.exercise_catalog (
    coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid), name_key);
create index if not exists exercise_catalog_owner_idx on public.exercise_catalog (owner_id);

-- Un ejercicio propio no puede repetir uno del catálogo general.
create or replace function public.exercise_catalog_check_general()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.owner_id is not null and exists (
    select 1 from public.exercise_catalog
    where owner_id is null and name_key = public.exercise_key(new.name)
  ) then
    raise exception 'Ese ejercicio ya existe en el catálogo.' using errcode = '23505';
  end if;
  return new;
end; $$;

drop trigger if exists exercise_catalog_check_general on public.exercise_catalog;
create trigger exercise_catalog_check_general
  before insert or update of name on public.exercise_catalog
  for each row execute function public.exercise_catalog_check_general();

-- Ejercicios generales precargados -------------------------------------------
insert into public.exercise_catalog (name, muscle_group) values
  -- Pecho
  ('Press banca con barra', 'pecho'), ('Press banca con mancuernas', 'pecho'),
  ('Press plano en Smith', 'pecho'), ('Press inclinado con barra', 'pecho'),
  ('Press inclinado con mancuernas', 'pecho'), ('Press inclinado en Smith', 'pecho'),
  ('Press declinado con barra', 'pecho'), ('Press en máquina', 'pecho'),
  ('Press inclinado en máquina', 'pecho'), ('Aperturas con mancuernas', 'pecho'),
  ('Aperturas inclinadas con mancuernas', 'pecho'), ('Cruce de poleas', 'pecho'),
  ('Pec deck', 'pecho'), ('Flexiones de brazos', 'pecho'),
  -- Espalda
  ('Dominadas', 'espalda'), ('Dominadas supinas', 'espalda'),
  ('Jalón al pecho', 'espalda'), ('Jalón al pecho agarre cerrado', 'espalda'),
  ('Jalón tras nuca', 'espalda'), ('Remo con barra', 'espalda'),
  ('Remo con mancuerna a una mano', 'espalda'), ('Remo a un brazo', 'espalda'),
  ('Remo en polea baja', 'espalda'), ('Remo a caballo (barra T)', 'espalda'),
  ('Remo a caballo', 'espalda'), ('Remo a caballo en máquina', 'espalda'),
  ('Remo en máquina', 'espalda'), ('Pull over en polea alta', 'espalda'),
  ('Peso muerto', 'espalda'), ('Hiperextensiones lumbares', 'espalda'),
  ('Remo invertido', 'espalda'),
  -- Hombros
  ('Press militar con barra', 'hombros'), ('Press militar', 'hombros'),
  ('Press militar con mancuernas', 'hombros'), ('Press militar en máquina', 'hombros'),
  ('Press Arnold', 'hombros'), ('Vuelos laterales', 'hombros'),
  ('Vuelos laterales sentado', 'hombros'), ('Vuelos laterales en polea', 'hombros'),
  ('Vuelos frontales', 'hombros'), ('Vuelos posteriores (pájaros)', 'hombros'),
  ('Pec deck invertido', 'hombros'), ('Face pull', 'hombros'),
  ('Remo al mentón', 'hombros'), ('Encogimientos de hombros', 'hombros'),
  -- Bíceps
  ('Curl con barra', 'biceps'), ('Curl con barra Z', 'biceps'),
  ('Curl de bíceps con mancuernas', 'biceps'), ('Curl de bíceps martillo', 'biceps'),
  ('Curl concentrado', 'biceps'), ('Curl en banco Scott', 'biceps'),
  ('Curl en polea', 'biceps'), ('Curl inclinado con mancuernas', 'biceps'),
  -- Tríceps
  ('Press francés', 'triceps'), ('Extensión de tríceps en polea', 'triceps'),
  ('Extensión de tríceps con soga', 'triceps'), ('Extensión de tríceps tras nuca', 'triceps'),
  ('Patada de tríceps', 'triceps'), ('Patada de tríceps en polea', 'triceps'),
  ('Fondos en paralelas', 'triceps'), ('Fondos en banco', 'triceps'),
  ('Press banca agarre cerrado', 'triceps'), ('Extensión de tríceps a una mano', 'triceps'),
  -- Antebrazos
  ('Curl de muñeca', 'antebrazos'), ('Curl de muñeca inverso', 'antebrazos'),
  ('Paseo del granjero', 'antebrazos'),
  -- Cuádriceps
  ('Sentadilla con barra', 'cuadriceps'), ('Sentadilla', 'cuadriceps'),
  ('Sentadilla frontal', 'cuadriceps'), ('Sentadilla goblet', 'cuadriceps'),
  ('Sentadilla búlgara', 'cuadriceps'), ('Sentadilla en Smith', 'cuadriceps'),
  ('Prensa 45', 'cuadriceps'), ('Hack squat', 'cuadriceps'),
  ('Estocadas', 'cuadriceps'), ('Estocadas caminando', 'cuadriceps'),
  ('Extensión de cuádriceps (sillón)', 'cuadriceps'), ('Step up al cajón', 'cuadriceps'),
  ('Sentadilla sissy', 'cuadriceps'),
  -- Isquiotibiales
  ('Peso muerto rumano', 'isquiotibiales'), ('Peso muerto piernas rígidas', 'isquiotibiales'),
  ('Femorales acostado', 'isquiotibiales'), ('Femorales sentado', 'isquiotibiales'),
  ('Buenos días', 'isquiotibiales'), ('Curl nórdico', 'isquiotibiales'),
  -- Glúteos
  ('Hip thrust con barra', 'gluteos'), ('Hip thrust en máquina', 'gluteos'),
  ('Puente de glúteos', 'gluteos'), ('Patada de glúteo en polea', 'gluteos'),
  ('Patada de burro en polea', 'gluteos'), ('Patada de glúteo en máquina', 'gluteos'),
  ('Abducción en máquina', 'gluteos'), ('Abducción con banda', 'gluteos'),
  ('Sentadilla sumo', 'gluteos'), ('Peso muerto sumo', 'gluteos'),
  -- Aductores
  ('Aducción en máquina', 'aductores'), ('Sentadilla copenhague', 'aductores'),
  -- Pantorrillas
  ('Gemelos pierna extendida', 'pantorrillas'), ('Gemelos sentado', 'pantorrillas'),
  ('Gemelos en prensa', 'pantorrillas'), ('Gemelos a una pierna', 'pantorrillas'),
  -- Abdomen / Core
  ('Plancha', 'core'), ('Plancha lateral', 'core'), ('Abdominales crunch', 'core'),
  ('Crunch en polea', 'core'), ('Elevación de piernas colgado', 'core'),
  ('Elevación de piernas acostado', 'core'), ('Rueda abdominal', 'core'),
  ('Russian twist', 'core'), ('Bicho muerto (dead bug)', 'core'),
  ('Pallof press', 'core'), ('Abdominales bicicleta', 'core'), ('Hollow hold', 'core'),
  -- Full body / Funcional / Cardio
  ('Burpees', 'full_body'), ('Kettlebell swing', 'full_body'), ('Thruster', 'full_body'),
  ('Clean (cargada)', 'full_body'), ('Saltos al cajón', 'full_body'),
  ('Cinta / caminata', 'full_body'), ('Bicicleta fija', 'full_body'),
  ('Remo ergómetro', 'full_body')
on conflict do nothing;

-- Busca un ejercicio por nombre (general o propio del dueño) o lo crea como
-- propio del dueño. Lo usan el trigger de exercises y la migración.
create or replace function public.resolve_catalog_entry(p_owner uuid, p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_key text := public.exercise_key(p_name);
  v_id  uuid;
begin
  if v_key = '' then
    raise exception 'Cada ejercicio necesita un nombre.';
  end if;
  select id into v_id from public.exercise_catalog
   where name_key = v_key and (owner_id is null or owner_id = p_owner)
   order by owner_id nulls first
   limit 1;
  if v_id is null then
    insert into public.exercise_catalog (name, muscle_group, owner_id)
      values (btrim(regexp_replace(p_name, '\s+', ' ', 'g')), 'otros', p_owner)
      returning id into v_id;
  end if;
  return v_id;
end; $$;

-- Columnas nuevas en exercises -----------------------------------------------
alter table public.exercises
  add column if not exists catalog_id uuid references public.exercise_catalog(id) on delete restrict;
alter table public.exercises add column if not exists variant text;
create index if not exists exercises_catalog_idx on public.exercises (catalog_id);

-- Sincroniza catalog_id / variant / name en cada insert o update -------------
create or replace function public.exercises_sync_catalog()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner     uuid;
  v_cat_owner uuid;
  v_cat_name  text;
  v_label     text;
begin
  select r.owner_id into v_owner
    from public.routine_days d join public.routines r on r.id = d.routine_id
   where d.id = new.day_id;

  new.variant := nullif(btrim(coalesce(new.variant, '')), '');

  -- App vieja que renombra el ejercicio por texto: se vuelve a buscar por nombre.
  if tg_op = 'UPDATE'
     and new.catalog_id is not distinct from old.catalog_id
     and new.name is distinct from old.name then
    select name into v_cat_name from public.exercise_catalog where id = new.catalog_id;
    v_label := v_cat_name || coalesce(' (' || new.variant || ')', '');
    if new.name is distinct from v_label then
      new.catalog_id := null;
      new.variant := null;
    end if;
  end if;

  if new.catalog_id is null then
    new.catalog_id := public.resolve_catalog_entry(v_owner, new.name);
  end if;

  select owner_id, name into v_cat_owner, v_cat_name
    from public.exercise_catalog where id = new.catalog_id;
  if v_cat_name is null then
    raise exception 'El ejercicio elegido no existe.';
  end if;
  -- Solo se pueden usar ejercicios generales o propios del dueño de la rutina.
  if v_cat_owner is not null and v_cat_owner is distinct from v_owner then
    raise exception 'No podés usar ese ejercicio.';
  end if;

  new.name := v_cat_name || coalesce(' (' || new.variant || ')', '');
  return new;
end; $$;

drop trigger if exists exercises_sync_catalog on public.exercises;
create trigger exercises_sync_catalog
  before insert or update on public.exercises
  for each row execute function public.exercises_sync_catalog();

-- Si se renombra un ejercicio del catálogo, se actualiza en todas las rutinas.
create or replace function public.exercise_catalog_propagate_name()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.exercises
     set name = new.name || coalesce(' (' || variant || ')', '')
   where catalog_id = new.id;
  return new;
end; $$;

drop trigger if exists exercise_catalog_propagate_name on public.exercise_catalog;
create trigger exercise_catalog_propagate_name
  after update of name on public.exercise_catalog
  for each row execute function public.exercise_catalog_propagate_name();

-- Vincular los ejercicios existentes (el trigger resuelve cada nombre) -------
update public.exercises set variant = variant where catalog_id is null;
alter table public.exercises alter column catalog_id set not null;

-- RLS -------------------------------------------------------------------------
alter table public.exercise_catalog enable row level security;

-- ¿El ejercicio del catálogo aparece en alguna rutina a la que tengo acceso?
-- (así el alumno ve el nombre de los ejercicios propios de su coach).
create or replace function public.catalog_used_in_my_routines(p_catalog_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.exercises e
    where e.catalog_id = p_catalog_id and public.has_day_access(e.day_id)
  )
$$;

drop policy if exists exercise_catalog_select on public.exercise_catalog;
create policy exercise_catalog_select on public.exercise_catalog for select
  using (
    owner_id is null
    or owner_id = auth.uid()
    or public.catalog_used_in_my_routines(id)
  );

drop policy if exists exercise_catalog_insert on public.exercise_catalog;
create policy exercise_catalog_insert on public.exercise_catalog for insert
  with check (owner_id = auth.uid());

drop policy if exists exercise_catalog_update on public.exercise_catalog;
create policy exercise_catalog_update on public.exercise_catalog for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists exercise_catalog_delete on public.exercise_catalog;
create policy exercise_catalog_delete on public.exercise_catalog for delete
  using (owner_id = auth.uid());

-- RPCs de rutinas: aceptan catalog_id + variant (y siguen aceptando name) -----
-- p_days: [{ "id"?, "name", "exercises": [{ "id"?, "catalog_id"?, "variant"?, "name"?, "sets_reps" }] }]
create or replace function public.create_full_routine(
  p_name      text,
  p_folder_id uuid,
  p_days      jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_routine_id uuid;
  v_day        jsonb;
  v_day_id     uuid;
  v_ex         jsonb;
  v_day_pos    int := 0;
  v_ex_pos     int;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  insert into public.routines (owner_id, folder_id, name)
    values (auth.uid(), p_folder_id, coalesce(p_name, ''))
    returning id into v_routine_id;

  for v_day in select * from jsonb_array_elements(coalesce(p_days, '[]'::jsonb))
  loop
    insert into public.routine_days (routine_id, name, position)
      values (v_routine_id, coalesce(v_day->>'name', ''), v_day_pos)
      returning id into v_day_id;
    v_day_pos := v_day_pos + 1;

    v_ex_pos := 0;
    for v_ex in select * from jsonb_array_elements(coalesce(v_day->'exercises', '[]'::jsonb))
    loop
      insert into public.exercises (day_id, catalog_id, variant, name, sets_reps, position)
        values (
          v_day_id,
          nullif(v_ex->>'catalog_id', '')::uuid,
          v_ex->>'variant',
          coalesce(v_ex->>'name', ''),
          coalesce(v_ex->>'sets_reps', ''),
          v_ex_pos
        );
      v_ex_pos := v_ex_pos + 1;
    end loop;
  end loop;

  return v_routine_id;
end; $$;

create or replace function public.update_full_routine(
  p_routine_id uuid,
  p_name       text,
  p_folder_id  uuid,
  p_days       jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_day     jsonb;
  v_day_id  uuid;
  v_ex      jsonb;
  v_day_pos int := 0;
  v_ex_pos  int;
begin
  if not public.is_routine_owner(p_routine_id) then
    raise exception 'No autorizado';
  end if;

  update public.routines
     set name = coalesce(p_name, name),
         folder_id = p_folder_id,
         updated_at = now()
   where id = p_routine_id;

  delete from public.routine_days
   where routine_id = p_routine_id
     and id not in (
       select (d->>'id')::uuid
       from jsonb_array_elements(coalesce(p_days, '[]'::jsonb)) d
       where d->>'id' is not null
     );

  for v_day in select * from jsonb_array_elements(coalesce(p_days, '[]'::jsonb))
  loop
    if v_day->>'id' is not null then
      v_day_id := (v_day->>'id')::uuid;
      update public.routine_days
         set name = coalesce(v_day->>'name', ''), position = v_day_pos
       where id = v_day_id and routine_id = p_routine_id;
    else
      insert into public.routine_days (routine_id, name, position)
        values (p_routine_id, coalesce(v_day->>'name', ''), v_day_pos)
        returning id into v_day_id;
    end if;
    v_day_pos := v_day_pos + 1;

    delete from public.exercises
     where day_id = v_day_id
       and id not in (
         select (e->>'id')::uuid
         from jsonb_array_elements(coalesce(v_day->'exercises', '[]'::jsonb)) e
         where e->>'id' is not null
       );

    v_ex_pos := 0;
    for v_ex in select * from jsonb_array_elements(coalesce(v_day->'exercises', '[]'::jsonb))
    loop
      if v_ex->>'id' is not null then
        if v_ex ? 'catalog_id' then
          -- App nueva: elige del catálogo (el trigger arma el nombre).
          update public.exercises
             set catalog_id = (v_ex->>'catalog_id')::uuid,
                 variant = v_ex->>'variant',
                 sets_reps = coalesce(v_ex->>'sets_reps', ''),
                 position = v_ex_pos
           where id = (v_ex->>'id')::uuid and day_id = v_day_id;
        else
          -- App vieja: solo nombre (el trigger lo busca en el catálogo).
          update public.exercises
             set name = coalesce(v_ex->>'name', ''),
                 sets_reps = coalesce(v_ex->>'sets_reps', ''),
                 position = v_ex_pos
           where id = (v_ex->>'id')::uuid and day_id = v_day_id;
        end if;
      else
        insert into public.exercises (day_id, catalog_id, variant, name, sets_reps, position)
          values (
            v_day_id,
            nullif(v_ex->>'catalog_id', '')::uuid,
            v_ex->>'variant',
            coalesce(v_ex->>'name', ''),
            coalesce(v_ex->>'sets_reps', ''),
            v_ex_pos
          );
      end if;
      v_ex_pos := v_ex_pos + 1;
    end loop;
  end loop;

  return p_routine_id;
end; $$;
