import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/politica-de-privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade | IA do Boi" },
      { name: "description", content: "Política de Privacidade da IA do Boi (TPEC-IA), com informações sobre tratamento de dados no site, WhatsApp e serviços integrados." },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Política de Privacidade | IA do Boi" },
      { property: "og:description", content: "Informações sobre privacidade e tratamento de dados na IA do Boi (TPEC-IA)." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://iadoboi.com.br/politica-de-privacidade" },
      { property: "og:site_name", content: "IA do Boi" },
    ],
    links: [{ rel: "canonical", href: "https://iadoboi.com.br/politica-de-privacidade" }],
  }),
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <h1 className="text-3xl font-bold tracking-tight">Política de Privacidade — TPEC-IA</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Última atualização: 28 de agosto de 2026.
        </p>

        <div className="mt-8 space-y-7 leading-7 text-sm sm:text-base">
          <section>
            <h2 className="text-xl font-semibold">1. Sobre a TPEC-IA</h2>
            <p className="mt-2">
              A TPEC-IA é um assistente de inteligência artificial voltado ao setor pecuário. Esta
              política explica como tratamos dados pessoais quando você utiliza nossos serviços pelo
              site, WhatsApp e demais canais integrados.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Dados que podemos tratar</h2>
            <p className="mt-2">
              Podemos tratar dados de identificação e contato, como nome e número de telefone,
              mensagens enviadas à TPEC-IA, conteúdo necessário para responder às solicitações,
              registros técnicos de uso e informações fornecidas voluntariamente pelo usuário.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. Finalidades</h2>
            <p className="mt-2">
              Os dados são utilizados para prestar e melhorar o serviço, manter o contexto das
              conversas, responder dúvidas, oferecer suporte, prevenir abuso e falhas técnicas,
              cumprir obrigações legais e manter a segurança da plataforma. Quando aplicável, também
              registramos, em área administrativa restrita, o desempenho do atendimento, a origem
              estimada das respostas, o consumo de tokens e o custo estimado da IA.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. WhatsApp e fornecedores</h2>
            <p className="mt-2">
              Ao conversar com a TPEC-IA pelo WhatsApp, a comunicação é processada pela plataforma
              WhatsApp Business da Meta e por serviços de infraestrutura e inteligência artificial
              necessários ao funcionamento do produto. Compartilhamos apenas os dados necessários
              para executar essas funcionalidades.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. Retenção e segurança</h2>
            <p className="mt-2">
              Mantemos dados pelo período necessário às finalidades descritas nesta política ou para
              cumprimento de obrigações legais. Os históricos e métricas da área administrativa são
              protegidos por autenticação e autorização de administrador. Adotamos medidas técnicas
              e administrativas razoáveis para proteger as informações contra acesso, alteração,
              perda ou divulgação indevida.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Direitos do titular</h2>
            <p className="mt-2">
              Nos termos da LGPD, você pode solicitar confirmação de tratamento, acesso, correção,
              eliminação quando aplicável, informação sobre compartilhamentos e demais direitos
              previstos em lei. Consulte também nossa página de exclusão de dados.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. Contato</h2>
            <p className="mt-2">
              Para dúvidas sobre privacidade ou solicitações relacionadas aos seus dados, entre em
              contato pelo e-mail rocamrpm@gmail.com.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
