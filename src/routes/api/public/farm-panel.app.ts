import { createFileRoute } from "@tanstack/react-router";
import { handleAppDevices } from "@/lib/guardian/app-devices.server";
export const Route = createFileRoute("/api/public/farm-panel/app")({
  server: {
    handlers: {
      GET: ({ request }) => handleAppDevices(request),
      POST: ({ request }) => handleAppDevices(request),
      PUT: ({ request }) => handleAppDevices(request),
      DELETE: ({ request }) => handleAppDevices(request),
    },
  },
});
