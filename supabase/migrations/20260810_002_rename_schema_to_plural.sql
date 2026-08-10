-- =====================================================================
--  SOMAR — Rename de schema:  somarelectrodomestico  ->  somarelectrodomesticos
--
--  CUÁNDO USAR ESTE ARCHIVO:
--  Solo si YA ejecutaste la migración inicial ANTERIOR que creó el schema
--  en SINGULAR (`somarelectrodomestico`). Este script renombra el schema
--  completo (con TODAS sus tablas, datos, funciones y triggers) al nombre
--  definitivo en PLURAL, SIN pérdida de datos, y corrige las referencias
--  internas que un simple RENAME no actualiza (el search_path embebido en
--  is_admin(), las policies de Storage y los schemas expuestos en PostgREST).
--
--  Si instalás desde cero con la migración inicial (que ya crea el schema en
--  plural), NO necesitás correr este archivo.
--
--  Es idempotente: se puede re-ejecutar sin efectos secundarios.
-- =====================================================================

-- 1) Renombrar el schema si existe el singular y aún no existe el plural.
--    Las tablas, datos, funciones y triggers se mueven con el schema.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'somarelectrodomestico')
     and not exists (select 1 from information_schema.schemata where schema_name = 'somarelectrodomesticos') then
    execute 'alter schema somarelectrodomestico rename to somarelectrodomesticos';
    raise notice 'Schema renombrado: somarelectrodomestico -> somarelectrodomesticos';
  elsif exists (select 1 from information_schema.schemata where schema_name = 'somarelectrodomesticos') then
    raise notice 'El schema somarelectrodomesticos ya existe; no se renombra.';
  else
    raise exception 'No existe somarelectrodomestico ni somarelectrodomesticos. Corré primero la migración inicial (20260809_001_somarelectrodomesticos.sql).';
  end if;
end$$;

-- 2) Recrear is_admin() con el search_path apuntando al schema PLURAL.
--    (El cuerpo referencia tablas por OID y se actualiza solo al renombrar,
--     pero el `set search_path` embebido es texto y hay que corregirlo.)
--    Se usa CREATE OR REPLACE para conservar el OID: así las policies RLS que
--    ya la referencian siguen válidas sin recrearlas.
create or replace function somarelectrodomesticos.is_admin()
returns boolean
language sql
stable
security definer
set search_path = somarelectrodomesticos, public
as $$
  select exists (
    select 1
    from somarelectrodomesticos.admin_users au
    where au.user_id = auth.uid()
      and au.is_active = true
  );
$$;

-- 3) Recrear el trigger de updated_at (belt-and-suspenders: su search_path
--    también apunta al schema por nombre).
create or replace function somarelectrodomesticos.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 4) Recrear las policies de Storage con el nombre plural (belt-and-suspenders).
drop policy if exists "somar_media_public_read" on storage.objects;
create policy "somar_media_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'somar-media');

drop policy if exists "somar_media_admin_write" on storage.objects;
create policy "somar_media_admin_write" on storage.objects
  for all to authenticated
  using (bucket_id = 'somar-media' and somarelectrodomesticos.is_admin())
  with check (bucket_id = 'somar-media' and somarelectrodomesticos.is_admin());

-- 5) Exponer el schema plural en PostgREST y recargar.
do $$
begin
  begin
    alter role authenticator set pgrst.db_schemas = 'public, somarelectrodomesticos, storage';
  exception when others then
    raise notice 'No se pudo alterar authenticator; exponé el schema desde el Dashboard (Settings -> API -> Exposed schemas).';
  end;
end$$;
notify pgrst, 'reload config';

-- =====================================================================
--  FIN. Verificá con:
--    select schema_name from information_schema.schemata
--    where schema_name like 'somarelectrodomestico%';
--  Debe aparecer SOLO 'somarelectrodomesticos'.
-- =====================================================================
