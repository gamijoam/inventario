-- Chat interno entre empresas de una organizacion.
-- Seguro para ejecutar varias veces.

CREATE TABLE IF NOT EXISTS public.organization_chat_messages (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    sender_email VARCHAR(255) NOT NULL,
    sender_name VARCHAR(200),
    tenant_id INTEGER REFERENCES public.tenants(id),
    message TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.organization_chat_attachments (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    message_id INTEGER NOT NULL REFERENCES public.organization_chat_messages(id) ON DELETE CASCADE,
    original_filename VARCHAR(255) NOT NULL,
    stored_url TEXT NOT NULL,
    content_type VARCHAR(120),
    file_size INTEGER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_org_chat_messages_org_created
    ON public.organization_chat_messages (organization_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS ix_org_chat_messages_sender
    ON public.organization_chat_messages (sender_email);
CREATE INDEX IF NOT EXISTS ix_org_chat_messages_tenant
    ON public.organization_chat_messages (tenant_id);
CREATE INDEX IF NOT EXISTS ix_org_chat_attachments_message
    ON public.organization_chat_attachments (message_id);
CREATE INDEX IF NOT EXISTS ix_org_chat_attachments_org
    ON public.organization_chat_attachments (organization_id);
