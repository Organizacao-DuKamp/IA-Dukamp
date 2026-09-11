(() => {
  const ROOT_SELECTOR = ".tpec-landing";
  const WEAK_CATTLE_IMAGES = [
    "/tpec-nelore-grazing.webp",
    "/tpec-nelore-elite.webp",
  ];
  const STRONG_CATTLE_IMAGE = "/tpec-hero-bull.webp";
  const MOBILE_ENTRY_ID = "tpec-mobile-entry-hero";
  const MOBILE_ENTRY_STYLE_ID = "tpec-mobile-entry-hero-styles";
  const WHATSAPP_URL =
    "https://wa.me/5516992256069?text=Ol%C3%A1%2C%20quero%20conhecer%20a%20TPEC-IA%2C%20a%20IA%20do%20Boi.";
  const mobileQuery = window.matchMedia?.("(max-width: 680px)");
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let observer = null;

  const groups = [
    {
      selector: ".gold-title, .reference-copy > h2, .benefits-head, .areas-head, .examples-head",
      className: "tpec-reveal-up",
      stagger: 0,
    },
    {
      selector: ".whatsapp-copy, .analysis-field, .responsibility-copy",
      className: "tpec-reveal-left",
      stagger: 0,
    },
    {
      selector: ".whatsapp-field, .analysis-copy, .how-field, .responsibility-photo",
      className: "tpec-reveal-right",
      stagger: 0,
    },
    {
      selector: ".whatsapp-phone, .analysis-phone",
      className: "tpec-phone-reveal",
      stagger: 0,
    },
    {
      selector: ".analysis-row, .analysis-features > span, .responsibility-points > span",
      className: "tpec-reveal-up",
      stagger: 70,
    },
    {
      selector: ".reference-steps article, .reference-benefits-grid > article, .reference-use-grid > article, .hero-mini-grid > span",
      className: "tpec-card-rise",
      stagger: 85,
    },
    {
      selector: ".reference-areas-grid > article",
      className: "tpec-card-rise",
      stagger: 90,
    },
    {
      selector: ".reference-areas-grid .area-photo img",
      className: "tpec-animal-rise",
      stagger: 90,
      offset: 115,
    },
    {
      selector: ".reference-use-grid .use-photo img",
      className: "tpec-image-rise",
      stagger: 85,
      offset: 90,
    },
    {
      selector: ".scan-board",
      className: "tpec-scan-reveal",
      stagger: 130,
    },
    {
      selector: ".gold-divider",
      className: "tpec-draw-line",
      stagger: 0,
    },
    {
      selector: ".poster-swoosh",
      className: "tpec-swoosh-reveal",
      stagger: 0,
    },
  ];

  function ensureMobileEntryStyles() {
    if (document.getElementById(MOBILE_ENTRY_STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = MOBILE_ENTRY_STYLE_ID;
    style.textContent = `
      .${MOBILE_ENTRY_ID} { display: none; }

      @media (max-width: 680px) {
        .tpec-landing.tpec-mobile-entry-active > .poster-whatsapp,
        .tpec-landing.tpec-mobile-entry-active > .poster-hero {
          display: none !important;
        }

        .tpec-landing .${MOBILE_ENTRY_ID} {
          background:
            radial-gradient(circle at 72% 10%, rgba(255,255,255,.95) 0%, rgba(255,255,255,.25) 32%, transparent 48%),
            linear-gradient(180deg, #fffdf8 0%, #faf5e9 65%, #f2eadc 100%);
          color: #102e22;
          display: flex;
          flex-direction: column;
          height: 100svh;
          isolation: isolate;
          justify-content: flex-start;
          margin: 0;
          min-height: 640px;
          overflow: hidden;
          padding: max(24px, env(safe-area-inset-top)) 24px max(18px, env(safe-area-inset-bottom));
          position: relative;
          width: 100%;
        }

        .tpec-landing .${MOBILE_ENTRY_ID}::before {
          background: radial-gradient(circle at 50% 35%, rgba(205,167,83,.08), transparent 48%);
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .tpec-landing .${MOBILE_ENTRY_ID} .mobile-entry-content {
          align-items: flex-start;
          display: flex;
          flex: 1 1 auto;
          flex-direction: column;
          position: relative;
          z-index: 3;
        }

        .tpec-landing .${MOBILE_ENTRY_ID} .mobile-entry-logo {
          align-self: center;
          height: clamp(126px, 35vw, 160px);
          margin: 0 auto clamp(12px, 2.2svh, 20px);
          object-fit: contain;
          width: clamp(126px, 35vw, 160px);
        }

        .tpec-landing .${MOBILE_ENTRY_ID} .mobile-entry-title {
          align-self: center;
          background: linear-gradient(180deg,#f6d77b 0%,#9b6115 30%,#6d3d0b 48%,#eab84c 70%,#77470f 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          filter: drop-shadow(0 2px 1px rgba(71,43,8,.22));
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(43px, 12.5vw, 60px);
          font-weight: 500;
          letter-spacing: -.025em;
          line-height: .92;
          margin: 0 0 clamp(16px, 2.5svh, 24px);
          text-align: center;
          text-transform: uppercase;
          width: 100%;
        }

        .tpec-landing .${MOBILE_ENTRY_ID} .mobile-entry-subtitle {
          color: #0b442d;
          font-family: Inter, ui-sans-serif, system-ui, sans-serif;
          font-size: clamp(29px, 8vw, 39px);
          font-weight: 850;
          letter-spacing: -.03em;
          line-height: 1.03;
          margin: 0 0 clamp(15px, 2.2svh, 21px);
          max-width: 350px;
        }

        .tpec-landing .${MOBILE_ENTRY_ID} .mobile-entry-text {
          color: #2f322f;
          font-size: clamp(16px, 4.35vw, 20px);
          line-height: 1.4;
          margin: 0 0 clamp(21px, 3svh, 30px);
          max-width: 335px;
        }

        .tpec-landing .${MOBILE_ENTRY_ID} .mobile-entry-button {
          align-items: center;
          align-self: stretch;
          background: linear-gradient(180deg, #1b663b 0%, #0a4729 100%);
          border: 2px solid #bd8a29;
          border-radius: 14px;
          box-shadow: 0 8px 18px rgba(28,63,39,.24), inset 0 0 0 1px rgba(255,255,255,.11);
          color: #fff;
          display: flex;
          font-size: clamp(13px, 3.75vw, 17px);
          font-weight: 900;
          gap: 11px;
          justify-content: center;
          letter-spacing: .01em;
          min-height: 58px;
          padding: 0 12px;
          text-decoration: none;
        }

        .tpec-landing .${MOBILE_ENTRY_ID} .mobile-entry-button svg {
          fill: none;
          flex: 0 0 auto;
          height: 31px;
          stroke: currentColor;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: 1.8;
          width: 31px;
        }

        .tpec-landing .${MOBILE_ENTRY_ID} .mobile-entry-waves {
          bottom: -1px;
          height: 30svh;
          left: 0;
          min-height: 190px;
          overflow: hidden;
          pointer-events: none;
          position: absolute;
          right: 0;
          z-index: 1;
        }

        .tpec-landing .${MOBILE_ENTRY_ID} .mobile-entry-waves span {
          border-radius: 50% 50% 0 0 / 18% 18% 0 0;
          bottom: -48%;
          height: 118%;
          left: -28%;
          position: absolute;
          transform: rotate(9deg);
          width: 160%;
        }

        .tpec-landing .${MOBILE_ENTRY_ID} .mobile-entry-waves .wave-one {
          background: rgba(188,201,142,.72);
          bottom: -25%;
        }

        .tpec-landing .${MOBILE_ENTRY_ID} .mobile-entry-waves .wave-two {
          background: rgba(108,139,78,.9);
          bottom: -42%;
          box-shadow: 0 -3px 0 rgba(210,161,50,.7);
        }

        .tpec-landing .${MOBILE_ENTRY_ID} .mobile-entry-waves .wave-three {
          background: linear-gradient(180deg,#3e6b45 0%,#224a31 100%);
          bottom: -63%;
          box-shadow: 0 -3px 0 rgba(235,187,66,.9);
        }

        @media (max-height: 720px) {
          .tpec-landing .${MOBILE_ENTRY_ID} {
            min-height: 600px;
            padding-top: 16px;
          }

          .tpec-landing .${MOBILE_ENTRY_ID} .mobile-entry-logo {
            height: 108px;
            margin-bottom: 10px;
            width: 108px;
          }

          .tpec-landing .${MOBILE_ENTRY_ID} .mobile-entry-title {
            font-size: 42px;
            margin-bottom: 12px;
          }

          .tpec-landing .${MOBILE_ENTRY_ID} .mobile-entry-subtitle {
            font-size: 28px;
            margin-bottom: 10px;
          }

          .tpec-landing .${MOBILE_ENTRY_ID} .mobile-entry-text {
            font-size: 15px;
            margin-bottom: 15px;
          }

          .tpec-landing .${MOBILE_ENTRY_ID} .mobile-entry-button {
            min-height: 52px;
          }
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureMobileEntry(root) {
    if (!root) return;

    ensureMobileEntryStyles();
    const isMobile = mobileQuery?.matches ?? window.innerWidth <= 680;
    let entry = root.querySelector(`.${MOBILE_ENTRY_ID}`);

    if (!isMobile) {
      root.classList.remove("tpec-mobile-entry-active");
      entry?.remove();
      return;
    }

    root.classList.add("tpec-mobile-entry-active");
    if (entry) return;

    entry = document.createElement("section");
    entry.className = MOBILE_ENTRY_ID;
    entry.setAttribute("aria-label", "WhatsApp da TPEC-IA");
    entry.innerHTML = `
      <div class="mobile-entry-content">
        <img class="mobile-entry-logo" src="/tpec-logo.png" alt="TPEC-IA — Inteligência Artificial da Pecuária" />
        <h1 class="mobile-entry-title">WHATSAPP<br />DA TPEC-IA</h1>
        <h2 class="mobile-entry-subtitle">A TPEC-IA vai com<br />você para o campo.</h2>
        <p class="mobile-entry-text">Tire dúvidas, envie fotos e receba orientações técnicas direto pelo WhatsApp. Prático, rápido e feito para o pecuarista.</p>
        <a class="mobile-entry-button" href="${WHATSAPP_URL}" target="_blank" rel="noreferrer">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20.4 11.8a8.4 8.4 0 0 1-12.5 7.3l-4.4 1.4 1.3-4.3a8.4 8.4 0 1 1 15.6-4.4Z"></path><path d="M8.2 7.7c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.8 2c.1.3 0 .5-.2.7l-.6.8c-.2.2-.1.4 0 .6.6 1.1 1.5 2 2.6 2.6.2.1.4.2.6 0l.8-1c.2-.2.4-.3.7-.2l2 .9c.3.1.4.3.4.5 0 .4-.2 1.3-.7 1.8-.5.5-1.3.8-2.2.6-1-.2-2.7-.8-4.7-2.5-1.6-1.4-2.7-3.2-3-4.2-.3-1 0-2 .4-2.6Z"></path></svg>
          <span>CONVERSAR COM A TPEC-IA</span>
        </a>
      </div>
      <div class="mobile-entry-waves" aria-hidden="true"><span class="wave-one"></span><span class="wave-two"></span><span class="wave-three"></span></div>
    `;

    const anchor = root.querySelector(".poster-whatsapp, .poster-hero");
    if (anchor) root.insertBefore(entry, anchor);
    else root.prepend(entry);
  }

  function replaceWeakCattleImages(root) {
    root.querySelectorAll("img").forEach((image) => {
      const src = image.getAttribute("src") || "";
      if (WEAK_CATTLE_IMAGES.some((weakImage) => src.endsWith(weakImage))) {
        image.setAttribute("src", STRONG_CATTLE_IMAGE);
      }
    });
  }

  function reveal(element) {
    element.classList.add("is-visible");
    observer?.unobserve(element);
  }

  function createObserver() {
    if (!("IntersectionObserver" in window)) return null;
    return new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting || entry.intersectionRatio > 0) reveal(entry.target);
        });
      },
      {
        threshold: [0.08, 0.16],
        rootMargin: "0px 0px -7% 0px",
      },
    );
  }

  function prepareElement(element, className, delay) {
    if (element.dataset.tpecObserved === "1") return;

    element.dataset.tpecObserved = "1";
    element.classList.add("tpec-motion", className);
    element.style.setProperty("--tpec-delay", `${Math.min(delay, 680)}ms`);

    if (reducedMotion?.matches || !observer) {
      reveal(element);
      return;
    }

    const rect = element.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.91 && rect.bottom > 0) {
      requestAnimationFrame(() => reveal(element));
    } else {
      observer.observe(element);
    }
  }

  function setupRoot(root) {
    if (!root) return;

    ensureMobileEntry(root);
    replaceWeakCattleImages(root);
    if (root.dataset.tpecMotionReady === "1") return;

    root.dataset.tpecMotionReady = "1";
    root.classList.add("motion-enabled");

    groups.forEach(({ selector, className, stagger = 0, offset = 0 }) => {
      root.querySelectorAll(selector).forEach((element, index) => {
        prepareElement(element, className, offset + index * stagger);
      });
    });
  }

  function init() {
    document.querySelectorAll(ROOT_SELECTOR).forEach(setupRoot);
  }

  observer = createObserver();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  const mutationObserver = new MutationObserver(() => {
    const roots = document.querySelectorAll(ROOT_SELECTOR);
    if (!roots.length) return;
    roots.forEach((root) => {
      ensureMobileEntry(root);
      replaceWeakCattleImages(root);
      if (root.dataset.tpecMotionReady !== "1") setupRoot(root);
    });
  });

  mutationObserver.observe(document.documentElement, { childList: true, subtree: true });

  mobileQuery?.addEventListener?.("change", () => {
    document.querySelectorAll(ROOT_SELECTOR).forEach(ensureMobileEntry);
  });

  reducedMotion?.addEventListener?.("change", () => {
    document.querySelectorAll(`${ROOT_SELECTOR} .tpec-motion`).forEach((element) => {
      if (reducedMotion.matches) reveal(element);
    });
  });
})();
