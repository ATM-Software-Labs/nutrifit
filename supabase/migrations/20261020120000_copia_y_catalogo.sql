-- NutriFit · Supabase como base de datos SECUNDARIA (D1 sigue siendo la principal):
--   1) copia diaria de D1 (bk_filas, bk_ejecuciones),
--   2) catálogo compartido de productos y alimentos genéricos (catalogo_alimentos),
--   3) catálogo de platos/recetas con macros calculados por ingredientes (catalogo_comidas),
--   4) búsqueda por similitud (pg_trgm) para afinar el análisis de la IA (nf_coincidencias),
--   5) latido para que el proyecto no se pause por inactividad (nf_latido).
-- Pegar ENTERO en Supabase → SQL Editor → Run. Es idempotente (se puede repetir).
-- Seguridad: RLS activado sin políticas y permisos explícitos SOLO para service_role
-- (desde el 30-oct-2026 Supabase ya no concede acceso automático a tablas nuevas de "public").
-- anon y authenticated no pueden leer ni escribir nada.

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
grant usage on schema extensions to service_role;

-- Normalización para buscar: minúsculas, sin acentos, sin signos.
create or replace function public.nf_norm(t text) returns text
language sql immutable parallel safe
set search_path = public
as $$
  select btrim(regexp_replace(
    translate(lower(coalesce(t, '')), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc'),
    '[^a-z0-9 ]+', ' ', 'g'))
$$;

-- ------------------------------------------------------------------ 1) copia de D1
create table if not exists public.bk_filas (
  tabla           text        not null,
  pk              text        not null,
  fila            jsonb       not null,
  sincronizado_en timestamptz not null default now(),
  primary key (tabla, pk)
);
create index if not exists bk_filas_sincronizado_idx on public.bk_filas (sincronizado_en);
comment on table public.bk_filas is 'Copia diaria de nutrifit-db (D1): una fila por registro, payload JSON tal cual.';

create table if not exists public.bk_ejecuciones (
  id         bigint generated always as identity primary key,
  inicio     timestamptz not null,
  fin        timestamptz not null default now(),
  ok         boolean     not null,
  filas      integer     not null default 0,
  borradas   integer     not null default 0,
  tablas     jsonb,
  error      text
);

-- ------------------------------------------------------------------ 2) productos y alimentos genéricos (sin datos personales)
create table if not exists public.catalogo_alimentos (
  clave             text primary key,               -- 'ean:<código>', 'usda-sr:<id>', 'ciqual:<id>', 'n:<nombre|marca>'
  codigo_barras     text unique check (codigo_barras is null or codigo_barras ~ '^[0-9]{8,14}$'),
  nombre            text not null check (length(nombre) between 1 and 160),
  nombre_orig       text,                            -- nombre en la fuente (inglés/francés en USDA/CIQUAL)
  marca             text check (marca is null or length(marca) <= 80),
  categoria         text,
  unidad            text not null default 'g' check (unidad in ('g', 'ml')),
  kcal_100          real not null check (kcal_100 between 0 and 950),
  proteinas_100     real not null default 0 check (proteinas_100 between 0 and 100),
  carbohidratos_100 real not null default 0 check (carbohidratos_100 between 0 and 100),
  grasas_100        real not null default 0 check (grasas_100 between 0 and 100),
  azucares_100      real check (azucares_100 is null or azucares_100 between 0 and 100),
  saturadas_100     real check (saturadas_100 is null or saturadas_100 between 0 and 100),
  fibra_100         real check (fibra_100 is null or fibra_100 between 0 and 100),
  sal_100           real check (sal_100 is null or sal_100 between 0 and 100),
  envase            real check (envase is null or envase between 1 and 10000),
  porcion           real check (porcion is null or porcion between 1 and 2000),
  emoji             text check (emoji is null or length(emoji) <= 16),
  fuente            text not null check (fuente in ('openfoodfacts', 'usda', 'ciqual', 'bedca', 'nutrifit', 'usuario', 'etiqueta', 'ia')),
  completitud       real,
  busqueda          text generated always as (public.nf_norm(nombre || ' ' || coalesce(marca, ''))) stored,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now()
);
-- Similitud solo sobre genéricos (sin código): son los que sirven para afinar a la IA
-- y el índice es pequeño. Los productos con código se buscan por el índice único.
create index if not exists catalogo_alimentos_genericos_trgm on public.catalogo_alimentos using gin (busqueda extensions.gin_trgm_ops) where codigo_barras is null;

