-- Read-state and last-activity metadata for support chat.

ALTER TABLE public.support_tickets
    ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP WITHOUT TIME ZONE,
    ADD COLUMN IF NOT EXISTS last_message_sender VARCHAR(16) NOT NULL DEFAULT 'user',
    ADD COLUMN IF NOT EXISTS user_last_read_at TIMESTAMP WITHOUT TIME ZONE,
    ADD COLUMN IF NOT EXISTS admin_last_read_at TIMESTAMP WITHOUT TIME ZONE;

WITH last_messages AS (
    SELECT DISTINCT ON (ticket_id)
        ticket_id,
        sender_type,
        created_at
    FROM public.support_messages
    ORDER BY ticket_id, created_at DESC, id DESC
)
UPDATE public.support_tickets t
SET last_message_at = COALESCE(lm.created_at, t.updated_at, t.created_at),
    last_message_sender = COALESCE(lm.sender_type, 'user'),
    user_last_read_at = COALESCE(t.user_last_read_at, t.created_at),
    admin_last_read_at = COALESCE(t.admin_last_read_at, CASE WHEN t.admin_response IS NOT NULL THEN t.updated_at ELSE NULL END)
FROM last_messages lm
WHERE lm.ticket_id = t.id;

UPDATE public.support_tickets
SET last_message_at = COALESCE(last_message_at, updated_at, created_at),
    user_last_read_at = COALESCE(user_last_read_at, created_at)
WHERE last_message_at IS NULL OR user_last_read_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_support_tickets_last_message_at ON public.support_tickets(last_message_at DESC);
CREATE INDEX IF NOT EXISTS ix_support_tickets_last_message_sender ON public.support_tickets(last_message_sender);
