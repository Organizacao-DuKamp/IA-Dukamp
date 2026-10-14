// Safety registry only: this file is not a database import or a technical approval.
import type { CatalogEnvelope } from "../lib/rag/dukamp-package.ts";
export const dukampSafetySnapshot = [
  {
    fingerprint: "ce166466960869e78663bee3ccf55a8b108dfa6423f44c1b5d78f8f5f8a45ce5",
    kind: "catalog",
    product: {
      aliases: ["ADEKAMP GOLD", "RTPI - Baldinho - ADEKamp Gold"],
      bloqueios: [],
      classificacao_documental: "SUPLEMENTO MINERAL PARA MISTURA PARA BOVINOS",
      composicao_documental:
        "aditivo antioxidante,monensina sódica , carbonato de cálcio, DL-metionina, enxofre ventilado (flor de enxofre), fosfato bicálcico, iodato de cálcio, L-lisina, leveduras, óxido de magnésio, selenito de sódio, sulfato de cálcio, sulfato de colbalto, sulfato de cobre, sulfato de ferro, sulfato de manganês, sulfato de zinco, vitamina A, vitamina D3, vitamina E.",
      descricao_documental:
        "Suplemento mineral para mistura. Contém macro e microelementos minerais, vitaminas, aminoácidos e aditivo promotor de crescimento e eficiência alimentar. Indicado principalmente para bovinos de corte (todas as categorias).",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P022_adekamp-gold/fontes/D022.doc",
          arquivo_original: "RTPI/RTPI - Baldinho - ADEKamp Gold.doc",
          sha256: "9298cc6f13870f43661d41746c6671c02989e26eca2b550f9d820d2dfdeeb1e6",
          source_id: "D022",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "O suplemento ADEKAMP GOLD é um produto concentrado e deve ser misturado ao cloreto de sódio (sal comum), após o qual fica pronto para uso, bastando despejar em cochos e deixar à disposição permanente dos animais. Recomenda-se a utilização de cochos cobertos e/ou que evitem acúmulo de água, com espaçamento mínimo de 3 a 5 cm por cabeça suplementada.\n\nSUGESTÕES DE MISTURAS COM SAL COMUM |  | Categoria animal | ADEKAMP GOLD | + | sal comum | consumo esperado |  | manutenção ou engorda | 40 kg | + | 60 kg | 45 g/cab/dia |  | cria/recria | 60 kg | + | 40 kg | 70 g/cab/dia |  | fêmeas reprodutoras | 60 kg | + | 40 kg | 70 g/cab/dia |  | \nAs estimativas dos consumos médios diários esperados das misturas são valores teóricos e baseados em um animal de 450 kg de peso corporal, podendo haver variações conforme a qualidade do volumoso, estado corporal, status nutricional ou estágio fisiológico dos animais. Opcionalmente, pode-se usar ADEKAMP GOLD misturado a um suplemento mineral. Nesse caso, seguir uma das sugestões a seguir:\n\nSUGESTÃO DE MISTURAS COM SAL MINERALIZADO |  | manutenção ou engorda | misturar 1 kg de ADEKAMP GOLD | com | 1 saco (30 kg) de sal pronto para manutenção ou engorda | ou | 1 saco (25kg) de sal DUKAMP 130 Concentrado \n+ 2 sacos (25 kg) de sal comum |  | cria/recria | misturar 1 kg de ADEKAMP GOLD | com | 1 saco (30 kg) de sal pronto para cria/recria | ou | 1 saco (25kg) de sal DUKAMP 130 Concentrado \n+ 1 saco (25 kg) de sal comum |  | fêmeas reprodutoras | misturar 1 kg de ADEKAMP GOLD | com | 1 saco (30 kg) de sal pronto para reprodução | ou | 2 sacos (25kg) de sal DUKAMP 130 Concentrado \n+ 1 saco (25 kg) de sal comum |  | vacas leiteiras | misturar 1 kg de ADEKAMP GOLD | com | 1 saco (30 kg) de sal pronto para vacas leiteiras | ou | 2 sacos (25kg) de sal DUKAMP 130 Concentrado \n+ 1 saco (25 kg) de sal comum |  | \nA proporção da mistura de ADEKAMP GOLD com sal comum e a forma de fornecimento podem ser alteradas conforme prescrição de profissional habilitado. Caso os animais já estejam recebendo rações, fornecer ADEKAMP GOLDdiariamente na quantidade entre 25 a 40 g/cabeça. Em se tratando de bovinos leiteiros, não utilizar ADEKAMP GOLD como fonte única de mineralização. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança. Não fornecer o produto para eqüídeos e ovinos.",
      nome_comercial_documental: "ADEKAMP GOLD",
      principal_documental_source_id: "D022",
      produto_id: "P022",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Em se tratando de bovinos leiteiros, não utilizar ADEKAMP GOLD como fonte única de mineralização. \nNão fornecer o produto para eqüídeos e ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "1f337708534f728659af5deb5b5862f11b1f7cf8f316eae90cd5759614a2bd6f",
    kind: "catalog",
    product: {
      aliases: ["BABYKAMP GOLD", "RTPI - Baldinho - BabyKamp Gold"],
      bloqueios: [
        {
          descricao:
            "A inclusão é descrita como 30 a 40 kg por tonelada e como 2 a 4%. 30 kg em uma tonelada correspondem a 3%. Não escolher silenciosamente um dos limites inferiores.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Baldinho - BabyKamp Gold.doc",
              evidence_id: "D023-S12",
              pagina_pdf_inicio: null,
              secao_numero_original: 12,
              secao_semantica: "Modo de usar",
              source_id: "D023",
            },
          ],
          source_id: "D023",
          tipo: "dose",
        },
      ],
      classificacao_documental: "SUPLEMENTO MINERAL PARA MISTURA PARA BOVINOS",
      composicao_documental:
        "aditivo antioxidante,monensina sodica, carbonato de cálcio, cloreto de potássio, cloreto de sódio (sal comum), cromo orgânico, enxofre ventilado (flor de enxofre), farelo de soja, fosfato bicálcico, iodato de cálcio, leveduras, melaço, óxido de magnésio, selenito de sódio, sulfato de cálcio, sulfato de colbalto, sulfato de cobre, sulfato de manganês, sulfato de zinco, sulfato ferroso, vitamina A, vitamina D3, vitamina E, vitamina K.",
      descricao_documental:
        "Suplemento mineral para mistura, para uso exclusivo na formulação de rações. Contém vitaminas e ionóforo e é indicado para potencializar a expressão genética de bezerros em fase inicial, visando otimizar o ganho de peso e eficiência alimentar. Também é indicado para o preparo de animais de elite para exposições.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P023_babykamp-gold/fontes/D023.doc",
          arquivo_original: "RTPI/RTPI - Baldinho - BabyKamp Gold.doc",
          sha256: "6d22d1b1f3384a4d5dc5e4afd00ae584fb89fac95d7071c4e72e9d65947fc6ef",
          source_id: "D023",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "O suplemento BABYKAMP GOLD é para uso exclusivo na formulação de rações. Recomenda-se a adição de 30 a 40 kg de BABYKAMP GOLD por tonelada de ração (isto é, entre 2 e 4% de inclusão). Fornecer o produto elaborado calculado na proporção de 1 a 1,5 kg de ração para cada 100 kg de peso corporal. É desejável que o consumo diário de BABYKAMP GOLD esteja ao redor de 30 a 60 gramas por cabeça.\n\nDOSAGEM RECOMENDADA:\n\n- Bezerros(as) de corte ou leiteiros (comerciais):\n- saudáveis e em baias individuais: 30 g/dia\n- saudáveis e em baias coletivas: 45 g/dia\n- saudáveis e mantidos a pasto: 50 g/dia\n- debilitados: 60 g/dia\n\n- Bezerros(as) de elevado potencial genético (elite e/ou para exposição):\n- saudáveis: 45 g/dia\n- debilitados: 60 g/dia\n\nAs recomendações aqui descritas de inclusão de BABYKAMP GOLD na ração, bem como as de quantidades a serem fornecidas da ração podem ser alteradas conforme o escore corporal do animal, status nutricional, ganho de peso desejado e/ou qualidade do volumoso. Consulte um profissional habilitado.\nPorventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia.\nEm caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança.\nNão fornecer o produto para equídeos ou ovinos.",
      nome_comercial_documental: "BABYKAMP GOLD",
      principal_documental_source_id: "D023",
      produto_id: "P023",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para equídeos ou ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "29c69732e01b1408a58570a3e6cdf21be9f9bcf6b95c183ea95ab1166fc3e449",
    kind: "catalog",
    product: {
      aliases: ["BABYKAMP OVINOS GOLD", "RTPI - Baldinho - BabyKamp Ovinos Gold"],
      bloqueios: [],
      classificacao_documental: "SUPLEMENTO MINERAL PARA MISTURA PARA OVINOS",
      composicao_documental:
        "aditivo antioxidante, monesina sodica, aroma de leite, carbonato de cálcio, caulim, cloreto de potássio, cloreto de sódio (sal comum), cromo orgânico, enxofre ventilado (flor de enxofre), fosfato bicálcico, iodato de cálcio, leveduras, melaço, óxido de magnésio, palatabilizante, selenito de sódio, sulfato de cálcio, sulfato de colbalto, sulfato de manganês, sulfato de zinco, sulfato ferroso, vitamina A, vitamina D3, vitamina E, vitamina K.",
      descricao_documental:
        "Suplemento mineral para mistura, contendo vitaminas, ionóforo e palatabilizante, indicado para potencializar a expressão genética de ovinos, do nascimento até o fim da fase de crescimento, visando otimizar o ganho de peso e eficiência alimentar. Também é indicado para o preparo de ovinos de elite para exposições.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P024_babykamp-ovinos-gold/fontes/D024.doc",
          arquivo_original: "RTPI/RTPI - Baldinho - BabyKamp Ovinos Gold.doc",
          sha256: "82f5257f4f61b0249dddf38460f61670d1c71a7d692822fe4cba1ab28af77194",
          source_id: "D024",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "O produto pode ser administrado aos animais misturado às rações durante sua confecção ou através do método “top dress”, isto é, polvilhando o produto sobre o alimento no cocho. \nPara misturar à ração durante a confecção, utilize entre 2 e 3% na mistura (ou entre 20 e 30 kg do produto por tonelada de ração). Da ração preparada, fornecer entre 350 e 500 gramas para cada 10 kg de peso corporal.\nCaso a opção seja pelo método de polvilhamento sobre a ração, a dose diária por cabeça recomendada é de 1 grama para cada kg de peso corporal.\n\nDOSAGEM RECOMENDADA\n |  | Peso do animal | Quantidade de BABYKAMP OVINOS GOLD |  | 10 kg | 10 g/animal/dia |  | 15 kg | 15 g/animal/dia |  | 20 kg | 20 g/animal/dia |  | 25 kg | 25 g/animal/dia |  | 30 kg | 30 g/animal/dia |  | 35 kg | 35 g/animal/dia |  | \n\nA dosagem, o período e a forma de administração podem ser alterados conforme recomendações de profissional habilitado.\nPorventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia.\nEm caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança.\nNão fornecer o produto para equídeos.",
      nome_comercial_documental: "BABYKAMP OVINOS GOLD",
      principal_documental_source_id: "D024",
      produto_id: "P024",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para equídeos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "1b2a8c4301ea2bcb67d746b407765cfbb71cb5c9f92017634aa1afe6d411a2b9",
    kind: "catalog",
    product: {
      aliases: ["BEEFKAMP GOLD", "RTPI - Baldinho - BeefKamp Gold"],
      bloqueios: [
        {
          descricao:
            "SÓDIO: especificação 'mim' e unidade 'g' preservadas. Confirmar a grafia antes de normalizar.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Baldinho - BeefKamp Gold.doc",
              evidence_id: "D025-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D025",
            },
          ],
          source_id: "D025",
          tipo: "grafia_unidade_especificacao",
        },
        {
          descricao:
            "ENXOFRE: especificação 'mím' e unidade 'g' preservadas. Confirmar a grafia antes de normalizar.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Baldinho - BeefKamp Gold.doc",
              evidence_id: "D025-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D025",
            },
          ],
          source_id: "D025",
          tipo: "grafia_unidade_especificacao",
        },
        {
          descricao:
            "COBALTO: especificação 'mím' e unidade 'mg' preservadas. Confirmar a grafia antes de normalizar.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Baldinho - BeefKamp Gold.doc",
              evidence_id: "D025-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D025",
            },
          ],
          source_id: "D025",
          tipo: "grafia_unidade_especificacao",
        },
        {
          descricao:
            "COBRE: especificação 'mím' e unidade 'mg' preservadas. Confirmar a grafia antes de normalizar.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Baldinho - BeefKamp Gold.doc",
              evidence_id: "D025-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D025",
            },
          ],
          source_id: "D025",
          tipo: "grafia_unidade_especificacao",
        },
        {
          descricao:
            "IODO: especificação 'mím' e unidade 'mg' preservadas. Confirmar a grafia antes de normalizar.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Baldinho - BeefKamp Gold.doc",
              evidence_id: "D025-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D025",
            },
          ],
          source_id: "D025",
          tipo: "grafia_unidade_especificacao",
        },
        {
          descricao:
            "FERRO: especificação 'mím' e unidade 'mg' preservadas. Confirmar a grafia antes de normalizar.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Baldinho - BeefKamp Gold.doc",
              evidence_id: "D025-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D025",
            },
          ],
          source_id: "D025",
          tipo: "grafia_unidade_especificacao",
        },
        {
          descricao:
            "MANGANÊS: especificação 'mím' e unidade 'mg' preservadas. Confirmar a grafia antes de normalizar.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Baldinho - BeefKamp Gold.doc",
              evidence_id: "D025-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D025",
            },
          ],
          source_id: "D025",
          tipo: "grafia_unidade_especificacao",
        },
        {
          descricao:
            "SELÊNIO: especificação 'mím' e unidade 'mg' preservadas. Confirmar a grafia antes de normalizar.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Baldinho - BeefKamp Gold.doc",
              evidence_id: "D025-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D025",
            },
          ],
          source_id: "D025",
          tipo: "grafia_unidade_especificacao",
        },
        {
          descricao:
            "ZINCO: especificação 'mím' e unidade 'mg' preservadas. Confirmar a grafia antes de normalizar.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Baldinho - BeefKamp Gold.doc",
              evidence_id: "D025-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D025",
            },
          ],
          source_id: "D025",
          tipo: "grafia_unidade_especificacao",
        },
        {
          descricao:
            "DL-METIONINA: especificação 'mím' e unidade 'mg' preservadas. Confirmar a grafia antes de normalizar.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Baldinho - BeefKamp Gold.doc",
              evidence_id: "D025-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D025",
            },
          ],
          source_id: "D025",
          tipo: "grafia_unidade_especificacao",
        },
        {
          descricao:
            "L-LISINA: especificação 'mím' e unidade 'mg' preservadas. Confirmar a grafia antes de normalizar.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Baldinho - BeefKamp Gold.doc",
              evidence_id: "D025-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D025",
            },
          ],
          source_id: "D025",
          tipo: "grafia_unidade_especificacao",
        },
        {
          descricao:
            "VITAMINA A: especificação 'mím' e unidade 'U.I./kg' preservadas. Confirmar a grafia antes de normalizar.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Baldinho - BeefKamp Gold.doc",
              evidence_id: "D025-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D025",
            },
          ],
          source_id: "D025",
          tipo: "grafia_unidade_especificacao",
        },
        {
          descricao:
            "VITAMINA D3: especificação 'mím' e unidade 'U.I./kg' preservadas. Confirmar a grafia antes de normalizar.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Baldinho - BeefKamp Gold.doc",
              evidence_id: "D025-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D025",
            },
          ],
          source_id: "D025",
          tipo: "grafia_unidade_especificacao",
        },
        {
          descricao:
            "VITAMINA E: especificação 'mím' e unidade 'U.I./kg' preservadas. Confirmar a grafia antes de normalizar.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Baldinho - BeefKamp Gold.doc",
              evidence_id: "D025-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D025",
            },
          ],
          source_id: "D025",
          tipo: "grafia_unidade_especificacao",
        },
        {
          descricao:
            "ETOXIQUIN: especificação 'mím' e unidade 'mg' preservadas. Confirmar a grafia antes de normalizar.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Baldinho - BeefKamp Gold.doc",
              evidence_id: "D025-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D025",
            },
          ],
          source_id: "D025",
          tipo: "grafia_unidade_especificacao",
        },
        {
          descricao:
            "MONENSINA SÓDICA: especificação 'mím' e unidade 'mg' preservadas. Confirmar a grafia antes de normalizar.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Baldinho - BeefKamp Gold.doc",
              evidence_id: "D025-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D025",
            },
          ],
          source_id: "D025",
          tipo: "grafia_unidade_especificacao",
        },
      ],
      classificacao_documental: "NUCLEO MISTURA PARA BOVINOS DE CORTE",
      composicao_documental:
        "aditivo antioxidante,monesina sódica, carbonato de cálcio, caulim - 10%, cloreto de potássio, cloreto de sódio (sal comum) - 9%, DL-metinina, enxofre ventilado (flor de enxofre), fosfato bicálcico, iodato de cálcio, L-lisina, levedura seca de cana-de-açúcar, melaço, óxido de magnésio, selenito de sódio, sulfato de cálcio, sulfato de colbalto, sulfato de cobre, sulfato de ferro, sulfato de manganês, sulfato de zinco, vitamina A, vitamina D3, vitamina E.",
      descricao_documental:
        "Nulceo mineral para mistura, para uso exclusivo na formulação de rações. Contém macro e microelementos minerais, além de vitaminas, aminácidos e promotor de crescimento e eficiência alimentar (ionóforo). Indicado para bovinos de corte nas fases de acabamento ou terminação, em sistema de confinamento ou semi-confinamento.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P025_beefkamp-gold/fontes/D025.doc",
          arquivo_original: "RTPI/RTPI - Baldinho - BeefKamp Gold.doc",
          sha256: "d1cba8ffb6334144f40a647b749f82678b11179736bf5ed2bb7130cff58d36fa",
          source_id: "D025",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "O núcleo BEEFKAMP GOLD é para uso exclusivo na formulação de rações. Recomenda-se a adição de 10 a 15 kg de BEEFKAMP GOLD por tonelada de ração (isto é, entre 1 e 1,5% de inclusão). Fornecer o produto elaborado calculado na proporção de 1 a 1,5 kg de ração para cada 100 kg de peso corporal.\nÉ desejável que o consumo diário de BEEFKAMP GOLD seja de pelo menos 40 a 50 gramas por cabeça.\nAs recomendações aqui descritas de inclusão de BEEFKAMP GOLD na ração, bem como as de quantidades a serem fornecidas da ração podem ser alteradas conforme o escore corporal do animal, status nutricional, ganho de peso desejado e/ou qualidade do volumoso.\nConsulte um profissional habilitado.\nPorventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a diponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia.\nEm caso de dúvidas, ou para formulações específicas, consulte nosso departamento técnico ou um profissional de sua confiança.\nNão fornecer o produto para equídeos e/ou ovinos.",
      nome_comercial_documental: "BEEFKAMP GOLD",
      principal_documental_source_id: "D025",
      produto_id: "P025",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para equídeos ou ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "8fe67db47b18a3a7b5ad03436abb679290db8aa2731a9071ea661a6ccf8d1ec3",
    kind: "catalog",
    product: {
      aliases: ["CREATINA TURBO", "RTPI - Baldinho - Creatina Turbo"],
      bloqueios: [],
      classificacao_documental: "NÚCLEO PARA EQUINOS",
      composicao_documental:
        "creatina (80%), cloreto de potássio, cloreto de sódio (sal comum), transquelato de selênio, selenito de sódio, cromo aminoácido quelato, L-lisina, DL-metionina, ácido aspártico, ácido glutâmico, alanina, arginina, cisteína, fenilalanina, glicina, histidina, isoleucina, leucina, prolina, serina, tirosina, treonina, triptofano, valina, veículo q.s.p.",
      descricao_documental:
        "Indicado para fabricação de rações destinadas à alimentação de equinos adultos (em trabalho ou atletas).",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P026_creatina-turbo/fontes/D007.doc",
          arquivo_original: "RTPI/Obsoletos/RTPI - Baldinho - Creatina Turbo - at‚ 2015-06-01.doc",
          sha256: "0b06817960f533c51b9d8c87ef649917f9fcf6a1e5dec8a71f4068ca922c5023",
          source_id: "D007",
          versao_papel: "historico_obsoleto",
        },
        {
          arquivo_no_pacote: "produtos/P026_creatina-turbo/fontes/D026.doc",
          arquivo_original: "RTPI/RTPI - Baldinho - Creatina Turbo.doc",
          sha256: "5473fc150b5585afe78e22fdfb26867b85d993566a6bada53c63c6131af9f4cd",
          source_id: "D026",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Misturar o produto às rações durante sua confecção, de forma que cada animal tenha um consumo de CREATINA TURBO conforme o quadro a seguir:\n\nATIVIDADE | QUANTIDADE DE CREATINA TURBO |  | Moderada | 40 g/dia, quando submetidos a treinamentos de explosão |  | Intensa ou Muito Intensa | 120 g/dia por 14 dias, e depois 40 g/dia, quando submetidos a treinamentos de explosão  |  |  | 40 g/dia quando treinados para resistência |  | \nEste produto não substitui o suplemento mineral, devendo este continuar a ser fornecido aos animais.\nA dosagem, o período e a forma de administração podem ser alterados conforme recomendações de profissional habilitado.\nEm caso de dúvidas, consulte nosso departamento técnico ou um profissional habilitado de sua confiança.\nProduto destinado exclusivamente para equinos adultos. Em hipótese alguma deverá ser ingerido por humanos.",
      nome_comercial_documental: "CREATINA TURBO",
      principal_documental_source_id: "D026",
      produto_id: "P026",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este suplemento não substitui o suplemento mineral, devendo este continuar a ser fornecido aos animais. \nProduto destinado exclusivamente para equinos adultos. Em hipótese alguma deverá ser ingerido por humanos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "4ba5809d89c5ee9dbda8e3c85840baf43e47197d665cfdbf0e217ef7720ec12d",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP 130", "RTPI - Mineral Tradicional - Dukamp 130"],
      bloqueios: [
        {
          descricao:
            "O relatório mantém EMBALAGEM ATUAL e NOVA EMBALAGEM com instruções de mistura por categoria diferentes. Identificar o rótulo aplicável ao lote antes de usar as proporções.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Mineral Tradicional - Dukamp 130.doc",
              evidence_id: "D051-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D051",
            },
            {
              arquivo_original: "RTPI/RTPI - Mineral Tradicional - Dukamp 130.doc",
              evidence_id: "D051-S11",
              pagina_pdf_inicio: null,
              secao_numero_original: 11,
              secao_semantica: "Indicação e espécie",
              source_id: "D051",
            },
            {
              arquivo_original: "RTPI/RTPI - Mineral Tradicional - Dukamp 130.doc",
              evidence_id: "D051-S12",
              pagina_pdf_inicio: null,
              secao_numero_original: 12,
              secao_semantica: "Modo de usar",
              source_id: "D051",
            },
          ],
          source_id: "D051",
          tipo: "versao_mistura",
        },
        {
          descricao:
            "FLÚOR: tabela técnica = 1.300 mg; anexo = FLÚOR(máx)1.232mg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Mineral Tradicional - Dukamp 130.doc",
              evidence_id: "D051-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D051",
            },
          ],
          source_id: "D051",
          tipo: "garantia_entre_blocos",
        },
        {
          descricao:
            "O documento conserva mais de um bloco/versão de rótulo. As garantias são mantidas por bloco e não representam uma única tabela liberada.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Mineral Tradicional - Dukamp 130.doc",
              evidence_id: "D051-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D051",
            },
          ],
          source_id: "D051",
          tipo: "multiplos_blocos_de_garantia",
        },
      ],
      classificacao_documental: "SUPLEMENTO MINERAL PARA MISTURA PARA BOVINOS",
      composicao_documental:
        "EMBALAGEM ATUAL: calcário calcítico, fosfato bicálcico - 68,4211%, iodato de cálcio, óxido de magnésio, óxido de zinco, selenito de sódio, sulfato de cobalto, sulfato de cobre, sulfato de ferro, enxofre ventilado (flor de enxofre), monóxido de manganês. \nNOVA EMBALAGEM: carbonato de cálcio, fosfato bicálcico - 72,2222%, iodato de cálcio, óxido de magnésio, sulfato de zinco, selenito de sódio, sulfato de cobalto, sulfato de cobre, sulfato de ferro, enxofre ventilado (flor de enxofre), sulfato de manganês.",
      descricao_documental:
        "EMBALAGEM ATUAL: Suplemento mineral para ser misturado ao sal comum (NaCl), indicado para evitar ou corrigir carências nutricionais e desequilíbrios minerais em bovinos de corte. NOVA EMBALAGEM: Suplemento mineral para ser misturado ao sal comum (NaCl), indicado para bovinos.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P051_dukamp-130/fontes/D051.doc",
          arquivo_original: "RTPI/RTPI - Mineral Tradicional - Dukamp 130.doc",
          sha256: "d7b18c1c00835f1d93e92db2261cf0b668405a310d8f7d26552044b9c939bde8",
          source_id: "D051",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "EMBALAGEM ATUAL: Para animais em gestação e lactação, misturar 2 sacos do produto com 1 saco do sal comum, deixando a livre acesso aos animais. Para animais em crescimento, misturar 1 saco do produto com 1 saco de sal comum, deixando a livre acesso aos animais. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança.\nNOVA EMBALAGEM: Este produto deve ser diluído com sal branco (sal comum). Para bovinos de corte nas fases de acabamento ou terminação, misturar 25 kg de DUKAMP 130 com 25 kg de sal branco. Para animais em crescimento, gestação e lactação, misturar 50 KG de DUKAMP 130 com 25 kg de sal branco. A mistura deverá ser disponibilizada aos animais em cochos cobertos com livre acesso. Recomenda-se o uso de cochos cobertos e com espaço mínimo de 3 a 5 cm por cabeça suplementada. Não fornecer o produto para ovinos. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional habilitado de sua confiança.",
      nome_comercial_documental: "DUKAMP 130",
      principal_documental_source_id: "D051",
      produto_id: "P051",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "f23433b96dfaca9ca96030a3851e02512d38259285c2d8f322b6ab2735d8355b",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP 175", "RTPI - Mineral Tradicional - Dukamp 175"],
      bloqueios: [],
      classificacao_documental: "SUPLEMENTO MINERAL PARA MISTURA PARA BOVINOS",
      composicao_documental:
        "fosfato bicálcico (89,7436%), carbonato de cálcio. óxido de magnésio, enxofre ventilado (flor-de-enxofre), sulfato de cobalto, sulfato de cobre, iodato de cálcio, sulfato de ferro, monóxido de manganês, selenito de sódio, sulfato de zinco",
      descricao_documental:
        "Suplemento mineral para ser misturado ao sal comum (NaCl), indicado para bovinos.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P052_dukamp-175/fontes/D052.doc",
          arquivo_original: "RTPI/RTPI - Mineral Tradicional - Dukamp 175.doc",
          sha256: "6507ef020a8dce684d14e05b5d3e271996105200dd9a993ba6b6680188b88d93",
          source_id: "D052",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Este produto deve ser diluído com sal branco (sal comum), na proporção de 1:1, ou seja, 25 kg de DUKAMP 175 com 25 kg de sal branco. A mistura deverá ser disponibilizada aos animais em cochos cobertos com livre acesso, permitindo espaço mínimo de 3 a 5 cm por cabeça suplementada. Não fornecer o produto para ovinos. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional habilitado de sua confiança.",
      nome_comercial_documental: "DUKAMP 175",
      principal_documental_source_id: "D052",
      produto_id: "P052",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "6efcf5a52457ddd2148ea25306ec14108553b9b06c8c0ded763005cba6885877",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP 40/S", "RTPI - Mineral Linha S - Dukamp 40 S"],
      bloqueios: [],
      classificacao_documental: "SUPLEMENTO MINERAL DE PRONTO USO PARA BOVINOS",
      composicao_documental:
        "fosfato bicálcico, carbonato de cálcio, óxido de magnésio, cloreto de sódio (sal comum) 32%, sulfato de cálcio, sulfato de cobalto, sulfato de cobre, iodato de cálcio, sulfato de ferro, sulfato de manganês, selenito de sódio, sulfato de zinco, calcareo calcitico.",
      descricao_documental:
        "Suplemento mineral de pronto uso indicado bovinos de corte na fase de acabamento ou terminação em pastagens de boa qualidade nutricional.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P038_dukamp-40-s/fontes/D038.doc",
          arquivo_original: "RTPI/RTPI - Mineral Linha S - Dukamp 40 S.doc",
          sha256: "4a5ca9e0f8a2140a4a0ab60a846c37e25c6b6cfd2b8dec1669c5df84782883cc",
          source_id: "D038",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "DUKAMP 40/S já é pronto para uso, bastando despejar o produto em cochos e deixar à disposição permanente dos animais. Preferencialmente, recomenda-se o uso de cochos cobertos e com espaço mínimo de 3 a 5 cm por cabeça suplementada. Não fornecer o produto para ovinos. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP 40/S",
      principal_documental_source_id: "D038",
      produto_id: "P038",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "71e07fda3548f670144f1b10e61be86e923ec48883c432121ed24c870b8827da",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP 60", "RTPI - Mineral Tradicional - Dukamp 60"],
      bloqueios: [
        {
          descricao:
            "CÁLCIO: tabela técnica = 90 / 390 g; anexo = CÁLCIO(mín)190g. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Mineral Tradicional - Dukamp 60.doc",
              evidence_id: "D053-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D053",
            },
          ],
          source_id: "D053",
          tipo: "garantia_entre_blocos",
        },
        {
          descricao:
            "FLÚOR: tabela técnica = 600 mg; anexo = FLÚOR(máx)595mg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Mineral Tradicional - Dukamp 60.doc",
              evidence_id: "D053-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D053",
            },
          ],
          source_id: "D053",
          tipo: "garantia_entre_blocos",
        },
        {
          descricao:
            "O documento conserva mais de um bloco/versão de rótulo. As garantias são mantidas por bloco e não representam uma única tabela liberada.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Mineral Tradicional - Dukamp 60.doc",
              evidence_id: "D053-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D053",
            },
          ],
          source_id: "D053",
          tipo: "multiplos_blocos_de_garantia",
        },
      ],
      classificacao_documental: "SUPLEMENTO MINERAL DE PRONTO USO PARA BOVINOS",
      composicao_documental:
        "EMBALAGEM ATUAL: monóxido de manganês, óxido de magnésio, sulfato ferroso, iodato de cálcio, enxofre ventilado (flor de enxofre), óxido de zinco, sulfato de cobre,sulfato de cobalto, selenito de sódio, cloreto de sódio (sal comum), fosfato bicálcico, calcário calcítico. \nNOVA EMBALAGEM: sulfato de manganês, óxido de magnésio, sulfato ferroso, iodato de cálcio, enxofre ventilado (flor de enxofre), sulfato de zinco, sulfato de cobre,sulfato de cobalto, selenito de sódio, cloreto de sódio (sal comum), fosfato bicálcico, calcário calcítico.",
      descricao_documental:
        "EMBALAGEM ATUAL: Produto indicado para evitar ou corrigir carências e deficiências minerais em bovinos de corte na fase de acabamento ou terminação em pastagem de média qualidade nutricional. NOVA EMBALAGEM: Suplemento mineral de pronto uso indicado para bovinos de corte na fase de acabamento ou terminação em pastagens de média qualidade nutricional",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P053_dukamp-60/fontes/D053.doc",
          arquivo_original: "RTPI/RTPI - Mineral Tradicional - Dukamp 60.doc",
          sha256: "981ccbdd3248d9f5906fe1d67bfdecaadb6d73a19affd73b237b4dababbc83cd",
          source_id: "D053",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "EMBALAGEM ATUAL: O Dukamp 60 já está pronto para uso, bastando despejar o produto em cochos e deixar a disposição permanente dos animais. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança.\nNOVA EMBALAGEM: DUKAMP 60 já é pronto para uso, bastando despejar o produto em cochos e deixar à disposição permanente dos animais. Preferencialmente, recomenda-se o uso de cochos cobertos e com espaço mínimo de 3 a 5 cm por cabeça suplementada. Não fornecer o produto para ovinos. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP 60",
      principal_documental_source_id: "D053",
      produto_id: "P053",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "26ac2ab75010df8b4889a798383ebb72aec526803be13235a64ebdc8bd4d7eee",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP 60/S", "RTPI - Mineral Linha S - Dukamp 60 S"],
      bloqueios: [],
      classificacao_documental: "SUPLEMENTO MINERAL DE PRONTO USO PARA BOVINOS",
      composicao_documental:
        "fosfato bicálcico, carbonato de cálcio, óxido de magnésio, cloreto de sódio (sal comum) 32%, sulfato de cálcio, sulfato de cobalto, sulfato de cobre, iodato de cálcio, sulfato de ferro, sulfato de manganês, selenito de sódio, sulfato de zinco, calcareo calcitico.",
      descricao_documental:
        "Suplemento mineral de pronto uso indicado para bovinos de corte na fase de acabamento ou terminação em pastagens de média qualidade nutricional.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P039_dukamp-60-s/fontes/D039.doc",
          arquivo_original: "RTPI/RTPI - Mineral Linha S - Dukamp 60 S.doc",
          sha256: "e6fbf82bed0d22172f59753130b991dfdd7b77a7cfcd3d6094bae8c75812448f",
          source_id: "D039",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "DUKAMP 60/S já é pronto para uso, bastando despejar o produto em cochos e deixar à disposição permanente dos animais. Preferencialmente, recomenda-se o uso de cochos cobertos e com espaço mínimo de 3 a 5 cm por cabeça suplementada. Não fornecer o produto para ovinos. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP 60/S",
      principal_documental_source_id: "D039",
      produto_id: "P039",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "b8e2c58f8211969381bbc411ad12676adcaf05424f61112f4422a7f177b7cc69",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP 65", "RTPI - Mineral Tradicional - Dukamp 65"],
      bloqueios: [
        {
          descricao:
            "FLÚOR: tabela técnica = 650 mg; anexo = FLÚOR(máx)616mg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Mineral Tradicional - Dukamp 65.doc",
              evidence_id: "D054-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D054",
            },
          ],
          source_id: "D054",
          tipo: "garantia_entre_blocos",
        },
        {
          descricao:
            "O documento conserva mais de um bloco/versão de rótulo. As garantias são mantidas por bloco e não representam uma única tabela liberada.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Mineral Tradicional - Dukamp 65.doc",
              evidence_id: "D054-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D054",
            },
          ],
          source_id: "D054",
          tipo: "multiplos_blocos_de_garantia",
        },
      ],
      classificacao_documental: "SUPLEMENTO MINERAL DE PRONTO USO PARA BOVINOS",
      composicao_documental:
        "EMBALAGEM ATUAL: calcário calcítico, fosfato bicálcico, iodato de cálcio, óxido de magnésio, óxido de zinco, selenito de sódio, sulfato de cobalto, sulfato de cobre, sulfato de ferro, cloreto de sódio (sal comum), enxofre ventilado (flor de enxofre), veículo q.s.p., monóxido de manganês.\nNOVA EMBALAGEM: calcário calcítico, fosfato bicálcico, iodato de cálcio, óxido de magnésio, sulfato de zinco, selenito de sódio, sulfato de cobalto, sulfato de cobre, sulfato de ferro, cloreto de sódio (sal comum), enxofre ventilado (flor de enxofre), sulfato de manganês.",
      descricao_documental:
        "EMBALAGEM ATUAL: Produto indicado para evitar ou corrigir carências e deficiências minerais em bovinos de corte na fase de acabamento ou terminação em pastagens de média qualidade nutricional. NOVA EMBALAGEM: Suplemento mineral de pronto uso indicado para bovinos de corte na fase de acabamento ou terminação em pastagens de média qualidade nutricional.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P054_dukamp-65/fontes/D054.doc",
          arquivo_original: "RTPI/RTPI - Mineral Tradicional - Dukamp 65.doc",
          sha256: "825dfeaef8c2f47198bce5c5d134f71de19410e4af16e433c296795ee45ed36a",
          source_id: "D054",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "EMBALAGEM ATUAL: O Dukamp 65 já está pronto para uso, bastando despejar o produto em cochos e deixar a disposição permanente dos animais. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança.\nNOVA EMBALAGEM: DUKAMP 65 já é pronto para uso, bastando despejar o produto em cochos e deixar à disposição permanente dos animais. Preferencialmente, recomenda-se o uso de cochos cobertos e com espaço mínimo de 3 a 5 cm por cabeça suplementada. Não fornecer o produto para ovinos. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP 65",
      principal_documental_source_id: "D054",
      produto_id: "P054",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "b2aba8ee732bfc4228c062506626d48440e3781fd4cbfa4d5c0f57e470145846",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP 65/S", "RTPI - Mineral Linha S - Dukamp 65 S"],
      bloqueios: [],
      classificacao_documental: "SUPLEMENTO MINERAL DE PRONTO USO PARA BOVINOS DE CORTE",
      composicao_documental:
        "fosfato bicálcico, carbonato de cálcio, óxido de magnésio, cloreto de sódio (sal comum) 32%, sulfato de cálcio, sulfato de cobalto, sulfato de cobre, iodato de cálcio, sulfato de ferro, sulfato de manganês, selenito de sódio, sulfato de zinco, calcareo calcitico.",
      descricao_documental:
        "Suplemento mineral de pronto uso indicado para bovinos de corte na fase de acabamento ou terminação em pastagens de média qualidade nutricional.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P040_dukamp-65-s/fontes/D040.doc",
          arquivo_original: "RTPI/RTPI - Mineral Linha S - Dukamp 65 S.doc",
          sha256: "f3a22c94852e8d682ea5b8da2399f407c1e354bb3fcd7daba5cc6b77ca165848",
          source_id: "D040",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "DUKAMP 65/S já é pronto para uso, bastando despejar o produto em cochos e deixar à disposição permanente dos animais. Preferencialmente, recomenda-se o uso de cochos cobertos e com espaço mínimo de 3 a 5 cm por cabeça suplementada. Não fornecer o produto para ovinos. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP 65/S",
      principal_documental_source_id: "D040",
      produto_id: "P040",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "bcb8e625d1e4ac51cfae250c8a6ee64a7e9a4fe474c97cf05537686ee48d8957",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP 80", "RTPI - Mineral Tradicional - Dukamp 80"],
      bloqueios: [
        {
          descricao:
            "FLÚOR: tabela técnica = 800 mg; anexo = FLÚOR(máx)758mg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Mineral Tradicional - Dukamp 80.doc",
              evidence_id: "D055-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D055",
            },
          ],
          source_id: "D055",
          tipo: "garantia_entre_blocos",
        },
        {
          descricao:
            "O documento conserva mais de um bloco/versão de rótulo. As garantias são mantidas por bloco e não representam uma única tabela liberada.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Mineral Tradicional - Dukamp 80.doc",
              evidence_id: "D055-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D055",
            },
          ],
          source_id: "D055",
          tipo: "multiplos_blocos_de_garantia",
        },
      ],
      classificacao_documental: "SUPLEMENTO MINERAL DE PRONTO USO PARA BOVINOS",
      composicao_documental:
        "EMBALAGEM ATUAL: calcário calcítico, fosfato bicálcico, iodato de cálcio, óxido de magnésio, óxido de zinco, selenito de sódio, sulfato de cobalto, sulfato de cobre, sulfato de ferro, cloreto de sódio (sal comum), enxofre ventilado (flor de enxofre), monóxido de manganês.\nNOVA EMBALAGEM: calcário calcítico, fosfato bicálcico, iodato de cálcio, óxido de magnésio, sulfato de zinco, selenito de sódio, sulfato de cobalto, sulfato de cobre, sulfato de ferro, cloreto de sódio (sal comum), enxofre ventilado (flor de enxofre), sulfato de manganês.",
      descricao_documental:
        "EMBALAGEM ATUAL: Produto indicado para evitar ou corrigir carências e deficiências minerais em bovinos nas fases de cria e recria mantidos em áreas de média fertilidade com pastagens de média qualidade nutricional. NOVA EMBALAGEM: Suplemento mineral de pronto uso indicado para bovinos de corte na fase de cria e recria em pastagens de média qualidade nutricional.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P055_dukamp-80/fontes/D055.doc",
          arquivo_original: "RTPI/RTPI - Mineral Tradicional - Dukamp 80.doc",
          sha256: "5794c8b7f83c78016eef0c1c68bdbdf15c2175153978aee8fe4feec40c4b32c7",
          source_id: "D055",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "EMBALAGEM ATUAL: O Dukamp 80 já está pronto para uso, bastando despejar o produto em cochos e deixar a disposição permanente dos animais. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança.\nNOVA EMBALAGEM: DUKAMP 80 já é pronto para uso, bastando despejar o produto em cochos e deixar à disposição permanente dos animais. Preferencialmente, recomenda-se o uso de cochos cobertos e com espaço mínimo de 3 a 5 cm por cabeça suplementada. Não fornecer o produto para ovinos. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP 80",
      principal_documental_source_id: "D055",
      produto_id: "P055",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "fc97d45896dbd7e98b54a93c56ecfddd72774c9ed399e501603368e6f8bbdb1c",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP 80/S", "RTPI - Mineral Linha S - Dukamp 80 S"],
      bloqueios: [],
      classificacao_documental: "SUPLEMENTO MINERAL DE PRONTO USO PARA BOVINOS DE CORTE",
      composicao_documental:
        "fosfato bicálcico, calcário calcítico, carbonato de cálcio, óxido de magnésio, cloreto de sódio (sal comum) 32%, sulfato de cálcio, sulfato de cobalto, sulfato de cobre, iodato de cálcio, sulfato de ferro, sulfato de manganês, selenito de sódio, sulfato de zinco.",
      descricao_documental:
        "Suplemento mineral de pronto uso indicado para bovinos de corte nas fases de cria e/ou recria mantidos em áreas de média fertilidade com pastagens de média qualidade nutricional.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P041_dukamp-80-s/fontes/D041.doc",
          arquivo_original: "RTPI/RTPI - Mineral Linha S - Dukamp 80 S.doc",
          sha256: "f0f86433d73412d16cee43310c90d930dfce66ba633c2e854b33838b14ca4aa6",
          source_id: "D041",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "DUKAMP 80/S já é pronto para uso, bastando despejar o produto em cochos e deixar à disposição permanente dos animais. Preferencialmente, recomenda-se o uso de cochos cobertos e com espaço mínimo de 3 a 5 cm por cabeça suplementada. Não fornecer o produto para ovinos. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP 80/S",
      principal_documental_source_id: "D041",
      produto_id: "P041",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "8723787223ac6acf3a329380f3db062f2721459ff5cd0420e3256050ce54e33b",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP 87/S", "RTPI - Mineral Linha S - Dukamp 87 S"],
      bloqueios: [],
      classificacao_documental: "SUPLEMENTO MINERAL DE PRONTO USO PARA BOVINOS DE CORTE",
      composicao_documental:
        "fosfato bicálcico, calcário calcítico, carbonato de cálcio, óxido de magnésio, cloreto de sódio (sal comum) 32%, sulfato de cálcio, sulfato de cobalto, sulfato de cobre, iodato de cálcio, sulfato de ferro, sulfato de manganês, selenito de sódio, sulfato de zinco.",
      descricao_documental:
        "Suplemento mineral de pronto uso indicado para bovinos de corte nas fases de cria, recria e/ou engorda mantidos em áreas de média fertilidade com pastagens de média qualidade nutricional.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P042_dukamp-87-s/fontes/D042.doc",
          arquivo_original: "RTPI/RTPI - Mineral Linha S - Dukamp 87 S.doc",
          sha256: "12b3c457fe7dcb1ad34016181eff19e6fd676fd04bb596ae9c6497134def9630",
          source_id: "D042",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "DUKAMP 87/s já é pronto para uso, bastando despejar o produto em cochos e deixar à disposição permanente dos animais. Preferencialmente, recomenda-se o uso de cochos cobertos e com espaço mínimo de 3 a 5 cm por cabeça suplementada. Não fornecer o produto para ovinos. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP 87/S",
      principal_documental_source_id: "D042",
      produto_id: "P042",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "ffd29dff209337a4d112abfb316e6bb54ceeb6d5ef7282d99513ebdc4869a0bf",
    kind: "catalog",
    product: {
      aliases: [
        "DUKAMP ADITIVADO",
        "RTPI - Mineral Linha  - Dukamp Reprodução Aditivado IATF premium",
      ],
      bloqueios: [
        {
          descricao:
            "O nome do arquivo e o modo de usar mencionam Reprodução Aditivado IATF Premium, mas a designação é DUKAMP ADITIVADO e a indicação é acabamento/terminação. O relatório não demonstra aumento da taxa de prenhez ou eficácia em IATF. Confirmar identidade e indicação vigente.",
          referencias: [
            {
              arquivo_original:
                "RTPI/RTPI - Mineral Linha  - Dukamp Reprodução Aditivado IATF premium.doc",
              evidence_id: "D037-S02",
              pagina_pdf_inicio: null,
              secao_numero_original: 2,
              secao_semantica: "Nome comercial",
              source_id: "D037",
            },
            {
              arquivo_original:
                "RTPI/RTPI - Mineral Linha  - Dukamp Reprodução Aditivado IATF premium.doc",
              evidence_id: "D037-S11",
              pagina_pdf_inicio: null,
              secao_numero_original: 11,
              secao_semantica: "Indicação e espécie",
              source_id: "D037",
            },
            {
              arquivo_original:
                "RTPI/RTPI - Mineral Linha  - Dukamp Reprodução Aditivado IATF premium.doc",
              evidence_id: "D037-S12",
              pagina_pdf_inicio: null,
              secao_numero_original: 12,
              secao_semantica: "Modo de usar",
              source_id: "D037",
            },
          ],
          source_id: "D037",
          tipo: "identidade_indicacao",
        },
      ],
      classificacao_documental: "SUPLEMENTO MINERAL PROTEICO DE PRONTO USO PARA BOVINOS",
      composicao_documental:
        "fosfato bicálcico, carbonato de cálcio, óxido de magnésio, cloreto de sódio (sal comum) 32%, sulfato de cálcio, sulfato de cobalto, sulfato de cobre, iodato de cálcio, sulfato de ferro, sulfato de manganês, selenito de sódio, sulfato de zinco, calcareo calcitico,milho moido, farelo de trigo, farelo de soja, salinomicina e ureia, availa cromo.",
      descricao_documental:
        "Suplemento mineral proteico de pronto uso indicado bovinos de corte na fase de acabamento ou terminação em pastagens de boa qualidade nutricional.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P037_dukamp-aditivado/fontes/D037.doc",
          arquivo_original:
            "RTPI/RTPI - Mineral Linha  - Dukamp Reprodução Aditivado IATF premium.doc",
          sha256: "1c55fa37f3d62f9afc625139e0adbd72655191fcc6819505404e9b97e4fce3fa",
          source_id: "D037",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "DUKAMP REPRODUÇÃO ADITIVADO IATF PREMIUM já é pronto para uso, bastando despejar o produto em cochos e deixar à disposição permanente dos animais. Preferencialmente, recomenda-se o uso de cochos cobertos e com espaço mínimo de 3 a 5 cm por cabeça suplementada. Não fornecer o produto para ovinos. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP ADITIVADO",
      principal_documental_source_id: "D037",
      produto_id: "P037",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "2ee5022c4ebdce713e8c0e38aa53df257fc239fe5d55836cb4f3d2b447fc370a",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP ADITIVADO GOLD", "RTPI - Proteinados  -  Dukamp Aditivado Gold"],
      bloqueios: [],
      classificacao_documental: "SUPLEMENTO MINERAL PROTEICO DE PRONTO USO PARA BOVINOS",
      composicao_documental:
        "fosfato bicálcico, fosfato monoamonico, carbonato de cálcio, óxido de magnésio, cloreto de sódio (sal comum) 32%, sulfato de cálcio, sulfato de cobalto, sulfato de cobre, iodato de cálcio, sulfato de ferro, sulfato de manganês, selenito de sódio, sulfato de zinco, calcareo calcitico,milho moido, farelo de trigo, farelo de soja, salinomicina e ureia.",
      descricao_documental:
        "Suplemento mineral proteico de pronto uso indicado bovinos de corte na fase de , recria e engorda em pastagens de boa qualidade nutricional.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P073_dukamp-aditivado-gold/fontes/D073.doc",
          arquivo_original: "RTPI/RTPI - Proteinados  -  Dukamp Aditivado Gold.doc",
          sha256: "b895366778d3556ed378def0210f39d97444d2b928cf8e1a796cb5034e75557a",
          source_id: "D073",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "DUKAMP ADITIVADO GOLD já é pronto para uso, bastando despejar o produto em cochos e deixar à disposição permanente dos animais. Preferencialmente, recomenda-se o uso de cochos cobertos e com espaço mínimo de 3 a 5 cm por cabeça suplementada. Não fornecer o produto para ovinos. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP ADITIVADO GOLD",
      principal_documental_source_id: "D073",
      produto_id: "P073",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "49d9992c71b97676b6608da4ae29fcee973aa946ed7e9829d7710d63f43b06ac",
    kind: "catalog",
    product: {
      aliases: [
        "DUKAMP ADITIVADO PREMIUM 50",
        "RTPI - Proteinados  -  Dukamp Aditivado Premium 50",
      ],
      bloqueios: [
        {
          descricao:
            "A designação é DUKAMP ADITIVADO PREMIUM 50; o modo de usar se refere a DUKAMP ADITIVADO. Confirmar se a instrução se aplica à variante Premium 50.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Proteinados  -  Dukamp Aditivado Premium 50.doc",
              evidence_id: "D074-S02",
              pagina_pdf_inicio: null,
              secao_numero_original: 2,
              secao_semantica: "Nome comercial",
              source_id: "D074",
            },
            {
              arquivo_original: "RTPI/RTPI - Proteinados  -  Dukamp Aditivado Premium 50.doc",
              evidence_id: "D074-S12",
              pagina_pdf_inicio: null,
              secao_numero_original: 12,
              secao_semantica: "Modo de usar",
              source_id: "D074",
            },
          ],
          source_id: "D074",
          tipo: "identidade",
        },
      ],
      classificacao_documental: "SUPLEMENTO MINERAL PROTEICO DE PRONTO USO PARA BOVINOS",
      composicao_documental:
        "fosfato bicálcico, fosfato monoamonico, carbonato de cálcio, óxido de magnésio, cloreto de sódio (sal comum) 32%, sulfato de cálcio, sulfato de cobalto, sulfato de cobre, iodato de cálcio, sulfato de ferro, sulfato de manganês, selenito de sódio, sulfato de zinco, calcareo calcitico,milho moido, farelo de trigo, farelo de soja, salinomicina e ureia.",
      descricao_documental:
        "Suplemento mineral proteico de pronto uso indicado bovinos de corte na fase de cria, recia e engorda em pastagens de boa qualidade nutricional.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P074_dukamp-aditivado-premium-50/fontes/D074.doc",
          arquivo_original: "RTPI/RTPI - Proteinados  -  Dukamp Aditivado Premium 50.doc",
          sha256: "e200e7119576a04bf4a87060fc2842478202fdcb42c259e69f1e25da581e9c8d",
          source_id: "D074",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "DUKAMP ADITIVADO já é pronto para uso, bastando despejar o produto em cochos e deixar à disposição permanente dos animais. Preferencialmente, recomenda-se o uso de cochos cobertos e com espaço mínimo de 3 a 5 cm por cabeça suplementada. Não fornecer o produto para ovinos. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP ADITIVADO PREMIUM 50",
      principal_documental_source_id: "D074",
      produto_id: "P074",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "8f9c66cd9c0f078b7a82f9f1d0eaa25318c80d76470639142cc866f53fa12277",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP ÁGUAS PREMIUM", "RTPI - Ração Corte - DK   Águas  Premium"],
      bloqueios: [],
      classificacao_documental: "RAÇÃO PARA BOVINOS DE CORTE",
      composicao_documental:
        "farelo de soja, farelo de algodão, polpa cítrica, farelo de trigo, fosfato bicálcico, carbonato de cálcio, cloreto de sódio (sal comum), milho integral moído, premix mineral.\nProduto poderá conter milho1,2,4,5, soja1,2,3,4 ou algodão1,2,4,5,6 transgênicos.\nEspécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes;  5- Zea mays; 6- Streptomyces hygroscopicus.",
      descricao_documental:
        "Ração de baixo consumo para engorda de bovinos de corte semi confinados ou suplementados a campo, no período das águas e/ou primavera.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P016_dukamp-aguas-premium/fontes/D016.doc",
          arquivo_original:
            "RTPI/Produtos mais Vendidos/RTPI - Ração Corte - DK   Águas  Premium.doc",
          sha256: "f575b36b7bbc4a79c43ddb483ba9d4010740bf6b563886ee8ed8ef69d9fb0e34",
          source_id: "D016",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer entre 0,3 a 0,5% do peso vivo em ração diariamente, em doses de 1 a 1,5 kg por cabeça por dia, dependendo da qualidade do volumoso, estado corporal dos animais, estágio de desenvolvimento e do desempenho esperado. Como o produto contém sal comum em sua fórmula, espera-se que a ingestão fique distribuída durante o dia, não sendo necessário fracionar o fornecimento dessa ração em mais de um trato diário. Para  adaptar os animais ao uso do produto, iniciar fornecendo quantidades crescentes até atingir a quantia recomendada dentro de 10 dias, substituindo completamente o suplemento mineral ou o sal proteinado convencional. Espaçamento de cocho necessário: entre 15 e 30 cm por cabeça suplementada. Não fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia.",
      nome_comercial_documental: "DUKAMP ÁGUAS PREMIUM",
      principal_documental_source_id: "D016",
      produto_id: "P016",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Não fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "afca0b96836e589e99703ef578bd8e1aa42f79c7dc122e0b7bbe7ad86fe738a9",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP BR FIELD LEMOS", "RTPI - Proteinados - Dukamp BR Field Lemos"],
      bloqueios: [
        {
          descricao:
            "O protocolo de adaptação cita Dukamp Protéico Águas dentro do relatório BR Field Lemos. Confirmar sua aplicação à variante.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Proteinados - Dukamp BR Field Lemos.doc",
              evidence_id: "D075-S02",
              pagina_pdf_inicio: null,
              secao_numero_original: 2,
              secao_semantica: "Nome comercial",
              source_id: "D075",
            },
            {
              arquivo_original: "RTPI/RTPI - Proteinados - Dukamp BR Field Lemos.doc",
              evidence_id: "D075-S12",
              pagina_pdf_inicio: null,
              secao_numero_original: 12,
              secao_semantica: "Modo de usar",
              source_id: "D075",
            },
          ],
          source_id: "D075",
          tipo: "identidade_adaptacao",
        },
        {
          descricao:
            "O intervalo documental de 10 a 500 g/100 kg é muito amplo. Foi preservado, sem correção presumida. Pedir ao responsável técnico a faixa aplicável e não selecionar dose automaticamente.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Proteinados - Dukamp BR Field Lemos.doc",
              evidence_id: "D075-S12",
              pagina_pdf_inicio: null,
              secao_numero_original: 12,
              secao_semantica: "Modo de usar",
              source_id: "D075",
            },
          ],
          source_id: "D075",
          tipo: "consumo_amplo",
        },
      ],
      classificacao_documental: "SUPLEMENTO MINERAL PROTÉICO DE PRONTO USO PARA BOVINOS DE CORTE",
      composicao_documental:
        "farelo de soja,farelo de amendoim, levedura seca de cana, milho integral moído, farelo de algodão, carbonato de cálcio, cloreto de sódio (sal comum) - 25%, fosfato bicálcico, uréia pecuária, premix mineral, farelo de trigo. \nProduto poderá conter milho1,2,4,5, soja1,2,3,4 ou algodão1,2,4,5,6 transgênicos.\nEspécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes;  5- Zea mays; 6- Streptomyces hygroscopicus.",
      descricao_documental:
        "Produto pronto para uso, indicado para suplementação mineral protéica de bovinos de corte acima de 4 meses de idade, nas fases de cria, recria e engorda, sob pastagens, na estação chuvosa do ano.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P075_dukamp-br-field-lemos/fontes/D075.doc",
          arquivo_original: "RTPI/RTPI - Proteinados - Dukamp BR Field Lemos.doc",
          sha256: "fdfd59e0a7504f5ea2c88f5e8f943d84cb6908fed1f3abeb520ddadf81abd2e6",
          source_id: "D075",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Dukamp BR Field Lemos já vem pronto para uso bastando despejar o produto em cochos e deixar à disposição permanente dos animais. Este produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. O uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. Não fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. Recomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que de baixa qualidade. Não fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. Também não fornecer o produto para eqüídeos, ovinos e/ou bovinos leiteiros. Para adaptação dos animais ao início do uso de suplementos contendo uréia, é recomendado misturar o produto com sal branco ou um suplemento mineral qualquer na proporção de 1:2 na primeira semana, misturar na proporção de 2:1 na segunda semana e usar o produto Dukamp Protéico Águas puro a partir da terceira semana. Consumo esperado de 10 a 500 gramas do produto para cada 100 kg de peso corporal (média de 100 gramas para cada 100 kg de peso corporal), desde que atendidas as especificações de manejo recomendadas. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. Em caso de dúvidas ou intoxicações, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP BR FIELD LEMOS",
      principal_documental_source_id: "D075",
      produto_id: "P075",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. \nO uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. \nNão fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. \nManter boa disponibilidade de pasto, mesmo que de baixa qualidade. \nNão fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. \nTambém não fornecer o produto para eqüídeos, ovinos e/ou bovinos leiteiros.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "df1eaf73b5c5d60fdca04ff899c9923499af3bed5a6bfeefe770963e8cf9a48c",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP CONCENTRADO 130", "RTPI - Mineral Tradicional - Dukamp Concentrado 130"],
      bloqueios: [
        {
          descricao:
            "O documento conserva mais de um bloco/versão de rótulo. As garantias são mantidas por bloco e não representam uma única tabela liberada.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Mineral Tradicional - Dukamp Concentrado 130.doc",
              evidence_id: "D056-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D056",
            },
          ],
          source_id: "D056",
          tipo: "multiplos_blocos_de_garantia",
        },
      ],
      classificacao_documental: "SUPLEMENTO MINERAL PARA MISTURA",
      composicao_documental:
        "enxofre ventilado (flor-de-enxofre), óxido de magnésio, monóxido de manganês, óxido de zinco, sulfato de ferro, sulfato de cobre, sulfato de cobalto, iodato de cálcio, selenito de sódio, fosfato bicálcico (68,4211%), calcário calcítico.",
      descricao_documental:
        "Suplemento mineral para ser misturado ao sal comum (NaCl), indicado para bovinos.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P056_dukamp-concentrado-130/fontes/D056.doc",
          arquivo_original: "RTPI/RTPI - Mineral Tradicional - Dukamp Concentrado 130.doc",
          sha256: "df80520024347c6871ce60e3c8f4607ee4259095f8dbad3eeeadf433ff5983e8",
          source_id: "D056",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Este produto deve ser diluído com cloreto de sódio (sal comum) na proporção de 2:3 para bovinos em fase de acabamento ou terminação. Para animais em gestação e lactação, misturar 2 sacos de Dukamp Concentrado 130 com 1 saco de sal comum. Já para animais em crescimento, misturar com sal comum na proporção de 1:1. Após misturar, distribuir em cochos, permitindo acesso permanente dos animais. Recomenda-se o uso de cochos cobertos e com espaço mínimo de 3 a 5 cm por cabeça suplementada. Não fornecer o produto para ovinos. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP CONCENTRADO 130",
      principal_documental_source_id: "D056",
      produto_id: "P056",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "b81db6ea145ac1d36182061a6f22a40f77d1cf231128c5eb77ae4af4d8b5aee2",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP CONCENTRADO 160", "RTPI - Mineral Tradicional - Dukamp Concentrado 160"],
      bloqueios: [
        {
          descricao:
            "O relatório do DUKAMP CONCENTRADO 160 cita 'Dukamp Concentrado 130' no modo de usar para gestação/lactação. Confirmar a fórmula e proporção específicas do 160.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Mineral Tradicional - Dukamp Concentrado 160.doc",
              evidence_id: "D057-S02",
              pagina_pdf_inicio: null,
              secao_numero_original: 2,
              secao_semantica: "Nome comercial",
              source_id: "D057",
            },
            {
              arquivo_original: "RTPI/RTPI - Mineral Tradicional - Dukamp Concentrado 160.doc",
              evidence_id: "D057-S12",
              pagina_pdf_inicio: null,
              secao_numero_original: 12,
              secao_semantica: "Modo de usar",
              source_id: "D057",
            },
          ],
          source_id: "D057",
          tipo: "identidade_mistura",
        },
        {
          descricao:
            "IODO: tabela técnica = 150 mg; anexo = IODO(mín)155mg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Mineral Tradicional - Dukamp Concentrado 160.doc",
              evidence_id: "D057-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D057",
            },
          ],
          source_id: "D057",
          tipo: "garantia_entre_blocos",
        },
        {
          descricao:
            "O documento conserva mais de um bloco/versão de rótulo. As garantias são mantidas por bloco e não representam uma única tabela liberada.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Mineral Tradicional - Dukamp Concentrado 160.doc",
              evidence_id: "D057-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D057",
            },
          ],
          source_id: "D057",
          tipo: "multiplos_blocos_de_garantia",
        },
      ],
      classificacao_documental: "SUPLEMENTO MINERAL PARA MISTURA",
      composicao_documental:
        "enxofre ventilado (flor-de-enxofre), óxido de magnésio, monóxido de manganês, óxido de zinco, sulfato de ferro, sulfato de cobre, sulfato de cobalto, iodato de cálcio, selenito de sódio, fosfato bicálcico (68,4211%), calcário calcítico.",
      descricao_documental:
        "Suplemento mineral para ser misturado ao sal comum (NaCl), indicado para bovinos.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P057_dukamp-concentrado-160/fontes/D057.doc",
          arquivo_original: "RTPI/RTPI - Mineral Tradicional - Dukamp Concentrado 160.doc",
          sha256: "3ae4435b93c6c2b2137023c13e6e4f4a361c3153bc502321d991976a9e92c5d3",
          source_id: "D057",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Este produto deve ser diluído com cloreto de sódio (sal comum) na proporção de 2:3 para bovinos em fase de acabamento ou terminação. Para animais em gestação e lactação, misturar 2 sacos de Dukamp Concentrado 130 com 1 saco de sal comum. Já para animais em crescimento, misturar com sal comum na proporção de 1:1. Após misturar, distribuir em cochos, permitindo acesso permanente dos animais. Recomenda-se o uso de cochos cobertos e com espaço mínimo de 3 a 5 cm por cabeça suplementada. Não fornecer o produto para ovinos. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP CONCENTRADO 160",
      principal_documental_source_id: "D057",
      produto_id: "P057",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "e51165bed55748f4dd0d65a208a8b387711a197405eb9dd7234e3bf511243252",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP CONCENTRADO CONFINAMENTO 40", "RTPI - Concentrado - DK Conc. Conf. 40"],
      bloqueios: [],
      classificacao_documental: "CONCENTRADO",
      composicao_documental:
        "Farelo de soja, farelo de algodão, farelo de trigo, fosfato bicálcico, carbonato de cálcio, uréia pecuária, monensima sodica, premix mineral vitamínico. Produto poderá conter milho (1,2,4,5), soja (1,2,3,4) ou algodão (1,2,4,5,6) transgênicos. Espécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes; 5- Zea mays; 6- Streptomyces hygroscopicus.",
      descricao_documental:
        "Concentrado para manufatura de rações destinadas à engorda de bovinos de corte em confinamento, semi-confinamento ou suplementados a campo.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P032_dukamp-concentrado-confinamento-40/fontes/D032.doc",
          arquivo_original: "RTPI/RTPI - Concentrado - DK Conc. Conf. 40.doc",
          sha256: "7d899b4a1b882c5315c19d064bf0b31240dc72626fee961830cbd2f38878cdca",
          source_id: "D032",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Misturar 20 kg de Dukamp Concentrado Confinamento 40 com 80 kg de milho ou sorgo moídos, compondo-se assim uma ração. Fornecer entre 1 a 1,5% do peso vivo em ração, dependendo da qualidade do volumoso, estado corporal dos animais, estágio de desenvolvimento e do desempenho esperado. Fracionar o fornecimento em pelo menos dois tratos diários. Este produto contém uréia e, portanto, deve ser fornecido em cochos cobertos e/ou que evitem acúmulo de água. O uso de uréia adicional é contraindicado, salvo quando prescrito por profissional habilitado. Não fornecer este produto para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos e debilitados. Para adaptação dos animais à uréia, iniciar fornecendo quantidades crescentes até atingir a quantia recomendada dentro de 10 dias. Manter boa disponibilidade de alimento volumoso para os animais, mesmo que de baixa qualidade.  Não fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. \n\nATENÇÃO: NÃO FORNECER A OUTRAS ESPÉCIES OU CATEGORIAS ANIMAIS QUE NÃO ÀS DESCRITAS NA INDICAÇÃO DO PRODUTO E/OU NO MODO DE USAR. NÃO ADMINISTRAR JUNTO A OUTROS PRODUTOS QUE CONTENHAM IONÓFOROS. NÃO PERMITIR ACESSO DE EQUINOS AO PRODUTO, POIS A INGESTÃO PODERÁ SER FATAL. ESTE PRODUTO CONTÉM IONÓFORO E O USO SIMULTÂNEO COM CERTAS SUBSTÂNCIAS MEDICAMENTOSAS PODE SER CONTRA-INDICADA. A MONENSINA, SALINOMICINA E A NARASINA SÃO INCOMPATÍVEIS COM A TIAMULINA.",
      nome_comercial_documental: "DUKAMP CONCENTRADO CONFINAMENTO 40",
      principal_documental_source_id: "D032",
      produto_id: "P032",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia e, portanto, deve ser fornecido em cochos cobertos e/ou que evitem acúmulo de água. \nO uso de uréia adicional é contraindicado, salvo quando prescrito por profissional habilitado. \nNão fornecer este produto para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos e debilitados.\nPara adaptação dos animais à uréia, iniciar fornecendo quantidades crescentes até atingir a quantia recomendada dentro de 10 dias. \nManter boa disponibilidade de alimento volumoso para os animais, mesmo que de baixa qualidade.  \nNão fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula. \nNão fornecer a outras espécies ou categorias animais que não às descritas na indicação do produto e/ou no modo de usar. \nNão administrar junto a outros produtos que contenham ionóforos. não permitir acesso de equinos ao produto, pois a ingestão poderá ser fatal. \nEste produto contém ionóforo e o uso simultâneo com certas substâncias medicamentosas pode ser contra-indicada. \nA monensina, salinomicina e a narasina são incompatíveis com a tiamulina.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "8dde44ef7477b8f1e859c411ea402a7e49281674a63c5f2e2b87c35191819cb7",
    kind: "catalog",
    product: {
      aliases: [
        "DUKAMP CONCENTRADO CONFINAMENTO 40 (F.A.B.MIGUEL)",
        "RTPI - Concentrado - DK Conc. Conf. 40 (FAB Miguel)",
      ],
      bloqueios: [],
      classificacao_documental: "CONCENTRADO",
      composicao_documental:
        "Farelo de amendoim, farelo de glúten de milho, uréia pecuária, cloreto de sódio (sal comum) - 5%, fosfato bicálcico, carbonato de cálcio, cloreto de potássio, premix mineral vitamínico, promotor de crescimento e eficiência alimentar. Produto poderá conter milho (1,2,4,5), soja (1,2,3,4) ou algodão (1,2,4,5,6) transgênicos. Espécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes; 5- Zea mays; 6- Streptomyces hygroscopicus.",
      descricao_documental:
        "Concentrado protéico para formulação de dietas para bovinos em confinamento.",
      fontes: [
        {
          arquivo_no_pacote:
            "produtos/P031_dukamp-concentrado-confinamento-40-f-a-b-miguel/fontes/D031.doc",
          arquivo_original: "RTPI/RTPI - Concentrado - DK Conc. Conf. 40 (FAB Miguel).doc",
          sha256: "240081267c8d7afe82c75ae6ac970fc9b4a47d802142cbf5b1d6ea635c4afdb6",
          source_id: "D031",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Uso exclusivo para formulação de dietas para bovinos em confinamento. Fornecer entre 200 e 250 gramas para cada 100 kg de peso corporal. Não fornecer puro aos animais. Não permitir o consumo por equinos.",
      nome_comercial_documental: "DUKAMP CONCENTRADO CONFINAMENTO 40 (F.A.B.MIGUEL)",
      principal_documental_source_id: "D031",
      produto_id: "P031",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Não fornecer puro aos animais. \nNão permitir o consumo por equinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "17b18a37893d167860eda187ae0c91e77024c5dbee8f1495a876d328d4bb5e1f",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP CONCENTRADO CONFINAMENTO 60", "RTPI - Concentrado - DK Conc. Conf. 60"],
      bloqueios: [],
      classificacao_documental: "CONCENTRADO",
      composicao_documental:
        "Farelo de soja, farelo de algodão, farelo de trigo, fosfato bicálcico, carbonato de cálcio, uréia pecuária,monesina sódica, premix mineral vitamínico. Produto poderá conter milho (1,2,4,5), soja (1,2,3,4) ou algodão (1,2,4,5,6) transgênicos. Espécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes; 5- Zea mays; 6- Streptomyces hygroscopicus.",
      descricao_documental:
        "Concentrado para manufatura de rações destinadas à engorda de bovinos de corte em confinamento, semi-confinamento ou suplementados a campo.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P033_dukamp-concentrado-confinamento-60/fontes/D033.doc",
          arquivo_original: "RTPI/RTPI - Concentrado - DK Conc. Conf. 60.doc",
          sha256: "c51051eee453f77b0126b18197a157e7c67297f198b6145a377dec351fe789b3",
          source_id: "D033",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Misturar 15 kg de Dukamp Concentrado Confinamento 60 com 85 kg de milho ou sorgo moídos, compondo-se assim uma ração. Fornecer entre 1 a 1,5% do peso vivo em ração, dependendo da qualidade do volumoso, estado corporal dos animais, estágio de desenvolvimento e do desempenho esperado. Fracionar o fornecimento em pelo menos dois tratos diários. Este produto contém uréia e, portanto, deve ser fornecido em cochos cobertos e/ou que evitem acúmulo de água. O uso de uréia adicional é contraindicado, salvo quando prescrito por profissional habilitado. Não fornecer este produto para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos e debilitados. Para adaptação dos animais à uréia, iniciar fornecendo quantidades crescentes até atingir a quantia recomendada dentro de 10 dias. Manter boa disponibilidade de alimento volumoso para os animais, mesmo que de baixa qualidade.  Não fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. \n\nATENÇÃO: NÃO FORNECER A OUTRAS ESPÉCIES OU CATEGORIAS ANIMAIS QUE NÃO ÀS DESCRITAS NA INDICAÇÃO DO PRODUTO E/OU NO MODO DE USAR. NÃO ADMINISTRAR JUNTO A OUTROS PRODUTOS QUE CONTENHAM IONÓFOROS. NÃO PERMITIR ACESSO DE EQUINOS AO PRODUTO, POIS A INGESTÃO PODERÁ SER FATAL. ESTE PRODUTO CONTÉM IONÓFORO E O USO SIMULTÂNEO COM CERTAS SUBSTÂNCIAS MEDICAMENTOSAS PODE SER CONTRA-INDICADA. A MONENSINA, SALINOMICINA E A NARASINA SÃO INCOMPATÍVEIS COM A TIAMULINA.",
      nome_comercial_documental: "DUKAMP CONCENTRADO CONFINAMENTO 60",
      principal_documental_source_id: "D033",
      produto_id: "P033",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia e, portanto, deve ser fornecido em cochos cobertos e/ou que evitem acúmulo de água. \nO uso de uréia adicional é contraindicado, salvo quando prescrito por profissional habilitado. \nNão fornecer este produto para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos e debilitados. \nPara adaptação dos animais à uréia, iniciar fornecendo quantidades crescentes até atingir a quantia recomendada dentro de 10 dias. \nManter boa disponibilidade de alimento volumoso para os animais, mesmo que de baixa qualidade.  \nNão fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula.\nNão fornecer a outras espécies ou categorias animais que não às descritas na indicação do produto e/ou no modo de usar. \nNão administrar junto a outros produtos que contenham ionóforos. \nNão permitir acesso de equinos ao produto, pois a ingestão poderá ser fatal. \nEste produto contém ionóforo e o uso simultâneo com certas substâncias medicamentosas pode ser contra-indicada.\nA monensina, salinomicina e a narasina são incompatíveis com a tiamulina.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "1083ee219a2f223f184e4bfe13f54d51a791c66f719da32c8d9be5ce7a767413",
    kind: "catalog",
    product: {
      aliases: [
        "DUKAMP CONCENTRADO CONFINAMENTO GI-15/320",
        "RTPI - Concentrado - DK Conc. Conf. GI-15-320",
      ],
      bloqueios: [],
      classificacao_documental: "CONCENTRADO",
      composicao_documental:
        ": Farelo de soja*, farelo de trigo, casca de soja moída, farelo de amendoim, fosfaa,icálcico, carbonato de cálcio, uréia pecuária, aditivo coccidiostático, monensina sodica, bicarbonato de sódio, premix mineral vitamínico. Espécie doadora de genes (em caso de ingrediente transgênico):  *Agrobacterium tumefaciens.",
      descricao_documental:
        "Concentrado protéico para manufatura de rações destinadas à engorda de bovinos de corte em confinamento, submetidos a dieta sem volumoso.",
      fontes: [
        {
          arquivo_no_pacote:
            "produtos/P034_dukamp-concentrado-confinamento-gi-15-320/fontes/D034.doc",
          arquivo_original: "RTPI/RTPI - Concentrado - DK Conc. Conf. GI-15-320.doc",
          sha256: "58fc5a9e2b9deb121bf519e6b210512de9f506b8ad44cc86b6aaa507c8e34320",
          source_id: "D034",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "RÓTULO ATUAL:\nMisturar 15% de DUKAMP CONCENTRADO CONFINAMENTO GI-15/320 com 85% de grãos inteiros de milho (sem moer ou quebrar), compondo-se assim uma ração, que será a dieta exclusiva dos animais (portanto isenta de volumoso). Dessa ração produzida, caso os animais já estejam adaptados à dieta sem volumoso, fornecer o equivalente entre 2 a 2,2% do peso corporal diariamente, dividindo o total em pelo menos 5 (cinco) refeições diárias.\n\nPROTOCOLO DE ADAPTAÇÃO: Inicie fornecendo o equivalente a 1,2% do peso corporal em ração e aumente o fornecimento em cerca de 10% a cada dois dias, até chegar ao limite de fornecimento, que é entre 2 e 2,2% do peso corporal por volta do 14º dia. O período de adaptação não deverá ser reduzido, sob o risco de ocorrência de distúrbios nutricionais. Fornecer a quantidade total diária de ração dividida em pelo menos 5 (cinco) refeições e não disponibilizar volumoso aos animais confinados. Caso a intenção seja de adaptar os animais utilizando também volumoso ou em caso de distúrbios nutricionais, consulte nosso departamento técnico ou um profissional habilitado de sua confiança.\n\nATENÇÃO: ESTE PRODUTO CONTÉM URÉIA, SENDO CONTRA-INDICADO O USO DE URÉIA ADICIONAL. FORNECER O PRODUTO EM COCHOS COBERTOS E/OU QUE EVITEM ACÚMULO DE ÁGUA. NÃO FORNECER O PRODUTO PARA ANIMAIS EM JEJUM, FAMINTOS E DEBILITADOS. NÃO FORNECER O PRODUTO PARA EQÜÍDEOS, OVINOS E/OU QUAISQUER OUTRAS CATEGORIAS OU ESPÉCIES QUE NÃO AS ESPECIFICADAS NESTE RÓTULO, NEM EM QUANTIDADES ACIMA DO RECOMENDADO. O FORNECIMENTO DE VOLUMOSO É CONTRA-INDICADO, SALVO QUANDO PRESCRITO POR PROFISSIONAL HABILITADO. NÃO ADMINISTRAR JUNTO A OUTROS PRODUTOS QUE CONTENHAM IONÓFOROS. NÃO PERMITIR ACESSO DE EQUINOS AO PRODUTO, POIS A INGESTÃO PODERÁ SER FATAL. ESTE PRODUTO CONTÉM IONÓFORO E O USO SIMULTÂNEO COM CERTAS SUBSTÂNCIAS MEDICAMENTOSAS PODE SER CONTRA-INDICADA. A MONENSINA, SALINOMICINA E A NARASINA SÃO INCOMPATÍVEIS COM A TIAMULINA.",
      nome_comercial_documental: "DUKAMP CONCENTRADO CONFINAMENTO GI-15/320",
      principal_documental_source_id: "D034",
      produto_id: "P034",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia, sendo contra-indicado o uso de uréia adicional. \nFornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. \nNão fornecer o produto para animais em jejum, famintos e debilitados. \nNão fornecer o produto para eqüídeos, ovinos e/ou quaisquer outras categorias ou espécies que não as especificadas neste rótulo, nem em quantidades acima do recomendado. \nO fornecimento de volumoso é contra-indicado, salvo quando prescrito por profissional habilitado. \nNão administrar junto a outros produtos que contenham ionóforos. \nNão permitir acesso de equinos ao produto, pois a ingestão poderá ser fatal. \nEste produto contém ionóforo e o uso simultâneo com certas substâncias medicamentosas pode ser contra-indicada. \nA monensina, salinomicina e a narasina são incompatíveis com a tiamulina.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "15c36f82753d367c9325733ef0ee2ada8d532e796796d12b1cd7b65ecc9a1451",
    kind: "catalog",
    product: {
      aliases: [
        "DUKAMP CONCENTRADO CONFINAMENTO GI-15/380",
        "RTPI - Concentrado - DK Conc. Conf. GI-15-380",
      ],
      bloqueios: [
        {
          descricao:
            "Cromo: especificação 'mím.' e unidade 'mg/kg' preservadas. Confirmar a grafia antes de normalizar.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Concentrado - DK Conc. Conf. GI-15-380.doc",
              evidence_id: "D035-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D035",
            },
          ],
          source_id: "D035",
          tipo: "grafia_unidade_especificacao",
        },
      ],
      classificacao_documental: "CONCENTRADO PARA BOVINOS DE CORTE",
      composicao_documental:
        "Farelo de soja*, fosfato bicálcico, carbonato de cálcio, uréia pecuária, monensina sodica, bicarbonato de sódio, premix mineral vitamínico. Espécie doadora de genes (em caso de ingrediente transgênico):  *Agrobacterium tumefaciens.",
      descricao_documental:
        "Concentrado protéico para manufatura de rações destinadas à engorda de bovinos de corte em confinamento, submetidos a dieta sem volumoso.",
      fontes: [
        {
          arquivo_no_pacote:
            "produtos/P035_dukamp-concentrado-confinamento-gi-15-380/fontes/D035.doc",
          arquivo_original: "RTPI/RTPI - Concentrado - DK Conc. Conf. GI-15-380.doc",
          sha256: "fba2a7a6c6531733cd2de0063108adfb39991d10758b3ddb7328a2087c0c5106",
          source_id: "D035",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Misturar 15% de DUKAMP CONCENTRADO CONFINAMENTO GI-15 com 85% de grãos inteiros de milho (sem moer ou quebrar), compondo-se assim uma ração, que será a dieta exclusiva dos animais (portanto isenta de volumoso). Dessa ração produzida, caso os animais já estejam adaptados à dieta sem volumoso, fornecer o equivalente entre 2 a 2,2% do peso corporal diariamente, dividindo o total em pelo menos 5 (cinco) refeições diárias.\n\nPROTOCOLO DE ADAPTAÇÃO: Inicie fornecendo o equivalente a 1,2% do peso corporal em ração e aumente o fornecimento em cerca de 10% a cada dois dias, até chegar ao limite de fornecimento, que é entre 2 e 2,2% do peso corporal por volta do 14º dia. O período de adaptação não deverá ser reduzido, sob o risco de ocorrência de distúrbios nutricionais. Fornecer a quantidade total diária de ração dividida em pelo menos 5 (cinco) refeições e não disponibilizar volumoso aos animais confinados. Caso a intenção seja de adaptar os animais utilizando também volumoso ou em caso de distúrbios nutricionais, consulte nosso departamento técnico ou um profissional habilitado de sua confiança.\n\nATENÇÃO: ESTE PRODUTO CONTÉM URÉIA, SENDO CONTRA-INDICADO O USO DE URÉIA ADICIONAL. FORNECER O PRODUTO EM COCHOS COBERTOS E/OU QUE EVITEM ACÚMULO DE ÁGUA. NÃO FORNECER O PRODUTO PARA ANIMAIS EM JEJUM, FAMINTOS E DEBILITADOS. NÃO FORNECER O PRODUTO PARA EQÜÍDEOS, OVINOS E/OU QUAISQUER OUTRAS CATEGORIAS OU ESPÉCIES QUE NÃO AS ESPECIFICADAS NESTE RÓTULO, NEM EM QUANTIDADES ACIMA DO RECOMENDADO. O FORNECIMENTO DE VOLUMOSO É CONTRA-INDICADO, SALVO QUANDO PRESCRITO POR PROFISSIONAL HABILITADO. NÃO ADMINISTRAR JUNTO A OUTROS PRODUTOS QUE CONTENHAM IONÓFOROS. NÃO PERMITIR ACESSO DE EQUINOS AO PRODUTO, POIS A INGESTÃO PODERÁ SER FATAL. ESTE PRODUTO CONTÉM IONÓFORO E O USO SIMULTÂNEO COM CERTAS SUBSTÂNCIAS MEDICAMENTOSAS PODE SER CONTRA-INDICADA. A MONENSINA, SALINOMICINA E A NARASINA SÃO INCOMPATÍVEIS COM A TIAMULINA.",
      nome_comercial_documental: "DUKAMP CONCENTRADO CONFINAMENTO GI-15/380",
      principal_documental_source_id: "D035",
      produto_id: "P035",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia, sendo contra-indicado o uso de uréia adicional. \nFornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. \nNão fornecer o produto para animais em jejum, famintos e debilitados. \nNão fornecer o produto para eqüídeos, ovinos e/ou quaisquer outras categorias ou espécies que não as especificadas neste rótulo, nem em quantidades acima do recomendado. \nO fornecimento de volumoso é contra-indicado, salvo quando prescrito por profissional habilitado. \nNão administrar junto a outros produtos que contenham ionóforos. \nNão permitir acesso de equinos ao produto, pois a ingestão poderá ser fatal. \nEste produto contém ionóforo e o uso simultâneo com certas substâncias medicamentosas pode ser contra-indicada. \nA monensina, salinomicina e a narasina são incompatíveis com a tiamulina.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "06adde930a9459931a7d8129e837b685024572698120dd91b814f7bbf0097d73",
    kind: "catalog",
    product: {
      aliases: [
        "DUKAMP CONCENTRADO CONFINAMENTO GI-33",
        "RTPI - Concentrado Corte - DK Conc. Conf. GI-33",
      ],
      bloqueios: [
        {
          descricao:
            "Cromo: tabela técnica = 0,7 mg/kg; anexo = Cromomín0,64mg/kg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original:
                "RTPI/Obsoletos/RTPI - Concentrado Corte - DK Conc. Conf. GI-33.doc",
              evidence_id: "D011-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D011",
            },
          ],
          source_id: "D011",
          tipo: "garantia_entre_blocos",
        },
      ],
      classificacao_documental: "CONCENTRADO",
      composicao_documental:
        "Farelo de soja*, milho integral moído**, fosfato bicálcico, carbonato de cálcio, uréia pecuária, aditivo coccidiostático, aditivo promotor de crescimento e eficiência alimentar, bicarbonato de sódio, premix mineral vitamínico. Espécie doadora de genes (em caso de ingrediente transgênico):  *Agrobacterium tumefaciens;  **Bacillus thuringiensis.",
      descricao_documental:
        "Concentrado protéico para manufatura de rações destinadas à engorda de bovinos de corte em confinamento, submetidos a dieta sem volumoso.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P011_dukamp-concentrado-confinamento-gi-33/fontes/D011.doc",
          arquivo_original: "RTPI/Obsoletos/RTPI - Concentrado Corte - DK Conc. Conf. GI-33.doc",
          sha256: "66970098e217f52f7eed182c24882d5011281c7f0cace8aca6a84a4fda1e3cc3",
          source_id: "D011",
          versao_papel: "historico_obsoleto",
        },
      ],
      modo_de_usar_documental:
        "Para cada 1 kg de DUKAMP CONCENTRADO CONFINAMENTO GI-33, misturar 2 kg de grãos inteiros de milho, compondo-se assim uma ração, que será a dieta exclusiva dos animais (portanto isenta de volumoso). Dessa ração produzida, caso os animais já estejam adaptados à dieta sem volumoso, fornecer o equivalente entre 2 a 2,2% do peso corporal diariamente, dividindo o total em pelo menos 5 (cinco) refeições diárias.\n\nPROTOCOLO DE ADAPTAÇÃO: Inicie fornecendo o equivalente a 1,2% do peso corporal em ração e aumente o fornecimento em cerca de 10% a cada dois dias, até chegar ao limite de fornecimento, que é entre 2 e 2,2% do peso corporal por volta do 14º dia. O período de adaptação não deverá ser reduzido, sob o risco de ocorrência de distúrbios nutricionais. Fornecer a quantidade total diária de ração dividida em pelo menos 5 (cinco) refeições e não disponibilizar volumoso aos animais confinados. Caso a intenção seja de adaptar os animais utilizando também volumoso ou em caso de distúrbios nutricionais, consulte nosso departamento técnico ou um profissional habilitado de sua confiança.\n\nATENÇÃO: ESTE PRODUTO CONTÉM URÉIA, SENDO CONTRA-INDICADO O USO DE URÉIA ADICIONAL. FORNECER O PRODUTO EM COCHOS COBERTOS E/OU QUE EVITEM ACÚMULO DE ÁGUA. NÃO FORNECER O PRODUTO PARA ANIMAIS EM JEJUM, FAMINTOS E DEBILITADOS. NÃO FORNECER O PRODUTO PARA EQÜÍDEOS, OVINOS E/OU QUAISQUER OUTRAS CATEGORIAS OU ESPÉCIES QUE NÃO AS ESPECIFICADAS NESTE RÓTULO, NEM EM QUANTIDADES ACIMA DO RECOMENDADO. O FORNECIMENTO DE VOLUMOSO É CONTRA-INDICADO, SALVO QUANDO PRESCRITO POR PROFISSIONAL HABILITADO. NÃO ADMINISTRAR JUNTO A OUTROS PRODUTOS QUE CONTENHAM IONÓFOROS. NÃO PERMITIR ACESSO DE EQUINOS AO PRODUTO, POIS A INGESTÃO PODERÁ SER FATAL. ESTE PRODUTO CONTÉM IONÓFORO E O USO SIMULTÂNEO COM CERTAS SUBSTÂNCIAS MEDICAMENTOSAS PODE SER CONTRA-INDICADA. A MONENSINA, SALINOMICINA E A NARASINA SÃO INCOMPATÍVEIS COM A TIAMULINA.",
      nome_comercial_documental: "DUKAMP CONCENTRADO CONFINAMENTO GI-33",
      principal_documental_source_id: "D011",
      produto_id: "P011",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia, sendo contra-indicado o uso de uréia adicional. \nFornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. \nNão fornecer o produto para animais em jejum, famintos e debilitados. \nNão fornecer o produto para eqüídeos, ovinos e/ou quaisquer outras categorias ou espécies que não as especificadas neste rótulo, nem em quantidades acima do recomendado. \nO fornecimento de volumoso é contra-indicado, salvo quando prescrito por profissional habilitado. \nNão administrar junto a outros produtos que contenham ionóforos. \nNão permitir acesso de equinos ao produto, pois a ingestão poderá ser fatal. \nEste produto contém ionóforo e o uso simultâneo com certas substâncias medicamentosas pode ser contra-indicada. \nA monensina, salinomicina e a narasina são incompatíveis com a tiamulina.",
      status_vigencia: "historico_obsoleto",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "d2c60f3ea820a6e4c6c953cee9ba4cca8606675477af97c437ccd066bb9e1858",
    kind: "catalog",
    product: {
      aliases: [
        "DUKAMP CONCENTRADO CONFINAMENTO GI-33/190",
        "RTPI - Concentrado Corte - DK Conc. Conf. GI-33-190(NÃO LANÇADO)",
      ],
      bloqueios: [],
      classificacao_documental: "CONCENTRADO",
      composicao_documental:
        "Farelo de soja*, farelo de trigo, casca de soja moída, farelo de amendoim, milho integral moído**, fosfato bicálcico, carbonato de cálcio, uréia pecuária, aditivo coccidiostático, aditivo promotor de crescimento e eficiência alimentar, bicarbonato de sódio, premix mineral vitamínico. Espécie doadora de genes (em caso de ingrediente transgênico):  *Agrobacterium tumefaciens;  **Bacillus thuringiensis.",
      descricao_documental:
        "Concentrado protéico para manufatura de rações destinadas à engorda de bovinos de corte em confinamento, submetidos a dieta sem volumoso.",
      fontes: [
        {
          arquivo_no_pacote:
            "produtos/P010_dukamp-concentrado-confinamento-gi-33-190/fontes/D010.doc",
          arquivo_original:
            "RTPI/Obsoletos/RTPI - Concentrado Corte - DK Conc. Conf. GI-33-190(NÃO LANÇADO).doc",
          sha256: "f0396353de615cd750fcbcf270f7095165a804ffe511e122873f203b6082104d",
          source_id: "D010",
          versao_papel: "historico_obsoleto",
        },
      ],
      modo_de_usar_documental:
        "Para cada 1 kg de DUKAMP CONCENTRADO CONFINAMENTO GI-33/190, misturar 2 kg de grãos inteiros de milho, compondo-se assim uma ração, que será a dieta exclusiva dos animais (portanto isenta de volumoso). Dessa ração produzida, caso os animais já estejam adaptados à dieta sem volumoso, fornecer o equivalente entre 2 a 2,2% do peso corporal diariamente, dividindo o total em pelo menos 5 (cinco) refeições diárias.\n\nPROTOCOLO DE ADAPTAÇÃO: Inicie fornecendo o equivalente a 1,2% do peso corporal em ração e aumente o fornecimento em cerca de 10% a cada dois dias, até chegar ao limite de fornecimento, que é entre 2 e 2,2% do peso corporal por volta do 14º dia. O período de adaptação não deverá ser reduzido, sob o risco de ocorrência de distúrbios nutricionais. Fornecer a quantidade total diária de ração dividida em pelo menos 5 (cinco) refeições e não disponibilizar volumoso aos animais confinados. Caso a intenção seja de adaptar os animais utilizando também volumoso ou em caso de distúrbios nutricionais, consulte nosso departamento técnico ou um profissional habilitado de sua confiança.\n\nATENÇÃO: ESTE PRODUTO CONTÉM URÉIA, SENDO CONTRA-INDICADO O USO DE URÉIA ADICIONAL. FORNECER O PRODUTO EM COCHOS COBERTOS E/OU QUE EVITEM ACÚMULO DE ÁGUA. NÃO FORNECER O PRODUTO PARA ANIMAIS EM JEJUM, FAMINTOS E DEBILITADOS. NÃO FORNECER O PRODUTO PARA EQÜÍDEOS, OVINOS E/OU QUAISQUER OUTRAS CATEGORIAS OU ESPÉCIES QUE NÃO AS ESPECIFICADAS NESTE RÓTULO, NEM EM QUANTIDADES ACIMA DO RECOMENDADO. O FORNECIMENTO DE VOLUMOSO É CONTRA-INDICADO, SALVO QUANDO PRESCRITO POR PROFISSIONAL HABILITADO. NÃO ADMINISTRAR JUNTO A OUTROS PRODUTOS QUE CONTENHAM IONÓFOROS. NÃO PERMITIR ACESSO DE EQUINOS AO PRODUTO, POIS A INGESTÃO PODERÁ SER FATAL. ESTE PRODUTO CONTÉM IONÓFORO E O USO SIMULTÂNEO COM CERTAS SUBSTÂNCIAS MEDICAMENTOSAS PODE SER CONTRA-INDICADA. A MONENSINA, SALINOMICINA E A NARASINA SÃO INCOMPATÍVEIS COM A TIAMULINA.",
      nome_comercial_documental: "DUKAMP CONCENTRADO CONFINAMENTO GI-33/190",
      principal_documental_source_id: "D010",
      produto_id: "P010",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia, sendo contra-indicado o uso de uréia adicional. \nFornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. \nNão fornecer o produto para animais em jejum, famintos e debilitados. \nNão fornecer o produto para eqüídeos, ovinos e/ou quaisquer outras categorias ou espécies que não as especificadas neste rótulo, nem em quantidades acima do recomendado. \nO fornecimento de volumoso é contra-indicado, salvo quando prescrito por profissional habilitado. \nNão administrar junto a outros produtos que contenham ionóforos. \nNão permitir acesso de equinos ao produto, pois a ingestão poderá ser fatal. \nEste produto contém ionóforo e o uso simultâneo com certas substâncias medicamentosas pode ser contra-indicada. \nA monensina, salinomicina e a narasina são incompatíveis com a tiamulina.",
      status_vigencia: "nao_lancado",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "93710ed2c2f64268dcc2ba1445f01d132880fa1cfde108f75e5b79f505ec1a61",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP CONCENTRADO LACTAÇÃO", "RTPI - Concentrado - DK Conc. Lactação"],
      bloqueios: [],
      classificacao_documental: "CONCENTRADO",
      composicao_documental:
        "Farelo de soja, farelo de algodão, farelo de polpa cítrica, farelo de trigo, fosfato bicálcico, carbonato de cálcio, milho integral moído, uréia pecuária,  premix mineral vitamínico. Produto poderá conter milho (1,2,4,5), soja (1,2,3,4) ou algodão (1,2,4,5,6) transgênicos. Espécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes; 5- Zea mays; 6- Streptomyces hygroscopicus.",
      descricao_documental:
        "Concentrado para manufatura de rações destinadas a vacas em lactação com produções entre 7 e 15 litros de leite por dia.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P036_dukamp-concentrado-lactacao/fontes/D036.doc",
          arquivo_original: "RTPI/RTPI - Concentrado - DK Conc. Lactação.doc",
          sha256: "076dd94a467253adaf0530bd6ace799ae3250797bfd4c2c373501bcd1cb7a181",
          source_id: "D036",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Misturar 40 kg de Dukamp Concentrado Lactação com 60 kg de milho ou sorgo moídos. Da mistura elaborada, fornecer às vacas em lactação na proporção de 1 kg de ração para cada 2,5 a 3 litros de leite produzidos, de acordo com o estágio da lactação, qualidade do volumoso e estado corporal dos animais. A introdução da ração na dieta deverá ser gradual, substituindo parte da ração atualmente em uso pela mistura confeccionada com esse produto, até a substituição completa dentro de 14 dias. Este produto contém uréia, sendo contra-indicado o uso de uréia adicional. Fornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. Não fornecer o produto para animais lactentes e/ou para animais em jejum, famintos e debilitados. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia.",
      nome_comercial_documental: "DUKAMP CONCENTRADO LACTAÇÃO",
      principal_documental_source_id: "D036",
      produto_id: "P036",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "A introdução da ração na dieta deverá ser gradual, substituindo parte da ração atualmente em uso pela mistura confeccionada com esse produto, até a substituição completa dentro de 14 dias. \nEste produto contém uréia, sendo contra-indicado o uso de uréia adicional. \nFornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. \nNão fornecer o produto para animais lactentes e/ou para animais em jejum, famintos e debilitados.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "599c8d47894fb7c6a784aff2dc5b6e85aa68fa098d2f9cc29933a857ddf0889d",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP CREEP FEEDING", "RTPI - Proteinados - Dukamp Creep Feeding"],
      bloqueios: [],
      classificacao_documental: "SUPLEMENTO MINERAL PROTÉICO DE PRONTO USO PARA BOVINOS DE CORTE",
      composicao_documental:
        "farelo de soja, farelo de trigo, carbonato de cálcio, fosfato bicálcico, milho integral moído,  monensina sodica, cloreto de sódio (sal comum), melaço em pó, premix mineral  Produto poderá conter milho (1,2,4,5), soja (1,2,3,4) ou algodão (1,2,4,5,6) transgênicos. Espécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes; 5- Zea mays; 6- Streptomyces hygroscopicus.",
      descricao_documental:
        "Produto indicado para a suplementação mineral, protéica e vitamínica de bezerros em toda fase de aleitamento até 2 meses após a desmama.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P076_dukamp-creep-feeding/fontes/D076.doc",
          arquivo_original: "RTPI/RTPI - Proteinados - Dukamp Creep Feeding.doc",
          sha256: "67ddd4f711c9b9d33014bd7e60ae1a85f5b7c310769ad2c8d76ca63fedaf3b33",
          source_id: "D076",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "O produto Dukamp Creep Feeding já vem pronto para uso, bastando despejar em cochos protegidos e deixar à disposição permanente dos animais. Consumo esperado de 200 g do produto para cada 100 kg de peso vivo dos animais. Recomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que de baixa qualidade. Não fornecer o produto para eqüídeos e ovinos. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. Em caso de dúvidas ou intoxicações, consulte nosso departamento técnico ou um profissional de sua confiança.\nATENÇÃO: NÃO FORNECER A OUTRAS ESPÉCIES  ANIMAIS QUE NÃO ÀS DESCRITAS NA INDICAÇÃO DO PRODUTO. NÃO ADMINISTRAR JUNTO A OUTROS PRODUTOS QUE CONTENHAM IONÓFOROS. NÃO PERMITIR ACESSO DE EQUINOS AO PRODUTO, POIS A INGESTÃO PODERÁ SER FATAL. ESTE PRODUTO CONTÉM IONÓFORO E O USO SIMULTÂNEO COM CERTAS SUBSTÂNCIAS MEDICAMENTOSAS PODE SER CONTRA-INDICADA. A MONENSINA, SALINOMICINA E A NARASINA SÃO INCOMPATÍVEIS COM A TIAMULINA.",
      nome_comercial_documental: "DUKAMP CREEP FEEDING",
      principal_documental_source_id: "D076",
      produto_id: "P076",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Não fornecer o produto para eqüídeos e ovinos. \nNão fornecer a outras espécies  animais que não às descritas na indicação do produto. \nNão administrar junto a outros produtos que contenham ionóforos. \nNão permitir acesso de equinos ao produto, pois a ingestão poderá ser fatal. \nEste produto contém ionóforo e o uso simultâneo com certas substâncias medicamentosas pode ser contra-indicada. \nA monensina, salinomicina e a narasina são incompatíveis com a tiamulina.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "3add597f4f2bbb7f843cf522d6e085c883cfda5378549f9f73311f08e714ad16",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP CREEP PLUS", "RTPI - Proteinados - Dukamp Creep Plus"],
      bloqueios: [],
      classificacao_documental: "SUPLEMENTO MINERAL PROTÉICO DE PRONTO USO PARA BOVINOS DE CORTE",
      composicao_documental:
        "farelo de soja, farelo de trigo, carbonato de cálcio, fosfato bicálcico, milho integral moído,  monensina sodica, cloreto de sódio (sal comum), melaço em pó, premix mineral vitamínico. Produto poderá conter milho (1,2,4,5), soja (1,2,3,4) ou algodão (1,2,4,5,6) transgênicos. Espécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes; 5- Zea mays; 6- Streptomyces hygroscopicus.",
      descricao_documental:
        "Produto indicado para a suplementação mineral, protéica e vitamínica de bezerros em toda fase de aleitamento até 2 meses após a desmama.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P077_dukamp-creep-plus/fontes/D077.doc",
          arquivo_original: "RTPI/RTPI - Proteinados - Dukamp Creep Plus.doc",
          sha256: "3f8672b905e9d5bc0eb642606e53786867e49359eed5ca6e76add5a18bca05ff",
          source_id: "D077",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "O produto Dukamp Creep Plus já vem pronto para uso, bastando despejar em cochos protegidos e deixar à disposição permanente dos animais. Consumo esperado de 200 g do produto para cada 100 kg de peso vivo dos animais. Recomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que de baixa qualidade. Não fornecer o produto para eqüídeos e ovinos. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. Em caso de dúvidas ou intoxicações, consulte nosso departamento técnico ou um profissional de sua confiança.\nATENÇÃO: NÃO FORNECER A OUTRAS ESPÉCIES  ANIMAIS QUE NÃO ÀS DESCRITAS NA INDICAÇÃO DO PRODUTO. NÃO ADMINISTRAR JUNTO A OUTROS PRODUTOS QUE CONTENHAM IONÓFOROS. NÃO PERMITIR ACESSO DE EQUINOS AO PRODUTO, POIS A INGESTÃO PODERÁ SER FATAL. ESTE PRODUTO CONTÉM IONÓFORO E O USO SIMULTÂNEO COM CERTAS SUBSTÂNCIAS MEDICAMENTOSAS PODE SER CONTRA-INDICADA. A MONENSINA, SALINOMICINA E A NARASINA SÃO INCOMPATÍVEIS COM A TIAMULINA.",
      nome_comercial_documental: "DUKAMP CREEP PLUS",
      principal_documental_source_id: "D077",
      produto_id: "P077",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Não fornecer o produto para eqüídeos e ovinos. \nNão fornecer a outras espécies  animais que não às descritas na indicação do produto. \nNão administrar junto a outros produtos que contenham ionóforos. \nNão permitir acesso de equinos ao produto, pois a ingestão poderá ser fatal. \nEste produto contém ionóforo e o uso simultâneo com certas substâncias medicamentosas pode ser contra-indicada. \nA monensina, salinomicina e a narasina são incompatíveis com a tiamulina.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "91eeb2bb5afed793f8a3d2052a0835298ef130669456bcd514e039008f928af0",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP CRIA", "RTPI - Mineral Tradicional - Dukamp Cria"],
      bloqueios: [
        {
          descricao:
            "CÁLCIO: tabela técnica = 88 / 475 g; anexo = CÁLCIO(mín)172g. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Mineral Tradicional - Dukamp Cria.doc",
              evidence_id: "D058-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D058",
            },
          ],
          source_id: "D058",
          tipo: "garantia_entre_blocos",
        },
        {
          descricao:
            "FLÚOR: tabela técnica = 730 mg; anexo = FLÚOR(máx)750mg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Mineral Tradicional - Dukamp Cria.doc",
              evidence_id: "D058-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D058",
            },
          ],
          source_id: "D058",
          tipo: "garantia_entre_blocos",
        },
        {
          descricao:
            "O documento conserva mais de um bloco/versão de rótulo. As garantias são mantidas por bloco e não representam uma única tabela liberada.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Mineral Tradicional - Dukamp Cria.doc",
              evidence_id: "D058-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D058",
            },
          ],
          source_id: "D058",
          tipo: "multiplos_blocos_de_garantia",
        },
      ],
      classificacao_documental: "SUPLEMENTO MINERAL DE PRONTO USO PARA BOVINOS",
      composicao_documental:
        "EMBALAGEM ATUAL: enxofre ventilado (flor de enxofre), óxido de magnésio, monóxido de manganês, óxido de zinco, sulfato de ferro, cloreto de sódio (sal comum), fosfato bicálcico, selenito de sódio, sulfato de cobre, sulfato de cobalto, iodato de cálcio, calcário calcítico.\nNOVA EMBALAGEM: calcário calcítico, fosfato bicálcico, iodato de cálcio, óxido de magnésio, sulfato de zinco, selenito de sódio, sulfato de cobalto, sulfato de cobre, sulfato de ferro, cloreto de sódio (sal comum), enxofre ventilado (flor de enxofre), sulfato de manganês.",
      descricao_documental:
        "EMBALAGEM ATUAL: Produto indicado para evitar ou corrigir carências e deficiências minerais em bovinos nas fases de cria e recria mantidos em áreas de média fertilidade com pastagens de média qualidade nutricional. NOVA EMBALAGEM: Suplemento mineral de pronto uso indicado para bovinos de corte na fase de cria e recria em pastagens de média qualidade nutricional.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P058_dukamp-cria/fontes/D058.doc",
          arquivo_original: "RTPI/RTPI - Mineral Tradicional - Dukamp Cria.doc",
          sha256: "04778e9df8dc41af69b451068a42d00f4825323bac8a8e08c3d691e2680b0a2c",
          source_id: "D058",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "EMBALAGEM ATUAL: O Dukamp Cria já está pronto para uso, bastando despejar o produto em cochos e deixar a disposição permanente dos animais. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança.\nNOVA EMBALAGEM: DUKAMP CRIA já é pronto para uso, bastando despejar o produto em cochos e deixar à disposição permanente dos animais. Preferencialmente, recomenda-se o uso de cochos cobertos e com espaço mínimo de 3 a 5 cm por cabeça suplementada. Não fornecer o produto para ovinos. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP CRIA",
      principal_documental_source_id: "D058",
      produto_id: "P058",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "38cad083f0ecc9c6d7ffa88445c9135137ea27c3d3880e9137c8ab7156f8e6ce",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP CRIA TOP", "RTPI - Mineral Linha S - Dukamp Cria Top"],
      bloqueios: [],
      classificacao_documental: "SUPLEMENTO MINERAL DE PRONTO USO PARA BOVINOS",
      composicao_documental:
        "fosfato bicálcico, calcário calcítico, carbonato de cálcio, óxido de magnésio, cloreto de sódio (sal comum) 32%, sulfato de cálcio, sulfato de cobalto, sulfato de cobre, iodato de cálcio, sulfato de ferro, sulfato de manganês, selenito de sódio, sulfato de zinco.",
      descricao_documental:
        "Suplemento mineral de pronto uso indicado para bovinos de corte nas fases de cria, recria e/ou engorda, em áreas de média fertilidade, em pastagens de média qualidade nutricional.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P044_dukamp-cria-top/fontes/D044.doc",
          arquivo_original: "RTPI/RTPI - Mineral Linha S - Dukamp Cria Top.doc",
          sha256: "0f28f65462bc775f49d684dcbbc38a58d0e2aa406a7e2eb1947f7a166638e421",
          source_id: "D044",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "DUKAMP CRIA TOP já é pronto para uso, bastando despejar o produto em cochos e deixar à disposição permanente dos animais. Preferencialmente, recomenda-se o uso de cochos cobertos e com espaço mínimo de 3 a 5 cm por cabeça suplementada. Não fornecer o produto para ovinos. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP CRIA TOP",
      principal_documental_source_id: "D044",
      produto_id: "P044",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "8f74eafb50545cb5a472fb4a88e433714f83f129f5f9ae67f6adb17f5bc70f68",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP CRIA/S", "RTPI - Mineral Linha S - Dukamp Cria S"],
      bloqueios: [],
      classificacao_documental: "SUPLEMENTO MINERAL DE PRONTO USO PARA BOVINOS",
      composicao_documental:
        "fosfato bicálcico, calcário calcítico, carbonato de cálcio, óxido de magnésio, cloreto de sódio (sal comum) 32%, sulfato de cálcio, sulfato de cobalto, sulfato de cobre, iodato de cálcio, sulfato de ferro, sulfato de manganês, selenito de sódio, sulfato de zinco.",
      descricao_documental:
        "Suplemento mineral de pronto uso indicado para bovinos de corte nas fases de cria, recria e/ou engorda, em áreas de média fertilidade, em pastagens de média qualidade nutricional.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P043_dukamp-cria-s/fontes/D043.doc",
          arquivo_original: "RTPI/RTPI - Mineral Linha S - Dukamp Cria S.doc",
          sha256: "1dbaf41fce131ab5639b669606b8c1c1e65226af96465905268de197b328e86d",
          source_id: "D043",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "DUKAMP CRIA/S já é pronto para uso, bastando despejar o produto em cochos e deixar à disposição permanente dos animais. Preferencialmente, recomenda-se o uso de cochos cobertos e com espaço mínimo de 3 a 5 cm por cabeça suplementada. Não fornecer o produto para ovinos. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP CRIA/S",
      principal_documental_source_id: "D043",
      produto_id: "P043",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "58a18304e8aacd96f57192d5fc4801150157d3a2aa4dcf761bdafbb6f2a1eb0f",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP EQUINOS/S", "RTPI - Mineral Linha S - Dukamp Equinos S"],
      bloqueios: [],
      classificacao_documental: "SUPLEMENTO MINERAL DE PRONTO USO PARA EQUINOS",
      composicao_documental:
        "fosfato bicálcico, carbonato de cálcio, óxido de magnésio, cloreto de sódio (sal comum) - 25%, sulfato de cálcio, sulfato de cobalto, sulfato de cobre, iodato de cálcio, sulfato de ferro, sulfato de manganês, selenito de sódio, sulfato de zinco, caulim - 2%,calcareo calcitico",
      descricao_documental:
        "Suplemento mineral de pronto uso, indicado para equinos em suas várias fases de desenvolvimento, submetidos ou não a atividades físicas.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P045_dukamp-equinos-s/fontes/D045.doc",
          arquivo_original: "RTPI/RTPI - Mineral Linha S - Dukamp Equinos S.doc",
          sha256: "2fb46531db0116c573e6842184c0b6453eb1799c3bb00e4ffc0020a2d86960ad",
          source_id: "D045",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "DUKAMP EQUINOS/S já é pronto para uso, bastando despejar o produto em cochos e deixar à disposição permanente dos animais. Preferencialmente, recomenda-se o uso de cochos cobertos e com espaço mínimo de 3 a 5 cm por cabeça suplementada. Não fornecer o produto para ovinos. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP EQUINOS/S",
      principal_documental_source_id: "D045",
      produto_id: "P045",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "599371dbe8150d5d2f5075e660fc1b71dcfe169ddf9cd340e02f75ff32514e13",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP LACT RECRIA", "RTPI - Ração Leite - DK Rç Lact recria"],
      bloqueios: [
        {
          descricao:
            "O nome Lact Recria sugere recria, porém a indicação declara vacas em lactação com 7 a 15 litros/dia. Não indicar para recria apenas pelo nome.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Ração Leite - DK Rç Lact recria.doc",
              evidence_id: "D120-S02",
              pagina_pdf_inicio: null,
              secao_numero_original: 2,
              secao_semantica: "Nome comercial",
              source_id: "D120",
            },
            {
              arquivo_original: "RTPI/RTPI - Ração Leite - DK Rç Lact recria.doc",
              evidence_id: "D120-S11",
              pagina_pdf_inicio: null,
              secao_numero_original: 12,
              secao_semantica: "Indicação e espécie",
              source_id: "D120",
            },
          ],
          source_id: "D120",
          tipo: "categoria",
        },
      ],
      classificacao_documental: "RAÇÃO",
      composicao_documental:
        "Farelo de soja*, farelo de algodão, farelo de polpa cítrica, farelo de trigo, fosfato bicálcico, carbonato de cálcio, melaço em pó, milho integral moído**, uréia pecuária,  premix mineral vitamínico. Espécie doadora de genes (em caso de ingrediente transgênico):  *Agrobacterium tumefaciens;  **Bacillus thuringiensis.",
      descricao_documental:
        "Ração para vacas em lactação com produções entre 7 e 15 litros de leite por dia.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P120_dukamp-lact-recria/fontes/D120.doc",
          arquivo_original: "RTPI/RTPI - Ração Leite - DK Rç Lact recria.doc",
          sha256: "182086dcd88e6d13c6957381ab4e5718ecd6560812221fa29a0c7ae697562b5a",
          source_id: "D120",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer as vacas em lactação na proporção de 1 kg de ração para cada 2,5 a 3 litros de leite produzidos, de acordo com o estágio da lactação, qualidade do volumoso e estado corporal dos animais. A introdução da ração na dieta deverá ser gradual, substituindo parte da ração atualmente em uso por esse produto, até a substituição completa dentro de 14 dias. Este produto contém uréia, sendo contra-indicado o uso de uréia adicional. Fornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. Não fornecer o produto para animais lactentes e/ou para animais em jejum, famintos e debilitados. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia.",
      nome_comercial_documental: "DUKAMP LACT RECRIA",
      principal_documental_source_id: "D120",
      produto_id: "P120",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia, sendo contra-indicado o uso de uréia adicional. \nFornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. \nNão fornecer o produto para animais lactentes e/ou para animais em jejum, famintos e debilitados.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "9f51dfaffb7ea2462073f291a539ada960a7b3ca7b81a0663d70ca3d871221f7",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP LACT SITIO CACHOEIRA", "RTPI - Ração Leite - DK Rç Lact sitio cachoeira"],
      bloqueios: [],
      classificacao_documental: "RAÇÃO",
      composicao_documental:
        "Farelo de soja*, farelo de algodão, farelo de polpa cítrica, farelo de trigo, fosfato bicálcico, carbonato de cálcio, melaço em pó, milho integral moído**, uréia pecuária,  premix mineral vitamínico. Espécie doadora de genes (em caso de ingrediente transgênico):  *Agrobacterium tumefaciens;  **Bacillus thuringiensis.",
      descricao_documental:
        "Ração para vacas em lactação com produções entre 7 e 15 litros de leite por dia.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P121_dukamp-lact-sitio-cachoeira/fontes/D121.doc",
          arquivo_original: "RTPI/RTPI - Ração Leite - DK Rç Lact sitio cachoeira.doc",
          sha256: "1a62dffe4b7345629579c34c76df7d6b1558dbc981a85fc8893c3d95e499fc97",
          source_id: "D121",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer as vacas em lactação na proporção de 1 kg de ração para cada 2,5 a 3 litros de leite produzidos, de acordo com o estágio da lactação, qualidade do volumoso e estado corporal dos animais. A introdução da ração na dieta deverá ser gradual, substituindo parte da ração atualmente em uso por esse produto, até a substituição completa dentro de 14 dias. Este produto contém uréia, sendo contra-indicado o uso de uréia adicional. Fornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. Não fornecer o produto para animais lactentes e/ou para animais em jejum, famintos e debilitados. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia.",
      nome_comercial_documental: "DUKAMP LACT SITIO CACHOEIRA",
      principal_documental_source_id: "D121",
      produto_id: "P121",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia, sendo contra-indicado o uso de uréia adicional. \nFornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. \nNão fornecer o produto para animais lactentes e/ou para animais em jejum, famintos e debilitados.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "4b15fe3cfdd992c380d5afdfbce5a816abd5521cea643bad91c0f96764471228",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP LEITE PREMIUM", "RTPI - Mineral Linha S - Dukamp Leite  Premium"],
      bloqueios: [
        {
          descricao:
            "MANGANÊS: tabela técnica = 3000 mg; anexo = MANGANÊSmín2000mg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Mineral Linha S - Dukamp Leite  Premium.doc",
              evidence_id: "D046-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D046",
            },
          ],
          source_id: "D046",
          tipo: "garantia_entre_blocos",
        },
        {
          descricao:
            "ZINCO: tabela técnica = 5000 mg; anexo = ZINCOmín50000mg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Mineral Linha S - Dukamp Leite  Premium.doc",
              evidence_id: "D046-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D046",
            },
          ],
          source_id: "D046",
          tipo: "garantia_entre_blocos",
        },
        {
          descricao:
            "FLÚOR: tabela técnica = 900 mg; anexo = FLÚORmáx1042mg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Mineral Linha S - Dukamp Leite  Premium.doc",
              evidence_id: "D046-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D046",
            },
          ],
          source_id: "D046",
          tipo: "garantia_entre_blocos",
        },
      ],
      classificacao_documental: "SUPLEMENTO MINERAL DE PRONTO USO PARA BOVINOS",
      composicao_documental:
        "fosfato bicálcico, calcário calcítico, carbonato de cálcio, óxido de magnésio, cloreto de sódio (sal comum) 25%, sulfato de cálcio, sulfato de cobalto, sulfato de cobre, iodato de cálcio, sulfato de ferro, sulfato de manganês, selenito de sódio, sulfato de zinco, vitamina a, vitamina d3, vitamina e.",
      descricao_documental:
        "Suplemento mineral de pronto uso, indicado para bovinos de leiteiros nas fases de crescimento, gestação e/ou lactação criados a pasto ou estabulados.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P046_dukamp-leite-premium/fontes/D046.doc",
          arquivo_original: "RTPI/RTPI - Mineral Linha S - Dukamp Leite  Premium.doc",
          sha256: "61d3674430cf3e1d462a1f593f99ec26f5b1fe909607a6159047d9b036d9cca0",
          source_id: "D046",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "DUKAMP  LEITE PREMIUM já é pronto para uso, bastando despejar o produto em cochos e deixar à disposição permanente dos animais. Preferencialmente, recomenda-se o uso de cochos cobertos e com espaço mínimo de 3 a 5 cm por cabeça suplementada. Não fornecer o produto para ovinos. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP LEITE PREMIUM",
      principal_documental_source_id: "D046",
      produto_id: "P046",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "c75e582f0685ef94dc9e72dc50afda89eb3e19ba1d482e835bdd75c82e4820cb",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP LEITE/S", "RTPI - Mineral Linha S - Dukamp Leite S"],
      bloqueios: [],
      classificacao_documental: "SUPLEMENTO MINERAL DE PRONTO USO PARA BOVINOS",
      composicao_documental:
        "fosfato bicálcico, calcário calcítico, carbonato de cálcio, óxido de magnésio, cloreto de sódio (sal comum) 25%, sulfato de cálcio, sulfato de cobalto, sulfato de cobre, iodato de cálcio, sulfato de ferro, sulfato de manganês, selenito de sódio, sulfato de zinco.",
      descricao_documental:
        "Suplemento mineral de pronto uso, indicado para bovinos de leiteiros nas fases de crescimento, gestação e/ou lactação criados a pasto ou estabulados.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P047_dukamp-leite-s/fontes/D047.doc",
          arquivo_original: "RTPI/RTPI - Mineral Linha S - Dukamp Leite S.doc",
          sha256: "aead92e1130174e66efe1c11202c851141a5f231e214be38cc17cb3e8b0c1dd0",
          source_id: "D047",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "DUKAMP LEITE/S já é pronto para uso, bastando despejar o produto em cochos e deixar à disposição permanente dos animais. Preferencialmente, recomenda-se o uso de cochos cobertos e com espaço mínimo de 3 a 5 cm por cabeça suplementada. Não fornecer o produto para ovinos. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP LEITE/S",
      principal_documental_source_id: "D047",
      produto_id: "P047",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "a4c3a58d6f20ab22741e1b85d92bf1fbeebb6a486366e67ed45da615f3db5de5",
    kind: "catalog",
    product: {
      aliases: [
        "DUKAMP NÚCLEO CONFINAMENTO (ADALDIO J.C.F.)",
        "RTPI - N£cleo - N£cleo Confinamento (Adaldio J.C.F)",
      ],
      bloqueios: [],
      classificacao_documental: "NÚCLEO PARA BOVINOS EM CONFINAMENTO",
      composicao_documental:
        "Carbonato de cálcio, óxido de magnésio, enxofre ventilado (flor-de-enxofre), sulfato de cobalto, sulfato de cobre, iodato de cálcio, sulfato de ferro, sulfato de manganês, selenito de sódio, sulfato de zinco, vitamina A, promotor de crescimento e eficiência alimentar.",
      descricao_documental:
        "Núcleo mineral para formulação de dietas para bovinos em confinamento.",
      fontes: [
        {
          arquivo_no_pacote:
            "produtos/P062_dukamp-nucleo-confinamento-adaldio-j-c-f/fontes/D062.doc",
          arquivo_original: "RTPI/RTPI - N£cleo - N£cleo Confinamento (Adaldio J.C.F).doc",
          sha256: "6b4206182b51cfde02e650bb42b2f128ca73a0e5b09bd8622ff7a00645f553ba",
          source_id: "D062",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Uso exclusivo para formulação de dietas para bovinos em confinamento. Garantir consumo de 100 gramas/cab/dia. Não fornecer puro aos animais.",
      nome_comercial_documental: "DUKAMP NÚCLEO CONFINAMENTO (ADALDIO J.C.F.)",
      principal_documental_source_id: "D062",
      produto_id: "P062",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Uso exclusivo para formulação de dietas para bovinos em confinamento.\nNão fornecer puro aos animais.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "0369b42ab5fd29844d88939ed1be7e313c9ca96670070fbfea52bec74eaff996",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP NÚCLEO CONFINAMENTO (CASTILHO)", "RTPI - N£cleo - N£cleo Conf. (castilho)"],
      bloqueios: [],
      classificacao_documental: "NÚCLEO PARA BOVINOS EM CONFINAMENTO",
      composicao_documental:
        "Carbonato de cálcio, enxofre ventilado (flor-de-enxofre), sulfato de cobalto, sulfato de cobre, iodato de cálcio,  selenito de sódio, vitamina A, monesina sódica,cloreto de sódio.",
      descricao_documental:
        "Núcleo mineral para formulação de dietas para bovinos em confinamento.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P061_dukamp-nucleo-confinamento-castilho/fontes/D061.doc",
          arquivo_original: "RTPI/RTPI - N£cleo - N£cleo Conf. (castilho).doc",
          sha256: "f05a4c18f3557c31011758c8c30d95f889cbbee654a795eb900cfbc81f24f74d",
          source_id: "D061",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Uso exclusivo para formulação de dietas para bovinos em confinamento. Garantir consumo de 100 gramas/cab/dia. Não fornecer puro aos animais.",
      nome_comercial_documental: "DUKAMP NÚCLEO CONFINAMENTO (CASTILHO)",
      principal_documental_source_id: "D061",
      produto_id: "P061",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Uso exclusivo para formulação de dietas para bovinos em confinamento.\nNão fornecer puro aos animais.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "20684394ba16ccf1a6a6b80f0f7d173d6dd2af99b28f1f76e7df59925b7084cc",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP OVINOS", "RTPI - Mineral Tradicional - Dukamp Ovinos"],
      bloqueios: [],
      classificacao_documental: "SUPLEMENTO MINERAL DE PRONTO USO PARA OVINOS",
      composicao_documental:
        "calcário calcítico, fosfato bicálcico, iodato de cálcio, óxido de magnésio, sulfato de zinco, selenito de sódio, sulfato de cobalto, sulfato de ferro, cloreto de sódio (sal comum) - 31%, enxofre ventilado (flor de enxofre),sulfato de calcio, palatabilizante, sulfato de manganês.",
      descricao_documental:
        "Suplemento mineral de pronto uso indicado para todas as categorias de ovinos, em suas várias fases de atividade e desenvolvimento.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P059_dukamp-ovinos/fontes/D059.doc",
          arquivo_original: "RTPI/RTPI - Mineral Tradicional - Dukamp Ovinos.doc",
          sha256: "f789de42e6c018c5cb5fe606faf5348119ba2529b17f95508f1d6d7aa4360c0c",
          source_id: "D059",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "DUKAMP OVINOS já é pronto para uso, bastando despejar o produto em cochos e deixar à disposição permanente dos animais. Preferencialmente, recomenda-se o uso de cochos cobertos e com espaço mínimo de 3 a 5 cm por cabeça suplementada. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP OVINOS",
      principal_documental_source_id: "D059",
      produto_id: "P059",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "(nenhuma)",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "cf202e551bf9f954f41a43706c35bcc1687af017b692bafaea3170a1192671ac",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP PROT. ÁGUAS PREMIUM", "RTPI - Proteinados - Prot. Águas Premium"],
      bloqueios: [
        {
          descricao:
            "Faixa de 150 a 200 g/100 kg de peso corporal com média de 100 g/100 kg. A média está fora da faixa. Confirmar faixa e média antes de calcular consumo.",
          referencias: [
            {
              arquivo_original:
                "RTPI/Produtos mais Vendidos/RTPI - Proteinados - Prot. Águas Premium.doc",
              evidence_id: "D014-S12",
              pagina_pdf_inicio: null,
              secao_numero_original: 12,
              secao_semantica: "Modo de usar",
              source_id: "D014",
            },
          ],
          source_id: "D014",
          tipo: "dose",
        },
      ],
      classificacao_documental: "SUPLEMENTO MINERAL PROTÉICO DE PRONTO USO PARA BOVINOS DE CORTE",
      composicao_documental:
        "RÓTULO: milho integral moído, farelo de algodão, carbonato de cálcio, cloreto de sódio (sal comum) - 17,9 %, fosfato bicálcico, uréia pecuária, premix mineral. Produto poderá conter milho (1,2,4,5), soja (1,2,3,4) ou algodão (1,2,4,5,6) transgênicos. Espécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes; 5- Zea mays; 6- Streptomyces hygroscopicus.",
      descricao_documental:
        "Produto pronto para uso, indicado para suplementação mineral protéica de bovinos de corte acima de 4 meses de idade, nas fases de cria, recria e engorda, sob pastagens, na estação chuvosa do ano.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P014_dukamp-prot-aguas-premium/fontes/D014.doc",
          arquivo_original:
            "RTPI/Produtos mais Vendidos/RTPI - Proteinados - Prot. Águas Premium.doc",
          sha256: "a642ae957b5e6ba918b2c83da5e9da87aa1d57ba34647c73f889e3dc21bab379",
          source_id: "D014",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Dukamp Prot. Águas Premium já vem pronto para uso bastando despejar o produto em cochos e deixar à disposição permanente dos animais. \nEste produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. O uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. Não fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. Recomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que seco e de baixa qualidade. Não fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. Também não fornecer o produto para eqüídeos, ovinos ou vacas leiteiras. \nPara adaptação dos animais ao início do uso de suplementos contendo uréia, é recomendado misturar o produto com sal branco ou um suplemento mineral qualquer na proporção de 1:2 na primeira semana, misturar na proporção de 2:1 na segunda semana e usar o produto dukamp protéico seca puro a partir da terceira semana. \nConsumo esperado de 150 a 200 gramas do produto para cada 100 kg de peso corporal (média de 100 gramas para cada 100 kg de peso corporal), desde que atendidas as especificações de manejo recomendadas. \nPorventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. \nEm caso de dúvidas ou intoxicações, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP PROT. ÁGUAS PREMIUM",
      principal_documental_source_id: "D014",
      produto_id: "P014",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. \nO uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. \nNão fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. \nRecomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que seco e de baixa qualidade. \nNão fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. \nTambém não fornecer o produto para eqüídeos, ovinos ou vacas leiteiras.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "81771157e8d3d90b5e8fa6c49add2d30c3a03590da44f5f2a4ff1f7d2b2b48e4",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP PROT. SECA PREMIUM", "RTPI - Proteinados - Prot.  Seca Premium"],
      bloqueios: [
        {
          descricao:
            "Faixa de 150 a 200 g/100 kg de peso corporal com média de 100 g/100 kg. A média está fora da faixa. Confirmar faixa e média antes de calcular consumo.",
          referencias: [
            {
              arquivo_original:
                "RTPI/Produtos mais Vendidos/RTPI - Proteinados - Prot.  Seca Premium.doc",
              evidence_id: "D013-S12",
              pagina_pdf_inicio: null,
              secao_numero_original: 12,
              secao_semantica: "Modo de usar",
              source_id: "D013",
            },
          ],
          source_id: "D013",
          tipo: "dose",
        },
      ],
      classificacao_documental: "SUPLEMENTO MINERAL PROTÉICO DE PRONTO USO PARA BOVINOS DE CORTE",
      composicao_documental:
        "RÓTULO: milho integral moído, farelo de algodão, carbonato de cálcio, cloreto de sódio (sal comum) - 17,9 %, fosfato bicálcico, uréia pecuária, premix mineral. Produto poderá conter milho (1,2,4,5), soja (1,2,3,4) ou algodão (1,2,4,5,6) transgênicos. Espécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes; 5- Zea mays; 6- Streptomyces hygroscopicus.",
      descricao_documental:
        "Produto pronto para uso, indicado para suplementação mineral protéica de bovinos de corte acima de 4 meses de idade, nas fases de cria, recria e engorda, sob pastagens, na estação seca do ano.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P013_dukamp-prot-seca-premium/fontes/D013.doc",
          arquivo_original:
            "RTPI/Produtos mais Vendidos/RTPI - Proteinados - Prot.  Seca Premium.doc",
          sha256: "4bff5db35fd09aa2136eaf0067e76633d255f374769c78f5a14a6624d6b4302b",
          source_id: "D013",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Dukamp Prot. Seca Premium já vem pronto para uso bastando despejar o produto em cochos e deixar à disposição permanente dos animais. \nEste produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. O uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. Não fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. Recomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que seco e de baixa qualidade. Não fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. Também não fornecer o produto para eqüídeos, ovinos ou vacas leiteiras. \nPara adaptação dos animais ao início do uso de suplementos contendo uréia, é recomendado misturar o produto com sal branco ou um suplemento mineral qualquer na proporção de 1:2 na primeira semana, misturar na proporção de 2:1 na segunda semana e usar o produto dukamp protéico seca puro a partir da terceira semana. \nConsumo esperado de 150 a 200 gramas do produto para cada 100 kg de peso corporal (média de 100 gramas para cada 100 kg de peso corporal), desde que atendidas as especificações de manejo recomendadas. \nPorventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. \nEm caso de dúvidas ou intoxicações, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP PROT. SECA PREMIUM",
      principal_documental_source_id: "D013",
      produto_id: "P013",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. \nO uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. \nNão fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. \nRecomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que seco e de baixa qualidade. \nNão fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. \nTambém não fornecer o produto para eqüídeos, ovinos ou vacas leiteiras.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "b904e084d22c1d76f03e4ad6195872a9700c70ebef819fae7972cb042487626e",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP PROTÉICO 50", "RTPI - Proteinados - Dukamp Prot‚ico 50"],
      bloqueios: [],
      classificacao_documental: "SUPLEMENTO MINERAL PROTÉICO DE PRONTO USO PARA BOVINOS DE CORTE",
      composicao_documental:
        "milho integral moído, uréia pecuária, farelo de trigo, casca de soja moída, levedura seca de cana de açúcar, refinazil, farelo de soja, farelo de girassol com casca, farelo de algodão, melaço, iodato de cálcio, sulfato de ferro, sulfato de zinco, sulfato de cobre, sulfato de cobalto, sulfato de manganês, selenito de sódio, fosfato monoamônio, carbonato de cálcio, fosfato bicálcico, enxofre ventilado (flor de enxofre), oxido de magnésio, sulfato de cálcio, cloreto de sódio (sal comum) - 24,5%.  Espécie doadora de genes: *Bacillus thuringiensis;  **Agrobacterium tumefaciens",
      descricao_documental:
        "Produto pronto para uso, indicado para suplementação mineral protéica de bovinos de corte acima de 4 meses de idade, nas fases de de cria, recria e engorda, sob pastagens, na estação seca do ano.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P079_dukamp-proteico-50/fontes/D079.doc",
          arquivo_original: "RTPI/RTPI - Proteinados - Dukamp Prot‚ico 50.doc",
          sha256: "08f13d33494cdc7a8a9838a920d73d2191fcac712d5f0f0e92a89758c6444e17",
          source_id: "D079",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "O suplemento DUKAMP PROTÉICO 50 já vem pronto para uso bastando despejar o produto em cochos e deixar à disposição permanente dos animais. Este produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. O uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. Não fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. Recomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que seco e de baixa qualidade. Não fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. Também não fornecer o produto para eqüídeos e/ou ovinos. Para adaptação dos animais ao início do uso de suplementos contendo uréia, é recomendado misturar o produto com sal branco ou um suplemento mineral qualquer na proporção de 1:2 na primeira semana, misturar na proporção de 2:1 na segunda semana e usar o produto DUKAMP PROTÉICO 50 puro a partir da terceira semana. Consumo esperado de 50 a 150 gramas do produto para cada 100 kg de peso corporal, desde que atendidas as especificações de manejo recomendadas. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. Em caso de dúvidas ou intoxicações, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP PROTÉICO 50",
      principal_documental_source_id: "D079",
      produto_id: "P079",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. \nO uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. \nNão fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. \nRecomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que seco e de baixa qualidade. \nNão fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. \nTambém não fornecer o produto para eqüídeos e/ou ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "d3790f50b2a7140067d62af3e16285bec0f41149c4aeb12c600b5fd32f2a37ea",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP PROTÉICO 60", "RTPI - Proteinados - Dukamp Prot‚ico 60"],
      bloqueios: [],
      classificacao_documental: "SUPLEMENTO MINERAL PROTÉICO DE PRONTO USO PARA BOVINOS DE CORTE",
      composicao_documental:
        "Milho integral moído, farelo de trigo, casca de soja moída, farelo de glúten de milho - 60, farelo de soja, melaço, uréia pecuária, refinazil, farelo de girassol com casca, farelo de algodão, carbonato de cálcio, fosfato monoamônio, fosfato bicálcico, premix mineral, cloreto de sódio (sal comum) - 29,5%. Produto poderá conter milho (1,2,4,5), soja (1,2,3,4) ou algodão (1,2,4,5,6) transgênicos. Espécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes; 5- Zea mays; 6- Streptomyces hygroscopicus.",
      descricao_documental:
        "Suplemento mineral protéico pronto para uso, indicado para suplementação mineral protéica de bovinos de corte acima de 4 meses de idade, nas fases de de cria, recria e engorda, sob pastagens, na estação seca do ano.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P080_dukamp-proteico-60/fontes/D080.doc",
          arquivo_original: "RTPI/RTPI - Proteinados - Dukamp Prot‚ico 60.doc",
          sha256: "358f03bc1cac1bcb41cf41715e0d9f9d331b8a7e1493e57e9ab633d005497d5b",
          source_id: "D080",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "O suplemento Dukamp Protéico 60 já vem pronto para uso, bastando despejar o produto em cochos e deixar à disposição permanente dos animais. Este produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. O uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. Não fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. Recomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que seco e de baixa qualidade. Não fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. Também não fornecer o produto para eqüídeos e/ou ovinos. Para adaptação dos animais ao início do uso de suplementos contendo uréia, é recomendado misturar o produto com sal branco ou um suplemento mineral qualquer na proporção de 1:2 na primeira semana, misturar na proporção de 2:1 na segunda semana e usar Dukamp Protéico 60 puro a partir da terceira semana. Consumo esperado de 50 a 150 gramas do produto para cada 100 kg de peso corporal, desde que atendidas as especificações de manejo recomendadas. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. Em caso de dúvidas ou intoxicações, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP PROTÉICO 60",
      principal_documental_source_id: "D080",
      produto_id: "P080",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. \nO uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. \nNão fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. \nRecomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que seco e de baixa qualidade. \nNão fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. \nTambém não fornecer o produto para eqüídeos e/ou ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "67598468f988d961fd0da17f3f7d501a88a199d2626163bb1f890cadf478e203",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP PROTÉICO ÁGUAS", "RTPI - Proteinados - Dukamp Protéico Águas"],
      bloqueios: [],
      classificacao_documental: "SUPLEMENTO MINERAL PROTÉICO DE PRONTO USO PARA BOVINOS DE CORTE",
      composicao_documental:
        "farelo de soja, milho integral moído, farelo de algodão, carbonato de cálcio, cloreto de sódio (sal comum) - 25%, fosfato bicálcico, uréia pecuária, premix mineral, farelo de trigo. \nProduto poderá conter milho1,2,4,5, soja1,2,3,4 ou algodão1,2,4,5,6 transgênicos.\nEspécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes;  5- Zea mays; 6- Streptomyces hygroscopicus.",
      descricao_documental:
        "Produto pronto para uso, indicado para suplementação mineral protéica de bovinos de corte acima de 4 meses de idade, nas fases de cria, recria e engorda, sob pastagens, na estação chuvosa do ano.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P086_dukamp-proteico-aguas/fontes/D086.doc",
          arquivo_original: "RTPI/RTPI - Proteinados - Dukamp Protéico Águas.doc",
          sha256: "df23e309278061b81dcc1f45eb913025f9235beb36488436f21ca9ff0ab23aed",
          source_id: "D086",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Dukamp Protéico Águas já vem pronto para uso bastando despejar o produto em cochos e deixar à disposição permanente dos animais. Este produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. O uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. Não fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. Recomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que de baixa qualidade. Não fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. Também não fornecer o produto para eqüídeos, ovinos e/ou bovinos leiteiros. Para adaptação dos animais ao início do uso de suplementos contendo uréia, é recomendado misturar o produto com sal branco ou um suplemento mineral qualquer na proporção de 1:2 na primeira semana, misturar na proporção de 2:1 na segunda semana e usar o produto Dukamp Protéico Águas puro a partir da terceira semana. Consumo esperado de 50 a 150 gramas do produto para cada 100 kg de peso corporal (média de 100 gramas para cada 100 kg de peso corporal), desde que atendidas as especificações de manejo recomendadas. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. Em caso de dúvidas ou intoxicações, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP PROTÉICO ÁGUAS",
      principal_documental_source_id: "D086",
      produto_id: "P086",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. \nO uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. \nNão fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. \nManter boa disponibilidade de pasto, mesmo que de baixa qualidade. \nNão fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. \nTambém não fornecer o produto para eqüídeos, ovinos e/ou bovinos leiteiros.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "14fe448341c1bfd8d3123b06e72108186e4d9a9949632e6f311333c007e4f462",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP PROTÉICO AGUAS AC", "RTPI - Proteinados - Dukamp Prot‚ico Aguas AC"],
      bloqueios: [
        {
          descricao:
            "O produto se chama Protéico Águas AC, mas a indicação textual especifica período da seca. Não selecionar a estação com base no nome. Confirmar a indicação vigente.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Proteinados - Dukamp Prot‚ico Aguas AC.doc",
              evidence_id: "D081-S02",
              pagina_pdf_inicio: null,
              secao_numero_original: 2,
              secao_semantica: "Nome comercial",
              source_id: "D081",
            },
            {
              arquivo_original: "RTPI/RTPI - Proteinados - Dukamp Prot‚ico Aguas AC.doc",
              evidence_id: "D081-S11",
              pagina_pdf_inicio: null,
              secao_numero_original: 11,
              secao_semantica: "Indicação e espécie",
              source_id: "D081",
            },
          ],
          source_id: "D081",
          tipo: "estacao",
        },
        {
          descricao:
            "O documento conserva mais de um bloco/versão de rótulo. As garantias são mantidas por bloco e não representam uma única tabela liberada.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Proteinados - Dukamp Prot‚ico Aguas AC.doc",
              evidence_id: "D081-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 8,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D081",
            },
          ],
          source_id: "D081",
          tipo: "multiplos_blocos_de_garantia",
        },
      ],
      classificacao_documental: "SUPLEMENTO MINERAL PROTÉICO DE PRONTO USO PARA BOVINOS DE CORTE",
      composicao_documental:
        "Farelo de algodão, farelo de soja, polpa cítrica, farelo de trigo, fosfato bicálcico, carbonato de cálcio, cloreto de sódio (sal comum), milho integral moído, uréia pecuária, premix mineral. Produto poderá conter milho (1,2,4,5), soja (1,2,3,4) ou algodão (1,2,4,5,6) transgênicos. Espécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes; 5- Zea mays; 6- Streptomyces hygroscopicus",
      descricao_documental:
        "Suplemento mineral protéico pronto para uso, indicado para suplementação de bovinos de corte semi confinados ou suplementados a campo, no período da seca.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P081_dukamp-proteico-aguas-ac/fontes/D081.doc",
          arquivo_original: "RTPI/RTPI - Proteinados - Dukamp Prot‚ico Aguas AC.doc",
          sha256: "30cf9bd0db4ac37e95ae3ed6105cde781fc6793610253d941049225c58f2c885",
          source_id: "D081",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer o produto calculado na proporção de 300 a 500 gramas para cada 100 kg de peso vivo, limitando ao máximo de 2 kg por cabeça por dia, dependendo da qualidade do volumoso, estado corporal dos animais, estágio de desenvolvimento e do desempenho esperado. Como o produto contém sal comum em sua fórmula, espera-se que a ingestão fique distribuída durante o dia, não sendo necessário fracionar o fornecimento em mais de um trato diário. O produto contém uréia e, portanto, deve ser fornecido em cochos cobertos e/ou que evitem acúmulo de água. O uso de uréia adicional é contraindicado, salvo quando prescrito por profissional habilitado. Não fornecer este produto para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos e debilitados. Manter boa disponibilidade de alimento volumoso para os animais, mesmo que de baixa qualidade. Para  adaptar os animais ao uso do produto, iniciar fornecendo quantidades crescentes até atingir a quantia recomendada dentro de 10 dias, substituindo completamente o suplemento mineral ou o sal proteinado convencional. Espaçamento de cocho necessário: entre 15 e 30 cm por cabeça suplementada. Não fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula. Também não fornecer o produto para eqüídeos, ovinos ou vacas leiteiras. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia.",
      nome_comercial_documental: "DUKAMP PROTÉICO AGUAS AC",
      principal_documental_source_id: "D081",
      produto_id: "P081",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "O produto contém uréia e, portanto, deve ser fornecido em cochos cobertos e/ou que evitem acúmulo de água. \nO uso de uréia adicional é contraindicado, salvo quando prescrito por profissional habilitado. \nNão fornecer este produto para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos e debilitados. \nManter boa disponibilidade de alimento volumoso para os animais, mesmo que de baixa qualidade. \nNão fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula. \nTambém não fornecer o produto para eqüídeos, ovinos ou vacas leiteiras.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "044b039f1a38cfba2f483d8a0c6edbd438969266628d98480e0d232831d83fa8",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP PROTÉICO ÁGUAS TOP", "RTPI - Proteinados - Dukamp Protéico Águas Top"],
      bloqueios: [],
      classificacao_documental: "SUPLEMENTO MINERAL PROTÉICO DE PRONTO USO PARA BOVINOS DE CORTE",
      composicao_documental:
        "farelo de soja, milho integral moído, farelo de algodão, carbonato de cálcio, cloreto de sódio (sal comum) - 25%, fosfato bicálcico, uréia pecuária, premix mineral, farelo de trigo. \nProduto poderá conter milho1,2,4,5, soja1,2,3,4 ou algodão1,2,4,5,6 transgênicos.\nEspécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes;  5- Zea mays; 6- Streptomyces hygroscopicus.",
      descricao_documental:
        "Produto pronto para uso, indicado para suplementação mineral protéica de bovinos de corte acima de 4 meses de idade, nas fases de cria, recria e engorda, sob pastagens, na estação chuvosa do ano.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P085_dukamp-proteico-aguas-top/fontes/D085.doc",
          arquivo_original: "RTPI/RTPI - Proteinados - Dukamp Protéico Águas Top.doc",
          sha256: "86aba58e1d50f6f3d9a5be67415289282a893b6d96b6be35a162edcaa11b3df4",
          source_id: "D085",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Dukamp Protéico Águas Top já vem pronto para uso bastando despejar o produto em cochos e deixar à disposição permanente dos animais. Este produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. O uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. Não fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. Recomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que de baixa qualidade. Não fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. Também não fornecer o produto para eqüídeos, ovinos e/ou bovinos leiteiros. Para adaptação dos animais ao início do uso de suplementos contendo uréia, é recomendado misturar o produto com sal branco ou um suplemento mineral qualquer na proporção de 1:2 na primeira semana, misturar na proporção de 2:1 na segunda semana e usar o produto Dukamp Protéico Águas puro a partir da terceira semana. Consumo esperado de 50 a 150 gramas do produto para cada 100 kg de peso corporal (média de 100 gramas para cada 100 kg de peso corporal), desde que atendidas as especificações de manejo recomendadas. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. Em caso de dúvidas ou intoxicações, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP PROTÉICO ÁGUAS TOP",
      principal_documental_source_id: "D085",
      produto_id: "P085",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. \nO uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. \nNão fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. \nManter boa disponibilidade de pasto, mesmo que de baixa qualidade. \nNão fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. \nTambém não fornecer o produto para eqüídeos, ovinos e/ou bovinos leiteiros.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "6cf09e3113859ab2870e09c02ffb9ccb4b83d7b9e9aff108d250d56a9435aed9",
    kind: "catalog",
    product: {
      aliases: [
        "DUKAMP PROTEICO PREMIUM 35 KIM TAVARES",
        "RTPI - Proteinados - Dukamp Premium 35 Kim Tavares",
      ],
      bloqueios: [
        {
          descricao:
            "O modo de usar cita Dukamp Transição 35 no relatório Premium 35 Kim Tavares. Confirmar que o protocolo pertence à variante.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Proteinados - Dukamp Premium 35 Kim Tavares.doc",
              evidence_id: "D078-S02",
              pagina_pdf_inicio: null,
              secao_numero_original: 2,
              secao_semantica: "Nome comercial",
              source_id: "D078",
            },
            {
              arquivo_original: "RTPI/RTPI - Proteinados - Dukamp Premium 35 Kim Tavares.doc",
              evidence_id: "D078-S12",
              pagina_pdf_inicio: null,
              secao_numero_original: 12,
              secao_semantica: "Modo de usar",
              source_id: "D078",
            },
          ],
          source_id: "D078",
          tipo: "identidade_adaptacao",
        },
      ],
      classificacao_documental: "SUPLEMENTO MINERAL PROTÉICO DE PRONTO USO PARA BOVINOS DE CORTE",
      composicao_documental:
        "Farelo de trigo, refinazil, farelo de girassol com casca, casca de soja moída, milho integral moído, farelo de soja, polpa cítrica, melaço, levedura seca de cana de açúcar, farelo de algodão, uréia pecuária, monensna sódica, carbonato de cálcio, fosfato bicálcico, cloreto de sódio (sal comum) - 25%, premix mineral. Produto poderá conter milho (1,2,4,5), soja (1,2,3,4) ou algodão (1,2,4,5,6) transgênicos. Espécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes; 5- Zea mays; 6- Streptomyces hygroscopicus.",
      descricao_documental:
        "Suplemento mineral protéico pronto para uso, indicado para bovinos de corte acima de 4 meses de idade, nas fases de de cria, recria e engorda, sob pastagens, no início e no final da estação seca do ano.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P078_dukamp-proteico-premium-35-kim-tavares/fontes/D078.doc",
          arquivo_original: "RTPI/RTPI - Proteinados - Dukamp Premium 35 Kim Tavares.doc",
          sha256: "ace8598318c975a4ebdfbc877014df7341830a60a6efd68ff69be3222531bf54",
          source_id: "D078",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Dukamp Premium 35 Kim Tavares 35 já vem pronto para uso bastando despejar o produto em cochos e deixar à disposição permanente dos animais. Este produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. O uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. Não fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. Recomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que de baixa qualidade. Não fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. Também não fornecer o produto para eqüídeos e/ou ovinos. Para adaptação dos animais ao início do uso de suplementos contendo uréia, é recomendado misturar o produto com sal branco ou um suplemento mineral qualquer na proporção de 1:2 na primeira semana, misturar na proporção de 2:1 na segunda semana e usar o produto Dukamp Transição 35 puro a partir da terceira semana. Consumo esperado de 50 a 150 gramas do produto para cada 100 kg de peso corporal, desde que atendidas as especificações de manejo recomendadas. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. Em caso de dúvidas ou intoxicações, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP PROTEICO PREMIUM 35 KIM TAVARES",
      principal_documental_source_id: "D078",
      produto_id: "P078",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. \nO uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. \nNão fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. \nRecomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que de baixa qualidade. \nNão fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. \nTambém não fornecer o produto para eqüídeos e/ou ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "809bcb56fe536a83a7454942eb7b4bc28c43667fea22f9fcc74dbff5aca12bd2",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP PROTÉICO SECA", "RTPI - Proteinados - Dukamp Prot‚ico Seca"],
      bloqueios: [],
      classificacao_documental: "SUPLEMENTO MINERAL PROTÉICO DE PRONTO USO PARA BOVINOS DE CORTE",
      composicao_documental:
        "milho integral moído, farelo de algodão, carbonato de cálcio, cloreto de sódio (sal comum) - 25%, fosfato bicálcico, uréia pecuária, premix mineral. Produto poderá conter milho (1,2,4,5), soja (1,2,3,4) ou algodão (1,2,4,5,6) transgênicos. Espécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes; 5- Zea mays; 6- Streptomyces hygroscopicus.",
      descricao_documental:
        "Produto pronto para uso, indicado para suplementação mineral protéica de bovinos de corte acima de 4 meses de idade, nas fases de cria, recria e engorda, sob pastagens, na estação seca do ano.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P083_dukamp-proteico-seca/fontes/D083.doc",
          arquivo_original: "RTPI/RTPI - Proteinados - Dukamp Prot‚ico Seca.doc",
          sha256: "a0fe2329ba81a4e5974f4f6c8516c90e9e0176ca72fad9f2accafcee4b58b89e",
          source_id: "D083",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Dukamp Protéico Seca já vem pronto para uso bastando despejar o produto em cochos e deixar à disposição permanente dos animais. \nEste produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. O uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. Não fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. Recomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que seco e de baixa qualidade. Não fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. Também não fornecer o produto para eqüídeos, ovinos ou vacas leiteiras. \nPara adaptação dos animais ao início do uso de suplementos contendo uréia, é recomendado misturar o produto com sal branco ou um suplemento mineral qualquer na proporção de 1:2 na primeira semana, misturar na proporção de 2:1 na segunda semana e usar o produto dukamp protéico seca puro a partir da terceira semana. \nConsumo esperado de 50 a 150 gramas do produto para cada 100 kg de peso corporal (média de 100 gramas para cada 100 kg de peso corporal), desde que atendidas as especificações de manejo recomendadas. \nPorventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. \nEm caso de dúvidas ou intoxicações, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP PROTÉICO SECA",
      principal_documental_source_id: "D083",
      produto_id: "P083",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. \nO uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. \nNão fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. \nRecomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que seco e de baixa qualidade. \nNão fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. \nTambém não fornecer o produto para eqüídeos, ovinos ou vacas leiteiras.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "b83b7e5559c50d1c78837685095112e6454c899d77bd743e45099b0f3c635229",
    kind: "catalog",
    product: {
      aliases: [
        "DUKAMP PROTÉICO SECA 24 AC ESPECIAL",
        "RTPI - Proteinados - Dukamp Prot‚ico Seca 24 AC",
      ],
      bloqueios: [
        {
          descricao:
            "O documento conserva mais de um bloco/versão de rótulo. As garantias são mantidas por bloco e não representam uma única tabela liberada.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Proteinados - Dukamp Prot‚ico Seca 24 AC.doc",
              evidence_id: "D082-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 8,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D082",
            },
          ],
          source_id: "D082",
          tipo: "multiplos_blocos_de_garantia",
        },
      ],
      classificacao_documental: "SUPLEMENTO MINERAL PROTÉICO DE PRONTO USO PARA BOVINOS DE CORTE",
      composicao_documental:
        "Farelo de algodão, farelo de soja, polpa cítrica, farelo de trigo, fosfato bicálcico, carbonato de cálcio, cloreto de sódio (sal comum), milho integral moído, uréia pecuária, premix mineral. Produto poderá conter milho (1,2,4,5), soja (1,2,3,4) ou algodão (1,2,4,5,6) transgênicos. Espécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes; 5- Zea mays; 6- Streptomyces hygroscopicus",
      descricao_documental:
        "Suplemento mineral protéico pronto para uso, indicado para suplementação de bovinos de corte semi confinados ou suplementados a campo, no período da seca.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P082_dukamp-proteico-seca-24-ac-especial/fontes/D082.doc",
          arquivo_original: "RTPI/RTPI - Proteinados - Dukamp Prot‚ico Seca 24 AC.doc",
          sha256: "15d8a2370bd8f8ef87f27bf6ac1e71198efe63cc6332529bf853751d0536874e",
          source_id: "D082",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer o produto calculado na proporção de 300 a 500 gramas para cada 100 kg de peso vivo, limitando ao máximo de 2 kg por cabeça por dia, dependendo da qualidade do volumoso, estado corporal dos animais, estágio de desenvolvimento e do desempenho esperado. Como o produto contém sal comum em sua fórmula, espera-se que a ingestão fique distribuída durante o dia, não sendo necessário fracionar o fornecimento em mais de um trato diário. O produto contém uréia e, portanto, deve ser fornecido em cochos cobertos e/ou que evitem acúmulo de água. O uso de uréia adicional é contraindicado, salvo quando prescrito por profissional habilitado. Não fornecer este produto para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos e debilitados. Manter boa disponibilidade de alimento volumoso para os animais, mesmo que de baixa qualidade. Para  adaptar os animais ao uso do produto, iniciar fornecendo quantidades crescentes até atingir a quantia recomendada dentro de 10 dias, substituindo completamente o suplemento mineral ou o sal proteinado convencional. Espaçamento de cocho necessário: entre 15 e 30 cm por cabeça suplementada. Não fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula. Também não fornecer o produto para eqüídeos, ovinos ou vacas leiteiras. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia.",
      nome_comercial_documental: "DUKAMP PROTÉICO SECA 24 AC ESPECIAL",
      principal_documental_source_id: "D082",
      produto_id: "P082",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "O produto contém uréia e, portanto, deve ser fornecido em cochos cobertos e/ou que evitem acúmulo de água. \nO uso de uréia adicional é contraindicado, salvo quando prescrito por profissional habilitado. \nNão fornecer este produto para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos e debilitados. \nManter boa disponibilidade de alimento volumoso para os animais, mesmo que de baixa qualidade. \nNão fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula. \nTambém não fornecer o produto para eqüídeos, ovinos ou vacas leiteiras.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "277173a3ace1ded7a1c0928382ac3233e57a98ae7d29d64af9613d7c60e6785c",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP PROTÉICO SECA ENGORDA", "RTPI - Proteinados - Prot‚ico Seca Engorda"],
      bloqueios: [],
      classificacao_documental: "SUPLEMENTO MINERAL PROTÉICO DE PRONTO USO PARA BOVINOS DE CORTE",
      composicao_documental:
        "RÓTULO: milho integral moído, farelo de algodão, carbonato de cálcio, cloreto de sódio (sal comum) - 17,9 %, fosfato bicálcico, uréia pecuária, premix mineral. Produto poderá conter milho (1,2,4,5), soja (1,2,3,4) ou algodão (1,2,4,5,6) transgênicos. Espécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes; 5- Zea mays; 6- Streptomyces hygroscopicus.",
      descricao_documental:
        "Produto pronto para uso, indicado para suplementação mineral protéica de bovinos de corte acima de 4 meses de idade, nas fases de cria, recria e engorda, sob pastagens, na estação seca do ano.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P015_dukamp-proteico-seca-engorda/fontes/D015.doc",
          arquivo_original:
            "RTPI/Produtos mais Vendidos/RTPI - Proteinados - Prot‚ico Seca Engorda.doc",
          sha256: "6f6733c8dc4424d4f9720dbbcffe2be01a21dac1dc79108be2f3f740e95bd6c4",
          source_id: "D015",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Dukamp Protéico Seca Engorda já vem pronto para uso bastando despejar o produto em cochos e deixar à disposição permanente dos animais. \nEste produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. O uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. Não fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. Recomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que seco e de baixa qualidade. Não fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. Também não fornecer o produto para eqüídeos, ovinos ou vacas leiteiras. \nPara adaptação dos animais ao início do uso de suplementos contendo uréia, é recomendado misturar o produto com sal branco ou um suplemento mineral qualquer na proporção de 1:2 na primeira semana, misturar na proporção de 2:1 na segunda semana e usar o produto dukamp protéico seca puro a partir da terceira semana. \nConsumo esperado de 50 a 150 gramas do produto para cada 100 kg de peso corporal (média de 100 gramas para cada 100 kg de peso corporal), desde que atendidas as especificações de manejo recomendadas. \nPorventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. \nEm caso de dúvidas ou intoxicações, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP PROTÉICO SECA ENGORDA",
      principal_documental_source_id: "D015",
      produto_id: "P015",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. \nO uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. \nNão fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. \nRecomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que seco e de baixa qualidade. \nNão fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. \nTambém não fornecer o produto para eqüídeos, ovinos ou vacas leiteiras.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "9ae0a16bc1051363cbd41c35745c4dd01d4ba75110890e3695a034a4ade8be61",
    kind: "catalog",
    product: {
      aliases: [
        "DUKAMP PROTÉICO SECA ENGORDA ADITIVADO",
        "RTPI - Proteinados - Prot‚ico Seca Engorda Aditivado",
      ],
      bloqueios: [],
      classificacao_documental: "SUPLEMENTO MINERAL PROTÉICO DE PRONTO USO PARA BOVINOS DE CORTE",
      composicao_documental:
        "RÓTULO: milho integral moído, farelo de algodão, carbonato de cálcio, cloreto de sódio (sal comum) - 17,9 %, fosfato bicálcico, uréia pecuária, premix mineral. Produto poderá conter milho (1,2,4,5), soja (1,2,3,4) ou algodão (1,2,4,5,6) transgênicos. Espécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes; 5- Zea mays; 6- Streptomyces hygroscopicus, monensina sodica",
      descricao_documental:
        "Produto pronto para uso, indicado para suplementação mineral protéica de bovinos de corte acima de 4 meses de idade, nas fases de cria, recria e engorda, sob pastagens, na estação seca do ano.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P091_dukamp-proteico-seca-engorda-aditivado/fontes/D091.doc",
          arquivo_original: "RTPI/RTPI - Proteinados - Prot‚ico Seca Engorda Aditivado.doc",
          sha256: "76728b4630d769a4b786b0eeffdd823c4ae1bc41de6299fa346bf3fb40bcdf9c",
          source_id: "D091",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Dukamp Protéico Seca Engorda já vem pronto para uso bastando despejar o produto em cochos e deixar à disposição permanente dos animais. \nEste produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. O uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. Não fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. Recomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que seco e de baixa qualidade. Não fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. Também não fornecer o produto para eqüídeos, ovinos ou vacas leiteiras. \nPara adaptação dos animais ao início do uso de suplementos contendo uréia, é recomendado misturar o produto com sal branco ou um suplemento mineral qualquer na proporção de 1:2 na primeira semana, misturar na proporção de 2:1 na segunda semana e usar o produto dukamp protéico seca puro a partir da terceira semana. \nConsumo esperado de 50 a 150 gramas do produto para cada 100 kg de peso corporal (média de 100 gramas para cada 100 kg de peso corporal), desde que atendidas as especificações de manejo recomendadas. \nPorventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. \nEm caso de dúvidas ou intoxicações, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP PROTÉICO SECA ENGORDA ADITIVADO",
      principal_documental_source_id: "D091",
      produto_id: "P091",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. \nO uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. \nNão fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. \nRecomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que seco e de baixa qualidade. \nNão fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. \nTambém não fornecer o produto para eqüídeos, ovinos ou vacas leiteiras.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "1e9aa708aae5a9d88655a0ff88f53191172f150fce2318c5da9c4e075b78584a",
    kind: "catalog",
    product: {
      aliases: [
        "DUKAMP PROTÉICO SECA ENGORDA GOLD",
        "RTPI - Proteinados - Prot‚ico Seca Engorda Gold",
      ],
      bloqueios: [],
      classificacao_documental: "SUPLEMENTO MINERAL PROTÉICO DE PRONTO USO PARA BOVINOS DE CORTE",
      composicao_documental:
        "RÓTULO: milho integral moído, farelo de algodão, calcareo calcitico, carbonato de cálcio, cloreto de sódio (sal comum) - 17,9 %, fosfato bicálcico, uréia pecuária, premix mineral. Produto poderá conter milho (1,2,4,5), soja (1,2,3,4) ou algodão (1,2,4,5,6) transgênicos. Espécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes; 5- Zea mays; 6- Streptomyces hygroscopicus.",
      descricao_documental:
        "Produto pronto para uso, indicado para suplementação mineral protéica de bovinos de corte acima de 4 meses de idade, nas fases de cria, recria e engorda, sob pastagens, na estação seca do ano.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P092_dukamp-proteico-seca-engorda-gold/fontes/D092.doc",
          arquivo_original: "RTPI/RTPI - Proteinados - Prot‚ico Seca Engorda Gold.doc",
          sha256: "4fe4efd26712156c4b33fa530c226658d36291cd5f8835a8a3df5d63e9f4deb5",
          source_id: "D092",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Dukamp Protéico Seca Engorda Gold já vem pronto para uso bastando despejar o produto em cochos e deixar à disposição permanente dos animais. \nEste produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. O uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. Não fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. Recomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que seco e de baixa qualidade. Não fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. Também não fornecer o produto para eqüídeos, ovinos ou vacas leiteiras. \nPara adaptação dos animais ao início do uso de suplementos contendo uréia, é recomendado misturar o produto com sal branco ou um suplemento mineral qualquer na proporção de 1:2 na primeira semana, misturar na proporção de 2:1 na segunda semana e usar o produto dukamp protéico seca puro a partir da terceira semana. \nConsumo esperado de 50 a 150 gramas do produto para cada 100 kg de peso corporal (média de 100 gramas para cada 100 kg de peso corporal), desde que atendidas as especificações de manejo recomendadas. \nPorventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. \nEm caso de dúvidas ou intoxicações, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP PROTÉICO SECA ENGORDA GOLD",
      principal_documental_source_id: "D092",
      produto_id: "P092",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. \nO uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. \nNão fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. \nRecomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que seco e de baixa qualidade. \nNão fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. \nTambém não fornecer o produto para eqüídeos, ovinos ou vacas leiteiras.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "cde37438c9bb66b79871ad39fa9b623185e1b5f73c49c9ce4da2562d46b4ecc0",
    kind: "catalog",
    product: {
      aliases: [
        "DUKAMP PROTÉICO SECA ENGORDA TOP",
        "RTPI - Proteinados - Prot‚ico Seca Engorda Top",
      ],
      bloqueios: [
        {
          descricao:
            "COBRE: tabela técnica = 90 mg; anexo = COBREmín900mg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Proteinados - Prot‚ico Seca Engorda Top.doc",
              evidence_id: "D094-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D094",
            },
          ],
          source_id: "D094",
          tipo: "garantia_entre_blocos",
        },
      ],
      classificacao_documental: "SUPLEMENTO MINERAL PROTÉICO DE PRONTO USO PARA BOVINOS DE CORTE",
      composicao_documental:
        "RÓTULO: milho integral moído, farelo de algodão, carbonato de cálcio, cloreto de sódio (sal comum) - 17,9 %, fosfato bicálcico, uréia pecuária, premix mineral. Produto poderá conter milho (1,2,4,5), soja (1,2,3,4) ou algodão (1,2,4,5,6) transgênicos. Espécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes; 5- Zea mays; 6- Streptomyces hygroscopicus.",
      descricao_documental:
        "Produto pronto para uso, indicado para suplementação mineral protéica de bovinos de corte acima de 4 meses de idade, nas fases de cria, recria e engorda, sob pastagens, na estação seca do ano.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P094_dukamp-proteico-seca-engorda-top/fontes/D094.doc",
          arquivo_original: "RTPI/RTPI - Proteinados - Prot‚ico Seca Engorda Top.doc",
          sha256: "88f3b590a66921221dc1033807f6321d1a5213fb60b257ea0d97ff26c79f780c",
          source_id: "D094",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Dukamp Protéico Seca Engorda Top já vem pronto para uso bastando despejar o produto em cochos e deixar à disposição permanente dos animais. \nEste produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. O uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. Não fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. Recomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que seco e de baixa qualidade. Não fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. Também não fornecer o produto para eqüídeos, ovinos ou vacas leiteiras. \nPara adaptação dos animais ao início do uso de suplementos contendo uréia, é recomendado misturar o produto com sal branco ou um suplemento mineral qualquer na proporção de 1:2 na primeira semana, misturar na proporção de 2:1 na segunda semana e usar o produto dukamp protéico seca puro a partir da terceira semana. \nConsumo esperado de 50 a 150 gramas do produto para cada 100 kg de peso corporal (média de 100 gramas para cada 100 kg de peso corporal), desde que atendidas as especificações de manejo recomendadas. \nPorventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. \nEm caso de dúvidas ou intoxicações, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP PROTÉICO SECA ENGORDA TOP",
      principal_documental_source_id: "D094",
      produto_id: "P094",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. \nO uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. \nNão fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. \nRecomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que seco e de baixa qualidade. \nNão fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. \nTambém não fornecer o produto para eqüídeos, ovinos ou vacas leiteiras.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "1e387e02b23726229b45f7717d55fbe6b357364963ef839c9da34e26da416020",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP PROTÉICO SECA ENGORDA/65", "RTPI - Proteinados - Prot‚ico Seca Engorda 65"],
      bloqueios: [],
      classificacao_documental: "SUPLEMENTO MINERAL PROTÉICO DE PRONTO USO PARA BOVINOS DE CORTE",
      composicao_documental:
        "RÓTULO: milho integral moído, farelo de algodão, carbonato de cálcio, cloreto de sódio (sal comum) - 17,9 %, fosfato bicálcico, uréia pecuária, premix mineral. Produto poderá conter milho (1,2,4,5), soja (1,2,3,4) ou algodão (1,2,4,5,6) transgênicos. Espécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes; 5- Zea mays; 6- Streptomyces hygroscopicus.",
      descricao_documental:
        "Produto pronto para uso, indicado para suplementação mineral protéica de bovinos de corte acima de 4 meses de idade, nas fases de cria, recria e engorda, sob pastagens, na estação seca do ano.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P090_dukamp-proteico-seca-engorda-65/fontes/D090.doc",
          arquivo_original: "RTPI/RTPI - Proteinados - Prot‚ico Seca Engorda 65.doc",
          sha256: "eecb283ff2f5b442eb7de429d59fb178195bee7eb591476874af07d9fa7afc99",
          source_id: "D090",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Dukamp Protéico Seca Engorda/65 já vem pronto para uso bastando despejar o produto em cochos e deixar à disposição permanente dos animais. \nEste produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. O uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. Não fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. Recomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que seco e de baixa qualidade. Não fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. Também não fornecer o produto para eqüídeos, ovinos ou vacas leiteiras. \nPara adaptação dos animais ao início do uso de suplementos contendo uréia, é recomendado misturar o produto com sal branco ou um suplemento mineral qualquer na proporção de 1:2 na primeira semana, misturar na proporção de 2:1 na segunda semana e usar o produto dukamp protéico seca puro a partir da terceira semana. \nConsumo esperado de 50 a 150 gramas do produto para cada 100 kg de peso corporal (média de 50 gramas para cada 100 kg de peso corporal), desde que atendidas as especificações de manejo recomendadas. \nPorventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. \nEm caso de dúvidas ou intoxicações, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP PROTÉICO SECA ENGORDA/65",
      principal_documental_source_id: "D090",
      produto_id: "P090",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. \nO uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. \nNão fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. \nRecomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que seco e de baixa qualidade. \nNão fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. \nTambém não fornecer o produto para eqüídeos, ovinos ou vacas leiteiras.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "f28ee24bb2b6b222d238d7254d62e109c90322bb0d766755e754f49bc7224bbe",
    kind: "catalog",
    product: {
      aliases: [
        "DUKAMP PROTÉICO SECA ENGORDA/REPRODUÇÃO NSA",
        "RTPI - Proteinados - Prot‚ico Seca Engorda Nsa",
      ],
      bloqueios: [
        {
          descricao:
            "O nome contém Reprodução NSA, mas as restrições proíbem fornecer a machos reprodutores por conter farelo de algodão. O nome não autoriza uso em touros. Confirmar identidade/composição da variante.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Proteinados - Prot‚ico Seca Engorda Nsa.doc",
              evidence_id: "D093-S02",
              pagina_pdf_inicio: null,
              secao_numero_original: 2,
              secao_semantica: "Nome comercial",
              source_id: "D093",
            },
            {
              arquivo_original: "RTPI/RTPI - Proteinados - Prot‚ico Seca Engorda Nsa.doc",
              evidence_id: "D093-S06",
              pagina_pdf_inicio: null,
              secao_numero_original: 6,
              secao_semantica: "Composição qualitativa",
              source_id: "D093",
            },
            {
              arquivo_original: "RTPI/RTPI - Proteinados - Prot‚ico Seca Engorda Nsa.doc",
              evidence_id: "D093-S12",
              pagina_pdf_inicio: null,
              secao_numero_original: 12,
              secao_semantica: "Modo de usar",
              source_id: "D093",
            },
            {
              arquivo_original: "RTPI/RTPI - Proteinados - Prot‚ico Seca Engorda Nsa.doc",
              evidence_id: "D093-S16",
              pagina_pdf_inicio: null,
              secao_numero_original: 16,
              secao_semantica: "Restrições e recomendações",
              source_id: "D093",
            },
          ],
          source_id: "D093",
          tipo: "categoria_reproducao",
        },
      ],
      classificacao_documental: "SUPLEMENTO MINERAL PROTÉICO DE PRONTO USO PARA BOVINOS DE CORTE",
      composicao_documental:
        "RÓTULO: milho integral moído, farelo de trigo, carbonato de cálcio, cloreto de sódio (sal comum) - 17,9 %, fosfato bicálcico, uréia pecuária, gluten de milho, premix mineral. Produto poderá conter milho (1,2,4,5), soja (1,2,3,4) ou algodão (1,2,4,5,6) transgênicos. Espécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes; 5- Zea mays; 6- Streptomyces hygroscopicus.",
      descricao_documental:
        "Produto pronto para uso, indicado para suplementação mineral protéica de bovinos de corte acima de 4 meses de idade, nas fases de cria, recria e engorda, sob pastagens, na estação seca do ano.",
      fontes: [
        {
          arquivo_no_pacote:
            "produtos/P093_dukamp-proteico-seca-engorda-reproducao-nsa/fontes/D093.doc",
          arquivo_original: "RTPI/RTPI - Proteinados - Prot‚ico Seca Engorda Nsa.doc",
          sha256: "5b6a38fbd5200cfaee6fbc92d01145fcb53d7139674e03fae6c5816b5b722836",
          source_id: "D093",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Dukamp Protéico Seca Engorda/reprodução nsa já vem pronto para uso bastando despejar o produto em cochos e deixar à disposição permanente dos animais. \nEste produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. O uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. Não fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. Recomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que seco e de baixa qualidade. Não fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. Também não fornecer o produto para eqüídeos, ovinos ou vacas leiteiras. \nPara adaptação dos animais ao início do uso de suplementos contendo uréia, é recomendado misturar o produto com sal branco ou um suplemento mineral qualquer na proporção de 1:2 na primeira semana, misturar na proporção de 2:1 na segunda semana e usar o produto dukamp protéico seca puro a partir da terceira semana. \nConsumo esperado de 50 a 150 gramas do produto para cada 100 kg de peso corporal (média de 50 gramas para cada 100 kg de peso corporal), desde que atendidas as especificações de manejo recomendadas. \nPorventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. \nEm caso de dúvidas ou intoxicações, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP PROTÉICO SECA ENGORDA/REPRODUÇÃO NSA",
      principal_documental_source_id: "D093",
      produto_id: "P093",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. \nO uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. \nNão fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. \nRecomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que seco e de baixa qualidade. \nNão fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. \nTambém não fornecer o produto para eqüídeos, ovinos ou vacas leiteiras.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "05c2a5fbe766978389a68b8511c4d22426b0a4ed1ff3c65e32b063fb9a9f9ff5",
    kind: "catalog",
    product: {
      aliases: [
        "DUKAMP PROTÉICO TRANSIÇÃO 30",
        "RTPI - Proteinados - Dukamp Protéico Transição 30",
      ],
      bloqueios: [
        {
          descricao:
            "O documento conserva mais de um bloco/versão de rótulo. As garantias são mantidas por bloco e não representam uma única tabela liberada.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Proteinados - Dukamp Protéico Transição 30.doc",
              evidence_id: "D084-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D084",
            },
          ],
          source_id: "D084",
          tipo: "multiplos_blocos_de_garantia",
        },
      ],
      classificacao_documental: "SUPLEMENTO MINERAL PROTÉICO DE PRONTO USO PARA BOVINOS DE CORTE",
      composicao_documental:
        "farelo de soja, milho integral moído, farelo de algodão, carbonato de cálcio, cloreto de sódio (sal comum) - 25%, fosfato bicálcico, uréia pecuária, premix mineral, farelo de trigo. \nProduto poderá conter milho1,2,4,5, soja1,2,3,4 ou algodão1,2,4,5,6 transgênicos.\nEspécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes;  5- Zea mays; 6- Streptomyces hygroscopicus.",
      descricao_documental:
        "RÓTULO ATUAL: Produto pronto para uso, indicado para suplementação mineral protéica de bovinos de corte cima de 4 meses de idade, nas fases de cria, recria e engorda, sob pastagens, no início e no final da estação seca do ano, quando a qualidade nutricional das pastagens fica prejudicada. NOVO RÓTULO: Suplemento mineral protéico pronto para uso, indicado para suplementação mineral protéica de bovinos de corte acima de 4 meses de idade, nas fases de de cria, recria e engorda, sob pastagens, no início e no final da estação seca do ano.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P084_dukamp-proteico-transicao-30/fontes/D084.doc",
          arquivo_original: "RTPI/RTPI - Proteinados - Dukamp Protéico Transição 30.doc",
          sha256: "36df53167e9158945b566ab9329860a0cfbe7b8c42f91754919ce925e2036b61",
          source_id: "D084",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Dukamp Protéico Transição 30 já vem pronto para uso bastando despejar o produto em cochos e deixar à disposição permanente dos animais. Este produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. O uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. Não fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. Recomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que de baixa qualidade. Não fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. Também não fornecer o produto para eqüídeos e/ou ovinos. Para adaptação dos animais ao início do uso de suplementos contendo uréia, é recomendado misturar o produto com sal branco ou um suplemento mineral qualquer na proporção de 1:2 na primeira semana, misturar na proporção de 2:1 na segunda semana e usar o produto Dukamp Protéico Transição 30 puro a partir da terceira semana. Consumo esperado de 50 a 150 gramas do produto para cada 100 kg de peso corporal, desde que atendidas as especificações de manejo recomendadas. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. Em caso de dúvidas ou intoxicações, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP PROTÉICO TRANSIÇÃO 30",
      principal_documental_source_id: "D084",
      produto_id: "P084",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. \nO uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. \nNão fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. \nNão fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. \nTambém não fornecer o produto para eqüídeos e/ou ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "ec0fc9fbf4c99ea828832dfb7489fcd3fb66411b3f9eac0d1937ea953a20be00",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP PROTÉICO VACAE RECRIA", "RTPI - Proteinados - Prot‚ico Vaca e Recria"],
      bloqueios: [
        {
          descricao:
            "A designação aparece como 'VACAE RECRIA' e o arquivo/modo de usar como Vaca e Recria. Guardar ambas as grafias como aliases e confirmar o nome comercial.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Proteinados - Prot‚ico Vaca e Recria.doc",
              evidence_id: "D096-S02",
              pagina_pdf_inicio: null,
              secao_numero_original: 2,
              secao_semantica: "Nome comercial",
              source_id: "D096",
            },
            {
              arquivo_original: "RTPI/RTPI - Proteinados - Prot‚ico Vaca e Recria.doc",
              evidence_id: "D096-S12",
              pagina_pdf_inicio: null,
              secao_numero_original: 12,
              secao_semantica: "Modo de usar",
              source_id: "D096",
            },
          ],
          source_id: "D096",
          tipo: "identidade",
        },
      ],
      classificacao_documental: "SUPLEMENTO MINERAL PROTÉICO DE PRONTO USO PARA BOVINOS DE CORTE",
      composicao_documental:
        "RÓTULO: milho integral moído, farelo de algodão, carbonato de cálcio, cloreto de sódio (sal comum) - 17,9 %, fosfato bicálcico, uréia pecuária, premix mineral. Produto poderá conter milho (1,2,4,5), soja (1,2,3,4) ou algodão (1,2,4,5,6) transgênicos. Espécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes; 5- Zea mays; 6- Streptomyces hygroscopicus.",
      descricao_documental:
        "Produto pronto para uso, indicado para suplementação mineral protéica de bovinos de corte acima de 4 meses de idade, nas fases de cria, recria e engorda, sob pastagens, na estação seca do ano.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P096_dukamp-proteico-vacae-recria/fontes/D096.doc",
          arquivo_original: "RTPI/RTPI - Proteinados - Prot‚ico Vaca e Recria.doc",
          sha256: "39da6dfeea4a838f1f436dac8fecfe5261aef1788c45265bc7bd456666ae66fb",
          source_id: "D096",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Dukamp Protéico Vaca e Recria já vem pronto para uso bastando despejar o produto em cochos e deixar à disposição permanente dos animais. \nEste produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. O uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. Não fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. Recomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que seco e de baixa qualidade. Não fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. Também não fornecer o produto para eqüídeos, ovinos ou vacas leiteiras. \nPara adaptação dos animais ao início do uso de suplementos contendo uréia, é recomendado misturar o produto com sal branco ou um suplemento mineral qualquer na proporção de 1:2 na primeira semana, misturar na proporção de 2:1 na segunda semana e usar o produto dukamp protéico seca puro a partir da terceira semana. \nConsumo esperado de 50 a 150 gramas do produto para cada 100 kg de peso corporal (média de 100 gramas para cada 100 kg de peso corporal), desde que atendidas as especificações de manejo recomendadas. \nPorventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. \nEm caso de dúvidas ou intoxicações, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP PROTÉICO VACAE RECRIA",
      principal_documental_source_id: "D096",
      produto_id: "P096",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. \nO uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. \nNão fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. \nRecomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que seco e de baixa qualidade. \nNão fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. \nTambém não fornecer o produto para eqüídeos, ovinos ou vacas leiteiras.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "c48fd6f7480517741a963fd7f4c111e8286503cc4323af41a6a9cd626f2fa6c3",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP RAÇÃO ÁGUAS", "RTPI - Ração Corte - DK Rç Águas"],
      bloqueios: [],
      classificacao_documental: "RAÇÃO PARA BOVINOS DE CORTE",
      composicao_documental:
        "farelo de soja, farelo de algodão, polpa cítrica, farelo de trigo, fosfato bicálcico, carbonato de cálcio, cloreto de sódio (sal comum), milho integral moído, premix mineral calcareo calcitico.Produto poderá conter milho1,2,4,5, soja1,2,3,4 ou algodão1,2,4,5,6 transgênicos.\nEspécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes;  5- Zea mays; 6- Streptomyces hygroscopicus.",
      descricao_documental:
        "Ração de baixo consumo para engorda de bovinos de corte semi confinados ou suplementados a campo, no período das águas e/ou primavera.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P020_dukamp-racao-aguas/fontes/D020.doc",
          arquivo_original: "RTPI/Produtos mais Vendidos/RTPI - Ração Corte - DK Rç Águas.doc",
          sha256: "ca33601ce424d2bd179b188fc3d34b9fd759aa99e79363c05ff77997290ddf15",
          source_id: "D020",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer entre 0,3 a 0,5% do peso vivo em ração diariamente, em doses de 1 a 1,5 kg por cabeça por dia, dependendo da qualidade do volumoso, estado corporal dos animais, estágio de desenvolvimento e do desempenho esperado. Como o produto contém sal comum em sua fórmula, espera-se que a ingestão fique distribuída durante o dia, não sendo necessário fracionar o fornecimento dessa ração em mais de um trato diário. Para  adaptar os animais ao uso do produto, iniciar fornecendo quantidades crescentes até atingir a quantia recomendada dentro de 10 dias, substituindo completamente o suplemento mineral ou o sal proteinado convencional. Espaçamento de cocho necessário: entre 15 e 30 cm por cabeça suplementada. Não fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia.",
      nome_comercial_documental: "DUKAMP RAÇÃO ÁGUAS",
      principal_documental_source_id: "D020",
      produto_id: "P020",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Não fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "b08641114135f7e0cc509c57a46e188e697f1647c125a76f212b963ae598ff78",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP RAÇÃO ÁGUAS TOP", "RTPI - Ração Corte - DK Rç Águas Top"],
      bloqueios: [],
      classificacao_documental: "RAÇÃO PARA BOVINOS DE CORTE",
      composicao_documental:
        "farelo de soja, farelo de algodão, polpa cítrica, farelo de trigo, fosfato bicálcico, carbonato de cálcio, cloreto de sódio (sal comum), milho integral moído, premix mineral calcareo calcitico.Produto poderá conter milho1,2,4,5, soja1,2,3,4 ou algodão1,2,4,5,6 transgênicos.\nEspécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes;  5- Zea mays; 6- Streptomyces hygroscopicus.",
      descricao_documental:
        "Ração de baixo consumo para engorda de bovinos de corte semi confinados ou suplementados a campo, no período das águas e/ou primavera.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P114_dukamp-racao-aguas-top/fontes/D114.doc",
          arquivo_original: "RTPI/RTPI - Ração Corte - DK Rç Águas Top.doc",
          sha256: "26fdf5c0dd9a920e3333aa6ab910d675d8fca180931ddea016c0a567d069852f",
          source_id: "D114",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer entre 0,3 a 0,5% do peso vivo em ração diariamente, em doses de 1 a 1,5 kg por cabeça por dia, dependendo da qualidade do volumoso, estado corporal dos animais, estágio de desenvolvimento e do desempenho esperado. Como o produto contém sal comum em sua fórmula, espera-se que a ingestão fique distribuída durante o dia, não sendo necessário fracionar o fornecimento dessa ração em mais de um trato diário. Para  adaptar os animais ao uso do produto, iniciar fornecendo quantidades crescentes até atingir a quantia recomendada dentro de 10 dias, substituindo completamente o suplemento mineral ou o sal proteinado convencional. Espaçamento de cocho necessário: entre 15 e 30 cm por cabeça suplementada. Não fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia.",
      nome_comercial_documental: "DUKAMP RAÇÃO ÁGUAS TOP",
      principal_documental_source_id: "D114",
      produto_id: "P114",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Não fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "dde1f9131b18ce7cb398a2cd2232e0b86f1612c78f6be93c0bcc6cf3d3963a98",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP RAÇÃO BABY", "RTPI - Ração Corte - DK Rç Baby"],
      bloqueios: [],
      classificacao_documental: "RAÇÃO PARA BEZERROS",
      composicao_documental:
        "Farelo de soja, farelo de algodão, fosfato bicálcico, carbonato de cálcio, milho integral moído,farelo de trigo, melaço em pó, monesina sódica, premix mineral vitamínico. \nProduto poderá conter milho1,2,4,5, soja1,2,3,4 ou algodão1,2,4,5,6 transgênicos.\nEspécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes;  5- Zea mays; 6- Streptomyces hygroscopicus.",
      descricao_documental:
        "Ração para bezerros de corte e de leite em fase inicial e crescimento.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P099_dukamp-racao-baby/fontes/D099.doc",
          arquivo_original: "RTPI/RTPI - Ração Corte - DK Rç Baby.doc",
          sha256: "d7b8e5c6f18480d5215f9754c6f0ca4d3717866298356e08de1cc83de4a40629",
          source_id: "D099",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer à vontade para bezerros de corte e de leite durante os primeiros 30 dias de vida, sem uso de alimento volumoso. Do 31º até o desmame, fornecer quantidade de ração equivalente a 1,5 - 2% do peso vivo, além de 1 - 1,5% do peso vivo em feno de alta qualidade (ou o equivalente em matéria seca de volumoso úmido de alta qualidade). Recomenda-se fornecer volumoso e ração em cochos separados (sem misturá-los) até o quarto mês de idade e só a partir de então é recomendado fornecer a alimentação (volumoso e ração) misturada no cocho (dieta total). Para adaptação dos animais ao consumo da Ração Baby, iniciar fornecendo quantidades crescentes do produto misturando com a ração anteriormente em uso, até atingir a quantia recomendada da ração dentro de 14 dias. Não fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. \n\nATENÇÃO: NÃO FORNECER A OUTRAS ESPÉCIES OU CATEGORIAS ANIMAIS QUE NÃO ÀS DESCRITAS NA INDICAÇÃO DO PRODUTO E/OU NO MODO DE USAR. NÃO ADMINISTRAR JUNTO A OUTROS PRODUTOS QUE CONTENHAM IONÓFOROS. NÃO PERMITIR ACESSO DE EQUINOS AO PRODUTO, POIS A INGESTÃO PODERÁ SER FATAL. ESTE PRODUTO CONTÉM IONÓFORO E O USO SIMULTÂNEO COM CERTAS SUBSTÂNCIAS MEDICAMENTOSAS PODE SER CONTRA-INDICADA. A MONENSINA, SALINOMICINA E A NARASINA SÃO INCOMPATÍVEIS COM A TIAMULINA.",
      nome_comercial_documental: "DUKAMP RAÇÃO BABY",
      principal_documental_source_id: "D099",
      produto_id: "P099",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Não fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula.  \nNão fornecer a outras espécies ou categorias animais que não às descritas na indicação do produto. \nNão administrar junto a outros produtos que contenham ionóforos. \nNão permitir acesso de equinos ao produto, pois a ingestão poderá ser fatal. \nEste produto contém ionóforo e o uso simultâneo com certas substâncias medicamentosas pode ser contra-indicada. \nA monensina, salinomicina e a narasina são incompatíveis com a tiamulina.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "3d024948ed54b3f998438905d5e030249baf784e00b04dc93f2a281d2a1148b2",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP RAÇÃO BABY ELITE", "RTPI - Ração Elite - DK Rç Baby Elite"],
      bloqueios: [
        {
          descricao:
            "Fósforo: tabela técnica = 8.000 mg/kg; anexo = Fósforo mín6.000mg/kg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Ração Elite - DK Rç Baby Elite.doc",
              evidence_id: "D118-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D118",
            },
          ],
          source_id: "D118",
          tipo: "garantia_entre_blocos",
        },
        {
          descricao:
            "Proteína bruta: tabela técnica = 230 g/kg; anexo = Proteína brutamín220g/kg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Ração Elite - DK Rç Baby Elite.doc",
              evidence_id: "D118-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D118",
            },
          ],
          source_id: "D118",
          tipo: "garantia_entre_blocos",
        },
      ],
      classificacao_documental: "RAÇÃO",
      composicao_documental:
        "Farelo de soja, farelo de trigo, fosfato bicálcico, carbonato de cálcio, milho integral moído, melaço em pó, sal cálcico de ácido graxo, bicarbonato de sódio,monesina sódica, premix mineral vitamínico, levedura seca de cana.\n\nProduto poderá conter milho1,2,4,5 ou soja1,2,3,4  transgênicos.\nEspécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes;  5- Zea mays.",
      descricao_documental:
        "Ração para bezerros de elevado valor genético em fase inicial e crescimento.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P118_dukamp-racao-baby-elite/fontes/D118.doc",
          arquivo_original: "RTPI/RTPI - Ração Elite - DK Rç Baby Elite.doc",
          sha256: "bf5d24f00387057cae6fe5dc08ec499f223b75e2a79bf226ef135b99ac9453fc",
          source_id: "D118",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer à vontade para bezerros de elevado valor genético durante os primeiros 30 dias de vida, sem uso de alimento volumoso. Do 31º até o desmame, fornecer quantidade de ração equivalente a 1,5 - 2% do peso vivo, além de 1 - 1,5% do peso vivo em feno de alta qualidade (ou o equivalente em matéria seca de volumoso úmido de alta qualidade). Recomenda-se fornecer volumoso e ração em cochos separados (sem misturá-los) até o quarto mês de idade e só a partir de então é recomendado fornecer a alimentação (volumoso e ração) misturada no cocho (dieta total). Para adaptação dos animais ao consumo da Ração Baby Elite, iniciar fornecendo quantidades crescentes do produto misturando com a ração anteriormente em uso, até atingir a quantia recomendada da ração dentro de 14 dias. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia.\n\nATENÇÃO: NÃO FORNECER A OUTRAS ESPÉCIES OU CATEGORIAS ANIMAIS QUE NÃO ÀS DESCRITAS NA INDICAÇÃO DO PRODUTO E/OU NO MODO DE USAR. NÃO ADMINISTRAR JUNTO A OUTROS PRODUTOS QUE CONTENHAM IONÓFOROS. NÃO PERMITIR ACESSO DE EQUINOS AO PRODUTO, POIS A INGESTÃO PODERÁ SER FATAL. ESTE PRODUTO CONTÉM IONÓFORO E O USO SIMULTÂNEO COM CERTAS SUBSTÂNCIAS MEDICAMENTOSAS PODE SER CONTRA-INDICADA. A MONENSINA, SALINOMICINA E A NARASINA SÃO INCOMPATÍVEIS COM A TIAMULINA.",
      nome_comercial_documental: "DUKAMP RAÇÃO BABY ELITE",
      principal_documental_source_id: "D118",
      produto_id: "P118",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Não fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula.  \nNão fornecer a outras espécies ou categorias animais que não às descritas na indicação do produto. \nNão administrar junto a outros produtos que contenham ionóforos. \nNão permitir acesso de equinos ao produto, pois a ingestão poderá ser fatal. \nEste produto contém ionóforo e o uso simultâneo com certas substâncias medicamentosas pode ser contra-indicada. \nA monensina, salinomicina e a narasina são incompatíveis com a tiamulina.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "de54307df316e0d4c6fbd7a15486ef6349f79489a48dbd950ed9d3fab042ff54",
    kind: "catalog",
    product: {
      aliases: [
        "DUKAMP RAÇÃO BABY ELITE FENO PREMIUM",
        "RTPI - Ração Elite  Feno Premium - DK Rç Elite Feno Premium",
      ],
      bloqueios: [
        {
          descricao:
            "O arquivo é Elite Feno Premium; a designação interna é Dukamp Ração Baby Elite Feno Premium. O modo de usar cita Ração Baby Elite. Confirmar nome e manejo específicos da variante com feno.",
          referencias: [
            {
              arquivo_original:
                "RTPI/RTPI - Ração Elite  Feno Premium - DK Rç Elite Feno Premium.doc",
              evidence_id: "D117-S02",
              pagina_pdf_inicio: null,
              secao_numero_original: 2,
              secao_semantica: "Nome comercial",
              source_id: "D117",
            },
            {
              arquivo_original:
                "RTPI/RTPI - Ração Elite  Feno Premium - DK Rç Elite Feno Premium.doc",
              evidence_id: "D117-S12",
              pagina_pdf_inicio: null,
              secao_numero_original: 13,
              secao_semantica: "Modo de usar",
              source_id: "D117",
            },
          ],
          source_id: "D117",
          tipo: "identidade",
        },
        {
          descricao:
            "Iodo: tabela técnica = 1,3 mg/kg; anexo = Iodomín1,38mg/kg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original:
                "RTPI/RTPI - Ração Elite  Feno Premium - DK Rç Elite Feno Premium.doc",
              evidence_id: "D117-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D117",
            },
          ],
          source_id: "D117",
          tipo: "garantia_entre_blocos",
        },
        {
          descricao:
            "Cobalto: tabela técnica = 0,9 mg./kg; anexo = Cobaltomín0,92mg//kg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original:
                "RTPI/RTPI - Ração Elite  Feno Premium - DK Rç Elite Feno Premium.doc",
              evidence_id: "D117-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D117",
            },
          ],
          source_id: "D117",
          tipo: "garantia_entre_blocos",
        },
      ],
      classificacao_documental: "RAÇÃO",
      composicao_documental:
        "Farelo de soja, farelo de trigo, fosfato bicálcico, carbonato de cálcio, milho integral moído, melaço em pó, sal cálcico de ácido graxo, bicarbonato de sódio,monesina sódica, virginiamicina, premix mineral vitamínico e feno peletizado.\n\nProduto poderá conter milho1,2,4,5 ou soja1,2,3,4  transgênicos.\nEspécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes;  5- Zea mays.",
      descricao_documental:
        "Ração para bezerros de elevado valor genético em fase inicial e crescimento.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P117_dukamp-racao-baby-elite-feno-premium/fontes/D117.doc",
          arquivo_original: "RTPI/RTPI - Ração Elite  Feno Premium - DK Rç Elite Feno Premium.doc",
          sha256: "77ea9c74dd8d969602ae21449a3d4b3d2c3636b04e0ffe7aa6764bd8cbe6f003",
          source_id: "D117",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer à vontade para bezerros de elevado valor genético durante os primeiros 30 dias de vida, sem uso de alimento volumoso. Do 31º até o desmame, fornecer quantidade de ração equivalente a 1,5 - 2% do peso vivo, além de 1 - 1,5% do peso vivo em feno de alta qualidade (ou o equivalente em matéria seca de volumoso úmido de alta qualidade). Recomenda-se fornecer volumoso e ração em cochos separados (sem misturá-los) até o quarto mês de idade e só a partir de então é recomendado fornecer a alimentação (volumoso e ração) misturada no cocho (dieta total). Para adaptação dos animais ao consumo da Ração Baby Elite, iniciar fornecendo quantidades crescentes do produto misturando com a ração anteriormente em uso, até atingir a quantia recomendada da ração dentro de 14 dias. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia.\n\nATENÇÃO: NÃO FORNECER A OUTRAS ESPÉCIES OU CATEGORIAS ANIMAIS QUE NÃO ÀS DESCRITAS NA INDICAÇÃO DO PRODUTO E/OU NO MODO DE USAR. NÃO ADMINISTRAR JUNTO A OUTROS PRODUTOS QUE CONTENHAM IONÓFOROS. NÃO PERMITIR ACESSO DE EQUINOS AO PRODUTO, POIS A INGESTÃO PODERÁ SER FATAL. ESTE PRODUTO CONTÉM IONÓFORO E O USO SIMULTÂNEO COM CERTAS SUBSTÂNCIAS MEDICAMENTOSAS PODE SER CONTRA-INDICADA. A MONENSINA, SALINOMICINA E A NARASINA SÃO INCOMPATÍVEIS COM A TIAMULINA.",
      nome_comercial_documental: "DUKAMP RAÇÃO BABY ELITE FENO PREMIUM",
      principal_documental_source_id: "D117",
      produto_id: "P117",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Não fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula.  \nNão fornecer a outras espécies ou categorias animais que não às descritas na indicação do produto. \nNão administrar junto a outros produtos que contenham ionóforos. \nNão permitir acesso de equinos ao produto, pois a ingestão poderá ser fatal. \nEste produto contém ionóforo e o uso simultâneo com certas substâncias medicamentosas pode ser contra-indicada. \nA monensina, salinomicina e a narasina são incompatíveis com a tiamulina.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "fae80dcca92506b4e310c80afd969ec5f25a8d2fa35ae05fcba17ae0540862ed",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP RAÇÃO CONFINAMENTO", "RTPI - Ração Corte - DK Rç Confinamento"],
      bloqueios: [],
      classificacao_documental: "RAÇÃO",
      composicao_documental:
        "Farelo de soja*, farelo de algodão, farelo de polpa cítrica, farelo de trigo, fosfato bicálcico, carbonato de cálcio, milho integral moído**, uréia pecuária,monesina sódica, premix mineral vitamínico. Espécie doadora de genes (em caso de ingrediente transgênico):  *Agrobacterium tumefaciens;  **Bacillus thuringiensis",
      descricao_documental: "Ração para engorda de bovinos de corte em confinamento.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P017_dukamp-racao-confinamento/fontes/D017.doc",
          arquivo_original:
            "RTPI/Produtos mais Vendidos/RTPI - Ração Corte - DK Rç Confinamento.doc",
          sha256: "f82e0eb572a6c30ff50b57073ab4c030e1e55d039abd98d81274d76e1509d418",
          source_id: "D017",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer entre 1 a 1,5% do peso vivo em ração, dependendo da qualidade do volumoso, estado corporal dos animais, estágio de desenvolvimento e do desempenho esperado. Fracionar o fornecimento em pelo menos dois tratos diários. Este produto contém uréia e, portanto, deve ser fornecido em cochos cobertos e/ou que evitem acúmulo de água. O uso de uréia adicional é contraindicado, salvo quando prescrito por profissional habilitado. Não fornecer esta ração para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos e debilitados. Para adaptação dos animais à uréia, iniciar fornecendo quantidades crescentes até atingir a quantia recomendada dentro de 10 dias. Manter boa disponibilidade de alimento volumoso para os animais, mesmo que de baixa qualidade.  Não fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. \n\nATENÇÃO: NÃO FORNECER A OUTRAS ESPÉCIES OU CATEGORIAS ANIMAIS QUE NÃO ÀS DESCRITAS NA INDICAÇÃO DO PRODUTO E/OU NO MODO DE USAR. NÃO ADMINISTRAR JUNTO A OUTROS PRODUTOS QUE CONTENHAM IONÓFOROS. NÃO PERMITIR ACESSO DE EQUINOS AO PRODUTO, POIS A INGESTÃO PODERÁ SER FATAL. ESTE PRODUTO CONTÉM IONÓFORO E O USO SIMULTÂNEO COM CERTAS SUBSTÂNCIAS MEDICAMENTOSAS PODE SER CONTRA-INDICADA. A MONENSINA, SALINOMICINA E A NARASINA SÃO INCOMPATÍVEIS COM A TIAMULINA.",
      nome_comercial_documental: "DUKAMP RAÇÃO CONFINAMENTO",
      principal_documental_source_id: "D017",
      produto_id: "P017",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia e, portanto, deve ser fornecido em cochos cobertos e/ou que evitem acúmulo de água. \nO uso de uréia adicional é contraindicado, salvo quando prescrito por profissional habilitado. \nNão fornecer esta ração para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos e debilitados. \nPara adaptação dos animais à uréia, iniciar fornecendo quantidades crescentes até atingir a quantia recomendada dentro de 10 dias. \nManter boa disponibilidade de alimento volumoso para os animais, mesmo que de baixa qualidade.  \nNão fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula.\nNão fornecer a outras espécies ou categorias animais que não às descritas na indicação do produto e/ou no modo de usar. \nNão administrar junto a outros produtos que contenham ionóforos. \nNão permitir acesso de equinos ao produto, pois a ingestão poderá ser fatal. \nEste produto contém ionóforo e o uso simultâneo com certas substâncias medicamentosas pode ser contra-indicada. \nA monensina, salinomicina e a narasina são incompatíveis com a tiamulina.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "16ffa80509cb4bbdbf9bffd921957cfd9200d10f19b5a5b97d6edb2b79df7be3",
    kind: "catalog",
    product: {
      aliases: [
        "DUKAMP RAÇÃO CONFINAMENTO 18 PREMIUM",
        "RTPI - Ração Corte - DK Rç Confinamento 18 Premium",
      ],
      bloqueios: [],
      classificacao_documental: "RAÇÃO",
      composicao_documental:
        "Farelo de soja*, farelo de polpa cítrica, farelo de trigo, fosfato bicálcico, carbonato de cálcio, milho integral moído**, uréia pecuária,monesina sódica, premix mineral vitamínico. Espécie doadora de genes (em caso de ingrediente transgênico):  *Agrobacterium tumefaciens;  **Bacillus thuringiensis",
      descricao_documental: "Ração para engorda de bovinos de corte em confinamento.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P100_dukamp-racao-confinamento-18-premium/fontes/D100.doc",
          arquivo_original: "RTPI/RTPI - Ração Corte - DK Rç Confinamento 18 Premium.doc",
          sha256: "196c9b05ad4978935c8d721c385ac84a3635677dddd6fceb83b4c81a171aef2a",
          source_id: "D100",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer entre 1 a 1,5% do peso vivo em ração, dependendo da qualidade do volumoso, estado corporal dos animais, estágio de desenvolvimento e do desempenho esperado. Fracionar o fornecimento em pelo menos dois tratos diários. Este produto contém uréia e, portanto, deve ser fornecido em cochos cobertos e/ou que evitem acúmulo de água. O uso de uréia adicional é contraindicado, salvo quando prescrito por profissional habilitado. Não fornecer esta ração para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos e debilitados. Para adaptação dos animais à uréia, iniciar fornecendo quantidades crescentes até atingir a quantia recomendada dentro de 10 dias. Manter boa disponibilidade de alimento volumoso para os animais, mesmo que de baixa qualidade.  Não fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. \n\nATENÇÃO: NÃO FORNECER A OUTRAS ESPÉCIES OU CATEGORIAS ANIMAIS QUE NÃO ÀS DESCRITAS NA INDICAÇÃO DO PRODUTO E/OU NO MODO DE USAR. NÃO ADMINISTRAR JUNTO A OUTROS PRODUTOS QUE CONTENHAM IONÓFOROS. NÃO PERMITIR ACESSO DE EQUINOS AO PRODUTO, POIS A INGESTÃO PODERÁ SER FATAL. ESTE PRODUTO CONTÉM IONÓFORO E O USO SIMULTÂNEO COM CERTAS SUBSTÂNCIAS MEDICAMENTOSAS PODE SER CONTRA-INDICADA. A MONENSINA, SALINOMICINA E A NARASINA SÃO INCOMPATÍVEIS COM A TIAMULINA.",
      nome_comercial_documental: "DUKAMP RAÇÃO CONFINAMENTO 18 PREMIUM",
      principal_documental_source_id: "D100",
      produto_id: "P100",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia e, portanto, deve ser fornecido em cochos cobertos e/ou que evitem acúmulo de água. \nO uso de uréia adicional é contraindicado, salvo quando prescrito por profissional habilitado. \nNão fornecer esta ração para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos e debilitados. \nPara adaptação dos animais à uréia, iniciar fornecendo quantidades crescentes até atingir a quantia recomendada dentro de 10 dias. \nManter boa disponibilidade de alimento volumoso para os animais, mesmo que de baixa qualidade.  \nNão fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula.\nNão fornecer a outras espécies ou categorias animais que não às descritas na indicação do produto e/ou no modo de usar. \nNão administrar junto a outros produtos que contenham ionóforos. \nNão permitir acesso de equinos ao produto, pois a ingestão poderá ser fatal. \nEste produto contém ionóforo e o uso simultâneo com certas substâncias medicamentosas pode ser contra-indicada. \nA monensina, salinomicina e a narasina são incompatíveis com a tiamulina.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "18dcf111f40e8db4c50b621094411f6ca771a9330df1449045dfff091806253d",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP RAÇÃO CONFINAMENTO GOLD", "RTPI - Ração Corte - DK Rç Confinamento Gold"],
      bloqueios: [
        {
          descricao:
            "Cálcio: tabela técnica = 20 / 50 g/kg; anexo = Cálciomín/máx20 / 500g/kg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Ração Corte - DK Rç Confinamento Gold.doc",
              evidence_id: "D101-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D101",
            },
          ],
          source_id: "D101",
          tipo: "garantia_entre_blocos",
        },
      ],
      classificacao_documental: "RAÇÃO",
      composicao_documental:
        "Farelo de soja*, farelo de algodão, farelo de polpa cítrica, farelo de trigo, fosfato bicálcico, carbonato de cálcio, milho integral moído**, uréia pecuária,monesina sódica, premix mineral vitamínico, calcareo calcitico Espécie doadora de genes (em caso de ingrediente transgênico):  *Agrobacterium tumefaciens;  **Bacillus thuringiensis",
      descricao_documental: "Ração para engorda de bovinos de corte em confinamento.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P101_dukamp-racao-confinamento-gold/fontes/D101.doc",
          arquivo_original: "RTPI/RTPI - Ração Corte - DK Rç Confinamento Gold.doc",
          sha256: "ab900a9a9df1657a31f119b6bfd290e80a5e13a831853076930d1482171b6ce5",
          source_id: "D101",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer entre 1 a 1,5% do peso vivo em ração, dependendo da qualidade do volumoso, estado corporal dos animais, estágio de desenvolvimento e do desempenho esperado. Fracionar o fornecimento em pelo menos dois tratos diários. Este produto contém uréia e, portanto, deve ser fornecido em cochos cobertos e/ou que evitem acúmulo de água. O uso de uréia adicional é contraindicado, salvo quando prescrito por profissional habilitado. Não fornecer esta ração para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos e debilitados. Para adaptação dos animais à uréia, iniciar fornecendo quantidades crescentes até atingir a quantia recomendada dentro de 10 dias. Manter boa disponibilidade de alimento volumoso para os animais, mesmo que de baixa qualidade.  Não fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. \n\nATENÇÃO: NÃO FORNECER A OUTRAS ESPÉCIES OU CATEGORIAS ANIMAIS QUE NÃO ÀS DESCRITAS NA INDICAÇÃO DO PRODUTO E/OU NO MODO DE USAR. NÃO ADMINISTRAR JUNTO A OUTROS PRODUTOS QUE CONTENHAM IONÓFOROS. NÃO PERMITIR ACESSO DE EQUINOS AO PRODUTO, POIS A INGESTÃO PODERÁ SER FATAL. ESTE PRODUTO CONTÉM IONÓFORO E O USO SIMULTÂNEO COM CERTAS SUBSTÂNCIAS MEDICAMENTOSAS PODE SER CONTRA-INDICADA. A MONENSINA, SALINOMICINA E A NARASINA SÃO INCOMPATÍVEIS COM A TIAMULINA.",
      nome_comercial_documental: "DUKAMP RAÇÃO CONFINAMENTO GOLD",
      principal_documental_source_id: "D101",
      produto_id: "P101",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia e, portanto, deve ser fornecido em cochos cobertos e/ou que evitem acúmulo de água. \nO uso de uréia adicional é contraindicado, salvo quando prescrito por profissional habilitado. \nNão fornecer esta ração para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos e debilitados. \nPara adaptação dos animais à uréia, iniciar fornecendo quantidades crescentes até atingir a quantia recomendada dentro de 10 dias. \nManter boa disponibilidade de alimento volumoso para os animais, mesmo que de baixa qualidade.  \nNão fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula.\nNão fornecer a outras espécies ou categorias animais que não às descritas na indicação do produto e/ou no modo de usar. \nNão administrar junto a outros produtos que contenham ionóforos. \nNão permitir acesso de equinos ao produto, pois a ingestão poderá ser fatal. \nEste produto contém ionóforo e o uso simultâneo com certas substâncias medicamentosas pode ser contra-indicada. \nA monensina, salinomicina e a narasina são incompatíveis com a tiamulina.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "a8693adb223750e1a7048d44dbed14b4445a1198770fb12aed464d8cfcaafa96",
    kind: "catalog",
    product: {
      aliases: [
        "DUKAMP RAÇÃO CONFINAMENTO GRÃO INTEIRO",
        "RTPI - Ração Corte - DK Rç Confinamento Grão Inteiro",
      ],
      bloqueios: [
        {
          descricao:
            "Molibdenio: especificação 'mím' e unidade 'mg/kg' preservadas. Confirmar a grafia antes de normalizar.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Ração Corte - DK Rç Confinamento Grão Inteiro.doc",
              evidence_id: "D103-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D103",
            },
          ],
          source_id: "D103",
          tipo: "grafia_unidade_especificacao",
        },
      ],
      classificacao_documental: "RAÇÃO PARA ENGORDA DE BOVINOS DE CORTE",
      composicao_documental:
        "Farelo de soja*, milho integral moído**, grão de milho**, fosfato bicálcico, carbonato de cálcio, uréia pecuária, monensina sódica, bicarbonato de sódio, premix mineral vitamínico. Espécie doadora de genes (em caso de ingrediente transgênico):  *Agrobacterium tumefaciens;  **Bacillus thuringiensis.",
      descricao_documental:
        "Ração para alimentação de bovinos de corte em confinamento, submetidos a dieta sem volumoso.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P103_dukamp-racao-confinamento-grao-inteiro/fontes/D103.doc",
          arquivo_original: "RTPI/RTPI - Ração Corte - DK Rç Confinamento Grão Inteiro.doc",
          sha256: "a55420b6babc032f99968361d76dcb9bd3eb131a7c1a4af67bfdd40098e9b13e",
          source_id: "D103",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Esta ração é pronta para uso e seu fornecimento exclusivo aos bovinos (isto é, sem o fornecimento de volumoso) representará uma dieta conhecida como “dieta do grão inteiro de milho”. Em caso de animais já adaptados à dieta sem volumoso, fornecer o equivalente entre 2 a 2,2% do peso corporal diariamente, dividindo o total em pelo menos 5 (cinco) refeições diárias.\n\nPROTOCOLO DE ADAPTAÇÃO: Inicie fornecendo o equivalente a 1,2% do peso corporal em ração e aumente o fornecimento em cerca de 10% a cada dois dias, até chegar ao limite de fornecimento, que é entre 2 e 2,2% do peso corporal por volta do 14º dia. O período de adaptação não deverá ser reduzido, sob o risco de ocorrência de distúrbios nutricionais. Fornecer a quantidade total diária de ração dividida em pelo menos 5 (cinco) refeições e não disponibilizar volumoso aos animais confinados. Caso a intenção seja de adaptar os animais utilizando também volumoso ou em caso de distúrbios nutricionais, consulte nosso departamento técnico ou um profissional habilitado de sua confiança.\n\nATENÇÃO: ESTE PRODUTO CONTÉM URÉIA, SENDO CONTRA-INDICADO O USO DE URÉIA ADICIONAL. FORNECER O PRODUTO EM COCHOS COBERTOS E/OU QUE EVITEM ACÚMULO DE ÁGUA. NÃO FORNECER O PRODUTO PARA ANIMAIS EM JEJUM, FAMINTOS E DEBILITADOS. NÃO FORNECER O PRODUTO PARA EQÜÍDEOS, OVINOS E/OU QUAISQUER OUTRAS CATEGORIAS OU ESPÉCIES QUE NÃO AS ESPECIFICADAS NESTE RÓTULO, NEM EM QUANTIDADES ACIMA DO RECOMENDADO. O FORNECIMENTO DE VOLUMOSO É CONTRA-INDICADO, SALVO QUANDO PRESCRITO POR PROFISSIONAL HABILITADO. NÃO ADMINISTRAR JUNTO A OUTROS PRODUTOS QUE CONTENHAM IONÓFOROS. NÃO PERMITIR ACESSO DE EQUINOS AO PRODUTO, POIS A INGESTÃO PODERÁ SER FATAL. ESTE PRODUTO CONTÉM IONÓFORO E O USO SIMULTÂNEO COM CERTAS SUBSTÂNCIAS MEDICAMENTOSAS PODE SER CONTRA-INDICADA. A MONENSINA, SALINOMICINA E A NARASINA SÃO INCOMPATÍVEIS COM A TIAMULINA.",
      nome_comercial_documental: "DUKAMP RAÇÃO CONFINAMENTO GRÃO INTEIRO",
      principal_documental_source_id: "D103",
      produto_id: "P103",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia, sendo contra-indicado o uso de uréia adicional.\nFornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. \nNão fornecer o produto para animais em jejum, famintos e debilitados. \nNão fornecer o produto para eqüídeos, ovinos e/ou quaisquer outras categorias ou espécies que não as especificadas neste rótulo, nem em quantidades acima do recomendado. \nO fornecimento de volumoso junto com essa ração é contra-indicado, salvo quando prescrito por profissional habilitado. \nNão administrar junto a outros produtos que contenham ionóforos. \nNão permitir acesso de equinos ao produto, pois a ingestão poderá ser fatal. \nEste produto contém ionóforo e o uso simultâneo com certas substâncias medicamentosas pode ser contra-indicada. \nA monensina, salinomicina e a narasina são incompatíveis com a tiamulina.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "6e8bb806f227f2318ed4a596a0d0db7ba8a68bd97c709e68e74bd3e46d33ccd7",
    kind: "catalog",
    product: {
      aliases: [
        "DUKAMP RAÇÃO CONFINAMENTO GRÃO INTEIRO PLUS",
        "RTPI - Ração Corte - DK Rç Confinamento Grão Inteiro PLus",
      ],
      bloqueios: [
        {
          descricao:
            "Molibdenio: especificação 'mím' e unidade 'mg/kg' preservadas. Confirmar a grafia antes de normalizar.",
          referencias: [
            {
              arquivo_original:
                "RTPI/RTPI - Ração Corte - DK Rç Confinamento Grão Inteiro PLus.doc",
              evidence_id: "D102-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D102",
            },
          ],
          source_id: "D102",
          tipo: "grafia_unidade_especificacao",
        },
      ],
      classificacao_documental: "RAÇÃO PARA ENGORDA DE BOVINOS DE CORTE",
      composicao_documental:
        "Farelo de soja*, milho integral moído**, grão de milho**, fosfato bicálcico, carbonato de cálcio, uréia pecuária, monensina sódica, bicarbonato de sódio, premix mineral vitamínico. Espécie doadora de genes (em caso de ingrediente transgênico):  *Agrobacterium tumefaciens;  **Bacillus thuringiensis, farelo de polpa citrica peleizada.",
      descricao_documental:
        "Ração para alimentação de bovinos de corte em confinamento, submetidos a dieta sem volumoso.",
      fontes: [
        {
          arquivo_no_pacote:
            "produtos/P102_dukamp-racao-confinamento-grao-inteiro-plus/fontes/D102.doc",
          arquivo_original: "RTPI/RTPI - Ração Corte - DK Rç Confinamento Grão Inteiro PLus.doc",
          sha256: "a265b2eb64baf890ce86db153f82e559589b68ab84dd11c80950ccff78fa21e9",
          source_id: "D102",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Esta ração é pronta para uso e seu fornecimento exclusivo aos bovinos (isto é, sem o fornecimento de volumoso) representará uma dieta conhecida como “dieta do grão inteiro de milho”. Em caso de animais já adaptados à dieta sem volumoso, fornecer o equivalente entre 2 a 2,2% do peso corporal diariamente, dividindo o total em pelo menos 5 (cinco) refeições diárias.\n\nPROTOCOLO DE ADAPTAÇÃO: Inicie fornecendo o equivalente a 1,2% do peso corporal em ração e aumente o fornecimento em cerca de 10% a cada dois dias, até chegar ao limite de fornecimento, que é entre 2 e 2,2% do peso corporal por volta do 14º dia. O período de adaptação não deverá ser reduzido, sob o risco de ocorrência de distúrbios nutricionais. Fornecer a quantidade total diária de ração dividida em pelo menos 5 (cinco) refeições e não disponibilizar volumoso aos animais confinados. Caso a intenção seja de adaptar os animais utilizando também volumoso ou em caso de distúrbios nutricionais, consulte nosso departamento técnico ou um profissional habilitado de sua confiança.\n\nATENÇÃO: ESTE PRODUTO CONTÉM URÉIA, SENDO CONTRA-INDICADO O USO DE URÉIA ADICIONAL. FORNECER O PRODUTO EM COCHOS COBERTOS E/OU QUE EVITEM ACÚMULO DE ÁGUA. NÃO FORNECER O PRODUTO PARA ANIMAIS EM JEJUM, FAMINTOS E DEBILITADOS. NÃO FORNECER O PRODUTO PARA EQÜÍDEOS, OVINOS E/OU QUAISQUER OUTRAS CATEGORIAS OU ESPÉCIES QUE NÃO AS ESPECIFICADAS NESTE RÓTULO, NEM EM QUANTIDADES ACIMA DO RECOMENDADO. O FORNECIMENTO DE VOLUMOSO É CONTRA-INDICADO, SALVO QUANDO PRESCRITO POR PROFISSIONAL HABILITADO. NÃO ADMINISTRAR JUNTO A OUTROS PRODUTOS QUE CONTENHAM IONÓFOROS. NÃO PERMITIR ACESSO DE EQUINOS AO PRODUTO, POIS A INGESTÃO PODERÁ SER FATAL. ESTE PRODUTO CONTÉM IONÓFORO E O USO SIMULTÂNEO COM CERTAS SUBSTÂNCIAS MEDICAMENTOSAS PODE SER CONTRA-INDICADA. A MONENSINA, SALINOMICINA E A NARASINA SÃO INCOMPATÍVEIS COM A TIAMULINA.",
      nome_comercial_documental: "DUKAMP RAÇÃO CONFINAMENTO GRÃO INTEIRO PLUS",
      principal_documental_source_id: "D102",
      produto_id: "P102",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia, sendo contra-indicado o uso de uréia adicional.\nFornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. \nNão fornecer o produto para animais em jejum, famintos e debilitados. \nNão fornecer o produto para eqüídeos, ovinos e/ou quaisquer outras categorias ou espécies que não as especificadas neste rótulo, nem em quantidades acima do recomendado. \nO fornecimento de volumoso junto com essa ração é contra-indicado, salvo quando prescrito por profissional habilitado. \nNão administrar junto a outros produtos que contenham ionóforos. \nNão permitir acesso de equinos ao produto, pois a ingestão poderá ser fatal. \nEste produto contém ionóforo e o uso simultâneo com certas substâncias medicamentosas pode ser contra-indicada. \nA monensina, salinomicina e a narasina são incompatíveis com a tiamulina.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "154387becc7f089af49774aa7873c2dc48a096624a1f916ccc68151d1697bec4",
    kind: "catalog",
    product: {
      aliases: [
        "DUKAMP RAÇÃO CONFINAMENTO OVINOS",
        "RTPI - Ração Outras - DK Rç Confinamento Ovinos",
      ],
      bloqueios: [],
      classificacao_documental: "RAÇÃO",
      composicao_documental:
        "Farelo de soja, farelo de algodão, farelo de polpa cítrica, farelo de trigo, fosfato bicálcico, carbonato de cálcio, milho integral moído, uréia pecuária, monensina sódica, premix mineral.\n\nProduto poderá conter milho1,2,4,5, soja1,2,3,4 ou algodão1,2,4,5,6 transgênicos.\nEspécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes;  5- Zea mays; 6- Streptomyces hygroscopicus.",
      descricao_documental:
        "Ração para ovinos nas fases de engorda e terminação, em sistema de confinamento ou semi confinamento.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P130_dukamp-racao-confinamento-ovinos/fontes/D130.doc",
          arquivo_original: "RTPI/RTPI - Ração Outras - DK Rç Confinamento Ovinos.doc",
          sha256: "0b3687fababc256bd2056368682b59e1cfe417f5ebf8dd4cffa4b74aeed76f1c",
          source_id: "D130",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Para ovinos confinados, fornecer 500 gramas para cada 10 kg de peso corporal, além de volumoso à vontade. Em sistema de semi-confinamento, fornecer 350 gramas para cada 10 kg de peso corporal. Fracionar o fornecimento em pelo menos dois tratos diários. Este produto contém uréia, sendo contra-indicado o uso de uréia adicional. Fornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. Não fornecer o produto para animais lactentes e/ou para animais em jejum, famintos e debilitados. No caso de semi-confinamento, manter boa disponibilidade de pasto, mesmo que seco e de baixa qualidade. Para adaptação, iniciar com 1/3 da quantidade de ração recomendada e gradualmente aumentar o volume fornecido dentro de 14 dias. Não fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. \n\nATENÇÃO: NÃO FORNECER A OUTRAS ESPÉCIES OU CATEGORIAS ANIMAIS QUE NÃO ÀS DESCRITAS NA INDICAÇÃO DO PRODUTO. NÃO ADMINISTRAR JUNTO A OUTROS PRODUTOS QUE CONTENHAM IONÓFOROS. NÃO PERMITIR ACESSO DE EQUINOS AO PRODUTO, POIS A INGESTÃO PODERÁ SER FATAL. ESTE PRODUTO CONTÉM IONÓFORO E O USO SIMULTÂNEO COM CERTAS SUBSTÂNCIAS MEDICAMENTOSAS PODE SER CONTRA-INDICADA. A MONENSINA, SALINOMICINA E A NARASINA SÃO INCOMPATÍVEIS COM A TIAMULINA.",
      nome_comercial_documental: "DUKAMP RAÇÃO CONFINAMENTO OVINOS",
      principal_documental_source_id: "D130",
      produto_id: "P130",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia, sendo contra-indicado o uso de uréia adicional. \nFornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. \nNão fornecer o produto para animais lactentes e/ou para animais em jejum, famintos e debilitados. \nNo caso de semi-confinamento, manter boa disponibilidade de pasto, mesmo que seco e de baixa qualidade. \nPara adaptação, iniciar com 1/3 da quantidade de ração recomendada e gradualmente aumentar o volume fornecido dentro de 14 dias. \nNão fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula. \nNão fornecer a outras espécies ou categorias animais que não às descritas na indicação do produto. \nNão administrar junto a outros produtos que contenham ionóforos. \nNão permitir acesso de equinos ao produto, pois a ingestão poderá ser fatal. \nEste produto contém ionóforo e o uso simultâneo com certas substâncias medicamentosas pode ser contra-indicada. a monensina, salinomicina e a narasina são incompatíveis com a tiamulina.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "3a02fac056dcca3932386dd86f1b06939a065a09789c145554a511a20f1d0b9b",
    kind: "catalog",
    product: {
      aliases: [
        "DUKAMP RAÇÃO CONFINAMENTO PREMIUM",
        "RTPI - Ração Corte - DK Rç Confinamento Premium",
      ],
      bloqueios: [],
      classificacao_documental: "RAÇÃO",
      composicao_documental:
        "Farelo de soja*, farelo de algodão, farelo de polpa cítrica, farelo de trigo, fosfato bicálcico, carbonato de cálcio, milho integral moído**, uréia pecuária,monesina sódica, premix mineral vitamínico. Espécie doadora de genes (em caso de ingrediente transgênico):  *Agrobacterium tumefaciens;  **Bacillus thuringiensis",
      descricao_documental: "Ração para engorda de bovinos de corte em confinamento.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P104_dukamp-racao-confinamento-premium/fontes/D104.doc",
          arquivo_original: "RTPI/RTPI - Ração Corte - DK Rç Confinamento Premium.doc",
          sha256: "d59e99c724a5e662370d90aa2f833a370c07718b2f1d2e3479e6a5681308e173",
          source_id: "D104",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer entre 1 a 1,5% do peso vivo em ração, dependendo da qualidade do volumoso, estado corporal dos animais, estágio de desenvolvimento e do desempenho esperado. Fracionar o fornecimento em pelo menos dois tratos diários. Este produto contém uréia e, portanto, deve ser fornecido em cochos cobertos e/ou que evitem acúmulo de água. O uso de uréia adicional é contraindicado, salvo quando prescrito por profissional habilitado. Não fornecer esta ração para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos e debilitados. Para adaptação dos animais à uréia, iniciar fornecendo quantidades crescentes até atingir a quantia recomendada dentro de 10 dias. Manter boa disponibilidade de alimento volumoso para os animais, mesmo que de baixa qualidade.  Não fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. \n\nATENÇÃO: NÃO FORNECER A OUTRAS ESPÉCIES OU CATEGORIAS ANIMAIS QUE NÃO ÀS DESCRITAS NA INDICAÇÃO DO PRODUTO E/OU NO MODO DE USAR. NÃO ADMINISTRAR JUNTO A OUTROS PRODUTOS QUE CONTENHAM IONÓFOROS. NÃO PERMITIR ACESSO DE EQUINOS AO PRODUTO, POIS A INGESTÃO PODERÁ SER FATAL. ESTE PRODUTO CONTÉM IONÓFORO E O USO SIMULTÂNEO COM CERTAS SUBSTÂNCIAS MEDICAMENTOSAS PODE SER CONTRA-INDICADA. A MONENSINA, SALINOMICINA E A NARASINA SÃO INCOMPATÍVEIS COM A TIAMULINA.",
      nome_comercial_documental: "DUKAMP RAÇÃO CONFINAMENTO PREMIUM",
      principal_documental_source_id: "D104",
      produto_id: "P104",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia e, portanto, deve ser fornecido em cochos cobertos e/ou que evitem acúmulo de água. \nO uso de uréia adicional é contraindicado, salvo quando prescrito por profissional habilitado. \nNão fornecer esta ração para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos e debilitados. \nPara adaptação dos animais à uréia, iniciar fornecendo quantidades crescentes até atingir a quantia recomendada dentro de 10 dias. \nManter boa disponibilidade de alimento volumoso para os animais, mesmo que de baixa qualidade.  \nNão fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula.\nNão fornecer a outras espécies ou categorias animais que não às descritas na indicação do produto e/ou no modo de usar. \nNão administrar junto a outros produtos que contenham ionóforos. \nNão permitir acesso de equinos ao produto, pois a ingestão poderá ser fatal. \nEste produto contém ionóforo e o uso simultâneo com certas substâncias medicamentosas pode ser contra-indicada. \nA monensina, salinomicina e a narasina são incompatíveis com a tiamulina.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "347252a0d928b8a0a23cd8709e497c524676f7036be56bbff30f5e5b617ac443",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP RAÇÃO CONFINAMENTO SR", "RTPI - Ração Corte - DK Rç Confinamento SR"],
      bloqueios: [
        {
          descricao:
            "Zinco: especificação 'mím' e unidade 'mg/kg' preservadas. Confirmar a grafia antes de normalizar.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Ração Corte - DK Rç Confinamento SR.doc",
              evidence_id: "D105-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D105",
            },
          ],
          source_id: "D105",
          tipo: "grafia_unidade_especificacao",
        },
      ],
      classificacao_documental: "RAÇÃO",
      composicao_documental:
        "Farelo de soja*, farelo de algodão, farelo de polpa cítrica, farelo de trigo, fosfato bicálcico, carbonato de cálcio, milho integral moído**, uréia pecuária, premix mineral. Espécie doadora de genes (em caso de ingrediente transgênico):  *Agrobacterium tumefaciens;  **Bacillus thuringiensis",
      descricao_documental: "Ração para engorda de bovinos de corte em confinamento.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P105_dukamp-racao-confinamento-sr/fontes/D105.doc",
          arquivo_original: "RTPI/RTPI - Ração Corte - DK Rç Confinamento SR.doc",
          sha256: "0ccbda57bed4542bb12dcc82b1faa0ab87d548ba1082ff9bd67c4da786c21150",
          source_id: "D105",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer entre 1 a 1,5% do peso vivo em ração, dependendo da qualidade do volumoso, estado corporal dos animais, estágio de desenvolvimento e do desempenho esperado. Fracionar o fornecimento em pelo menos dois tratos diários. Este produto contém uréia e, portanto, deve ser fornecido em cochos cobertos e/ou que evitem acúmulo de água. O uso de uréia adicional é contraindicado, salvo quando prescrito por profissional habilitado. Não fornecer esta ração para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos e debilitados. Para adaptação dos animais à uréia, iniciar fornecendo quantidades crescentes até atingir a quantia recomendada dentro de 10 dias. Manter boa disponibilidade de alimento volumoso para os animais, mesmo que de baixa qualidade.  Não fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia.",
      nome_comercial_documental: "DUKAMP RAÇÃO CONFINAMENTO SR",
      principal_documental_source_id: "D105",
      produto_id: "P105",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia e, portanto, deve ser fornecido em cochos cobertos e/ou que evitem acúmulo de água. \nO uso de uréia adicional é contraindicado, salvo quando prescrito por profissional habilitado. \nNão fornecer esta ração para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos e debilitados. \nPara adaptação dos animais à uréia, iniciar fornecendo quantidades crescentes até atingir a quantia recomendada dentro de 10 dias. \nManter boa disponibilidade de alimento volumoso para os animais, mesmo que de baixa qualidade.  \nNão fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "fecbe74688760acc66ae9398eb8046837632f6688a264402f746be1df4103751",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP RAÇÃO CONFINAMENTO TOP", "RTPI - Ração Corte - DK Rç Confinamento Top"],
      bloqueios: [],
      classificacao_documental: "RAÇÃO",
      composicao_documental:
        "Farelo de soja*, farelo de algodão, farelo de polpa cítrica, farelo de trigo, fosfato bicálcico, carbonato de cálcio, milho integral moído**, uréia pecuária,monesina sódica, premix mineral vitamínico. Espécie doadora de genes (em caso de ingrediente transgênico):  *Agrobacterium tumefaciens;  **Bacillus thuringiensis",
      descricao_documental: "Ração para engorda de bovinos de corte em confinamento.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P106_dukamp-racao-confinamento-top/fontes/D106.doc",
          arquivo_original: "RTPI/RTPI - Ração Corte - DK Rç Confinamento Top.doc",
          sha256: "aadfe21f562832cd7436d1c96b5938fb74537fa8b192b967e3cf70876ab80c38",
          source_id: "D106",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer entre 1 a 1,5% do peso vivo em ração, dependendo da qualidade do volumoso, estado corporal dos animais, estágio de desenvolvimento e do desempenho esperado. Fracionar o fornecimento em pelo menos dois tratos diários. Este produto contém uréia e, portanto, deve ser fornecido em cochos cobertos e/ou que evitem acúmulo de água. O uso de uréia adicional é contraindicado, salvo quando prescrito por profissional habilitado. Não fornecer esta ração para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos e debilitados. Para adaptação dos animais à uréia, iniciar fornecendo quantidades crescentes até atingir a quantia recomendada dentro de 10 dias. Manter boa disponibilidade de alimento volumoso para os animais, mesmo que de baixa qualidade.  Não fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. \n\nATENÇÃO: NÃO FORNECER A OUTRAS ESPÉCIES OU CATEGORIAS ANIMAIS QUE NÃO ÀS DESCRITAS NA INDICAÇÃO DO PRODUTO E/OU NO MODO DE USAR. NÃO ADMINISTRAR JUNTO A OUTROS PRODUTOS QUE CONTENHAM IONÓFOROS. NÃO PERMITIR ACESSO DE EQUINOS AO PRODUTO, POIS A INGESTÃO PODERÁ SER FATAL. ESTE PRODUTO CONTÉM IONÓFORO E O USO SIMULTÂNEO COM CERTAS SUBSTÂNCIAS MEDICAMENTOSAS PODE SER CONTRA-INDICADA. A MONENSINA, SALINOMICINA E A NARASINA SÃO INCOMPATÍVEIS COM A TIAMULINA.",
      nome_comercial_documental: "DUKAMP RAÇÃO CONFINAMENTO TOP",
      principal_documental_source_id: "D106",
      produto_id: "P106",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia e, portanto, deve ser fornecido em cochos cobertos e/ou que evitem acúmulo de água. \nO uso de uréia adicional é contraindicado, salvo quando prescrito por profissional habilitado. \nNão fornecer esta ração para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos e debilitados. \nPara adaptação dos animais à uréia, iniciar fornecendo quantidades crescentes até atingir a quantia recomendada dentro de 10 dias. \nManter boa disponibilidade de alimento volumoso para os animais, mesmo que de baixa qualidade.  \nNão fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula.\nNão fornecer a outras espécies ou categorias animais que não às descritas na indicação do produto e/ou no modo de usar. \nNão administrar junto a outros produtos que contenham ionóforos. \nNão permitir acesso de equinos ao produto, pois a ingestão poderá ser fatal. \nEste produto contém ionóforo e o uso simultâneo com certas substâncias medicamentosas pode ser contra-indicada. \nA monensina, salinomicina e a narasina são incompatíveis com a tiamulina.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "37b184e28d9c27b1a0df5503696ca03b95e08a5a4b21b37923570babbdada513",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP RAÇÃO DUKAVALLUS", "RTPI - Ração Outras - DK Rç Dukavallus"],
      bloqueios: [
        {
          descricao:
            "Umidade: tabela técnica = 130 g/kg; anexo = Umidademáx140g/kg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original:
                "RTPI/Produtos mais Vendidos/RTPI - Ração Outras - DK Rç Dukavallus.doc",
              evidence_id: "D021-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D021",
            },
          ],
          source_id: "D021",
          tipo: "garantia_entre_blocos",
        },
      ],
      classificacao_documental: "RAÇÃO",
      composicao_documental:
        "Farelo de soja*, carbonato de cálcio, milho integral moído**, melaço de cana em pó, fosfato bicálcico, aveia branca, farelo de trigo, premix mineral vitamínico. Espécie doadora de genes (em caso de ingredientes trangênicos):  *Agrobacterium tumefaciens;  **Bacillus thuringiensis.",
      descricao_documental: "Produto indicado para alimentação de equinos em manutenção.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P021_dukamp-racao-dukavallus/fontes/D021.doc",
          arquivo_original:
            "RTPI/Produtos mais Vendidos/RTPI - Ração Outras - DK Rç Dukavallus.doc",
          sha256: "8a01a1b262cabd8503c3c8aafbe9e6bf232bc38af8f931d2e74c310896e9d539",
          source_id: "D021",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer o produto Dukamp Ração Dukavallus para equinos acima de 1 ano de idade, em repouso, de 1 a 1,5 kg de ração para cada 100 kg de peso vivo, dependendo da qualidade do volumoso e do escore de condição corporal do animal. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional habilitado de sua confiança.",
      nome_comercial_documental: "DUKAMP RAÇÃO DUKAVALLUS",
      principal_documental_source_id: "D021",
      produto_id: "P021",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "(nenhuma)",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "22bb1e30d84d548b7782f3d41f5b9268cad21d95b23835deb32d768423877c22",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP RAÇÃO DUKAVALLUS 14", "RTPI - Ração Outras - DK Rç Dukavallus 14"],
      bloqueios: [
        {
          descricao:
            "Umidade: tabela técnica = 130 g/kg; anexo = Umidademáx140g/kg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Ração Outras - DK Rç Dukavallus 14.doc",
              evidence_id: "D131-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D131",
            },
          ],
          source_id: "D131",
          tipo: "garantia_entre_blocos",
        },
      ],
      classificacao_documental: "RAÇÃO",
      composicao_documental:
        "Farelo de soja*, carbonato de cálcio, milho integral moído**, melaço de cana em pó, fosfato bicálcico, aveia branca, farelo de trigo, premix mineral vitamínico. Espécie doadora de genes (em caso de ingredientes trangênicos):  *Agrobacterium tumefaciens;  **Bacillus thuringiensis.",
      descricao_documental: "Produto indicado para alimentação de equinos em manutenção.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P131_dukamp-racao-dukavallus-14/fontes/D131.doc",
          arquivo_original: "RTPI/RTPI - Ração Outras - DK Rç Dukavallus 14.doc",
          sha256: "97d50bee5499417d4d0570fc08806209f1988310026196e5966b8b54b40bdf0e",
          source_id: "D131",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer o produto Dukamp Ração Dukavallus para equinos acima de 1 ano de idade, em repouso, de 1 a 1,5 kg de ração para cada 100 kg de peso vivo, dependendo da qualidade do volumoso e do escore de condição corporal do animal. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional habilitado de sua confiança.",
      nome_comercial_documental: "DUKAMP RAÇÃO DUKAVALLUS 14",
      principal_documental_source_id: "D131",
      produto_id: "P131",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "(nenhuma)",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "4da6ebec32de6b911c94c80cf024eda87753f30c260a5c63ec2dab3db72d8a62",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP RAÇÃO DUKAVALLUS ÉGUA", "RTPI - Ração Outras - DK Rç Dukavallus Égua"],
      bloqueios: [
        {
          descricao:
            "A indicação é éguas em reprodução; o modo de usar descreve equinos acima de 1 ano em repouso. Confirmar a aplicação à gestação, lactação e demais fases reprodutivas.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Ração Outras - DK Rç Dukavallus Égua.doc",
              evidence_id: "D133-S11",
              pagina_pdf_inicio: null,
              secao_numero_original: 12,
              secao_semantica: "Indicação e espécie",
              source_id: "D133",
            },
            {
              arquivo_original: "RTPI/RTPI - Ração Outras - DK Rç Dukavallus Égua.doc",
              evidence_id: "D133-S12",
              pagina_pdf_inicio: null,
              secao_numero_original: 13,
              secao_semantica: "Modo de usar",
              source_id: "D133",
            },
          ],
          source_id: "D133",
          tipo: "categoria",
        },
        {
          descricao:
            "Umidade: tabela técnica = 130 g/kg; anexo = Umidademáx140g/kg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Ração Outras - DK Rç Dukavallus Égua.doc",
              evidence_id: "D133-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D133",
            },
          ],
          source_id: "D133",
          tipo: "garantia_entre_blocos",
        },
      ],
      classificacao_documental: "RAÇÃO",
      composicao_documental:
        "Farelo de soja*, carbonato de cálcio, milho integral moído**, melaço de cana em pó, fosfato bicálcico, aveia branca, farelo de trigo, premix mineral vitamínico. Espécie doadora de genes (em caso de ingredientes trangênicos):  *Agrobacterium tumefaciens;  **Bacillus thuringiensis.",
      descricao_documental: "Produto indicado para alimentação para éguas em reprodução.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P133_dukamp-racao-dukavallus-egua/fontes/D133.doc",
          arquivo_original: "RTPI/RTPI - Ração Outras - DK Rç Dukavallus Égua.doc",
          sha256: "40dc3e5b48c00a8d6f3da828ed04f8fb0938baa1e34dd33960481c70765a3860",
          source_id: "D133",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer o produto Dukamp Ração Dukavallus Égua para equinos acima de 1 ano de idade, em repouso, de 1 a 1,5 kg de ração para cada 100 kg de peso vivo, dependendo da qualidade do volumoso e do escore de condição corporal do animal. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional habilitado de sua confiança.",
      nome_comercial_documental: "DUKAMP RAÇÃO DUKAVALLUS ÉGUA",
      principal_documental_source_id: "D133",
      produto_id: "P133",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "(nenhuma)",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "496baf12dee26902307b415b1dccf4332f57c16e7459cbbab74ee24720b5aaeb",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP RAÇÃO DUKAVALLUS POTRO", "RTPI - Ração Outras - DK Rç Dukavallus Potro"],
      bloqueios: [
        {
          descricao:
            "A indicação é equinos em desenvolvimento e o nome contém Potro, mas o modo de usar limita a equinos acima de 1 ano em repouso. Confirmar faixa etária e manejo; não recomendar a potros mais jovens.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Ração Outras - DK Rç Dukavallus Potro.doc",
              evidence_id: "D132-S02",
              pagina_pdf_inicio: null,
              secao_numero_original: 2,
              secao_semantica: "Nome comercial",
              source_id: "D132",
            },
            {
              arquivo_original: "RTPI/RTPI - Ração Outras - DK Rç Dukavallus Potro.doc",
              evidence_id: "D132-S11",
              pagina_pdf_inicio: null,
              secao_numero_original: 12,
              secao_semantica: "Indicação e espécie",
              source_id: "D132",
            },
            {
              arquivo_original: "RTPI/RTPI - Ração Outras - DK Rç Dukavallus Potro.doc",
              evidence_id: "D132-S12",
              pagina_pdf_inicio: null,
              secao_numero_original: 13,
              secao_semantica: "Modo de usar",
              source_id: "D132",
            },
          ],
          source_id: "D132",
          tipo: "categoria_idade",
        },
        {
          descricao:
            "Umidade: tabela técnica = 130 g/kg; anexo = Umidademáx140g/kg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Ração Outras - DK Rç Dukavallus Potro.doc",
              evidence_id: "D132-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D132",
            },
          ],
          source_id: "D132",
          tipo: "garantia_entre_blocos",
        },
      ],
      classificacao_documental: "RAÇÃO",
      composicao_documental:
        "Farelo de soja*, carbonato de cálcio, milho integral moído**, melaço de cana em pó, fosfato bicálcico, aveia branca, farelo de trigo, premix mineral vitamínico. Espécie doadora de genes (em caso de ingredientes trangênicos):  *Agrobacterium tumefaciens;  **Bacillus thuringiensis.",
      descricao_documental: "Produto indicado para alimentação de equinos em desenvolvimento",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P132_dukamp-racao-dukavallus-potro/fontes/D132.doc",
          arquivo_original: "RTPI/RTPI - Ração Outras - DK Rç Dukavallus Potro.doc",
          sha256: "241a3c04ef4da5bb31341121424dfaa109022c53f1cb4531f69eff3696ea86c0",
          source_id: "D132",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer o produto Dukamp Ração Dukavallus Potro para equinos acima de 1 ano de idade, em repouso, de 1 a 1,5 kg de ração para cada 100 kg de peso vivo, dependendo da qualidade do volumoso e do escore de condição corporal do animal. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional habilitado de sua confiança.",
      nome_comercial_documental: "DUKAMP RAÇÃO DUKAVALLUS POTRO",
      principal_documental_source_id: "D132",
      produto_id: "P132",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "(nenhuma)",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "d712cf5939026b594253c1ccc0ce1de8d1ff225bec02650c766154719ee59308",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP RAÇÃO LACTAÇÃO 22", "RTPI - Ração Leite - DK Rç Lactação 22"],
      bloqueios: [],
      classificacao_documental: "RAÇÃO",
      composicao_documental:
        "Farelo de soja*, farelo de algodão, farelo de polpa cítrica, farelo de trigo, fosfato bicálcico, carbonato de cálcio, melaço em pó, milho integral moído**, uréia pecuária,  premix mineral vitamínico. Espécie doadora de genes (em caso de ingrediente transgênico):  *Agrobacterium tumefaciens;  **Bacillus thuringiensis, monensina sodica",
      descricao_documental:
        "Ração para vacas em lactação com produções entre 7 e 15 litros de leite por dia.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P124_dukamp-racao-lactacao-22/fontes/D124.doc",
          arquivo_original: "RTPI/RTPI - Ração Leite - DK Rç Lactação 22.doc",
          sha256: "90b6086fd147f404b4f0e552b22a8decc68a8eedcc482ca3e1194186c13f5036",
          source_id: "D124",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer as vacas em lactação na proporção de 1 kg de ração para cada 2,5 a 3 litros de leite produzidos, de acordo com o estágio da lactação, qualidade do volumoso e estado corporal dos animais. A introdução da ração na dieta deverá ser gradual, substituindo parte da ração atualmente em uso por esse produto, até a substituição completa dentro de 14 dias. Este produto contém uréia, sendo contra-indicado o uso de uréia adicional. Fornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. Não fornecer o produto para animais lactentes e/ou para animais em jejum, famintos e debilitados. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia.",
      nome_comercial_documental: "DUKAMP RAÇÃO LACTAÇÃO 22",
      principal_documental_source_id: "D124",
      produto_id: "P124",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia, sendo contra-indicado o uso de uréia adicional. \nFornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. \nNão fornecer o produto para animais lactentes e/ou para animais em jejum, famintos e debilitados.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "41003676029aa865ba92b2905cfbd2b3ed880203a333b56ef3e0d27392738eb6",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP RAÇÃO LACTAÇÃO 22 SU", "RTPI - Ração Leite - DK Rç Lactação 22 SU"],
      bloqueios: [],
      classificacao_documental: "RAÇÃO",
      composicao_documental:
        "Farelo de soja*, farelo de algodão, farelo de polpa cítrica, farelo de trigo, fosfato bicálcico, carbonato de cálcio, melaço em pó, milho integral moído**,  premix mineral vitamínico. Espécie doadora de genes (em caso de ingrediente transgênico):  *Agrobacterium tumefaciens;  **Bacillus thuringiensis, monensina sodica",
      descricao_documental:
        "Ração para vacas em lactação com produções entre 7 e 15 litros de leite por dia.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P122_dukamp-racao-lactacao-22-su/fontes/D122.doc",
          arquivo_original: "RTPI/RTPI - Ração Leite - DK Rç Lactação 22 SU.doc",
          sha256: "6b7fd766b57f6f834247ac65ae17164ab4507f182d754516501b4d2bbd030b11",
          source_id: "D122",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer as vacas em lactação na proporção de 1 kg de ração para cada 2,5 a 3 litros de leite produzidos, de acordo com o estágio da lactação, qualidade do volumoso e estado corporal dos animais. A introdução da ração na dieta deverá ser gradual, substituindo parte da ração atualmente em uso por esse produto, até a substituição completa dentro de 14 dias. Este produto contém uréia, sendo contra-indicado o uso de uréia adicional. Fornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. Não fornecer o produto para animais lactentes e/ou para animais em jejum, famintos e debilitados. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia.",
      nome_comercial_documental: "DUKAMP RAÇÃO LACTAÇÃO 22 SU",
      principal_documental_source_id: "D122",
      produto_id: "P122",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia, sendo contra-indicado o uso de uréia adicional. \nFornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. \nNão fornecer o produto para animais lactentes e/ou para animais em jejum, famintos e debilitados.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "9b3cd30e2818926290da010adaad48010239dc990dbadafbb7206f54c90365dc",
    kind: "catalog",
    product: {
      aliases: [
        "DUKAMP RAÇÃO LACTAÇÃO 22 TIROLEZ",
        "RTPI - Ração Leite - DK Rç Lactação 22 TIROLEZ",
      ],
      bloqueios: [],
      classificacao_documental: "RAÇÃO",
      composicao_documental:
        "Farelo de soja*, farelo de algodão, farelo de polpa cítrica, farelo de trigo, fosfato bicálcico, carbonato de cálcio, melaço em pó, milho integral moído**, uréia pecuária,  premix mineral vitamínico. Espécie doadora de genes (em caso de ingrediente transgênico):  *Agrobacterium tumefaciens;  **Bacillus thuringiensis.",
      descricao_documental:
        "Ração para vacas em lactação com produções entre 7 e 15 litros de leite por dia.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P123_dukamp-racao-lactacao-22-tirolez/fontes/D123.doc",
          arquivo_original: "RTPI/RTPI - Ração Leite - DK Rç Lactação 22 TIROLEZ.doc",
          sha256: "c3c3a142eeb45f349b809920b49daa20d2ed5dd4fc8463e2007609797531e2e6",
          source_id: "D123",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer as vacas em lactação na proporção de 1 kg de ração para cada 2,5 a 3 litros de leite produzidos, de acordo com o estágio da lactação, qualidade do volumoso e estado corporal dos animais. A introdução da ração na dieta deverá ser gradual, substituindo parte da ração atualmente em uso por esse produto, até a substituição completa dentro de 14 dias. Este produto contém uréia, sendo contra-indicado o uso de uréia adicional. Fornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. Não fornecer o produto para animais lactentes e/ou para animais em jejum, famintos e debilitados. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia.",
      nome_comercial_documental: "DUKAMP RAÇÃO LACTAÇÃO 22 TIROLEZ",
      principal_documental_source_id: "D123",
      produto_id: "P123",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia, sendo contra-indicado o uso de uréia adicional. \nFornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. \nNão fornecer o produto para animais lactentes e/ou para animais em jejum, famintos e debilitados.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "3230ae9e2d36becd7f753a731202b1217e0c8b5f65fada969eb0d5d5877a17db",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP RAÇÃO LACTAÇÃO 24", "RTPI - Ração Leite - DK Rç Lactação 24"],
      bloqueios: [
        {
          descricao:
            "Matéria mineral: tabela técnica = 30 / 150 g/kg; anexo = Matéria mineralmín/máx70 / 160 g/kg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Ração Leite - DK Rç Lactação 24.doc",
              evidence_id: "D127-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D127",
            },
          ],
          source_id: "D127",
          tipo: "garantia_entre_blocos",
        },
      ],
      classificacao_documental: "RAÇÃO",
      composicao_documental:
        "Farelo de soja*, farelo de algodão, farelo de polpa cítrica, farelo de trigo, fosfato bicálcico, carbonato de cálcio, melaço em pó, milho integral moído**, uréia pecuária,  premix mineral vitamínico. Espécie doadora de genes (em caso de ingrediente transgênico):  *Agrobacterium tumefaciens;  **Bacillus thuringiensis.",
      descricao_documental:
        "Ração para vacas em lactação com produções entre 10 e 15 litros de leite por dia.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P127_dukamp-racao-lactacao-24/fontes/D127.doc",
          arquivo_original: "RTPI/RTPI - Ração Leite - DK Rç Lactação 24.doc",
          sha256: "63be0e78c8626af28901978014b2a079dd97e8b70e3df828e09c5b96a17d2136",
          source_id: "D127",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer as vacas em lactação na proporção de 1 kg de ração para cada 2,5 a 3 litros de leite produzidos, de acordo com o estágio da lactação, qualidade do volumoso e estado corporal dos animais. A introdução da ração na dieta deverá ser gradual, substituindo parte da ração atualmente em uso por esse produto, até a substituição completa dentro de 14 dias. Este produto contém uréia, sendo contra-indicado o uso de uréia adicional. Fornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. Não fornecer o produto para animais lactentes e/ou para animais em jejum, famintos e debilitados. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia.",
      nome_comercial_documental: "DUKAMP RAÇÃO LACTAÇÃO 24",
      principal_documental_source_id: "D127",
      produto_id: "P127",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia, sendo contra-indicado o uso de uréia adicional. \nFornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. \nNão fornecer o produto para animais lactentes e/ou para animais em jejum, famintos e debilitados.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "615ef0a66b7e1f61343f5a68386fb30f3f12d0601d0fa1ca224121d08cb319cf",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP RAÇÃO LACTAÇÃO 24 SU", "RTPI - Ração Leite - DK Rç Lactação 24  SU"],
      bloqueios: [
        {
          descricao:
            "Matéria mineral: tabela técnica = 30 / 150 g/kg; anexo = Matéria mineralmín/máx70 / 160 g/kg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Ração Leite - DK Rç Lactação 24  SU.doc",
              evidence_id: "D125-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D125",
            },
          ],
          source_id: "D125",
          tipo: "garantia_entre_blocos",
        },
        {
          descricao:
            "Monensina sódica: especificação 'mín' e unidade 'mgr/kg' preservadas. Confirmar a grafia antes de normalizar.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Ração Leite - DK Rç Lactação 24  SU.doc",
              evidence_id: "D125-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D125",
            },
          ],
          source_id: "D125",
          tipo: "grafia_unidade_especificacao",
        },
      ],
      classificacao_documental: "RAÇÃO",
      composicao_documental:
        "Farelo de soja*, farelo de algodão, farelo de polpa cítrica, farelo de trigo, fosfato bicálcico, carbonato de cálcio, melaço em pó, milho integral moído**, premix mineral vitamínico. Espécie doadora de genes (em caso de ingrediente transgênico):  *Agrobacterium tumefaciens;  **Bacillus thuringiensis, monensina sódica",
      descricao_documental:
        "Ração para vacas em lactação com produções entre 10 e 15 litros de leite por dia.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P125_dukamp-racao-lactacao-24-su/fontes/D125.doc",
          arquivo_original: "RTPI/RTPI - Ração Leite - DK Rç Lactação 24  SU.doc",
          sha256: "631676ab58c1a4dca7f1d8b92d789cbd6f90480983dc3347f01fb43a2efe54d0",
          source_id: "D125",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer as vacas em lactação na proporção de 1 kg de ração para cada 2,5 a 3 litros de leite produzidos, de acordo com o estágio da lactação, qualidade do volumoso e estado corporal dos animais. A introdução da ração na dieta deverá ser gradual, substituindo parte da ração atualmente em uso por esse produto, até a substituição completa dentro de 14 dias. Este produto contém uréia, sendo contra-indicado o uso de uréia adicional. Fornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. Não fornecer o produto para animais lactentes e/ou para animais em jejum, famintos e debilitados. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia.",
      nome_comercial_documental: "DUKAMP RAÇÃO LACTAÇÃO 24 SU",
      principal_documental_source_id: "D125",
      produto_id: "P125",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia, sendo contra-indicado o uso de uréia adicional. \nFornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. \nNão fornecer o produto para animais lactentes e/ou para animais em jejum, famintos e debilitados.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "de2be9c5fbf58025912ea727888e696d4b501a35cd54bc2f64482f25e7a60f13",
    kind: "catalog",
    product: {
      aliases: [
        "DUKAMP RAÇÃO LACTAÇÃO 24 TIROLEZ",
        "RTPI - Ração Leite - DK Rç Lactação 24 TIROLEZ",
      ],
      bloqueios: [],
      classificacao_documental: "RAÇÃO",
      composicao_documental:
        "Farelo de soja*, farelo de algodão, farelo de polpa cítrica, farelo de trigo, fosfato bicálcico, carbonato de cálcio, melaço em pó, milho integral moído**, uréia pecuária,  premix mineral vitamínico. Espécie doadora de genes (em caso de ingrediente transgênico):  *Agrobacterium tumefaciens;  **Bacillus thuringiensis.",
      descricao_documental:
        "Ração para vacas em lactação com produções entre 10 e 15 litros de leite por dia.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P126_dukamp-racao-lactacao-24-tirolez/fontes/D126.doc",
          arquivo_original: "RTPI/RTPI - Ração Leite - DK Rç Lactação 24 TIROLEZ.doc",
          sha256: "1519aeb292ad44a1c1204ad659c5cfd6b2c48107d3d079f426517748ae68d08e",
          source_id: "D126",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer as vacas em lactação na proporção de 1 kg de ração para cada 2,5 a 3 litros de leite produzidos, de acordo com o estágio da lactação, qualidade do volumoso e estado corporal dos animais. A introdução da ração na dieta deverá ser gradual, substituindo parte da ração atualmente em uso por esse produto, até a substituição completa dentro de 14 dias. Este produto contém uréia, sendo contra-indicado o uso de uréia adicional. Fornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. Não fornecer o produto para animais lactentes e/ou para animais em jejum, famintos e debilitados. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia.",
      nome_comercial_documental: "DUKAMP RAÇÃO LACTAÇÃO 24 TIROLEZ",
      principal_documental_source_id: "D126",
      produto_id: "P126",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia, sendo contra-indicado o uso de uréia adicional. \nFornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. \nNão fornecer o produto para animais lactentes e/ou para animais em jejum, famintos e debilitados.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "d63611161f2dbc0061b2bf1fe2406b32336cb29417775b3f2f82adfb874b4a21",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP RAÇÃO LACTAÇÃO ST", "RTPI - Ração Leite - DK Rç Lactação ST"],
      bloqueios: [],
      classificacao_documental: "RAÇÃO",
      composicao_documental:
        "Farelo de soja*, farelo de algodão, farelo de polpa cítrica, farelo de trigo, fosfato bicálcico, carbonato de cálcio, melaço em pó, milho integral moído**, uréia pecuária,  premix mineral vitamínico. Espécie doadora de genes (em caso de ingrediente transgênico):  *Agrobacterium tumefaciens;  **Bacillus thuringiensis.",
      descricao_documental:
        "Ração para vacas em lactação com produções entre 7 e 15 litros de leite por dia.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P128_dukamp-racao-lactacao-st/fontes/D128.doc",
          arquivo_original: "RTPI/RTPI - Ração Leite - DK Rç Lactação ST.doc",
          sha256: "57c1737cf5e79f66863f02b45fbff2f7f568eeae5fa6b7fbb9388dd790f36d3c",
          source_id: "D128",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer as vacas em lactação na proporção de 1 kg de ração para cada 2,5 a 3 litros de leite produzidos, de acordo com o estágio da lactação, qualidade do volumoso e estado corporal dos animais. A introdução da ração na dieta deverá ser gradual, substituindo parte da ração atualmente em uso por esse produto, até a substituição completa dentro de 14 dias. Este produto contém uréia, sendo contra-indicado o uso de uréia adicional. Fornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. Não fornecer o produto para animais lactentes e/ou para animais em jejum, famintos e debilitados. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia.",
      nome_comercial_documental: "DUKAMP RAÇÃO LACTAÇÃO ST",
      principal_documental_source_id: "D128",
      produto_id: "P128",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia, sendo contra-indicado o uso de uréia adicional. \nFornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. \nNão fornecer o produto para animais lactentes e/ou para animais em jejum, famintos e debilitados.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "390ddf27ea397a0bd05628515deb7f30ed213160ffaff4594a58f365bd3048c0",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP RAÇÃO LACTAÇÃO TRIUNFO", "RTPI - Ração Leite - DK Rç Lactação Triunfo"],
      bloqueios: [],
      classificacao_documental: "RAÇÃO",
      composicao_documental:
        "Farelo de soja*, farelo de algodão, farelo de polpa cítrica, farelo de trigo, fosfato bicálcico, carbonato de cálcio, melaço em pó, milho integral moído**, uréia pecuária,  premix mineral vitamínico. Espécie doadora de genes (em caso de ingrediente transgênico):  *Agrobacterium tumefaciens;  **Bacillus thuringiensis, monensian sodica",
      descricao_documental:
        "Ração para vacas em lactação com produções entre 7 e 15 litros de leite por dia.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P129_dukamp-racao-lactacao-triunfo/fontes/D129.doc",
          arquivo_original: "RTPI/RTPI - Ração Leite - DK Rç Lactação Triunfo.doc",
          sha256: "a6c20eea176e073c7f01cf75472c5359fdd7237cc805f26769be6096af90d183",
          source_id: "D129",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer as vacas em lactação na proporção de 1 kg de ração para cada 2,5 a 3 litros de leite produzidos, de acordo com o estágio da lactação, qualidade do volumoso e estado corporal dos animais. A introdução da ração na dieta deverá ser gradual, substituindo parte da ração atualmente em uso por esse produto, até a substituição completa dentro de 14 dias. Este produto contém uréia, sendo contra-indicado o uso de uréia adicional. Fornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. Não fornecer o produto para animais lactentes e/ou para animais em jejum, famintos e debilitados. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia.",
      nome_comercial_documental: "DUKAMP RAÇÃO LACTAÇÃO TRIUNFO",
      principal_documental_source_id: "D129",
      produto_id: "P129",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia, sendo contra-indicado o uso de uréia adicional. \nFornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. \nNão fornecer o produto para animais lactentes e/ou para animais em jejum, famintos e debilitados.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "e1b89cbfe6be22d899b9f87fe95b010da56ef9af406df7ec8ce00dd4fab3ea5d",
    kind: "catalog",
    product: {
      aliases: [
        "DUKAMP RAÇÃO PROTEINADA DUKAVALLUS",
        "RTPI - Ração Outras - DK Rç Proteinada Dukavallus",
      ],
      bloqueios: [
        {
          descricao:
            "Embora o nome contenha Proteinada, a classificação é ração e a indicação é manutenção de equinos. Não confundir com proteinados para bovinos.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Ração Outras - DK Rç Proteinada Dukavallus.doc",
              evidence_id: "D135-S02",
              pagina_pdf_inicio: null,
              secao_numero_original: 2,
              secao_semantica: "Nome comercial",
              source_id: "D135",
            },
            {
              arquivo_original: "RTPI/RTPI - Ração Outras - DK Rç Proteinada Dukavallus.doc",
              evidence_id: "D135-S03",
              pagina_pdf_inicio: null,
              secao_numero_original: 3,
              secao_semantica: "Classificação",
              source_id: "D135",
            },
            {
              arquivo_original: "RTPI/RTPI - Ração Outras - DK Rç Proteinada Dukavallus.doc",
              evidence_id: "D135-S11",
              pagina_pdf_inicio: null,
              secao_numero_original: 12,
              secao_semantica: "Indicação e espécie",
              source_id: "D135",
            },
          ],
          source_id: "D135",
          tipo: "nome_classificacao",
        },
      ],
      classificacao_documental: "RAÇÃO",
      composicao_documental:
        "Farelo de soja*, carbonato de cálcio, milho integral moído**, melaço de cana em pó, fosfato bicálcico, aveia branca, farelo de trigo, premix mineral vitamínico. Espécie doadora de genes (em caso de ingredientes trangênicos):  *Agrobacterium tumefaciens;  **Bacillus thuringiensis.",
      descricao_documental: "Produto indicado para alimentação de equinos em manutenção.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P135_dukamp-racao-proteinada-dukavallus/fontes/D135.doc",
          arquivo_original: "RTPI/RTPI - Ração Outras - DK Rç Proteinada Dukavallus.doc",
          sha256: "1cec89950e29e157b3c0e64b517739d0662d1de232005f5bba9554b27c49219a",
          source_id: "D135",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer o produto Dukamp Ração Proteinada Dukavallus para equinos acima de 1 ano de idade, em repouso, de 100 g de ração para cada 100 kg de peso vivo, dependendo da qualidade do volumoso e do escore de condição corporal do animal. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional habilitado de sua confiança.",
      nome_comercial_documental: "DUKAMP RAÇÃO PROTEINADA DUKAVALLUS",
      principal_documental_source_id: "D135",
      produto_id: "P135",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "(nenhuma)",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "48914d5b6f5a7707cb89c616c08f1799e24cef3b2889eb1bc593d20eb9bd52b6",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP RAÇÃO REPRODUTOR", "RTPI - Ração Corte - DK Rç Reprodutor"],
      bloqueios: [
        {
          descricao:
            "A versão PDF D005 declara zinco 120 mg/kg; o enriquecimento no corpo do Word D108 não traz linha de zinco. Preservar ambas as versões sem completar a tabela Word com um valor de outro documento.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Ração Corte - DK Rç Reprodutor.doc",
              evidence_id: "D108-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D108",
            },
          ],
          source_id: "D108",
          tipo: "tabela_incompleta_entre_fontes",
        },
        {
          descricao:
            "Cobre: especificação 'mím.' e unidade 'mg/kg' preservadas. Confirmar a grafia antes de normalizar.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Ração Corte - DK Rç Reprodutor.doc",
              evidence_id: "D108-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D108",
            },
          ],
          source_id: "D108",
          tipo: "grafia_unidade_especificacao",
        },
        {
          descricao:
            "Iodo: especificação 'mím.' e unidade 'mg/kg' preservadas. Confirmar a grafia antes de normalizar.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Ração Corte - DK Rç Reprodutor.doc",
              evidence_id: "D108-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D108",
            },
          ],
          source_id: "D108",
          tipo: "grafia_unidade_especificacao",
        },
        {
          descricao:
            "Ferro: especificação 'mím.' e unidade 'mg/kg' preservadas. Confirmar a grafia antes de normalizar.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Ração Corte - DK Rç Reprodutor.doc",
              evidence_id: "D108-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D108",
            },
          ],
          source_id: "D108",
          tipo: "grafia_unidade_especificacao",
        },
      ],
      classificacao_documental: "RAÇÃO",
      composicao_documental:
        "Farelo de soja*, farelo de trigo, fosfato bicálcico, carbonato de cálcio, milho integral moído**, uréia pecuária, monesina sódica, premix mineral vitamínico. Espécie doadora de genes (em caso de ingrediente transgênico):  *Agrobacterium tumefaciens;  **Bacillus thuringiensis",
      descricao_documental:
        "Ração para bovinos machos adultos em fase de reprodução, criados a pasto ou estabulados.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P108_dukamp-racao-reprodutor/fontes/D005.pdf",
          arquivo_original: "RTPI/Dukamp - RTPI - Dukamp Ração Reprodutor.pdf",
          sha256: "57bb4c05dc4ae04ed1b8b70cc2d9acc76ea379cc50e89bf5af8cf41053bdb2c8",
          source_id: "D005",
          versao_papel: "pdf_paralelo",
        },
        {
          arquivo_no_pacote: "produtos/P108_dukamp-racao-reprodutor/fontes/D108.doc",
          arquivo_original: "RTPI/RTPI - Ração Corte - DK Rç Reprodutor.doc",
          sha256: "8a2b4d519679551d2d1e465a7050606ec59fa43f14d5dd9113785700162ab3ce",
          source_id: "D108",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer entre 1 a 1,5% do peso vivo em ração, dependendo da qualidade do volumoso, estado corporal dos animais, estágio de desenvolvimento e do desempenho esperado. Fracionar o fornecimento em pelo menos dois tratos diários. Este produto contém uréia, sendo contra-indicado o uso de uréia adicional. Fornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. Não fornecer o produto para animais lactentes e/ou para animais em jejum, famintos e debilitados. \n\nATENÇÃO: NÃO FORNECER A OUTRAS ESPÉCIES OU CATEGORIAS ANIMAIS QUE NÃO ÀS DESCRITAS NA INDICAÇÃO DO PRODUTO E/OU NO MODO DE USAR. NÃO ADMINISTRAR JUNTO A OUTROS PRODUTOS QUE CONTENHAM IONÓFOROS. NÃO PERMITIR ACESSO DE EQUINOS AO PRODUTO, POIS A INGESTÃO PODERÁ SER FATAL. ESTE PRODUTO CONTÉM IONÓFORO E O USO SIMULTÂNEO COM CERTAS SUBSTÂNCIAS MEDICAMENTOSAS PODE SER CONTRA-INDICADA. A MONENSINA, SALINOMICINA E A NARASINA SÃO INCOMPATÍVEIS COM A TIAMULINA.",
      nome_comercial_documental: "DUKAMP RAÇÃO REPRODUTOR",
      principal_documental_source_id: "D108",
      produto_id: "P108",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia, sendo contra-indicado o uso de uréia adicional. \nFornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. \nNão fornecer o produto para animais lactentes e/ou para animais em jejum, famintos e debilitados. \nNão fornecer a outras espécies ou categorias animais que não às descritas na indicação do produto e/ou no modo de usar. \nNão administrar junto a outros produtos que contenham ionóforos. \nNão permitir acesso de equinos ao produto, pois a ingestão poderá ser fatal. \nEste produto contém ionóforo e o uso simultâneo com certas substâncias medicamentosas pode ser contra-indicada. \nA monensina, salinomicina e a narasina são incompatíveis com a tiamulina.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "e1b0b2bfd9f4e817712e5537c47b1066f7a75f3b97fdd8acb65f29d2665839e7",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP RAÇÃO RODEO BULLS", "RTPI - Ração Elite - DK Rç Rodeo Bulls"],
      bloqueios: [
        {
          descricao:
            "Vitamina A: tabela técnica = 7500 ui/kg; anexo = Vitamina A.................................mín........................5600 ui/kg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Ração Elite - DK Rç Rodeo Bulls.doc",
              evidence_id: "D119-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D119",
            },
          ],
          source_id: "D119",
          tipo: "garantia_entre_blocos",
        },
        {
          descricao:
            "Vitamina D3: tabela técnica = 1500 ui/kg; anexo = Vitamina D3mín..........................1120 ui/kg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Ração Elite - DK Rç Rodeo Bulls.doc",
              evidence_id: "D119-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D119",
            },
          ],
          source_id: "D119",
          tipo: "garantia_entre_blocos",
        },
        {
          descricao:
            "Vitamina E: tabela técnica = 45 ui/kg; anexo = Vitamina Emín32ui/kg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Ração Elite - DK Rç Rodeo Bulls.doc",
              evidence_id: "D119-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D119",
            },
          ],
          source_id: "D119",
          tipo: "garantia_entre_blocos",
        },
        {
          descricao:
            "Zinco: especificação 'mím' e unidade 'mg/kg' preservadas. Confirmar a grafia antes de normalizar.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Ração Elite - DK Rç Rodeo Bulls.doc",
              evidence_id: "D119-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D119",
            },
          ],
          source_id: "D119",
          tipo: "grafia_unidade_especificacao",
        },
      ],
      classificacao_documental: "RAÇÃO PARA BOVINOS",
      composicao_documental:
        "Farelo de soja*, farelo de trigo, fosfato bicálcico, carbonato de cálcio, melaço em pó, milho integral moído**, uréia pecuária,  sal cálcico de ácido graxo, óleo vegetal, aditivo antioxidante, bicarbonato de sódio, monensina sodica, calcareo calcitico , premix mineral vitamínico. Espécie doadora de genes (em caso de ingrediente transgênico):  *Agrobacterium tumefaciens;  **Bacillus thuringiensis.",
      descricao_documental: "Ração para touros de rodeio adultos, criados a pasto ou estabulados.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P119_dukamp-racao-rodeo-bulls/fontes/D119.doc",
          arquivo_original: "RTPI/RTPI - Ração Elite - DK Rç Rodeo Bulls.doc",
          sha256: "194892fc77acb8d96cad538ce3dc251b8dc6c4789a87348f227bd5eaf6097d99",
          source_id: "D119",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer a ração Dukamp Ração Rodeo Bulls para os touros de rodeio calculado na proporção de 0,5 a 1% do peso vivo dos animais, dependendo da qualidade do volumoso, estado corporal e estágio de desenvolvimento dos animais. Repartir o total de ração a fornecer em pelo menos duas refeições diárias. Este produto contém uréia, sendo contra-indicado o uso de uréia adicional. Fornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. Não fornecer o produto para animais em jejum, famintos e debilitados. Não fornecer o produto para eqüídeos, ovinos e/ou quaisquer outras categorias ou espécies que não as especificadas neste rótulo. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. \nATENÇÃO: NÃO FORNECER A OUTRAS ESPÉCIES OU CATEGORIAS ANIMAIS QUE NÃO ÀS DESCRITAS NA INDICAÇÃO DO PRODUTO E/OU NO MODO DE USAR. NÃO ADMINISTRAR JUNTO A OUTROS PRODUTOS QUE CONTENHAM IONÓFOROS. NÃO PERMITIR ACESSO DE EQUINOS AO PRODUTO, POIS A INGESTÃO PODERÁ SER FATAL. ESTE PRODUTO CONTÉM IONÓFORO E O USO SIMULTÂNEO COM CERTAS SUBSTÂNCIAS MEDICAMENTOSAS PODE SER CONTRA-INDICADA. A MONENSINA, SALINOMICINA E A NARASINA SÃO INCOMPATÍVEIS COM A TIAMULINA.",
      nome_comercial_documental: "DUKAMP RAÇÃO RODEO BULLS",
      principal_documental_source_id: "D119",
      produto_id: "P119",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia, sendo contra-indicado o uso de uréia adicional. \nFornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. \nNão fornecer o produto para animais em jejum, famintos e debilitados. \nNão fornecer o produto para eqüídeos, ovinos e/ou quaisquer outras categorias ou espécies que não as especificadas neste rótulo.\nNão fornecer a outras espécies ou categorias animais que não às descritas na indicação do produto e/ou no modo de usar. \nNão administrar junto a outros produtos que contenham ionóforos. \nNão permitir acesso de equinos ao produto, pois a ingestão poderá ser fatal. \nEste produto contém ionóforo e o uso simultâneo com certas substâncias medicamentosas pode ser contra-indicada. a monensina, salinomicina e a narasina são incompatíveis com a tiamulina.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "a164e1e85e1e3065661626cd88cc6474734202372b8ac6a95e996c414225690b",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP RAÇÃO SEMI CONFINAMENTO", "RTPI - Ração Corte - DK Rç Semi-Confinamento"],
      bloqueios: [],
      classificacao_documental: "RAÇÃO",
      composicao_documental:
        "Farelo de soja*, farelo de algodão, farelo de polpa cítrica, farelo de trigo, fosfato bicálcico, carbonato de cálcio, milho integral moído**, uréia pecuária, monesina sódica, premix mineral vitamínico, calcareo calcitico. Espécie doadora de genes (em caso de ingrediente transgênico):  *Agrobacterium tumefaciens;  **Bacillus thuringiensis",
      descricao_documental: "Ração para engorda de bovinos de corte em semi confinados.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P111_dukamp-racao-semi-confinamento/fontes/D111.doc",
          arquivo_original: "RTPI/RTPI - Ração Corte - DK Rç Semi-Confinamento.doc",
          sha256: "2959bb2cf09e7549466f10a4174b302b9285e10d98356d7b5eafd499c27835d9",
          source_id: "D111",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer entre 1 a 1,5% do peso vivo em ração, dependendo da qualidade do volumoso, estado corporal dos animais, estágio de desenvolvimento e do desempenho esperado. Fracionar o fornecimento em pelo menos dois tratos diários. Este produto contém uréia e, portanto, deve ser fornecido em cochos cobertos e/ou que evitem acúmulo de água. O uso de uréia adicional é contraindicado, salvo quando prescrito por profissional habilitado. Não fornecer esta ração para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos e debilitados. Para adaptação dos animais à uréia, iniciar fornecendo quantidades crescentes até atingir a quantia recomendada dentro de 10 dias. Manter boa disponibilidade de alimento volumoso para os animais, mesmo que de baixa qualidade.  Não fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. \n\nATENÇÃO: NÃO FORNECER A OUTRAS ESPÉCIES OU CATEGORIAS ANIMAIS QUE NÃO ÀS DESCRITAS NA INDICAÇÃO DO PRODUTO. NÃO ADMINISTRAR JUNTO A OUTROS PRODUTOS QUE CONTENHAM IONÓFOROS. NÃO PERMITIR ACESSO DE EQUINOS AO PRODUTO, POIS A INGESTÃO PODERÁ SER FATAL. ESTE PRODUTO CONTÉM IONÓFORO E O USO SIMULTÂNEO COM CERTAS SUBSTÂNCIAS MEDICAMENTOSAS PODE SER CONTRA-INDICADA. A MONENSINA, SALINOMICINA E A NARASINA SÃO INCOMPATÍVEIS COM A TIAMULINA.",
      nome_comercial_documental: "DUKAMP RAÇÃO SEMI CONFINAMENTO",
      principal_documental_source_id: "D111",
      produto_id: "P111",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia e, portanto, deve ser fornecido em cochos cobertos e/ou que evitem acúmulo de água. \nO uso de uréia adicional é contraindicado, salvo quando prescrito por profissional habilitado. \nNão fornecer esta ração para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos e debilitados. \nPara adaptação dos animais à uréia, iniciar fornecendo quantidades crescentes até atingir a quantia recomendada dentro de 10 dias. \nManter boa disponibilidade de alimento volumoso para os animais, mesmo que de baixa qualidade.  \nNão fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula.  \nNão fornecer a outras espécies ou categorias animais que não às descritas na indicação do produto. \nNão administrar junto a outros produtos que contenham ionóforos. \nNão permitir acesso de equinos ao produto, pois a ingestão poderá ser fatal. \nEste produto contém ionóforo e o uso simultâneo com certas substâncias medicamentosas pode ser contra-indicada. \nA monensina, salinomicina e a narasina são incompatíveis com a tiamulina.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "8c6fc4b033c973ed6408c3b99d4884ad404b75d6147fcab479ef43ad5294b8ac",
    kind: "catalog",
    product: {
      aliases: [
        "DUKAMP RAÇÃO SEMI CONFINAMENTO SR",
        "RTPI - Ração Corte - DK Rç Semi-Confinamento SR",
      ],
      bloqueios: [
        {
          descricao:
            "Cálcio: tabela técnica = 10 / 33 g/kg; anexo = Cálciomín/máx10 / 30g/kg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Ração Corte - DK Rç Semi-Confinamento SR.doc",
              evidence_id: "D109-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D109",
            },
          ],
          source_id: "D109",
          tipo: "garantia_entre_blocos",
        },
      ],
      classificacao_documental: "RAÇÃO",
      composicao_documental:
        "Farelo de soja*, farelo de algodão, farelo de polpa cítrica, farelo de trigo, fosfato bicálcico, carbonato de cálcio, milho integral moído**, uréia pecuária, premix mineral. Espécie doadora de genes (em caso de ingrediente transgênico):  *Agrobacterium tumefaciens;  **Bacillus thuringiensis",
      descricao_documental: "Ração para engorda de bovinos de corte em semi confinados.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P109_dukamp-racao-semi-confinamento-sr/fontes/D109.doc",
          arquivo_original: "RTPI/RTPI - Ração Corte - DK Rç Semi-Confinamento SR.doc",
          sha256: "7781fa88b769ab8cbc3251cb9c3e27c11b39d89af6521a234da45eb7ac739663",
          source_id: "D109",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer entre 1 a 1,5% do peso vivo em ração, dependendo da qualidade do volumoso, estado corporal dos animais, estágio de desenvolvimento e do desempenho esperado. Fracionar o fornecimento em pelo menos dois tratos diários. Este produto contém uréia e, portanto, deve ser fornecido em cochos cobertos e/ou que evitem acúmulo de água. O uso de uréia adicional é contraindicado, salvo quando prescrito por profissional habilitado. Não fornecer esta ração para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos e debilitados. Para adaptação dos animais à uréia, iniciar fornecendo quantidades crescentes até atingir a quantia recomendada dentro de 10 dias. Manter boa disponibilidade de alimento volumoso para os animais, mesmo que de baixa qualidade.  Não fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia.",
      nome_comercial_documental: "DUKAMP RAÇÃO SEMI CONFINAMENTO SR",
      principal_documental_source_id: "D109",
      produto_id: "P109",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia e, portanto, deve ser fornecido em cochos cobertos e/ou que evitem acúmulo de água. \nO uso de uréia adicional é contraindicado, salvo quando prescrito por profissional habilitado. \nNão fornecer esta ração para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos e debilitados. \nPara adaptação dos animais à uréia, iniciar fornecendo quantidades crescentes até atingir a quantia recomendada dentro de 10 dias. \nManter boa disponibilidade de alimento volumoso para os animais, mesmo que de baixa qualidade.  \nNão fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "cd8b0ecb79bf0be290815d79a112bfa53a80a0937be583cc61305ae0bbb9571f",
    kind: "catalog",
    product: {
      aliases: [
        "DUKAMP RAÇÃO SEMI CONFINAMENTO TOP",
        "RTPI - Ração Corte - DK Rç Semi-Confinamento Top",
      ],
      bloqueios: [],
      classificacao_documental: "RAÇÃO",
      composicao_documental:
        "Farelo de soja*, farelo de algodão, farelo de polpa cítrica, farelo de trigo, fosfato bicálcico, carbonato de cálcio, milho integral moído**, uréia pecuária, monesina sódica, premix mineral vitamínico, calcareo calcitico. Espécie doadora de genes (em caso de ingrediente transgênico):  *Agrobacterium tumefaciens;  **Bacillus thuringiensis",
      descricao_documental: "Ração para engorda de bovinos de corte em semi confinados.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P110_dukamp-racao-semi-confinamento-top/fontes/D110.doc",
          arquivo_original: "RTPI/RTPI - Ração Corte - DK Rç Semi-Confinamento Top.doc",
          sha256: "6d1393a789be3f493803b5c44380d72c42cda78bd73c997d3713a3b57c2fa092",
          source_id: "D110",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer entre 1 a 1,5% do peso vivo em ração, dependendo da qualidade do volumoso, estado corporal dos animais, estágio de desenvolvimento e do desempenho esperado. Fracionar o fornecimento em pelo menos dois tratos diários. Este produto contém uréia e, portanto, deve ser fornecido em cochos cobertos e/ou que evitem acúmulo de água. O uso de uréia adicional é contraindicado, salvo quando prescrito por profissional habilitado. Não fornecer esta ração para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos e debilitados. Para adaptação dos animais à uréia, iniciar fornecendo quantidades crescentes até atingir a quantia recomendada dentro de 10 dias. Manter boa disponibilidade de alimento volumoso para os animais, mesmo que de baixa qualidade.  Não fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. \n\nATENÇÃO: NÃO FORNECER A OUTRAS ESPÉCIES OU CATEGORIAS ANIMAIS QUE NÃO ÀS DESCRITAS NA INDICAÇÃO DO PRODUTO. NÃO ADMINISTRAR JUNTO A OUTROS PRODUTOS QUE CONTENHAM IONÓFOROS. NÃO PERMITIR ACESSO DE EQUINOS AO PRODUTO, POIS A INGESTÃO PODERÁ SER FATAL. ESTE PRODUTO CONTÉM IONÓFORO E O USO SIMULTÂNEO COM CERTAS SUBSTÂNCIAS MEDICAMENTOSAS PODE SER CONTRA-INDICADA. A MONENSINA, SALINOMICINA E A NARASINA SÃO INCOMPATÍVEIS COM A TIAMULINA.",
      nome_comercial_documental: "DUKAMP RAÇÃO SEMI CONFINAMENTO TOP",
      principal_documental_source_id: "D110",
      produto_id: "P110",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia e, portanto, deve ser fornecido em cochos cobertos e/ou que evitem acúmulo de água. \nO uso de uréia adicional é contraindicado, salvo quando prescrito por profissional habilitado. \nNão fornecer esta ração para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos e debilitados. \nPara adaptação dos animais à uréia, iniciar fornecendo quantidades crescentes até atingir a quantia recomendada dentro de 10 dias. \nManter boa disponibilidade de alimento volumoso para os animais, mesmo que de baixa qualidade.  \nNão fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula.  \nNão fornecer a outras espécies ou categorias animais que não às descritas na indicação do produto. \nNão administrar junto a outros produtos que contenham ionóforos. \nNão permitir acesso de equinos ao produto, pois a ingestão poderá ser fatal. \nEste produto contém ionóforo e o uso simultâneo com certas substâncias medicamentosas pode ser contra-indicada. \nA monensina, salinomicina e a narasina são incompatíveis com a tiamulina.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "277786bc3c3a82bcfbb10cb6f17dc3c29ced3c80a316685a6364c1cd35b3d621",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP RAÇÃO TOTAL M", "RTPI - Ração Corte - DK Rç Total M"],
      bloqueios: [
        {
          descricao:
            "O modo de usar escreve '2 (cinco) refeições'. O numeral e o texto por extenso divergem. Confirmar frequência e protocolo completo antes de orientar dieta sem volumoso.",
          referencias: [
            {
              arquivo_original:
                "RTPI/Produtos mais Vendidos/RTPI - Ração Corte - DK Rç Total M.doc",
              evidence_id: "D019-S12",
              pagina_pdf_inicio: null,
              secao_numero_original: 13,
              secao_semantica: "Modo de usar",
              source_id: "D019",
            },
          ],
          source_id: "D019",
          tipo: "manejo",
        },
        {
          descricao:
            "Vitamina E: tabela técnica = 70 ui/kg; anexo = Vitamina Emín75ui/kg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original:
                "RTPI/Produtos mais Vendidos/RTPI - Ração Corte - DK Rç Total M.doc",
              evidence_id: "D019-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D019",
            },
          ],
          source_id: "D019",
          tipo: "garantia_entre_blocos",
        },
      ],
      classificacao_documental: "RAÇÃO PARA ENGORDA DE BOVINOS DE CORTE",
      composicao_documental:
        "Farelo de soja*, milho integral moído**,  fosfato bicálcico, milho grão, carbonato de cálcio, uréia pecuária, monensina sódica, refinazil,  bicarbonato de sódio, farelo de trigo, torta de algodão, premix mineral vitamínico. Espécie doadora de genes (em caso de ingrediente transgênico):  *Agrobacterium tumefaciens;  **Bacillus thuringiensis, farelo de polpa citrica peleizada.",
      descricao_documental:
        "Ração para alimentação de bovinos de corte em confinamento em dieta sem volumoso.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P019_dukamp-racao-total-m/fontes/D019.doc",
          arquivo_original: "RTPI/Produtos mais Vendidos/RTPI - Ração Corte - DK Rç Total M.doc",
          sha256: "93087050e86749523f52659375385a6dd2e2683b84057602c048bb8ba83153ca",
          source_id: "D019",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Esta ração é pronta para uso e seu fornecimento exclusivo aos bovinos (isto é, sem o fornecimento de volumoso) representará uma dieta conhecida como “dieta do grão inteiro de milho”. Em caso de animais já adaptados à dieta sem volumoso, fornecer o equivalente entre 2,2 a 2,5% do peso corporal diariamente, dividindo o total em pelo menos 2 (cinco) refeições diárias.\n\nPROTOCOLO DE ADAPTAÇÃO: Inicie fornecendo o equivalente a  1ª semana -1 % do peso vivo, 2ª semana – 1,5 % do peso vivo, 3ª semana – 2 % do peso vivo, 4 º semana – 2,5 % do peso vivo, na sequencia fazer leitura de cocho e acompanhar o consumo da ração. O período de adaptação não deverá ser reduzido, sob o risco de ocorrência de distúrbios nutricionais. Fornecer a quantidade total diária de ração dividida em pelo menos 2 (cinco) refeições e não disponibilizar volumoso aos animais confinados. Consulte nosso departamento técnico ou um profissional habilitado de sua confiança.\n\nATENÇÃO: ESTE PRODUTO CONTÉM URÉIA, SENDO CONTRA-INDICADO O USO DE URÉIA ADICIONAL. FORNECER O PRODUTO EM COCHOS COBERTOS E/OU QUE EVITEM ACÚMULO DE ÁGUA. NÃO FORNECER O PRODUTO PARA EQÜÍDEOS, OVINOS E/OU QUAISQUER OUTRAS CATEGORIAS OU ESPÉCIES QUE NÃO AS ESPECIFICADAS NESTE RÓTULO, NEM EM QUANTIDADES ACIMA DO RECOMENDADO. O FORNECIMENTO DE VOLUMOSO É CONTRA-INDICADO, SALVO QUANDO PRESCRITO POR PROFISSIONAL HABILITADO. NÃO ADMINISTRAR JUNTO A OUTROS PRODUTOS QUE CONTENHAM IONÓFOROS. NÃO PERMITIR ACESSO DE EQUINOS AO PRODUTO, POIS A INGESTÃO PODERÁ SER FATAL. ESTE PRODUTO CONTÉM IONÓFORO E O USO SIMULTÂNEO COM CERTAS SUBSTÂNCIAS MEDICAMENTOSAS PODE SER CONTRA-INDICADA. A MONENSINA, SALINOMICINA E A NARASINA SÃO INCOMPATÍVEIS COM A TIAMULINA.",
      nome_comercial_documental: "DUKAMP RAÇÃO TOTAL M",
      principal_documental_source_id: "D019",
      produto_id: "P019",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia, sendo contra-indicado o uso de uréia adicional.\nFornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. \nNão fornecer o produto para animais em jejum, famintos e debilitados. \nNão fornecer o produto para eqüídeos, ovinos e/ou quaisquer outras categorias ou espécies que não as especificadas neste rótulo, nem em quantidades acima do recomendado. \nO fornecimento de volumoso junto com essa ração é contra-indicado, salvo quando prescrito por profissional habilitado. \nNão administrar junto a outros produtos que contenham ionóforos. \nNão permitir acesso de equinos ao produto, pois a ingestão poderá ser fatal. \nEste produto contém ionóforo e o uso simultâneo com certas substâncias medicamentosas pode ser contra-indicada. \nA monensina, salinomicina e a narasina são incompatíveis com a tiamulina.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "f8ade671d6bd5d1e8519a652faaf76d73f028bf5d16ec28011e874220566f1fd",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP RAÇÃO TOTAL M ENERGETICA", "RTPI - Ração Corte - DK Rç Total Energetica"],
      bloqueios: [
        {
          descricao:
            "O modo de usar escreve '2 (cinco) refeições'. O numeral e o texto por extenso divergem. Confirmar frequência e protocolo completo antes de orientar dieta sem volumoso.",
          referencias: [
            {
              arquivo_original:
                "RTPI/Produtos mais Vendidos/RTPI - Ração Corte - DK Rç Total Energetica.doc",
              evidence_id: "D018-S12",
              pagina_pdf_inicio: null,
              secao_numero_original: 13,
              secao_semantica: "Modo de usar",
              source_id: "D018",
            },
          ],
          source_id: "D018",
          tipo: "manejo",
        },
        {
          descricao:
            "Vitamina E: tabela técnica = 70 ui/kg; anexo = Vitamina Emín75ui/kg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original:
                "RTPI/Produtos mais Vendidos/RTPI - Ração Corte - DK Rç Total Energetica.doc",
              evidence_id: "D018-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D018",
            },
          ],
          source_id: "D018",
          tipo: "garantia_entre_blocos",
        },
      ],
      classificacao_documental: "RAÇÃO PARA ENGORDA DE BOVINOS DE CORTE",
      composicao_documental:
        "Farelo de soja*, milho integral moído**,  fosfato bicálcico, carbonato de cálcio, uréia pecuária, monensina sódica, refinazil,  bicarbonato de sódio, farelo de trigo, torta de algodão, premix mineral vitamínico. Espécie doadora de genes (em caso de ingrediente transgênico):  *Agrobacterium tumefaciens;  **Bacillus thuringiensis, farelo de polpa citrica peleizada.",
      descricao_documental:
        "Ração para alimentação de bovinos de corte em confinamento em dieta sem volumoso.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P018_dukamp-racao-total-m-energetica/fontes/D018.doc",
          arquivo_original:
            "RTPI/Produtos mais Vendidos/RTPI - Ração Corte - DK Rç Total Energetica.doc",
          sha256: "39c5ccfc72c49657c8e524e0722f342d8e6cd491efa79a84e023e0c03a67f20d",
          source_id: "D018",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Esta ração é pronta para uso e seu fornecimento exclusivo aos bovinos (isto é, sem o fornecimento de volumoso) representará uma dieta conhecida como “dieta do grão inteiro de milho”. Em caso de animais já adaptados à dieta sem volumoso, fornecer o equivalente entre 2,2 a 2,5% do peso corporal diariamente, dividindo o total em pelo menos 2 (cinco) refeições diárias.\n\nPROTOCOLO DE ADAPTAÇÃO: Inicie fornecendo o equivalente a  1ª semana -1 % do peso vivo, 2ª semana – 1,5 % do peso vivo, 3ª semana – 2 % do peso vivo, 4 º semana – 2,5 % do peso vivo, na sequencia fazer leitura de cocho e acompanhar o consumo da ração. O período de adaptação não deverá ser reduzido, sob o risco de ocorrência de distúrbios nutricionais. Fornecer a quantidade total diária de ração dividida em pelo menos 2 (cinco) refeições e não disponibilizar volumoso aos animais confinados. Consulte nosso departamento técnico ou um profissional habilitado de sua confiança.\n\nATENÇÃO: ESTE PRODUTO CONTÉM URÉIA, SENDO CONTRA-INDICADO O USO DE URÉIA ADICIONAL. FORNECER O PRODUTO EM COCHOS COBERTOS E/OU QUE EVITEM ACÚMULO DE ÁGUA. NÃO FORNECER O PRODUTO PARA EQÜÍDEOS, OVINOS E/OU QUAISQUER OUTRAS CATEGORIAS OU ESPÉCIES QUE NÃO AS ESPECIFICADAS NESTE RÓTULO, NEM EM QUANTIDADES ACIMA DO RECOMENDADO. O FORNECIMENTO DE VOLUMOSO É CONTRA-INDICADO, SALVO QUANDO PRESCRITO POR PROFISSIONAL HABILITADO. NÃO ADMINISTRAR JUNTO A OUTROS PRODUTOS QUE CONTENHAM IONÓFOROS. NÃO PERMITIR ACESSO DE EQUINOS AO PRODUTO, POIS A INGESTÃO PODERÁ SER FATAL. ESTE PRODUTO CONTÉM IONÓFORO E O USO SIMULTÂNEO COM CERTAS SUBSTÂNCIAS MEDICAMENTOSAS PODE SER CONTRA-INDICADA. A MONENSINA, SALINOMICINA E A NARASINA SÃO INCOMPATÍVEIS COM A TIAMULINA.",
      nome_comercial_documental: "DUKAMP RAÇÃO TOTAL M ENERGETICA",
      principal_documental_source_id: "D018",
      produto_id: "P018",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia, sendo contra-indicado o uso de uréia adicional.\nFornecer o produto em cochos cobertos e/ou que evitem acúmulo de água. \nNão fornecer o produto para animais em jejum, famintos e debilitados. \nNão fornecer o produto para eqüídeos, ovinos e/ou quaisquer outras categorias ou espécies que não as especificadas neste rótulo, nem em quantidades acima do recomendado. \nO fornecimento de volumoso junto com essa ração é contra-indicado, salvo quando prescrito por profissional habilitado. \nNão administrar junto a outros produtos que contenham ionóforos. \nNão permitir acesso de equinos ao produto, pois a ingestão poderá ser fatal. \nEste produto contém ionóforo e o uso simultâneo com certas substâncias medicamentosas pode ser contra-indicada. \nA monensina, salinomicina e a narasina são incompatíveis com a tiamulina.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "cbae0c614ea90adec0736f3b4bebff604669ee04097b1d677980039469320e0a",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP REPRODUÇÃO/S", "RTPI - Mineral Linha S - Dukamp Reprodução S"],
      bloqueios: [],
      classificacao_documental: "SUPLEMENTO MINERAL DE PRONTO USO PARA BOVINOS",
      composicao_documental:
        "fosfato bicálcico, carbonato de cálcio, óxido de magnésio, cloreto de sódio (sal comum) 25%, sulfato de cálcio, sulfato de cobalto, sulfato de cobre, iodato de cálcio, sulfato de ferro, sulfato de manganês, selenito de sódio, sulfato de zinco, calcareo calcitico",
      descricao_documental:
        "Suplemento mineral de pronto uso indicado para bovinos de corte nas fases de reprodução, gestação, cria e/ou recria em áreas de média fertilidade, em pastagens de média qualidade nutricional.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P049_dukamp-reproducao-s/fontes/D049.doc",
          arquivo_original: "RTPI/RTPI - Mineral Linha S - Dukamp Reprodução S.doc",
          sha256: "1e6b2128b6fcea3197c69d13cfac531ddb5f0a7d17371ec520f4a16e2c685e85",
          source_id: "D049",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Dukamp Reprodução/S já é pronto para uso, bastando despejar o produto em cochos e deixar à disposição permanente dos animais. preferencialmente, recomenda-se o uso de cochos cobertos e com espaço mínimo de 3 a 5 cm por cabeça suplementada. não fornecer o produto para ovinos. em caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP REPRODUÇÃO/S",
      principal_documental_source_id: "D049",
      produto_id: "P049",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "3fe1178f4f7fa044d7b307e0d275da8e207c44755d99aad31e2a87ee3964a263",
    kind: "catalog",
    product: {
      aliases: [
        "DUKAMP REPRODUÇÃO/S GOLONI NSA",
        "RTPI - Mineral Linha S - Dukamp Reprodução S Golini NSA",
      ],
      bloqueios: [
        {
          descricao:
            "CÁLCIO: tabela técnica = 125 /310 g; anexo = CÁLCIOmín/máx125 / 550g. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Mineral Linha S - Dukamp Reprodução S Golini NSA.doc",
              evidence_id: "D048-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D048",
            },
          ],
          source_id: "D048",
          tipo: "garantia_entre_blocos",
        },
        {
          descricao:
            "COBRE: tabela técnica = 930 mg; anexo = COBREmín1.200mg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Mineral Linha S - Dukamp Reprodução S Golini NSA.doc",
              evidence_id: "D048-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D048",
            },
          ],
          source_id: "D048",
          tipo: "garantia_entre_blocos",
        },
      ],
      classificacao_documental: "SUPLEMENTO MINERAL DE PRONTO USO PARA BOVINOS",
      composicao_documental:
        "fosfato bicálcico, carbonato de cálcio, óxido de magnésio, cloreto de sódio (sal comum) 25%, sulfato de cálcio, sulfato de cobalto, sulfato de cobre, iodato de cálcio, sulfato de ferro, sulfato de manganês, selenito de sódio, sulfato de zinco.",
      descricao_documental:
        "Suplemento mineral de pronto uso indicado para bovinos de corte nas fases de reprodução, gestação, cria e/ou recria em áreas de média fertilidade, em pastagens de média qualidade nutricional.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P048_dukamp-reproducao-s-goloni-nsa/fontes/D048.doc",
          arquivo_original: "RTPI/RTPI - Mineral Linha S - Dukamp Reprodução S Golini NSA.doc",
          sha256: "8b9366837333ba5fa91339158e9f4106c55db187136b88df10ebc3cb9e3936f4",
          source_id: "D048",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Dukamp Reprodução/S Goloni NSA já é pronto para uso, bastando despejar o produto em cochos e deixar à disposição permanente dos animais. preferencialmente, recomenda-se o uso de cochos cobertos e com espaço mínimo de 3 a 5 cm por cabeça suplementada. não fornecer o produto para ovinos. em caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP REPRODUÇÃO/S GOLONI NSA",
      principal_documental_source_id: "D048",
      produto_id: "P048",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "329e527e1fc637107035734077e7a3e0752d136e78ef078c0dee65d0126343dc",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP SECA ENGORDA PREMIUM", "RTPI - Ração Corte - DK Seca Engorda  Premium"],
      bloqueios: [
        {
          descricao:
            "O nome é Seca Engorda Premium, mas a indicação declara águas e/ou primavera. Não inferir indicação para seca pelo nome. Confirmar a estação adequada.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Ração Corte - DK Seca Engorda  Premium.doc",
              evidence_id: "D116-S02",
              pagina_pdf_inicio: null,
              secao_numero_original: 2,
              secao_semantica: "Nome comercial",
              source_id: "D116",
            },
            {
              arquivo_original: "RTPI/RTPI - Ração Corte - DK Seca Engorda  Premium.doc",
              evidence_id: "D116-S11",
              pagina_pdf_inicio: null,
              secao_numero_original: 12,
              secao_semantica: "Indicação e espécie",
              source_id: "D116",
            },
          ],
          source_id: "D116",
          tipo: "estacao",
        },
      ],
      classificacao_documental: "RAÇÃO PARA BOVINOS DE CORTE",
      composicao_documental:
        "farelo de soja, farelo de algodão, polpa cítrica, farelo de trigo, fosfato bicálcico, carbonato de cálcio, cloreto de sódio (sal comum), milho integral moído, premix mineral.\nProduto poderá conter milho1,2,4,5, soja1,2,3,4 ou algodão1,2,4,5,6 transgênicos.\nEspécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes;  5- Zea mays; 6- Streptomyces hygroscopicus.",
      descricao_documental:
        "Ração de baixo consumo para engorda de bovinos de corte semi confinados ou suplementados a campo, no período das águas e/ou primavera.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P116_dukamp-seca-engorda-premium/fontes/D116.doc",
          arquivo_original: "RTPI/RTPI - Ração Corte - DK Seca Engorda  Premium.doc",
          sha256: "ad853f0b00be2f099a55d2608558768a53c5b5ac87177d11c17db94cd5c32480",
          source_id: "D116",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer entre 0,3 a 0,5% do peso vivo em ração diariamente, em doses de 1 a 1,5 kg por cabeça por dia, dependendo da qualidade do volumoso, estado corporal dos animais, estágio de desenvolvimento e do desempenho esperado. Como o produto contém sal comum em sua fórmula, espera-se que a ingestão fique distribuída durante o dia, não sendo necessário fracionar o fornecimento dessa ração em mais de um trato diário. Para  adaptar os animais ao uso do produto, iniciar fornecendo quantidades crescentes até atingir a quantia recomendada dentro de 10 dias, substituindo completamente o suplemento mineral ou o sal proteinado convencional. Espaçamento de cocho necessário: entre 15 e 30 cm por cabeça suplementada. Não fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia.",
      nome_comercial_documental: "DUKAMP SECA ENGORDA PREMIUM",
      principal_documental_source_id: "D116",
      produto_id: "P116",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Não fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "790f41c15a137e0fe9367056a61a326be51ab57ba780ab15a58864ae7f0daab0",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP TRANSIÇÃO 35", "RTPI - Proteinados - Dukamp Transição 35"],
      bloqueios: [],
      classificacao_documental: "SUPLEMENTO MINERAL PROTÉICO DE PRONTO USO PARA BOVINOS DE CORTE",
      composicao_documental:
        "Farelo de trigo, refinazil, farelo de girassol com casca, casca de soja moída, milho integral moído, farelo de soja, polpa cítrica, melaço, levedura seca de cana de açúcar, farelo de algodão, uréia pecuária, carbonato de cálcio, fosfato bicálcico, cloreto de sódio (sal comum) - 25%, premix mineral. Produto poderá conter milho (1,2,4,5), soja (1,2,3,4) ou algodão (1,2,4,5,6) transgênicos. Espécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes; 5- Zea mays; 6- Streptomyces hygroscopicus.",
      descricao_documental:
        "Suplemento mineral protéico pronto para uso, indicado para bovinos de corte acima de 4 meses de idade, nas fases de de cria, recria e engorda, sob pastagens, no início e no final da estação seca do ano.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P087_dukamp-transicao-35/fontes/D087.doc",
          arquivo_original: "RTPI/RTPI - Proteinados - Dukamp Transição 35.doc",
          sha256: "b994a53cb964693d2fbbe21c9fe4dbee240f261dfe4cb2576cc4bc8aac4993a5",
          source_id: "D087",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Dukamp Transição 35 já vem pronto para uso bastando despejar o produto em cochos e deixar à disposição permanente dos animais. Este produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. O uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. Não fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. Recomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que de baixa qualidade. Não fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. Também não fornecer o produto para eqüídeos e/ou ovinos. Para adaptação dos animais ao início do uso de suplementos contendo uréia, é recomendado misturar o produto com sal branco ou um suplemento mineral qualquer na proporção de 1:2 na primeira semana, misturar na proporção de 2:1 na segunda semana e usar o produto Dukamp Transição 35 puro a partir da terceira semana. Consumo esperado de 50 a 150 gramas do produto para cada 100 kg de peso corporal, desde que atendidas as especificações de manejo recomendadas. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia. Em caso de dúvidas ou intoxicações, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP TRANSIÇÃO 35",
      principal_documental_source_id: "D087",
      produto_id: "P087",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Este produto contém uréia e, portanto, deve ser sempre fornecido em cochos cobertos e/ou que evitem acúmulo de água. \nO uso de uréia adicional é contra-indicado, salvo quando prescrito por profissional habilitado. \nNão fornecer este suplemento para animais com menos de 4 meses de idade e/ou para animais em jejum, famintos, subnutridos ou debilitados. \nRecomenda-se espaçamento mínimo de 10 a 15 cm por cabeça suplementada e manter boa disponibilidade de pasto, mesmo que de baixa qualidade. \nNão fornecer o produto para machos reprodutores, pois estes não devem se alimentar de farelo de algodão, presente nesta formulação. \nTambém não fornecer o produto para eqüídeos e/ou ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "accff97ef3550635b96a3bf2dee7d3d9f0ade45f688ec767b9bfa4d7c05185aa",
    kind: "catalog",
    product: {
      aliases: ["DUKAMP VACADA LEMOS", "RTPI - Mineral Linha S - Dukamp Vacada Lemos"],
      bloqueios: [],
      classificacao_documental: "SUPLEMENTO MINERAL DE PRONTO USO PARA BOVINOS",
      composicao_documental:
        "fosfato bicálcico, carbonato de cálcio, óxido de magnésio, cloreto de sódio (sal comum) 32%, sulfato de cálcio, sulfato de cobalto, sulfato de cobre, iodato de cálcio, sulfato de ferro, sulfato de manganês, selenito de sódio, sulfato de zinco, calcareo calcitico, availa cromo.",
      descricao_documental:
        "Suplemento mineral de pronto uso indicado bovinos de corte na fase de reprodução em pastagens de boa qualidade nutricional.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P050_dukamp-vacada-lemos/fontes/D050.doc",
          arquivo_original: "RTPI/RTPI - Mineral Linha S - Dukamp Vacada Lemos.doc",
          sha256: "6f159ba4e986ea006c7fd61c663df734c034448a33c80c9f36fff0b9639459d3",
          source_id: "D050",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "DUKAMP VACADA LEMOS  já é pronto para uso, bastando despejar o produto em cochos e deixar à disposição permanente dos animais. Preferencialmente, recomenda-se o uso de cochos cobertos e com espaço mínimo de 3 a 5 cm por cabeça suplementada. Não fornecer o produto para ovinos. Em caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "DUKAMP VACADA LEMOS",
      principal_documental_source_id: "D050",
      produto_id: "P050",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "73dc6c5cd1a1d63f9cec3d8e8a92465bd47ab7a2bbc3474963140c5c5561e65d",
    kind: "catalog",
    product: {
      aliases: ["FERTIKAMP GOLD", "RTPI - Baldinho - FertiKamp Gold"],
      bloqueios: [
        {
          descricao:
            "O modo de usar declara uso exclusivo na formulação de rações e também autoriza top dress. Confirmar as vias de fornecimento vigentes.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Baldinho - FertiKamp Gold.doc",
              evidence_id: "D027-S12",
              pagina_pdf_inicio: null,
              secao_numero_original: 12,
              secao_semantica: "Modo de usar",
              source_id: "D027",
            },
          ],
          source_id: "D027",
          tipo: "via_fornecimento",
        },
        {
          descricao:
            "Classificação e campo de espécie citam ovinos; a indicação também cita caprinos adultos. Confirmar a abrangência do rótulo atual antes de recomendar a caprinos.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Baldinho - FertiKamp Gold.doc",
              evidence_id: "D027-S03",
              pagina_pdf_inicio: null,
              secao_numero_original: 3,
              secao_semantica: "Classificação",
              source_id: "D027",
            },
            {
              arquivo_original: "RTPI/RTPI - Baldinho - FertiKamp Gold.doc",
              evidence_id: "D027-S11",
              pagina_pdf_inicio: null,
              secao_numero_original: 11,
              secao_semantica: "Indicação e espécie",
              source_id: "D027",
            },
          ],
          source_id: "D027",
          tipo: "especie",
        },
      ],
      classificacao_documental: "SUPLEMENTO MINERAL VITAMÍNICO PARA MISTURA PARA OVINOS",
      composicao_documental:
        "ácido fólico, ácido pantotênico, aditivo antioxidante, aditivo promotor de crescimento e eficiência alimentar, aroma de baunilha, carbonato de cálcio, cloreto de potássio, cloreto de sódio (sal comum), cromo aminoácido quelato, DL-metionina, enxofre ventilado (flor de enxofre), fosfato bicálcico - 61,54%, iodato de cálcio, levedura seca de cana-de-açúcar, L-lisina, melaço, niacina, óxido de magnésio, selenito de sódio, sulfato de cálcio, sulfato de colbalto, sulfato de ferro, sulfato de manganês, sulfato de zinco, vitamina A, vitamina B1, vitamina B12, vitamina B2, vitamina B6, vitamina C, vitamina D3, vitamina E, vitamina H.",
      descricao_documental:
        "Suplemento mineral vitamínico para mistura, contendo vitaminas, macro e microelementos minerais, ionóforo e palatabilizante, indicado para suplementação de ovinos e caprinos adultos (reprodutores e/ou matrizes). Também é indicado para o preparo de animais de elite para exposições.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P027_fertikamp-gold/fontes/D027.doc",
          arquivo_original: "RTPI/RTPI - Baldinho - FertiKamp Gold.doc",
          sha256: "d58372316410961e273279eab970aa8b99c57fc354a2430b7a56f070dcebd31b",
          source_id: "D027",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "O suplemento FERTIKAMP GOLD é para uso exclusivo na formulação de rações.\nRecomenda-se adição de 30 a 40 kg de FERTIKAMP GOLD por tonelada de ração (isto é, entre 3 e 4% de inclusão). Fornecer o produto elaborado calculado na proporção de 250 a 500 gramas de ração para cada 10 kg de peso corporal. É desejável que o consumo diário de FERTIKAMP GOLD esteja em torno de 750 a 2.000 miligramas para cada kg de peso corporal.\nFERTIKAMP GOLD pode ser administrado aos animais misturado as rações durante sua confecção ou através do método “top dress”, isto é, polvilhando o produto sobre o alimento no cocho.\nCaso a opção seja pelo polvilhamento sobre a ração, as doses diárias por cabeça recomendadas são descritas no quadro a seguir:\n\nPESO DO ANIMAL | QUANTIDADE DE FERTIKAMP GOLD\n |  | 30 kg | 22,5 a 60 g/animal/dia |  | 40 kg | 30 a 80 g/animal/dia |  | 50 kg | 37,5 a 100 g/animal/dia |  | 60 kg | 45 a 120 g/animal/dia |  | 70 kg | 52,5 a 140 g/animal/dia |  | 80 kg | 60 a 160 g/animal/dia |  | 90 kg |  67,5 a 180g/animal/dia |  | 100 kg | 75 a 200 g/animal/dia |  | 110 kg | 82,5 a 220 g/animal/dia |  | 120 kg | 90 a 240 g/animal/dia |  | \nAs recomendações aqui descritas de inclusão de FERTIKAMP GOLD na ração, bem como as de quantidades a serem fornecidas da ração podem ser alteradas conforme o escore corporal do animal, status nutricional, ganho de peso desejado e/ou qualidade do volumoso. Para isso, consulte um profissional habilitado.\nPorventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia.\nEm caso de dúvidas ou para formulações específicas, consulte nosso departamento técnico ou um profissional de sua confiança.\nNão fornecer o produto para equídeos.",
      nome_comercial_documental: "FERTIKAMP GOLD",
      principal_documental_source_id: "D027",
      produto_id: "P027",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para equídeos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "34121df7b2a1403a5b5919f062d58ff737fbd71f50e4452966843f8f36785c7b",
    kind: "catalog",
    product: {
      aliases: ["GALPÃO CENTER ÁGUAS PREMIUM", "RTPI - Ração Corte - DK   Águas  Premium galpão"],
      bloqueios: [],
      classificacao_documental: "RAÇÃO PARA BOVINOS DE CORTE",
      composicao_documental:
        "farelo de soja, farelo de algodão, polpa cítrica, farelo de trigo, fosfato bicálcico, carbonato de cálcio, cloreto de sódio (sal comum), milho integral moído, premix mineral.\nProduto poderá conter milho1,2,4,5, soja1,2,3,4 ou algodão1,2,4,5,6 transgênicos.\nEspécie doadora de genes (em caso de ingrediente transgênico): 1- Agrobacterium tumefaciens; 2- Bacillus thuringiensis; 3- Arabidopsis thaliana; 4- Streptomyces viridochromogenes;  5- Zea mays; 6- Streptomyces hygroscopicus.",
      descricao_documental:
        "Ração de baixo consumo para engorda de bovinos de corte semi confinados ou suplementados a campo, no período das águas e/ou primavera.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P097_galpao-center-aguas-premium/fontes/D097.doc",
          arquivo_original: "RTPI/RTPI - Ração Corte - DK   Águas  Premium galpão.doc",
          sha256: "b6a13e206cfafa2bc17314bf4284a7fbf9c74eb43c97c41d30ddfee61c97093b",
          source_id: "D097",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer entre 0,3 a 0,5% do peso vivo em ração diariamente, em doses de 1 a 1,5 kg por cabeça por dia, dependendo da qualidade do volumoso, estado corporal dos animais, estágio de desenvolvimento e do desempenho esperado. Como o produto contém sal comum em sua fórmula, espera-se que a ingestão fique distribuída durante o dia, não sendo necessário fracionar o fornecimento dessa ração em mais de um trato diário. Para  adaptar os animais ao uso do produto, iniciar fornecendo quantidades crescentes até atingir a quantia recomendada dentro de 10 dias, substituindo completamente o suplemento mineral ou o sal proteinado convencional. Espaçamento de cocho necessário: entre 15 e 30 cm por cabeça suplementada. Não fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula. Porventura, padrões diferentes de odor, aparência e textura poderão ser notados entre lotes conforme a disponibilidade de componentes básicos e eventuais substitutivos sem, no entanto, comprometer a qualidade nutricional ou os níveis de garantia.",
      nome_comercial_documental: "GALPÃO CENTER ÁGUAS PREMIUM",
      principal_documental_source_id: "D097",
      produto_id: "P097",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Não fornecer o produto para machos que se pretende utilizar como reprodutores, pois estes não devem se alimentar de farelo de algodão, presente na fórmula.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "18f111b950089f16a6d1b51606bc784782c4eba9b515844d2228ecb757ce6dab",
    kind: "catalog",
    product: {
      aliases: ["HORSE POWER GOLD", "RTPI - Baldinho - Horse Power Gold"],
      bloqueios: [
        {
          descricao:
            "A indicação e a tabela de consumo incluem equinos em crescimento e fêmeas gestantes. O modo de usar e as restrições também declaram uso exclusivo para adultos. Confirmar categorias, especialmente animais em crescimento.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - Baldinho - Horse Power Gold.doc",
              evidence_id: "D029-S11",
              pagina_pdf_inicio: null,
              secao_numero_original: 11,
              secao_semantica: "Indicação e espécie",
              source_id: "D029",
            },
            {
              arquivo_original: "RTPI/RTPI - Baldinho - Horse Power Gold.doc",
              evidence_id: "D029-S12",
              pagina_pdf_inicio: null,
              secao_numero_original: 12,
              secao_semantica: "Modo de usar",
              source_id: "D029",
            },
            {
              arquivo_original: "RTPI/RTPI - Baldinho - Horse Power Gold.doc",
              evidence_id: "D029-S16",
              pagina_pdf_inicio: null,
              secao_numero_original: 16,
              secao_semantica: "Restrições e recomendações",
              source_id: "D029",
            },
          ],
          source_id: "D029",
          tipo: "categoria",
        },
      ],
      classificacao_documental: "NÚCLEO PARA EQUINOS",
      composicao_documental:
        "ácido aspártico, ácido fólico, ácido glutâmico, aditivo antioxidante, alanina, arginina, biotina, carbonato de cálcio, cisteína, cloreto de colina, cloreto de potássio, cromo aminoácido quelato, DL-metionina, enxofre ventilado (flor de enxofre), fenilalanina, fosfato bicálcico, glicina, histidina, iodato de cálcio, isoleucina, leucina, leveduras, L-lisina, milho integral moído, niacina, óxido de magnésio, pantotenato de cálcio, prolina, selenito de sódio, serina, sulfato de cálcio, sulfato de cobalto, sulfato de cobre, sulfato de manganês, sulfato de zinco, sulfato ferroso, tirosina, treonina, triptofano, valina, vitamina A, vitamina B1, vitamina B12, vitamina B6, vitamina C, vitamina D3, vitamina E.",
      descricao_documental:
        "Indicado para fabricação de rações destinadas à alimentação de equinos em crescimento e na fase adulta (manutenção, gestação, em trabalho ou atletas).",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P029_horse-power-gold/fontes/D008.doc",
          arquivo_original:
            "RTPI/Obsoletos/RTPI - Baldinho - Horse Power Gold - at‚ 2015-06-01.doc",
          sha256: "75d3e724f4d3495248daa229fd497a13ce1fc1d05be5394b446d800589d582fc",
          source_id: "D008",
          versao_papel: "historico_obsoleto",
        },
        {
          arquivo_no_pacote: "produtos/P029_horse-power-gold/fontes/D029.doc",
          arquivo_original: "RTPI/RTPI - Baldinho - Horse Power Gold.doc",
          sha256: "e6f297e63bc7b752dd5b6f9feb1b4496351729865d5c5166435296d7691122d6",
          source_id: "D029",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Misturar o produto às rações durante sua confecção na dose de 2% na mistura (ou 20 kg do produto por tonelada de ração), assegurando uma mistura homogênea. \nRecomenda-se que cada animal tenha um consumo de Horse Power Gold conforme o quadro a seguir:\n\n- Equídeos adultos: | Manutenção (40 g/dia); |  |  | Treinamento ou trabalho leve (60 g/dia); |  |  | Treinamento ou trabalho moderado (80 g/dia); |  |  | Treinamento ou trabalho pesado (100 g/dia); |  | - Equídeos em crescimento: 60 g/dia |  | Fêmeas em gestação: 90 g/dia |  | Animais debilitados ou deficientes nutricionalmente: 100 g/dia |  | \nA dosagem, o período e a forma de administração podem ser alterados conforme recomendações de profissional habilitado.\nEm caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança.\nProduto destinado exclusivamente para equinos adultos. Em hipótese alguma deverá ser ingerido por humanos",
      nome_comercial_documental: "HORSE POWER GOLD",
      principal_documental_source_id: "D029",
      produto_id: "P029",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Produto destinado exclusivamente para equídeos adultos. Em hipótese alguma deverá ser ingerido por humanos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "da2b98e56cab986e0b188fb8db7ce956ffe3ffa852baf6cb81c70109d8f28977",
    kind: "catalog",
    product: {
      aliases: ["HORSE POWER GOLD TURBO", "RTPI - Baldinho - Horse Power Gold TURBO"],
      bloqueios: [],
      classificacao_documental: "NÚCLEO PARA EQUINOS",
      composicao_documental:
        "ácido aspártico, ácido fólico, ácido glutâmico, alanina, arginina, biotina, carbonato de cálcio, cisteína, cloreto de colina, cloreto de potássio, creatina, cromo aminoácido quelato, DL-metionina, enxofre ventilado (flor de enxofre), fenilalanina, fosfato bicálcico, glicina, histidina, iodato de cálcio, isoleucina, leucina, leveduras, L-lisina, milho integral moído, niacina, óxido de magnésio, pantotenato de cálcio, prolina, selenito de sódio, serina, sulfato de cálcio, sulfato de cobalto, sulfato de cobre, sulfato de manganês, sulfato de zinco, sulfato ferroso, tirosina, treonina, triptofano, valina, vitamina A, vitamina B1, vitamina B12, vitamina B6, vitamina C, vitamina D3, vitamina E.",
      descricao_documental:
        "Indicado para fabricação de rações destinadas à alimentação de equinos adultos (em trabalho ou atletas).",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P028_horse-power-gold-turbo/fontes/D009.doc",
          arquivo_original:
            "RTPI/Obsoletos/RTPI - Baldinho - Horse Power Gold TURBO - at‚ 2015-06-01.doc",
          sha256: "5208c8e60949bb6bf09d55c1a0df7ff5cfe16e158dfbe9417cbafe0496ba13e5",
          source_id: "D009",
          versao_papel: "historico_obsoleto",
        },
        {
          arquivo_no_pacote: "produtos/P028_horse-power-gold-turbo/fontes/D028.doc",
          arquivo_original: "RTPI/RTPI - Baldinho - Horse Power Gold TURBO.doc",
          sha256: "28ab2d517dbb3df7c0111a9621119835e32853ce9ff4102e044d7a52bde3a54a",
          source_id: "D028",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Misturar o produto às rações durante sua confecção na dose de 4% na mistura (ou 40 kg do produto por tonelada de ração), assegurando uma mistura homogênea. \nRecomenda-se que cada animal tenha um consumo de 200 g/cab/dia de HORSE POWER GOLD TURBO. \nFornecer somente para equinos adultos.\nA dosagem, o período e a forma de administração podem ser alterados conforme recomendações de profissional habilitado.\nEm caso de dúvidas, consulte nosso departamento técnico ou um profissional de sua confiança.\nProduto destinado exclusivamente para equinos adultos. Em hipótese alguma deverá ser ingerido por humanos.",
      nome_comercial_documental: "HORSE POWER GOLD TURBO",
      principal_documental_source_id: "D028",
      produto_id: "P028",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Produto destinado exclusivamente para equídeos adultos. Em hipótese alguma deverá ser ingerido por humanos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "cbbc5fdd31055d1541eeebfa16d711f160e33cc718b238f8d754b031af113d20",
    kind: "catalog",
    product: {
      aliases: ["NÚCLEO DUKAMP CONFINAMENTO", "RTPI - N£cleo - N£cleo Confinamento"],
      bloqueios: [],
      classificacao_documental: "NOVO RÓTULO: NÚCLEO PARA BOVINOS DE CORTE",
      composicao_documental:
        "Monensina sódica, carbonato de cálcio, cloreto de potássio, fosfato bicálcico, iodato de cálcio, óxido de magnésio, óxido de zinco, selenito de sódio, sulfato de cobalto, sulfato de cobre, sulfato de ferro, vitamina A, vitamina D3, vitamina E, cloreto de sódio (sal comum) - 19%, enxofre ventilado (flor de enxofre), monóxido de manganês.",
      descricao_documental:
        "Núcleo mineral e vitamínico para manufatura de rações destinadas à alimentação de bovinos de corte nas fases de engorda e acabamento em confinamento, conforme orientações técnicas de nutricionista.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P067_nucleo-dukamp-confinamento/fontes/D067.doc",
          arquivo_original: "RTPI/RTPI - N£cleo - N£cleo Confinamento.doc",
          sha256: "6fa65df0156c5077527d6002ac44c6c6b34bed7058ca1310f49ab19341e792ac",
          source_id: "D067",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Adicionar 40 kg do produto NÚCLEO DUKAMP CONFINAMENTO por tonelada de ração. Fornecer o produto elaborado calculado na proporção de 1 a 1,5% do peso corporal, em média. Para adaptação gradual dos animais ao produto, iniciar usando 50% da dose diária recomendada durante a primeira semana e, só a partir de então, fornecer a dose completa. IMPORTANTE: ESTE PRODUTO NÃO DEVERÁ SER FORNECIDO PURO AOS ANIMAIS. NÃO PERMITIR QUE OVINOS OU EQUÍDEOS SE ALIMENTEM  DESSE PRODUTO (OU A MISTURAS QUE CONTENHAM ESSE PRODUTO).",
      nome_comercial_documental: "NÚCLEO DUKAMP CONFINAMENTO",
      principal_documental_source_id: "D067",
      produto_id: "P067",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos ou equídeos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "f8d8b851a4ed9af55b2db78e05da518a1ea5042205abf9c95813c2c7b75337c9",
    kind: "catalog",
    product: {
      aliases: ["NÚCLEO DUKAMP CONFINAMENTO 100 I", "RTPI - N£cleo - N£cleo Confinamento 100 I"],
      bloqueios: [
        {
          descricao:
            "CÁLCIO: tabela técnica = 220 / 510 g; anexo = CÁLCIOmín / máx220 / 520g. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - N£cleo - N£cleo Confinamento 100 I.doc",
              evidence_id: "D063-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D063",
            },
          ],
          source_id: "D063",
          tipo: "garantia_entre_blocos",
        },
      ],
      classificacao_documental: "NÚCLEO PARA BOVINOS DE CORTE",
      composicao_documental:
        "Monensina sódica, carbonato de cálcio, cloreto de potássio, fosfato bicálcico, iodato de cálcio, óxido de magnésio, óxido de zinco, selenito de sódio, sulfato de cobalto, sulfato de cobre, sulfato de ferro, enxofre ventilado (flor de enxofre), monóxido de manganês.",
      descricao_documental:
        "Núcleo mineral para manufatura de rações destinadas à alimentação de bovinos de corte nas fases de engorda e acabamento em confinamento, conforme orientações técnicas de nutricionista.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P063_nucleo-dukamp-confinamento-100-i/fontes/D063.doc",
          arquivo_original: "RTPI/RTPI - N£cleo - N£cleo Confinamento 100 I.doc",
          sha256: "c6fa93dea141b87bb084344e62d22ee67443807cb8c16114276b77e1df08d4fd",
          source_id: "D063",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Adicionar 20 kg do produto NÚCLEO DUKAMP CONFINAMENTO 100 i por tonelada de ração. Fornecer o produto elaborado calculado na proporção de 1 a 1,5% do peso corporal, em média. Para adaptação gradual dos animais ao produto, iniciar usando 50% da dose diária recomendada durante a primeira semana e, só a partir de então, fornecer a dose completa. IMPORTANTE: ESTE PRODUTO NÃO DEVERÁ SER FORNECIDO PURO AOS ANIMAIS. NÃO PERMITIR QUE OVINOS OU EQUÍDEOS SE ALIMENTEM  DESSE PRODUTO (OU A MISTURAS QUE CONTENHAM ESSE PRODUTO).",
      nome_comercial_documental: "NÚCLEO DUKAMP CONFINAMENTO 100 I",
      principal_documental_source_id: "D063",
      produto_id: "P063",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos ou equídeos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "80b96b4ae10274320c34a313208f8fb36a440852f991fd9571fcbd40ab83eca8",
    kind: "catalog",
    product: {
      aliases: ["NÚCLEO DUKAMP CONFINAMENTO 200 B", "RTPI - N£cleo - N£cleo Confinamento 200 B"],
      bloqueios: [
        {
          descricao:
            "SELÊNIO: tabela técnica = 10 mg; anexo = SELÊNIOmín102mg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - N£cleo - N£cleo Confinamento 200 B.doc",
              evidence_id: "D064-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D064",
            },
          ],
          source_id: "D064",
          tipo: "garantia_entre_blocos",
        },
        {
          descricao:
            "VITAMINA E: tabela técnica = 750 UI/kg; anexo = VITAMINA Emín1150UI/kg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - N£cleo - N£cleo Confinamento 200 B.doc",
              evidence_id: "D064-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D064",
            },
          ],
          source_id: "D064",
          tipo: "garantia_entre_blocos",
        },
      ],
      classificacao_documental: "NÚCLEO PARA BOVINOS DE CORTE",
      composicao_documental:
        "carbonato de cálcio, fosfato bicálcico, iodato de cálcio, óxido de magnésio, óxido de zinco, selenito de sódio, sulfato de cobalto, sulfato de cobre, sulfato de ferro, vitamina A, vitamina D3, vitamina E, cloreto de sódio (sal comum) - 19%, enxofre ventilado (flor de enxofre), monóxido de manganês.",
      descricao_documental:
        "Núcleo mineral e vitamínico para manufatura de rações destinadas à alimentação de bovinos de corte nas fases de engorda e acabamento em confinamento, conforme orientações técnicas de nutricionista.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P064_nucleo-dukamp-confinamento-200-b/fontes/D064.doc",
          arquivo_original: "RTPI/RTPI - N£cleo - N£cleo Confinamento 200 B.doc",
          sha256: "2c5e4634b86fc73b162ae9925f1fa1ed52c6259f3ad39c7515aece95e12ced3b",
          source_id: "D064",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Adicionar 40 kg do produto NÚCLEO DUKAMP CONFINAMENTO 200 B por tonelada de ração. Fornecer o produto elaborado calculado na proporção de 1 a 1,5% do peso corporal, em média. Para adaptação gradual dos animais ao produto, iniciar usando 50% da dose diária recomendada durante a primeira semana e, só a partir de então, fornecer a dose completa. IMPORTANTE: ESTE PRODUTO NÃO DEVERÁ SER FORNECIDO PURO AOS ANIMAIS. NÃO PERMITIR QUE OVINOS OU EQUÍDEOS SE ALIMENTEM  DESSE PRODUTO (OU A MISTURAS QUE CONTENHAM ESSE PRODUTO).",
      nome_comercial_documental: "NÚCLEO DUKAMP CONFINAMENTO 200 B",
      principal_documental_source_id: "D064",
      produto_id: "P064",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos ou equídeos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "97585b7aca47ba44810b2bb1839e089677397356a42588e46c28e28ad930ce28",
    kind: "catalog",
    product: {
      aliases: [
        "NÚCLEO DUKAMP CONFINAMENTO 200 V+I",
        "RTPI - N£cleo - N£cleo Confinamento 200 V + I",
      ],
      bloqueios: [
        {
          descricao:
            "VITAMINA E: tabela técnica = 750 UI/kg; anexo = VITAMINA Emín1150UI/kg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - N£cleo - N£cleo Confinamento 200 V + I.doc",
              evidence_id: "D065-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D065",
            },
          ],
          source_id: "D065",
          tipo: "garantia_entre_blocos",
        },
      ],
      classificacao_documental: "NÚCLEO PARA BOVINOS DE CORTE",
      composicao_documental:
        "Monensina sódica, carbonato de cálcio, cloreto de potássio, fosfato bicálcico, iodato de cálcio, óxido de magnésio, óxido de zinco, selenito de sódio, sulfato de cobalto, sulfato de cobre, sulfato de ferro, vitamina A, vitamina D3, vitamina E, cloreto de sódio (sal comum) - 19%, enxofre ventilado (flor de enxofre), monóxido de manganês.",
      descricao_documental:
        "Núcleo mineral e vitamínico para manufatura de rações destinadas à alimentação de bovinos de corte nas fases de engorda e acabamento em confinamento, conforme orientações técnicas de nutricionista.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P065_nucleo-dukamp-confinamento-200-v-i/fontes/D065.doc",
          arquivo_original: "RTPI/RTPI - N£cleo - N£cleo Confinamento 200 V + I.doc",
          sha256: "ec18cb3e0b59d365de43fd65496e03f777a843d390444fed750963a2d532c190",
          source_id: "D065",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Adicionar 40 kg do produto NÚCLEO DUKAMP CONFINAMENTO 200 V + I por tonelada de ração. Fornecer o produto elaborado calculado na proporção de 1 a 1,5% do peso corporal, em média. Para adaptação gradual dos animais ao produto, iniciar usando 50% da dose diária recomendada durante a primeira semana e, só a partir de então, fornecer a dose completa. IMPORTANTE: ESTE PRODUTO NÃO DEVERÁ SER FORNECIDO PURO AOS ANIMAIS. NÃO PERMITIR QUE OVINOS OU EQUÍDEOS SE ALIMENTEM  DESSE PRODUTO (OU A MISTURAS QUE CONTENHAM ESSE PRODUTO).",
      nome_comercial_documental: "NÚCLEO DUKAMP CONFINAMENTO 200 V+I",
      principal_documental_source_id: "D065",
      produto_id: "P065",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos ou equídeos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "fd3791c0760a23becb279362d71eaf7e66c394454d58a25460756e4b88608ef7",
    kind: "catalog",
    product: {
      aliases: [
        "NUCLEO DUKAMP CONFINAMENTO BEN HUR CABRERA",
        "RTPI - N£cleo - N£cleo Conf. (Ben hur Cabrera )",
      ],
      bloqueios: [
        {
          descricao:
            "ENXOFRE: especificação 'mím' e unidade 'g/kg' preservadas. Confirmar a grafia antes de normalizar.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - N£cleo - N£cleo Conf. (Ben hur Cabrera ).doc",
              evidence_id: "D060-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D060",
            },
          ],
          source_id: "D060",
          tipo: "grafia_unidade_especificacao",
        },
        {
          descricao:
            "MONENSINA SÓDICA: especificação 'mín' e unidade 'Mgr/kg' preservadas. Confirmar a grafia antes de normalizar.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - N£cleo - N£cleo Conf. (Ben hur Cabrera ).doc",
              evidence_id: "D060-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D060",
            },
          ],
          source_id: "D060",
          tipo: "grafia_unidade_especificacao",
        },
      ],
      classificacao_documental: "NÚCLEO PARA BOVINOS EM CONFINAMENTO",
      composicao_documental:
        "Carbonato de cálcio, enxofre ventilado (flor-de-enxofre), sulfato de cobalto, sulfato de cobre, iodato de cálcio,  óxido de zinco, selenito de sódio, monesina sódica.",
      descricao_documental:
        "Núcleo mineral para formulação de dietas para bovinos em confinamento.",
      fontes: [
        {
          arquivo_no_pacote:
            "produtos/P060_nucleo-dukamp-confinamento-ben-hur-cabrera/fontes/D060.doc",
          arquivo_original: "RTPI/RTPI - N£cleo - N£cleo Conf. (Ben hur Cabrera ).doc",
          sha256: "d19d3e4e7ab105caf4a6f5f92f1d9552ab4e7e4ac6afbcf47525d14851b6be88",
          source_id: "D060",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Uso exclusivo para formulação de dietas para bovinos em confinamento. Garantir consumo de 100 gramas/cab/dia. Não fornecer puro aos animais.",
      nome_comercial_documental: "NUCLEO DUKAMP CONFINAMENTO BEN HUR CABRERA",
      principal_documental_source_id: "D060",
      produto_id: "P060",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Uso exclusivo para formulação de dietas para bovinos em confinamento.\nNão fornecer puro aos animais.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "ab3bd63cbd91e6df1a6b94da8315e0ed97b5a36b99947990eee690780f2811fe",
    kind: "catalog",
    product: {
      aliases: [
        "NÚCLEO DUKAMP CONFINAMENTO PREMIUM",
        "RTPI - N£cleo - N£cleo Confinamento Premium",
      ],
      bloqueios: [],
      classificacao_documental: "NÚCLEO PARA BOVINOS DE CORTE",
      composicao_documental:
        "vitamina E, sulfato de zinco, aditivo monesina sódica, enxofre ventilado (flor de enxofre), sulfato de cálcio, fosfato bicálcico, cloreto de potássio, cloreto de sódio (sal comum) - 30%, óxido de magnésio, sulfato de cobalto, sulfato de cobre, iodato de cálcio, sulfato de manganês, selenito de sódio, caulim - 5,603%.",
      descricao_documental:
        "RÓTULO ATUAL: Suplemento mineral para uso exclusivo na formulação de rações e concentrados, contendo vitamina E e promotor de crescimento e eficiência alimentar (ionóforo), indicadopara adequado suplementação mineral e vitamínica de bovinos de corte nas fases de acabamento e terminação em confinamento. NOVO RÓTULO: Núcleo mineral e vitamínico para manufatura de rações destinadas à alimentação de bovinos de corte nas fases de engorda e acabamento em confinamento, conforme orientações técnicas de nutricionista.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P066_nucleo-dukamp-confinamento-premium/fontes/D066.doc",
          arquivo_original: "RTPI/RTPI - N£cleo - N£cleo Confinamento Premium.doc",
          sha256: "28f2725299e0b65a305b7c2eab7f7a119aa80309c9e07220076bcc913cc37504",
          source_id: "D066",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Adicionar 20 kg do produto NÚCLEO DUKAMP CONFINAMENTO PREMIUM por tonelada de ração. Fornecer o produto elaborado calculado na proporção de 1 a 1,5% do peso corporal, em média. Para adaptação gradual dos animais ao produto, iniciar usando 50% da dose diária recomendada durante a primeira semana e, só a partir de então, fornecer a dose completa. IMPORTANTE: ESTE PRODUTO NÃO DEVERÁ SER FORNECIDO PURO AOS ANIMAIS. NÃO PERMITIR QUE OVINOS OU EQUÍDEOS SE ALIMENTEM  DESSE PRODUTO (OU A MISTURAS QUE CONTENHAM ESSE PRODUTO).",
      nome_comercial_documental: "NÚCLEO DUKAMP CONFINAMENTO PREMIUM",
      principal_documental_source_id: "D066",
      produto_id: "P066",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos ou equídeos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "359bc0a2dbdfec5a9f38afc8a91a50ded3e7a4c6efdcdc32a75ae8e5981692a3",
    kind: "catalog",
    product: {
      aliases: ["NÚCLEO DUKAMP LACTAÇÃO", "RTPI - Núcleo - Núcleo Lactação"],
      bloqueios: [],
      classificacao_documental: "NÚCLEO PARA BOVINOS DE LEITE",
      composicao_documental:
        "carbonato de cálcio, fosfato bicálcico, óxido de magnésio, cloreto de potássio, cloreto de sódio (sal comum) - 21,7%, enxofre ventilado (flor de enxofre), sulfato de cobalto, sulfato de cobre, iodato de cálcio, sulfato de ferro, sulfato de manganês, selenito de sódio, sulfato de zinco, vitamina A, vitamina D3, vitamina E.",
      descricao_documental:
        "Núcleo mineral e vitamínico para manufatura de rações destinadas à alimentação de bovinos de leite em lactação, conforme orientações técnicas de nutricionista.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P072_nucleo-dukamp-lactacao/fontes/D072.doc",
          arquivo_original: "RTPI/RTPI - Núcleo - Núcleo Lactação.doc",
          sha256: "c7fd3030fe0332508d2a9573108702938a9cc17785280aaf33db205339108169",
          source_id: "D072",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Adicionar 40 kg do produto NÚCLEO DUKAMP LACTAÇÃO por tonelada de ração. Fornecer o produto elaborado calculado na proporção de 1 kg de ração para cada 2,5 a 3 litros de leite produzidos, ou conforme orientação técnica de nutricionista. Para formulações específicas, ou em caso de dúvidas, consulte nosso departamento técnico ou um profissional habilitado de sua confiança.\nIMPORTANTE: ESTE PRODUTO NÃO DEVERÁ SER FORNECIDO PURO AOS ANIMAIS. NÃO PERMITIR QUE OVINOS SE ALIMENTEM  DESSE PRODUTO (OU A MISTURAS QUE CONTENHAM ESSE PRODUTO).",
      nome_comercial_documental: "NÚCLEO DUKAMP LACTAÇÃO",
      principal_documental_source_id: "D072",
      produto_id: "P072",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "d4bf37051c6f6ab23e6e516206be012bb6f8a87ac25edc73d7112080ff4ae37d",
    kind: "catalog",
    product: {
      aliases: ["NÚCLEO DUKAMP LACTAÇÃO GL", "RTPI - Núcleo - Núcleo Lactação GL"],
      bloqueios: [],
      classificacao_documental: "NÚCLEO PARA BOVINOS DE LEITE",
      composicao_documental:
        "carbonato de cálcio, fosfato bicálcico - 30,6%, óxido de magnésio, cloreto de potássio, cloreto de sódio (sal comum) - 21,7%, enxofre ventilado (flor de enxofre), sulfato de cobalto, sulfato de cobre, iodato de cálcio, sulfato de ferro, sulfato de manganês, selenito de sódio, óxido de zinco, vitamina A, vitamina D3, vitamina E.",
      descricao_documental:
        "Indicado para a fabricação de rações destinadas à alimentação de bovinos leiteiros em lactação, conforme orientações técnicas de nutricionista.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P071_nucleo-dukamp-lactacao-gl/fontes/D071.doc",
          arquivo_original: "RTPI/RTPI - Núcleo - Núcleo Lactação GL.doc",
          sha256: "3f3a7f266f70db45792595e1cd603000238df9e66d453d693db7fff38fd8060b",
          source_id: "D071",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Adicionar 40 kg do produto NÚCLEO DUKAMP LACTAÇÃO GL por tonelada de ração. Fornecer o produto elaborado calculado na proporção de 1 kg de ração para cada 2,5 a 3 litros de leite produzidos, ou conforme orientação técnica de nutricionista. Para formulações específicas, ou em caso de dúvidas, consulte nosso departamento técnico ou um profissional habilitado de sua confiança.\nIMPORTANTE: ESTE PRODUTO NÃO DEVERÁ SER FORNECIDO PURO AOS ANIMAIS. NÃO PERMITIR QUE OVINOS SE ALIMENTEM  DESSE PRODUTO (OU A MISTURAS QUE CONTENHAM ESSE PRODUTO).",
      nome_comercial_documental: "NÚCLEO DUKAMP LACTAÇÃO GL",
      principal_documental_source_id: "D071",
      produto_id: "P071",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "da8d150d0ae5c44807eac2e060f0d28c6c26244a320da4daa9bffe5f85ebaf30",
    kind: "catalog",
    product: {
      aliases: ["NÚCLEO DUKAMP PRÉ PARTO GL", "RTPI - N£cleo - N£cleo Dukamp Pr‚ Parto gl"],
      bloqueios: [],
      classificacao_documental: "NÚCLEO PARA BOVINOS",
      composicao_documental:
        "Cacareo calcitico, farelo de soja, fosfato bicalcico, iodato de cálcio óxido de magnésio, oxido de zinco, selenito de sódio, sulfato de cobalto, sulfato de cobre, sulfato de ferro, vitamina a, vitamina d3, vitamina e, niacina monesina sódica, cloreto de sódio, enxofre ventilado, monoxido de manganes, metionato de cromo, complexo zinco aminoacido, complexo cobre aminoácido, complexo cobre aminoacido.",
      descricao_documental:
        "Produto indicado para proteico ser usado como nucleo, e vitaminico destinado ao preparo de rações para vacas e novilhas leiteiras, no periodo de 21 dias que antecede o parto.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P069_nucleo-dukamp-pre-parto-gl/fontes/D069.doc",
          arquivo_original: "RTPI/RTPI - N£cleo - N£cleo Dukamp Pr‚ Parto gl.doc",
          sha256: "35e647e0a9d47b7faacb62ef263bfff8fd4168f3c8926769144915ad0960292e",
          source_id: "D069",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Adicionar 100 kg do produto por tonelada de ração e fornecer o produto elaborado sempre junto com volumoso calculado na porporção d 3 a 4 kilos por cabeça dia, dependendo da qualidade do volumoso e ecore corporal dos animais. È recomendado fazer adapatação do animal ao produto fornecendo quantidades crescentes até atingir a quantidade recomendada.",
      nome_comercial_documental: "NÚCLEO DUKAMP PRÉ PARTO GL",
      principal_documental_source_id: "D069",
      produto_id: "P069",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos ou equídeos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "1eb4052c9d0d4752dee2a3734f1bab73423472e00cb685fe5e6d027dc1f99e33",
    kind: "catalog",
    product: {
      aliases: ["NÚCLEO DUKAMP PROTEICO SECA", "RTPI - N£cleo - N£cleo Dukamp Proteico Seca"],
      bloqueios: [
        {
          descricao:
            "IODO: tabela técnica = 1250 mg; anexo = IODOmín12500mg. Pode corresponder a revisão de embalagem ou erro documental. Confirmar qual bloco corresponde ao rótulo vigente; não escolher nem combinar valores.",
          referencias: [
            {
              arquivo_original: "RTPI/RTPI - N£cleo - N£cleo Dukamp Proteico Seca.doc",
              evidence_id: "D068-S09",
              pagina_pdf_inicio: null,
              secao_numero_original: 9,
              secao_semantica: "Níveis de garantia e valores de referência",
              source_id: "D068",
            },
          ],
          source_id: "D068",
          tipo: "garantia_entre_blocos",
        },
      ],
      classificacao_documental: "NÚCLEO PARA BOVINOS",
      composicao_documental:
        "Carbonato de cálcio, iodato de cálcio, óxido de magnésio, óxido de zinco, selenito de sódio, sulfato de cobalto, sulfato de cobre, sulfato de ferro, enxofre ventilado (flor de enxofre), monóxido de manganês.",
      descricao_documental:
        "Indicado para o preparo de suplementos mierais protéicos (sal proteicnado) destinado a alimentação de bovinos de corte, conforme recomendação técnica.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P068_nucleo-dukamp-proteico-seca/fontes/D068.doc",
          arquivo_original: "RTPI/RTPI - N£cleo - N£cleo Dukamp Proteico Seca.doc",
          sha256: "58da9f807414c9f9e8ced491c94cd2c6764c348fbcfb1592c49d77ed0bb3f831",
          source_id: "D068",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Para preparar suplemementos minerais proteicos (sal Proteinados) incluir na proporçãode 4 %, ist é, 40 kgs deproduto por tonelada, este produto deve ser complementado com fontes de cálcio, fósforo, sódio e outros ingredientes proteicos e energeticos necessarios como milho moido farelo de soja e/ou algodão e ureia pecuaria por exemplo. Este produto é destiando apenas para para bovinos de corte e não deverá ser fornecido diretamente ao animais, sem que antes tenha sido misturado a outros ingredientes conforme especificado anteriormente para formulações especificas  ou em caso de dúvidas consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "NÚCLEO DUKAMP PROTEICO SECA",
      principal_documental_source_id: "D068",
      produto_id: "P068",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos ou equídeos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "76b7eb3be6130e803bd43edf75b179b90eb7aaf675d5235ec684c6a1e35e56e5",
    kind: "catalog",
    product: {
      aliases: ["NÚCLEO DUKAMP SM", "RTPI - N£cleo - N£cleo Dukamp SM"],
      bloqueios: [],
      classificacao_documental: "NÚCLEO PARA BOVINOS",
      composicao_documental:
        "Carbonato de cálcio, iodato de cálcio, óxido de magnésio, óxido de zinco, selenito de sódio, sulfato de cobalto, sulfato de cobre, sulfato de ferro, enxofre ventilado (flor de enxofre), monóxido de manganês.",
      descricao_documental:
        "PRODUTO INDICADO PARA SER USADO COMO SUPLEMENTO MINERAL NA ELABORAÇÃO DE SAL MINERALIZADO DESTINADO A ALIMENTAÇÃO DE BOVINOS DE ACORDO COM A RECOMENDAÇÃO TÉCNICAS.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P070_nucleo-dukamp-sm/fontes/D070.doc",
          arquivo_original: "RTPI/RTPI - N£cleo - N£cleo Dukamp SM.doc",
          sha256: "91ee24253181f0edcf732193df9683aa98b1c58c82aec13ca4cdf54fc95453ff",
          source_id: "D070",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Adicionar 60 a 100 kgs do produto por tonelada nas formulações de sais mineralizados destinados á alimentação de bovinos de lete ou de corte. Este produto deve ser complementado com fontes de cálcio, fósforo, sódio e outros macrolelementos necéssarios, para formulações específicas ou em saco de dívidas, consulte nosso departamento técnico ou um profissional de sua confiança.",
      nome_comercial_documental: "NÚCLEO DUKAMP SM",
      principal_documental_source_id: "D070",
      produto_id: "P070",
      recomendacao_operacional_liberada: false,
      restricoes_documentais: "Não fornecer o produto para ovinos ou equídeos.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
  {
    fingerprint: "9878b69885c6cfe15706127af2fdcc262ffb1bcab1e7b5d9181b9d2e0f23b982",
    kind: "catalog",
    product: {
      aliases: ["RODEO BULLS TURBO", "RTPI - Baldinho - Rodeo Bulls Turbo"],
      bloqueios: [],
      classificacao_documental: "SUPLEMENTO MINERAL/VITAMÍNICO COM AMINOÁCIDOS PARA MISTURA",
      composicao_documental:
        "creatina, sal cálcico de ácido graxo, carbonato de cálcio, caulim, cloreto de potássio, cloreto de sódio (sal comum), sulfato de cobalto, sulfato de cobre, iodato de cálcio, sulfato de manganês, transquelato de selênio, selenito de sódio, sulfato de ferro, sulfato de zinco, óxido de zinco, cromo aminoácido quelato, vitamina A, vitamina D3, vitamina E, vitamina B1, pantotenato de cálcio, vitamina B12, vitamina B2, piridoxina, ácido fólico, vitamina C, biotina, cloreto de colina, niacina, L-lisina, DL-metionina, ácido aspártico, ácido glutâmico, alanina, arginina, cisteína, fenilalanina, glicina, histidina, isoleucina, leucina, prolina, serina, tirosina, treonina, triptofano, valina, veículo q.s.p.",
      descricao_documental:
        "Indicado para bovinos atletas ou submetidos a atividades de alta intensidade, melhorando a resitência física e os atributos da musculatura esquelética, como força e explosão. Proporciona aumentos da performance atlética por promover ganho de massa muscular e melhora da relação corporal entre massa magra e gordura.",
      fontes: [
        {
          arquivo_no_pacote: "produtos/P030_rodeo-bulls-turbo/fontes/D030.doc",
          arquivo_original: "RTPI/RTPI - Baldinho - Rodeo Bulls Turbo.doc",
          sha256: "2b3764f29aecea18067f3673dbf48b98513db47a657c90f53065a4ff868aafa1",
          source_id: "D030",
          versao_papel: "principal_documental",
        },
      ],
      modo_de_usar_documental:
        "Fornecer somente para bovinos, seguindo as orientações abaixo: \n\nCATEGORIA ANIMAL | QUANTIDADE |  | Adultos acima de 500 kg | 100 g/dia, durante os 7 dias que antecedem algum evento esportivo |  | Manutenção e animais jovens | 50 g/dia  |  | \nRecomenda-se fornecer DUKAMP RODEO BULLS TURBO misturado à ração. \n\nEste suplemento não substitui o suplemento mineal, devendo este continuar a ser fornecido aos animais.",
      nome_comercial_documental: "RODEO BULLS TURBO",
      principal_documental_source_id: "D030",
      produto_id: "P030",
      recomendacao_operacional_liberada: false,
      restricoes_documentais:
        "Recomenda-se fornecer DUKAMP RODEO BULLS TURBO misturado à ração. \n\nEste suplemento não substitui o suplemento mineal, devendo este continuar a ser fornecido aos animais.",
      status_vigencia: "nao_verificada",
    },
    review: null,
    review_history: [],
    schema: "dukamp:1",
  },
] as unknown as CatalogEnvelope[];