-- ------------------------------------------------------------------ 3) platos y recetas
create table if not exists public.catalogo_comidas (
  nombre_norm       text primary key check (length(nombre_norm) between 2 and 80),
  nombre            text not null check (length(nombre) between 2 and 80),
  emoji             text check (emoji is null or length(emoji) <= 16),
  categoria         text,
  -- Por ración típica (porcion_g):
  porcion_g         real,
  kcal              real not null default 0,
  proteinas         real not null default 0,
  carbohidratos     real not null default 0,
  grasas            real not null default 0,
  -- Por 100 g (calculado de los ingredientes en recetas):
  kcal_100          real,
  proteinas_100     real,
  carbohidratos_100 real,
  grasas_100        real,
  fibra_100         real,
  ingredientes      jsonb,                            -- [{nombre, gramos, kcal, proteinas, carbohidratos, grasas}]
  cantidad          real,
  unidad            text check (unidad is null or unidad in ('g', 'ml', 'unidad', 'racion')),
  fuente            text not null default 'uso',      -- 'receta' (calculada) o 'uso' (registros de la app)
  fuentes_datos     text,                             -- de dónde salen los valores de los ingredientes
  usos              integer not null default 1,
  busqueda          text generated always as (public.nf_norm(nombre)) stored,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now()
);
create index if not exists catalogo_comidas_trgm on public.catalogo_comidas using gin (busqueda extensions.gin_trgm_ops);

-- Alta o uso de un plato desde la app: media móvil de macros por ración y contador.
-- No pisa una receta calculada: solo suma usos.
create or replace function public.nf_registrar_comida(
  p_nombre_norm text, p_nombre text, p_emoji text,
  p_kcal real, p_proteinas real, p_carbohidratos real, p_grasas real,
  p_cantidad real, p_unidad text
) returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.catalogo_comidas as c (nombre_norm, nombre, emoji, kcal, proteinas, carbohidratos, grasas, cantidad, unidad, fuente)
  values (p_nombre_norm, p_nombre, p_emoji, p_kcal, p_proteinas, p_carbohidratos, p_grasas, p_cantidad, p_unidad, 'uso')
  on conflict (nombre_norm) do update set
    kcal          = case when c.fuente = 'receta' then c.kcal else round(((c.kcal * c.usos + excluded.kcal) / (c.usos + 1))::numeric, 1) end,
    proteinas     = case when c.fuente = 'receta' then c.proteinas else round(((c.proteinas * c.usos + excluded.proteinas) / (c.usos + 1))::numeric, 1) end,
    carbohidratos = case when c.fuente = 'receta' then c.carbohidratos else round(((c.carbohidratos * c.usos + excluded.carbohidratos) / (c.usos + 1))::numeric, 1) end,
    grasas        = case when c.fuente = 'receta' then c.grasas else round(((c.grasas * c.usos + excluded.grasas) / (c.usos + 1))::numeric, 1) end,
    emoji         = coalesce(c.emoji, excluded.emoji),
    cantidad      = coalesce(c.cantidad, excluded.cantidad),
    unidad        = coalesce(c.unidad, excluded.unidad),
    usos          = c.usos + 1,
    actualizado_en = now();
$$;

