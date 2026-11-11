import { useRef, useState } from "react";
import type { FarmTeam as Team } from "@/lib/guardian/access-links.server";

export function FarmTeam({
  team,
  api,
  refresh,
}: {
  team?: Team;
  api(method: string, body?: unknown): Promise<unknown>;
  refresh(): Promise<void>;
}) {
  const [link, setLink] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const pending = useRef<string | null>(null);
  async function act(body: unknown) {
    if (pending.current) return;
    pending.current = "busy";
    setBusy(true);
    setError("");
    try {
      const result = (await api("POST", body)) as { link?: string };
      if (result.link) setLink(result.link);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tente novamente.");
    } finally {
      pending.current = null;
      setBusy(false);
    }
  }
  return (
    <section aria-label="Equipe da fazenda" className="mb-6 rounded-2xl border bg-white p-5">
      <h2 className="text-xl font-semibold">Equipe e acessos</h2>
      <p className="my-3 text-sm text-slate-600">
        Convide por link, sem informar o número. O funcionário confirma pelo próprio WhatsApp e
        recebe acesso à gestão. Você mantém o controle para remover acessos.
      </p>
      {error && (
        <p role="alert" className="my-3 text-red-700">
          {error}
        </p>
      )}
      <button
        disabled={busy}
        className="rounded-xl bg-emerald-900 px-4 py-3 text-white disabled:opacity-50"
        onClick={() => {
          void act({ kind: "team_invite", requestId: crypto.randomUUID() });
        }}
      >
        Gerar link de convite
      </button>
      {link && (
        <div className="my-4 space-y-2">
          <label className="block text-sm font-semibold" htmlFor="team-link">
            Compartilhe este convite (uma pessoa, válido por 7 dias)
          </label>
          <input
            id="team-link"
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
            className="w-full rounded-xl border p-3"
          />
          <button
            className="mr-4 underline"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(link)
                .catch(() => setError("Selecione e copie o link acima."));
            }}
          >
            Copiar link
          </button>
          <a
            className="underline"
            href={
              "https://wa.me/?text=" +
              encodeURIComponent("Convite para a equipe da fazenda: " + link)
            }
            target="_blank"
            rel="noreferrer"
          >
            Compartilhar no WhatsApp
          </a>
        </div>
      )}
      <ul className="mt-4 divide-y">
        {team?.members.map((member) => (
          <li key={member.phone} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <span className="font-semibold">
                {member.name ?? (member.role === "owner" ? "Proprietário" : "Funcionário")}
              </span>
              <span className="block text-sm">
                +{member.phone} · {member.active ? "Acesso ativo" : "Acesso removido"}
              </span>
            </div>
            {member.role !== "owner" && member.active && (
              <button
                disabled={busy}
                className="rounded-lg border border-red-200 px-3 py-2 text-red-800"
                onClick={() => {
                  if (
                    window.confirm(
                      `Remover o acesso de +${member.phone} à fazenda em todos os dispositivos?`,
                    )
                  )
                    void act({ kind: "team_revoke", phone: member.phone });
                }}
              >
                Remover acesso
              </button>
            )}
          </li>
        ))}
      </ul>
      {!!team?.invitations.length && (
        <div className="mt-4">
          <h3 className="font-semibold">Convites pendentes</h3>
          <ul>
            {team.invitations.map((invite, index) => (
              <li key={invite.id} className="flex items-center justify-between gap-3 py-3">
                <span>
                  Convite {index + 1} · até {new Date(invite.expiresAt).toLocaleDateString("pt-BR")}
                </span>
                <button
                  disabled={busy}
                  className="underline"
                  onClick={() => {
                    void act({ kind: "invite_cancel", id: invite.id });
                    setLink("");
                  }}
                >
                  Cancelar convite
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
