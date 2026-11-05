import { importAbczPdf, MAX_ABCZ_PDF } from "./abcz-pdf.server.ts";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { z } from "zod";
import {
  AnimalProfileSchema,
  PedigreeNodeSchema,
  type AnimalProfile,
  type PedigreeNode,
} from "./animal-profile.ts";
import {
  ABCZ_PUBLIC_URL,
  RegistryQuerySchema,
  normalizeRegistryQuery,
  type NormalizedRegistryQuery,
  type RegistryLookup,
} from "./animal-registry.ts";
import { authorizePanelRequest, panelStore, hashToken, type PanelStore } from "./panel.server.ts";
import { canEdit } from "./schema.ts";

export const ABCZ_ENDPOINT = "https://www.abczstat.com.br/softwareterceiros/eletro.asmx";
const namespace = "https://www.abczstat.com.br/softwareterceiros/";
const MAX_XML = 2 * 1024 * 1024;
const FarmCredentials = z
  .object({
    creatorCode: z.coerce.number().int().min(1).max(2147483647),
    login: z.string().trim().min(1).max(160),
    password: z.string().min(1).max(2000),
  })
  .strict();
type RegistryEnv = Record<string, string | undefined>;
function registryAccess(propertyId: string | undefined, env: RegistryEnv = process.env) {
  const software = env.ABCZ_SOFTWARE_ID?.trim();
  if (!propertyId || !software || !/^[1-9]\d{0,9}$/.test(software) || Number(software) > 2147483647)
    return null;
  try {
    const map = JSON.parse(env.ABCZ_FARM_CREDENTIALS_JSON ?? "{}");
    if (!map || typeof map !== "object" || !Object.prototype.hasOwnProperty.call(map, propertyId))
      return null;
    const credentials = FarmCredentials.safeParse(map[propertyId]);
    return credentials.success ? { software, ...credentials.data } : null;
  } catch {
    return null;
  }
}
export function abczConfigured(propertyId: string, env: RegistryEnv = process.env) {
  return registryAccess(propertyId, env) !== null;
}
type Row = Record<string, unknown>;
const row = (value: unknown): Row =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {};
const list = (value: unknown): Row[] =>
  (Array.isArray(value) ? value : value ? [value] : []).map(row);
function text(value: unknown) {
  return typeof value === "string"
    ? value.trim().replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, (entity) => {
        const known: Record<string, string> = {
          "&amp;": "&",
          "&lt;": "<",
          "&gt;": ">",
          "&quot;": '"',
          "&apos;": "'",
        };
        if (known[entity]) return known[entity];
        const code =
          entity[2]?.toLowerCase() === "x"
            ? parseInt(entity.slice(3, -1), 16)
            : Number(entity.slice(2, -1));
        return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
          ? String.fromCodePoint(code)
          : "";
      })
    : "";
}
const canonical = (value: unknown) =>
  text(value)
    .toUpperCase()
    .replace(/[\s.-]/g, "");
const serial = (value: unknown) => canonical(value).replace(/^0+(?=\d)/, "");
const sex = (value: unknown) =>
  (
    ({ M: "male", MACHO: "male", F: "female", FEMEA: "female", FÊMEA: "female" }) as Record<
      string,
      "male" | "female"
    >
  )[text(value).toUpperCase()];
