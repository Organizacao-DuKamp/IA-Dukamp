import { createFileRoute } from "@tanstack/react-router";
import { androidAppLinks } from "@/lib/guardian/android-app-links";

export const Route = createFileRoute("/.well-known/assetlinks.json")({
  server: {
    handlers: {
      GET: () =>
        new Response(
          JSON.stringify(androidAppLinks(process.env.TPEC_ANDROID_SHA256_CERT_FINGERPRINTS)),
          {
            headers: {
              "content-type": "application/json",
              "cache-control": "public, max-age=3600",
            },
          },
        ),
    },
  },
});
