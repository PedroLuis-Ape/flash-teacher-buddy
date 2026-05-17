CREATE OR REPLACE FUNCTION public.get_portal_folders()
 RETURNS SETOF folders
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Portal Público: vitrine pública de materiais.
  -- Excluímos pastas vinculadas a turmas (class_id IS NOT NULL) — essas são
  -- atribuições de turma e não devem aparecer no portal público.
  -- Fallback adicional por título "[Atribuição]" caso surja conteúdo antigo
  -- sem class_id. Futuro: substituir por flag explícita (ex: is_official_public).
  select f.*
  from public.folders f
  join public.profiles p on p.id = f.owner_id
  where f.visibility = 'class'
    and f.deleted_at IS NULL
    and f.class_id IS NULL
    and f.title NOT ILIKE '[Atribuição]%'
    and coalesce(p.public_access_enabled, false) = true
  order by f.created_at desc;
$function$;