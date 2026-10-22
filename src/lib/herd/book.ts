/** Structured herd records. No model-generated totals or assistant text are accepted as data. */
export type Sex = "fêmea" | "macho" | null;
export interface HerdEntry {
  key: string;
  code: string;
  weight: number | null;
  estimated: boolean;
  sex: Sex;
  reproductive: "inseminar" | "não inseminar" | null;
  notes: string[];
  procedures: string[];
  batch: number;
}
export interface HerdBook {
  schema: 1;
  importDraft?: HerdEntry[];
  recoveryWarnings?: number;
  active: boolean;
  batch: number;
  entries: HerdEntry[];
  procedures: string[];
  lastKey: string | null;
  defaultSeries: string | null;
  defaultSex: Sex;
  reproductiveMode: boolean;
  pending: { entry: HerdEntry; existingKey: string } | null;
}
export interface HerdTurn {
  book: HerdBook;
  reply: string;
}
export const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function emptyBook(): HerdBook {
  return {
    schema: 1,
    active: false,
    batch: 1,
    entries: [],
    procedures: [],
    lastKey: null,
    defaultSeries: null,
    defaultSex: null,
    reproductiveMode: false,
    pending: null,
  };
}
export function isExplicitAnimalLookup(text: string): boolean {
  const t = fold(text);
  return (
    /\b(pesquis\w*|consult\w*|busqu\w*|identifi\w*|qual (?:e a )?raca|pedigree|genealog\w*|abcz)\b/.test(
      t,
    ) && !/\b(nao|sem)\b.{0,45}(pesquis|consult|busc|identifi)|so (?:marca|anota|registr)/.test(t)
  );
}
export function isHerdSummary(text: string): boolean {
  const t = fold(text);
  return (
    /\b(quantos?|quantas?|total|soma|media|contagem)\b/.test(t) &&
    /\b(animais|gado|rebanho|lote|machos?|femeas?|pesos?|pesag\w*|pesad\w*)\b/.test(t) &&
    !/\b(preco|produto|vendedor|racao|suplemento|dose|leite|producao|ganho|gmd)\b/.test(t)
  );
}
export function isHerdReport(text: string): boolean {
  const t = fold(text);
  return (
    (/\b(list(?:a|agem)|relatorio|balanco|resumo|consolidado|planilha|pdf|excel)\b/.test(t) ||
      isHerdSummary(text)) &&
    !/\b(preco|produto|vendedor|racao|suplemento)\b/.test(t)
  );
}
export function herdSessionStart(text: string): boolean {
  const t = fold(text);
  return (
    /\b(registr\w*|anot\w*|pesar|pesagem|vacin\w*|vermifug\w*|tabela)\b/.test(t) &&
    /\b(gado|rebanho|animais|animal|vacas?|lote|bovin\w*)\b/.test(t) &&
    !/\b(como|quanto|qual|dose|bula)\b/.test(t) &&
    !isExplicitAnimalLookup(text)
  );
}
export function wantsHerdTurn(text: string, book: HerdBook): boolean {
  if (isExplicitAnimalLookup(text)) return false;
  if (
    !isHerdReport(text) &&
    /\b(qual|como|quanto|posso|devo|recomend\w*|dose|bula|doente|febre|diarreia|intoxic\w*|caida|respirar|nao levanta)\b/.test(
      fold(text),
    ) &&
    !/qual.*(?:peso|sexo)|sem sexo/.test(fold(text))
  )
    return false;
  if (book.active && /importa[cç][aã]o|sexo/.test(fold(text))) return true;
  if (herdSessionStart(text)) return true;
  if (
    !book.active &&
    parseHerdEntry(text, book, "candidate")?.weight !== null &&
    parseHerdEntry(text, book, "candidate") &&
    !/\b(qual|como|quanto|preco|dose|bula)\b/.test(fold(text))
  )
    return true;
  if (!book.active) return book.entries.length > 0 && isHerdReport(text);
  const t = fold(text);
  return (
    isHerdReport(text) ||
    /\b(kg|kilo\w*|peso|macho|femea|insemin\w*|vacin\w*|vermifugo|corrij\w*|corrig\w*|correcao|lote|registr\w*|anot\w*|listagem|media|peito|descarte|mae)\b/.test(
      t,
    ) ||
    /^(?:sim|nao|permanece|ok|\d)/.test(t) ||
    /\b[A-Z]{2,6}\s*\d/.test(text) ||
    /\b(?:salv\w*|guard\w*|parar|continuar|ignore|ignorar|todas|todos)\b/.test(t)
  );
}
const knownNonSeries = new Set([
  "GMD",
  "DOSE",
  "MG",
  "ML",
  "KG",
  "PRECO",
  "VALOR",
  "PDF",
  "CPF",
  "CNPJ",
  "CEP",
  "ANO",
  "DIA",
  "DIAS",
  "PEITO",
  "DEFEITO",
  "SIM",
  "NAO",
  "P",
  "S",
  "PESO",
  "KILO",
  "KILOS",
  "KG",
  "VACINA",
  "LOTE",
  "FEMEA",
  "MACHO",
  "TOTAL",
  "MEDIA",
  "DIA",
  "LEITEIRA",
  "LEITERINHA",
  "CORRIJA",
  "CORRIGI",
  "AGORA",
  "ESTA",
  "ESSA",
]);
export function parseHerdEntry(text: string, book: HerdBook, key: string): HerdEntry | null {
  const t = fold(text);
  let code: string | null = null;
  let rest = text;
  // Numbers before "vaca de leite" are identifiers; a unit-marked number is the weight.
  const dairyBefore = t.match(/\b(\d+)\s+vaca\s+de\s+leite\b/);
  const dairyAfter = t.match(/\bvaca\s+de\s+leite\s*(\d+|s\/?n|sem numero)\b/);
  const unnamed = /\b(?:s\/?n|sem numero)\b/.test(t);
  const named = text
    .match(/\b([a-z]{2,6})[ .-]*(\d{1,5})\b/gi)
    ?.map((s) => s.match(/([a-z]{2,6})[ .-]*(\d{1,5})/i)!)
    .find((m) => !knownNonSeries.has(m[1].toUpperCase()));
  if (dairyBefore || dairyAfter) {
    const m = dairyBefore ?? dairyAfter!;
    code = `LEITE ${/^\d+$/.test(m[1]) ? m[1] : "S/N"}`;
    rest = text.replace(new RegExp(m[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " ");
  } else if (unnamed) {
    const series = text.match(/\b([a-z]{2,6})\s+(?:s\/?n|sem n[uú]mero)/i)?.[1];
    code = `${series && !knownNonSeries.has(series.toUpperCase()) ? series.toUpperCase() : "ANIMAL"} S/N`;
    rest = text.replace(/\b(?:m[aã]e|filh[oa]\s+(?:da|de))\s+[a-z]{2,6}\s*\d+/i, " ");
  } else if (named) {
    code = `${named[1].toUpperCase()} ${named[2]}`;
    rest = text.replace(named[0], " ");
  } else if (book.defaultSeries) {
    const m = t.match(/^(?:sim|nao)?\s*(\d{1,5})(?=\s|$)/);
    if (m && !/^\s*(?:kg|kilos?|quilos?)\b/.test(t.slice(m[0].length))) {
      code = `${book.defaultSeries} ${m[1]}`;
      rest = text.slice(m[0].length);
    }
  }
  if (!code) return null;
  const weighted = fold(rest).match(/\b(\d+(?:[.,]\d+)?)\s*(?:kg|kilos?|quilos?|k)\b/);
  const numbers = rest.match(/\b\d+(?:[.,]\d+)?\b/g) ?? [];
  const rawWeight = weighted?.[1] ?? (numbers.length === 1 ? numbers[0] : null);
  const weight = rawWeight ? Number(rawWeight.replace(",", ".")) : null;
  const sex: Sex = /\bfemea\b|vaca\s+de\s+leite/.test(t)
    ? "fêmea"
    : /\bmacho\b/.test(t)
      ? "macho"
      : book.defaultSex;
  const reproductive = book.reproductiveMode
    ? /\b(nao|nao vai)\b/.test(t)
      ? "não inseminar"
      : /\b(sim|sin|sum|ens)\b/.test(t)
        ? "inseminar"
        : null
    : null;
  const notes: string[] = [];
  const mother = text.match(/\b(?:m[aã]e|filh[oa]\s+(?:da|de))\s+([a-z]{2,6}\s*\d+)/i)?.[1];
  if (mother) notes.push(`Mãe: ${mother.toUpperCase()}`);
  if (/descarte/.test(t)) notes.push("Descarte");
  if (/sem bico|peito|defeito/.test(t)) notes.push(text.slice(0, 200));
  return {
    key,
    code,
    weight:
      weight !== null && Number.isFinite(weight) && weight > 0 && weight <= 2000 ? weight : null,
    estimated: false,
    sex,
    reproductive,
    notes,
    procedures: [...book.procedures],
    batch: book.batch,
  };
}
function number(n: number) {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}
export function herdTotals(book: HerdBook) {
  const measured = book.entries.filter((e) => e.weight !== null && !e.estimated);
  const estimated = book.entries.filter((e) => e.weight !== null && e.estimated);
  const sum = measured.reduce((s, e) => s + e.weight!, 0);
  return {
    count: book.entries.length,
    measured: measured.length,
    estimated: estimated.length,
    missing: book.entries.filter((e) => e.weight === null).length,
    total: sum,
    mean: measured.length ? sum / measured.length : null,
    females: book.entries.filter((e) => e.sex === "fêmea").length,
    males: book.entries.filter((e) => e.sex === "macho").length,
  };
}
export function herdSummary(book: HerdBook): string {
  const s = herdTotals(book);
  return `${book.recoveryWarnings ? `Reconstrução parcial: ${book.recoveryWarnings} mensagens precisam de conferência; totais abaixo abrangem somente os registros recuperados.\n` : ""}${s.count} animais: ${s.females} fêmeas, ${s.males} machos e ${s.count - s.females - s.males} com sexo não informado.\n${s.measured} pesos informados; total ${number(s.total)} kg${s.mean !== null ? `; média ${number(s.mean)} kg` : ""}. ${s.missing} sem peso; ${s.estimated} com peso estimado (estimativas fora da soma e da média dos pesos informados).`;
}
export function entryLine(e: HerdEntry): string {
  return `${e.code} — ${e.weight === null ? "peso pendente" : number(e.weight) + " kg" + (e.estimated ? " (estimado)" : "")} — ${e.sex ?? "sexo não informado"}${e.reproductive ? " — " + e.reproductive.toUpperCase() : ""}${e.procedures.length ? " — " + e.procedures.join("; ") : ""}${e.notes.length ? " — " + e.notes.join("; ") : ""}`;
}
export function renderHerdReport(book: HerdBook, day: string): string {
  const lines = book.entries.map((e, i) => `${i + 1}. ${entryLine(e)}`);
  const header = `Registros de ${day.split("-").reverse().join("/")}\n${herdSummary(book)}\n\n`;
  // An explicit limit, never a partial list disguised as a complete report.
  let result = header;
  for (let i = 0; i < lines.length; i++) {
    if (result.length + lines[i].length > 110000)
      return (
        result +
        `\nListagem parcial: ${i} de ${lines.length}. Solicite um lote específico para os demais registros.`
      );
    result += lines[i] + "\n";
  }
  return result;
}
/** Pure reducer: every accepted edit is later committed atomically with its response. */
export function reduceHerdTurn(
  original: HerdBook,
  raw: string,
  key: string,
  day: string,
): HerdTurn | null {
  const text = raw
    .replace(
      /^\[Mensagem recebida por áudio[^\]]*\]\s*Pedido do usuário:[\s\S]*?Transcrição do áudio:\s*/i,
      "",
    )
    .trim();
  if (!wantsHerdTurn(text, original)) return null;
  const book: HerdBook = structuredClone(original);
  const t = fold(text);
  const last = () => book.entries.find((e) => e.key === book.lastKey);
  const done = (reply: string): HerdTurn => ({ book, reply });
  if (/^confirmar importacao[!. ]*$/.test(t) && book.importDraft) {
    let included = 0,
      conflicts = 0;
    for (const entry of book.importDraft) {
      if (book.entries.some((e) => e.code === entry.code && !entry.code.includes("S/N"))) {
        conflicts++;
        continue;
      }
      book.entries.push(entry);
      book.lastKey = entry.key;
      included++;
    }
    delete book.importDraft;
    book.active = true;
    return done(
      `Importação conferida por você: ${included} incluídos; ${conflicts} códigos já existentes preservados, sem substituição automática.\n${herdSummary(book)}`,
    );
  }
  if (/^cancelar importacao[!. ]*$/.test(t)) {
    delete book.importDraft;
    return done("Importação cancelada. Os registros anteriores foram preservados.");
  }

  if (/\b(parar|encerrar)\b.{0,25}(registro|anotacao)/.test(t)) {
    book.active = false;
    return done("Anotação encerrada. Os registros salvos continuam disponíveis para consulta.");
  }
  if (/qual.*(?:nao tem sexo|sem sexo)/.test(t)) {
    const unknown = book.entries.filter((e) => e.sex === null);
    if (unknown.length === 1) book.lastKey = unknown[0].key;
    return done(
      unknown.length
        ? unknown.map(entryLine).join("\n")
        : "Todos os animais possuem sexo informado.",
    );
  }
  if (isHerdReport(text) && !/(?:essa|esta) lista vai ser|se colocar sim/.test(t)) {
    if (isHerdSummary(text)) return done(herdSummary(book));
    const declaresSex = /\b(?:e|era|sexo|ela e|ele e) (?:uma? )?(?:femea|macho)\b/.test(t);
    if (declaresSex && last() && !/\d/.test(t)) last()!.sex = /femea/.test(t) ? "fêmea" : "macho";
    else if (/\b(?:machos?|femeas?)\b/.test(t) && !(/macho/.test(t) && /femea/.test(t))) {
      const sex: Sex = /femea/.test(t) ? "fêmea" : "macho";
      return done(
        `Filtro: ${sex === "macho" ? "machos" : "fêmeas"}.\n` +
          renderHerdReport(
            { ...book, entries: book.entries.filter((entry) => entry.sex === sex) },
            day,
          ),
      );
    }
    return done(renderHerdReport(book, day));
  }
  if (herdSessionStart(text)) book.active = true;
  if (/novo lote/.test(t)) {
    book.batch++;
    book.procedures = [];
    book.defaultSex = null;
    book.defaultSeries = null;
    book.reproductiveMode = false;
    book.lastKey = null;
  }
  if (
    /\b(sim|confirmo|confirmar|pode corrigir)\b/.test(t) &&
    book.pending &&
    /^(sim|confirmo|confirmar|pode corrigir)[!. ]*$/.test(t)
  ) {
    const p = book.pending;
    const index = book.entries.findIndex((e) => e.key === p.existingKey);
    if (index >= 0) book.entries[index] = { ...p.entry, key: p.existingKey };
    book.lastKey = p.existingKey;
    book.pending = null;
    return done(`Atualização confirmada: ${entryLine(book.entries[index])}\n${herdSummary(book)}`);
  }
  if (/^(nao|cancelar)[!. ]*$/.test(t) && book.pending) {
    book.pending = null;
    return done("Atualização cancelada. O registro anterior foi preservado.");
  }
  if (/\b(todas?|todos?)\b/.test(t) && /\bfemea\b|\bmacho\b/.test(t)) {
    const sex: Sex = /femea/.test(t) ? "fêmea" : "macho";
    const previous = /anterior/.test(t);
    const targetBatch = previous ? book.batch - 1 : book.batch;
    for (const e of book.entries) if (e.batch === targetBatch) e.sex = sex;
    if (!previous) book.defaultSex = sex;
    return done(`Sexo atualizado para ${sex} no lote ${targetBatch}.\n${herdSummary(book)}`);
  }
  const defaultSeries = t.match(/todas?\s+(?:sao|e)\s+([a-z]{2,6})\b/);
  if (defaultSeries) {
    book.defaultSeries = defaultSeries[1].toUpperCase();
    return done(
      `Série padrão deste lote: ${book.defaultSeries}. Informe número, peso e demais observações.`,
    );
  }
  if (/insemin|ensemin/.test(t) && !/\b\d+\s*(kg|k)\b/.test(t)) {
    book.reproductiveMode = true;
    book.defaultSex = "fêmea";
    return done(
      "Modo de anotação reprodutiva ativado: “sim” marca INSEMINAR e “não” marca NÃO INSEMINAR, conforme sua decisão. Informe o código e o peso.",
    );
  }
  if (
    /\b(nao|sem)\b.{0,40}(consulta|consultar|pesquisa|pesquisar)|so (?:marcacao|registro|anotacao)/.test(
      t,
    )
  )
    return done("Continuarei apenas anotando. Consultas genealógicas exigem um pedido explícito.");
  // Store exactly the reported product/procedure, without guessing its medical indication.
  if (/vacina|vermifugo|vacinad|tomou/.test(t) && !parseHerdEntry(text, book, key)) {
    const labels: string[] = [];
    const vaccine = text
      .match(
        /vacina\s+(?:[ée]\s+|contra\s+|de\s+)?([\p{L}][\p{L}\d -]{0,45}?)(?=\s+(?:e |para |no |em |vou |coloque )|[,.]|$)/iu,
      )?.[1]
      ?.trim();
    const wormer = text.match(/verm[ií]fugo\s+(?:[ée]\s+|de\s+)?([\p{L}][\p{L}\d-]*)/iu)?.[1];
    if (vaccine) labels.push(`Vacina informada: ${vaccine}`);
    if (wormer) labels.push(`Vermífugo informado: ${wormer}`);
    if (!labels.length)
      return done(
        "Quais os nomes dos produtos/procedimentos aplicados e a quais lotes? Não vou deduzir produto, indicação ou aplicação.",
      );
    book.procedures = [...new Set([...book.procedures, ...labels])];
    for (const e of book.entries)
      if (e.batch === book.batch) e.procedures = [...new Set([...e.procedures, ...labels])];
    return done(
      `Manejo informado no lote ${book.batch}: ${labels.join("; ")}. Informação declarada por você; sem inferir indicação ou dose.`,
    );
  }
  if (/\b(media|sem peso)\b/.test(t) && /\d/.test(t) && !/\b[a-z]{2,6}\s*\d+\s+\d/i.test(text)) {
    const value = Number(
      t.match(/\b(\d+(?:[.,]\d+)?)\s*(?:kg|kilos?|quilos?)\b/)?.[1]?.replace(",", "."),
    );
    if (Number.isFinite(value) && value > 0 && value <= 2000 && /sem peso|nao tem peso/.test(t)) {
      let changed = 0;
      for (const e of book.entries)
        if (e.weight === null) {
          e.weight = value;
          e.estimated = true;
          changed++;
        }
      return done(
        `${changed} pesos ausentes preenchidos com estimativa de ${number(value)} kg, identificados separadamente.\n${herdSummary(book)}`,
      );
    }
    return done(
      `A média será calculada somente pelos pesos informados. Para preencher ausências, diga “colocar 532 kg nos animais sem peso”.\n${herdSummary(book)}`,
    );
  }
  // Simple correction always targets the durable last record, never a summary's last number.
  const correction = /\b(corrij\w*|corrig\w*|correcao|perdao)\b/.test(t);
  if (correction && last()) {
    const current = last()!;
    const explicit = parseHerdEntry(text, book, key);
    if (explicit && explicit.weight !== null) {
      const matches = book.entries.filter((e) => e.code === explicit.code);
      if (matches.length !== 1)
        return done(
          "Informe o código exato do registro que deve ser corrigido. Não alterei nenhum animal.",
        );
      matches[0].weight = explicit.weight;
      matches[0].estimated = false;
      book.lastKey = matches[0].key;
      return done(`Corrigido: ${entryLine(matches[0])}\n${herdSummary(book)}`);
    }
    const weight = t.match(/\b(\d+(?:[.,]\d+)?)\s*(?:kg|kilos?|quilos?|kilod|k)\b/);
    if (weight) {
      const value = Number(weight[1].replace(",", "."));
      if (value <= 0 || value > 2000) return done("Peso inválido. Não alterei o registro.");
      current.weight = value;
      current.estimated = false;
      return done(`Peso corrigido: ${entryLine(current)}\n${herdSummary(book)}`);
    }
    const numbers = t.match(/\d+/g) ?? [];
    const series = text.match(/\b(?:[ée]|era)\s+([a-z]{2,6})\b/i)?.[1]?.toUpperCase();
    if (
      (numbers.length === 1 && /ultima|ultimo|numero|codigo|era|identific/.test(t)) ||
      (series && !["ULTIMA", "ULTIMO"].includes(series))
    ) {
      const prefix = series && !knownNonSeries.has(series) ? series : current.code.split(" ")[0];
      const code = prefix + " " + (numbers[0] ?? current.code.split(" ")[1]);
      if (book.entries.some((e) => e.key !== current.key && e.code === code))
        return done(
          "Esse código já existe. Confirme qual dos dois animais deve ser alterado. Nenhum registro foi substituído.",
        );
      current.code = code;
      return done(`Identificação corrigida: ${entryLine(current)}`);
    }
    return done(
      "Qual campo deve ser corrigido e em qual animal? Os registros atuais foram preservados.",
    );
  }
  const standaloneWeight = t.match(
    /^(?:peso\s*)?(\d+(?:[.,]\d+)?)\s*(?:kg|kilos?|quilos?|k)?[!. ]*$/,
  );
  if (standaloneWeight && last()?.weight === null) {
    const value = Number(standaloneWeight[1].replace(",", "."));
    if (value > 0 && value <= 2000) {
      last()!.weight = value;
      return done(`Peso registrado: ${entryLine(last()!)}\n${herdSummary(book)}`);
    }
  }
  if (book.reproductiveMode && /ja passad|ja registrad/.test(t)) {
    const id = t.match(/\b\d+\b/)?.[0];
    const matches = book.entries.filter((e) => e.code === `${book.defaultSeries ?? "DUKN"} ${id}`);
    if (matches.length === 1 && /\b(sim|nao)\b/.test(t)) {
      matches[0].reproductive = /\bnao\b/.test(t) ? "não inseminar" : "inseminar";
      return done(`Decisão atualizada, sem novo animal: ${entryLine(matches[0])}`);
    }
  }
  // Explicit sex corrections may name multiple existing numeric identifiers.
  if (/\b(macho|femea)\b/.test(t) && !/\b(kg|kilos?|quilos?)\b/.test(t)) {
    const ids: string[] = t.match(/\b\d+\b/g) ?? [];
    if (ids.length > 1 && /\be\b/.test(t)) {
      const selected = book.entries.filter((e) => ids.includes(e.code.split(" ")[1]));
      if (selected.length === ids.length) {
        for (const e of selected) e.sex = /femea/.test(t) ? "fêmea" : "macho";
        return done(selected.map(entryLine).join("\n"));
      }
    }
    if (!ids.length && last()) {
      last()!.sex = /femea/.test(t) ? "fêmea" : "macho";
      return done(`Sexo registrado: ${entryLine(last()!)}`);
    }
  }
  if (
    /defeito|peito|descarte|observacao/.test(t) &&
    last() &&
    !/\b[a-z]{2,6}\s*\d+\s+(?:\d|peso)/i.test(text)
  ) {
    last()!.notes.push(text.slice(0, 300));
    return done(`Observação adicionada: ${entryLine(last()!)}`);
  }
  const entry = parseHerdEntry(text, book, key);
  if (entry) {
    const initialVaccine = text.match(
      /vacina\s+(?:[ée]\s+|contra\s+|de\s+)([\p{L}][\p{L}\d-]*)/iu,
    )?.[1];
    if (initialVaccine) {
      const label = `Vacina informada: ${initialVaccine}`;
      book.procedures = [...new Set([...book.procedures, label])];
      entry.procedures = [...book.procedures];
    }
    const existing = book.entries.find((e) => !entry.code.includes("S/N") && e.code === entry.code);
    if (existing) {
      book.pending = {
        entry: {
          ...existing,
          ...entry,
          weight: entry.weight ?? existing.weight,
          sex: entry.sex ?? existing.sex,
          reproductive: entry.reproductive ?? existing.reproductive,
        },
        existingKey: existing.key,
      };
      return done(
        `Já existe ${entryLine(existing)}. Deseja atualizar esse mesmo animal para ${entryLine(book.pending.entry)}? Responda “sim” ou “não”. Nenhum novo animal foi contado.`,
      );
    }
    if (book.entries.length >= 5000)
      return done(
        "O limite de 5.000 registros nesta data foi atingido. Os registros anteriores estão preservados.",
      );
    book.entries.push(entry);
    book.lastKey = entry.key;
    book.active = true;
    return done(
      `Registrado: ${entryLine(entry)}.${entry.weight === null ? "\nQual o peso desse animal em kg?" : ""}\n${herdSummary(book)}`,
    );
  }
  if (/salv|guard/.test(t))
    return done(
      `Os registros estruturados desta data estão salvos.\n${herdSummary(book)}\nUse “lista geral” para consultar os animais individualmente.`,
    );
  if (/defeito|peito|descarte|observacao/.test(t) && last()) {
    last()!.notes.push(text.slice(0, 300));
    return done(`Observação adicionada: ${entryLine(last()!)}`);
  }
  if (/terminou|finaliz|encerrou/.test(t)) return done(renderHerdReport(book, day));
  if (book.entries.length === 0 && book.active)
    return done(
      "Anotação iniciada. Envie código do animal, peso e sexo. Cada confirmação será feita após salvar; os totais serão calculados pelos registros.",
    );
  return done(
    "Não consegui identificar com segurança a alteração. Envie código, peso e o campo a alterar. Os registros anteriores foram preservados.",
  );
}
