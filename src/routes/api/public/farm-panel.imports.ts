import { createFileRoute } from "@tanstack/react-router";
import { handleImportPanel } from "@/lib/guardian/import-panel.server";
export const Route = createFileRoute("/api/public/farm-panel/imports")({
  server: {
    handlers: {
      GET: ({ request }) => handleImportPanel(request),
      POST: ({ request }) => handleImportPanel(request),
    },
  },
});