const xmlEscape = (value: string) =>
  value.replace(
    /[<>&"']/g,
    (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]!,
  );
export class RegistryError extends Error {
  code:
    | "not_configured"
    | "not_found"
    | "ambiguous"
    | "access_denied"
    | "unavailable"
    | "invalid_response";
  status: number;
  constructor(
    code:
      | "not_configured"
      | "not_found"
      | "ambiguous"
      | "access_denied"
      | "unavailable"
      | "invalid_response",
    message: string,
    status: number,
  ) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
function identity(value: Row) {
  return text(value.serie) && text(value.rgn)
    ? `${canonical(value.serie)}:${serial(value.rgn)}`
    : `${canonical(value.racasigla)}:${canonical(value.graudesanguesigla)}:${serial(value.rgd)}`;
}
function matches(query: NormalizedRegistryQuery, animal: Row) {
  return query.mode === "rgn"
    ? canonical(animal.serie) === canonical(query.series) &&
        serial(animal.rgn) === serial(query.rgn)
    : serial(animal.rgd) === serial(query.rgd) &&
        canonical(animal.racasigla) === canonical(query.breedCode) &&
        canonical(animal.graudesanguesigla) === canonical(query.category) &&
        sex(animal.sexo) === query.sex;
}
/** The documented third-party result inherits animalDetalhado's parent fields. */
function complementaryAnimal(value: Row): Row {
  const parent = (suffix: "Pai" | "Mae") => ({
    serie: value["serie" + suffix],
    rgn: value["rgn" + suffix],
    rgd: value["rgd" + suffix],
    nome: value["nome" + suffix],
    nascimento: value["nasc" + suffix],
    sexo: value["sexo" + suffix],
    racasigla: value["racaSigla" + suffix],
    graudesanguesigla: value["grauSangueSigla" + suffix],
  });
  return {
    ...value,
    serie: value.serie || value.seriealfa,
    pai: parent("Pai"),
    mae: parent("Mae"),
  };
}
function fields(animal: Row): Partial<AnimalProfile> {
  const series = text(animal.serie),
    rgn = text(animal.rgn),
    rgd = text(animal.rgd);
  const code = series && rgn ? `${series} ${rgn}` : rgd;
  const data: Partial<AnimalProfile> = { ...(code ? { code } : {}) };
  for (const [target, source] of Object.entries({
    name: "nome",
    registrySeries: "serie",
    rgn: "rgn",
    rgd: "rgd",
    breed: "racasigla",
    category: "graudesanguesigla",
    coat: "pelagemDescricao",
  })) {
    const value = text(animal[source]);
    if (value) Object.assign(data, { [target]: value.slice(0, 160) });
  }
  if (code) data.registry = code;
  const gender = sex(animal.sexo);
  if (gender) data.sex = gender;
  const birth = text(animal.nascimento),
    iso = birth.match(/^(\d{4}-\d{2}-\d{2})(?:T|\s|$)/)?.[1];
  const br = birth.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s|$)/);
  const date = iso ?? (br ? `${br[3]}-${br[2]}-${br[1]}` : "");
  if (z.iso.date().safeParse(date).success && date >= "1800-01-01") data.birthDate = date;
  return data;
}
export function parseAbczGenealogy(
  xml: string,
  query: NormalizedRegistryQuery,
  method: string,
  now = new Date(),
): RegistryLookup {
  if (Buffer.byteLength(xml) > MAX_XML || /<!\s*(?:DOCTYPE|ENTITY)/i.test(xml))
    throw new RegistryError(
      "invalid_response",
      "A ABCZ retornou uma resposta que não pôde ser validada.",
      502,
    );
  let depth = 0,
    tags = 0;
  for (const match of xml.matchAll(/<\/?[a-z_][^>]*>/gi)) {
    if (++tags > 20_000)
      throw new RegistryError(
        "invalid_response",
        "Resposta da ABCZ excedeu o limite de leitura.",
        502,
      );
    if (match[0].startsWith("</")) depth--;
    else if (!match[0].endsWith("/>")) depth++;
    if (depth > 64)
      throw new RegistryError("invalid_response", "Estrutura de resposta da ABCZ inválida.", 502);
  }
  if (XMLValidator.validate(xml) !== true)
    throw new RegistryError("invalid_response", "A ABCZ retornou uma resposta inválida.", 502);
  const parsed = new XMLParser({
    removeNSPrefix: true,
    ignoreAttributes: false,
    parseTagValue: false,
    processEntities: false,
  }).parse(xml);
  const body = row(row(row(parsed).Envelope).Body);
  if (body.Fault)
    throw new RegistryError(
      "unavailable",
      "A ABCZ não conseguiu atender a consulta agora. Tente novamente mais tarde.",
      502,
    );
  const operation = row(body[method + "Response"]);
  if (!Object.prototype.hasOwnProperty.call(operation, method + "Result"))
    throw new RegistryError("invalid_response", "Resposta da ABCZ sem os dados esperados.", 502);
  const response = row(operation[method + "Result"]);
  const complementary = method === "PesquisarAnimalQualquerChaveComplementar";
  const returnedAnimals = complementary
    ? list(response.animalGeralDetalhado).map(complementaryAnimal)
    : list(row(response.animaisPesquisados).AnimalParaGenealogia);
  const message = [
    text(response.mensagem),
    ...returnedAnimals.map((animal) => text(animal.mensagem)),
  ].join(" ");
  if (
    /n[aã]o\s+(?:autoriz|habilitad|credenciad)|sem permiss|acesso negado|acesso.*restrit|exclusiv[oa].*(?:sistema|produz)|software.*(?:inv[aá]lid|inexistent|obrigat|n[aã]o\s+(?:cadastrad|informad))/i.test(
      message,
    ) ||
    (!returnedAnimals.some((animal) => text(animal.nome)) &&
      /software|licen[cç]|senha|login|credenc|usu[aá]rio|criador/i.test(message))
  )
    throw new RegistryError(
      "access_denied",
      "A ABCZ não autorizou esta consulta. Confira a habilitação do serviço com a associação.",
      403,
    );
  const primary = returnedAnimals.filter((animal) => matches(query, animal));
  if (!primary.length)
    throw new RegistryError(
      "not_found",
      "Não foi encontrada uma ficha acessível com essa identificação. Confira o registro ou consulte a ABCZ; isso não confirma que o animal não exista.",
      404,
    );
  if (primary.length !== 1)
    throw new RegistryError(
      "ambiguous",
      "A ABCZ retornou mais de uma ficha para a identificação. Confira o registro antes de importar.",
      409,
    );
  if (
    complementary &&
    (/n[aã]o\s+(?:encontrad|localizad|exist)|registro.*inexistent/i.test(message) ||
      (!text(primary[0].nome) &&
        !sex(primary[0].sexo) &&
        !/[a-z]/i.test(text(primary[0].racasigla))))
  )
    throw new RegistryError(
      "not_found",
      "A ABCZ não retornou uma ficha cadastral acessível para esse registro. Confira a identificação e a autorização da consulta.",
      404,
    );
  const target = primary[0],
    all = complementary
      ? [target, row(target.pai), row(target.mae)]
      : [target, ...list(row(response.animaisDaGenealogia).AnimalParaGenealogia)];
  const profile = fields(target),
    pedigree: PedigreeNode[] = [];
  function visit(reference: unknown, relation: string, ancestors: Set<string>) {
    const ref = row(reference);
    if (!Object.keys(ref).length || ref["@_nil"] === "true") return;
    if (!text(ref.rgn) && !text(ref.rgd)) return;
    const key = identity(ref);
    if (ancestors.has(key)) return;
    const candidates = all.filter((animal) => identity(animal) === key);
    if (candidates.length > 1) return;
    const animal = candidates[0] ?? ref,
      data = fields(animal);
    if (!data.code) return;
    const node = PedigreeNodeSchema.parse({
      relation,
      ...Object.fromEntries(
        Object.entries(data).filter(([key]) =>
          ["code", "name", "registrySeries", "rgn", "rgd", "breed", "sex", "birthDate"].includes(
            key,
          ),
        ),
      ),
    });
    pedigree.push(node);
    if (relation.split(".").length < 3) {
      const path = new Set(ancestors).add(key);
      visit(animal.pai, relation + ".sire", path);
      visit(animal.mae, relation + ".dam", path);
    }
  }
  visit(target.pai, "sire", new Set([identity(target)]));
  visit(target.mae, "dam", new Set([identity(target)]));
  const sire = pedigree.find((node) => node.relation === "sire"),
    dam = pedigree.find((node) => node.relation === "dam");
  if (sire) profile.sire = sire.code;
  else if (text(row(target.pai).nome)) profile.sire = text(row(target.pai).nome).slice(0, 160);
  if (dam) profile.dam = dam.code;
  else if (text(row(target.mae).nome)) profile.dam = text(row(target.mae).nome).slice(0, 160);
  if (pedigree.length) profile.pedigree = pedigree;
  AnimalProfileSchema.partial().parse(profile);
  return { profile, provider: "ABCZ", sourceUrl: ABCZ_PUBLIC_URL, consultedAt: now.toISOString() };
}
export async function lookupAbcz(
  query: NormalizedRegistryQuery,
  deps: { env?: RegistryEnv; fetchImpl?: typeof fetch; now?: Date; propertyId?: string } = {},
) {
  const access = registryAccess(deps.propertyId, deps.env);
  if (!access)
    throw new RegistryError(
      "not_configured",
      "A conexão com a ABCZ está aguardando habilitação e vinculação da conta do criador a esta fazenda. Você pode preencher a ficha enquanto o acesso é liberado.",
      503,
    );
  // Anonymous _GEN/complementary calls can be exclusive to PRODUZ. Use the
  // documented authenticated genealogy contract, with credentials scoped to
  // the authorized property rather than a shared creator login for all users.
  const method = "PesquisarGenealogia";
  const parameters = {
    criador_codigo: String(access.creatorCode),
    login: access.login,
    senha: access.password,
    seriealfa: query.mode === "rgn" ? query.series : "",
    rgn: query.mode === "rgn" ? query.rgn : "",
    raca_sigla: query.mode === "rgd" ? query.breedCode : "",
    graudesangue_sigla: query.mode === "rgd" ? query.category : "",
    sexo: query.mode === "rgd" ? (query.sex === "male" ? "M" : "F") : "",
    rgd: query.mode === "rgd" ? query.rgd : "",
    software: access.software,
  };
  const body = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><${method} xmlns="${namespace}">${Object.entries(
    parameters,
  )
    .map(([key, value]) => `<${key}>${xmlEscape(value!)}</${key}>`)
    .join("")}</${method}></soap:Body></soap:Envelope>`;
  try {
    const response = await (deps.fetchImpl ?? fetch)(ABCZ_ENDPOINT, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: { "content-type": "text/xml; charset=utf-8", SOAPAction: `"${namespace}${method}"` },
      body,
    });
    if ([401, 403].includes(response.status))
      throw new RegistryError(
        "access_denied",
        "A ABCZ não autorizou a consulta. Confira a habilitação do serviço.",
        403,
      );
    if (!response.ok)
      throw new RegistryError(
        "unavailable",
        "O serviço da ABCZ está indisponível no momento. Tente novamente mais tarde.",
        502,
      );
    if (Number(response.headers.get("content-length")) > MAX_XML)
      throw new RegistryError(
        "invalid_response",
        "Resposta da ABCZ excedeu o limite de leitura.",
        502,
      );
    const reader = response.body?.getReader();
    if (!reader) throw new RegistryError("invalid_response", "Resposta da ABCZ vazia.", 502);
    const parts: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        length += part.value.byteLength;
        if (length > MAX_XML) {
          await reader.cancel();
          throw new RegistryError(
            "invalid_response",
            "Resposta da ABCZ excedeu o limite de leitura.",
            502,
          );
        }
        parts.push(part.value);
      }
    } finally {
      reader.releaseLock();
    }
    return parseAbczGenealogy(Buffer.concat(parts).toString("utf8"), query, method, deps.now);
  } catch (error) {
    if (error instanceof RegistryError) throw error;
    throw new RegistryError(
      "unavailable",
      "Não foi possível consultar a ABCZ agora. A ficha pode ser preenchida manualmente.",
      502,
    );
  }
}
function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "cache-control": "no-store, private",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      vary: "Cookie, X-TPEC-Panel-Mode",
    },
  });
}
export async function handleAnimalRegistry(
  request: Request,
  deps: {
    store?: PanelStore;
    enabled?: boolean;
    lookup?: typeof lookupAbcz;
    configured?: boolean;
  } = {},
) {
  if (!(deps.enabled ?? process.env.TPEC_GUARDIAN_ENABLED === "true"))
    return json({ error: "Serviço indisponível." }, 503);
  if (!["GET", "POST"].includes(request.method))
    return json({ error: "Método não permitido." }, 405);
  if (
    request.method === "POST" &&
    (request.headers.get("origin") !== new URL(request.url).origin ||
      request.headers.get("x-tpec-panel") !== "1" ||
      request.headers.get("sec-fetch-site") === "cross-site")
  )
    return json({ error: "Solicitação não autorizada." }, 403);
  if (
    request.method === "POST" &&
    !request.headers.get("content-type")?.startsWith("application/json") &&
    request.headers.get("content-type") !== "application/pdf"
  )
    return json({ error: "Envie dados JSON." }, 415);
  try {
    const store = deps.store ?? panelStore,
      identity = await authorizePanelRequest(request, store);
    if (!identity)
      return json({ error: "Entre novamente na sua fazenda para consultar o animal." }, 401);
    if (!canEdit(identity.role, { kind: "animal", code: "consulta" }) || identity.role === "worker")
      return json({ error: "Seu acesso não permite consultar esta ficha." }, 403);
    if (request.method === "GET")
      return json({
        configured: deps.configured ?? abczConfigured(identity.propertyId),
        publicUrl: ABCZ_PUBLIC_URL,
      });
    if (request.headers.get("content-type") === "application/pdf") {
      if (
        !(await store.attempt(
          hashToken("animal-registry:" + identity.propertyId + ":" + identity.phone),
        ))
      )
        return json({ error: "Muitas importações. Aguarde um minuto." }, 429);
      if (Number(request.headers.get("content-length")) > MAX_ABCZ_PDF)
        return json({ error: "O PDF deve ter até 5 MB." }, 413);
      const reader = request.body?.getReader();
      if (!reader) return json({ error: "Envie o PDF." }, 400);
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          length += part.value.byteLength;
          if (length > MAX_ABCZ_PDF) {
            await reader.cancel();
            return json({ error: "O PDF deve ter até 5 MB." }, 413);
          }
          chunks.push(part.value);
        }
      } finally {
        reader.releaseLock();
      }
      try {
        return json(await importAbczPdf(new Uint8Array(Buffer.concat(chunks))));
      } catch {
        return json(
          {
            error:
              "Não foi possível ler esse certificado. Use o PDF digital ABCZ de nascimento com texto e árvore de quatro gerações; outros layouts e digitalizações precisam de preenchimento manual.",
          },
          422,
        );
      }
    }
    if (Number(request.headers.get("content-length")) > 2048)
      return json({ error: "Solicitação muito grande." }, 413);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 2048) return json({ error: "Solicitação muito grande." }, 413);
    let query: NormalizedRegistryQuery;
    try {
      query = normalizeRegistryQuery(RegistryQuerySchema.parse(JSON.parse(raw)));
    } catch (error) {
      return json(
        {
          error:
            error instanceof z.ZodError || error instanceof SyntaxError
              ? "Confira a identificação informada."
              : (error as Error).message,
        },
        400,
      );
    }
    if (
      !(await store.attempt(
        hashToken("animal-registry:" + identity.propertyId + ":" + identity.phone),
      ))
    )
      return json({ error: "Muitas consultas. Aguarde um minuto e tente novamente." }, 429);
    return json(await (deps.lookup ?? lookupAbcz)(query, { propertyId: identity.propertyId }));
  } catch (error) {
    if (error instanceof RegistryError)
      return json(
        { error: error.message, code: error.code, publicUrl: ABCZ_PUBLIC_URL },
        error.status,
      );
    return json(
      { error: "Não foi possível realizar a consulta agora. Nenhum cadastro foi alterado." },
      503,
    );
  }
}
