import { createFileRoute } from "@tanstack/react-router";
import "../landing.css";
import "../landing-contrast.css";

const whatsappUrl =
  "https://wa.me/5516992256069?text=Ol%C3%A1%2C%20quero%20conhecer%20a%20TPEC-IA%2C%20a%20IA%20do%20Boi.";

const heroPhoto =
  "https://images.pexels.com/photos/33206150/pexels-photo-33206150/free-photo-of-herd-of-cattle-grazing-in-brazilian-pasture.png?auto=compress&cs=tinysrgb&w=1800";
const analysisPhoto =
  "https://images.pexels.com/photos/31026900/pexels-photo-31026900/free-photo-of-close-up-of-nelore-cattle-in-sao-paulo-pasture.jpeg?auto=compress&cs=tinysrgb&w=900";
const aerialPhoto =
  "https://images.pexels.com/photos/10251994/pexels-photo-10251994.jpeg?auto=compress&cs=tinysrgb&w=1600";

const features = [
  {
    title: "Análise por foto",
    text: "Envie imagens do rebanho, cocho, pasto ou situação de campo e receba pontos de atenção organizados.",
  },
  {
    title: "Nutrição e suplementação",
    text: "Compare cenários, organize informações e entenda melhor consumo, objetivos e estratégias nutricionais.",
  },
  {
    title: "Manejo do rebanho",
    text: "Apoio para lotes, rotina, ganho de peso, reprodução, pastagens e decisões do dia a dia.",
  },
  {
    title: "Sanidade com responsabilidade",
    text: "Ajuda a organizar sinais observados e próximos passos, sem substituir a avaliação de um profissional habilitado.",
  },
  {
    title: "Clima e mercado",
    text: "Pergunte sobre previsão do tempo, contexto regional, cotações e informações úteis para o planejamento.",
  },
  {
    title: "Texto, áudio e documentos",
    text: "Converse do jeito mais fácil para você. A TPEC-IA recebe diferentes formatos dentro da mesma experiência.",
  },
];

const modules = [
  "Bovinos de corte",
  "Gado de leite",
  "Equinos",
  "Ovinos e caprinos",
  "Suínos",
  "Aves",
  "Piscicultura",
];

