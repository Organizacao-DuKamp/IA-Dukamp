export interface BrazilianDddRegion {
  ddd: string;
  location: string;
  region: string;
}

const DDD_REGIONS: Record<string, Omit<BrazilianDddRegion, "ddd">> = {
  "11": { location: "São Paulo - SP", region: "Grande São Paulo" },
  "12": {
    location: "São José dos Campos - SP",
    region: "Vale do Paraíba e Litoral Norte de São Paulo",
  },
  "13": { location: "Santos - SP", region: "Baixada Santista e Vale do Ribeira" },
  "14": { location: "Bauru - SP", region: "região de Bauru e Marília" },
  "15": { location: "Sorocaba - SP", region: "região de Sorocaba e Itapetininga" },
  "16": {
    location: "Ribeirão Preto - SP",
    region: "região de Ribeirão Preto, Araraquara e Franca",
  },
  "17": { location: "São José do Rio Preto - SP", region: "região de São José do Rio Preto" },
  "18": { location: "Presidente Prudente - SP", region: "oeste paulista" },
  "19": { location: "Campinas - SP", region: "região de Campinas e Piracicaba" },
  "21": { location: "Rio de Janeiro - RJ", region: "Rio de Janeiro e região metropolitana" },
  "22": { location: "Campos dos Goytacazes - RJ", region: "norte e noroeste fluminense" },
  "24": { location: "Volta Redonda - RJ", region: "sul fluminense" },
  "27": { location: "Vitória - ES", region: "Grande Vitória e norte do Espírito Santo" },
  "28": { location: "Cachoeiro de Itapemirim - ES", region: "sul do Espírito Santo" },
  "31": {
    location: "Belo Horizonte - MG",
    region: "Belo Horizonte e região central de Minas Gerais",
  },
  "32": { location: "Juiz de Fora - MG", region: "Zona da Mata de Minas Gerais" },
  "33": { location: "Governador Valadares - MG", region: "leste de Minas Gerais" },
  "34": { location: "Uberlândia - MG", region: "Triângulo Mineiro" },
  "35": { location: "Poços de Caldas - MG", region: "sul e sudoeste de Minas Gerais" },
  "37": { location: "Divinópolis - MG", region: "centro-oeste de Minas Gerais" },
  "38": { location: "Montes Claros - MG", region: "norte de Minas Gerais" },
  "41": { location: "Curitiba - PR", region: "Curitiba e região metropolitana" },
  "42": { location: "Ponta Grossa - PR", region: "Campos Gerais e centro-sul do Paraná" },
  "43": { location: "Londrina - PR", region: "norte do Paraná" },
  "44": { location: "Maringá - PR", region: "noroeste do Paraná" },
  "45": { location: "Cascavel - PR", region: "oeste do Paraná" },
  "46": { location: "Pato Branco - PR", region: "sudoeste do Paraná" },
  "47": { location: "Joinville - SC", region: "norte e Vale do Itajaí de Santa Catarina" },
  "48": { location: "Florianópolis - SC", region: "Grande Florianópolis e sul de Santa Catarina" },
  "49": { location: "Chapecó - SC", region: "oeste e serra de Santa Catarina" },
  "51": { location: "Porto Alegre - RS", region: "Porto Alegre e região metropolitana" },
  "53": { location: "Pelotas - RS", region: "sul do Rio Grande do Sul" },
  "54": { location: "Caxias do Sul - RS", region: "Serra Gaúcha e norte do Rio Grande do Sul" },
  "55": { location: "Santa Maria - RS", region: "centro e oeste do Rio Grande do Sul" },
  "61": { location: "Brasília - DF", region: "Distrito Federal e entorno" },
  "62": { location: "Goiânia - GO", region: "Goiânia e centro-norte de Goiás" },
  "63": { location: "Palmas - TO", region: "Tocantins" },
  "64": { location: "Rio Verde - GO", region: "sul de Goiás" },
  "65": { location: "Cuiabá - MT", region: "Cuiabá e centro-sul de Mato Grosso" },
  "66": { location: "Rondonópolis - MT", region: "leste e norte de Mato Grosso" },
  "67": { location: "Campo Grande - MS", region: "Mato Grosso do Sul" },
  "68": { location: "Rio Branco - AC", region: "Acre" },
  "69": { location: "Porto Velho - RO", region: "Rondônia" },
  "71": { location: "Salvador - BA", region: "Salvador e região metropolitana" },
  "73": { location: "Itabuna - BA", region: "sul e extremo sul da Bahia" },
  "74": { location: "Juazeiro - BA", region: "norte da Bahia" },
  "75": { location: "Feira de Santana - BA", region: "centro-norte e recôncavo da Bahia" },
  "77": { location: "Vitória da Conquista - BA", region: "sudoeste e oeste da Bahia" },
  "79": { location: "Aracaju - SE", region: "Sergipe" },
  "81": { location: "Recife - PE", region: "Recife e região metropolitana" },
  "82": { location: "Maceió - AL", region: "Alagoas" },
  "83": { location: "João Pessoa - PB", region: "Paraíba" },
  "84": { location: "Natal - RN", region: "Rio Grande do Norte" },
  "85": { location: "Fortaleza - CE", region: "Fortaleza e região metropolitana" },
  "86": { location: "Teresina - PI", region: "Teresina e norte do Piauí" },
  "87": { location: "Petrolina - PE", region: "interior de Pernambuco" },
  "88": { location: "Juazeiro do Norte - CE", region: "interior do Ceará" },
  "89": { location: "Picos - PI", region: "centro-sul do Piauí" },
  "91": { location: "Belém - PA", region: "Belém e nordeste do Pará" },
  "92": { location: "Manaus - AM", region: "Manaus e região central do Amazonas" },
  "93": { location: "Santarém - PA", region: "oeste do Pará" },
  "94": { location: "Marabá - PA", region: "sudeste do Pará" },
  "95": { location: "Boa Vista - RR", region: "Roraima" },
  "96": { location: "Macapá - AP", region: "Amapá" },
  "97": { location: "Tefé - AM", region: "interior do Amazonas" },
  "98": { location: "São Luís - MA", region: "São Luís e norte do Maranhão" },
  "99": { location: "Imperatriz - MA", region: "sul e leste do Maranhão" },
};

export function inferBrazilianDddRegion(phoneOrSessionId: string): BrazilianDddRegion | null {
  const digits = phoneOrSessionId.replace(/\D/g, "");
  let ddd: string | null = null;

  if (digits.startsWith("55") && digits.length >= 12) {
    ddd = digits.slice(2, 4);
  } else if (digits.length === 10 || digits.length === 11) {
    ddd = digits.slice(0, 2);
  }

  if (!ddd) return null;
  const mapped = DDD_REGIONS[ddd];
  return mapped ? { ddd, ...mapped } : null;
}
