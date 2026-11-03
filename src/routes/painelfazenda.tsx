import { createFileRoute } from "@tanstack/react-router";
import { FarmPanel } from "@/components/guardian/FarmPanel";

export const Route = createFileRoute("/painelfazenda")({
  head: () => ({
    meta: [
      { title: "Painel da Fazenda · TPEC-IA" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
      { name: "theme-color", content: "#064e3b" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Minha Fazenda" },
    ],
    links: [
      { rel: "manifest", href: "/painelfazenda.webmanifest" },
      { rel: "apple-touch-icon", href: "/farm-app-192.png" },
    ],
  }),
  component: FarmPanel,
});
