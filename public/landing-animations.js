(() => {
  const ROOT_SELECTOR = ".tpec-landing";
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
    if (!root || root.dataset.tpecMotionReady === "1") return;

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
      if (root.dataset.tpecMotionReady !== "1") setupRoot(root);
    });
  });

  mutationObserver.observe(document.documentElement, { childList: true, subtree: true });

  reducedMotion?.addEventListener?.("change", () => {
    document.querySelectorAll(`${ROOT_SELECTOR} .tpec-motion`).forEach((element) => {
      if (reducedMotion.matches) reveal(element);
    });
  });
})();
