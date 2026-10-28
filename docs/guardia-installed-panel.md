# Minha Fazenda: aplicativo instalável e acesso mantido

O painel oferece “Baixar aplicativo”, que usa a instalação do navegador quando disponível
ou mostra instruções para Android/computador/iPhone. A confirmação da instalação pertence
ao navegador/sistema; o site não pode criar um ícone silenciosamente. Manifesto independente,
ícones 192/512 e execução standalone com início em /painelfazenda.

Sessões separadas por cookie HttpOnly, Secure em HTTPS e SameSite=Strict:
- navegador: novo login a cada dia, com expiração à meia-noite em Brasília;
- aplicativo: código de uso único no primeiro acesso, depois renovação automática durante
  o uso, com até 365 dias sem atividade. Fechar/reabrir não pede login diário.

Limpar dados, expirar após longo período sem uso, sair ou revogar acesso exige novo código.
O modo standalone controla somente a persistência; não comprova identidade. Parâmetros
na URL não habilitam acesso. Tokens ficam apenas em cookies HttpOnly; banco guarda hashes.
Cookies e modos de sessão não são intercambiáveis. Permissões por fazenda são verificadas
em cada chamada. Códigos mantêm expiração de 10 minutos e uso único.

Service worker não armazena páginas da fazenda, respostas de API ou credenciais. Sem rede,
mostra apenas uma tela de reconexão. Não há consulta/alteração offline nem envio proativo.

Implantação: aplicar a migração guardian_installed_sessions antes de publicar o backend.
As funções anteriores permanecem compatíveis; registros de fazendas não são modificados.
Migração aplicada: `20261028121145_guardian_installed_sessions.sql`.
A migração adiciona modo/renovação e substitui o limite fixo de 12 horas por limites por modo;
RLS e permissões de execução exclusivas de service_role são preservadas.

Validação: sessão diária, renovação em outro dia, cookie persistente, modos separados,
uso único, revogação de membro, logout e regressão de operações; Chromium com banco
isolado valida instalação orientada, manifesto, cookies e reabertura simulada. Instalação
nativa e políticas de armazenamento dependem do navegador/dispositivo do usuário.

“Sair de todos os meus acessos desta fazenda” revoga as sessões e códigos pendentes do próprio usuário nessa propriedade, com auditoria, sem desconectar outros membros.
