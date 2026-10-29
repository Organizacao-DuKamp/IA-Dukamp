# Movimentação de grupos reais entre lotes

Base: produção em 633b489 (PR #96). Auditoria de 29/10/2026 solicitada pelo produtor; histórico do WhatsApp final 2376 consultado somente em leitura.

## Causa confirmada

Às 17h19 de Brasília, a compra de 50 bovinos foi persistida com as outras operações da mensagem. O movimento não tinha lote. Entre 17h21 e 17h24, as tentativas de colocar esse grupo primeiro no lote 2 e depois no lote 4 falharam na validação de lot_transfer, com o livro ainda na mesma versão.

Eram dois problemas relacionados:

- A tabela usava “Fazenda” para exibir a ausência de lote. A interpretação tratava esse rótulo como um lote real de origem.
- A ferramenta de transferência quantitativa exigia contagens de fim de dia dos dois lotes em data anterior. Esse mecanismo não conseguia tratar um grupo de uma compra real que acabara de chegar, nem um lote novo, mesmo com a origem e a quantidade disponíveis no banco.

As mensagens e a pendência estavam preservadas: esse episódio não foi perda de contexto nem falha do commit. O executor rejeitou as propostas antes de qualquer alteração.

## Correção

lot_transfer aceita a referência opcional movementId a uma chegada coletiva real (purchase, birth ou entrada externa). O servidor determina a espécie e a disponibilidade a partir desse registro e do histórico, incluindo transferências parciais. from ausente significa grupo sem lote definido; nunca significa um lote fictício chamado Fazenda.

herd-locations.ts projeta os grupos e suas localizações a partir de todo o livro. O contexto semântico recebe um resumo limitado desses resultados, calculado antes de truncar as coleções. A IA aponta para registros reais; não calcula um censo histórico para satisfazer o executor.

A execução valida propriedade, papel, grupo ativo, espécie, quantidade, origem, data e destino. Pedidos concorrentes continuam sujeitos ao CAS e ao commit único. Um grupo não pode ser alocado duas vezes na mesma origem. A criação solicitada de um lote novo registra a abertura vazia na data da operação, sem inventar contagem no dia anterior. Um lote já conhecido sem censo mantém seu total desconhecido, mesmo se o modelo enviar a opção de criação.

O livro guarda operations.lotTransfers com grupo, origem, destino, quantidade, data e proveniência. A compra/nascimento original não muda; as novas localizações não alteram o total da fazenda, as outras espécies, os valores financeiros ou a quantidade de fichas individuais. Saídas posteriores e censos que tornam a identidade do grupo incerta restringem a disponibilidade em vez de gerar estimativas. Corrigir uma chegada que já tem transferências exige reconciliação; não se permite quebrar essas referências substituindo o original.

As transferências quantitativas sem referência a um grupo continuam exigindo contagens reais. Animais com identificação continuam usando a ferramenta de mudança da ficha por código. O painel e o CSV mostram a transferência, sua origem e os saldos por espécie; “Sem lote definido (fazenda)” substitui o rótulo ambíguo. Em lotes sem censo, o painel distingue o total desconhecido da quantidade com alocação registrada.

## Validação

- 982 testes automatizados aprovados, incluindo dez regressões novas: caso dos 50 bovinos, um animal de um grupo coletivo, divisões e novas transferências, lote já conhecido sem censo, lote real chamado Fazenda, referências inválidas, espécies, permissões, datas, saídas e censos posteriores, atomicidade, replay, concorrência e auditoria no PostgreSQL isolado.
- Provedor real configurado: 37 resultados aprovados. A nova conversa com PostgreSQL isolado reproduz a tentativa antiga rejeitada, muda o destino pendente para o lote quatro, transfere apenas um dos 50 para o lote cinco, move uma ficha real e recusa estimar uma nova quantidade.
- Chromium real, rota pública, HTTP e PostgreSQL isolado: compra coletiva, transferência pelo executor, leitura do lote 4 com 50 bovinos depois de recarregar e preservação de compra, contagens, fichas e total da fazenda. Os demais cenários de painel também passaram.
- TypeScript/build, módulos administrativos, varredura de segredos no cliente e auditoria de imports privilegiados aprovados. Lint sem erros; 11 avisos preexistentes.

Nenhuma mensagem histórica foi reexecutada, nenhum WhatsApp foi enviado e nenhum lançamento real foi alterado durante os testes.

## Implantação e reversão

Não há migração SQL, dependência, segredo ou flag nova. A autorização usa a família já existente lot_transfer, preservando a restrição a proprietário/gestor.

Conferir CI e preview do commit exato no projeto oficial tpec-ia antes da integração. Publicar frontend e funções do WhatsApp pelo mesmo fluxo Git/Netlify e confirmar o deploy de produção ready no domínio oficial. Depois da publicação, o produtor pode retomar o pedido por uma nova mensagem; não executar a pendência em nome dele como parte da implantação.

Uma reversão deve ser um novo commit que preserve os leitores dos campos opcionais lotTransfers, lots.openedOn e dos parâmetros novos da proposta. Não restaurar um binário antigo com schema estrito sobre livros novos, nem apagar origens ou transferências.
