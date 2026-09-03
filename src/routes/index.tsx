import { createFileRoute } from "@tanstack/react-router";
import "../landing.css";

const whatsappUrl =
  "https://wa.me/5516992256069?text=Ol%C3%A1%2C%20quero%20conhecer%20a%20TPEC-IA%2C%20a%20IA%20do%20Boi.";

const heroPhoto =
  "https://images.pexels.com/photos/31026900/pexels-photo-31026900/free-photo-of-close-up-of-nelore-cattle-in-sao-paulo-pasture.jpeg?auto=compress&cs=tinysrgb&w=1400";
const fieldPhoto =
  "https://images.pexels.com/photos/33206150/pexels-photo-33206150/free-photo-of-herd-of-cattle-grazing-in-brazilian-pasture.png?auto=compress&cs=tinysrgb&w=1600";
const aerialPhoto =
  "https://images.pexels.com/photos/10251994/pexels-photo-10251994.jpeg?auto=compress&cs=tinysrgb&w=1400";

const benefits = [
  {
    icon: "camera",
    title: "Análise por foto",
    text: "Envie imagens de animais, pasto, cocho ou situações de campo e use a foto como parte da conversa.",
  },
  {
    icon: "bolt",
    title: "Respostas rápidas",
    text: "Pergunte do seu jeito e receba explicações organizadas, objetivas e fáceis de continuar.",
  },
  {
    icon: "shield",
    title: "Decisões mais seguras",
    text: "Organize sinais, contexto e próximos passos antes de agir ou chamar um profissional habilitado.",
  },
  {
    icon: "chart",
    title: "Tecnologia no campo",
    text: "IA aplicada à rotina da fazenda sem complicação, direto no WhatsApp que você já usa.",
  },
];

const areas = [
  { title: "Bovinos de corte", short: "CORTE", text: "Manejo, ganho de peso, pastagens e suplementação." },
  { title: "Bovinos de leite", short: "LEITE", text: "Rotina do rebanho, alimentação e produtividade." },
  { title: "Equinos", short: "EQUINOS", text: "Manejo, condição corporal, dieta e cuidados gerais." },
  { title: "Ovinos e caprinos", short: "OV/CAP", text: "Nutrição, lotes, reprodução e rotina de manejo." },
  { title: "Suínos", short: "SUÍNOS", text: "Ambiente, alimentação, desempenho e organização." },
  { title: "Aves", short: "AVES", text: "Manejo, ambiência, consumo e acompanhamento." },
  { title: "Piscicultura", short: "PEIXES", text: "Qualidade da água, manejo, alimentação e produção." },
];

const useCases = [
  "Analise esta condição corporal",
  "Como está a condição deste pasto?",
  "Esta dieta está adequada ao objetivo?",
  "O que devo observar neste lote?",
];

