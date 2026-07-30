// Conversation State — camada 2 da arquitetura de contexto da TPEC-IA.
//
// Módulo PURO (sem I/O, sem dependência de servidor) para que possa ser usado
// pelo backend (core.server.ts), pelos testes automatizados e, se necessário,
// pelo cliente (persistência em localStorage).
//
// Responsabilidades:
//  - representar o estado corrente da conversa (tópico, objetivo, dados
//    confirmados, pergunta/ação pendente);
//  - classificar a intenção de cada mensagem do usuário;
//  - resolver mensagens curtas ("sim", "isso", "o segundo", "pode") usando a
//    pergunta pendente;
//  - manter um resumo estruturado acumulado;
//  - montar a janela de histórico respeitando um orçamento de tokens.

import type { ChatMessage } from "./types";

export type UserIntent =
  | "nova_pergunta"
  | "resposta_a_confirmacao"
  | "user_acknowledgement"
  | "fornecimento_de_dado"
  | "correcao"
  | "continuacao"
  | "cancelamento"
  | "selecao_de_opcao"
  | "pedido_de_calculo"
  | "pedido_de_comparacao"
  | "mudanca_de_assunto";

export type ConversationStatus = "idle" | "active";

export type AssistantIntent =
  | "request_confirmation"
  | "request_data"
  | "offer_options"
  | "answer"
  | "none";

export interface ConversationSummary {
  user_goal: string;
  current_topic: string;
  known_facts: string[];
  confirmed_decisions: string[];
  rejected_options: string[];
  pending_questions: string[];
  important_entities: string[];
  technical_context: string[];
  last_completed_action: string;
  next_expected_action: string;
}

export interface ConversationState {
  conversation_id: string;
  version: number;
  current_topic: string | null;
  user_goal: string | null;
  pending_question: string | null;
  pending_action: string | null;
  pending_payload: Record<string, string | number> | null;
  awaiting_user_response: boolean;
  awaiting_confirmation: boolean;
  expected_response_type: "confirmation" | "data" | "option" | "free" | null;
  confirmation_options: string[];
  offered_options: string[];
  confirmed_data: Record<string, string | number>;
  missing_data: string[];
  corrections: Array<{ field: string; from: string | number; to: string | number }>;
  last_assistant_intent: AssistantIntent;
  last_user_intent: UserIntent | null;
  /** "idle" = usuário apenas reagiu/encerrou; a IA deve aguardar novo pedido. */
  conversation_status: ConversationStatus;
  awaiting_user_request: boolean;
  should_auto_continue: boolean;
  conversation_summary: ConversationSummary;
  turn_count: number;
  updated_at: string;
}

export const EMPTY_SUMMARY: ConversationSummary = {
  user_goal: "",
  current_topic: "",
  known_facts: [],
  confirmed_decisions: [],
  rejected_options: [],
  pending_questions: [],
  important_entities: [],
  technical_context: [],
  last_completed_action: "",
  next_expected_action: "",
};

export function createConversationState(conversationId: string): ConversationState {
  return {
    conversation_id: conversationId,
    version: 0,
    current_topic: null,
    user_goal: null,
    pending_question: null,
    pending_action: null,
    pending_payload: null,
    awaiting_user_response: false,
    awaiting_confirmation: false,
    expected_response_type: null,
    confirmation_options: [],
    offered_options: [],
    confirmed_data: {},
    missing_data: [],
    corrections: [],
    last_assistant_intent: "none",
    last_user_intent: null,
    conversation_status: "idle",
    awaiting_user_request: true,
    should_auto_continue: false,
    conversation_summary: { ...EMPTY_SUMMARY },
    turn_count: 0,
    updated_at: new Date(0).toISOString(),
  };
}

/** Normaliza estado vindo do cliente (pode estar parcial/antigo/adulterado). */
export function normalizeState(
  raw: Partial<ConversationState> | null | undefined,
  conversationId: string,
): ConversationState {
  const base = createConversationState(conversationId);
  if (!raw || typeof raw !== "object") return base;
  return {
    ...base,
    ...raw,
    conversation_id: conversationId,
    confirmed_data: sanitizeData(raw.confirmed_data),
    confirmation_options: asStringArray(raw.confirmation_options).slice(0, 8),
    offered_options: asStringArray(raw.offered_options).slice(0, 10),
    missing_data: asStringArray(raw.missing_data).slice(0, 10),
    corrections: Array.isArray(raw.corrections) ? raw.corrections.slice(-10) : [],
    conversation_summary: normalizeSummary(raw.conversation_summary),
    pending_question: clampOrNull(raw.pending_question, 400),
    pending_action: clampOrNull(raw.pending_action, 120),
    current_topic: clampOrNull(raw.current_topic, 200),
    user_goal: clampOrNull(raw.user_goal, 300),
    turn_count: typeof raw.turn_count === "number" ? Math.max(0, Math.min(raw.turn_count, 9999)) : 0,
    version: typeof raw.version === "number" ? raw.version : 0,
    conversation_status: raw.conversation_status === "active" ? "active" : "idle",
    awaiting_user_request: raw.awaiting_user_request !== false,
    should_auto_continue: raw.should_auto_continue === true,
  };
}

