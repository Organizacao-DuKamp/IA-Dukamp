import { describe, it, expect } from "vitest";
import { parseLivestockQuery, detectCategory, type LivestockCategoryRow, type LivestockPlaceRow } from "@/lib/market/livestock-parse";

const cats: LivestockCategoryRow[] = [
  { slug:"boi-gordo", nome:"Boi gordo", especie:"bovino", unidade_padrao:"@", sinonimos:["boi gordo","boi"], max_idade_dias:10, ordem:1 },
  { slug:"vaca-gorda", nome:"Vaca gorda", especie:"bovino", unidade_padrao:"@", sinonimos:["vaca gorda"], max_idade_dias:10, ordem:2 },
  { slug:"bezerro-desmamado", nome:"Bezerro desmamado", especie:"bovino", unidade_padrao:"cabeça", sinonimos:["bezerro"], max_idade_dias:20, ordem:3 },
  { slug:"bezerra", nome:"Bezerra", especie:"bovino", unidade_padrao:"cabeça", sinonimos:["bezerra"], max_idade_dias:20, ordem:4 },
];
const places: LivestockPlaceRow[] = [
  { slug:"monte-aprazivel", municipio:"Monte Aprazível", uf:"SP", regiao:"Noroeste Paulista", is_praca_pecuaria:false, lat:-20.77, lon:-49.71, apelidos:[] },
  { slug:"sao-jose-do-rio-preto", municipio:"São José do Rio Preto", uf:"SP", regiao:"Noroeste Paulista", is_praca_pecuaria:true, lat:-20.81, lon:-49.38, apelidos:["rio preto"] },
];

describe("parseLivestockQuery", () => {
  it("boi gordo em Monte Aprazível", () => {
    const r = parseLivestockQuery("qual o preço da arroba do boi gordo em Monte Aprazível?", cats, places)!;
    expect(r.category.slug).toBe("boi-gordo");
    expect(r.place?.slug).toBe("monte-aprazivel");
    expect(r.unit).toBe("@");
  });
  it("apelido Rio Preto", () => {
    const r = parseLivestockQuery("quanto está a vaca gorda em Rio Preto?", cats, places)!;
    expect(r.category.slug).toBe("vaca-gorda");
    expect(r.place?.slug).toBe("sao-jose-do-rio-preto");
  });
  it("bezerra não vira bezerro", () => {
    expect(detectCategory("preço da bezerra", cats)!.slug).toBe("bezerra");
  });
  it("sem intenção de preço retorna null", () => {
    expect(parseLivestockQuery("como suplementar boi gordo na seca?", cats, places)).toBeNull();
  });
  it("unidade cabeça padrão do bezerro", () => {
    expect(parseLivestockQuery("cotação do bezerro em SP", cats, places)!.unit).toBe("cabeça");
  });
});
