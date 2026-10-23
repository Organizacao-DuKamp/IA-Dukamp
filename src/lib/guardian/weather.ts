import { createHash } from "node:crypto";
import type { WeatherIntelligence } from "../chat/weather-intelligence.server.ts";
import type { FarmBook, GuardianEvent } from "./schema.ts";
import { fold } from "./book.ts";
import { sanitizeRetrievedContent } from "../chat/security.ts";

export function officialWeatherEvents(
  book: FarmBook,
  weather: WeatherIntelligence,
  recipient: string,
  now = new Date(),
): GuardianEvent[] {
  if (fold(weather.location.city) !== fold(book.city) || weather.location.uf !== book.uf) return [];
  const age = now.getTime() - Date.parse(weather.updatedAt);
  if (!Number.isFinite(age) || age < 0 || age > 3600000) return [];
  return weather.alerts
    .flatMap((alert) => {
      let source: URL;
      try {
        source = new URL(alert.sourceUrl);
      } catch {
        return [];
      }
      if (
        source.protocol !== "https:" ||
        !/(^|\.)(inmet\.gov\.br|cptec\.inpe\.br)$/.test(source.hostname)
      )
        return [];
      const end = Date.parse(alert.expires ?? ""),
        start = Date.parse(alert.onset ?? "");
      if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        end <= now.getTime() ||
        end <= start ||
        start > now.getTime() + 86400000
      )
        return [];
      const notBefore = new Date(Math.max(now.getTime(), start)).toISOString();
      const expiresAt = new Date(Math.min(end, now.getTime() + 86400000)).toISOString();
      if (Date.parse(expiresAt) <= Date.parse(notBefore)) return [];
      const severity = fold(alert.severity ?? "");
      const key = createHash("sha256")
        .update(
          [source.href, alert.event, alert.onset, alert.expires, book.city, book.uf].join("|"),
        )
        .digest("hex");
      const event: GuardianEvent = {
        type: "weather_alert",
        topic: "weather",
        key: `weather:${key}`,
        recipient,
        notBefore,
        expiresAt,
        priority: /extrem|sever|perigo/.test(severity) ? 5 : 4,
        evidence: {
          source: source.href,
          retrievedAt: weather.updatedAt,
          city: weather.location.city,
          uf: weather.location.uf,
          onset: alert.onset,
          expires: alert.expires,
          event: alert.event,
          severity: alert.severity,
          activity: book.profile.activity ?? null,
          species: book.profile.species ?? [],
        },
        message: `${book.name}: aviso oficial de ${sanitizeRetrievedContent(alert.event, 100)} para ${book.city}/${book.uf}${alert.severity ? ` (${sanitizeRetrievedContent(alert.severity, 70)})` : ""}. Válido de ${new Date(start).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} até ${new Date(end).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (Brasília). Confira abrigos, água e atividades externas conforme o boletim. Isto é um aviso meteorológico para a localidade, não uma medição na fazenda. Fonte: ${source.href}. Consultado em ${weather.updatedAt}.`,
      };
      return [event];
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 1);
}
