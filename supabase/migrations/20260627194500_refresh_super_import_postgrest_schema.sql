-- App Piteco — refresh PostgREST schema cache for Super Importer RPCs.
--
-- The database functions may already exist while PostgREST still serves an
-- older schema cache. In that state the frontend receives PGRST202 / "Could
-- not find the function ... in the schema cache" even though the SQL function
-- is present with the expected signature.
--
-- This migration is intentionally data-neutral: it changes no tables, rows,
-- RLS policies or function bodies. It only asks PostgREST to reload the schema.

SELECT pg_notify('pgrst', 'reload schema');
