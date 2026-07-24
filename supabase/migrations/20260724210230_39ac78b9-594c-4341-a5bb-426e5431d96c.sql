GRANT SELECT, INSERT, UPDATE, DELETE ON public.folders TO authenticated;
GRANT ALL ON public.folders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mensagens TO authenticated;
GRANT ALL ON public.mensagens TO service_role;