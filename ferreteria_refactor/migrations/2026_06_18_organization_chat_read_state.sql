-- Estado de lectura del chat organizacional por usuario.
-- Seguro para ejecutar varias veces.

CREATE TABLE IF NOT EXISTS public.organization_chat_reads (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_email VARCHAR(255) NOT NULL,
    last_read_message_id INTEGER NOT NULL DEFAULT 0,
    last_read_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    UNIQUE (organization_id, user_email)
);

CREATE INDEX IF NOT EXISTS ix_org_chat_reads_org_email
    ON public.organization_chat_reads (organization_id, user_email);

INSERT INTO public.organization_chat_reads (organization_id, user_email, last_read_message_id, last_read_at)
SELECT ou.organization_id,
       LOWER(TRIM(ou.user_email)) AS user_email,
       COALESCE(MAX(m.id), 0) AS last_read_message_id,
       NOW() AS last_read_at
FROM public.organization_users ou
LEFT JOIN public.organization_chat_messages m
       ON m.organization_id = ou.organization_id
      AND m.sender_email = LOWER(TRIM(ou.user_email))
GROUP BY ou.organization_id, LOWER(TRIM(ou.user_email))
ON CONFLICT (organization_id, user_email) DO NOTHING;
