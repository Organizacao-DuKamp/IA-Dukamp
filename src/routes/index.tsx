import { createFileRoute } from "@tanstack/react-router";
import "../landing.css";

const whatsappUrl =
  "https://wa.me/5516992256069?text=Ol%C3%A1%2C%20quero%20conhecer%20a%20TPEC-IA%2C%20a%20IA%20do%20Boi.";

const whatsappReferenceImage = "/tpec-whatsapp-reference.webp";
const heroBullPhoto = "/tpec-hero-bull.webp";

const cattlePhoto =
  "https://images.pexels.com/photos/28410820/pexels-photo-28410820.jpeg?auto=compress&cs=tinysrgb&w=900";
const dairyPhoto =
  "https://images.pexels.com/photos/30982514/pexels-photo-30982514/free-photo-of-holstein-cow-grazing-in-sunny-pasture.jpeg?auto=compress&cs=tinysrgb&w=900";
const horsePhoto =
  "https://images.pexels.com/photos/19575508/pexels-photo-19575508.jpeg?auto=compress&cs=tinysrgb&w=900";
const sheepPhoto =
  "https://images.pexels.com/photos/33950400/pexels-photo-33950400.jpeg?auto=compress&cs=tinysrgb&w=900";
const pigPhoto =
  "https://images.pexels.com/photos/110820/pexels-photo-110820.jpeg?auto=compress&cs=tinysrgb&w=900";
const chickenPhoto =
  "https://images.pexels.com/photos/35641002/pexels-photo-35641002.jpeg?auto=compress&cs=tinysrgb&w=900";
const fishPhoto =
  "https://images.pexels.com/photos/15059730/pexels-photo-15059730.jpeg?auto=compress&cs=tinysrgb&w=900";
const cattleWide =
  "https://images.pexels.com/photos/31026900/pexels-photo-31026900/free-photo-of-close-up-of-nelore-cattle-in-sao-paulo-pasture.jpeg?auto=compress&cs=tinysrgb&w=1400";
const herdWide =
  "https://images.pexels.com/photos/33206150/pexels-photo-33206150/free-photo-of-herd-of-cattle-grazing-in-brazilian-pasture.png?auto=compress&cs=tinysrgb&w=1400";
const aerialWide =
  "https://images.pexels.com/photos/10251994/pexels-photo-10251994.jpeg?auto=compress&cs=tinysrgb&w=1400";

const benefits = [
  { icon: "camera", title: "Análise por foto", text: "Envie fotos e use a imagem como parte da análise da TPEC-IA." },
  { icon: "clock", title: "Respostas rápidas", text: "Informações organizadas para você entender o cenário com agilidade." },
  { icon: "shield", title: "Decisões mais seguras", text: "Mais contexto e pontos de atenção para apoiar a tomada de decisão." },
  { icon: "chart", title: "Tecnologia no campo", text: "Inteligência artificial aplicada à rotina da fazenda, sem complicação." },
];

type Area = { title: string; image: string; text: string; imagePosition?: string };\n\nconst areas: Area[] = [
  { title: "Bovinos de corte", image: cattlePhoto, text: "Manejo, pasto, ganho de peso e suplementação.", imagePosition: "58% 50%" },
  { title: "Bovinos de leite", image: dairyPhoto, text: "Alimentação, rotina do rebanho e produtividade.", imagePosition: "50% 72%" },
  { title: "Equinos", image: horsePhoto, text: "Condição corporal, manejo e cuidados gerais." },
  { title: "Ovinos e caprinos", image: sheepPhoto, text: "Nutrição, reprodução e rotina de manejo." },
  { title: "Suínos", image: pigPhoto, text: "Ambiência, alimentação e desempenho.", imagePosition: "56% 50%" },
  { title: "Aves", image: chickenPhoto, text: "Manejo, sanidade, consumo e ambiência." },
  { title: "Piscicultura", image: fishPhoto, text: "Qualidade da água, manejo e alimentação." },
];

const useCases = [
  { title: "Analise este animal.", icon: "cow", image: cattlePhoto },
  { title: "Como está a condição deste pasto?", icon: "leaf", image: cattleWide },
  { title: "Esta dieta está adequada?", icon: "feed", image: dairyPhoto },
  { title: "O que devo observar neste caso?", icon: "eye", image: cattleWide },
];

