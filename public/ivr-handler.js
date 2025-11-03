// =============================================================
// ✅ ivr-handler.js — nieuwe IVR integratie met Directus + Vercel API's
// =============================================================
(function () {
  console.log("📞 ivr-handler.js gestart");

  // Helper: random fallback UUID voor clickId
  function getUUID() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // ------------------------------------------------------------
  // 📦 Basis tracking ophalen (hergebruikt van formSubmit.js)
  // ------------------------------------------------------------
  const urlParams = new URLSearchParams(window.location.search);
  const t_id = urlParams.get("t_id") || getUUID();
  const aff_id = urlParams.get("aff_id") || "unknown";
  const offer_id = urlParams.get("offer_id") || "unknown";
  const sub_id = urlParams.get("sub_id") || "unknown";
  const sub_id_2 = urlParams.get("sub_id_2") || sub_id;

  sessionStorage.setItem("t_id", t_id);
  sessionStorage.setItem("aff_id", aff_id);
  sessionStorage.setItem("offer_id", offer_id);
  sessionStorage.setItem("sub_id", sub_id);
  sessionStorage.setItem("sub_id_2", sub_id_2);

  const isMobile = window.innerWidth < 768;
  console.log("📱 Apparaatstype:", isMobile ? "mobile" : "desktop");

  // ------------------------------------------------------------
  // 📍 Helper: element tonen/verbergen
  // ------------------------------------------------------------
  function showElement(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = "block";
  }

  // ------------------------------------------------------------
  // 🧾 1️⃣ Register Visit → nieuwe visit in Directus
  // ------------------------------------------------------------
  async function registerVisit() {
    const cached = sessionStorage.getItem("internalVisitId");
    if (cached) {
      console.log("🔁 Gebruik bestaande internalVisitId:", cached);
      return cached;
    }

    try {
      const res = await fetch("/api/register-visit", {
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
        return data.internalVisitId;
      } else {
        console.warn("⚠️ Geen internalVisitId ontvangen:", data);
        return null;
      }
    } catch (err) {
      console.error("❌ Fout bij registerVisit:", err);
      return null;
    }
  }

  // ------------------------------------------------------------
  // 🔢 2️⃣ Pincode ophalen zodra IVR-sectie zichtbaar is
  // ------------------------------------------------------------
  async function requestPin(internalVisitId) {
    try {
      const res = await fetch("/api/request-pin", {
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
        const spinnerId = isMobile ? "pin-code-spinner-mobile" : "pin-code-spinner-desktop";
        showElement(isMobile ? "pin-container-mobile" : "pin-container-desktop");
        if (typeof animatePinRevealSpinner === "function") {
          animatePinRevealSpinner(data.pincode, spinnerId);
        } else {
          console.warn("⚠️ animatePinRevealSpinner() niet gevonden");
        }
      } else {
        console.warn("⚠️ Geen pincode in response:", data);
      }
    } catch (err) {
      console.error("❌ Fout bij requestPin:", err);
    }
  }

  // ------------------------------------------------------------
  // 🕓 3️⃣ Watcher — wacht tot IVR-sectie zichtbaar is
  // ------------------------------------------------------------
  function waitForIVRSection() {
    let triggered = false;
    const interval = setInterval(async () => {
      const ivrSection = document.getElementById("ivr-section");
      if (!ivrSection) return;

      const style = window.getComputedStyle(ivrSection);
      const visible =
        style &&
        style.display !== "none" &&
        style.opacity !== "0" &&
        ivrSection.offsetHeight > 0;

      if (visible && !triggered) {
        triggered = true;
        clearInterval(interval);
        console.log("👀 IVR-sectie zichtbaar → start flow");

        const internalVisitId = await registerVisit();
        if (internalVisitId) await requestPin(internalVisitId);
      }
    }, 200);
  }

  // ------------------------------------------------------------
  // 🚀 Start watchers
  // ------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    waitForIVRSection();
  });
})();
