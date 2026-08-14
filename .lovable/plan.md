# Plano: Configuração de Backend Lovable e Proxy Netlify para Chat/RAG

A TPEC-IA terá sua lógica de Chat/RAG executada no backend do Lovable Cloud, permitindo que a base RAG permaneça privada (acessível apenas via `service_role`). A Netlify atuará como um proxy seguro, protegendo as chaves de API.

## Etapas

### 1. Preparação do Backend (Lovable Cloud)
- **Endpoint Interno**: Criar a rota `src/routes/api/internal/chat.ts` para receber requisições do proxy.
- **Segurança**: Utilizar o `TPEC_PROXY_SECRET` (32+ caracteres) para autenticar as chamadas da Netlify.
- **Configuração**: Definir `TPEC_BACKEND_MODE=local` no ambiente Lovable para processar o RAG diretamente.

### 2. Configuração do Proxy (Netlify)
- **Modo Proxy**: Alterar as variáveis de ambiente na Netlify para `TPEC_BACKEND_MODE=proxy`.
- **URL de Destino**: Configurar `LOVABLE_BACKEND_URL` apontando para o domínio do Lovable Cloud.
- **Autenticação**: Configurar o mesmo `TPEC_PROXY_SECRET` na Netlify.

### 3. Preservação de Dados e Segurança
- As permissões RAG (`match_knowledge_chunks`) continuarão restritas ao `service_role`.
- Nenhuma chave (`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`) será exposta ao navegador ou à Netlify.

## Detalhes Técnicos
- **Endpoint**: `POST /api/internal/chat`
- **Headers de Autenticação**: `x-tpec-proxy-secret`
- **Validação**: O `http.server.ts` já implementa a verificação de hash e tempo constante para o segredo.
- **Imutabilidade**: O banco de dados e os chunks indexados não sofrerão alterações.

## Variáveis de Ambiente para Netlify
Após a aplicação, as seguintes variáveis deverão ser configuradas no painel da Netlify:
- `TPEC_BACKEND_MODE`: `proxy`
- `LOVABLE_BACKEND_URL`: `https://project--pwxlutgiklpruzfqkpzz.lovable.app`
- `TPEC_PROXY_SECRET`: (O valor gerado de 64 caracteres)
