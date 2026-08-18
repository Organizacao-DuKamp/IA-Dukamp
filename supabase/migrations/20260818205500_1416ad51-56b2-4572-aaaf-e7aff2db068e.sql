-- Separa "resposta calculada" de "resposta já entregue" no WhatsApp.

ALTER TABLE public.whatsapp_processed_messages
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- Registros anteriores à implantação já passaram pelo fluxo legado de envio.
-- Marcá-los como entregues impede que a nova semântica interprete respostas
-- históricas como pendentes e as reenvie após o deploy.
UPDATE public.whatsapp_processed_messages
SET delivered_at = COALESCE(delivered_at, updated_at)
WHERE status = 'completed'
  AND delivered_at IS NULL;

CREATE INDEX IF NOT EXISTS whatsapp_processed_messages_pending_delivery_idx
  ON public.whatsapp_processed_messages(updated_at)
  WHERE status = 'completed' AND delivered_at IS NULL;

COMMENT ON COLUMN public.whatsapp_processed_messages.delivered_at IS
  'Instante em que a resposta final foi entregue pela Graph API. NULL significa que a resposta ainda pode precisar de entrega.';