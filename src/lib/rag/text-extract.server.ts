// Text extraction. Seed dataset is TXT already. Upload UI accepts TXT/MD;
// PDF/DOCX support can be added later with pdf-parse / mammoth deps.

export interface Extracted {
  text: string;
}

export async function extractText(filename: string, bytes: ArrayBuffer): Promise<Extracted> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "txt" || ext === "md") {
    return { text: new TextDecoder("utf-8").decode(bytes) };
  }
  throw new Error(`Formato não suportado: .${ext}. Envie arquivos .txt ou .md.`);
}
