// =============================================================
// ✅ initFlow-lite.js — volledige versie met coreg, shortform & longform flow
// =============================================================

window.addEventListener("DOMContentLoaded", initFlowLite);

// 🔧 Logging toggle
const DEBUG_FLOW = true; // ← zet op false in productie
const flowLog = (...args) => { if (DEBUG_FLOW) console.log(...args); };

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

  // Alles verbergen behalve eerste sectie
  allSections.forEach(el => (el.style.display = "none"));
  const firstVisible = allSections.find(el => !el.classList.contains("ivr-section"));
  if (firstVisible) {
    firstVisible.style.display = "block";
    reloadImages(firstVisible);
    flowLog("✅ Eerste sectie getoond:", firstVisible.className);
  }

  // 2️⃣ Navigatie via .flow-next
  const flowButtons = document.querySelectorAll(".flow-next");
  flowButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      // Laat shortform-knoppen met rust
      if (btn.closest("#lead-form")) {
        flowLog("⛔️ flow-next binnen shortform → overgeslagen");
        return;
      }

      const current = btn.closest(".flow-section, .ivr-section");
      if (!current) return;

      current.style.display = "none";
      let next = current.nextElementSibling;

      // Skip IVR-secties bij online status
      while (next && next.classList.contains("ivr-section") && status === "online") {
        next = next.nextElementSibling;
      }

      // Skip longform indien niet vereist
      if (next && next.id === "long-form-section") {
        const showLongForm = sessionStorage.getItem("requiresLongForm") === "true";
        if (!showLongForm) {
          flowLog("🚫 Geen longform nodig → overslaan");
          next = next.nextElementSibling;
          while (next && next.classList.contains("ivr-section") && status === "online") {
            next = next.nextElementSibling;
          }
        }
      }

      if (next) {
        next.style.display = "block";
        reloadImages(next);
        window.scrollTo({ top: 0, behavior: "smooth" });
        flowLog("➡️ Volgende sectie getoond:", next.className);
        startSovendusIfNeeded(next);
      } else {
        flowLog("🏁 Einde van de flow bereikt");
      }
    });
  });

  // 3️⃣ Automatisch doorgaan na shortform
  document.addEventListener("shortFormSubmitted", () => {
    flowLog("✅ Shortform voltooid → door naar volgende sectie");
    const current = document.getElementById("lead-form")?.closest(".flow-section");
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
      startSovendusIfNeeded(next);
    }
  });

  // 4️⃣ Automatisch doorgaan na longform
  document.addEventListener("longFormSubmitted", () => {
    flowLog("✅ Longform voltooid → door naar volgende sectie");
    const current = document.getElementById("long-form")?.closest(".flow-section");
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
      startSovendusIfNeeded(next);
    }
  });

  // 5️⃣ Automatisch doorgaan na coreg
  document.addEventListener("coregFlowCompleted", () => {
    flowLog("✅ Coreg flow afgerond → door naar volgende sectie");
    const current = document.getElementById("coreg-container")?.closest(".flow-section");
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
      startSovendusIfNeeded(next);
      flowLog("➡️ Volgende sectie getoond na coreg:", next.className);
    } else {
      flowLog("🏁 Einde flow na coreg");
    }
  });

  // 6️⃣ System check
  flowLog("✅ initFlow-lite.js actief — listeners ingesteld");
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
