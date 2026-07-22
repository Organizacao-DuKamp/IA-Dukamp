// Path parsing for the base-conhecimento seed folder.
// Preserves folder structure as category / subcategory.

export interface ParsedPath {
  category: string;
  subcategory: string | null;
  title: string;
  filename: string;
  sourcePath: string;
}

/** "01-PRODUTOS" -> "PRODUTOS"; "02-NUTRICAO-E-MANEJO" -> "NUTRICAO E MANEJO" */
export function prettifySegment(seg: string): string {
  return seg
    .replace(/^\d+-/, "")
    .replace(/-/g, " ")
    .trim();
}

/** Strip "[DOC]" / "[PDF]" markers and extension. */
export function prettifyTitle(filename: string): string {
  return filename
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/\s*\[(DOC|PDF|DOCX|MD|TXT)\]\s*/gi, "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * absPath examples (after globbing):
 *   /src/seed/base-conhecimento/01-PRODUTOS/01-BOVINOS/.../file.txt
 *   /src/seed/base-conhecimento/02-CONHECIMENTO-GERAL/02-PERGUNTAS-FREQUENTES/file.txt
 *   /src/seed/base-conhecimento/LEIA-ME-PRIMEIRO.txt
 */
export function parseSourcePath(absPath: string): ParsedPath {
  const marker = "/base-conhecimento/";
  const idx = absPath.indexOf(marker);
  const rel = idx >= 0 ? absPath.slice(idx + marker.length) : absPath;
  const parts = rel.split("/");
  const filename = parts[parts.length - 1];
  const dirs = parts.slice(0, -1);
  const category = dirs[0] ? prettifySegment(dirs[0]) : "GERAL";
  const subcategory = dirs[1] ? prettifySegment(dirs[1]) : null;
  return {
    category,
    subcategory,
    title: prettifyTitle(filename),
    filename,
    sourcePath: rel,
  };
}
