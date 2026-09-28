/** A pesquisa mantém as fontes internamente; a conversa mostra apenas o necessário. */
export function userRequestedSourceLinks(message: string): boolean {
  return /\b(?:qual|quais|mande|envie|mostre|passe|liste|cite|forne[cç]a|indique)\b.{0,40}\b(?:fontes?|refer[eê]ncias?|mat[eé]rias?)\b|\b(?:fontes?|refer[eê]ncias?)\s+(?:consultadas?|usadas?|da\s+pesquisa|com\s+links?)\b|\b(?:links?|urls?)\s+(?:das?\s+)?(?:fontes?|refer[eê]ncias?|mat[eé]rias?)\b/i.test(
    message,
  );
}

function isOfficialImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "dukamp.com.br" ||
        url.hostname.endsWith(".dukamp.com.br") ||
        url.hostname === "pioyrbcdprnplhcoyzam.supabase.co") &&
      /\.(?:jpe?g|png|webp|gif)$/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function sourceLink(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
}

/** Remove a bibliografia e as citações automáticas sem apagar fatos da resposta. */
export function formatReplyForUser(reply: string, userMessage: string): string {
  const showLinks = userRequestedSourceLinks(userMessage);
  const preserveRequestedLink = !showLinks && /\b(?:links?|urls?)\b/i.test(userMessage);
  const links = new Map<string, string>();
  const keepSource = (label: string, rawUrl: string) => {
    const url = sourceLink(rawUrl);
    if (showLinks && url && !links.has(url) && links.size < 3) links.set(url, label.trim());
  };

  let inSources = false;
  const lines: string[] = [];
  for (const line of reply.split(/\r?\n/)) {
    if (/^\s*(?:#{1,6}\s*)?(?:\*\*)?(?:fontes?|refer[eê]ncias?)(?:\s+(?:consultadas?|utilizadas?|pesquisadas?))?\s*:\s*(?:\*\*)?\s*$/i.test(line)) {
      inSources = true;
      continue;
    }
    if (inSources && (/^\s*$/.test(line) || /^\s*(?:[-*•]|\d+[.)])\s+/.test(line))) {
      for (const match of line.matchAll(/\[([^\]]+)]\((https?:\/\/[^\s)]+)\)/g)) {
        keepSource(match[1], match[2]);
      }
      for (const match of line.matchAll(/https?:\/\/[^\s<>)]+/g)) {
        const url = sourceLink(match[0]);
        if (url) keepSource(new URL(url).hostname, url);
      }
      continue;
    }
    inSources = false;

    // Fotos oficiais solicitadas pelo usuário são enviadas como mídia pelo WhatsApp.
    if (isOfficialImageUrl(line.trim())) {
      lines.push(line.trim());
      continue;
    }
    if (preserveRequestedLink) {
      lines.push(line.trimEnd());
      continue;
    }

    const cleaned = line
      .replace(/\[([^\]]+)]\((https?:\/\/[^\s)]+)\)/g, (_all, label: string, url: string) => {
        keepSource(label, url);
        return /^(?:CEPEA(?:\/ESALQ)?|ESALQ|INMET|CPTEC|INPE|IBGE|MAPA|Conab)$/i.test(label.trim())
          ? label.trim()
          : "";
      })
      .replace(/https?:\/\/[^\s<>]+/g, (url) => {
        keepSource(url, url.replace(/[),.;!?]+$/, ""));
        return "";
      })
      .replace(/\[(\d+)]|【\d+】|cite[^]+/g, "")
      .replace(/[ \t]+([,.!?;:])/g, "$1")
      .replace(/[ \t]{2,}/g, " ")
      .trimEnd();
    if (!/^\s*(?:\*\*)?(?:fonte|refer[eê]ncia)\s*:\s*(?:\*\*)?\s*$/i.test(cleaned)) {
      lines.push(cleaned);
    }
  }

  const body = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!showLinks || links.size === 0) return body;
  const sources = [...links].map(([url, label]) => `- [${label}](${url})`).join("\n");
  return `${body}\n\nFontes:\n${sources}`;
}
