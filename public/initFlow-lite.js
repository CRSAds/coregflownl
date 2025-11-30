// =============================================================
// ✅ initFlow-lite.js — stabiele versie met shortform & longform event flow
// =============================================================

window.addEventListener("DOMContentLoaded", initFlowLite);

// =============================================================
// 🚫 Toegangscontrole: controleer statusparameter
// =============================================================
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const status = params.get("status");

  if (status !== "online" && status !== "live") {
    console.warn("🚫 Geen geldige statusparameter gevonden — toegang geweigerd.");

    document.querySelectorAll("section, footer, .sp-section, #dynamic-footer").forEach(el => {
      el.style.display = "none";
    });

    const errorDiv = document.createElement("div");
    errorDiv.innerHTML = `
      <style>
        html, body {
          margin: 0;
          padding: 0;
          height: 100%;
          overflow: hidden;
          background: #f8f8f8;
          display: flex;
          justify-content: center;
          align-items: center;
          font-family: 'Inter','Helvetica Neue',Arial,sans-serif;
          text-align: center;
          color: #333;
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
  console.log("🚀 initFlow-lite.js gestart");

  const params = new URLSearchParams(window.location.search);
  const status = params.get("status") || "online";

  // 1️⃣ Secties verzamelen
  const allSections = Array.from(document.querySelectorAll(".flow-section, .ivr-section"));
  console.log("📦 Swipe-secties gevonden:", allSections.length);

  const coregContainer = document.getElementById("coreg-container");
  if (coregContainer) {
    coregContainer.style.display = "block";
    console.log("✅ coreg-container zichtbaar gehouden");
  }

  allSections.forEach(el => (el.style.display = "none"));

  // 2️⃣ Eerste sectie tonen
  const firstVisible = allSections.find(el => !el.classList.contains("ivr-section"));
  if (firstVisible) {
    firstVisible.style.display = "block";
    reloadImages(firstVisible);
    console.log("✅ Eerste sectie getoond:", firstVisible.className);
  } else {
    console.warn("⚠️ Geen zichtbare secties gevonden bij start");
  }

  // 3️⃣ Statusspecifieke footers
  if (status === "online") {
    console.log("🌐 Status = ONLINE → IVR-secties overslaan + footeronline tonen");
    document.querySelectorAll(".ivr-section").forEach(el => (el.style.display = "none"));
    document.querySelectorAll(".footeronline").forEach(el => (el.style.display = "block"));
    document.querySelectorAll(".footerlive").forEach(el => (el.style.display = "none"));
  } else if (status === "live") {
    console.log("📺 Status = LIVE → IVR actief + footerlive tonen");
    document.querySelectorAll(".footeronline").forEach(el => (el.style.display = "none"));
    document.querySelectorAll(".footerlive").forEach(el => (el.style.display = "block"));
  }

  // 4️⃣ Navigatie tussen secties via .flow-next
  const flowButtons = document.querySelectorAll(".flow-next");
  flowButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      // 🚫 Laat shortform-knoppen met rust
      if (btn.closest("#lead-form")) {
        console.log("⛔️ flow-next binnen shortform → overgeslagen (handled door formSubmit.js)");
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
          console.log("🚫 Geen longform-campagnes positief beantwoord → overslaan");
          next = next.nextElementSibling;
          while (next && next.classList.contains("ivr-section") && status === "online") {
            next = next.nextElementSibling;
          }
        } else {
          console.log("✅ Positieve longform-campagne gevonden → tonen");
        }
      }

      // Toon volgende sectie
      if (next) {
        next.style.display = "block";
        reloadImages(next);
        window.scrollTo({ top: 0, behavior: "smooth" });
        console.log("➡️ Volgende sectie getoond:", next.className);

        // 🎁 Sovendus starten
        if (next.id === "sovendus-section" && typeof window.setupSovendus === "function") {
          if (!window.sovendusStarted) {
            window.sovendusStarted = true;
            console.log("🎁 Sovendus-sectie getoond → setupSovendus()");
            window.setupSovendus();
          }
        }
      } else {
        console.log("🏁 Einde van de flow bereikt");
      }
    });
  });

  // 5️⃣ Automatische doorgang na longform
  document.addEventListener("longFormSubmitted", () => {
    console.log("✅ Longform voltooid → door naar volgende sectie");
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
      console.log("➡️ Volgende sectie getoond:", next.className);
      startSovendusIfNeeded(next);
    } else {
      console.log("🏁 Einde flow na longform");
    }
  });

  // 6️⃣ Automatische doorgang na shortform
  document.addEventListener("shortFormSubmitted", () => {
    console.log("✅ Shortform voltooid → door naar volgende sectie");
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
      console.log("➡️ Volgende sectie getoond:", next.className);
      startSovendusIfNeeded(next);
    } else {
      console.log("🏁 Einde flow na shortform");
    }
  });

  // 7️⃣ System check
  console.groupCollapsed("✅ Global CoregFlow System Check");
  console.log("formSubmit.js geladen:", !!window.buildPayload);
  console.log("coregRenderer.js geladen:", typeof window.initCoregFlow === "function");
  console.log("progressbar-anim.js geladen:", typeof window.animateProgressBar === "function");
  console.log("Sovendus.js geladen:", typeof window.setupSovendus === "function");
  console.log("initFlow-lite.js actief");
  console.log("IVR-secties:", document.querySelectorAll(".ivr-section").length);
  console.groupEnd();
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
  console.log("🖼️ Afbeeldingen geforceerd geladen:", section.className);
}

function startSovendusIfNeeded(section) {
  if (section.id === "sovendus-section" && typeof window.setupSovendus === "function") {
    if (!window.sovendusStarted) {
      window.sovendusStarted = true;
      console.log("🎁 Sovendus gestart bij sectie:", section.id);
      window.setupSovendus();
    }
  }
}
