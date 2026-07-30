-- ============ CATEGORIAS ============
CREATE TABLE public.livestock_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  nome text NOT NULL,
  especie text NOT NULL DEFAULT 'bovino',
  unidade_padrao text NOT NULL DEFAULT '@',
  sinonimos text[] NOT NULL DEFAULT '{}',
  max_idade_dias integer NOT NULL DEFAULT 10,
  ordem integer NOT NULL DEFAULT 100,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.livestock_categories TO anon, authenticated;
GRANT ALL ON public.livestock_categories TO service_role;
ALTER TABLE public.livestock_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "livestock_categories_public_read" ON public.livestock_categories FOR SELECT USING (true);

-- ============ PRAÇAS ============
CREATE TABLE public.livestock_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  municipio text NOT NULL,
  uf text NOT NULL,
  regiao text,
  is_praca_pecuaria boolean NOT NULL DEFAULT false,
  lat double precision,
  lon double precision,
  ibge_code text,
  apelidos text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_livestock_places_uf ON public.livestock_places (uf);
CREATE INDEX idx_livestock_places_regiao ON public.livestock_places (regiao);
GRANT SELECT ON public.livestock_places TO anon, authenticated;
GRANT ALL ON public.livestock_places TO service_role;
ALTER TABLE public.livestock_places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "livestock_places_public_read" ON public.livestock_places FOR SELECT USING (true);

-- ============ VÍNCULOS DE PROXIMIDADE ============
CREATE TABLE public.livestock_place_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem_slug text NOT NULL REFERENCES public.livestock_places(slug) ON DELETE CASCADE,
  praca_slug text NOT NULL REFERENCES public.livestock_places(slug) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 1,
  distancia_km integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (origem_slug, praca_slug)
);
CREATE INDEX idx_place_links_origem ON public.livestock_place_links (origem_slug, ordem);
GRANT SELECT ON public.livestock_place_links TO anon, authenticated;
GRANT ALL ON public.livestock_place_links TO service_role;
ALTER TABLE public.livestock_place_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "livestock_place_links_public_read" ON public.livestock_place_links FOR SELECT USING (true);

-- ============ COTAÇÕES ============
CREATE TABLE public.cotacoes_pecuarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL,
  estado text NOT NULL DEFAULT '',
  cidade text,
  cidade_slug text NOT NULL DEFAULT '',
  regiao text NOT NULL DEFAULT '',
  abrangencia text NOT NULL DEFAULT 'municipal',
  preco_minimo numeric(12,2),
  preco_maximo numeric(12,2),
  preco_referencia numeric(12,2) NOT NULL,
  unidade text NOT NULL DEFAULT '@',
  condicao_pagamento text,
  data_cotacao date NOT NULL,
  fonte text NOT NULL,
  url_fonte text,
  nivel_confiabilidade text NOT NULL DEFAULT 'alta',
  observacao text,
  raw jsonb,
  data_coleta timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cotacoes_pecuarias_abrangencia_chk CHECK (abrangencia IN ('municipal','regional','estadual','nacional')),
  CONSTRAINT cotacoes_pecuarias_confianca_chk CHECK (nivel_confiabilidade IN ('alta','media','baixa')),
  CONSTRAINT cotacoes_pecuarias_unica UNIQUE (categoria, abrangencia, cidade_slug, regiao, estado, unidade, data_cotacao, fonte)
);

CREATE INDEX idx_cot_pec_lookup ON public.cotacoes_pecuarias (categoria, estado, cidade_slug, data_cotacao DESC);
CREATE INDEX idx_cot_pec_regiao ON public.cotacoes_pecuarias (categoria, regiao, data_cotacao DESC);
CREATE INDEX idx_cot_pec_data ON public.cotacoes_pecuarias (data_cotacao DESC);

GRANT SELECT ON public.cotacoes_pecuarias TO anon, authenticated;
GRANT ALL ON public.cotacoes_pecuarias TO service_role;
ALTER TABLE public.cotacoes_pecuarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cotacoes_pecuarias_public_read" ON public.cotacoes_pecuarias FOR SELECT USING (true);

-- ============ TRIGGER updated_at ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_livestock_categories_updated BEFORE UPDATE ON public.livestock_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_livestock_places_updated BEFORE UPDATE ON public.livestock_places
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cotacoes_pecuarias_updated BEFORE UPDATE ON public.cotacoes_pecuarias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SEED: CATEGORIAS ============
INSERT INTO public.livestock_categories (slug, nome, especie, unidade_padrao, sinonimos, max_idade_dias, ordem) VALUES
('boi-gordo','Boi gordo','bovino','@', ARRAY['boi gordo','boi de abate','boi terminado','arroba do boi','arroba de boi','indicador do boi','boi'],10,1),
('vaca-gorda','Vaca gorda','bovino','@', ARRAY['vaca gorda','vaca de abate','vaca terminada','arroba da vaca'],10,2),
('novilha-gorda','Novilha gorda','bovino','@', ARRAY['novilha gorda','novilha de abate','novilha terminada','novilha'],10,3),
('boi-china','Boi China','bovino','@', ARRAY['boi china','boi chines','boi para china','boi habilitado china'],10,4),
('bezerro-desmamado','Bezerro desmamado','bovino','cabeça', ARRAY['bezerro desmamado','bezerro','bezerro de 8 a 12 meses','preço do bezerro'],20,5),
('bezerra','Bezerra','bovino','cabeça', ARRAY['bezerra','bezerra desmamada'],20,6),
('garrote','Garrote','bovino','cabeça', ARRAY['garrote','garrotes','boi de 12 a 24 meses'],20,7),
('boi-magro','Boi magro','bovino','cabeça', ARRAY['boi magro','boi de reposicao','boi de reposição','boi para engorda'],20,8),
('vaca-boiadeira','Vaca boiadeira','bovino','cabeça', ARRAY['vaca boiadeira','vaca de cria','vaca parida','matriz'],30,9);