const faqs = [
  { question: "Precisa instalar aplicativo?", answer: "Não. A experiência principal da TPEC-IA funciona pelo WhatsApp, sem exigir um aplicativo novo para começar." },
  { question: "Posso mandar foto e áudio?", answer: "Sim. Você pode conversar por texto, áudio e foto, além de enviar documentos quando precisar dar mais contexto." },
  { question: "Serve apenas para bovinos?", answer: "O foco principal é a pecuária bovina, mas a TPEC-IA também apoia dúvidas sobre equinos, ovinos, caprinos, suínos, aves e piscicultura." },
  { question: "A TPEC-IA substitui veterinário, zootecnista ou agrônomo?", answer: "Não. A TPEC-IA é uma ferramenta de apoio. Situações clínicas, emergenciais ou que dependam de diagnóstico precisam de avaliação profissional." },
];

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://iadoboi.com.br/#organization",
      name: "IA do Boi",
      alternateName: "TPEC-IA",
      url: "https://iadoboi.com.br/",
      logo: {
        "@type": "ImageObject",
        url: "https://iadoboi.com.br/tpec-logo.png",
      },
    },
    {
      "@type": "WebSite",
      "@id": "https://iadoboi.com.br/#website",
      url: "https://iadoboi.com.br/",
      name: "IA do Boi",
      alternateName: "TPEC-IA",
      inLanguage: "pt-BR",
      publisher: { "@id": "https://iadoboi.com.br/#organization" },
    },
  ],
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IA do Boi — Inteligência Artificial para Pecuária" },
      {
        name: "description",
        content:
          "IA do Boi é uma inteligência artificial para pecuária e gado. Tire dúvidas, envie fotos e receba apoio sobre manejo, nutrição, pastagens e mais pelo WhatsApp.",
      },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" },
      { name: "googlebot", content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" },
      { property: "og:title", content: "IA do Boi — Inteligência Artificial para Pecuária" },
      {
        property: "og:description",
        content:
          "Inteligência artificial para pecuária e gado, com respostas práticas, análise por foto e apoio para a rotina do campo pelo WhatsApp.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://iadoboi.com.br/" },
      { property: "og:site_name", content: "IA do Boi" },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:image", content: "https://iadoboi.com.br/og.png" },
      { property: "og:image:alt", content: "IA do Boi — inteligência artificial para pecuária" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "IA do Boi — Inteligência Artificial para Pecuária" },
      {
        name: "twitter:description",
        content: "IA para pecuária e gado, com respostas e análise por foto direto no WhatsApp.",
      },
      { name: "twitter:image", content: "https://iadoboi.com.br/og.png" },
    ],
    links: [{ rel: "canonical", href: "https://iadoboi.com.br/" }],
  }),
  component: LandingPage,
});

function ArrowIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6" /></svg>;
}

function WhatsappIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M20.4 11.8a8.4 8.4 0 0 1-12.5 7.3l-4.4 1.4 1.3-4.3a8.4 8.4 0 1 1 15.6-4.4Z" />
      <path d="M8.2 7.7c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.8 2c.1.3 0 .5-.2.7l-.6.8c-.2.2-.1.4 0 .6.6 1.1 1.5 2 2.6 2.6.2.1.4.2.6 0l.8-1c.2-.2.4-.3.7-.2l2 .9c.3.1.4.3.4.5 0 .4-.2 1.3-.7 1.8-.5.5-1.3.8-2.2.6-1-.2-2.7-.8-4.7-2.5-1.6-1.4-2.7-3.2-3-4.2-.3-1 0-2 .4-2.6Z" />
    </svg>
  );
}

function SparkIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m12 3 1.2 4.1L17 8.5l-3.8 1.4L12 14l-1.2-4.1L7 8.5l3.8-1.4zM18.5 14l.8 2.6 2.7.9-2.7.9-.8 2.6-.8-2.6-2.7-.9 2.7-.9z" /></svg>;
}

function CheckIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /></svg>;
}

function FeatureIcon({ name }: { name: string }) {
  if (name === "camera") return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13.5" r="3.2" /></svg>;
  if (name === "clock") return <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2M3 8H1M4 5 2.5 3.5M3 12H1" /></svg>;
  if (name === "shield") return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.6 2.7 8 7 10 4.3-2 7-5.4 7-10V6z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 19V9M10 19V5M15 19v-7M20 19V3" /></svg>;
}

