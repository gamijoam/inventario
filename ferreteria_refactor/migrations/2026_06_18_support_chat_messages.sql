-- Support chat threads and attachments. Centralized in public schema.

CREATE TABLE IF NOT EXISTS public.support_messages (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    sender_type VARCHAR(16) NOT NULL DEFAULT 'user',
    sender_email VARCHAR(255),
    message TEXT NOT NULL DEFAULT '',
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_support_messages_ticket_id ON public.support_messages(ticket_id);
CREATE INDEX IF NOT EXISTS ix_support_messages_sender_email ON public.support_messages(sender_email);

CREATE TABLE IF NOT EXISTS public.support_attachments (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    message_id INTEGER NOT NULL REFERENCES public.support_messages(id) ON DELETE CASCADE,
    original_filename VARCHAR(255) NOT NULL,
    stored_url TEXT NOT NULL,
    content_type VARCHAR(128),
    file_size INTEGER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_support_attachments_ticket_id ON public.support_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS ix_support_attachments_message_id ON public.support_attachments(message_id);

-- Backfill existing tickets as the first chat message.
INSERT INTO public.support_messages (ticket_id, sender_type, sender_email, message, created_at)
SELECT t.id, 'user', t.user_email, COALESCE(t.message, ''), COALESCE(t.created_at, NOW())
FROM public.support_tickets t
WHERE NOT EXISTS (
    SELECT 1
    FROM public.support_messages m
    WHERE m.ticket_id = t.id
);
