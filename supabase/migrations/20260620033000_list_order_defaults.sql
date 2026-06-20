CREATE OR REPLACE FUNCTION public.assign_next_list_order_index()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  current_max integer;
BEGIN
  SELECT COALESCE(MAX(order_index), 0)
    INTO current_max
  FROM public.lists
  WHERE folder_id = NEW.folder_id
    AND deleted_at IS NULL;

  IF NEW.order_index IS NULL OR NEW.order_index <= current_max THEN
    NEW.order_index := current_max + 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_next_list_order_index ON public.lists;
CREATE TRIGGER trg_assign_next_list_order_index
BEFORE INSERT ON public.lists
FOR EACH ROW
EXECUTE FUNCTION public.assign_next_list_order_index();
