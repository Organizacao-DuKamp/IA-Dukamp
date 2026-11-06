import { AnimalPedigreeTree } from "./AnimalPedigreeTree";
import { useEffect, useId, useRef, useState } from "react";
import { Search, ExternalLink, Check, LoaderCircle } from "lucide-react";
import {
  AnimalProfileSchema,
  animalFieldLabels,
  animalFieldValue,
  animalFormValues,
  sameAnimalRegistry,
  pedigreeLabel,
  type AnimalProfile,
  type PedigreeNode,
} from "@/lib/guardian/animal-profile";
import {
  ABCZ_PUBLIC_URL,
  normalizeRegistryQuery,
  type RegistryLookup,
} from "@/lib/guardian/animal-registry";
import { installedPanel } from "@/lib/guardian/app-mode";
import type { FarmBook } from "@/lib/guardian/schema";

type Values = Record<string, string>;
export function AnimalProfileFields({
  values,
  onChange,
  book,
  disabled,
}: {
  values: Values;
  onChange: React.Dispatch<React.SetStateAction<Values>>;
  book?: FarmBook;
  disabled: boolean;
}) {
  const id = useId(),
    request = useRef<AbortController | null>(null),
    generation = useRef(0);
  const [mode, setMode] = useState<"rgn" | "rgd">("rgn"),
    [loading, setLoading] = useState(false),
    [lookup, setLookup] = useState<RegistryLookup | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [reviewedTarget, setReviewedTarget] = useState<string | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [available, setAvailable] = useState<boolean | null>(null);
  const headers = () => ({
    "content-type": "application/json",
    "x-tpec-panel": "1",
    "x-tpec-panel-mode": installedPanel() ? "installed" : "browser",
  });
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/public/farm-panel/animal-registry", {
      credentials: "same-origin",
      cache: "no-store",
      headers: headers(),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.ok) setAvailable(Boolean((await response.json()).configured));
      })
      .catch(() => {});
    return () => {
      controller.abort();
      request.current?.abort();
    };
  }, []);
  function change(key: string, value: string) {
    request.current?.abort();
    generation.current++;
    setLoading(false);
    setLookup(null);
    setError("");
    onChange((current) => ({ ...current, [key]: value }));
  }
  const animals = book?.animals ?? [];
  const suggestions: Record<string, string[]> = {
    code: animals.map((animal) => animal.code),
    breed: [
      ...(book?.profile.breeds ?? []),
      ...animals.flatMap((animal) => (animal.breed ? [animal.breed] : [])),
      "Nelore",
      "Gir",
      "Guzerá",
      "Brahman",
      "Tabapuã",
      "Sindi",
      "Angus",
      "Girolando",
    ],
    lot: book?.operations?.lots.map((lot) => lot.name) ?? [],
    pasture:
      book?.management?.entries
        .filter((entry) => entry.section === "pasture" && !entry.removed)
        .flatMap((entry) => (entry.values.name ? [entry.values.name] : [])) ?? [],
    pen:
      book?.management?.entries
        .filter((entry) => entry.section === "pasture" && !entry.removed)
        .flatMap((entry) => (entry.values.name ? [entry.values.name] : [])) ?? [],
    responsible: animals.flatMap((animal) => (animal.responsible ? [animal.responsible] : [])),
    origin: ["Nascimento na fazenda", "Compra", "Doação", "Transferência", "Outra origem"],
    destination: ["Reprodução", "Cria", "Recria", "Engorda", "Abate", "Venda"],
    seller: animals.flatMap((animal) => (animal.seller ? [animal.seller] : [])),
    sire: animals.filter((animal) => animal.sex !== "female").map((animal) => animal.code),
    dam: animals.filter((animal) => animal.sex !== "male").map((animal) => animal.code),
  };
  const input = (key: string, label: string, type = "text", placeholder?: string) => (
    <label key={key} className="block text-sm font-medium">
      {label}
      <input
        aria-label={label}
        required={key === "code"}
        type={type}
        value={values[key] ?? ""}
        onChange={(event) => change(key, event.target.value)}
        placeholder={placeholder}
        list={suggestions[key]?.length ? `${id}-${key}` : undefined}
        maxLength={type === "text" ? 160 : undefined}
        min={type === "number" ? 0 : undefined}
        max={key === "carcassPercent" ? 100 : undefined}
        step={type === "number" ? "any" : undefined}
        className="mt-1 block w-full min-w-0 rounded-xl border border-input bg-background px-3 py-3"
      />
      {suggestions[key]?.length ? (
        <datalist id={`${id}-${key}`}>
          {[...new Set(suggestions[key])].map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>
      ) : null}
    </label>
  );
  const select = (key: string, label: string, options: Array<[string, string]>) => (
    <label className="block text-sm font-medium">
      {label}
      <select
        aria-label={label}
        value={values[key] ?? options[0][0]}
        onChange={(event) => change(key, event.target.value)}
        className="mt-1 block w-full rounded-xl border border-input bg-background px-3 py-3"
      >
        {options.map(([value, title]) => (
          <option key={value} value={value}>
            {title}
          </option>
        ))}
      </select>
    </label>
  );
  async function search() {
    setError("");
    setNotice("");
    setLookup(null);
    setReviewedTarget(null);
    let query;
    try {
      query = normalizeRegistryQuery(
        mode === "rgn"
          ? { mode, series: values.registrySeries, rgn: values.rgn, code: values.code }
          : {
              mode,
              rgd: values.rgd ?? "",
              breedCode: values.breedCode ?? values.breed ?? "",
              category: values.category ?? "",
              sex: values.sex === "female" ? "female" : "male",
            },
      );
      if (mode === "rgd" && !["male", "female"].includes(values.sex))
        throw Error("Informe o sexo para consultar por RGD.");
    } catch (error) {
      setError((error as Error).message);
      return;
    }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const expected = ++generation.current;
    setLoading(true);
    try {
      const response = await fetch("/api/public/farm-panel/animal-registry", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: headers(),
        body: JSON.stringify(query),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error ?? "Não foi possível consultar o registro.");
      const profile = AnimalProfileSchema.partial().parse(data.profile);
      if (controller.signal.aborted || expected !== generation.current) return;
      const found = { ...data, profile } as RegistryLookup;
      setLookup(found);
      const form = animalFormValues(profile);
      setSelected(Object.keys(form).filter((key) => !values[key]?.trim()));
    } catch (error) {
      if (!controller.signal.aborted && expected === generation.current)
        setError((error as Error).message);
    } finally {
      if (expected === generation.current) setLoading(false);
    }
  }
  async function importPdf(file: File) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const expected = ++generation.current;
    setError("");
    setNotice("");
    setLookup(null);
    setReviewedTarget(null);
    if (file.size > 5 * 1024 * 1024) {
      setError("O PDF deve ter até 5 MB.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/public/farm-panel/animal-registry", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { ...headers(), "content-type": "application/pdf" },
        body: file,
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error ?? "Não foi possível importar o PDF.");
      const profile = AnimalProfileSchema.partial().parse(data.profile);
      if (controller.signal.aborted || expected !== generation.current) return;
      setLookup({ ...data, profile });
      setSelected(Object.keys(animalFormValues(profile)).filter((key) => !values[key]?.trim()));
    } catch (error) {
      if (!controller.signal.aborted && expected === generation.current)
        setError((error as Error).message);
    } finally {
      if (expected === generation.current) setLoading(false);
    }
  }
  const matchingAnimals = lookup
    ? animals.filter(
        (animal) =>
          sameAnimalRegistry(animal, lookup.profile) ||
          animal.code.trim().toLowerCase() === lookup.profile.code?.trim().toLowerCase(),
      )
    : [];
  const importTarget = matchingAnimals[0];
  function apply() {
    if (!lookup) return;
    if (matchingAnimals.length > 1) {
      setError(
        "Mais de uma ficha corresponde ao registro. Corrija as duplicidades antes de importar.",
      );
      return;
    }
    if (
      importTarget &&
      (values.code !== importTarget.code || reviewedTarget !== importTarget.code)
    ) {
      setError("Carregue a ficha correspondente antes de aplicar os dados.");
      return;
    }
    const found = animalFormValues(lookup.profile);
    if (importTarget) found.code = importTarget.code;
    if (selected.includes("pedigree")) {
      const roots = lookup.profile.pedigree?.filter((n) => !n.relation.includes(".")) ?? [];
      if (
        roots.some(
          (root) =>
            (selected.includes(root.relation) ? found[root.relation] : values[root.relation]) !==
            root.code,
        )
      ) {
        setError(
          "Para aplicar a genealogia, selecione também o pai e a mãe correspondentes ao documento.",
        );
        return;
      }
    }

    onChange((current) => ({
      ...current,
      ...Object.fromEntries(selected.map((key) => [key, found[key]])),
    }));
    setNotice(
      `${selected.length} campos preenchidos. Confira a ficha e toque em Revisar antes de salvar.`,
    );
    setLookup(null);
  }
  const existing = animals.find(
    (animal) => animal.code.trim().toLowerCase() === values.code?.trim().toLowerCase(),
  );
  let pedigree: PedigreeNode[] = [];
  try {
    pedigree = JSON.parse(values.pedigree || "[]");
  } catch {
    /* Empty until a valid import is selected. */
  }
  return (
    <div className="space-y-6 sm:col-span-2">
      <section
        className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 sm:p-5"
        aria-labelledby={`${id}-lookup`}
      >
        <h3 id={`${id}-lookup`} className="flex items-center gap-2 font-semibold text-emerald-950">
          <Search size={19} aria-hidden="true" /> Preencher com dados da ABCZ
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-emerald-950/80">
          Informe a série e o RGN, como DKN 404, ou consulte por RGD. Revise os dados encontrados
          antes de usar na ficha.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ["rgn", "Série + RGN"],
              ["rgd", "RGD"],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={mode === value}
              disabled={disabled || loading}
              onClick={() => {
                setMode(value);
                setLookup(null);
                setError("");
              }}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold ${mode === value ? "border-emerald-900 bg-emerald-900 text-white" : "border-emerald-200 bg-white text-emerald-950"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <fieldset disabled={disabled || loading} className="mt-4 grid gap-4 sm:grid-cols-2">
          {mode === "rgn" ? (
            <>
              {input("registrySeries", "Série alfabética", "text", "Ex.: DKN")}
              {input("rgn", "RGN", "text", "Ex.: 404 ou DKN 404")}
            </>
          ) : (
            <>
              {input("rgd", "RGD")}
              {input("breedCode", "Sigla da raça na ABCZ", "text", "Ex.: NEL")}
              {input("category", "Categoria / grau de sangue", "text", "Ex.: PO")}
              {select("sex", "Sexo para consulta", [
                ["unknown", "Selecione"],
                ["male", "Macho"],
                ["female", "Fêmea"],
              ])}
            </>
          )}
        </fieldset>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={disabled || loading || available === false}
            onClick={() => void search()}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? (
              <LoaderCircle className="animate-spin" size={17} aria-hidden="true" />
            ) : (
              <Search size={17} aria-hidden="true" />
            )}
            {loading ? "Consultando…" : "Buscar na ABCZ"}
          </button>
          <a
            href={ABCZ_PUBLIC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-emerald-900"
          >
            Abrir consulta pública <ExternalLink size={15} aria-hidden="true" />
          </a>
        </div>
        <label className="mt-4 block text-sm font-semibold text-emerald-950">
          Importar ficha ABCZ
          <input
            type="file"
            accept="application/pdf,.pdf"
            disabled={disabled || loading}
            aria-label="Importar ficha ABCZ"
            className="mt-2 block w-full rounded-xl border bg-white p-3"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void importPdf(file);
            }}
          />
          <span className="mt-2 block text-xs font-normal">
            PDF digital de nascimento, até 5 MB. A importação funciona sem a conexão oficial. Revise
            antes de salvar; nenhum ancestral entra no rebanho.
          </span>
        </label>
        {available === false && (
          <p role="status" className="mt-3 rounded-xl bg-white p-3 text-sm text-amber-950">
            A consulta automática está aguardando a habilitação da ABCZ. O cadastro manual e as
            fichas da fazenda continuam disponíveis.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-white p-3 text-sm text-red-800">
            {error}
          </p>
        )}
        {lookup && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-4">
            <p className="font-semibold text-emerald-950">
              {lookup.sourceKind === "pdf"
                ? "Dados extraídos do PDF ABCZ"
                : "Dados encontrados na ABCZ"}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Campos já preenchidos ficam desmarcados. Selecione somente o que deseja substituir.
            </p>
            {lookup.sourceKind === "pdf" && (
              <p className="mt-2 text-sm">
                Proprietário, fazenda, município e criador são os que constam no documento. RGD e
                outros campos ausentes não são inferidos.
              </p>
            )}
            {importTarget && (
              <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm">
                Este registro já corresponde à ficha {importTarget.code}. A importação deve
                atualizar essa ficha.
                <button
                  type="button"
                  className="mt-2 block rounded-lg border p-2 font-semibold"
                  onClick={() => {
                    const form = animalFormValues({
                      ...importTarget,
                      currentWeightKg:
                        importTarget.weights.at(-1)?.weightKg ?? importTarget.currentWeightKg,
                    });
                    onChange(form);
                    setReviewedTarget(importTarget.code);
                    setError("");
                    setSelected(
                      Object.keys(animalFormValues(lookup.profile)).filter(
                        (key) => key !== "code" && !form[key]?.trim(),
                      ),
                    );
                  }}
                >
                  Carregar ficha de {importTarget.code} para revisão
                </button>
              </div>
            )}
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {Object.entries(lookup.profile).map(([key, value]) => (
                <label
                  key={key}
                  className="flex items-start gap-3 rounded-lg border border-slate-100 p-2 text-sm"
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    disabled={disabled || (key === "code" && !!importTarget)}
                    checked={selected.includes(key) && !(key === "code" && importTarget)}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, key]
                          : current.filter((item) => item !== key),
                      )
                    }
                  />
                  <span className="min-w-0 break-words">
                    <strong>{animalFieldLabels[key as keyof AnimalProfile]}:</strong>{" "}
                    {key === "pedigree"
                      ? (value as PedigreeNode[])
                          .map(
                            (node) =>
                              `${pedigreeLabel(node.relation)}: ${node.code}${node.name ? ` · ${node.name}` : ""}`,
                          )
                          .join("; ")
                      : animalFieldValue(key as keyof AnimalProfile, value)}
                    {values[key] && (
                      <span className="mt-1 block text-xs text-slate-500">
                        Atual:{" "}
                        {animalFieldValue(
                          key as keyof AnimalProfile,
                          key === "pedigree"
                            ? JSON.parse(values[key])
                            : /PriceCents$/.test(key)
                              ? Number(values[key]) * 100
                              : values[key],
                        )}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {lookup.sourceKind === "pdf" ? "Importação em" : "Consulta em"}{" "}
              {new Date(lookup.consultedAt).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })}{" "}
              · Brasília. O cadastro não substitui o certificado oficial.
            </p>
            <button
              type="button"
              disabled={
                disabled ||
                !selected.length ||
                matchingAnimals.length > 1 ||
                (!!importTarget &&
                  (values.code !== importTarget.code || reviewedTarget !== importTarget.code))
              }
              onClick={apply}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Check size={17} aria-hidden="true" /> Aplicar campos selecionados
            </button>
          </div>
        )}
      </section>
      {notice && (
        <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
          {notice}
        </p>
      )}
      <fieldset disabled={disabled} className="space-y-4">
        <legend className="mb-3 font-semibold">Identificação</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {input("code", "Identificação do animal *", "text", "Código usado na fazenda")}
          {input("name", "Nome do animal")}
          {input("birthDate", "Data de nascimento", "date")}
          {input("earTag", "Brinco")}
          {input("electronicTag", "Brinco eletrônico")}
          {input("registry", "Registro")}
          {mode === "rgd" && input("registrySeries", "Série ABCZ")}
          {mode === "rgd" && input("rgn", "RGN informado")}
          {mode === "rgn" && input("rgd", "RGD informado")}
          {mode === "rgn" && input("category", "Categoria")}
          {input("breed", "Raça")}
          {input("coat", "Pelagem")}
          {mode === "rgn" &&
            select("sex", "Sexo", [
              ["unknown", "Não informado"],
              ["female", "Fêmea"],
              ["male", "Macho"],
            ])}
          {select("status", "Status", [
            ["", "Não informado"],
            ["active", "Ativo"],
            ["sold", "Vendido"],
            ["dead", "Morto"],
            ["transferred", "Transferido"],
          ])}
        </div>
        {existing && (
          <button
            type="button"
            onClick={() => {
              request.current?.abort();
              generation.current++;
              setLoading(false);
              setError("");
              onChange(
                animalFormValues({
                  ...existing,
                  currentWeightKg: existing.weights.at(-1)?.weightKg ?? existing.currentWeightKg,
                }),
              );
              setLookup(null);
              setNotice(
                "Ficha da fazenda carregada. Altere os campos desejados e revise antes de salvar.",
              );
            }}
            className="rounded-xl border border-emerald-300 px-4 py-3 text-sm font-semibold text-emerald-900"
          >
            Carregar ficha existente de {existing.code}
          </button>
        )}
      </fieldset>
      <fieldset disabled={disabled} className="border-t pt-5">
        <legend className="pr-3 font-semibold">Dados do documento ABCZ</legend>
        <p className="mb-3 text-xs text-muted-foreground">
          Informações históricas do certificado; não alteram a fazenda atual.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              "documentOwner",
              "documentFarm",
              "documentMunicipality",
              "documentState",
              "documentBreeder",
              "documentSource",
            ] as const
          ).map((key) => input(key, animalFieldLabels[key]))}
        </div>
      </fieldset>
      <fieldset disabled={disabled} className="border-t pt-5">
        <legend className="pr-3 font-semibold">Manejo e localização</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {input("lot", "Lote")}
          {input("responsible", "Responsável")}
          {input("pasture", "Pasto")}
          {input("pen", "Piquete / curral")}
          {input("origin", "Origem")}
          {input("destination", "Destino")}
          {input("entryDate", "Data de entrada", "date")}
          {input("weaningDate", "Data de desmame", "date")}
        </div>
      </fieldset>
      <fieldset disabled={disabled} className="border-t pt-5">
        <legend className="pr-3 font-semibold">Pesos e valores</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {input("entryWeightKg", "Peso de entrada (kg)", "number")}
          {input("currentWeightKg", "Peso atual (kg)", "number")}
          {input("dailyIntakeKg", "Consumo diário (kg)", "number")}
          {input("carcassPercent", "Carcaça (%)", "number")}
          {input("purchasePriceCents", "Valor de compra (R$)", "number")}
          {input("salePriceCents", "Valor de venda (R$)", "number")}
          {input("seller", "Pessoa que vendeu")}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Um novo peso atual é registrado também no histórico de pesagens. Os valores de compra e
          venda ficam na ficha; registre o pagamento ou recebimento no Financeiro quando ocorrer.
        </p>
      </fieldset>
      <fieldset disabled={disabled} className="border-t pt-5">
        <legend className="pr-3 font-semibold">Parentesco e genealogia</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {input("kinship", "Parentesco")}
          {input("sire", "Pai")}
          {input("dam", "Mãe")}
        </div>
        {pedigree.length > 0 && (
          <div className="mt-4 space-y-2">
            <AnimalPedigreeTree
              animal={{
                code: values.code,
                name: values.name,
                sire: values.sire,
                dam: values.dam,
                pedigree,
              }}
            />
            <p className="text-xs text-muted-foreground">
              Ao alterar pai ou mãe, os ascendentes importados daquele ramo são removidos na
              revisão.
            </p>
          </div>
        )}
      </fieldset>
      <label className="block text-sm font-medium">
        Observações
        <textarea
          aria-label="Observações"
          disabled={disabled}
          value={values.notes ?? ""}
          onChange={(event) => change("notes", event.target.value)}
          maxLength={1500}
          rows={4}
          placeholder="Informações adicionais sobre o animal"
          className="mt-1 block w-full rounded-xl border border-input bg-background px-3 py-3"
        />
      </label>
    </div>
  );
}
