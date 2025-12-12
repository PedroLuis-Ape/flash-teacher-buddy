-- Enable realtime for profiles table to track online status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;