-- ------------------------------------------------------------------ 4) coincidencias para afinar la IA
-- Para cada texto (nombre de plato o ingrediente que devuelve la IA) devuelve el mejor
-- plato y el mejor alimento genérico con su similitud (0-1). El servidor decide si es fiable.
create or replace function public.nf_coincidencias(p_textos text[])
returns table (
  texto text, tipo text, clave text, nombre text, similitud real,
  kcal_100 real, proteinas_100 real, carbohidratos_100 real, grasas_100 real, porcion_g real
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with t as (
    select x as texto, public.nf_norm(x) as q from unnest(p_textos[1:40]) as x where length(public.nf_norm(x)) >= 3
  )
  select t.texto, 'comida', c.nombre_norm, c.nombre, similarity(c.busqueda, t.q),
         coalesce(c.kcal_100, case when c.porcion_g > 0 then c.kcal * 100 / c.porcion_g end),
         coalesce(c.proteinas_100, case when c.porcion_g > 0 then c.proteinas * 100 / c.porcion_g end),
         coalesce(c.carbohidratos_100, case when c.porcion_g > 0 then c.carbohidratos * 100 / c.porcion_g end),
         coalesce(c.grasas_100, case when c.porcion_g > 0 then c.grasas * 100 / c.porcion_g end),
         c.porcion_g
  from t cross join lateral (
    select * from public.catalogo_comidas c
    where c.busqueda % t.q and (c.fuente = 'receta' or c.porcion_g > 0)
    order by similarity(c.busqueda, t.q) desc limit 1
  ) c
  union all
  select t.texto, 'alimento', a.clave, a.nombre, similarity(a.busqueda, t.q),
         a.kcal_100, a.proteinas_100, a.carbohidratos_100, a.grasas_100, a.porcion
  from t cross join lateral (
    select * from public.catalogo_alimentos a
    where a.codigo_barras is null and a.busqueda % t.q
    order by similarity(a.busqueda, t.q) desc, a.fuente = 'nutrifit' desc limit 1
  ) a
$$;

-- ------------------------------------------------------------------ 5) latido (evita la pausa por inactividad)
create table if not exists public.nf_latido (
  id       smallint primary key default 1 check (id = 1),
  visto_en timestamptz not null default now(),
  n        bigint not null default 0,
  origen   text
);
-- Lectura + escritura real en la base de datos en una sola llamada.
create or replace function public.nf_latido(p_origen text default 'cron')
returns table (visto_en timestamptz, n bigint, alimentos bigint, comidas bigint, filas_copia bigint)
language sql
volatile
security invoker
set search_path = public
as $$
  insert into public.nf_latido as l (id, visto_en, n, origen) values (1, now(), 1, left(p_origen, 40))
  on conflict (id) do update set visto_en = now(), n = l.n + 1, origen = left(p_origen, 40);
  select l.visto_en, l.n,
         (select greatest(reltuples, 0)::bigint from pg_class where oid = 'public.catalogo_alimentos'::regclass),
         (select count(*) from public.catalogo_comidas),
         (select greatest(reltuples, 0)::bigint from pg_class where oid = 'public.bk_filas'::regclass)
  from public.nf_latido l where l.id = 1;
$$;

-- Resumen de la copia: filas por tabla.
create or replace function public.bk_resumen()
returns table (tabla text, filas bigint)
language sql
stable
security invoker
set search_path = public
as $$ select tabla, count(*) from public.bk_filas group by tabla order by tabla $$;

-- Tamaño de la base y de cada tabla (para vigilar el límite de 500 MB del plan gratuito).
create or replace function public.nf_tamanos()
returns table (objeto text, bytes bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select 'base_de_datos', pg_database_size(current_database())
  union all
  select c.relname::text, pg_total_relation_size(c.oid)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
$$;

-- ------------------------------------------------------------------ seguridad
alter table public.bk_filas           enable row level security;
alter table public.bk_ejecuciones     enable row level security;
alter table public.catalogo_alimentos enable row level security;
alter table public.catalogo_comidas   enable row level security;
alter table public.nf_latido          enable row level security;

revoke all on public.bk_filas, public.bk_ejecuciones, public.catalogo_alimentos, public.catalogo_comidas, public.nf_latido from anon, authenticated;
grant select, insert, update, delete on public.bk_filas, public.bk_ejecuciones, public.catalogo_alimentos, public.catalogo_comidas, public.nf_latido to service_role;
grant usage, select on sequence public.bk_ejecuciones_id_seq to service_role;

revoke all on function public.nf_norm(text) from public, anon, authenticated;
revoke all on function public.nf_registrar_comida(text, text, text, real, real, real, real, real, text) from public, anon, authenticated;
revoke all on function public.nf_coincidencias(text[]) from public, anon, authenticated;
revoke all on function public.nf_latido(text) from public, anon, authenticated;
revoke all on function public.bk_resumen() from public, anon, authenticated;
revoke all on function public.nf_tamanos() from public, anon, authenticated;
grant execute on function public.nf_norm(text) to service_role;
grant execute on function public.nf_registrar_comida(text, text, text, real, real, real, real, real, text) to service_role;
grant execute on function public.nf_coincidencias(text[]) to service_role;
grant execute on function public.nf_latido(text) to service_role;
grant execute on function public.bk_resumen() to service_role;
grant execute on function public.nf_tamanos() to service_role;

-- Primer latido y recarga del esquema de la API.
select public.nf_latido('migracion');
notify pgrst, 'reload schema';
