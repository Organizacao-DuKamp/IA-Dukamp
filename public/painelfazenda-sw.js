// No authenticated data, API responses, tokens or farm pages enter a cache.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.mode !== "navigate" ||
    url.origin !== self.location.origin ||
    url.pathname !== "/painelfazenda"
  )
    return;
  event.respondWith(
    fetch(event.request, { cache: "no-store" }).catch(
      () =>
        new Response(
          '<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Minha Fazenda</title><body style="font-family:system-ui;background:#f4f6f2;color:#064e3b;padding:48px 24px"><h1>Você está sem conexão</h1><p>Conecte-se à internet para consultar sua fazenda.</p><button onclick="location.reload()" style="padding:14px 24px">Tentar novamente</button></body></html>',
          {
            status: 503,
            headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
          },
        ),
    ),
  );
});