const faqs = [
  {
    question: "Precisa instalar aplicativo?",
    answer:
      "Não. A experiência principal da TPEC-IA funciona pelo WhatsApp, sem exigir um aplicativo novo para começar.",
  },
  {
    question: "Posso mandar foto e áudio?",
    answer:
      "Sim. Você pode conversar por texto, áudio e foto, além de enviar documentos quando precisar dar mais contexto.",
  },
  {
    question: "Serve apenas para bovinos?",
    answer:
      "O foco principal é a pecuária bovina, mas a TPEC-IA também apoia dúvidas sobre equinos, ovinos, caprinos, suínos, aves e piscicultura.",
  },
  {
    question: "A TPEC-IA substitui veterinário, zootecnista ou agrônomo?",
    answer:
      "Não. A TPEC-IA é uma ferramenta de apoio. Situações clínicas, emergenciais ou que dependam de diagnóstico precisam de avaliação profissional.",
  },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TPEC-IA — Inteligência artificial da pecuária" },
      {
        name: "description",
        content:
          "Inteligência artificial para a pecuária, direto no WhatsApp. Tire dúvidas, envie fotos, áudios e documentos e receba apoio prático para o campo.",
      },
      { property: "og:title", content: "TPEC-IA — Inteligência artificial da pecuária" },
      {
        property: "og:description",
        content: "Campo + inteligência: respostas claras, análise por foto e apoio para o dia a dia da pecuária.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/og.png" },
      { name: "twitter:card", content: "summary_large_image" },
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
      <path d="M20.4 11.8a8.4 8.4 0 0 1-12.5 7.3l-4.4 1.4 1.3-4.3a8.4 8.4 0 1 1 15.6-4.4Z" />
      <path d="M8.2 7.7c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.8 2c.1.3 0 .5-.2.7l-.6.8c-.2.2-.1.4 0 .6.6 1.1 1.5 2 2.6 2.6.2.1.4.2.6 0l.8-1c.2-.2.4-.3.7-.2l2 .9c.3.1.4.3.4.5 0 .4-.2 1.3-.7 1.8-.5.5-1.3.8-2.2.6-1-.2-2.7-.8-4.7-2.5-1.6-1.4-2.7-3.2-3-4.2-.3-1 0-2 .4-2.6Z" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m12 3 1.2 4.1L17 8.5l-3.8 1.4L12 14l-1.2-4.1L7 8.5l3.8-1.4zM18.5 14l.8 2.6 2.7.9-2.7.9-.8 2.6-.8-2.6-2.7-.9 2.7-.9z" />
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

function FeatureIcon({ name }: { name: string }) {
  if (name === "camera") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
        <circle cx="12" cy="13.5" r="3.2" />
      </svg>
    );
  }

  if (name === "bolt") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M13.5 2 5 13h6l-.5 9L19 11h-6z" />
      </svg>
    );
  }

  if (name === "shield") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 3 5 6v5c0 4.6 2.7 8 7 10 4.3-2 7-5.4 7-10V6z" />
        <path d="m8.5 12 2.2 2.2 4.8-5" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 19V9M10 19V5M15 19v-7M20 19V3" />
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
            <small>INTELIGÊNCIA ARTIFICIAL DA PECUÁRIA</small>
          </span>
        </a>

        <nav aria-label="Navegação principal">
          <a href="#analise">Análise por foto</a>
          <a href="#como-funciona">Como funciona</a>
          <a href="#beneficios">Benefícios</a>
          <a href="#areas">Áreas</a>
        </nav>

        <a className="header-cta" href={whatsappUrl} target="_blank" rel="noreferrer">
          Testar no WhatsApp
          <ArrowIcon />
        </a>
      </header>

      <section className="editorial-hero" id="inicio">
        <div className="hero-ribbon" aria-hidden="true" />
        <div className="hero-shell">
          <div className="hero-copy">
            <span className="kicker">CAMPO + INTELIGÊNCIA</span>
            <h1>
              A inteligência que entende
              <em>o dia a dia da pecuária.</em>
            </h1>
            <p>
              Pergunte sobre manejo, nutrição, pastagens, clima, mercado e muito mais. Envie texto,
              áudio, foto ou documento e converse com uma IA criada para transformar informação em
              decisão prática.
            </p>

            <div className="hero-actions">
              <a className="primary-cta" href={whatsappUrl} target="_blank" rel="noreferrer">
                <WhatsappIcon />
                Conversar com a TPEC-IA
                <ArrowIcon />
              </a>
              <a className="secondary-cta" href="#como-funciona">
                Veja como funciona
                <ArrowIcon />
              </a>
            </div>

            <div className="hero-facts" aria-label="Diferenciais rápidos">
              <span><CheckIcon /> Sem novo aplicativo</span>
              <span><CheckIcon /> Foto, áudio e texto</span>
              <span><CheckIcon /> Direto no WhatsApp</span>
            </div>
          </div>

          <div className="hero-stage" aria-label="TPEC-IA aplicada ao campo">
            <div className="hero-photo-wrap">
              <img src={heroPhoto} alt="Bovino Nelore em pastagem" fetchPriority="high" />
              <span className="field-chip chip-one"><i /> manejo</span>
              <span className="field-chip chip-two"><i /> nutrição</span>
              <span className="field-chip chip-three"><i /> sanidade</span>
              <span className="field-chip chip-four"><i /> pastagem</span>
            </div>

            <aside className="analysis-float">
              <span className="analysis-icon"><SparkIcon /></span>
              <div>
                <small>ANÁLISE TPEC-IA</small>
                <strong>Condição corporal</strong>
                <p>Observe cobertura de costelas, linha de dorso e uniformidade do lote.</p>
              </div>
            </aside>

            <div className="hero-seal">
              <img src="/tpec-logo.png" alt="" />
            </div>
          </div>
        </div>
      </section>

      <section className="editorial-strip" aria-label="Resumo da solução">
        <span>TECNOLOGIA</span>
        <i />
        <span>CONFIANÇA</span>
        <i />
        <span>AGILIDADE</span>
        <i />
        <span>RESULTADO</span>
      </section>

      <section className="photo-analysis section-paper" id="analise">
        <div className="section-shell split-shell">
          <div className="analysis-visual">
            <div className="analysis-photo-card">
              <img src={fieldPhoto} alt="Rebanho em pastagem usado como exemplo de análise visual" loading="lazy" />
              <span className="focus-corner corner-a" />
              <span className="focus-corner corner-b" />
              <span className="focus-corner corner-c" />
              <span className="focus-corner corner-d" />
            </div>

            <div className="phone-card" aria-label="Exemplo de conversa com análise por foto">
              <div className="phone-head">
                <img src="/tpec-logo.png" alt="" />
                <span><strong>TPEC-IA</strong><small>online</small></span>
              </div>
              <div className="chat-photo">
                <img src={heroPhoto} alt="" />
                <p>O que você observa neste animal?</p>
              </div>
              <div className="chat-answer">
                <span><SparkIcon /> ANÁLISE VISUAL</span>
                <p>Posso te ajudar a avaliar condição corporal, aprumos e sinais visíveis por etapas.</p>
              </div>
            </div>
          </div>

          <div className="section-copy">
            <span className="section-label">ANÁLISE POR FOTO</span>
            <h2>Mostre o que está acontecendo.</h2>
            <p className="lead">
              A TPEC-IA ajuda a transformar uma imagem em uma conversa mais útil. Fotografe o que
              chamou sua atenção e acrescente o contexto do campo.
            </p>

            <div className="number-list">
              <div><b>01</b><span><strong>Envie a imagem</strong><small>Animal, lote, pasto, cocho ou situação de campo.</small></span></div>
              <div><b>02</b><span><strong>Conte o contexto</strong><small>Idade, objetivo, manejo, região e o que você quer entender.</small></span></div>
              <div><b>03</b><span><strong>Receba pontos de atenção</strong><small>Informações organizadas e perguntas complementares.</small></span></div>
              <div><b>04</b><span><strong>Continue a conversa</strong><small>Aprofunde a dúvida até chegar aos próximos passos.</small></span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="how-section" id="como-funciona">
        <div className="section-shell">
          <div className="section-heading centered">
            <span className="section-label">COMO FUNCIONA</span>
            <h2>Simples como conversar. Inteligente como precisa ser.</h2>
            <p>Quatro passos para sair da dúvida e chegar a uma resposta útil para a rotina do campo.</p>
          </div>

          <div className="steps-grid">
            <article>
              <b>1</b>
              <span className="step-icon"><WhatsappIcon /></span>
              <h3>Converse</h3>
              <p>Abra o WhatsApp e mande sua pergunta como você explicaria para outra pessoa.</p>
            </article>
            <article>
              <b>2</b>
              <span className="step-icon"><SparkIcon /></span>
              <h3>Pergunte</h3>
              <p>Texto, áudio, foto e documentos entram na mesma conversa para dar contexto.</p>
            </article>
            <article>
              <b>3</b>
              <span className="step-icon"><FeatureIcon name="chart" /></span>
              <h3>A IA analisa</h3>
              <p>A TPEC-IA organiza as informações e estrutura uma resposta clara e prática.</p>
            </article>
            <article>
              <b>4</b>
              <span className="step-icon"><CheckIcon /></span>
              <h3>Decida com clareza</h3>
              <p>Use a resposta como apoio para entender o cenário e planejar os próximos passos.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="benefits-section section-paper" id="beneficios">
        <div className="section-shell">
          <div className="section-heading horizontal-heading">
            <div>
              <span className="section-label">BENEFÍCIOS</span>
              <h2>Tecnologia simples para o dia a dia da pecuária.</h2>
            </div>
            <p>Informação útil, visual e organizada para reduzir ruído e acelerar entendimento.</p>
          </div>

          <div className="benefits-grid">
            {benefits.map((item) => (
              <article className="benefit-card" key={item.title}>
                <span className="benefit-icon"><FeatureIcon name={item.icon} /></span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="areas-section" id="areas">
        <div className="section-shell">
          <div className="section-heading centered compact-heading">
            <span className="section-label">ÁREAS DA PECUÁRIA</span>
            <h2>Soluções inteligentes para atividades de campo.</h2>
            <p>Mais contexto para diferentes rotinas, espécies e sistemas de produção.</p>
          </div>

          <div className="areas-grid">
            {areas.map((area, index) => (
              <article className="area-card" key={area.title}>
                <span className="area-number">0{index + 1}</span>
                <div className="area-monogram">{area.short}</div>
                <h3>{area.title}</h3>
                <p>{area.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="examples-section section-paper">
        <div className="section-shell">
          <div className="examples-layout">
            <div className="examples-copy">
              <span className="section-label">EXEMPLOS DE USO</span>
              <h2>Perguntas reais do dia a dia que nossa plataforma ajuda a organizar.</h2>
              <p>
                A conversa pode começar por uma frase, uma foto ou um áudio. O importante é explicar
                o objetivo e continuar acrescentando contexto.
              </p>
              <a className="text-link" href={whatsappUrl} target="_blank" rel="noreferrer">
                Experimentar agora <ArrowIcon />
              </a>
            </div>

            <div className="usecase-grid">
              {useCases.map((item, index) => (
                <article className="usecase-card" key={item}>
                  <span>0{index + 1}</span>
                  <div className="usecase-screen">
                    <small>Você</small>
                    <p>{item}</p>
                    <i>09:{41 + index}</i>
                  </div>
                  <div className="usecase-answer">
                    <SparkIcon />
                    <span>TPEC-IA pronta para analisar o contexto.</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="responsibility-section">
        <div className="responsibility-photo">
          <img src={aerialPhoto} alt="Rebanho em área de produção pecuária" loading="lazy" />
        </div>
        <div className="responsibility-copy">
          <span className="section-label light-label">SEGURANÇA E RESPONSABILIDADE</span>
          <h2>Tecnologia com responsabilidade.</h2>
          <p>
            A TPEC-IA foi criada para apoiar entendimento e organização de informações. Ela não
            substitui diagnóstico, prescrição ou atendimento de profissionais habilitados.
          </p>
          <div className="responsibility-grid">
            <span><FeatureIcon name="chart" /><b>Apoio à decisão</b><small>Informação organizada para compreender melhor o cenário.</small></span>
            <span><FeatureIcon name="shield" /><b>Situações críticas</b><small>Emergências devem ser encaminhadas para atendimento profissional.</small></span>
            <span><CheckIcon /><b>Mais contexto</b><small>Fotos, áudios e dados ajudam a tornar a conversa mais útil.</small></span>
            <span><SparkIcon /><b>IA como apoio</b><small>Uma ferramenta para complementar — não substituir — o conhecimento técnico.</small></span>
          </div>
        </div>
      </section>

      <section className="faq-section section-paper" id="duvidas">
        <div className="section-shell faq-layout">
          <div className="faq-heading">
            <span className="section-label">DÚVIDAS FREQUENTES</span>
            <h2>O que você precisa saber antes de começar.</h2>
            <p>Se ainda tiver uma pergunta, fale com a TPEC-IA pelo WhatsApp e teste a experiência.</p>
          </div>
          <div className="faq-list">
            {faqs.map((faq) => (
              <details key={faq.question}>
                <summary>{faq.question}<span>+</span></summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div className="final-cta-seal"><img src="/tpec-logo.png" alt="" /></div>
        <div>
          <span>CAMPO + INTELIGÊNCIA</span>
          <h2>Leve a TPEC-IA para a sua rotina.</h2>
          <p>Comece uma conversa agora e descubra como a inteligência artificial pode apoiar o seu dia no campo.</p>
        </div>
        <a className="final-button" href={whatsappUrl} target="_blank" rel="noreferrer">
          <WhatsappIcon /> Conversar no WhatsApp <ArrowIcon />
        </a>
      </section>

      <footer className="site-footer">
        <a className="footer-brand" href="#inicio">
          <img src="/tpec-logo.png" alt="" />
          <span><strong>TPEC-IA</strong><small>INTELIGÊNCIA ARTIFICIAL DA PECUÁRIA</small></span>
        </a>
        <p>Informação para apoiar decisões no campo. Use com responsabilidade.</p>
        <nav aria-label="Links legais">
          <a href="/politica-de-privacidade">Privacidade</a>
          <a href="/termos-de-uso">Termos de uso</a>
        </nav>
      </footer>
    </main>
  );
}
