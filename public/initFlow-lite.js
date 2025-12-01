// =============================================================
// ✅ initFlow-lite.js — productieversie (silent mode)
// =============================================================

// Debug toggle (false = productie)
const FLOW_DEBUG = false;
const flowLog  = (...args) => { if (FLOW_DEBUG) console.log(...args); };
const flowWarn = (...args) => { if (FLOW_DEBUG) console.warn(...args); };

window.addEventListener("DOMContentLoaded", initFlowLite);

// =============================================================
// 🚫 Toegangscontrole: controleer status=online|live
// =============================================================
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const status = params.get("status");

  if (status !== "online" && status !== "live") {

    // Verborgen output tonen we niet in productie → enkel error screen renderen
    document.querySelectorAll("section, footer, .sp-section, #dynamic-footer")
      .forEach(el => el.style.display = "none");

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
  flowLog("InitFlow gestart");

  const params = new URLSearchParams(window.location.search);
  const status = params.get("status") || "online";

  // 1️⃣ Alle secties verzamelen
  const allSections = Array.from(document.querySelectorAll(".flow-section, .ivr-section"));
  allSections.forEach(el => el.style.display = "none");

  // coreg-container blijft zichtbaar
  const coregContainer = document.getElementById("coreg-container");
  if (coregContainer) coregContainer.style.display = "block";

  // 2️⃣ Eerste niet-IVR sectie tonen
  const firstVisible = allSections.find(el => !el.classList.contains("ivr-section"));
  if (firstVisible) {
    firstVisible.style.display = "block";
    reloadImages(firstVisible);
  }

  // 3️⃣ Footer logica
  if (status === "online") {
    document.querySelectorAll(".ivr-section").forEach(el => el.style.display = "none");
    document.querySelectorAll(".footeronline").forEach(el => el.style.display = "block");
    document.querySelectorAll(".footerlive").forEach(el => el.style.display = "none");
  } else {
    document.querySelectorAll(".footeronline").forEach(el => el.style.display = "none");
    document.querySelectorAll(".footerlive").forEach(el => el.style.display = "block");
  }

  // 4️⃣ Navigeren via flow-next (behalve shortform)
  const flowButtons = document.querySelectorAll(".flow-next");
  flowButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.closest("#lead-form")) return; // shortform own handler

      const current = btn.closest(".flow-section, .ivr-section");
      if (!current) return;

      current.style.display = "none";
      let next = current.nextElementSibling;

      // Skip IVR-secties bij status=online
      while (next && next.classList.contains("ivr-section") && status === "online") {
        next = next.nextElementSibling;
      }

      // Skip longform als longform niet nodig is
      if (next && next.id === "long-form-section") {
        const showLongForm = sessionStorage.getItem("requiresLongForm") === "true";

        if (!showLongForm) {
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

        if (next.id === "sovendus-section" && typeof window.setupSovendus === "function") {
          if (!window.sovendusStarted) {
            window.sovendusStarted = true;
            window.setupSovendus();
          }
        }
      }
    });
  });

  // 5️⃣ Automatische voortgang na longform
  document.addEventListener("longFormSubmitted", () => {
    const current = document.getElementById("long-form")?.closest(".flow-section") ||
                    document.getElementById("long-form");

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

  // 6️⃣ Automatische voortgang na shortform
  document.addEventListener("shortFormSubmitted", async () => {

    const current =
      document.getElementById("lead-form")?.closest(".flow-section") ||
      document.getElementById("lead-form");

    if (!current) return;

    let next = current.nextElementSibling;

    // IVR skip bij online
    while (next && next.classList.contains("ivr-section") && status === "online") {
      next = next.nextElementSibling;
    }

    // Longform skip indien niet nodig
    if (next && next.id === "long-form-section") {
      const showLongForm = sessionStorage.getItem("requiresLongForm") === "true";
      if (!showLongForm) {
        next = next.nextElementSibling;
        while (next && next.classList.contains("ivr-section") && status === "online") {
          next = next.nextElementSibling;
        }
      }
    }

    if (next) {
      current.style.display = "none";
      next.style.display = "block";
      reloadImages(next);
      window.scrollTo({ top: 0, behavior: "smooth" });
      startSovendusIfNeeded(next);
    }

    // 🎯 Pending shortform coreg wordt hier afgehandeld
    try {
      let pending = [];

      if (Array.isArray(window.pendingShortCoreg))
        pending = [...window.pendingShortCoreg];

      if (!pending.length) {
        const stored = sessionStorage.getItem("pendingShortCoreg") || "[]";
        try { pending = JSON.parse(stored); } catch {}
      }

      if (!pending.length) return;

      if (typeof window.buildPayload !== "function" ||
          typeof window.fetchLead !== "function")
        return;

      for (const camp of pending) {
        if (!camp?.cid || !camp?.sid) continue;

        const coregAns = sessionStorage.getItem(`f_2014_coreg_answer_${camp.cid}`) || camp.answer_value;
        const dropdownAns = sessionStorage.getItem(`f_2575_coreg_answer_dropdown_${camp.cid}`) || undefined;

        const payload = await window.buildPayload({
          cid: camp.cid,
          sid: camp.sid,
          is_shortform: true,
          f_2014_coreg_answer: coregAns,
          f_2575_coreg_answer_dropdown: dropdownAns,
        });

        await window.fetchLead(payload);
      }

      window.pendingShortCoreg = [];
      sessionStorage.removeItem("pendingShortCoreg");
    } catch (err) {
      console.error("❌ Fout bij verzenden pendingShortCoreg:", err);
    }
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

  // trick om Swiper/SwipePages direct te refreshen
  window.scrollBy(0, 1);
  setTimeout(() => window.scrollBy(0, -1), 150);
}

function startSovendusIfNeeded(section) {
  if (section.id === "sovendus-section" && typeof window.setupSovendus === "function") {
    if (!window.sovendusStarted) {
      window.sovendusStarted = true;
      window.setupSovendus();
    }
  }
}

// =============================================================
// 🎉 Eén nette loaded-melding
// =============================================================
console.info("🎉 initFlow-lite loaded successfully");
