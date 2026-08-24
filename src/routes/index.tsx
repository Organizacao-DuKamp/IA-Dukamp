import { createFileRoute } from "@tanstack/react-router";
import "../landing.css";

const whatsappUrl =
  "https://wa.me/5517992256069?text=Ol%C3%A1%2C%20quero%20conhecer%20a%20TPEC-IA%2C%20a%20IA%20do%20Boi.";

const features = [
  "Manejo e organização do rebanho",
  "Nutrição e suplementação",
  "Pastagens e planejamento para a seca",
  "Reprodução e indicadores do lote",
  "Sanidade com orientação responsável",
  "Cotações e inteligência de mercado",
  "Informações sobre soluções DuKamp",
  "Análise de fotos, áudios e documentos",
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TPEC-IA — IA do Boi" },
      {
        name: "description",
        content:
          "A inteligência artificial especialista em pecuária. Manejo, nutrição, pastagens, reprodução, sanidade, gestão e mercado direto no WhatsApp.",
      },
      { property: "og:title", content: "TPEC-IA — IA do Boi" },
      {
        property: "og:description",
        content: "Inteligência artificial para o dia a dia da pecuária, direto no WhatsApp.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/og.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "TPEC-IA — IA do Boi" },
      {
        name: "twitter:description",
        content: "Inteligência artificial para o dia a dia da pecuária, direto no WhatsApp.",
      },
      { name: "twitter:image", content: "/og.png" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: LandingPage,
});

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}

function WhatsappIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M20.5 11.8a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.3-4.3a8.5 8.5 0 1 1 15.7-4.4Z" />
      <path d="M8.2 7.7c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.8 2c.1.3 0 .5-.2.7l-.6.8c-.2.2-.1.4 0 .6.6 1.1 1.5 2 2.6 2.6.2.1.4.2.6 0l.8-1c.2-.2.4-.3.7-.2l2 .9c.3.1.4.3.4.5 0 .4-.2 1.3-.7 1.8-.5.5-1.3.8-2.2.6-1-.2-2.7-.8-4.7-2.5-1.6-1.4-2.7-3.2-3-4.2-.3-1 0-2 .4-2.6Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function LandingPage() {
  return (
    <main className="tpec-landing">
      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="TPEC-IA — início">
          <img src="/tpec-logo.png" alt="" />
          <span>
            <strong>TPEC-IA</strong>
            <small>IA DO BOI</small>
          </span>
        </a>

        <nav aria-label="Navegação principal">
          <a href="#funcoes">O que ela faz</a>
          <a href="#como-funciona">Como funciona</a>
        </nav>

        <a className="header-button" href={whatsappUrl} target="_blank" rel="noreferrer">
          Testar no WhatsApp
          <ArrowIcon />
        </a>
      </header>

      <section className="hero" id="inicio">
        <picture className="hero-art" aria-hidden="true">
          <source media="(max-width: 700px)" srcSet="/tpec-mobile.png" />
          <img src="/tpec-hero.png" alt="" />
        </picture>
        <div className="hero-photo" aria-hidden="true" />
        <div className="hero-content">
          <span className="hero-badge">
            <i />
            TPEC-IA — IA DO BOI
          </span>
          <h1>
            Todo o conhecimento da pecuária.
            <em>No seu WhatsApp.</em>
          </h1>
          <p>
            Tire dúvidas sobre o rebanho, entenda o mercado e encontre respostas técnicas em uma
            conversa simples, rápida e feita para quem vive o campo.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href={whatsappUrl} target="_blank" rel="noreferrer">
              <WhatsappIcon />
              Falar com a IA do Boi
              <ArrowIcon />
            </a>
            <a className="secondary-link" href="#funcoes">
              Conhecer as funções
              <ArrowIcon />
            </a>
          </div>
          <div className="media-types" aria-label="Formas de conversar">
            <span>Texto</span>
            <span>Áudio</span>
            <span>Foto</span>
            <span>Documento</span>
          </div>
        </div>
      </section>

      <section className="functions" id="funcoes">
        <div className="section-intro">
          <span className="section-tag">O QUE ELA FAZ</span>
          <h2>Uma especialista para o dia a dia da pecuária.</h2>
          <p>
            Pergunte do seu jeito. A TPEC-IA entende o contexto e organiza a resposta para ajudar
            você a tomar uma decisão mais bem informada.
          </p>
        </div>

        <div className="functions-layout">
          <div className="feature-list">
            {features.map((feature) => (
              <div className="feature-item" key={feature}>
                <span>
                  <CheckIcon />
                </span>
                <p>{feature}</p>
              </div>
            ))}
          </div>

          <div className="chat-card" aria-label="Exemplo de conversa com a TPEC-IA">
            <div className="chat-header">
              <img src="/tpec-logo.png" alt="" />
              <div>
                <strong>TPEC-IA</strong>
                <small>
                  <i /> Especialista em pecuária
                </small>
              </div>
            </div>
            <div className="chat-content">
              <div className="message user">
                O que devo avaliar antes de escolher um suplemento para a seca?
                <time>09:41</time>
              </div>
              <div className="message bot">
                Avalie a categoria e o peso dos animais, a disponibilidade do pasto, a meta de ganho
                e o consumo esperado. Com esses dados, a comparação fica muito mais segura.
                <time>09:41 ✓</time>
              </div>
            </div>
            <a href={whatsappUrl} target="_blank" rel="noreferrer">
              Faça sua pergunta
              <ArrowIcon />
            </a>
          </div>
        </div>
      </section>

      <section className="how" id="como-funciona">
        <div className="how-heading">
          <span className="section-tag">SIMPLES ASSIM</span>
          <h2>Sem baixar aplicativo.</h2>
        </div>
        <ol>
          <li>
            <b>1</b>
            <div>
              <strong>Chame no WhatsApp</strong>
              <p>Abra a conversa com a TPEC-IA.</p>
            </div>
          </li>
          <li>
            <b>2</b>
            <div>
              <strong>Conte sua dúvida</strong>
              <p>Envie texto, áudio, foto ou documento.</p>
            </div>
          </li>
          <li>
            <b>3</b>
            <div>
              <strong>Receba apoio</strong>
              <p>Continue perguntando até entender.</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="final-cta">
        <div>
          <span className="section-tag">COMECE AGORA</span>
          <h2>Sua próxima resposta está a uma mensagem de distância.</h2>
        </div>
        <a className="primary-button" href={whatsappUrl} target="_blank" rel="noreferrer">
          <WhatsappIcon />
          Conversar no WhatsApp
          <ArrowIcon />
        </a>
      </section>

      <footer>
        <a className="brand footer-brand" href="#inicio">
          <img src="/tpec-logo.png" alt="Logo da TPEC-IA" />
          <span>
            <strong>TPEC-IA</strong>
            <small>IA DO BOI</small>
          </span>
        </a>
        <p>© 2026 TPEC-IA. Inteligência artificial para o dia a dia da pecuária.</p>
        <div className="footer-links">
          <a href="/politica-de-privacidade">Privacidade</a>
          <a href="/termos-de-uso">Termos de uso</a>
          <a href="/exclusao-de-dados">Exclusão de dados</a>
        </div>
      </footer>

      <a className="mobile-whatsapp" href={whatsappUrl} target="_blank" rel="noreferrer">
        <WhatsappIcon />
        Falar com a IA
      </a>
    </main>
  );
}
