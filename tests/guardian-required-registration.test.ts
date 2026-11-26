import { test } from "node:test";
import assert from "node:assert/strict";
import { collectRegistration, municipalityMatches, municipalityRows, nextField, privateRegistration, producerSize, registrationComplete, revenueCents, taxDocument } from "../src/lib/guardian/farm-registration.ts";

test("classifica sem lacunas nem arredondar os limites", () => {
  for (const [cents,size] of [[0,"small"],[50_000_000,"small"],[50_000_001,"medium"],[350_000_000,"medium"],[350_000_001,"large"]] as const)
    assert.equal(producerSize(cents),size);
  assert.equal(revenueCents("500 mil"),50_000_000);
  assert.equal(revenueCents("R$ 3,5 milhões"),350_000_000);
  assert.equal(revenueCents("3.500.000,01"),350_000_001);
  assert.equal(revenueCents("não sei"),undefined);
});
test("documento precisa de dígitos verificadores válidos", () => {
  assert.equal(taxDocument("529.982.247-25"),"52998224725");
  assert.equal(taxDocument("11.222.333/0001-81"),"11222333000181");
  assert.equal(taxDocument("111.111.111-11"),undefined);
  assert.equal(taxDocument("529.982.247-24"),undefined);
});
test("aceita campos rotulados juntos, guarda valores parciais e não inventa UF", () => {
  const slots=collectRegistration("Nome do produtor: Maria da Silva\nNome da propriedade: Boa Vista\nCPF/CNPJ: 529.982.247-25\nInscrição estadual: 123456789\nMunicípio: Monte Aprazível\nE-mail: exemplo@example.com\nFaturamento anual: 500 mil");
  assert.equal(slots.producer,"Maria da Silva");
  assert.equal(slots.name,"Boa Vista");
  assert.equal(slots.city,"Monte Aprazível");
  assert.equal(slots.annualRevenueCents,50_000_000);
  assert.equal(nextField(slots),undefined);
  assert.equal(registrationComplete(slots),false);
  assert.throws(()=>privateRegistration(slots));
  const complete={...slots,uf:"SP",municipalityId:3531407};
  assert.equal(registrationComplete(complete),true);
  assert.equal(privateRegistration(complete).email,"exemplo@example.com");
  const corrected=collectRegistration("Faturamento anual: 3,5 milhões",complete);
  assert.equal(corrected.annualRevenueCents,350_000_000);
  assert.equal(corrected.document,slots.document);
});
test("respostas curtas só completam o campo solicitado", () => {
  let s=collectRegistration("Maria da Silva",{},"producer");
  s=collectRegistration("Boa Vista",s,"name");
  s=collectRegistration("CPF/CNPJ: inválido",s,"document");
  assert.equal(nextField(s),"document");
  s=collectRegistration("529.982.247-25",s,"document");
  assert.equal(nextField(s),"stateRegistration");
});
test("IBGE: município único e homônimos não escolhem arbitrariamente o estado", () => {
  const rows=municipalityRows([{id:3531407,nome:"Monte Aprazível"},{id:3501004,nome:"Exemplo"},{id:3101003,nome:"Exemplo"}]);
  assert.equal(municipalityMatches("monte aprazivel",rows)[0].uf,"SP");
  assert.equal(municipalityMatches("Exemplo",rows).length,2);
  assert.equal(municipalityMatches("Exemplo",rows,"MG")[0].uf,"MG");
  assert.equal(municipalityMatches("Inexistente",rows).length,0);
});
