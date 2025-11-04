// =============================================================
// ✅ ivr-handler.js — nieuwe IVR flow met zelfde gedrag als oude versie
// =============================================================
(function () {
  console.log("📞 ivr-handler.js gestart");
  const API_BASE = "https://coregflownl.vercel.app";

  const urlParams = new URLSearchParams(window.location.search);
  const affId = urlParams.get("aff_id") || "unknown";
  const offerId = urlParams.get("offer_id") || "unknown";
  const subId = urlParams.get("sub_id") || "unknown";

  function getTransactionId() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0,
        v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  const transaction_id = urlParams.get("t_id") || getTransactionId();
  sessionStorage.setItem("t_id", transaction_id);
  sessionStorage.setItem("aff_id", affId);
  sessionStorage.setItem("offer_id", offerId);
  sessionStorage.setItem("sub_id", subId);

  const isMobile = window.innerWidth < 768;
  console.log("📱 Apparaatstype:", isMobile ? "mobile" : "desktop");

  document.addEventListener("DOMContentLoaded", async () => {
    const mobile = document.getElementById("ivr-mobile");
    const desktop = document.getElementById("ivr-desktop");
    if (mobile && desktop) {
      mobile.style.display = isMobile ? "block" : "none";
      desktop.style.display = isMobile ? "none" : "block";
    }

    // 1️⃣ Register visit direct bij pageload
    async function registerVisit() {
      const cached = sessionStorage.getItem("internalVisitId");
      if (cached) return cached;
      try {
        const res = await fetch(`${API_BASE}/api/register-visit.js`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clickId: transaction_id,
            affId,
            offerId,
            subId,
            subId2: subId,
            isMobile,
          }),
        });
        const data = await res.json();
        if (data.internalVisitId) {
          sessionStorage.setItem("internalVisitId", data.internalVisitId);
          console.log("✅ Visit geregistreerd:", data.internalVisitId);
          return data.internalVisitId;
        }
      } catch (err) {
        console.error("❌ registerVisit:", err);
      }
      return null;
    }

    const visitPromise = registerVisit();

    // 2️⃣ Functie om pincode-animatie te starten
    function animatePinRevealSpinner(pin, targetId) {
      const container = document.getElementById(targetId);
      if (!container) return;
      const digits = container.querySelectorAll(".digit-inner");
      const pinStr = pin.toString().padStart(3, "0");

      pinStr.split("").forEach((digit, i) => {
        const inner = digits[i];
        inner.innerHTML = "";
        for (let j = 0; j <= 9; j++) {
          const span = document.createElement("span");
          span.textContent = j;
          inner.appendChild(span);
        }
        const targetOffset = parseInt(digit, 10) * 64;
        setTimeout(() => {
          inner.style.transform = `translateY(-${targetOffset}px)`;
        }, 100);
      });
    }

    // 3️⃣ Poll-functie om te wachten tot de sectie zichtbaar is
    function waitForIVRSectionAndShowPin() {
      let ivrShown = false;
      const interval = setInterval(() => {
        const ivr = document.getElementById("ivr-section");
        if (!ivr) return;
        const style = window.getComputedStyle(ivr);
        const isVisible =
          style.display !== "none" &&
          style.opacity !== "0" &&
          ivr.offsetHeight > 0;

        if (isVisible && !ivrShown) {
          ivrShown = true;
          clearInterval(interval);
          console.log("👀 IVR section visible → showing PIN...");

          const containerId = isMobile
            ? "pin-container-mobile"
            : "pin-container-desktop";
          const spinnerId = isMobile
            ? "pin-code-spinner-mobile"
            : "pin-code-spinner-desktop";
          document.getElementById(containerId).style.display = "block";

          visitPromise.then(async (internalVisitId) => {
            if (!internalVisitId) return;
            try {
              const res = await fetch(`${API_BASE}/api/request-pin.js`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                clickId: transaction_id,
                affId,
                offerId,
                subId,
                subId2: subId,
                internalVisitId,
              }),
            });
              const data = await res.json();
              if (data.pincode) {
                console.log("🔢 PIN ontvangen:", data.pincode);
                animatePinRevealSpinner(data.pincode, spinnerId);
              } else {
                console.warn("⚠️ Geen pincode:", data);
              }
            } catch (err) {
              console.error("❌ requestPin:", err);
            }
          });
        }
      }, 200);
    }

    waitForIVRSectionAndShowPin();
  });
})();
