# P0 audit

Reviewed authentication, profile-role migrations, deployment headers and the repair-ab Edge Function.

This batch adds request-method, content-type, body-size, action, UUID, batch-size and text-size validation. It removes flashcard text from administrative logs and prevents internal exception details from being returned to clients.

Live Supabase RLS, installed functions and indexes still require verification through a connected project before any database migration is added.
