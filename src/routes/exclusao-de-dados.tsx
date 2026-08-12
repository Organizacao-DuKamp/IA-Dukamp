import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/exclusao-de-dados")({
  component: DataDeletionPage,
});

function DataDeletionPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <h1 className="text-3xl font-bold tracking-tight">Exclusão de Dados — TPEC-IA</h1>
        <p className="mt-3 text-sm text-muted-foreground">Última atualização: 12 de agosto de 2026.</p>

        <div className="mt-8 space-y-7 leading-7 text-sm sm:text-base">
          <section>
            <h2 className="text-xl font-semibold">Como solicitar a exclusão</h2>
            <p className="mt-2">Você pode solicitar a exclusão dos dados pessoais associados ao uso da TPEC-IA enviando um e-mail para rocamrpm@gmail.com com o assunto “Exclusão de dados — TPEC-IA”.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Informações necessárias</h2>
            <p className="mt-2">Informe o número de telefone utilizado no WhatsApp ou outro identificador da conta necessário para localizarmos os dados. Podemos solicitar uma confirmação adicional para evitar a exclusão indevida de dados de terceiros.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">O que será excluído</h2>
            <p className="mt-2">Quando aplicável, removeremos dados pessoais e histórico de conversas vinculados ao identificador informado. Alguns registros poderão ser preservados pelo período exigido por lei, para prevenção de fraude, segurança ou defesa de direitos.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Prazo</h2>
            <p className="mt-2">A solicitação será analisada e atendida dentro de prazo razoável, observadas as exigências da LGPD e demais normas aplicáveis.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Contato</h2>
            <p className="mt-2">E-mail para solicitações: rocamrpm@gmail.com.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
