// =============================================================
// ✅ formSubmit.js — productieversie (geen console-spam)
// =============================================================

if (!window.formSubmitInitialized) {
  window.formSubmitInitialized = true;
  window.submittedCampaigns = window.submittedCampaigns || new Set();

  // 🔧 Debug logging volledig uit in productie
  const DEBUG = false;
  
  // alles wat log() / warn() aanroept wordt een no-op
  const log   = () => {};
  const warn  = () => {};
  
  // errors blijven zichtbaar
  const error = (...args) => console.error(...args);

  // -----------------------------------------------------------
  // Tracking opslaan bij pageload
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

    const t_id     = sessionStorage.getItem("t_id")     || crypto.randomUUID();
    const aff_id   = sessionStorage.getItem("aff_id")   || "unknown";
    const offer_id = sessionStorage.getItem("offer_id") || "unknown";
    const sub_id   = sessionStorage.getItem("sub_id")   || "unknown";
    const sub2     = sessionStorage.getItem("sub2")     || "unknown";

    const campaignUrl = `${window.location.origin}${window.location.pathname}?status=online`;

    // DOB (ISO)
    const dobValue = sessionStorage.getItem("dob");
    let dob = "";
    if (dobValue?.includes("/")) {
      const [dd, mm, yyyy] = dobValue.split("/");
      dob = `${yyyy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`;
    }

    // CID / SID normaliseren
    let cid = campaign.cid || null;
    let sid = campaign.sid || null;
    if (!cid || cid === "undefined") cid = null;
    if (!sid || sid === "undefined") sid = null;

    const payload = {
      cid,
      sid,
      gender:     sessionStorage.getItem("gender")     || "",
      firstname:  sessionStorage.getItem("firstname")  || "",
      lastname:   sessionStorage.getItem("lastname")   || "",
      email:      sessionStorage.getItem("email")      || "",
      postcode:   sessionStorage.getItem("postcode")   || "",
      straat:     sessionStorage.getItem("straat")     || "",
      huisnummer: sessionStorage.getItem("huisnummer") || "",
      woonplaats: sessionStorage.getItem("woonplaats") || "",
      telefoon:   sessionStorage.getItem("telefoon")   || "",
      dob,
      t_id,
      aff_id,
      offer_id,
      sub_id,
      sub2,
      f_1453_campagne_url: campaignUrl,
      f_17_ipaddress: ip,
      f_55_optindate: new Date().toISOString().split(".")[0] + "+0000",
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
    if (!payload?.cid || !payload?.sid) {
      error("❌ fetchLead: ontbrekende cid/sid:", payload);
      return { success: false };
    }

    const key = `${payload.cid}_${payload.sid}`;
    if (window.submittedCampaigns.has(key)) return { skipped: true };

    try {
      const res = await fetch("https://globalcoregflow-nl.vercel.app/api/lead.js", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
        body: JSON.stringify(payload)
      });

      const txt = await res.text();
      let json = {};
      try { json = txt ? JSON.parse(txt) : {}; } catch { json = { raw: txt }; }

      window.submittedCampaigns.add(key);
      return json;
    } catch (err) {
      error("❌ Fout bij lead versturen:", err);
      return { success: false };
    }
  }
  window.fetchLead = fetchLead;

  // -----------------------------------------------------------
  // 🔹 DOB autoformatting (blijft ongewijzigd)
  // -----------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    const dobInput = document.getElementById("dob");
    if (!dobInput) return;

    dobInput.placeholder = "dd / mm / jjjj";
    dobInput.inputMode = "numeric";
    dobInput.maxLength = 14;

    const format = digits => {
      let o = "";
      if (digits.length >= 1) o += digits[0];
      if (digits.length >= 2) o += digits[1] + " / ";
      if (digits.length >= 3) o += digits[2];
      if (digits.length >= 4) o += digits[3] + " / ";
      if (digits.length >= 5) o += digits[4];
      if (digits.length >= 6) o += digits[5];
      if (digits.length >= 7) o += digits[6];
      if (digits.length >= 8) o += digits[7];
      return o;
    };

    dobInput.addEventListener("input", e => {
      let v = e.target.value.replace(/\D/g, "").slice(0, 8);
      const formatted = format(v);
      e.target.value = formatted;
      sessionStorage.setItem("dob", formatted.replace(/\s/g, ""));
    });
  });

  // -----------------------------------------------------------
  // 🔹 Shortform submit
  // -----------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("lead-form");
    if (!form) return;

    const btn = form.querySelector(".flow-next, button[type='submit']");
    if (!btn) return;

    let submitting = false;

    const handleShortForm = async e => {
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
        // Velden opslaan
        const genderEl = form.querySelector("input[name='gender']:checked");
        if (genderEl) sessionStorage.setItem("gender", genderEl.value);

        ["firstname", "lastname", "email", "dob"].forEach(id => {
          const el = document.getElementById(id);
          if (!el) return;
          sessionStorage.setItem(id, el.value.trim().replace(/\s/g, ""));
        });

        if (typeof getIpOnce === "function") getIpOnce();

        // Async verzending zonder logs
        (async () => {
          try {
            const basePayload = await window.buildPayload({ cid: "925", sid: "34", is_shortform: true });
            window.fetchLead(basePayload);

            const accepted = sessionStorage.getItem("sponsorsAccepted") === "true";
            if (accepted) {
              const res = await fetch("https://globalcoregflow-nl.vercel.app/api/cosponsors.js");
              const json = await res.json();
              if (Array.isArray(json.data)) {
                Promise.allSettled(
                  json.data.map(async s => {
                    const p = await window.buildPayload({ cid: s.cid, sid: s.sid, is_shortform: true });
                    return window.fetchLead(p);
                  })
                );
              }
            }
          } catch {}
        })();

        // Markeer shortform klaar
        sessionStorage.setItem("shortFormCompleted", "true");
        document.dispatchEvent(new Event("shortFormSubmitted"));

      } catch (err) {
        error("❌ Shortform fout:", err);
      } finally {
        submitting = false;
        btn.disabled = false;
      }
    };

    btn.addEventListener("click", handleShortForm, true);
    form.addEventListener("keydown", e => {
      if (e.key === "Enter") handleShortForm(e);
    }, true);
  });

  // -----------------------------------------------------------
  // 🔹 Longform submit
  // -----------------------------------------------------------
  document.addEventListener("click", async e => {
    if (!e.target?.matches("#submit-long-form")) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    const form = document.getElementById("long-form");
    if (!form) return;

    const fields = ["postcode", "straat", "huisnummer", "woonplaats", "telefoon"];
    const invalid = fields.filter(id => !document.getElementById(id)?.value.trim());
    if (invalid.length) return alert("Vul alle verplichte velden in.");

    // Server-side adrescheck
    const pc = document.getElementById("postcode").value.replace(/\s+/g, "");
    const hn = document.getElementById("huisnummer").value.trim();
    try {
      const r = await fetch("https://globalcoregflow-nl.vercel.app/api/validateAddressNL.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postcode: pc, huisnummer: hn })
      });
      const data = await r.json();
      if (!data.valid) return alert("Adres niet gevonden.");

      if (data.street && !document.getElementById("straat").value)
        document.getElementById("straat").value = data.street;

      if (data.city && !document.getElementById("woonplaats").value)
        document.getElementById("woonplaats").value = data.city;
    } catch {
      return alert("Adresvalidatie niet mogelijk.");
    }

    // Opslaan
    fields.forEach(id => sessionStorage.setItem(id, document.getElementById(id).value.trim()));

    const pending = JSON.parse(sessionStorage.getItem("longFormCampaigns") || "[]");
    if (!pending.length) {
      document.dispatchEvent(new Event("longFormSubmitted"));
      return;
    }

    if (typeof getIpOnce === "function") getIpOnce();

    (async () => {
      try {
        await Promise.allSettled(
          pending.map(async camp => {
            const ans = sessionStorage.getItem(`f_2014_coreg_answer_${camp.cid}`);
            const drop = sessionStorage.getItem(`f_2575_coreg_answer_dropdown_${camp.cid}`);
            const payload = await buildPayload({
              cid: camp.cid,
              sid: camp.sid,
              f_2014_coreg_answer: ans || undefined,
              f_2575_coreg_answer_dropdown: drop || undefined
            });
            return window.fetchLead(payload);
          })
        );
        sessionStorage.removeItem("longFormCampaigns");
      } catch {}
    })();

    document.dispatchEvent(new Event("longFormSubmitted"));
  });

  // -----------------------------------------------------------
  // 🔹 Sponsor akkoord
  // -----------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("accept-sponsors-btn");
    if (!btn) return;
    btn.addEventListener("click", () => sessionStorage.setItem("sponsorsAccepted", "true"));
  });

  // -----------------------------------------------------------
  // 🔹 Eén nette loaded melding
  // -----------------------------------------------------------
  console.info("🎉 formSubmit loaded successfully");
}
