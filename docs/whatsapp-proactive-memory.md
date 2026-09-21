# Memória e acompanhamento proativo do WhatsApp

## Implementação

- Cada mensagem recebida entra numa fila durável para extração de fatos relevantes.
- A memória separa fatos ativos de situações resolvidas.
- Dois horários por dia são sorteados de forma determinística em janelas separadas: 08:15–12:15 e 15:00–20:15 no fuso do perfil.
- O usuário pode escrever “parar acompanhamento” e depois “reativar acompanhamento”.
- O painel administrativo permite visualizar fatos, pausar/reativar e disparar um contato manual.
- Claims no Postgres usam FOR UPDATE SKIP LOCKED para evitar processamento duplicado.
- Falha de rede/timeout depois de um POST para a Meta é marcada como entrega incerta e não é reenviada automaticamente.

## Janela de 24 horas

Dentro de 24 horas da última mensagem recebida, o sistema pode enviar texto normal.

Fora dessa janela, configure um template aprovado da Meta com um único parâmetro de corpo {{1}}. Variáveis:

- WHATSAPP_PROACTIVE_TEMPLATE_NAME
- WHATSAPP_PROACTIVE_TEMPLATE_LANGUAGE, padrão pt_BR

Sem template, o item é marcado como skipped em vez de tentar texto livre.

## Ativação

1. Aplicar a migração supabase/migrations/20260921120000_whatsapp_proactive_memory.sql no Supabase da TPEC-IA.
2. Confirmar os segredos existentes do Supabase e WhatsApp na Netlify.
3. Configurar o template aprovado da Meta.
4. Definir WHATSAPP_PROACTIVE_ENABLED=true.
5. Publicar o deploy principal.

O scheduler roda a cada 5 minutos e apenas chama uma Background Function; o trabalho de IA e envio fica no worker em background. O processamento permanece desativável por variável de ambiente.

## Estado de implantação

Migração aplicada no Supabase TPEC-IA em 2026-09-21. O worker é controlado por `WHATSAPP_PROACTIVE_ENABLED` no ambiente Netlify.

## Segurança

As quatro tabelas têm RLS habilitada. Acesso de PUBLIC, anon e authenticated é revogado. Os RPCs de claim usam SECURITY INVOKER, têm EXECUTE revogado dos papéis públicos e são concedidos somente a service_role.