function clampOrNull(v: unknown, max: number): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}
function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string").map((x) => x.slice(0, 300)) : [];
}
function sanitizeData(v: unknown): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (!v || typeof v !== "object") return out;
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "number" && Number.isFinite(val)) out[k.slice(0, 40)] = val;
    else if (typeof val === "string" && val.trim()) out[k.slice(0, 40)] = val.slice(0, 200);
    if (Object.keys(out).length >= 30) break;
  }
  return out;
}
function normalizeSummary(v: unknown): ConversationSummary {
  const s = (v ?? {}) as Partial<ConversationSummary>;
  const arr = (x: unknown, n = 12) => asStringArray(x).slice(-n);
  return {
    user_goal: typeof s.user_goal === "string" ? s.user_goal.slice(0, 300) : "",
    current_topic: typeof s.current_topic === "string" ? s.current_topic.slice(0, 200) : "",
    known_facts: arr(s.known_facts, 15),
    confirmed_decisions: arr(s.confirmed_decisions),
    rejected_options: arr(s.rejected_options),
    pending_questions: arr(s.pending_questions, 5),
    important_entities: arr(s.important_entities),
    technical_context: arr(s.technical_context),
    last_completed_action: typeof s.last_completed_action === "string" ? s.last_completed_action.slice(0, 160) : "",
    next_expected_action: typeof s.next_expected_action === "string" ? s.next_expected_action.slice(0, 160) : "",
  };
}

// ---------------------------------------------------------------------------
// Reconhecimento de intenção
// ---------------------------------------------------------------------------

const AFFIRMATIVE_RE =
  /^(sim|isso|isso\s+mesmo|é\s+isso|e\s+isso|claro|com\s+certeza|certo|correto|exato|exatamente|confirmo|confirmado|pode|pode\s+ser|pode\s+sim|pode\s+fazer|pode\s+continuar|pode\s+seguir|pode\s+mandar|manda|manda\s+a[ií]|faça|faz|faz\s+sim|quero|quero\s+sim|por\s+favor|pf|vamos|bora|beleza|blz|ok(ay)?|t[áa]\s+bom|t[áa]|perfeito|afirmativo|continua|continue|segue|prossiga|aham|uhum|s)$/i;

const NEGATIVE_RE =
  /^(n[ãa]o|nao|n|nops?|negativo|n[ãa]o\s+é\s+isso|nao\s+e\s+isso|n[ãa]o\s+quero|cancela|cancelar|deixa|deixa\s+pra\s+l[áa]|esquece|est[áa]\s+errado|ta\s+errado|errado|melhor\s+n[ãa]o)$/i;

const CORRECTION_RE =
  /\b(na\s+verdade|corrig(indo|e)|me\s+enganei|errei|desconsidera|desconsidere|esquece\s+o\s+que|nao\s+[ée]\s+\d|n[ãa]o\s+[ée]\s+\d|troca\s+para|muda\s+para|mude\s+para|altera\s+para|ao\s+inv[ée]s\s+de)\b/i;

const CALC_RE =
  /\b(calcul[ae]|calcular|quanto\s+(de|gasta|preciso|vou|d[áa])|quantos?\s+(sacos?|kg|quilos?)|dimension|estimar|estimativa|consumo\s+total|dieta\s+para)\b/i;

const COMPARE_RE = /\b(compar[ae]|compara[çc][ãa]o|diferen[çc]a\s+entre|melhor\s+entre|x\s+vs|versus)\b/i;

const OPTION_RE =
  /\b(o|a)\s+(primeir[oa]|segund[oa]|terceir[oa]|quart[oa]|[úu]ltim[oa])\b|\bop[çc][ãa]o\s+(\d|um|dois|tr[êe]s)\b|\bn[úu]mero\s+\d\b/i;

const CANCEL_RE = /\b(cancela|cancelar|esquece|deixa\s+pra\s+l[áa]|para\s+tudo|desiste|desisto)\b/i;

const TOPIC_CHANGE_RE =
  /\b(mudando\s+de\s+assunto|outra\s+coisa|outra\s+pergunta|deixa\s+isso|agora\s+quero\s+saber|falando\s+em\s+outra)\b/i;

// ---------------------------------------------------------------------------
// Reconhecimento / reação curta ("user_acknowledgement")
// ---------------------------------------------------------------------------

/**
 * Tokens que, sozinhos ou combinados, representam apenas reação, concordância,
 * agradecimento ou encerramento — nunca um novo pedido.
 * A classificação NÃO depende só desta lista: ela só vale quando não existe
 * pergunta/ação pendente e quando não sobra nenhum conteúdo novo na mensagem.
 */
