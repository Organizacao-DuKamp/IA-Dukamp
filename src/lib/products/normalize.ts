// Normalization helpers for product names, slugs, and aliases.
// Client-safe: no imports of server-only modules.

export function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Aggressive normalization used for lookup (aliases + slugs). */
export function normalizeName(s: string): string {
  return stripDiacritics(s)
    .toLowerCase()
    .replace(/[\/\\_.,;:!?"'()\[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** URL/DB slug: alphanumerics + dashes only. */
export function toSlug(s: string): string {
  return normalizeName(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Generate obvious alias variations for a product name. */
export function autoAliases(officialName: string): string[] {
  const base = officialName.trim();
  const noAcc = stripDiacritics(base);
  const set = new Set<string>();
  const add = (v: string) => {
    const t = v.trim();
    if (t) set.add(t);
  };
  add(base);
  add(noAcc);
  add(base.toLowerCase());
  add(noAcc.toLowerCase());
  add(base.toUpperCase());
  add(base.replace(/\//g, " "));
  add(base.replace(/\//g, ""));
  add(base.replace(/\s+/g, ""));
  add(base.replace(/-/g, " "));
  add(base.replace(/\s+/g, "-"));
  // "80/S" -> "80s", "80 s"
  const digitSlashLetter = base.replace(/(\d+)\s*\/\s*([A-Za-z])/g, "$1$2");
  add(digitSlashLetter);
  add(digitSlashLetter.toLowerCase());
  return [...set];
}
