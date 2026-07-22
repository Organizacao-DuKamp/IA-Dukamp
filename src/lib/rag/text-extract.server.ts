// Text extraction for bundled seed docs (all pre-extracted .txt) and
// future uploads (TXT, MD, PDF, DOCX). The seed dataset is already TXT;
// PDF/DOCX branches use dynamic imports so they don't ship in the bundle
// unless actually used.

export interface Extracted {
  text: string;
}

export async function extractText(filename: string, bytes: ArrayBuffer): Promise<Extracted> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "txt" || ext === "md") {
    return { text: new TextDecoder("utf-8").decode(bytes) };
  }
  if (ext === "pdf") {
    // Dynamic import so pdf-parse isn't required in the base bundle.
    try {
      const pdfParse = (await import("pdf-parse")).default as (
        b: Buffer,
      ) => Promise<{ text: string }>;
      const { text } = await pdfParse(Buffer.from(bytes));
      return { text };
    } catch {
      throw new Error("Extração de PDF indisponível neste ambiente. Envie TXT/MD.");
    }
  }
  if (ext === "docx") {
    try {
      const mammoth = (await import("mammoth")) as {
        extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
      };
      const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      return { text: value };
    } catch {
      throw new Error("Extração de DOCX indisponível neste ambiente. Envie TXT/MD.");
    }
  }
  throw new Error(`Formato não suportado: .${ext}`);
}
