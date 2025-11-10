// =============================================================
// ✅ initFlow-lite.js — stabiele versie met coreg event + toggle logging
// =============================================================

window.addEventListener("DOMContentLoaded", initFlowLite);

// Logging toggle
const DEBUG_FLOW = true; // zet op false in productie
const flowLog = (...args) => { if (DEBUG_FLOW) console.log(...args); };

function initFlowLite() {
  flowLog("🚀 initFlow-lite.js gestart");

  const params = new URLSearchParams(window.location.search);
  const status = params.get("status") || "online";

  const allSections = Array.from(document.querySelectorAll(".flow-section, .ivr-section"));
  flowLog("📦 Swipe-secties gevonden:", allSections.length);

  allSections.forEach(el => (el.style.display = "none"));
  const firstVisible = allSections.find(el => !el.classList.contains("ivr-section"));
  if (firstVisible) firstVisible.style.display = "block";

  // Coreg event listener
  document.addEventListener("coregFlowCompleted", () => {
    flowLog("✅ Coreg flow afgerond → door naar volgende sectie");

    const current = document.getElementById("coreg-container")?.closest(".flow-section");
    if (!current) return;

    let next = current.nextElementSibling;

    // Skip IVR bij online
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
}

// Helpers
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
