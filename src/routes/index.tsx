import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import { WebChatAdapter } from "@/lib/chat/web-adapter";
import { MAX_MESSAGE_CHARS, type ChatMessage } from "@/lib/chat/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TPEC-IA · Assistente especialista em pecuária" },
      {
        name: "description",
        content:
          "TPEC-IA é uma assistente de IA em português voltada à pecuária brasileira: manejo, nutrição, pastagens, reprodução, sanidade e gestão da propriedade.",
      },
      { property: "og:title", content: "TPEC-IA · Assistente especialista em pecuária" },
      {
        property: "og:description",
        content:
          "Tire dúvidas sobre bovinocultura de corte e leite com uma IA especializada. Sem cadastro, sem histórico salvo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatPage,
});

type UIMessage = ChatMessage & { id: string };

function ChatPage() {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const adapter = useMemo(() => new WebChatAdapter(), []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    if (text.length > MAX_MESSAGE_CHARS) {
      setError(`Mensagem excede ${MAX_MESSAGE_CHARS} caracteres.`);
      return;
    }
    setError(null);
    const userMsg: UIMessage = { id: crypto.randomUUID(), role: "user", content: text };
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const reply = await adapter.ask(text, history);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: reply },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao consultar a IA.");
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setMessages([]);
    setError(null);
    adapter.resetSession();
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <LeafIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">TPEC-IA</h1>
              <p className="text-xs text-muted-foreground">
                Assistente especialista em pecuária
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClear}
            disabled={messages.length === 0 && !error}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
          >
            Limpar conversa
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4">
        <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto py-6">
          {messages.length === 0 && !loading && <EmptyState onPick={setInput} />}
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {loading && (
            <div className="flex items-center gap-2 pl-1 text-sm text-muted-foreground">
              <span className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
              </span>
              TPEC-IA está pensando…
            </div>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="sticky bottom-0 pb-4 pt-2">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e as unknown as FormEvent);
                }
              }}
              placeholder="Pergunte sobre manejo, nutrição, pastagens, sanidade…"
              rows={1}
              maxLength={MAX_MESSAGE_CHARS}
              disabled={loading}
              className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || input.trim().length === 0}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Enviar"
            >
              <SendIcon className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 px-1 text-[11px] text-muted-foreground">
            Respostas geradas por IA. Para diagnósticos e prescrições, consulte um
            médico-veterinário registrado no CRMV. Nada é salvo — o histórico existe
            apenas nesta aba.
          </p>
        </form>
      </main>
    </div>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm"
            : "max-w-[92%] text-sm text-foreground"
        }
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none prose-headings:mt-3 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-strong:text-foreground">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  const examples = [
    "Como calcular a taxa de lotação ideal para pasto de Brachiaria brizantha?",
    "Quais os principais indicadores zootécnicos de um confinamento de corte?",
    "Como estruturar um protocolo de IATF em vacas de leite?",
    "Sinais clínicos iniciais de tristeza parasitária bovina?",
  ];
  return (
    <div className="mx-auto max-w-2xl py-10 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <LeafIcon className="h-7 w-7" />
      </div>
      <h2 className="text-xl font-semibold tracking-tight">Bem-vindo à TPEC-IA</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Sua assistente de IA em pecuária. Faça perguntas sobre manejo, nutrição,
        pastagens, reprodução, sanidade e gestão da propriedade.
      </p>
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {examples.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => onPick(ex)}
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-left text-xs text-foreground transition hover:border-primary/40 hover:bg-secondary"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}

function LeafIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M11 20A7 7 0 0 1 4 13V6a2 2 0 0 1 2-2h7a7 7 0 0 1 7 7v0a7 7 0 0 1-7 7h-2Z" />
      <path d="M4 22c4-6 8-8 14-9" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="m22 2-7 20-4-9-9-4 20-7Z" strokeLinejoin="round" />
    </svg>
  );
}
