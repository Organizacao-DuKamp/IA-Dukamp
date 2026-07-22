// Multi-format text extraction. Runs server-side (Workers + node compat).

export interface Extracted {
  text: string;
  fileType: string;
}

async function extractPdf(bytes: ArrayBuffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

async function extractDocx(bytes: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ arrayBuffer: bytes });
  return value;
}

async function extractXlsx(bytes: ArrayBuffer): Promise<string> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(new Uint8Array(bytes), { type: "array" });
  const parts: string[] = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (csv.trim()) parts.push(`# Planilha: ${name}\n${csv}`);
  }
  return parts.join("\n\n");
}

async function extractCsv(bytes: ArrayBuffer): Promise<string> {
  const Papa = (await import("papaparse")).default;
  const text = new TextDecoder("utf-8").decode(bytes);
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
  const rows = parsed.data as string[][];
  return rows.map((r) => r.join(" | ")).join("\n");
}

export async function extractText(filename: string, bytes: ArrayBuffer): Promise<Extracted> {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  if (ext === "txt" || ext === "md") {
    return { text: new TextDecoder("utf-8").decode(bytes), fileType: ext };
  }
  if (ext === "pdf") return { text: await extractPdf(bytes), fileType: "pdf" };
  if (ext === "docx") return { text: await extractDocx(bytes), fileType: "docx" };
  if (ext === "xlsx" || ext === "xls") return { text: await extractXlsx(bytes), fileType: ext };
  if (ext === "csv") return { text: await extractCsv(bytes), fileType: "csv" };
  throw new Error(`Formato não suportado: .${ext}. Aceita: .txt .md .pdf .docx .xls .xlsx .csv`);
}

export async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
