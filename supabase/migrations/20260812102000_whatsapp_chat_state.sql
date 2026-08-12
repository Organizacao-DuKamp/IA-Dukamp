-- Estado privado do canal WhatsApp. Somente o backend service_role acessa estas tabelas.

CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  phone_number TEXT PRIMARY KEY CHECK (phone_number ~ '^[0-9]{6,20}$'),
  conversation_id TEXT NOT NULL,
  state JSONB,
  history JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(history) = 'array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_processed_messages (
  message_id TEXT PRIMARY KEY,
  phone_number TEXT NOT NULL CHECK (phone_number ~ '^[0-9]{6,20}$'),
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed')),
  reply TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_processed_messages_phone_idx
  ON public.whatsapp_processed_messages(phone_number, created_at DESC);
CREATE INDEX IF NOT EXISTS whatsapp_processed_messages_updated_idx
  ON public.whatsapp_processed_messages(updated_at);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_processed_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.whatsapp_conversations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.whatsapp_processed_messages FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.whatsapp_conversations TO service_role;
GRANT ALL ON public.whatsapp_processed_messages TO service_role;

COMMENT ON TABLE public.whatsapp_conversations IS
  'Contexto recente e estado estruturado das conversas recebidas pelo WhatsApp.';
COMMENT ON TABLE public.whatsapp_processed_messages IS
  'Idempotencia dos webhooks do WhatsApp; evita reprocessar a mesma mensagem.';
