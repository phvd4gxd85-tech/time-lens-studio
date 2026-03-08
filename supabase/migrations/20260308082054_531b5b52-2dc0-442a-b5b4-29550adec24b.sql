
CREATE POLICY "Allow service role full access on contact_messages"
ON public.contact_messages
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
