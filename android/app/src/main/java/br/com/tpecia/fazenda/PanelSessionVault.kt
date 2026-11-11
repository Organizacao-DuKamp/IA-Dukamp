package br.com.tpecia.fazenda

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Independent of reminder preferences: disabling reminders must not log out. */
class PanelSessionVault(context: Context, private val now: () -> Long = System::currentTimeMillis) {
    private val prefs = context.applicationContext.getSharedPreferences("farm-session", Context.MODE_PRIVATE)
    private val alias = "tpec_farm_session_v1"
    private fun key(create: Boolean): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        check(create) { "Session key unavailable" }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
    fun read(): String? {
        val raw = prefs.getString("encrypted", null) ?: return null
        return try {
            val parts = raw.split(":")
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, key(false), GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)))
            val state = JSONObject(String(cipher.doFinal(B…1791 tokens truncated… e frontend juntos. É aditiva; mantém os vínculos, dados, permissões e sessões existentes. Cria tabela com RLS, sem acesso de `anon` ou `authenticated`, e RPCs `SECURITY INVOKER` restritas ao servidor (`service_role`). Não modifica o Supabase comercial DuKamp.
2. Publicar o código validado pelo fluxo Git/Netlify existente. Não há novo segredo de autenticação: os tokens pessoais são derivados por HMAC do segredo server-only existente e de mensagem/remetente/finalidade; só seus hashes são gravados na tabela de links. O domínio oficial dos links é `https://www.tpecia.com.br`.
3. Compilar e distribuir o Android **1.1.2 (5)** assinado. Configurar na Netlify `TPEC_ANDROID_SHA256_CERT_FINGERPRINTS` com o SHA-256 público do certificado que assina esse APK, em formato `AA:BB:...` (32 bytes), ou o certificado **Play App Signing** se distribuído pela Play Store. Vários certificados são separados por vírgula. Não usar a chave privada de assinatura, a SHA-1 ou o certificado de upload no lugar do certificado do app.
4. Conferir `https://www.tpecia.com.br/.well-known/assetlinks.json`: JSON, HTTP 200 e fingerprint correto para `br.com.tpecia.fazenda`. Sem fingerprint configurado, retorna `[]` e o Android não valida o vínculo. Não há fingerprint fictício ou associação com apps de terceiros. A versão antiga do APK não recebe App Links por uma atualização do site.
5. Conferir no aparelho: `adb shell pm verify-app-links --re-verify br.com.tpecia.fazenda` e `adb shell pm get-app-links br.com.tpecia.fazenda`. Abrir links reais de teste pelo WhatsApp com o app fechado/aberto, conferir o retorno ao app depois da confirmação do funcionário, reabrir no dia seguinte, revogar e readmitir. Sem app instalado o mesmo endereço HTTPS abre a web. Preferências do usuário/Android para abertura de links podem prevalecer sobre a associação.

A API de troca é POST com origem exata e cabeçalho do painel; GET/pré-visualização não consome o token. Tokens estão no fragmento, removido assim que a tela os lê, sem query string, referrer, localStorage ou cache do service worker. Telemetria de conversa mascara tokens dos links/aceites; a mensagem privada entregue no WhatsApp continua no histórico privado da conversa, sujeita ao uso único e à expiração. A identidade vem sempre da sessão e do vínculo atual, nunca de IDs enviados pelo navegador.

Para homologar em preview, abrir o endereço do preview com o fragmento gerado nos testes isolados. A associação Android permanece restrita ao domínio oficial. Nenhuma mensagem real de WhatsApp nem alteração de dados de produção faz parte dos testes automatizados.

## Verificação

`tests/guardian-access-links.test.ts` exercita SQL real em PGlite, emissão por WhatsApp, aceite idempotente, sessões persistentes separadas web/app, uso único/expiração, CSRF, RLS, escopo, privilégios, cancelamento, edição financeira pelo funcionário, remoção via painel/WhatsApp e bloqueio de sessões/convites antigos após readmissão. Os testes anteriores de seleção de fazenda foram adaptados para links. O teste Android de navegação inclui fragmentos de acesso/convite.

A migração foi preparada sem conexão com produção. Nesta execução, a CLI Supabase não inicializou por tentar escrever em `~/.supabase` no filesystem somente leitura; o arquivo foi criado localmente e verificado executando a migração e consultas reais em PGlite. Não há entrada de migração aplicada à produção.

## Entrada imediata com o aplicativo já aberto

O painel acompanha novos links pelo `hashchange`/`popstate`, além da URL de abertura inicial. No Android, `loadUrl` de `/painelfazenda#login=...` pode navegar apenas no fragmento e preservar a página em memória. Portanto, cada link recebido inicia a autenticação e a leitura da fazenda, mesmo depois de Sair; a entrada não depende de remontar o componente, de um segundo toque ou de reiniciar o aplicativo.

As requisições do painel são ordenadas porque respostas de leitura também renovam o cookie HttpOnly. Uma leitura antiga termina antes de um logout e de uma nova troca de link, impedindo que seu cookie sobrescreva a sessão nova. A interface ignora resultados de entradas anteriores e mantém o mesmo modo de sessão durante o documento. Só trocas de link ainda em andamento são deduplicadas: depois de Sair, uma resposta de sucesso antiga nunca substitui uma autenticação nova.

A correção usa o frontend servido pelo site: não adiciona migração, não reabre links consumidos sem uma sessão válida e não exige atualizar o APK 1.1.0 que já abre App Links. As regras de uso único, expiração e remoção de funcionários permanecem aplicadas no servidor.

Para reproduzir/validar com Vite local e PostgreSQL isolado:

```sh
npm run dev
# Em outro terminal:
npx playwright install chromium
npm run test:panel-access
node --test --experimental-strip-types tests/farm-panel-client.test.ts tests/guardian-access-links.test.ts tests/guardian-installed-panel.test.ts
```

O job `panel-access` do CI executa esse teste em cada PR/main com Playwright fixado como dependência de desenvolvimento. O script verifica entrada inicial, saída e reentrada na mesma página, resposta de renovação atrasada durante logout/reentrada, recusa de link já usado, próximo link válido, convite seguido de link pessoal, persistência após reload e o primeiro link recebido por uma tela já aberta. Usa Chromium, o handler HTTP real e SQL real em PGlite; a ponte Android é simulada e não substitui teste em aparelho físico. Não envia WhatsApp nem acessa banco de produção.

## Persistência no fechamento do Android (1.1.2)

O cookie de login é persistente e HttpOnly. As versões anteriores dependiam exclusivamente do CookieManager: flush após a troca do link e em onPause, ou uma navegação para acionar onPageFinished no APK antigo. Essa compatibilidade passou no navegador, mas não resolveu a perda reportada no aparelho. Portanto, atualizar somente o site não basta: distribuir o APK **1.1.2 (5)** com o certificado original, sem desinstalar o app.

A versão 1.1.2 grava uma cópia nativa cifrada com chave do Android Keystore, em preferências separadas dos lembretes e excluídas de backup. A confirmação de entrada ocorre após o commit dessa cópia e o flush do WebView. Ao iniciar, restaura o cookie antes de carregar a página; a API continua revalidando a sessão e o vínculo. O token nunca cruza a ponte JavaScript. Sair remove a cópia e o cookie; um GET com 401 também descarta a sessão nativa. Falhas de rede não apagam o acesso. A cópia tem validade máxima local de 365 dias, renovada ao capturar uma sessão; um token expirado ou revogado nunca autoriza acesso ao servidor.

Ao restaurar uma Activity ou abrir pelos recentes, o Android carrega `/painelfazenda` em vez de repetir o link de uso único. Um App Link novo continua sendo processado. Uma sessão ainda presente no WebView anterior é migrada para o armazenamento cifrado antes de carregar o painel. Se o acesso já havia sido perdido, usar um link uma vez após atualizar. Não há migração SQL ou mudança de permissões.

Validação automatizada: fila HTTP e confirmação nativa; testes de autenticação/revogação com PostgreSQL isolado; navegador com a ponte Android simulada; **emuladores Android API 31 e 35 com CookieManager e Keystore reais**, usando `am force-stop` entre etapas. O teste nativo verifica recuperação após morte do processo mesmo removendo o cookie, logout sem ressurreição na próxima abertura, independência dos lembretes, migração, troca de sessão e expiração local. Não acessa o backend nem envia WhatsApp. O teste não substitui homologar o APK assinado no aparelho do usuário.

O emulador API 28 inclui um WebView obsoleto: o CI verifica que o aplicativo mostra a orientação para atualizar o Android System WebView antes de carregar o painel. A persistência é exercitada nas APIs 31 e 35, que possuem a ponte exigida pelo app. Não se removem HttpOnly, Secure ou SameSite para contornar um WebView sem suporte.
