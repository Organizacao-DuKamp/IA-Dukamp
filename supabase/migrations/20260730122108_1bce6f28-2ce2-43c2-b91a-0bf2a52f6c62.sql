CREATE TABLE IF NOT EXISTS public.market_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  org TEXT NOT NULL,
  category TEXT NOT NULL,
  url TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('rag','dynamic')),
  phase INT NOT NULL DEFAULT 2,
  region TEXT,
  ingest_method TEXT NOT NULL DEFAULT 'manual',
  license_note TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.market_quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product TEXT NOT NULL,
  product_slug TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC(14,4) NOT NULL,
  unit TEXT NOT NULL,
  locality TEXT NOT NULL,
  state TEXT,
  payment_condition TEXT,
  quote_type TEXT NOT NULL DEFAULT 'indicador',
  reference_date DATE NOT NULL,
  source_updated_at TIMESTAMPTZ,
  source_code TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  var_daily NUMERIC(10,4),
  var_weekly NUMERIC(10,4),
  var_monthly NUMERIC(10,4),
  notes TEXT,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_slug, unit, locality, quote_type, reference_date, source_code)
);

CREATE INDEX IF NOT EXISTS market_quotes_lookup_idx ON public.market_quotes (product_slug, reference_date DESC);
CREATE INDEX IF NOT EXISTS market_quotes_category_idx ON public.market_quotes (category, reference_date DESC);

GRANT SELECT ON public.market_sources TO anon, authenticated;
GRANT ALL ON public.market_sources TO service_role;
GRANT SELECT ON public.market_quotes TO anon, authenticated;
GRANT ALL ON public.market_quotes TO service_role;

ALTER TABLE public.market_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "market_sources_public_read" ON public.market_sources
  FOR SELECT TO anon, authenticated USING (active);
CREATE POLICY "market_sources_admin_write" ON public.market_sources
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "market_quotes_public_read" ON public.market_quotes
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "market_quotes_admin_write" ON public.market_quotes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));