import { useEffect, useRef, useState } from "react";
import { Camera, Leaf } from "lucide-react";
import { farmPhotoThumbnail } from "@/lib/guardian/farm-photo";

export function FarmPhoto({
  photo,
  canEdit,
  busy,
  onChange,
}: {
  photo?: string | null;
  canEdit: boolean;
  busy: boolean;
  onChange(photo: string | null): void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  return (
    <div className="farm-photo">
      <button
        type="button"
        disabled={!canEdit || busy || reading}
        onClick={() => input.current?.click()}
        aria-label={canEdit ? "Alterar foto da fazenda" : "Foto da fazenda"}
        className="farm-avatar"
      >
        {photo ? (
          <img src={photo} alt="Foto da fazenda" width={72} height={72} />
        ) : (
          <Leaf size={30} aria-hidden="true" />
        )}
        {canEdit && (
          <span className="farm-avatar-camera">
            <Camera size={13} aria-hidden="true" />
          </span>
        )}
      </button>
      {canEdit && (
        <>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label="Escolher foto da fazenda"
            disabled={busy || reading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setError("");
              setReading(true);
              void farmPhotoThumbnail(file)
                .then((photo) => {
                  if (active.current) onChange(photo);
                })
                .catch((err) =>
                  setError(err instanceof Error ? err.message : "Não foi possível ler a foto."),
                )
                .finally(() => setReading(false));
            }}
          />
          {photo && (
            <button
              type="button"
              disabled={busy || reading}
              onClick={() => onChange(null)}
              className="mt-2 text-xs underline"
            >
              Remover foto
            </button>
          )}
        </>
      )}
      {reading && (
        <span role="status" className="text-xs">
          Preparando…
        </span>
      )}
      {error && (
        <p role="alert" className="mt-2 max-w-48 text-xs text-red-100">
          {error}
        </p>
      )}
    </div>
  );
}