const ACK_TOKENS = new Set([
  "ah", "aah", "aa", "oh", "ooh", "opa", "pois", "então", "entao", "e", "é", "eh",
  "muito", "mto", "bem", "bastante", "que", "tudo", "isso", "mesmo", "assim",
  "sim", "ok", "okay", "okey", "blz", "beleza", "certo", "correto", "exato",
  "exatamente", "entendi", "entendido", "entendida", "entendo", "compreendi",
  "saquei", "ciente", "agora", "faz", "sentido", "verdade", "claro", "uhum",
  "aham", "ahan", "hm", "hmm", "hum", "humm", "legal", "bacana", "interessante",
  "show", "massa", "top", "ótimo", "otimo", "perfeito", "boa", "bom", "joia",
  "jóia", "maneiro", "dahora", "demais", "tranquilo", "suave", "nossa", "uau",
  "wow", "caramba", "puxa", "eita", "valeu", "vlw", "obrigado", "obrigada",
  "obg", "grato", "grata", "thanks", "obrigadão", "obrigadao", "ta", "tá",
  "tudo bem", "belezinha", "ss", "ahh",
]);

const THANKS_RE = /\b(valeu|vlw|obrigad|obg|grat[oa]|thanks)\b/i;
const CLOSING_RE = /\b(tchau|at[ée]\s+mais|falou|flw|adeus|bye|por\s+hoje\s+[ée]\s+s[óo]|era\s+s[óo]\s+isso)\b/i;

/** "hummmm", "hmmm", "aaah" → forma canônica curta. */
function canonicalToken(w: string): string {
  if (/^h+[uma]*m+h*$/i.test(w)) return "hmm";
  if (/^a+h+$/i.test(w)) return "ah";
  if (/^o+k+$/i.test(w)) return "ok";
  return w.replace(/(.)\1{2,}/g, "$1$1");
}

export interface AckAnalysis {
  isAcknowledgement: boolean;
  thanks: boolean;
  closing: boolean;
  /** Restante da mensagem depois de remover os tokens de reação. */
  remainder: string;
}

/**
 * Detecta se a mensagem é PURA reação/reconhecimento, isto é: não contém
 * pergunta, pedido, dado novo, correção nem mudança de assunto.
 */