function UseIcon({ name }: { name: string }) {
  if (name === "leaf") return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 4C11 4 5 8 5 15c0 3 2 5 5 5 7 0 10-8 10-16Z" /><path d="M5 20c2-5 6-8 11-11" /></svg>;
  if (name === "feed") return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 9h16l-2 10H6zM7 9l2-4h6l2 4" /><path d="M9 13h6" /></svg>;
  if (name === "eye") return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5Z" /><circle cx="12" cy="12" r="2.5" /></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 10c0-4 3-6 7-6s7 2 7 6v6c0 2-1.5 4-4 4h-6c-2.5 0-4-2-4-4z" /><path d="M8 9h.01M16 9h.01M9 15c2 1 4 1 6 0" /></svg>;
}

function HeroScanIcon({ name }: { name: "management" | "nutrition" | "condition" }) {
  if (name === "nutrition") {
    return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 4C11 4 5 8 5 15c0 3 2 5 5 5 7 0 10-8 10-16Z" /><path d="M5 20c2-5 6-8 11-11" /></svg>;
  }

  if (name === "condition") {
    return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20.8 5.8a5.2 5.2 0 0 0-7.4 0L12 7.2l-1.4-1.4a5.2 5.2 0 1 0-7.4 7.4L12 22l8.8-8.8a5.2 5.2 0 0 0 0-7.4Z" /><path d="M5.5 13h3l1.5-3 3 6 1.5-3h4" /></svg>;
  }

  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 20h16M6 17v-5M11 17V7M16 17V4" /><path d="m5 9 5-4 5 2 4-4" /></svg>;
}

function BrandSeal({ small = false }: { small?: boolean }) {
  return <span className={small ? "brand-seal brand-seal-small" : "brand-seal"} aria-hidden="true"><img src="/tpec-logo.png" alt="" /></span>;
}

