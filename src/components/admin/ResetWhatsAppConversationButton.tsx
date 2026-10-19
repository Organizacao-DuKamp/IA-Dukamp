import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { resetWhatsAppConversation } from "@/lib/whatsapp/proactive.functions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function ResetWhatsAppConversationButton({
  phone,
  onReset,
}: {
  phone: string;
  onReset?: () => void;
}) {
  const reset = useServerFn(resetWhatsAppConversation);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmReset() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await reset({ data: { phone } });
      setOpen(false);
      toast.success(`Conversa do número ••••${phone.slice(-4)} resetada.`);
      onReset?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível resetar a conversa.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) {
          setOpen(value);
          setError(null);
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
          aria-label={`Resetar conversa do número ${phone}`}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Resetar conversa
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Resetar a conversa com a IA?</AlertDialogTitle>
          <AlertDialogDescription>
            O número +{phone} começará uma nova conversa, sem o contexto e as memórias anteriores.
            Os acompanhamentos pendentes baseados nessas memórias serão cancelados. O histórico de
            auditoria e os custos continuarão disponíveis neste painel.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(event) => {
              event.preventDefault();
              void confirmReset();
            }}
          >
            {busy ? "Resetando…" : "Confirmar reset"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