export function analyzeAcknowledgement(text: string): AckAnalysis {
  const raw = text.trim();
  const thanks = THANKS_RE.test(raw);
  const closing = CLOSING_RE.test(raw);

  if (!raw || raw.length > 70 || /[?]/.test(raw)) {
    return { isAcknowledgement: false, thanks, closing, remainder: raw };
  }

  const words = raw
    .toLowerCase()
    .replace(/[!.…,;:"'()]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(canonicalToken);

  if (words.length === 0 || words.length > 8) {
    return { isAcknowledgement: false, thanks, closing, remainder: raw };
  }

  const leftover = words.filter((w) => !ACK_TOKENS.has(w));
  return {
    isAcknowledgement: leftover.length === 0,
    thanks,
    closing,
    remainder: leftover.join(" "),
  };
}

const ORDINALS: Record<string, number> = {
  primeiro: 1, primeira: 1, um: 1, "1": 1,
  segundo: 2, segunda: 2, dois: 2, "2": 2,
  terceiro: 3, terceira: 3, "três": 3, tres: 3, "3": 3,
  quarto: 4, quarta: 4, quatro: 4, "4": 4,
};

function stripPunct(t: string): string {
  return t.trim().toLowerCase().replace(/[!.?…,;]+$/g, "").replace(/\s+/g, " ");
}

export function isAffirmative(text: string): boolean {
  const t = stripPunct(text);
  if (AFFIRMATIVE_RE.test(t)) return true;
  // "sim, pode fazer", "isso mesmo, o segundo", "pode sim por favor"
  return /^(sim|isso|claro|pode|ok|beleza|correto|exato|confirmo|perfeito|certo)\b/i.test(t) &&
    !NEGATIVE_RE.test(t.split(/[, ]/)[0] ?? "");
}

export function isNegative(text: string): boolean {
  const t = stripPunct(text);
  if (NEGATIVE_RE.test(t)) return true;
  return /^(n[ãa]o|nao|cancela|esquece|errado)\b/i.test(t);
}

/** Extrai dados numéricos conhecidos do domínio a partir do texto livre. */
export function extractDomainData(text: string): Record<string, number> {
  const t = text.toLowerCase().replace(/\./g, "").replace(/,/g, ".");
  const out: Record<string, number> = {};
  const num = (re: RegExp): number | null => {
    const m = t.match(re);
    if (!m) return null;
    const v = Number.parseFloat(m[1]);
    return Number.isFinite(v) ? v : null;
  };
  const animais = num(/(\d+(?:\.\d+)?)\s*(?:cabe[çc]as?|animais|animal|bois?|vacas?|novilhas?|bezerros?|garrotes?|ovelhas?|cavalos?)\b/);
  if (animais !== null) out.numero_animais = animais;
  const peso = num(/(\d+(?:\.\d+)?)\s*(?:kg|quilos?|arrobas?\s+de\s+peso)?\s*(?:de\s+)?(?:peso(?:\s+m[ée]dio)?)?\b(?=[^\d]*$|.*\bkg\b)/);
  const pesoExpl = num(/(?:peso(?:\s+m[ée]dio)?(?:\s+de)?\s*|com\s+|uns?\s+|cerca\s+de\s+|aproximadamente\s+)?(\d+(?:\.\d+)?)\s*(?:kg|quilos?)\b/);
  if (pesoExpl !== null) out.peso_medio_kg = pesoExpl;
  else if (peso !== null && /kg|quilo/.test(t)) out.peso_medio_kg = peso;
  const dias = num(/(\d+(?:\.\d+)?)\s*dias?\b/);
  if (dias !== null) out.periodo_dias = dias;
  const meses = num(/(\d+(?:\.\d+)?)\s*(?:meses|m[êe]s)\b/);
  if (meses !== null && dias === null) out.periodo_dias = meses * 30;
  return out;
}

export interface IntentAnalysis {
  intent: UserIntent;
  affirmative: boolean;
  negative: boolean;
  selectedOption: number | null;
  extracted: Record<string, number>;
  isShort: boolean;
  /** A mensagem se refere ao assunto anterior? */
  isContextuallyRelated: boolean;
  /** A mensagem pede informação nova? */
  requiresInformationalAnswer: boolean;
  shouldContinueTopic: boolean;
  shouldExecuteAction: boolean;
  shouldSearch: boolean;
  ack: AckAnalysis;
}

export function classifyUserIntent(text: string, state: ConversationState): IntentAnalysis {
  const raw = text.trim();
  const t = stripPunct(raw);
  const extracted = extractDomainData(raw);
  const isShort = t.length <= 40 && t.split(" ").length <= 6;

  let selectedOption: number | null = null;
  const om = raw.match(OPTION_RE);
  if (om) {
    const word = (om[0].match(/primeir[oa]|segund[oa]|terceir[oa]|quart[oa]|[úu]ltim[oa]|\d/i)?.[0] ?? "").toLowerCase();
    if (/[úu]ltim/.test(word)) selectedOption = state.offered_options.length || null;
    else selectedOption = ORDINALS[word] ?? (Number.isFinite(Number(word)) ? Number(word) : null);
  }

  const affirmative = isAffirmative(raw);
  const negative = isNegative(raw);
  const ack = analyzeAcknowledgement(raw);

  // Existe algo pendente que uma resposta curta poderia estar respondendo?
  const hasPending =
    (state.awaiting_user_response || state.awaiting_confirmation) &&
    !!(state.pending_question || state.pending_action);

  let intent: UserIntent = "nova_pergunta";
  if (CANCEL_RE.test(raw) && !CALC_RE.test(raw)) intent = "cancelamento";
  else if (CORRECTION_RE.test(raw) && Object.keys(extracted).length > 0) intent = "correcao";
  else if (hasPending && (affirmative || negative)) intent = "resposta_a_confirmacao";
  else if (hasPending && selectedOption !== null) intent = "selecao_de_opcao";
  // Sem pendência explícita, reação curta é reconhecimento — nunca ordem de continuar.
  else if (!hasPending && ack.isAcknowledgement) intent = "user_acknowledgement";
  else if (selectedOption !== null) intent = "selecao_de_opcao";
  else if (TOPIC_CHANGE_RE.test(raw)) intent = "mudanca_de_assunto";
  else if (COMPARE_RE.test(raw)) intent = "pedido_de_comparacao";
  else if (CALC_RE.test(raw)) intent = "pedido_de_calculo";
  else if (
    Object.keys(extracted).length > 0 &&
    (isShort || state.expected_response_type === "data" || state.awaiting_user_response)
  )
    intent = "fornecimento_de_dado";
  else if (hasPending && (affirmative || negative)) intent = "resposta_a_confirmacao";
  else if (isShort && state.current_topic) intent = "continuacao";

  const isAck = intent === "user_acknowledgement";
  const shouldExecuteAction =
    !isAck &&
    ((intent === "resposta_a_confirmacao" && affirmative && hasPending) ||
      intent === "selecao_de_opcao" ||
      intent === "fornecimento_de_dado" ||
      intent === "pedido_de_calculo" ||
      intent === "pedido_de_comparacao" ||
      intent === "nova_pergunta");

  return {
    intent,
    affirmative,
    negative,
    selectedOption,
    extracted,
    isShort,
    ack,
    isContextuallyRelated: isAck || intent === "continuacao" || hasPending,
    requiresInformationalAnswer: !isAck && intent !== "cancelamento",
    shouldContinueTopic: !isAck && intent !== "cancelamento",
    shouldExecuteAction,
    shouldSearch: !isAck && intent !== "cancelamento",
  };
}

// ---------------------------------------------------------------------------
// Leitura da última resposta da IA → pergunta/ação pendente
// ---------------------------------------------------------------------------

const CONFIRM_ASK_RE =
  /\b(deseja|quer\s+que\s+eu|posso\s+(te\s+)?(calcular|fazer|montar|considerar|seguir|passar|buscar|verificar|consultar|ajudar)|confirma|confirmar|est[áa]\s+correto|[ée]\s+isso|fa[çc]o\s+(o|a)|prossigo|sigo\s+com)\b/i;
const DATA_ASK_RE =
  /\b(qual\s+(é\s+)?(o|a)\s+|quantos?\s+|quantas?\s+|me\s+informe|me\s+diga|voc[êe]\s+sabe\s+(o|a|qual))/i;

export function analyzeAssistantReply(reply: string): {
  intent: AssistantIntent;
  question: string | null;
  options: string[];
} {
  const text = reply.trim();
  const questions = text.split(/\n+/).flatMap((line) =>
    line
      .split(/(?<=\?)\s+/)
      .map((s) => s.trim())
      .filter((s) => s.endsWith("?") && s.length > 8),
  );
  const question = questions.length > 0 ? questions[questions.length - 1].slice(0, 400) : null;

  // Opções enumeradas ("1. ...", "- **Produto X**")
  const options: string[] = [];
  for (const line of text.split(/\n/)) {
    const m = line.match(/^\s*(?:\d+[.)]|[-*•])\s+(.{3,120})$/);
    if (m) options.push(m[1].replace(/\*\*/g, "").trim());
    if (options.length >= 8) break;
  }

  let intent: AssistantIntent = question ? "answer" : "none";
  if (question && CONFIRM_ASK_RE.test(question)) intent = "request_confirmation";
  else if (question && DATA_ASK_RE.test(question)) intent = "request_data";
  else if (!question && options.length >= 2) intent = "offer_options";
  else if (question && options.length >= 2) intent = "offer_options";

  return { intent, question, options };
}

/** Deriva um rótulo de ação pendente a partir da pergunta feita pela IA. */
export function derivePendingAction(question: string | null): string | null {
  if (!question) return null;
  if (/calcul|consumo|quantidade|dieta|dimension/i.test(question)) return "calcular_quantidade_suplemento";
  if (/vendedor|contato|whats/i.test(question)) return "indicar_vendedor";
  if (/cota[çc][ãa]o|pre[çc]o|valor/i.test(question)) return "consultar_cotacao";
  if (/compar/i.test(question)) return "comparar_produtos";
  if (/produto|ficha|composi[çc][ãa]o/i.test(question)) return "detalhar_produto";
  return "responder_pergunta_pendente";
}

// ---------------------------------------------------------------------------
// Atualização do estado
// ---------------------------------------------------------------------------

const TOPIC_PATTERNS: Array<[RegExp, string]> = [
  [/proteinad|suplement|mineral|ra[çc][ãa]o|n[úu]cleo|concentrado|creep/i, "suplementação e nutrição animal"],
  [/cota[çc][ãa]o|pre[çc]o|arroba|saca|mercado|d[óo]lar|boi\s+gordo/i, "cotações e preços de mercado"],
  [/vendedor|representante|contato|whats/i, "vendedores e atendimento comercial"],
  [/unidade|filial|matriz|endere[çc]o|cnpj/i, "unidades da DuKamp"],
  [/pasto|pastagem|lota[çc][ãa]o|brachiaria|capim/i, "pastagens e lotação"],
  [/iatf|reprodu[çc][ãa]o|prenhez|cio|insemina/i, "reprodução"],
  [/carraparto|carrapato|verminose|vacina|doen[çc]a|sanidade|tristeza/i, "sanidade animal"],
  [/confinament|engorda|ganho\s+de\s+peso|gmd/i, "confinamento e engorda"],
];

function detectTopic(text: string): string | null {
  for (const [re, topic] of TOPIC_PATTERNS) if (re.test(text)) return topic;
  return null;
}

export function applyUserTurn(
  state: ConversationState,
  text: string,
  analysis: IntentAnalysis,
): ConversationState {
  const next: ConversationState = {
    ...state,
    confirmed_data: { ...state.confirmed_data },
    corrections: [...state.corrections],
    conversation_summary: { ...state.conversation_summary },
    last_user_intent: analysis.intent,
    conversation_status: analysis.intent === "user_acknowledgement" ? "idle" : "active",
    awaiting_user_request: analysis.intent === "user_acknowledgement",
    should_auto_continue: false,
    turn_count: state.turn_count + 1,
    version: state.version + 1,
    updated_at: new Date().toISOString(),
  };

  // Reconhecimento/reação: nada de novo objetivo, nada de nova ação. O assunto
  // permanece disponível como contexto, mas não autoriza continuar falando.
  if (analysis.intent === "user_acknowledgement") {
    next.pending_question = null;
    next.pending_action = null;
    next.pending_payload = null;
    next.awaiting_user_response = false;
    next.awaiting_confirmation = false;
    next.expected_response_type = null;
    next.confirmation_options = [];
    next.conversation_summary.pending_questions = [];
    next.conversation_summary.next_expected_action = "aguardar novo pedido do usuário";
    return next;
  }

  // Dados novos / correções — o valor mais recente SEMPRE substitui o anterior.
  for (const [field, value] of Object.entries(analysis.extracted)) {
    const prev = next.confirmed_data[field];
    if (prev !== undefined && prev !== value) {
      next.corrections.push({ field, from: prev, to: value });
    }
    next.confirmed_data[field] = value;
  }
  next.missing_data = next.missing_data.filter((f) => next.confirmed_data[f] === undefined);

  const topic = detectTopic(text);
  if (topic) next.current_topic = topic;

  if (analysis.intent === "pedido_de_calculo") {
    next.user_goal = text.slice(0, 300);
    next.pending_action = "calcular_quantidade_suplemento";
  } else if (analysis.intent === "pedido_de_comparacao") {
    next.user_goal = text.slice(0, 300);
  } else if (!next.user_goal && text.length > 25) {
    next.user_goal = text.slice(0, 300);
  }

  if (analysis.intent === "mudanca_de_assunto") {
    // Não apaga o contexto anterior: arquiva no resumo.
    if (state.current_topic) {
      next.conversation_summary.known_facts = dedupePush(
        next.conversation_summary.known_facts,
        `Assunto anterior interrompido pelo usuário: ${state.current_topic}.`,
      );
    }
    next.pending_question = null;
    next.pending_action = null;
    next.pending_payload = null;
    next.awaiting_user_response = false;
    next.awaiting_confirmation = false;
    next.expected_response_type = null;
  }

  if (analysis.intent === "cancelamento" || (analysis.negative && state.awaiting_user_response)) {
    if (state.pending_question) {
      next.conversation_summary.rejected_options = dedupePush(
        next.conversation_summary.rejected_options,
        state.pending_question,
      );
    }
    next.pending_question = null;
    next.pending_action = null;
    next.pending_payload = null;
    next.awaiting_user_response = false;
    next.awaiting_confirmation = false;
    next.expected_response_type = null;
  }

  if (analysis.affirmative && state.awaiting_user_response && state.pending_question) {
    next.conversation_summary.confirmed_decisions = dedupePush(
      next.conversation_summary.confirmed_decisions,
      `Usuário confirmou: ${state.pending_question}`,
    );
    if (state.pending_payload) {
      for (const [k, v] of Object.entries(state.pending_payload)) {
        if (typeof v === "number" || typeof v === "string") next.confirmed_data[k] = v;
      }
    }
    // A confirmação foi consumida: nunca pode ficar ativa para o próximo turno.
    next.conversation_summary.last_completed_action = state.pending_action ?? "";
    next.awaiting_user_response = false;
    next.awaiting_confirmation = false;
    next.expected_response_type = null;
    next.pending_question = null;
    // pending_action permanece: é o que a IA deve executar AGORA.
  }

  if (analysis.selectedOption !== null && state.offered_options.length > 0) {
    const picked = state.offered_options[analysis.selectedOption - 1];
    if (picked) {
      next.confirmed_data.opcao_selecionada = picked;
      next.conversation_summary.confirmed_decisions = dedupePush(
        next.conversation_summary.confirmed_decisions,
        `Usuário selecionou a opção ${analysis.selectedOption}: ${picked}`,
      );
      next.awaiting_user_response = false;
      next.awaiting_confirmation = false;
      next.pending_question = null;
    }
  }

  return next;
}

export function applyAssistantTurn(
  state: ConversationState,
  reply: string,
  opts: { acknowledgement?: boolean } = {},
): ConversationState {
  // Numa resposta de puro reconhecimento a IA não abre pergunta nem ação: o
  // estado continua "idle" aguardando o próximo pedido do usuário.
  if (opts.acknowledgement) {
    return {
      ...state,
      conversation_summary: {
        ...state.conversation_summary,
        pending_questions: [],
        next_expected_action: "aguardar novo pedido do usuário",
      },
      version: state.version + 1,
      updated_at: new Date().toISOString(),
      last_assistant_intent: "none",
      pending_question: null,
      pending_action: null,
      pending_payload: null,
      awaiting_user_response: false,
      awaiting_confirmation: false,
      expected_response_type: null,
      confirmation_options: [],
      conversation_status: "idle",
      awaiting_user_request: true,
      should_auto_continue: false,
    };
  }

  const a = analyzeAssistantReply(reply);
  const next: ConversationState = {
    ...state,
    conversation_summary: { ...state.conversation_summary },
    version: state.version + 1,
    updated_at: new Date().toISOString(),
    last_assistant_intent: a.intent,
    offered_options: a.options.length >= 2 ? a.options : state.offered_options,
  };

  if (a.intent === "request_confirmation") {
    next.pending_question = a.question;
    next.pending_action = derivePendingAction(a.question);
    next.pending_payload = { ...state.confirmed_data };
    next.awaiting_user_response = true;
    next.awaiting_confirmation = true;
    next.expected_response_type = "confirmation";
    next.confirmation_options = ["sim", "não"];
  } else if (a.intent === "request_data") {
    next.pending_question = a.question;
    next.pending_action = state.pending_action;
    next.awaiting_user_response = true;
    next.awaiting_confirmation = false;
    next.expected_response_type = "data";
    next.confirmation_options = [];
  } else if (a.intent === "offer_options") {
    next.pending_question = a.question;
    next.awaiting_user_response = true;
    next.awaiting_confirmation = false;
    next.expected_response_type = "option";
  } else {
    next.pending_question = null;
    next.awaiting_user_response = false;
    next.awaiting_confirmation = false;
    next.expected_response_type = null;
    next.confirmation_options = [];
    if (state.pending_action) next.conversation_summary.last_completed_action = state.pending_action;
    next.pending_action = null;
    next.pending_payload = null;
  }

  next.conversation_summary.pending_questions = next.pending_question ? [next.pending_question] : [];
  next.conversation_summary.next_expected_action =
    next.expected_response_type === "confirmation"
      ? "aguardar confirmação do usuário e executar a ação pendente"
      : next.expected_response_type === "data"
        ? "aguardar o dado solicitado"
        : next.pending_action ?? "";
  return next;
}

function dedupePush(list: string[], item: string, max = 12): string[] {
  const clean = item.trim().slice(0, 300);
  if (!clean) return list;
  const filtered = list.filter((x) => x !== clean);
  filtered.push(clean);
  return filtered.slice(-max);
}

// ---------------------------------------------------------------------------
// Resumo estruturado acumulado
// ---------------------------------------------------------------------------

export const KEEP_FULL_TURNS = 10;

/**
 * Atualiza o resumo estruturado a partir do estado + das mensagens que saíram
 * da janela recente. Determinístico (sem chamada extra ao modelo) para não
 * introduzir latência nem risco de alucinação no resumo.
 */
export function updateSummary(
  state: ConversationState,
  droppedMessages: ChatMessage[],
): ConversationSummary {
  const s: ConversationSummary = {
    ...state.conversation_summary,
    known_facts: [...state.conversation_summary.known_facts],
    important_entities: [...state.conversation_summary.important_entities],
    technical_context: [...state.conversation_summary.technical_context],
  };
  s.user_goal = state.user_goal ?? s.user_goal;
  s.current_topic = state.current_topic ?? s.current_topic;

  for (const [field, value] of Object.entries(state.confirmed_data)) {
    s.known_facts = dedupePush(
      s.known_facts.filter((f) => !f.startsWith(`${field}=`)),
      `${field}=${value}`,
      15,
    );
  }
  for (const c of state.corrections.slice(-5)) {
    s.known_facts = dedupePush(s.known_facts, `correção: ${c.field} passou de ${c.from} para ${c.to}`, 15);
  }

  for (const m of droppedMessages) {
    if (m.role !== "user") continue;
    const data = extractDomainData(m.content);
    for (const [k, v] of Object.entries(data)) s.known_facts = dedupePush(s.known_facts, `${k}=${v}`, 15);
    const ent = m.content.match(/\b(DUKAMP[\w\s/-]{0,24}|BABYKAMP|ADEKAMP|HORSE\s+POWER|FERTIKAMP|BEEFKAMP)\b/i);
    if (ent) s.important_entities = dedupePush(s.important_entities, ent[0].trim(), 12);
    const loc = m.content.match(/\b(?:em|no|na)\s+([A-ZÁ-Ú][a-zá-ú]+(?:\s+[A-ZÁ-Ú]?[a-zá-ú]+){0,2})/);
    if (loc) s.important_entities = dedupePush(s.important_entities, `localidade: ${loc[1]}`, 12);
  }

  s.pending_questions = state.pending_question ? [state.pending_question] : [];
  return s;
}

// ---------------------------------------------------------------------------
// Janela de contexto por tokens
// ---------------------------------------------------------------------------

/** Estimativa conservadora: ~4 caracteres por token em português. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateMessagesTokens(messages: ChatMessage[]): number {
  return messages.reduce((acc, m) => acc + estimateTokens(m.content) + 4, 0);
}

export interface WindowResult {
  kept: ChatMessage[];
  dropped: ChatMessage[];
  tokens: number;
  truncated: boolean;
  reason: string | null;
}

/**
 * Monta a janela de histórico: mantém as últimas KEEP_FULL_TURNS mensagens
 * sempre (nunca corta uma pergunta pendente e sua resposta) e adiciona as mais
 * antigas enquanto couber no orçamento de tokens.
 */
export function buildHistoryWindow(
  history: ChatMessage[],
  budgetTokens = 6000,
  maxMessages = 40,
): WindowResult {
  const recentCap = history.slice(-maxMessages);
  const dropped: ChatMessage[] = history.slice(0, Math.max(0, history.length - maxMessages));
  const mandatory = recentCap.slice(-KEEP_FULL_TURNS);
  const older = recentCap.slice(0, Math.max(0, recentCap.length - KEEP_FULL_TURNS));

  let tokens = estimateMessagesTokens(mandatory);
  const kept: ChatMessage[] = [];
  let truncated = dropped.length > 0;

  for (let i = older.length - 1; i >= 0; i--) {
    const cost = estimateTokens(older[i].content) + 4;
    if (tokens + cost > budgetTokens) {
      dropped.unshift(...older.slice(0, i + 1));
      truncated = true;
      break;
    }
    tokens += cost;
    kept.unshift(older[i]);
  }

  return {
    kept: [...kept, ...mandatory],
    dropped,
    tokens,
    truncated,
    reason: truncated
      ? dropped.length > 0 && history.length > maxMessages
        ? "limite de mensagens e/ou orçamento de tokens"
        : "orçamento de tokens"
      : null,
  };
}

// ---------------------------------------------------------------------------
// Serialização do estado para o modelo
// ---------------------------------------------------------------------------

export function renderStateForModel(state: ConversationState): string {
  const payload = {
    current_topic: state.current_topic,
    user_goal: state.user_goal,
    pending_question: state.pending_question,
    pending_action: state.pending_action,
    awaiting_confirmation: state.awaiting_confirmation,
    expected_response_type: state.expected_response_type,
    confirmed_data: state.confirmed_data,
    missing_data: state.missing_data,
    offered_options: state.offered_options,
    corrections: state.corrections.slice(-5),
    last_assistant_intent: state.last_assistant_intent,
    last_user_intent: state.last_user_intent,
    turn_count: state.turn_count,
  };
  return JSON.stringify(payload, null, 0);
}

export function renderSummaryForModel(summary: ConversationSummary): string | null {
  const hasContent =
    summary.user_goal ||
    summary.current_topic ||
    summary.known_facts.length ||
    summary.confirmed_decisions.length ||
    summary.rejected_options.length ||
    summary.important_entities.length;
  if (!hasContent) return null;
  return JSON.stringify(summary, null, 0);
}

/**
 * Instrução explícita de como interpretar a mensagem atual, derivada do estado
 * e da intenção detectada. É isto que impede a IA de tratar "sim" como uma
 * nova conversa.
 */
export function buildInterpretationDirective(
  stateBefore: ConversationState,
  analysis: IntentAnalysis,
  text: string,
): string | null {
  const lines: string[] = [];
  const pq = stateBefore.pending_question;

  if (analysis.intent === "resposta_a_confirmacao" && analysis.affirmative && pq) {
    lines.push(
      `A mensagem atual ("${text}") é uma CONFIRMAÇÃO POSITIVA da sua pergunta anterior: "${pq}".`,
      `EXECUTE AGORA a ação pendente (${stateBefore.pending_action ?? "responder o que foi oferecido"}) usando os dados já confirmados.`,
      `NÃO repita a pergunta, NÃO cumprimente, NÃO encerre a conversa, NÃO peça dados que já constam em confirmed_data.`,
    );
  } else if (analysis.intent === "resposta_a_confirmacao" && analysis.negative && pq) {
    lines.push(
      `A mensagem atual ("${text}") é uma NEGAÇÃO da sua pergunta anterior: "${pq}".`,
      `Cancele/revise essa ação. Se o usuário indicou um novo valor na mesma mensagem, use o novo valor e siga com a ação corrigida.`,
    );
  } else if (analysis.intent === "cancelamento") {
    lines.push(`O usuário cancelou a ação pendente. Confirme o cancelamento em uma frase e pergunte como seguir.`);
  } else if (analysis.intent === "selecao_de_opcao" && analysis.selectedOption) {
    const picked = stateBefore.offered_options[analysis.selectedOption - 1];
    lines.push(
      `O usuário selecionou a opção ${analysis.selectedOption}${picked ? `: "${picked}"` : ""} da lista que VOCÊ apresentou antes. Continue tratando exclusivamente dessa opção.`,
    );
  } else if (analysis.intent === "correcao") {
    lines.push(
      `O usuário CORRIGIU dados anteriores. Os valores válidos agora são os mais recentes em confirmed_data. Refaça o raciocínio/cálculo com eles e mencione brevemente a atualização.`,
    );
  } else if (analysis.intent === "fornecimento_de_dado" && pq) {
    lines.push(
      `A mensagem atual responde à sua pergunta "${pq}". Registre o dado e prossiga com a ação pendente — não repita a pergunta.`,
    );
  } else if (analysis.intent === "continuacao") {
    lines.push(
      `Mensagem curta de continuação. Resolva pronomes e referências ("isso", "ele", "esse", "o outro") pelo assunto em aberto (${stateBefore.current_topic ?? "última pergunta do usuário"}) antes de responder.`,
    );
  } else if (analysis.intent === "mudanca_de_assunto") {
    lines.push(
      `O usuário mudou de assunto intencionalmente. Atenda o novo pedido, mas mantenha os dados já confirmados disponíveis caso ele volte ao tema anterior.`,
    );
  }

  if (stateBefore.awaiting_user_response && analysis.intent === "nova_pergunta" && pq) {
    lines.push(
      `Atenção: havia uma pergunta sua em aberto ("${pq}") que o usuário não respondeu. Responda ao novo pedido primeiro e, se ainda for necessário, retome a pergunta pendente ao final — sem insistir mais de uma vez.`,
    );
  }

  return lines.length > 0 ? lines.join("\n") : null;
}
