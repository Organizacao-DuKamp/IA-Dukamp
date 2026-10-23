export interface DeliveryMessage {
  id: string;
  recipient: string;
  message: string;
  mode: "text" | "template";
}
export interface DeliveryResult {
  status: "sent" | "failed" | "retry" | "uncertain";
  providerId?: string;
  error?: string;
}
export interface DeliveryConfig {
  token?: string;
  phoneNumberId?: string;
  version?: string;
  templateName?: string;
  templateLanguage?: string;
}
/** Mark dispatching in the DB BEFORE invoking this. An ambiguous response must never auto-retry. */
export async function deliverGuardianMessage(
  message: DeliveryMessage,
  config: DeliveryConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<DeliveryResult> {
  if (!config.token || !config.phoneNumberId)
    return { status: "failed", error: "credentials_missing" };
  const version = config.version ?? "v25.0";
  if (!/^v\d+\.\d+$/.test(version) || !/^\d+$/.test(config.phoneNumberId))
    return { status: "failed", error: "invalid_graph_configuration" };
  if (message.mode === "template" && !config.templateName)
    return { status: "failed", error: "approved_template_missing" };
  const payload =
    message.mode === "text"
      ? {
          messaging_product: "whatsapp",
          to: message.recipient,
          type: "text",
          text: { body: message.message, preview_url: false },
        }
      : {
          messaging_product: "whatsapp",
          to: message.recipient,
          type: "template",
          template: {
            name: config.templateName,
            language: { code: config.templateLanguage ?? "pt_BR" },
            components: [{ type: "body", parameters: [{ type: "text", text: message.message }] }],
          },
        };
  try {
    const response = await fetchImpl(
      `https://graph.facebook.com/${version}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${config.token}`, "content-type": "application/json" },
        body: JSON.stringify(payload),
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      },
    );
    // Do not log/return Meta's raw body: it can include recipient data or credential fragments.
    if (response.status === 429) return { status: "retry", error: "provider_rate_limited" };
    if (response.status >= 500 || response.status === 408)
      return { status: "uncertain", error: `provider_ambiguous_${response.status}` };
    if (!response.ok) return { status: "failed", error: `provider_rejected_${response.status}` };
    const data = (await response.json().catch(() => null)) as {
      messages?: Array<{ id?: string }>;
    } | null;
    const id = data?.messages?.[0]?.id;
    return typeof id === "string" && id.length > 0 && id.length <= 256
      ? { status: "sent", providerId: id }
      : { status: "uncertain", error: "provider_receipt_missing" };
  } catch {
    return { status: "uncertain", error: "provider_transport_ambiguous" };
  }
}
