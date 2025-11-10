// =============================================================
// ✅ initFlow-lite.js — stabiele versie met shortform & longform event flow
//    (collision-safe logging + IIFE)
// =============================================================
(function () {
  // 🔧 Logging toggle (alleen binnen dit bestand)
  const DEBUG_FLOW = false; // ← zet op true bij testen
  const flowLog  = (...args) => { if (DEBUG_FLOW) console.log(...args); };
  const flowWarn = (...args) => { if (DEBUG_FLOW) console.warn(...args); };
  const flowErr  = (...args) => { if (DEBUG_FLOW) console.error(...args); };

  window.addEventListener("DOMContentLoaded", initFlowLite);

  // =============================================================
  // 🚫 Toegangscontrole: controleer statusparameter
  // =============================================================
  document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");

    if (status !== "online" && status !== "live") {
      flowWarn("🚫 Geen geldige statusparameter gevonden — toegang geweigerd.");

      document.querySelectorAll("section, footer, .sp-section, #dynamic-footer").forEach(el => {
        el.style.display = "none";
      });

      const errorDiv = document.createElement("div");
      errorDiv.innerHTML = `
        <style>
          html, body {
            margin: 0; padding: 0; height: 100%; overflow: hidden;
            background: #f8f8f8; display: flex; justify-content: center; align-items: center;
            font-family: 'Inter','Helvetica Neue',Arial,sans-serif; text-align: center; color: #333;
          }
          h1 { font-size: 24px; font-weight: 600; margin-bottom: 10px; }
          p { font-size: 15px; line-height: 1.6; color: #555; }
        </style>
        <div>
          <h1>Pagina niet bereikbaar</h1>
          <p>Deze pagina is momenteel niet toegankelijk.<br>
          Controleer of je de juiste link hebt of probeer het later opnieuw.</p>
        </div>
      `;
      document.body.innerHTML = "";
      document.body.appendChild(errorDiv);
    }
  });

  // =============================================================
  // 🚀 Hoofdinit — flow controller
  // =============================================================
  function initFlowLite() {
    flowLog("🚀 initFlow-lite.js gestart");

    const params = new URLSearchParams(window.location.search);
    const status = params.get("status") || "online";

    // 1️⃣ Secties verzamelen
    const allSections = Array.from(document.querySelectorAll(".flow-section, .ivr-section"));
    flowLog("📦 Swipe-secties gevonden:", allSections.length);

    // === Coreg-positie t.o.v. shortform bepalen ===
    const coregSection = document.getElementById("coreg-container")?.closest(".flow-section");
    const shortFormSection = document.getElementById("lead-form")?.closest(".flow-section");

    let coregBeforeShortForm = false;
    if (coregSection && shortFormSection) {
      // coreg komt vóór short form als hij in DOM eerder voorkomt
      coregBeforeShortForm = !!(coregSection.compareDocumentPosition(shortFormSection) & Node.DOCUMENT_POSITION_FOLLOWING);
    }

    sessionStorage.setItem("coregBeforeShortForm", coregBeforeShortForm ? "true" : "false");
    flowLog("📍 coregBeforeShortForm =", coregBeforeShortForm);

    const coregContainer = document.getElementById("coreg-container");
    if (coregContainer) {
      coregContainer.style.display = "block"; // container zelf zichtbaar houden
      flowLog("✅ coreg-container zichtbaar gehouden");
    }

    // Alles verbergen bij start (voorkomt 'alles zichtbaar' bij parse-fouten)
    allSections.forEach(el => (el.style.display = "none"));

    // 2️⃣ Eerste sectie tonen
    const firstVisible = allSections.find(el => !el.classList.contains("ivr-section"));
    if (firstVisible) {
      firstVisible.style.display = "block";
      reloadImages(firstVisible);
      flowLog("✅ Eerste sectie getoond:", firstVisible.className);
    } else {
      flowWarn("⚠️ Geen zichtbare secties gevonden bij start");
    }

    // 3️⃣ Statusspecifieke footers
    if (status === "online") {
      flowLog("🌐 Status = ONLINE → IVR-secties overslaan + footeronline tonen");
      document.querySelectorAll(".ivr-section").forEach(el => (el.style.display = "none"));
      document.querySelectorAll(".footeronline").forEach(el => (el.style.display = "block"));
      document.querySelectorAll(".footerlive").forEach(el => (el.style.display = "none"));
    } else if (status === "live") {
      flowLog("📺 Status = LIVE → IVR actief + footerlive tonen");
      document.querySelectorAll(".footeronline").forEach(el => (el.style.display = "none"));
      document.querySelectorAll(".footerlive").forEach(el => (el.style.display = "block"));
    }

    // 4️⃣ Navigatie tussen secties via .flow-next
    const flowButtons = document.querySelectorAll(".flow-next");
    flowButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        // 🚫 Laat shortform-knoppen met rust
        if (btn.closest("#lead-form")) {
          flowLog("⛔️ flow-next binnen shortform → overgeslagen (handled door formSubmit.js)");
          return;
        }

        const current = btn.closest(".flow-section, .ivr-section");
        if (!current) return;

        current.style.display = "none";
        let next = current.nextElementSibling;

        // Skip IVR bij online
        while (next && next.classList.contains("ivr-section") && status === "online") {
          next = next.nextElementSibling;
        }

        // Skip longform indien niet vereist
        if (next && next.id === "long-form-section") {
          const showLongForm = sessionStorage.getItem("requiresLongForm") === "true";
          if (!showLongForm) {
            flowLog("🚫 Geen longform-campagnes positief beantwoord → overslaan");
            next = next.nextElementSibling;
            while (next && next.classList.contains("ivr-section") && status === "online") {
              next = next.nextElementSibling;
            }
          } else {
            flowLog("✅ Positieve longform-campagne gevonden → tonen");
          }
        }

        // Toon volgende sectie
        if (next) {
          next.style.display = "block";
          reloadImages(next);
          window.scrollTo({ top: 0, behavior: "smooth" });
          flowLog("➡️ Volgende sectie getoond:", next.className);

          // 🎁 Sovendus starten
          if (next.id === "sovendus-section" && typeof window.setupSovendus === "function") {
            if (!window.sovendusStarted) {
              window.sovendusStarted = true;
              flowLog("🎁 Sovendus-sectie getoond → setupSovendus()");
              window.setupSovendus();
            }
          }
        } else {
          flowLog("🏁 Einde van de flow bereikt");
        }
      });
    });

    // 5️⃣ Automatische doorgang na longform
    document.addEventListener("longFormSubmitted", () => {
      flowLog("✅ Longform voltooid → door naar volgende sectie");
      const current = document.getElementById("long-form")?.closest(".flow-section") || document.getElementById("long-form");
      if (!current) return;

      let next = current.nextElementSibling;
      while (next && next.classList.contains("ivr-section") && status === "online") {
        next = next.nextElementSibling;
      }

      if (next) {
        current.style.display = "none";
        next.style.display = "block";
        reloadImages(next);
        window.scrollTo({ top: 0, behavior: "smooth" });
        flowLog("➡️ Volgende sectie getoond:", next.className);
        startSovendusIfNeeded(next);
      } else {
        flowLog("🏁 Einde flow na longform");
      }
    });

    // 6️⃣ Automatische doorgang na shortform
    document.addEventListener("shortFormSubmitted", () => {
      flowLog("✅ Shortform voltooid → door naar volgende sectie");
      const current = document.getElementById("lead-form")?.closest(".flow-section") || document.getElementById("lead-form");
      if (!current) return;

      let next = current.nextElementSibling;
      while (next && next.classList.contains("ivr-section") && status === "online") {
        next = next.nextElementSibling;
      }

      if (next) {
        current.style.display = "none";
        next.style.display = "block";
        reloadImages(next);
        window.scrollTo({ top: 0, behavior: "smooth" });
        flowLog("➡️ Volgende sectie getoond:", next.className);
        startSovendusIfNeeded(next);
      } else {
        flowLog("🏁 Einde flow na shortform");
      }
    });

    // 7️⃣ System check
    flowLog("✅ Global CoregFlow System Check →", {
      formSubmit: !!window.buildPayload,
      coregRenderer: typeof window.initCoregFlow === "function",
      progressbar: typeof window.animateProgressBar === "function",
      sovendus: typeof window.setupSovendus === "function",
      ivrSections: document.querySelectorAll(".ivr-section").length,
    });
  }

  // =============================================================
  // ♻️ Lazy images + Sovendus helper
  // =============================================================
  function reloadImages(section) {
    if (!section) return;
    const imgs = section.querySelectorAll("img[data-src], img[src*='data:image']");
    imgs.forEach(img => {
      const newSrc = img.getAttribute("data-src") || img.src;
      if (newSrc && !img.src.includes(newSrc)) img.src = newSrc;
    });
    window.scrollBy(0, 1);
    setTimeout(() => window.scrollBy(0, -1), 150);
    flowLog("🖼️ Afbeeldingen geforceerd geladen:", section.className);
  }

  function startSovendusIfNeeded(section) {
    if (section.id === "sovendus-section" && typeof window.setupSovendus === "function") {
      if (!window.sovendusStarted) {
        window.sovendusStarted = true;
        flowLog("🎁 Sovendus gestart bij sectie:", section.id);
        window.setupSovendus();
      }
    }
  }
})();
