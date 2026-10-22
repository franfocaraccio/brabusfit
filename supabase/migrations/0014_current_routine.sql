-- ============================================================================
-- Brabus Fit — Rutina vigente
-- ============================================================================
-- El coach marca una rutina de cada cliente como vigente (igual que los planes
-- de nutrición). El inicio del alumno la muestra como "Tu rutina"; si no hay
-- ninguna marcada, usa la última que entrenó.
-- ============================================================================

alter table public.routines
  add column if not exists is_current boolean not null default false;

-- Solo las rutinas de cliente pueden estar vigentes.
create or replace function public.routines_check_client()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.client_id is null then
    new.is_current := false;
    return new;
  end if;
  new.folder_id := null;
  if (tg_op = 'INSERT' or new.client_id is distinct from old.client_id)
     and not exists (
       select 1 from public.coach_students
        where id = new.client_id and coach_id = new.owner_id
     ) then
    raise exception 'Ese cliente no es tuyo.';
  end if;
  return new;
end; $$;

drop trigger if exists routines_check_client on public.routines;
create trigger routines_check_client
  before insert or update of client_id, folder_id, is_current on public.routines
  for each row execute function public.routines_check_client();

-- Marcar la rutina vigente del cliente (desmarca las demás de esa ficha).
create or replace function public.set_current_routine(p_routine_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_client uuid;
begin
  select client_id into v_client from public.routines
   where id = p_routine_id and owner_id = auth.uid();
  if v_client is null then
    raise exception 'Solo se marca como vigente una rutina de cliente.';
  end if;
  update public.routines
     set is_current = (id = p_routine_id), updated_at = now()
   where client_id = v_client;
end; $$;

-- Rutinas que ya tienen cliente: la más nueva de cada ficha queda vigente.
update public.routines r
   set is_current = true
 where r.client_id is not null
   and r.id = (
     select r2.id from public.routines r2
      where r2.client_id = r.client_id
      order by r2.created_at desc
      limit 1
   );
