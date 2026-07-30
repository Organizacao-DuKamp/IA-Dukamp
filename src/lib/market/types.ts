// Tipos do módulo de mercado (cotações e indicadores).

export interface MarketQuote {
  id?: string;
  product: string;
  product_slug: string;
  category: string;
  price: number;
  unit: string;
  locality: string;
  state: string | null;
  payment_condition: string | null;
  /** indicador | fisico | futuro | nominal | spot | leilao | cambio | combustivel */
  quote_type: string;
  reference_date: string; // YYYY-MM-DD
  source_updated_at: string | null;
  source_code: string;
  source_name: string;
  source_url: string;
  collected_at?: string;
  var_daily: number | null;
  var_weekly: number | null;
  var_monthly: number | null;
  notes: string | null;
  raw?: unknown;
}

export interface QuoteAnalytics {
  last: MarketQuote;
  varDaily: number | null;
  varWeekly: number | null;
  varMonthly: number | null;
  varYearly: number | null;
  ma7: number | null;
  ma30: number | null;
  ma90: number | null;
  max: { price: number; date: string } | null;
  min: { price: number; date: string } | null;
  samples: number;
}

/** Classificação obrigatória da natureza da informação entregue ao usuário. */
export type StatementKind = "fato" | "calculo" | "tendencia" | "previsao";
