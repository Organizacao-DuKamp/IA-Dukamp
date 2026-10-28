import { useEffect, useState } from "react";
import { Download, Smartphone, Check } from "lucide-react";
import { installedPanel } from "@/lib/guardian/app-mode";
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export function InstallPanel({ authenticated = false }: { authenticated?: boolean }) {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null),
    [installed, setInstalled] = useState(false),
    [help, setHelp] = useState(false),
    [added, setAdded] = useState(false),
    [ios, setIos] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setInstalled(installedPanel());
    setIos(
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    );
    const install = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallEvent);
    };
    const done = () => {
      setPrompt(null);
      setAdded(true);
      setInstalled(installedPanel());
    };
    window.addEventListener("beforeinstallprompt", install);
    window.addEventListener("appinstalled", done);
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker
        .register("/painelfazenda-sw.js", { scope: "/painelfazenda" })
        .catch(() => {});
    return () => {
      window.removeEventListener("beforeinstallprompt", install);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  return (
    <section
      className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5"
      aria-label="Aplicativo da fazenda"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-white p-3 text-emerald-800">
            <Smartphone size={23} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold text-emerald-950">Minha Fazenda no seu aparelho</h2>
            <p className="mt-1 text-xs text-emerald-800">
              {installed
                ? authenticated
                  ? "Acesso mantido neste aplicativo."
                  : "Entre com um código para começar."
                : added
                  ? "Abra o aplicativo pelo novo ícone."
                  : "Abra pelo ícone e mantenha seu acesso."}
            </p>
          </div>
        </div>
        {installed || added ? (
          <span className="flex items-center gap-2 text-sm font-medium text-emerald-800">
            <Check size={17} />
            Aplicativo instalado
          </span>
        ) : (
          <button
            onClick={async () => {
              setError("");
              if (!prompt) {
                setHelp((h) => !h);
                return;
              }
              try {
                await prompt.prompt();
                await prompt.userChoice;
              } catch {
                setError("Use o menu do navegador para instalar.");
              } finally {
                setPrompt(null);
                setHelp(true);
              }
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-900 px-4 py-3 text-sm font-semibold text-white"
          >
            <Download size={17} />
            Baixar aplicativo
          </button>
        )}
      </div>
      {help && !installed && (
        <div className="mt-4 border-t border-emerald-200 pt-4 text-sm text-emerald-950">
          <p>
            {ios
              ? "No iPhone ou iPad: toque em Compartilhar e depois em Adicionar à Tela de Início. Se necessário, abra esta página no Safari."
              : "No menu do navegador, escolha Instalar aplicativo ou Adicionar à tela inicial. No computador, procure também o ícone de instalação na barra de endereço."}
          </p>
          <p className="mt-2 text-xs text-emerald-800">
            Depois de instalar, abra pelo ícone e informe um código uma vez. O navegador pode pedir
            sua confirmação para instalar.
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-700">
          {error}
        </p>
      )}
    </section>
  );
}