const faqs = [
  {
    question: "Precisa instalar aplicativo?",
    answer:
      "Não. A proposta principal da TPEC-IA é funcionar direto pelo WhatsApp, sem exigir um novo aplicativo para começar.",
  },
  {
    question: "Funciona por áudio e texto?",
    answer:
      "Sim. Você pode escrever ou mandar áudio. A ideia é conversar do jeito que já faz no dia a dia.",
  },
  {
    question: "Posso mandar foto?",
    answer:
      "Sim. A análise por foto é um dos diferenciais da TPEC-IA. Você pode enviar uma imagem e pedir ajuda para interpretar o que está vendo no campo.",
  },
  {
    question: "Serve só para bovinos?",
    answer:
      "O foco principal é a pecuária bovina, mas a TPEC-IA também pode apoiar dúvidas sobre outras atividades do campo, como equinos, ovinos, caprinos, suínos, aves e piscicultura.",
  },
  {
    question: "A IA substitui veterinário, zootecnista ou agrônomo?",
    answer:
      "Não. A TPEC-IA apoia entendimento, organização de informações e tomada de decisão. Situações clínicas, emergenciais ou que exijam diagnóstico devem ser avaliadas por um profissional habilitado.",
  },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TPEC-IA — IA do Boi" },
      {
        name: "description",
        content:
          "Inteligência artificial para a pecuária, direto no WhatsApp. Envie dúvidas, áudios, fotos e documentos e receba apoio prático para o dia a dia do campo.",
      },
      { property: "og:title", content: "TPEC-IA — IA do Boi" },
      {
        property: "og:description",
        content: "A inteligência da pecuária no seu WhatsApp, com análise por foto e apoio prático para o campo.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/og.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "TPEC-IA — IA do Boi" },
      {
        name: "twitter:description",
        content: "A inteligência da pecuária no seu WhatsApp.",
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

function CameraIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 8.5h3l1.4-2h7.2l1.4 2h3v10H4z" />
      <circle cx="12" cy="13.5" r="3.2" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m12 3 1.2 4.1L17 8.5l-3.8 1.4L12 14l-1.2-4.1L7 8.5l3.8-1.4zM18.5 14l.8 2.6L22 17.5l-2.7.9-.8 2.6-.8-2.6-2.7-.9 2.7-.9zM5.5 13l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7z" />
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
          <a href="#sobre">Sobre</a>
          <a href="#como-funciona">Como funciona</a>
          <a href="#recursos">Recursos</a>
          <a href="#duvidas">Dúvidas</a>
        </nav>

        <a className="header-button" href={whatsappUrl} target="_blank" rel="noreferrer">
          Testar no WhatsApp
          <ArrowIcon />
        </a>
      </header>

      <section className="hero" id="inicio">
        <picture className="hero-art" aria-hidden="true">
          <img src={heroPhoto} alt="" fetchPriority="high" />
        </picture>
        <div className="hero-overlay" aria-hidden="true" />

        <div className="hero-layout">
          <div className="hero-content">
            <span className="eyebrow light">
              <i /> Inteligência feita para quem vive o campo
            </span>
            <h1>
              Pergunte. Envie uma foto.
              <em>Decida com mais clareza.</em>
            </h1>
            <p>
              A TPEC-IA coloca conhecimento da pecuária dentro do seu WhatsApp. Tire dúvidas,
              envie áudios, fotos e documentos e receba respostas claras para o dia a dia da fazenda.
            </p>
            <div className="hero-actions">
              <a className="primary-button" href={whatsappUrl} target="_blank" rel="noreferrer">
                <WhatsappIcon />
                Falar com a IA do Boi
                <ArrowIcon />
              </a>
              <a className="ghost-button" href="#como-funciona">
                Ver como funciona
                <ArrowIcon />
              </a>
            </div>
            <div className="hero-proof">
              <span>Sem novo aplicativo</span>
              <span>Texto, áudio e foto</span>
              <span>Conversa simples</span>
            </div>
          </div>

          <div className="phone-demo" aria-label="Exemplo de análise por foto no WhatsApp">
            <div className="phone-topbar">
              <img src="/tpec-logo.png" alt="" />
              <div>
                <strong>TPEC-IA</strong>
                <small>online • especialista em pecuária</small>
              </div>
            </div>
            <div className="phone-chat">
              <div className="photo-message">
                <img
                  src={analysisPhoto}
                  alt="Nelore em pastagem usado como exemplo de análise visual"
                  loading="lazy"
                />
                <p>O que você observa nessa condição corporal?</p>
                <time>09:41</time>
              </div>
              <div className="ai-message">
                <span className="ai-label">
                  <SparkIcon /> análise visual
                </span>
                <p>
                  Pela imagem, eu começaria observando cobertura de costelas, linha de dorso e
                  uniformidade do lote. Posso te ajudar a montar uma avaliação por etapas.
                </p>
                <time>09:41 ✓</time>
              </div>
            </div>
            <div className="phone-input">
              <span>Mensagem</span>
              <CameraIcon />
            </div>
          </div>
        </div>
      </section>

      <section className="trust-strip" aria-label="Diferenciais rápidos">
        <div><strong>WhatsApp</strong><span>onde você já conversa</span></div>
        <div><strong>Multimodal</strong><span>texto, áudio, foto e documento</span></div>
        <div><strong>Campo + IA</strong><span>tecnologia sem complicação</span></div>
        <div><strong>24/7</strong><span>apoio quando a dúvida aparecer</span></div>
      </section>

      <section className="about" id="sobre">
        <div className="section-heading center">
          <span className="eyebrow">ANTES X AGORA</span>
          <h2>Menos informação espalhada. Mais resposta útil.</h2>
          <p>
            A TPEC-IA foi pensada para transformar dúvidas do campo em uma conversa simples,
            contextual e fácil de continuar.
          </p>
        </div>

        <div className="before-after">
          <article className="comparison-card muted-card">
            <span className="comparison-label">Antes</span>
            <h3>Procurar em vários lugares</h3>
            <ul>
              <li><CheckIcon /> Caderno e anotações soltas</li>
              <li><CheckIcon /> Grupos e mensagens antigas</li>
              <li><CheckIcon /> Vídeos e buscas sem contexto</li>
              <li><CheckIcon /> Dificuldade para comparar informações</li>
            </ul>
          </article>

          <article className="comparison-card tpec-card">
            <span className="comparison-label">Com a TPEC-IA</span>
            <h3>Uma conversa que entende sua dúvida</h3>
            <ul>
              <li><CheckIcon /> Pergunte do seu jeito</li>
              <li><CheckIcon /> Envie foto ou áudio na mesma conversa</li>
              <li><CheckIcon /> Continue perguntando até entender</li>
              <li><CheckIcon /> Receba respostas organizadas e objetivas</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="visual-section">
        <div className="visual-media">
          <img src={aerialPhoto} alt="Rebanho visto de cima em área de pastagem" loading="lazy" />
          <div className="scan-frame" aria-hidden="true">
            <span>ANÁLISE VISUAL</span>
            <i className="corner one" />
            <i className="corner two" />
            <i className="corner three" />
            <i className="corner four" />
          </div>
        </div>
        <div className="visual-copy">
          <span className="eyebrow light">UM DIFERENCIAL QUE VOCÊ VÊ</span>
          <h2>Mostre o que está acontecendo no campo.</h2>
          <p>
            Nem toda dúvida cabe em uma frase. Envie uma foto do animal, do lote, do cocho ou da
            pastagem e use a imagem como parte da conversa.
          </p>
          <div className="visual-points">
            <span><CheckIcon /> Pontos de atenção na imagem</span>
            <span><CheckIcon /> Perguntas complementares para dar contexto</span>
            <span><CheckIcon /> Orientação clara sobre próximos passos</span>
          </div>
          <small>
            A análise por IA é apoio informativo e não substitui diagnóstico ou atendimento de um
            profissional habilitado.
          </small>
          <a className="text-link light-link" href={whatsappUrl} target="_blank" rel="noreferrer">
            Quero testar com uma foto <ArrowIcon />
          </a>
        </div>
      </section>

      <section className="how" id="como-funciona">
        <div className="section-heading">
          <span className="eyebrow">COMO FUNCIONA</span>
          <h2>Do problema à orientação em quatro passos.</h2>
        </div>
        <ol className="steps">
          <li>
            <b>01</b>
            <h3>Envie sua dúvida</h3>
            <p>Escreva, grave um áudio, mande uma foto ou anexe um documento.</p>
          </li>
          <li>
            <b>02</b>
            <h3>A IA entende o contexto</h3>
            <p>A TPEC-IA organiza o que você enviou e identifica o que precisa ser aprofundado.</p>
          </li>
          <li>
            <b>03</b>
            <h3>Receba uma resposta clara</h3>
            <p>Sem linguagem desnecessariamente complicada e com foco no que é útil para a decisão.</p>
          </li>
          <li>
            <b>04</b>
            <h3>Continue a conversa</h3>
            <p>Faça novas perguntas, compare opções e aprofunde a situação no mesmo WhatsApp.</p>
          </li>
        </ol>
      </section>

      <section className="use-cases">
        <div className="section-heading center">
          <span className="eyebrow">NA PRÁTICA</span>
          <h2>Perguntas reais do dia a dia. Respostas que ajudam a avançar.</h2>
        </div>
        <div className="conversation-grid">
          <article className="conversation-card">
            <span className="conversation-type">Nutrição</span>
            <div className="bubble user-bubble">Tenho 35 garrotes e o pasto caiu muito. O que preciso levantar antes de escolher o suplemento?</div>
            <div className="bubble bot-bubble">Comece por peso médio, disponibilidade e qualidade do pasto, meta de ganho e consumo esperado. Se quiser, montamos essa comparação juntos.</div>
          </article>
          <article className="conversation-card featured-conversation">
            <span className="conversation-type">Foto</span>
            <div className="mini-photo"><img src={analysisPhoto} alt="Nelore em pastagem" loading="lazy" /></div>
            <div className="bubble user-bubble">Você consegue me ajudar a avaliar esse lote?</div>
            <div className="bubble bot-bubble">Sim. Posso organizar uma avaliação visual e te dizer quais informações adicionais ajudariam a interpretar melhor a situação.</div>
          </article>
          <article className="conversation-card">
            <span className="conversation-type">Planejamento</span>
            <div className="bubble user-bubble">Vai chover na minha região nos próximos dias? Isso muda algo no manejo do pasto?</div>
            <div className="bubble bot-bubble">Me diga o município. Com a localização, eu consigo contextualizar a previsão e discutir os impactos práticos no manejo.</div>
          </article>
        </div>
      </section>

      <section className="resources" id="recursos">
        <div className="section-heading split-heading">
          <div>
            <span className="eyebrow">RECURSOS</span>
            <h2>Uma IA para acompanhar a rotina da fazenda.</h2>
          </div>
          <p>
            Não é só responder perguntas. A proposta é reunir diferentes tipos de apoio em uma
            experiência única e fácil de usar.
          </p>
        </div>
        <div className="feature-grid">
          {features.map((feature, index) => (
            <article className="feature-card" key={feature.title}>
              <span className="feature-number">0{index + 1}</span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="modules">
        <div className="modules-copy">
          <span className="eyebrow light">MAIS DO QUE UMA ÚNICA ATIVIDADE</span>
          <h2>Conhecimento para diferentes frentes do campo.</h2>
          <p>
            O foco da TPEC-IA é a pecuária, com bovinos no centro da experiência, mas a conversa
            pode acompanhar outras atividades rurais.
          </p>
        </div>
        <div className="module-list">
          {modules.map((module) => (
            <span key={module}>{module}<ArrowIcon /></span>
          ))}
        </div>
      </section>

      <section className="differentials">
        <div className="section-heading center">
          <span className="eyebrow">POR QUE TPEC-IA</span>
          <h2>Tecnologia acessível, sem perder seriedade.</h2>
        </div>
        <div className="difference-grid">
          <article><strong>01</strong><h3>Linguagem simples</h3><p>Explicações claras para reduzir distância entre tecnologia e campo.</p></article>
          <article><strong>02</strong><h3>Feita para a rotina</h3><p>Uma experiência pensada para dúvidas práticas, e não para parecer complicada.</p></article>
          <article><strong>03</strong><h3>Contexto importa</h3><p>A conversa pode continuar e ganhar informações novas até a resposta fazer sentido.</p></article>
          <article><strong>04</strong><h3>Uso responsável</h3><p>Quando a situação exige avaliação profissional, a TPEC-IA deixa esse limite claro.</p></article>
        </div>
      </section>

      <section className="final-cta">
        <div>
          <span className="eyebrow light">COMECE PELO WHATSAPP</span>
          <h2>A próxima decisão do campo pode começar com uma mensagem.</h2>
          <p>Sem novo aplicativo. Sem curva de aprendizado. Converse com a TPEC-IA do seu jeito.</p>
        </div>
        <a className="primary-button large-button" href={whatsappUrl} target="_blank" rel="noreferrer">
          <WhatsappIcon />
          Falar com a TPEC-IA
          <ArrowIcon />
        </a>
      </section>

      <section className="faq" id="duvidas">
        <div className="section-heading faq-heading">
          <span className="eyebrow">DÚVIDAS FREQUENTES</span>
          <h2>O essencial antes de começar.</h2>
        </div>
        <div className="faq-list">
          {faqs.map((faq) => (
            <details key={faq.question}>
              <summary>{faq.question}<span>+</span></summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <footer>
        <div className="footer-top">
          <a className="brand footer-brand" href="#inicio">
            <img src="/tpec-logo.png" alt="Logo da TPEC-IA" />
            <span>
              <strong>TPEC-IA</strong>
              <small>IA DO BOI</small>
            </span>
          </a>
          <p>Inteligência artificial para o dia a dia da pecuária.</p>
          <a className="footer-whatsapp" href={whatsappUrl} target="_blank" rel="noreferrer">
            <WhatsappIcon /> WhatsApp
          </a>
        </div>
        <div className="footer-bottom">
          <p>© 2026 TPEC-IA. Todos os direitos reservados.</p>
          <div className="footer-links">
            <a href="/politica-de-privacidade">Privacidade</a>
            <a href="/termos-de-uso">Termos de uso</a>
            <a href="/exclusao-de-dados">Exclusão de dados</a>
          </div>
        </div>
      </footer>

      <a className="mobile-whatsapp" href={whatsappUrl} target="_blank" rel="noreferrer">
        <WhatsappIcon />
        Falar com a IA
      </a>
    </main>
  );
}