function LandingPage() {
  return (
    <main className="tpec-landing">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="IA do Boi — início">
          <img src="/tpec-logo.png" alt="" />
          <span><strong>TPEC-IA</strong><small>INTELIGÊNCIA ARTIFICIAL DA PECUÁRIA</small></span>
        </a>
        <nav aria-label="Navegação principal">
          <a href="#whatsapp">WhatsApp</a><a href="#analise">Análise por foto</a><a href="#como-funciona">Como funciona</a><a href="#beneficios">Benefícios</a><a href="#areas">Áreas</a>
        </nav>
        <a className="header-cta" href={whatsappUrl} target="_blank" rel="noreferrer">Testar no WhatsApp <ArrowIcon /></a>
      </header>

      <section className="poster poster-hero" id="inicio">
        <div className="poster-swoosh" aria-hidden="true" />
        <div className="hero-copy reference-copy">
          <span className="reference-kicker">IA DO BOI • INTELIGÊNCIA ARTIFICIAL PARA PECUÁRIA</span>
          <h1>CAMPO +<br />INTELIGÊNCIA</h1>
          <span className="gold-divider" aria-hidden="true"><i /></span>
          <h2>Tecnologia criada para quem está na lida.</h2>
          <p>A IA do Boi usa inteligência artificial para apoiar a rotina da pecuária e do gado, transformando informações em decisões mais claras, práticas e estratégicas no campo.</p>
          <div className="hero-mini-grid">
            {benefits.map((item) => <span key={item.title}><i><FeatureIcon name={item.icon} /></i><b>{item.title}</b></span>)}
          </div>
          <div className="hero-actions">
            <a className="reference-button" href={whatsappUrl} target="_blank" rel="noreferrer"><WhatsappIcon /> CONVERSAR COM A TPEC-IA</a>
            <a className="outline-button" href="#como-funciona">VER COMO FUNCIONA <ArrowIcon /></a>
          </div>
        </div>
        <div className="hero-photo reference-photo">
          <img src={heroBullPhoto} alt="Touro Nelore forte em pastagem" fetchPriority="high" />
          <div className="photo-fade" aria-hidden="true" />
          <BrandSeal />
          <span className="scan-label scan-a">
            <span className="scan-icon"><HeroScanIcon name="management" /></span><b>MANEJO</b><span className="scan-connector" aria-hidden="true" />
          </span>
          <span className="scan-label scan-b">
            <span className="scan-icon"><HeroScanIcon name="nutrition" /></span><b>NUTRIÇÃO</b><span className="scan-connector" aria-hidden="true" />
          </span>
          <span className="scan-label scan-c">
            <span className="scan-icon"><HeroScanIcon name="condition" /></span><b>CONDIÇÃO<br />CORPORAL</b><span className="scan-connector" aria-hidden="true" />
          </span>
        </div>
      </section>

      <section className="poster poster-whatsapp poster-whatsapp-adapted" id="whatsapp">
        <div className="poster-swoosh" aria-hidden="true" />
        <div className="whatsapp-copy reference-copy">
          <BrandSeal small />
          <span className="gold-title">WHATSAPP<br />DA TPEC-IA</span>
          <h2>A TPEC-IA vai com<br />você para o campo.</h2>
          <p>Tire dúvidas, envie fotos e receba orientações técnicas direto pelo WhatsApp. Prático, rápido e feito para o pecuarista.</p>
          <a className="reference-button whatsapp-big" href={whatsappUrl} target="_blank" rel="noreferrer"><WhatsappIcon /> CONVERSAR COM A TPEC-IA</a>
        </div>

        <div className="whatsapp-phone" aria-label="Exemplo de conversa com a TPEC-IA no WhatsApp">
          <div className="phone-status" aria-hidden="true">
            <span>11:30</span><i /><span className="phone-signals">▮ ▰ ●</span>
          </div>
          <div className="phone-header">
            <span className="phone-back" aria-hidden="true">‹</span>
            <img src="/tpec-logo.png" alt="" />
            <span className="phone-contact"><strong>TPEC IA</strong><small>online</small></span>
            <span className="phone-actions" aria-hidden="true">⌕ ⋮</span>
          </div>
          <div className="phone-body">
            <div className="bubble incoming"><b>Produtor</b><p>Estou com uma dúvida sobre meu gado. Posso mandar uma foto?</p><time>11:28</time></div>
            <div className="bubble outgoing"><b>TPEC IA</b><p>Claro. Envie a foto e me conte o que você observou.</p><time>11:29 ✓✓</time></div>
            <div className="phone-photo phone-reference-crop"><img src={whatsappReferenceImage} alt="Bovino enviado para análise" loading="lazy" /></div>
            <div className="bubble outgoing compact-bubble phone-guidance"><b>TPEC IA</b><p>Obrigado pela foto. Pelo que foi observado, recomendamos:</p><ul><li>Verificar o manejo nutricional;</li><li>Observar presença de carrapatos;</li><li>Acompanhar a condição corporal.</li></ul><p>Qualquer mudança, me avise!</p><time>11:31 ✓✓</time></div>
          </div>
          <div className="phone-composer" aria-hidden="true"><span>☺&nbsp;&nbsp; Mensagem</span><i>⌕ ◉ ●</i></div>
        </div>

        <div className="whatsapp-field reference-photo">
          <img className="whatsapp-field-reference" src={whatsappReferenceImage} alt="Pecuarista usando o celular ao lado de um bovino no campo" loading="lazy" />
          <div className="photo-fade left-fade" aria-hidden="true" />
        </div>
      </section>

      <section className="poster poster-analysis" id="analise">
        <div className="analysis-field reference-photo"><img src={herdWide} alt="Bovinos em pastagem" loading="lazy" /><div className="photo-fade right-fade" aria-hidden="true" /></div>
        <div className="analysis-phone" aria-label="Painel de análise por foto">
          <div className="analysis-top"><SparkIcon /> <span>Analisando imagem...</span></div>
          <div className="analysis-cow-photo"><img src={cattlePhoto} alt="Bovino analisado pela TPEC-IA" loading="lazy" /><i className="focus top-left" /><i className="focus top-right" /><i className="focus bottom-left" /><i className="focus bottom-right" /></div>
          <div className="analysis-row"><i><FeatureIcon name="chart" /></i><span><b>Condição corporal</b><small>Boa cobertura aparente. Avaliar no contexto do lote.</small></span></div>
          <div className="analysis-row"><i><UseIcon name="eye" /></i><span><b>Sinais observados</b><small>Sem alterações visíveis relevantes na imagem.</small></span></div>
          <div className="analysis-row"><i><FeatureIcon name="shield" /></i><span><b>Pontos de atenção</b><small>Acompanhar evolução e manejo nutricional.</small></span></div>
          <div className="analysis-row"><i><SparkIcon /></i><span><b>Orientação</b><small>Acrescente idade, objetivo e histórico para aprofundar.</small></span></div>
          <p className="analysis-disclaimer">Análise por IA como apoio à decisão. Não substitui avaliação técnica presencial.</p>
        </div>
        <div className="analysis-copy reference-copy">
          <BrandSeal small />
          <span className="gold-title">ANÁLISE<br />POR FOTO</span>
          <h2>Mostre o que está acontecendo.<br />A TPEC-IA ajuda você a entender.</h2>
          <p>Envie uma foto do animal, do pasto, do cocho ou de qualquer situação no campo. A TPEC-IA organiza observações práticas para apoiar suas decisões.</p>
          <div className="analysis-features">
            <span><i><FeatureIcon name="camera" /></i><b>Envie sua foto</b><small>Animal, pasto, cocho ou situação de campo.</small></span>
            <span><i><SparkIcon /></i><b>IA que analisa</b><small>Identifica informações visuais e organiza o contexto.</small></span>
            <span><i><FeatureIcon name="chart" /></i><b>Informações úteis</b><small>Observações e pontos de atenção apresentados com clareza.</small></span>
            <span><i><UseIcon name="eye" /></i><b>Apoio para decidir</b><small>Continue a conversa e aprofunde o cenário.</small></span>
          </div>
        </div>
        <div className="poster-swoosh swoosh-right" aria-hidden="true" />
      </section>

      <section className="poster poster-how" id="como-funciona">
        <div className="how-copy reference-copy">
          <span className="gold-title">COMO FUNCIONA</span>
          <h2>Simples como conversar. Inteligente como precisa ser.</h2>
          <span className="gold-divider wide" aria-hidden="true"><i /></span>
          <div className="reference-steps">
            <article><span><FeatureIcon name="camera" /></span><b>1. FOTOGRAFE</b><p>Tire uma foto do animal, pasto, cocho ou situação que chamou sua atenção.</p></article><i className="step-arrow">→</i>
            <article><span><WhatsappIcon /></span><b>2. PERGUNTE</b><p>Conte o que deseja saber ou descreva sua dúvida como em uma conversa.</p></article><i className="step-arrow">→</i>
            <article><span><SparkIcon /></span><b>3. A IA ANALISA</b><p>A TPEC-IA cruza a imagem e o contexto para organizar uma resposta clara.</p></article><i className="step-arrow">→</i>
            <article><span><CheckIcon /></span><b>4. RECEBA ORIENTAÇÃO</b><p>Use a resposta como apoio para entender o cenário e definir próximos passos.</p></article>
          </div>
          <div className="how-banner"><FeatureIcon name="shield" /><span><b>Tecnologia que entende o campo</b><small>Conhecimento técnico com uma linguagem simples para a rotina do pecuarista.</small></span></div>
        </div>
        <div className="how-field reference-photo">
          <img src={cattleWide} alt="Bovino com apoio de tecnologia" loading="lazy" /><div className="photo-fade left-fade" aria-hidden="true" />
          <div className="scan-board board-one"><b>ANÁLISE CORPORAL</b><span>Musculatura <i style={{ width: "78%" }} /></span><span>Condição <i style={{ width: "68%" }} /></span><span>Estrutura <i style={{ width: "82%" }} /></span></div>
          <div className="scan-board board-two"><b>DESTAQUES</b><span>✓ Potencial do lote</span><span>✓ Conformação</span><span>✓ Rendimento</span></div><BrandSeal />
        </div>
        <div className="poster-swoosh" aria-hidden="true" />
      </section>

      <section className="poster poster-benefits" id="beneficios">
        <div className="benefits-landscape" aria-hidden="true"><img src={cattleWide} alt="" /></div><BrandSeal />
        <div className="benefits-head"><span className="gold-title">BENEFÍCIOS</span><span className="gold-divider wide" aria-hidden="true"><i /></span><h2>Tecnologia simples para o dia a dia da pecuária.</h2></div>
        <div className="reference-benefits-grid">{benefits.map((item) => <article key={item.title}><span className="benefit-round-icon"><FeatureIcon name={item.icon} /></span><i className="card-divider" /><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
        <div className="poster-swoosh" aria-hidden="true" />
      </section>

      <section className="poster poster-areas" id="areas">
        <BrandSeal />
        <div className="areas-head"><span className="gold-title">ÁREAS DA PECUÁRIA</span><span className="gold-divider wide" aria-hidden="true"><i /></span><h2>Soluções inteligentes para cada atividade de campo.</h2><p>Mais contexto para diferentes espécies, rotinas e sistemas de produção.</p></div>
        <div className="reference-areas-grid">{areas.map((area) => <article key={area.title}><div className="area-photo"><img src={area.image} alt={area.title} loading="lazy" style={{ objectPosition: area.imagePosition }} /></div><span className="area-icon"><UseIcon name={area.title.includes("Pisc") ? "eye" : "cow"} /></span><h3>{area.title}</h3><p>{area.text}</p></article>)}</div>
        <div className="poster-swoosh" aria-hidden="true" />
      </section>

      <section className="poster poster-examples">
        <BrandSeal />
        <div className="examples-head"><span className="gold-title">EXEMPLOS DE USO</span><span className="gold-divider wide" aria-hidden="true"><i /></span><h2>Perguntas reais do dia a dia que a TPEC-IA ajuda a responder no campo.</h2></div>
        <div className="reference-use-grid">
          {useCases.map((item, index) => (
            <article key={item.title}>
              <div className="use-photo"><img src={item.image} alt="" loading="lazy" /></div>
              <div className="mini-phone"><div className="mini-phone-top">TPEC-IA <small>analisando</small></div><span><SparkIcon /></span><b>{index === 0 ? "Condição corporal" : index === 1 ? "Condição do pasto" : index === 2 ? "Análise da dieta" : "Pontos de atenção"}</b><p>{index === 0 ? "Avalie cobertura, estrutura e uniformidade." : index === 1 ? "Observe cobertura, vigor e disponibilidade." : index === 2 ? "Compare objetivo, consumo e composição." : "Organize sinais e contexto antes de agir."}</p></div>
              <footer><i><UseIcon name={item.icon} /></i><strong>{item.title}</strong></footer>
            </article>
          ))}
        </div>
        <div className="poster-swoosh" aria-hidden="true" />
      </section>

      <section className="poster poster-responsibility">
        <div className="responsibility-copy reference-copy">
          <BrandSeal small /><span className="reference-kicker">SEGURANÇA E RESPONSABILIDADE</span>
          <h2><i><FeatureIcon name="shield" /></i>Tecnologia<br />com responsabilidade.</h2>
          <div className="responsibility-points">
            <span><i><FeatureIcon name="chart" /></i><b>Apoio à decisão</b><small>Informações confiáveis para escolhas mais assertivas no campo.</small></span>
            <span><i><SparkIcon /></i><b>Situações críticas exigem avaliação profissional</b><small>A IA orienta, mas a decisão final é sempre sua e do profissional responsável.</small></span>
            <span><i><UseIcon name="cow" /></i><b>Bem-estar em primeiro lugar</b><small>Manejo responsável para animais saudáveis e produtivos.</small></span>
            <span><i><FeatureIcon name="shield" /></i><b>Segurança da informação</b><small>Seus dados são tratados com privacidade e responsabilidade.</small></span>
          </div>
        </div>
        <div className="responsibility-field reference-photo"><img src={aerialWide} alt="Rebanho em área de produção" loading="lazy" /><div className="photo-fade left-fade" aria-hidden="true" /></div>
        <div className="poster-swoosh" aria-hidden="true" />
      </section>

      <section className="faq-section" id="duvidas">
        <div className="faq-heading"><span className="reference-kicker">DÚVIDAS FREQUENTES</span><h2>O que você precisa saber antes de começar.</h2><p>Se ainda tiver uma pergunta, fale com a TPEC-IA pelo WhatsApp e teste a experiência.</p></div>
        <div className="faq-list">{faqs.map((faq) => <details key={faq.question}><summary>{faq.question}<span>+</span></summary><p>{faq.answer}</p></details>)}</div>
      </section>

      <section className="final-cta">
        <BrandSeal /><div><span className="reference-kicker">CAMPO + INTELIGÊNCIA</span><h2>Leve a TPEC-IA para a sua rotina.</h2><p>Comece uma conversa agora e descubra como a inteligência artificial pode apoiar o seu dia no campo.</p></div>
        <a className="reference-button" href={whatsappUrl} target="_blank" rel="noreferrer"><WhatsappIcon /> CONVERSAR NO WHATSAPP <ArrowIcon /></a>
      </section>

      <footer className="site-footer">
        <a className="footer-brand" href="#inicio"><img src="/tpec-logo.png" alt="" /><span><strong>TPEC-IA</strong><small>INTELIGÊNCIA ARTIFICIAL DA PECUÁRIA</small></span></a>
        <p>Informação para apoiar decisões no campo. Use com responsabilidade.</p>
        <nav aria-label="Links legais"><a href="/politica-de-privacidade">Privacidade</a><a href="/termos-de-uso">Termos de uso</a></nav>
      </footer>
    </main>
  );
}
