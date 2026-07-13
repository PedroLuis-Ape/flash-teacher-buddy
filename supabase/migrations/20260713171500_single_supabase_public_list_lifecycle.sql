-- Canonical public lists and privacy-safe 200/404/410 lifecycle for the
-- single official Supabase project.

CREATE TABLE IF NOT EXISTS public.public_entity_publications (
  entity_type text NOT NULL CHECK (entity_type IN ('teacher','learning_resource','learning_list')),
  entity_key text NOT NULL,
  source_id uuid,
  owner_id uuid,
  parent_id uuid,
  canonical_path text NOT NULL,
  first_published_at timestamptz NOT NULL DEFAULT now(),
  last_published_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  current_public boolean NOT NULL DEFAULT true,
  PRIMARY KEY(entity_type,entity_key)
);
ALTER TABLE public.public_entity_publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.public_entity_publications FROM PUBLIC,anon,authenticated;
CREATE INDEX IF NOT EXISTS idx_public_entity_publications_source ON public.public_entity_publications(entity_type,source_id);
CREATE INDEX IF NOT EXISTS idx_public_entity_publications_owner ON public.public_entity_publications(owner_id,entity_type) WHERE current_public=true;
CREATE INDEX IF NOT EXISTS idx_public_entity_publications_parent ON public.public_entity_publications(entity_type,parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_public_learning_list_discovery ON public.lists(updated_at DESC,id)
  WHERE visibility='class' AND class_id IS NULL AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.is_public_profile_discoverable(_profile_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=_profile_id
    AND COALESCE(p.is_teacher,false)=true
    AND COALESCE(p.public_access_enabled,false)=true
    AND COALESCE(p.public_profile_searchable,false)=true
    AND NULLIF(BTRIM(p.public_slug),'') IS NOT NULL);
$$;
CREATE OR REPLACE FUNCTION public.is_public_learning_list(_list_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.lists l
    JOIN public.folders f ON f.id=l.folder_id
    JOIN public.profiles p ON p.id=f.owner_id
    WHERE l.id=_list_id AND l.owner_id=f.owner_id
      AND l.visibility='class' AND l.class_id IS NULL AND l.deleted_at IS NULL
      AND f.visibility='class' AND f.class_id IS NULL AND f.deleted_at IS NULL
      AND COALESCE(p.is_teacher,false)=true
      AND COALESCE(p.public_access_enabled,false)=true
      AND COALESCE(p.public_profile_searchable,false)=true
      AND NULLIF(BTRIM(p.public_slug),'') IS NOT NULL);
$$;
REVOKE ALL ON FUNCTION public.is_public_profile_discoverable(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_public_learning_list(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.upsert_publication(
  _entity_type text,_entity_key text,_source_id uuid,_owner_id uuid,_parent_id uuid,_path text,_is_public boolean
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF _is_public THEN
    INSERT INTO public.public_entity_publications(entity_type,entity_key,source_id,owner_id,parent_id,canonical_path,current_public,withdrawn_at,last_published_at)
    VALUES(_entity_type,_entity_key,_source_id,_owner_id,_parent_id,_path,true,NULL,now())
    ON CONFLICT(entity_type,entity_key) DO UPDATE SET source_id=EXCLUDED.source_id,owner_id=EXCLUDED.owner_id,
      parent_id=EXCLUDED.parent_id,canonical_path=EXCLUDED.canonical_path,current_public=true,withdrawn_at=NULL,last_published_at=now();
  ELSE
    UPDATE public.public_entity_publications SET current_public=false,withdrawn_at=COALESCE(withdrawn_at,now()),
      owner_id=COALESCE(_owner_id,owner_id),parent_id=COALESCE(_parent_id,parent_id)
    WHERE entity_type=_entity_type AND entity_key=_entity_key AND current_public=true;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.upsert_publication(text,text,uuid,uuid,uuid,text,boolean) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.sync_profile_publication_registry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid:=COALESCE(NEW.id,OLD.id); v_slug text; v_old_slug text; v_public boolean;
BEGIN
  IF TG_OP='DELETE' THEN
    UPDATE public.public_entity_publications SET current_public=false,withdrawn_at=COALESCE(withdrawn_at,now())
    WHERE owner_id=OLD.id OR source_id=OLD.id;
    RETURN OLD;
  END IF;
  v_slug:=NULLIF(LOWER(BTRIM(NEW.public_slug)),'');
  v_old_slug:=CASE WHEN TG_OP='UPDATE' THEN NULLIF(LOWER(BTRIM(OLD.public_slug)),'') ELSE NULL END;
  IF v_old_slug IS NOT NULL AND v_old_slug IS DISTINCT FROM v_slug THEN
    PERFORM public.upsert_publication('teacher',v_old_slug,NEW.id,NEW.id,NULL,'/portal/professor/'||v_old_slug,false);
  END IF;
  v_public:=public.is_public_profile_discoverable(v_id);
  IF v_slug IS NOT NULL THEN
    PERFORM public.upsert_publication('teacher',v_slug,v_id,v_id,NULL,'/portal/professor/'||v_slug,v_public);
  END IF;
  PERFORM public.upsert_publication('learning_resource',f.id::text,f.id,f.owner_id,NULL,'/portal/folder/'||f.id::text,
    v_public AND f.visibility='class' AND f.class_id IS NULL AND f.deleted_at IS NULL)
  FROM public.folders f WHERE f.owner_id=v_id;
  PERFORM public.upsert_publication('learning_list',l.id::text,l.id,l.owner_id,l.folder_id,'/portal/list/'||l.id::text,
    public.is_public_learning_list(l.id))
  FROM public.lists l WHERE l.owner_id=v_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_folder_publication_registry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid:=COALESCE(NEW.id,OLD.id); v_owner uuid:=COALESCE(NEW.owner_id,OLD.owner_id); v_public boolean;
BEGIN
  IF TG_OP='DELETE' THEN
    PERFORM public.upsert_publication('learning_resource',OLD.id::text,OLD.id,OLD.owner_id,NULL,'/portal/folder/'||OLD.id::text,false);
    UPDATE public.public_entity_publications SET current_public=false,withdrawn_at=COALESCE(withdrawn_at,now())
      WHERE entity_type='learning_list' AND parent_id=OLD.id AND current_public=true;
    RETURN OLD;
  END IF;
  v_public:=NEW.visibility='class' AND NEW.class_id IS NULL AND NEW.deleted_at IS NULL
    AND public.is_public_profile_discoverable(NEW.owner_id);
  PERFORM public.upsert_publication('learning_resource',NEW.id::text,NEW.id,NEW.owner_id,NULL,'/portal/folder/'||NEW.id::text,v_public);
  PERFORM public.upsert_publication('learning_list',l.id::text,l.id,l.owner_id,l.folder_id,'/portal/list/'||l.id::text,
    public.is_public_learning_list(l.id))
  FROM public.lists l WHERE l.folder_id=v_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_learning_list_publication_registry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    PERFORM public.upsert_publication('learning_list',OLD.id::text,OLD.id,OLD.owner_id,OLD.folder_id,'/portal/list/'||OLD.id::text,false);
    RETURN OLD;
  END IF;
  PERFORM public.upsert_publication('learning_list',NEW.id::text,NEW.id,NEW.owner_id,NEW.folder_id,'/portal/list/'||NEW.id::text,
    public.is_public_learning_list(NEW.id));
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_profile_publication_registry() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_folder_publication_registry() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_learning_list_publication_registry() FROM PUBLIC;
DROP TRIGGER IF EXISTS sync_profile_publication_registry_trigger ON public.profiles;
CREATE TRIGGER sync_profile_publication_registry_trigger AFTER INSERT OR UPDATE OF is_teacher,public_access_enabled,public_profile_searchable,public_slug ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_profile_publication_registry();
DROP TRIGGER IF EXISTS sync_profile_publication_registry_delete_trigger ON public.profiles;
CREATE TRIGGER sync_profile_publication_registry_delete_trigger AFTER DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_profile_publication_registry();
DROP TRIGGER IF EXISTS sync_folder_publication_registry_trigger ON public.folders;
CREATE TRIGGER sync_folder_publication_registry_trigger AFTER INSERT OR UPDATE OF owner_id,visibility,class_id,deleted_at ON public.folders FOR EACH ROW EXECUTE FUNCTION public.sync_folder_publication_registry();
DROP TRIGGER IF EXISTS sync_folder_publication_registry_delete_trigger ON public.folders;
CREATE TRIGGER sync_folder_publication_registry_delete_trigger AFTER DELETE ON public.folders FOR EACH ROW EXECUTE FUNCTION public.sync_folder_publication_registry();
DROP TRIGGER IF EXISTS sync_learning_list_publication_registry_trigger ON public.lists;
CREATE TRIGGER sync_learning_list_publication_registry_trigger AFTER INSERT OR UPDATE OF owner_id,folder_id,visibility,class_id,deleted_at ON public.lists FOR EACH ROW EXECUTE FUNCTION public.sync_learning_list_publication_registry();
DROP TRIGGER IF EXISTS sync_learning_list_publication_registry_delete_trigger ON public.lists;
CREATE TRIGGER sync_learning_list_publication_registry_delete_trigger AFTER DELETE ON public.lists FOR EACH ROW EXECUTE FUNCTION public.sync_learning_list_publication_registry();

CREATE OR REPLACE FUNCTION public.list_public_learning_list_entries(_limit integer DEFAULT 10000)
RETURNS TABLE(id uuid,folder_id uuid,title text,description text,study_type text,lang_a text,lang_b text,
  labels_a text,labels_b text,tts_enabled boolean,created_at timestamptz,updated_at timestamptz,
  folder_title text,author_display_name text,author_slug text,author_avatar_url text,card_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT l.id,l.folder_id,l.title,NULLIF(BTRIM(l.description),''),l.study_type,l.lang_a,l.lang_b,l.labels_a,l.labels_b,
    l.tts_enabled,l.created_at,GREATEST(l.updated_at,COALESCE(MAX(fc.updated_at),l.updated_at)),f.title,
    CASE WHEN LOWER(COALESCE(NULLIF(BTRIM(p.first_name),''),'Professor')) LIKE 'professor %'
      THEN COALESCE(NULLIF(BTRIM(p.first_name),''),'Professor') ELSE 'Professor '||COALESCE(NULLIF(BTRIM(p.first_name),''),'Professor') END,
    p.public_slug,p.avatar_url,COUNT(fc.id)::bigint
  FROM public.lists l JOIN public.folders f ON f.id=l.folder_id JOIN public.profiles p ON p.id=f.owner_id
  LEFT JOIN public.flashcards fc ON fc.list_id=l.id AND fc.user_id=f.owner_id AND fc.deleted_at IS NULL AND fc.parent_card_id IS NULL
  WHERE public.is_public_learning_list(l.id)
  GROUP BY l.id,f.id,p.id ORDER BY 12 DESC,l.title ASC
  LIMIT LEAST(GREATEST(COALESCE(_limit,10000),1),20000);
$$;
CREATE OR REPLACE FUNCTION public.get_public_learning_list(_id uuid)
RETURNS TABLE(id uuid,folder_id uuid,title text,description text,study_type text,lang_a text,lang_b text,
  labels_a text,labels_b text,tts_enabled boolean,created_at timestamptz,updated_at timestamptz,
  folder_title text,author_display_name text,author_slug text,author_avatar_url text,card_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT * FROM public.list_public_learning_list_entries(20000) WHERE id=_id LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public.get_public_learning_list_card_preview(_list_id uuid,_limit integer DEFAULT 24)
RETURNS TABLE(id uuid,term text,translation text,created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT fc.id,fc.term,fc.translation,fc.created_at FROM public.flashcards fc
  WHERE fc.list_id=_list_id AND fc.deleted_at IS NULL AND fc.parent_card_id IS NULL
    AND public.is_public_learning_list(_list_id)
  ORDER BY fc.created_at ASC,fc.id ASC
  LIMIT LEAST(GREATEST(COALESCE(_limit,24),1),48);
$$;
REVOKE ALL ON FUNCTION public.list_public_learning_list_entries(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_learning_list(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_learning_list_card_preview(uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_learning_list_entries(integer) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_learning_list(uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_learning_list_card_preview(uuid,integer) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.get_public_entity_http_status(_entity_type text,_entity_key text)
RETURNS TABLE(status_code integer,state text,canonical_path text,first_published_at timestamptz,last_published_at timestamptz,withdrawn_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  WITH input AS (SELECT LOWER(BTRIM(COALESCE(_entity_type,''))) AS entity_type,BTRIM(COALESCE(_entity_key,'')) AS raw_key),
  normalized AS (SELECT entity_type,CASE WHEN entity_type='teacher' THEN LOWER(raw_key) ELSE raw_key END AS entity_key FROM input),
  matched AS (SELECT p.* FROM public.public_entity_publications p JOIN normalized i ON i.entity_type=p.entity_type AND i.entity_key=p.entity_key
    WHERE i.entity_type IN ('teacher','learning_resource','learning_list') AND i.entity_key<>'' LIMIT 1)
  SELECT CASE WHEN matched.current_public THEN 200 ELSE 410 END,CASE WHEN matched.current_public THEN 'public' ELSE 'gone' END,
    matched.canonical_path,matched.first_published_at,matched.last_published_at,matched.withdrawn_at FROM matched
  UNION ALL SELECT 404,'not_found',NULL::text,NULL::timestamptz,NULL::timestamptz,NULL::timestamptz
    WHERE NOT EXISTS(SELECT 1 FROM matched) LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_public_entity_http_status(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_entity_http_status(text,text) TO anon,authenticated;

-- Current database is empty, but keep this migration correct for later replays.
INSERT INTO public.public_entity_publications(entity_type,entity_key,source_id,owner_id,parent_id,canonical_path,current_public)
SELECT 'teacher',LOWER(BTRIM(p.public_slug)),p.id,p.id,NULL,'/portal/professor/'||LOWER(BTRIM(p.public_slug)),true
FROM public.profiles p WHERE public.is_public_profile_discoverable(p.id)
ON CONFLICT(entity_type,entity_key) DO UPDATE SET current_public=true,withdrawn_at=NULL,last_published_at=now();
INSERT INTO public.public_entity_publications(entity_type,entity_key,source_id,owner_id,parent_id,canonical_path,current_public)
SELECT 'learning_resource',f.id::text,f.id,f.owner_id,NULL,'/portal/folder/'||f.id::text,true FROM public.folders f
WHERE f.visibility='class' AND f.class_id IS NULL AND f.deleted_at IS NULL AND public.is_public_profile_discoverable(f.owner_id)
ON CONFLICT(entity_type,entity_key) DO UPDATE SET current_public=true,withdrawn_at=NULL,last_published_at=now();
INSERT INTO public.public_entity_publications(entity_type,entity_key,source_id,owner_id,parent_id,canonical_path,current_public)
SELECT 'learning_list',l.id::text,l.id,l.owner_id,l.folder_id,'/portal/list/'||l.id::text,true FROM public.lists l
WHERE public.is_public_learning_list(l.id)
ON CONFLICT(entity_type,entity_key) DO UPDATE SET current_public=true,withdrawn_at=NULL,last_published_at=now();
