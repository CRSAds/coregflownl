// =============================================================
// ✅ formSubmit.js — stabiele versie met correcte eventvolgorde
// shortform (925) + co-sponsors + longform + coreg flush + debug
// =============================================================

// ============================================
// 🧠 Global state initializer
// ============================================
window.shortFormCompleted = window.shortFormCompleted || false;
window.DEBUG_COREG_FLOW = window.DEBUG_COREG_FLOW || false;
window.coregDebugSessionId = window.coregDebugSessionId || (Date.now() + '-' + Math.random().toString(36).slice(2,8));
function debugLog(...args) {
  if (window.DEBUG_COREG_FLOW) {
    console.log('[COREG-DEBUG][' + window.coregDebugSessionId + ']', ...args);
  }
}
window.coregAnswersReady = window.coregAnswersReady || false;
window.coregFlowCompleted = window.coregFlowCompleted || false;

if (!window.formSubmitInitialized) {
  window.formSubmitInitialized = true;
  window.submittedCampaigns = window.submittedCampaigns || new Set();

  // 🔧 Logging toggle
  const DEBUG = true; // ← op false in productie
  const log = (...args) => { if (DEBUG) console.log(...args); };
  const warn = (...args) => { if (DEBUG) console.warn(...args); };
  const error = (...args) => { if (DEBUG) console.error(...args); };

  // ============================================================
  // 🔹 flushQueuedCoregLeads() — verzend bewaarde coreg antwoorden
  // ============================================================
  window.flushQueuedCoregLeads = async function flushQueuedCoregLeads() {
    console.log("🚀 flushQueuedCoregLeads() gestart...");
    const keys = Object.keys(sessionStorage).filter(k => k.startsWith("f_2014_coreg_answer_"));
    if (!keys.length) {
      console.log("ℹ️ Geen coreg antwoorden om te flushen.");
      return;
    }

    const pendingLongForms = JSON.parse(sessionStorage.getItem("longFormCampaigns") || "[]");
    for (const key of keys) {
      const cid = key.replace("f_2014_coreg_answer_", "");
      const isLongForm = pendingLongForms.some(p => String(p.cid) === cid);
      if (isLongForm) continue;

      const answer = sessionStorage.getItem(key);
      const payload = await window.buildPayload({
        cid,
        sid: "34",
        is_shortform: false,
        f_2014_coreg_answer: answer,
      });

      console.log(`📬 Flush coreg-lead ${cid}...`);
      const res = await window.fetchLead(payload);
      if (res && !res.skipped) sessionStorage.removeItem(key);
    }
    console.log("🏁 flushQueuedCoregLeads() voltooid.");
  };

  // ============================================================
  // 🔹 Tracking opslaan bij pageload
  // ============================================================
  document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    ["t_id", "aff_id", "sub_id", "sub2", "offer_id"].forEach(key => {
      const val = urlParams.get(key);
      if (val) sessionStorage.setItem(key, val);
    });
  });

  // ============================================================
  // 🔹 IP ophalen (1x per sessie)
  // ============================================================
  async function getIpOnce() {
    let ip = sessionStorage.getItem("user_ip");
    if (ip) return ip;
    try {
      const res = await fetch("https://api.ipify.org?format=json", { cache: "no-store" });
      const data = await res.json();
      ip = data.ip || "0.0.0.0";
    } catch {
      ip = "0.0.0.0";
    }
    sessionStorage.setItem("user_ip", ip);
    return ip;
  }

  // ============================================================
  // 🔹 Payload opbouwen
  // ============================================================
  async function buildPayload(campaign = {}) {
    const ip = await getIpOnce();
    const t_id = sessionStorage.getItem("t_id") || crypto.randomUUID();
    const aff_id = sessionStorage.getItem("aff_id") || "unknown";
    const offer_id = sessionStorage.getItem("offer_id") || "unknown";
    const sub_id = sessionStorage.getItem("sub_id") || "unknown";
    const sub2 = sessionStorage.getItem("sub2") || "unknown";
    const campaignUrl = `${window.location.origin}${window.location.pathname}?status=online`;

    // ✅ DOB parsing
    const dobValue = sessionStorage.getItem("dob");
    let dob = "";
    if (dobValue && dobValue.includes("/")) {
      const [dd, mm, yyyy] = dobValue.split("/");
      if (dd && mm && yyyy) dob = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    }

    const cid = campaign.cid || null;
    const sid = campaign.sid || null;
    const optindate = new Date().toISOString().split(".")[0] + "+0000";

    const payload = {
      cid,
      sid,
      gender: sessionStorage.getItem("gender") || "",
      firstname: sessionStorage.getItem("firstname") || "",
      lastname: sessionStorage.getItem("lastname") || "",
      email: sessionStorage.getItem("email") || "",
      postcode: sessionStorage.getItem("postcode") || "",
      straat: sessionStorage.getItem("straat") || "",
      huisnummer: sessionStorage.getItem("huisnummer") || "",
      woonplaats: sessionStorage.getItem("woonplaats") || "",
      telefoon: sessionStorage.getItem("telefoon") || "",
      dob,
      t_id,
      aff_id,
      offer_id,
      sub_id,
      sub2,
      f_1453_campagne_url: campaignUrl,
      f_17_ipaddress: ip,
      f_55_optindate: optindate,
      is_shortform: campaign.is_shortform || false,
    };

    if (campaign.f_2014_coreg_answer)
      payload.f_2014_coreg_answer = campaign.f_2014_coreg_answer;
    if (campaign.f_2575_coreg_answer_dropdown)
      payload.f_2575_coreg_answer_dropdown = campaign.f_2575_coreg_answer_dropdown;

    return payload;
  }
  window.buildPayload = buildPayload;

  // ============================================================
  // 🔹 Lead versturen
  // ============================================================
  async function fetchLead(payload) {
    if (!payload || !payload.cid || !payload.sid) {
      error("❌ fetchLead: ontbrekende cid/sid in payload:", payload);
      return { success: false, error: "Missing cid/sid" };
    }

    const key = `${payload.cid}_${payload.sid}`;
    if (window.submittedCampaigns.has(key)) return { skipped: true };

    try {
      const res = await fetch("https://globalcoregflow-nl.vercel.app/api/lead.js", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
        body: JSON.stringify(payload)
      });
      const text = await res.text();
      let result = {};
      try { result = text ? JSON.parse(text) : {}; } catch { result = { raw: text }; }
      log(`📨 Lead verstuurd naar ${payload.cid}/${payload.sid}:`, result);
      window.submittedCampaigns.add(key);
      return { success: true, result };
    } catch (err) {
      error("❌ Fout bij lead versturen:", err);
      return { success: false, error: err.message };
    }
  }
  window.fetchLead = fetchLead;

  // ============================================================
  // 🔹 DOB veld — autojump
  // ============================================================
  document.addEventListener("DOMContentLoaded", () => {
    const dobInput = document.getElementById("dob");
    if (!dobInput) return;

    dobInput.placeholder = "dd / mm / jjjj";
    dobInput.inputMode = "numeric";
    dobInput.maxLength = 14;

    const format = (digits) => {
      let out = "";
      if (digits.length >= 1) out += digits[0];
      if (digits.length >= 2) out += digits[1];
      if (digits.length >= 2) out += " / ";
      if (digits.length >= 3) out += digits[2];
      if (digits.length >= 4) out += digits[3];
      if (digits.length >= 4) out += " / ";
      if (digits.length >= 5) out += digits[4];
      if (digits.length >= 6) out += digits[5];
      if (digits.length >= 7) out += digits[6];
      if (digits.length >= 8) out += digits[7];
      return out;
    };

    dobInput.addEventListener("input", (e) => {
      let val = e.target.value.replace(/\D/g, "").slice(0, 8);
      const formatted = format(val);
      e.target.value = formatted;
      sessionStorage.setItem("dob", formatted.replace(/\s/g, ""));
    });
  });

  // ============================================================
  // 🔹 Shortform
  // ============================================================
  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("lead-form");
    if (!form) return;
    const btn = form.querySelector(".flow-next, button[type='submit']");
    if (!btn) return;
    let submitting = false;

    const handleShortForm = async (e) => {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      if (submitting) return;
      submitting = true;
      btn.disabled = true;

      try {
        const genderEl = form.querySelector("input[name='gender']:checked");
        if (genderEl) sessionStorage.setItem("gender", genderEl.value);
        ["firstname", "lastname", "email", "dob"].forEach(id => {
          const el = document.getElementById(id);
          if (el) sessionStorage.setItem(id, el.value.trim());
        });

        // shortform lead
        const basePayload = await window.buildPayload({
          cid: "925",
          sid: "34",
          is_shortform: true
        });
        debugLog('Shortform submit: fetchLead wordt aangeroepen', basePayload);
        window.fetchLead(basePayload)
          .then(r => debugLog("✅ Shortform 925 async verzonden:", r))
          .catch(err => debugLog("❌ Fout shortform 925 async:", err));

        // markeer voltooid
        window.shortFormCompleted = true;
        debugLog('shortFormSubmitted event wordt getriggerd');
        document.dispatchEvent(new Event("shortFormSubmitted"));
        debugLog('✅ Shortform voltooid — event getriggerd');
      } catch (err) {
        console.error("❌ Fout bij shortform:", err);
      } finally {
        submitting = false;
        btn.disabled = false;
      }
    };

    btn.addEventListener("click", handleShortForm, true);
  });

  // ============================================================
  // 🔹 Longform
  // ============================================================
  document.addEventListener("click", async (e) => {
    if (!e.target || !e.target.matches("#submit-long-form")) return;
    e.preventDefault();

    const form = document.getElementById("long-form");
    if (!form) return;

    const fields = ["postcode", "straat", "huisnummer", "woonplaats", "telefoon"];
    const invalid = fields.filter(id => !document.getElementById(id)?.value.trim());
    if (invalid.length) {
      alert("Vul alle verplichte velden in.");
      return;
    }

    fields.forEach(id => {
      const v = document.getElementById(id)?.value.trim() || "";
      if (v) sessionStorage.setItem(id, v);
    });

    const pending = JSON.parse(sessionStorage.getItem("longFormCampaigns") || "[]");
    if (!pending.length) {
      warn("⚠️ Geen longform campagnes om te versturen");
      document.dispatchEvent(new Event("longFormSubmitted"));
      return;
    }

    (async () => {
      try {
        await Promise.allSettled(pending.map(async camp => {
          const coregAns = sessionStorage.getItem(`f_2014_coreg_answer_${camp.cid}`);
          const dropdownAns = sessionStorage.getItem(`f_2575_coreg_answer_dropdown_${camp.cid}`);
          const payload = await buildPayload({
            cid: camp.cid,
            sid: camp.sid,
            f_2014_coreg_answer: coregAns || undefined,
            f_2575_coreg_answer_dropdown: dropdownAns || undefined
          });
          return window.fetchLead(payload);
        }));
        log("✅ Longform leads verzonden (async)");
        sessionStorage.removeItem("longFormCampaigns");
      } catch (err) {
        error("❌ Fout bij longform (async):", err);
      }
    })();

    document.dispatchEvent(new Event("longFormSubmitted"));
  });

  // ============================================================
  // 📡 shortFormSubmitted listener — binnen DOMContentLoaded!
  // ============================================================
  document.addEventListener("DOMContentLoaded", () => {
    document.addEventListener("shortFormSubmitted", async () => {
      try {
        debugLog("🚀 shortFormSubmitted event ONTVANGEN — start coreg-verzending...");
        const allKeys = Object.keys(sessionStorage).filter(k => k.startsWith("f_2014_coreg_answer_"));
        if (!allKeys.length) {
          console.log("ℹ️ Geen coreg-antwoorden gevonden om te versturen na shortform.");
          return;
        }

        const pendingLongForms = JSON.parse(sessionStorage.getItem("longFormCampaigns") || "[]");
        for (const key of allKeys) {
          const cid = key.replace("f_2014_coreg_answer_", "");
          const isLongForm = pendingLongForms.some(p => String(p.cid) === cid);
          if (isLongForm) continue;

          const answer = sessionStorage.getItem(key) || "";
          const payload = await window.buildPayload({
            cid,
            sid: "34",
            is_shortform: false,
            f_2014_coreg_answer: answer,
          });

          debugLog(`Coreg payload gereed voor verzending: CID=${cid}, SID=34`, payload);
          const res = await window.fetchLead(payload);
          debugLog(`✅ Coreg sponsor ${cid} lead verzonden naar Databowl:`, res);
        }

        console.log("🏁 Alle coreg-leads succesvol verzonden na shortform.");
      } catch (err) {
        console.error("💥 Fout bij coreg-verzending na shortform:", err);
      }
    });
  });

  // ============================================================
  // 🔁 Fallback-trigger — shortform was al klaar
  // ============================================================
  setTimeout(() => {
    if (window.shortFormCompleted && !window.shortFormFlushed) {
      debugLog("🔁 Fallback: shortFormCompleted was al true → coreg flush alsnog.");
      document.dispatchEvent(new Event("shortFormSubmitted"));
      window.shortFormFlushed = true;
    }
  }, 1000);
}
