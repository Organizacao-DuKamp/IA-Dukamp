
-- =========================================================
-- Etapa 1: schema aditivo (não destrutivo)
-- =========================================================

-- ---------- products ----------
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  official_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT,
  species TEXT,
  animal_phase TEXT,
  package_weight TEXT,
  indication TEXT,
  consumption TEXT,
  usage_instructions TEXT,
  composition TEXT,
  guarantee_levels TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  requires_review BOOLEAN NOT NULL DEFAULT false,
  is_duplicate BOOLEAN NOT NULL DEFAULT false,
  duplicate_of UUID REFERENCES public.products(id) ON DELETE SET NULL,
  source_document UUID REFERENCES public.knowledge_documents(id) ON DELETE SET NULL,
  source_updated_at TIMESTAMPTZ,
  extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_species_idx ON public.products (species);
CREATE INDEX IF NOT EXISTS products_active_idx  ON public.products (active);
CREATE INDEX IF NOT EXISTS products_category_idx ON public.products (category);
CREATE INDEX IF NOT EXISTS products_review_idx   ON public.products (requires_review);
CREATE INDEX IF NOT EXISTS products_name_lower_idx ON public.products (lower(official_name));

GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public reads active products"
  ON public.products FOR SELECT
  TO anon, authenticated
  USING (active = true AND requires_review = false AND is_duplicate = false);

CREATE POLICY "admins read all products"
  ON public.products FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins write products"
  ON public.products FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER products_touch BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- product_aliases ----------
CREATE TABLE IF NOT EXISTS public.product_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  alias_normalized TEXT NOT NULL,
  origin TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, alias_normalized)
);

CREATE INDEX IF NOT EXISTS product_aliases_norm_idx ON public.product_aliases (alias_normalized);

GRANT SELECT ON public.product_aliases TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_aliases TO authenticated;
GRANT ALL ON public.product_aliases TO service_role;

ALTER TABLE public.product_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public reads aliases of visible products"
  ON public.product_aliases FOR SELECT
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_aliases.product_id
      AND p.active AND NOT p.requires_review AND NOT p.is_duplicate
  ));

CREATE POLICY "admins manage aliases"
  ON public.product_aliases FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------- product_review_queue ----------
CREATE TABLE IF NOT EXISTS public.product_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,           -- 'divergencia' | 'duplicidade' | 'campos_ausentes' | 'antigo' | 'manual'
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pendente', -- 'pendente' | 'aprovado' | 'rejeitado' | 'mesclado'
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS review_queue_status_idx ON public.product_review_queue (status);
CREATE INDEX IF NOT EXISTS review_queue_reason_idx ON public.product_review_queue (reason);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_review_queue TO authenticated;
GRANT ALL ON public.product_review_queue TO service_role;

ALTER TABLE public.product_review_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage review queue"
  ON public.product_review_queue FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER review_queue_touch BEFORE UPDATE ON public.product_review_queue
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- import_reports ----------
CREATE TABLE IF NOT EXISTS public.import_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,                 -- 'zip_upload' | 'file_upload' | 'product_extraction' | 'reprocess'
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  triggered_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_reports TO authenticated;
GRANT ALL ON public.import_reports TO service_role;

ALTER TABLE public.import_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read reports"
  ON public.import_reports FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins write reports"
  ON public.import_reports FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------- import_report_items ----------
CREATE TABLE IF NOT EXISTS public.import_report_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.import_reports(id) ON DELETE CASCADE,
  file_name TEXT,
  status TEXT NOT NULL,               -- 'ok' | 'duplicate' | 'error' | 'divergence' | 'missing_fields'
  message TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS import_report_items_report_idx ON public.import_report_items (report_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_report_items TO authenticated;
GRANT ALL ON public.import_report_items TO service_role;

ALTER TABLE public.import_report_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read report items"
  ON public.import_report_items FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins write report items"
  ON public.import_report_items FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------- knowledge_documents: colunas aditivas ----------
ALTER TABLE public.knowledge_documents
  ADD COLUMN IF NOT EXISTS internal_title TEXT,
  ADD COLUMN IF NOT EXISTS file_type TEXT,
  ADD COLUMN IF NOT EXISTS original_file TEXT,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS is_duplicate_of UUID REFERENCES public.knowledge_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requires_review BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS knowledge_documents_hash_idx ON public.knowledge_documents (content_hash);

-- ---------- knowledge_chunks: colunas aditivas ----------
ALTER TABLE public.knowledge_chunks
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS knowledge_chunks_product_idx ON public.knowledge_chunks (product_id);
