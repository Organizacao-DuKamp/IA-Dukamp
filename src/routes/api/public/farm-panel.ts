import { createFileRoute } from "@tanstack/react-router";
import { handleFarmPanel } from "@/lib/guardian/panel.server";

export const Route = createFileRoute("/api/public/farm-panel")({
  server: {
    handlers: {
      GET: ({ request }) => handleFarmPanel(request),
      POST: ({ request }) => handleFarmPanel(request),
      DELETE: ({ request }) => handleFarmPanel(request),
    },
  },
});
