import { createFileRoute } from "@tanstack/react-router";
import { handleAnimalRegistry } from "@/lib/guardian/animal-registry.server";

export const Route = createFileRoute("/api/public/farm-panel/animal-registry")({
  server: {
    handlers: {
      GET: ({ request }) => handleAnimalRegistry(request),
      POST: ({ request }) => handleAnimalRegistry(request),
    },
  },
});
