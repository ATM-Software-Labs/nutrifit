-- Mantenimiento opcional (instancia t4g.nano). Ejecutar en el SQL Editor de Supabase,
-- UNA sentencia cada vez (VACUUM no puede ir dentro de un bloque de transacción).
-- Limpia las filas muertas que dejó la carga masiva del catálogo y actualiza estadísticas.
-- El WAL se recicla solo en los siguientes checkpoints; no hay que borrar nada a mano.

vacuum (analyze) public.catalogo_alimentos;

-- (opcional, en otra ejecución)
-- vacuum (analyze) public.catalogo_comidas;
-- vacuum (analyze) public.bk_filas;

-- Comprobar filas muertas y tamaño:
-- select relname, n_live_tup, n_dead_tup, pg_size_pretty(pg_total_relation_size(relid))
-- from pg_stat_user_tables order by pg_total_relation_size(relid) desc;
