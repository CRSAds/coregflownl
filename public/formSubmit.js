// =============================================================
// ✅ formSubmit.js — unified versie met auto-jump DOB, IP-tracking,
// shortform (925) + co-sponsors + longform + CID/SID fix + DEBUG toggle
// =============================================================

if (!window.formSubmitInitialized) {
  window.formSubmitInitialized = true;
  window.submittedCampaigns = window.submittedCampaigns || new Set();

  // 🔧 Toggle logging hier
  const DEBUG = false; // ← zet op false in productie en true bij testen
  const log = (...args) => { if (DEBUG) console.log(...args); };
  const warn = (...args) => { if (DEBUG) console.warn(...args); };
  const error = (...args) => { if (DEBUG) console.error(...args); };

  // -----------------------------------------------------------
  // 🔹 Tracking opslaan bij pageload
  // -----------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    ["t_id", "aff_id", "sub_id", "sub2", "offer_id"].forEach(key => {
      const val = urlParams.get(key);
      if (val) sessionStorage.setItem(key, val);
    });
  });

  // -----------------------------------------------------------
  // 🔹 IP ophalen (1x per sessie)
  // -----------------------------------------------------------
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

// -----------------------------------------------------------
// 🔹 Payload opbouwen
// -----------------------------------------------------------
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
    if (dd && mm && yyyy) dob = `${yyyy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`;
  }

  // ✅ CID/SID fix
  let cid = campaign.cid;
  let sid = campaign.sid;
  if (cid === "undefined" || cid === undefined || cid === "") cid = null;
  if (sid === "undefined" || sid === undefined || sid === "") sid = null;

  // ✅ Optindate (UTC ISO +0000)
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
    f_55_optindate: optindate, // ✅ nieuw toegevoegd
    is_shortform: campaign.is_shortform || false,
  };

  if (campaign.f_2014_coreg_answer)
    payload.f_2014_coreg_answer = campaign.f_2014_coreg_answer;
  if (campaign.f_2575_coreg_answer_dropdown)
    payload.f_2575_coreg_answer_dropdown = campaign.f_2575_coreg_answer_dropdown;

  return payload;
}
  window.buildPayload = buildPayload;

  // -----------------------------------------------------------
  // 🔹 Lead versturen
  // -----------------------------------------------------------
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
      return result;
    } catch (err) {
      error("❌ Fout bij lead versturen:", err);
      return { success: false, error: err.message };
    }
  }
  window.fetchLead = fetchLead;

  // -----------------------------------------------------------
  // 🔹 Slim DOB veld — autojump
  // -----------------------------------------------------------
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
      let jumpToMonth = false, jumpToYear = false;
      if (val.length === 1 && parseInt(val[0], 10) >= 4) { val = "0" + val; jumpToMonth = true; }
      if (val.length === 3 && parseInt(val[2], 10) >= 2) { val = val.slice(0,2) + "0" + val.slice(2); jumpToYear = true; }

      const formatted = format(val);
      e.target.value = formatted;
      sessionStorage.setItem("dob", formatted.replace(/\s/g, ""));
      if (jumpToMonth && val.length === 2) {
        const pos = formatted.indexOf("/") + 3; e.target.setSelectionRange(pos, pos);
      } else if (jumpToYear && val.length === 4) {
        const pos = formatted.lastIndexOf("/") + 3; e.target.setSelectionRange(pos, pos);
      }
    });
  });

  // -----------------------------------------------------------
  // 🔹 Shortform — volledig async
  // -----------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("lead-form");
    if (!form) return;

    const btn = form.querySelector(".flow-next, button[type='submit']");
    if (!btn) return;

    let submitting = false;

    const handleShortForm = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

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
          if (!el) return;
          let v = (el.value || "").trim();
          if (id === "dob") v = v.replace(/\s/g, "");
          sessionStorage.setItem(id, v);
        });

        if (typeof getIpOnce === "function") getIpOnce();

        (async () => {
          try {
            const basePayload = await window.buildPayload({ cid: "925", sid: "34", is_shortform: true });
            window.fetchLead(basePayload)
              .then(r => log("✅ Shortform 925 async verzonden:", r))
              .catch(err => error("❌ Fout shortform 925 async:", err));

            const accepted = sessionStorage.getItem("sponsorsAccepted") === "true";
            if (accepted) {
              const res = await fetch("https://globalcoregflow-nl.vercel.app/api/cosponsors.js", { cache: "no-store" });
              const json = await res.json();
              if (Array.isArray(json.data) && json.data.length) {
                log(`📡 Verstuur ${json.data.length} co-sponsors async...`);
                Promise.allSettled(json.data.map(async s => {
                  if (!s?.cid || !s?.sid) return;
                  const spPayload = await window.buildPayload({ cid: s.cid, sid: s.sid, is_shortform: true });
                  return window.fetchLead(spPayload);
                }))
                .then(() => log("✅ Co-sponsors klaar (async)"))
                .catch(err => warn("⚠️ Co-sponsors fout (async):", err));
              } else {
                log("ℹ️ Geen actieve co-sponsors gevonden");
              }
            } else {
              warn("⚠️ Sponsors niet geaccepteerd — geen co-sponsors verzonden");
            }
          } catch (err) {
            error("💥 Async shortform fout:", err);
          }
        })();

        document.dispatchEvent(new Event("shortFormSubmitted"));
        log("➡️ Flow direct vervolgd (fire-and-forget)");
      } catch (err) {
        error("❌ Fout bij start shortform async:", err);
      } finally {
        submitting = false;
        btn.disabled = false;
      }
    };

    btn.addEventListener("click", handleShortForm, true);
    form.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleShortForm(e);
    }, true);
  });

  // -----------------------------------------------------------
  // 🔹 Longform — volledig async
  // -----------------------------------------------------------
  document.addEventListener("click", async (e) => {
    if (!e.target || !e.target.matches("#submit-long-form")) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

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

    if (typeof getIpOnce === "function") getIpOnce();

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
    log("➡️ Flow direct vervolgd (longform fire-and-forget)");
  });

  // -----------------------------------------------------------
  // 🔹 Sponsor akkoord
  // -----------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    const acceptBtn = document.getElementById("accept-sponsors-btn");
    if (!acceptBtn) return;
    acceptBtn.addEventListener("click", () => {
      sessionStorage.setItem("sponsorsAccepted", "true");
      log("✅ Sponsors akkoord");
    });
  });
}
