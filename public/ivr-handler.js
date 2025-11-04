// =============================================================
// ✅ ivr-handler.js — IVR integratie + debug overlay (Directus + Vercel)
// =============================================================
(function () {
  console.log("📞 ivr-handler.js gestart");

  // 🌐 absolute API-basis zodat het altijd werkt vanuit Swipe Pages
  const API_BASE = "https://coregflownl.vercel.app";

  // ------------------------------------------------------------
  // 🔹 Helpers
  // ------------------------------------------------------------
  function getUUID() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  const urlParams = new URLSearchParams(window.location.search);
  const isDebug = urlParams.get("debug") === "ivr" || window.location.hostname.includes("vercel.app");

  // Tracking parameters
  const t_id = urlParams.get("t_id") || getUUID();
  const aff_id = urlParams.get("aff_id") || "unknown";
  const offer_id = urlParams.get("offer_id") || "unknown";
  const sub_id = urlParams.get("sub_id") || "unknown";
  const sub_id_2 = urlParams.get("sub_id_2") || sub_id;
  const isMobile = window.innerWidth < 768;

  sessionStorage.setItem("t_id", t_id);
  sessionStorage.setItem("aff_id", aff_id);
  sessionStorage.setItem("offer_id", offer_id);
  sessionStorage.setItem("sub_id", sub_id);
  sessionStorage.setItem("sub_id_2", sub_id_2);

  console.log("📱 Apparaatstype:", isMobile ? "mobile" : "desktop");

  // ------------------------------------------------------------
  // 🧩 Debug overlay
  // ------------------------------------------------------------
  let debugBox;
  function setupDebugOverlay() {
    if (!isDebug) return;

    debugBox = document.createElement("div");
    debugBox.id = "ivr-debug-overlay";
    debugBox.style.position = "fixed";
    debugBox.style.bottom = "0";
    debugBox.style.right = "0";
    debugBox.style.background = "rgba(0,0,0,0.8)";
    debugBox.style.color = "#0f0";
    debugBox.style.fontFamily = "monospace";
    debugBox.style.fontSize = "12px";
    debugBox.style.padding = "10px 14px";
    debugBox.style.zIndex = "999999";
    debugBox.style.borderTopLeftRadius = "8px";
    debugBox.style.maxWidth = "280px";
    debugBox.style.lineHeight = "1.4";
    debugBox.innerHTML = `
      <b>IVR Debug Overlay</b><br>
      <small>(alleen zichtbaar in debugmodus)</small><br><br>
      <div id="ivr-debug-log">
        <span>t_id: ${t_id}</span><br>
        <span>aff_id: ${aff_id}</span><br>
        <span>offer_id: ${offer_id}</span><br>
        <span>sub_id: ${sub_id}</span><br><br>
        <span>Visit ID: <span id="dbg-visit-id">...</span></span><br>
        <span>PIN: <span id="dbg-pin">...</span></span>
      </div>
    `;
    document.body.appendChild(debugBox);
  }

  function updateDebug(key, value) {
    if (!isDebug || !debugBox) return;
    const el = document.getElementById(key);
    if (el) el.textContent = value;
  }

  // ------------------------------------------------------------
  // 📍 Helper: element tonen
  // ------------------------------------------------------------
  function showElement(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = "block";
  }

  // ------------------------------------------------------------
  // 🧾 1️⃣ Register Visit
  // ------------------------------------------------------------
  async function registerVisit() {
    const cached = sessionStorage.getItem("internalVisitId");
    if (cached) {
      console.log("🔁 Gebruik bestaande internalVisitId:", cached);
      updateDebug("dbg-visit-id", cached);
      return cached;
    }

    try {
      const res = await fetch(`${API_BASE}/api/register-visit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clickId: t_id,
          affId: aff_id,
          offerId: offer_id,
          subId: sub_id,
          subId2: sub_id_2,
          isMobile
        })
      });
      const data = await res.json();
      if (data.internalVisitId) {
        sessionStorage.setItem("internalVisitId", data.internalVisitId);
        console.log("✅ Visit geregistreerd:", data.internalVisitId);
        updateDebug("dbg-visit-id", data.internalVisitId);
        return data.internalVisitId;
      } else {
        console.warn("⚠️ Geen internalVisitId ontvangen:", data);
        updateDebug("dbg-visit-id", "❌ geen ID");
        return null;
      }
    } catch (err) {
      console.error("❌ Fout bij registerVisit:", err);
      updateDebug("dbg-visit-id", "❌ error");
      return null;
    }
  }

  // ------------------------------------------------------------
  // 🔢 2️⃣ Pincode ophalen
  // ------------------------------------------------------------
  async function requestPin(internalVisitId) {
    try {
      const res = await fetch(`${API_BASE}/api/request-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clickId: t_id,
          affId: aff_id,
          offerId: offer_id,
          subId: sub_id,
          subId2: sub_id_2,
          internalVisitId
        })
      });
      const data = await res.json();
      if (data.pincode) {
        console.log("🔢 Pincode ontvangen:", data.pincode);
        updateDebug("dbg-pin", data.pincode);

        const spinnerId = isMobile ? "pin-code-spinner-mobile" : "pin-code-spinner-desktop";
        showElement(isMobile ? "pin-container-mobile" : "pin-container-desktop");

        if (typeof animatePinRevealSpinner === "function") {
          animatePinRevealSpinner(data.pincode, spinnerId);
        } else {
          console.warn("⚠️ animatePinRevealSpinner() niet gevonden");
        }
      } else {
        console.warn("⚠️ Geen pincode in response:", data);
        updateDebug("dbg-pin", "❌ geen PIN");
      }
    } catch (err) {
      console.error("❌ Fout bij requestPin:", err);
      updateDebug("dbg-pin", "❌ error");
    }
  }

  // ------------------------------------------------------------
// 🕓 3️⃣ Watcher — detecteert wanneer IVR-sectie zichtbaar wordt
// ------------------------------------------------------------
function waitForIVRSection() {
  let triggered = false;

  // Helper om te checken of element echt zichtbaar is
  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0" &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  async function checkAndTrigger() {
    const ivrSection = document.getElementById("ivr-section");
    if (!ivrSection || triggered) return;
    if (isVisible(ivrSection)) {
      triggered = true;
      console.log("👀 IVR-sectie zichtbaar → start flow");
      const internalVisitId = await registerVisit();
      if (internalVisitId) await requestPin(internalVisitId);
    }
  }

  // 🔹 1. Start directe polling (voor fallback)
  const poll = setInterval(checkAndTrigger, 500);

  // 🔹 2. Observeer wijzigingen in de hele body (popup wordt vaak gemount via display toggle)
  const observer = new MutationObserver(() => checkAndTrigger());
  observer.observe(document.body, {
    attributes: true,
    childList: true,
    subtree: true,
    attributeFilter: ["style", "class"]
  });

  // Stop beide zodra triggered
  const stopAll = () => {
    if (triggered) {
      clearInterval(poll);
      observer.disconnect();
      console.log("✅ IVR Observer gestopt (sectie gedetecteerd)");
    }
  };
  const stopInterval = setInterval(stopAll, 1000);
}

  // ------------------------------------------------------------
  // 🚀 Start watcher + overlay
  // ------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    setupDebugOverlay();
    waitForIVRSection();
  });
})();
