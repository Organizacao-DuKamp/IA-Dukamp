import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/termos-de-uso")({
  head: () => ({
    meta: [
      { title: "Termos de Uso | IA do Boi" },
      { name: "description", content: "Termos de Uso da IA do Boi (TPEC-IA), com regras de uso, limites do serviço e responsabilidades relacionadas ao assistente de inteligência artificial." },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Termos de Uso | IA do Boi" },
      { property: "og:description", content: "Regras e condições de uso da IA do Boi (TPEC-IA)." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://iadoboi.com.br/termos-de-uso" },
      { property: "og:site_name", content: "IA do Boi" },
    ],
    links: [{ rel: "canonical", href: "https://iadoboi.com.br/termos-de-uso" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <h1 className="text-3xl font-bold tracking-tight">Termos de Uso — TPEC-IA</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Última atualização: 12 de agosto de 2026.
        </p>

        <div className="mt-8 space-y-7 leading-7 text-sm sm:text-base">
          <section>
            <h2 className="text-xl font-semibold">1. Aceitação</h2>
            <p className="mt-2">
              Ao utilizar a TPEC-IA, você concorda com estes Termos de Uso e com a Política de
              Privacidade aplicável ao serviço.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Natureza do serviço</h2>
            <p className="mt-2">
              A TPEC-IA fornece respostas e apoio informacional com uso de inteligência artificial,
              especialmente em temas relacionados à pecuária. As respostas podem conter imprecisões
              e não substituem avaliação profissional, técnica, veterinária, jurídica, contábil ou
              financeira quando necessária.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. Uso adequado</h2>
            <p className="mt-2">
              O usuário se compromete a não utilizar o serviço para atividades ilícitas, abusivas,
              fraudulentas, para violar direitos de terceiros ou tentar comprometer a segurança e
              disponibilidade da plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. Conteúdo fornecido pelo usuário</h2>
            <p className="mt-2">
              Você é responsável pelas informações que envia. Não envie dados pessoais sensíveis,
              segredos comerciais ou informações de terceiros sem autorização quando isso não for
              necessário para a solicitação.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. Disponibilidade e alterações</h2>
            <p className="mt-2">
              Podemos atualizar, suspender ou alterar funcionalidades para manutenção, segurança,
              melhoria do produto ou atendimento a exigências legais e de plataformas integradas.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Limitação de responsabilidade</h2>
            <p className="mt-2">
              Na medida permitida pela legislação aplicável, decisões tomadas com base nas respostas
              da TPEC-IA devem considerar validação adequada ao contexto. Não garantimos que toda
              resposta seja completa, atual ou isenta de erros.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. Contato</h2>
            <p className="mt-2">
              Dúvidas sobre estes termos podem ser encaminhadas para rocamrpm@gmail.com.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
