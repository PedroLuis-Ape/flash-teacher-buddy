\set ON_ERROR_STOP on

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '51515151-5151-4151-8151-515151515151',
  'authenticated', 'authenticated', 'public-list-smoke@app-piteco.local',
  crypt('smoke-password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (
  id, first_name, is_teacher, public_access_enabled,
  public_profile_searchable, public_slug
) VALUES (
  '51515151-5151-4151-8151-515151515151', 'List Teacher', true, false, false, 'list-teacher'
) ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  is_teacher = true,
  public_access_enabled = false,
  public_profile_searchable = false,
  public_slug = EXCLUDED.public_slug;

INSERT INTO public.folders (id, owner_id, title, visibility, class_id)
VALUES ('52525252-5252-4252-8252-525252525252', '51515151-5151-4151-8151-515151515151', 'Public list folder', 'private', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lists (id, folder_id, owner_id, title, visibility, class_id, order_index)
VALUES
  ('53535353-5353-4353-8353-535353535353', '52525252-5252-4252-8252-525252525252', '51515151-5151-4151-8151-515151515151', 'Canonical public list', 'private', NULL, 0),
  ('54545454-5454-4454-8454-545454545454', '52525252-5252-4252-8252-525252525252', '51515151-5151-4151-8151-515151515151', 'Never published draft', 'private', NULL, 1)
ON CONFLICT (id) DO NOTHING;

SET ROLE anon;
DO $$
BEGIN
  IF (SELECT status_code FROM public.get_public_entity_http_status('learning_list', '53535353-5353-4353-8353-535353535353')) <> 404 THEN
    RAISE EXCEPTION 'Never-published list must return 404';
  END IF;
  IF has_table_privilege('anon', 'public.public_entity_publications', 'SELECT') THEN
    RAISE EXCEPTION 'Anonymous registry access leaked';
  END IF;
END;
$$;
RESET ROLE;

UPDATE public.profiles
SET public_access_enabled = true, public_profile_searchable = true
WHERE id = '51515151-5151-4151-8151-515151515151';
UPDATE public.folders SET visibility = 'class' WHERE id = '52525252-5252-4252-8252-525252525252';
UPDATE public.lists SET visibility = 'class' WHERE id = '53535353-5353-4353-8353-535353535353';

INSERT INTO public.flashcards (id, user_id, list_id, term, translation, parent_card_id, layer_index)
VALUES
  ('55555555-5555-4555-8555-555555555555', '51515151-5151-4151-8151-515151515151', '53535353-5353-4353-8353-535353535353', 'wake up', 'acordar', NULL, NULL),
  ('56565656-5656-4656-8656-565656565656', '51515151-5151-4151-8151-515151515151', '53535353-5353-4353-8353-535353535353', 'I wake up early', 'Eu acordo cedo', '55555555-5555-4555-8555-555555555555', 0),
  ('57575757-5757-4757-8757-575757575757', '51515151-5151-4151-8151-515151515151', '54545454-5454-4454-8454-545454545454', 'private', 'privado', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

SET ROLE anon;
DO $$
DECLARE
  list_row record;
BEGIN
  IF (SELECT status_code FROM public.get_public_entity_http_status('learning_list', '53535353-5353-4353-8353-535353535353')) <> 200 THEN
    RAISE EXCEPTION 'Published list must return 200';
  END IF;

  IF (
    SELECT COUNT(*) FROM public.list_public_learning_list_entries(100)
    WHERE id = '53535353-5353-4353-8353-535353535353' AND card_count = 1
  ) <> 1 THEN
    RAISE EXCEPTION 'Canonical list discovery missing or layered count inflated';
  END IF;

  IF (
    SELECT COUNT(*) FROM public.list_public_learning_list_entries(100)
    WHERE id = '54545454-5454-4454-8454-545454545454'
  ) <> 0 THEN
    RAISE EXCEPTION 'Private draft leaked into list discovery';
  END IF;

  SELECT * INTO list_row FROM public.get_public_learning_list('53535353-5353-4353-8353-535353535353');
  IF list_row.title <> 'Canonical public list' OR list_row.folder_title <> 'Public list folder' OR list_row.author_slug <> 'list-teacher' OR list_row.card_count <> 1 THEN
    RAISE EXCEPTION 'Canonical list metadata invalid';
  END IF;

  IF (SELECT COUNT(*) FROM public.get_public_learning_list_card_preview('53535353-5353-4353-8353-535353535353', 24)) <> 1 THEN
    RAISE EXCEPTION 'Preview must contain exactly one principal card';
  END IF;

  IF (
    SELECT COUNT(*) FROM public.get_public_learning_list_card_preview('53535353-5353-4353-8353-535353535353', 24)
    WHERE id = '56565656-5656-4656-8656-565656565656'
  ) <> 0 THEN
    RAISE EXCEPTION 'Internal layer leaked into canonical preview';
  END IF;
END;
$$;
RESET ROLE;

UPDATE public.lists SET visibility = 'private' WHERE id = '53535353-5353-4353-8353-535353535353';
SET ROLE anon;
DO $$
BEGIN
  IF (SELECT status_code FROM public.get_public_entity_http_status('learning_list', '53535353-5353-4353-8353-535353535353')) <> 410 THEN
    RAISE EXCEPTION 'Withdrawn list must return 410';
  END IF;
  IF (SELECT COUNT(*) FROM public.get_public_learning_list('53535353-5353-4353-8353-535353535353')) <> 0 THEN
    RAISE EXCEPTION 'Withdrawn list still returned canonical metadata';
  END IF;
END;
$$;
RESET ROLE;

UPDATE public.lists SET visibility = 'class' WHERE id = '53535353-5353-4353-8353-535353535353';
UPDATE public.folders SET visibility = 'private' WHERE id = '52525252-5252-4252-8252-525252525252';
SET ROLE anon;
DO $$
BEGIN
  IF (SELECT status_code FROM public.get_public_entity_http_status('learning_list', '53535353-5353-4353-8353-535353535353')) <> 410 THEN
    RAISE EXCEPTION 'List inside withdrawn folder must return 410';
  END IF;
END;
$$;
RESET ROLE;

UPDATE public.folders SET visibility = 'class' WHERE id = '52525252-5252-4252-8252-525252525252';
SET ROLE anon;
DO $$
BEGIN
  IF (SELECT status_code FROM public.get_public_entity_http_status('learning_list', '53535353-5353-4353-8353-535353535353')) <> 200 THEN
    RAISE EXCEPTION 'List must return 200 after folder republication';
  END IF;
  IF (SELECT status_code FROM public.get_public_entity_http_status('learning_list', '54545454-5454-4454-8454-545454545454')) <> 404 THEN
    RAISE EXCEPTION 'Never-published private draft must remain 404';
  END IF;
END;
$$;
RESET ROLE;

INSERT INTO public.turmas (id, owner_teacher_id, nome, ativo, public)
VALUES ('58585858-5858-4858-8858-585858585858', '51515151-5151-4151-8151-515151515151', 'Public classroom', true, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.folders (id, owner_id, title, visibility, class_id)
VALUES ('59595959-5959-4959-8959-595959595959', '51515151-5151-4151-8151-515151515151', 'Class folder', 'class', '58585858-5858-4858-8858-585858585858')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.lists (id, folder_id, owner_id, title, visibility, class_id)
VALUES ('60606060-6060-4060-8060-606060606060', '59595959-5959-4959-8959-595959595959', '51515151-5151-4151-8151-515151515151', 'Class list', 'class', '58585858-5858-4858-8858-585858585858')
ON CONFLICT (id) DO NOTHING;

SET ROLE anon;
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.list_public_learning_list_entries(100) WHERE id = '60606060-6060-4060-8060-606060606060') <> 0 THEN
    RAISE EXCEPTION 'Classroom list leaked into canonical discovery';
  END IF;
  IF (SELECT status_code FROM public.get_public_entity_http_status('learning_list', '60606060-6060-4060-8060-606060606060')) <> 404 THEN
    RAISE EXCEPTION 'Classroom-only list must not acquire canonical publication history';
  END IF;
END;
$$;
RESET ROLE;

SELECT 'public learning list pages smoke passed' AS result;
