// Loads bundled seed docs. Vite's import.meta.glob inlines each file's raw
// text into the server bundle at build time, so this works on Workers with
// no filesystem access.

const seed = import.meta.glob("/src/seed/base-conhecimento/**/*.txt", {
  query: "?raw",
  import: "default",
  eager: false,
}) as Record<string, () => Promise<string>>;

export interface SeedFile {
  absPath: string;
  load: () => Promise<string>;
}

export function listSeedFiles(): SeedFile[] {
  return Object.entries(seed).map(([absPath, load]) => ({ absPath, load }));
}
