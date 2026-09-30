/** A recusa de consultar dados atuais deve acionar recuperação, não encerrar a busca. */
export function hasCurrentLookupRefusal(reply: string): boolean {
  const text = reply
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  const refusal =
    /\bnao\s+(?:consigo|consegui|posso|pude|tenho como)\s+(?:\w+\s+){0,5}(?:consultar|confirmar|acessar|buscar|pesquisar|verificar|obter)/.test(
      text,
    ) ||
    /\b(?:nao tenho|sem)\s+acesso\s+(?:\w+\s+){0,5}(?:internet|tempo real|ao vivo|dados atualizados)/.test(
      text,
    ) ||
    /\b(?:se quiser|quer que eu|posso)\b.{0,60}\b(?:pesquisar|consultar|buscar)\b.{0,80}\b(?:previsao|atual|hoje|agora)/.test(
      text,
    );
  // Uma limitação de uma fonte pode acompanhar dados válidos de outra.
  const usefulFacts = /(?:\d+(?:[.,]\d+)?\s*(?:°\s*c|mm|km\/h|%)|r\$\s*\d)/i.test(reply);
  return refusal && !usefulFacts;
}
