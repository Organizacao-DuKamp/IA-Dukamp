-- Uma única presença por mensagem evita ruído quando a Meta repete o webhook
-- ou duas instâncias serverless observam a mesma execução lenta.

ALTER TABLE public.whatsapp_processed_messages
  ADD COLUMN IF NOT EXISTS presence_claimed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.whatsapp_processed_messages.presence_claimed_at IS
  'Instante em que o único indicador de digitação foi reservado para esta mensagem. A reserva atômica impede presença duplicada entre instâncias.';