-- ============ SEED: PRAÇAS ============
INSERT INTO public.livestock_places (slug, municipio, uf, regiao, is_praca_pecuaria, lat, lon, apelidos) VALUES
('monte-aprazivel','Monte Aprazível','SP','Noroeste Paulista',false,-20.77,-49.71,'{}'),
('sao-jose-do-rio-preto','São José do Rio Preto','SP','Noroeste Paulista',true,-20.81,-49.38,ARRAY['rio preto','sjrp']),
('mirassol','Mirassol','SP','Noroeste Paulista',false,-20.82,-49.52,'{}'),
('aracatuba','Araçatuba','SP','Noroeste Paulista',true,-21.21,-50.44,'{}'),
('barretos','Barretos','SP','Norte Paulista',true,-20.56,-48.57,'{}'),
('votuporanga','Votuporanga','SP','Noroeste Paulista',false,-20.42,-49.97,'{}'),
('andradina','Andradina','SP','Noroeste Paulista',true,-20.90,-51.38,'{}'),
('birigui','Birigui','SP','Noroeste Paulista',false,-21.29,-50.34,'{}'),
('presidente-prudente','Presidente Prudente','SP','Oeste Paulista',true,-22.13,-51.39,'{}'),
('marilia','Marília','SP','Centro-Oeste Paulista',false,-22.21,-49.95,'{}'),
('bauru','Bauru','SP','Centro Paulista',true,-22.31,-49.06,'{}'),
('ribeirao-preto','Ribeirão Preto','SP','Nordeste Paulista',true,-21.17,-47.81,'{}'),
('araraquara','Araraquara','SP','Centro Paulista',false,-21.79,-48.18,'{}'),
('sao-paulo','São Paulo','SP','Grande São Paulo',true,-23.55,-46.63,'{}'),
('campinas','Campinas','SP','Campinas',false,-22.90,-47.06,'{}'),
('tres-lagoas','Três Lagoas','MS','Leste de MS',true,-20.75,-51.68,'{}'),
('campo-grande','Campo Grande','MS','Centro de MS',true,-20.44,-54.65,'{}'),
('dourados','Dourados','MS','Sul de MS',true,-22.22,-54.81,'{}'),
('cuiaba','Cuiabá','MT','Centro de MT',true,-15.60,-56.10,'{}'),
('rondonopolis','Rondonópolis','MT','Sudeste de MT',true,-16.47,-54.64,'{}'),
('sinop','Sinop','MT','Norte de MT',true,-11.86,-55.50,'{}'),
('goiania','Goiânia','GO','Centro de GO',true,-16.69,-49.26,'{}'),
('rio-verde','Rio Verde','GO','Sudoeste de GO',true,-17.79,-50.93,'{}'),
('uberlandia','Uberlândia','MG','Triângulo Mineiro',true,-18.91,-48.27,'{}'),
('uberaba','Uberaba','MG','Triângulo Mineiro',true,-19.75,-47.93,'{}'),
('londrina','Londrina','PR','Norte do PR',true,-23.31,-51.16,'{}'),
('maringa','Maringá','PR','Noroeste do PR',true,-23.42,-51.94,'{}'),
('maraba','Marabá','PA','Sudeste do PA',true,-5.37,-49.12,'{}'),
('palmas','Palmas','TO','Centro do TO',true,-10.18,-48.33,'{}'),
('porto-velho','Porto Velho','RO','Centro de RO',true,-8.76,-63.90,'{}');

-- ============ SEED: VÍNCULOS ============
INSERT INTO public.livestock_place_links (origem_slug, praca_slug, ordem, distancia_km) VALUES
('monte-aprazivel','sao-jose-do-rio-preto',1,40),
('monte-aprazivel','mirassol',2,30),
('monte-aprazivel','aracatuba',3,90),
('monte-aprazivel','barretos',4,170),
('mirassol','sao-jose-do-rio-preto',1,15),
('mirassol','aracatuba',2,115),
('mirassol','barretos',3,145),
('votuporanga','sao-jose-do-rio-preto',1,80),
('votuporanga','aracatuba',2,110),
('birigui','aracatuba',1,20),
('birigui','sao-jose-do-rio-preto',2,120),
('sao-jose-do-rio-preto','aracatuba',1,140),
('sao-jose-do-rio-preto','barretos',2,120),
('aracatuba','sao-jose-do-rio-preto',1,140),
('aracatuba','andradina',2,105),
('andradina','aracatuba',1,105),
('andradina','tres-lagoas',2,60),
('araraquara','ribeirao-preto',1,80),
('araraquara','barretos',2,130),
('marilia','bauru',1,100),
('marilia','presidente-prudente',2,150),
('campinas','sao-paulo',1,95),
('campinas','ribeirao-preto',2,200);