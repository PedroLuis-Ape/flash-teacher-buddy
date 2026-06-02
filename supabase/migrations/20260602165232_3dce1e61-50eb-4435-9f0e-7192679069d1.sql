-- Future-proof: explicitly deny Broadcast/Presence on realtime.messages.
-- App only uses postgres_changes (inherits source-table RLS); this guards against
-- accidental Broadcast/Presence usage by a future library/config change.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all realtime messages for clients" ON realtime.messages;

CREATE POLICY "Deny all realtime messages for clients"
ON realtime.messages
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);