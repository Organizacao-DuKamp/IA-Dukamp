import { foldHerd } from "./herd-language.ts";
import type { GuardianSnapshot } from "./schema.ts";

/** Resolve only explicit names among the sender's authorized memberships. */
export function namedProperty(text: string, snapshot: GuardianSnapshot) {
  const t = foldHerd(text).replace(/[.!?]+$/, "");
  if (
    /\b(?:transferir|transfira|transferi|transferimos)\b[\s\S]*\bpara\b[\s\S]*\bfazenda\b/.test(t)
  )
    return null;
  if (/\b(?:vizinho|disse|suponha|simule|hipotetic|nao quero|fazenda dele|fazenda dela)\b/.test(t))
    return null;
  const candidates = snapshot.properties.filter((p) => {
    const name = foldHerd(p.name);
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return (
      t === name ||
      new RegExp(
        `\\b(?:fazenda|propriedade|sitio|chacara)\\s+${escaped}(?=$|[^\\p{L}\\d_-])`,
        "u",
      ).test(t)
    );
  });
  return candidates.length === 1 ? candidates[0] : null;
}
