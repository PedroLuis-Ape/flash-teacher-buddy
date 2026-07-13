-- Preserve the richer classroom signup behavior when the full classroom schema
-- exists, while keeping the reduced official rebuild operational.
DO $outer$
BEGIN
  IF to_regclass('public.user_roles') IS NOT NULL
     AND to_regtype('public.app_role') IS NOT NULL THEN
    EXECUTE $function$
      CREATE OR REPLACE FUNCTION public.handle_new_user()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      DECLARE
        v_account_type text;
        v_is_teacher boolean;
        v_role public.app_role;
        v_slug text;
        v_name text;
      BEGIN
        v_account_type := CASE lower(COALESCE(
          NEW.raw_user_meta_data ->> 'requested_account_type',
          'student'
        ))
          WHEN 'teacher' THEN 'teacher'
          WHEN 'professor' THEN 'teacher'
          ELSE 'student'
        END;
        v_is_teacher := v_account_type = 'teacher';
        v_role := CASE
          WHEN v_is_teacher THEN 'owner'::public.app_role
          ELSE 'student'::public.app_role
        END;
        v_slug := lower(regexp_replace(
          COALESCE(NEW.raw_user_meta_data ->> 'requested_public_slug', ''),
          '[^a-z0-9_]', '', 'g'
        ));
        IF length(v_slug) >= 3 THEN
          PERFORM pg_advisory_xact_lock(hashtextextended(v_slug, 0));
        END IF;
        IF length(v_slug) < 3 OR EXISTS (
          SELECT 1 FROM public.profiles WHERE lower(public_slug) = v_slug
        ) THEN
          v_slug := NULL;
        END IF;
        v_name := NULLIF(trim(COALESCE(
          NEW.raw_user_meta_data ->> 'first_name',
          NEW.raw_user_meta_data ->> 'name',
          NEW.raw_user_meta_data ->> 'full_name',
          ''
        )), '');

        INSERT INTO public.profiles (
          id, first_name, display_name, avatar_url, role, is_teacher,
          user_type, public_slug, public_access_enabled,
          public_profile_searchable
        ) VALUES (
          NEW.id, v_name, v_name,
          NULLIF(NEW.raw_user_meta_data ->> 'avatar_url', ''),
          v_role::text, v_is_teacher,
          CASE WHEN v_is_teacher THEN 'professor' ELSE 'aluno' END::public.user_type,
          v_slug, v_is_teacher AND v_slug IS NOT NULL, false
        )
        ON CONFLICT (id) DO UPDATE
        SET first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
            display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
            avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
            role = EXCLUDED.role,
            is_teacher = EXCLUDED.is_teacher,
            user_type = EXCLUDED.user_type,
            public_slug = COALESCE(public.profiles.public_slug, EXCLUDED.public_slug),
            public_access_enabled = CASE
              WHEN EXCLUDED.is_teacher
                THEN COALESCE(public.profiles.public_slug, EXCLUDED.public_slug) IS NOT NULL
              ELSE false
            END,
            updated_at = now();

        INSERT INTO public.user_roles (user_id, role)
        VALUES (NEW.id, v_role)
        ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
        RETURN NEW;
      END;
      $body$;
    $function$;

    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;
    DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
    DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END;
$outer$;

-- DELETE triggers must never dereference NEW. Assign identifiers only after the
-- DELETE branch has returned.
CREATE OR REPLACE FUNCTION public.sync_profile_publication_registry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_slug text;
  v_old_slug text;
  v_public boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.public_entity_publications
    SET current_public = false,
        withdrawn_at = COALESCE(withdrawn_at, now())
    WHERE owner_id = OLD.id OR source_id = OLD.id;
    RETURN OLD;
  END IF;

  v_id := NEW.id;
  v_slug := NULLIF(LOWER(BTRIM(NEW.public_slug)), '');
  v_old_slug := CASE
    WHEN TG_OP = 'UPDATE' THEN NULLIF(LOWER(BTRIM(OLD.public_slug)), '')
    ELSE NULL
  END;

  IF v_old_slug IS NOT NULL AND v_old_slug IS DISTINCT FROM v_slug THEN
    PERFORM public.upsert_publication(
      'teacher', v_old_slug, NEW.id, NEW.id, NULL,
      '/portal/professor/' || v_old_slug, false
    );
  END IF;

  v_public := public.is_public_profile_discoverable(v_id);
  IF v_slug IS NOT NULL THEN
    PERFORM public.upsert_publication(
      'teacher', v_slug, v_id, v_id, NULL,
      '/portal/professor/' || v_slug, v_public
    );
  END IF;

  PERFORM public.upsert_publication(
    'learning_resource', f.id::text, f.id, f.owner_id, NULL,
    '/portal/folder/' || f.id::text,
    v_public AND f.visibility = 'class'
      AND f.class_id IS NULL AND f.deleted_at IS NULL
  )
  FROM public.folders f
  WHERE f.owner_id = v_id;

  PERFORM public.upsert_publication(
    'learning_list', l.id::text, l.id, l.owner_id, l.folder_id,
    '/portal/list/' || l.id::text,
    public.is_public_learning_list(l.id)
  )
  FROM public.lists l
  WHERE l.owner_id = v_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_folder_publication_registry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_public boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.upsert_publication(
      'learning_resource', OLD.id::text, OLD.id, OLD.owner_id, NULL,
      '/portal/folder/' || OLD.id::text, false
    );
    UPDATE public.public_entity_publications
    SET current_public = false,
        withdrawn_at = COALESCE(withdrawn_at, now())
    WHERE entity_type = 'learning_list'
      AND parent_id = OLD.id
      AND current_public = true;
    RETURN OLD;
  END IF;

  v_id := NEW.id;
  v_public := NEW.visibility = 'class'
    AND NEW.class_id IS NULL
    AND NEW.deleted_at IS NULL
    AND public.is_public_profile_discoverable(NEW.owner_id);

  PERFORM public.upsert_publication(
    'learning_resource', NEW.id::text, NEW.id, NEW.owner_id, NULL,
    '/portal/folder/' || NEW.id::text, v_public
  );

  PERFORM public.upsert_publication(
    'learning_list', l.id::text, l.id, l.owner_id, l.folder_id,
    '/portal/list/' || l.id::text,
    public.is_public_learning_list(l.id)
  )
  FROM public.lists l
  WHERE l.folder_id = v_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_learning_list_publication_registry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.upsert_publication(
      'learning_list', OLD.id::text, OLD.id, OLD.owner_id, OLD.folder_id,
      '/portal/list/' || OLD.id::text, false
    );
    RETURN OLD;
  END IF;

  PERFORM public.upsert_publication(
    'learning_list', NEW.id::text, NEW.id, NEW.owner_id, NEW.folder_id,
    '/portal/list/' || NEW.id::text,
    public.is_public_learning_list(NEW.id)
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_profile_publication_registry() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_folder_publication_registry() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_learning_list_publication_registry() FROM PUBLIC;
