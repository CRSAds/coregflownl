// =============================================================
// ✅ formSubmit.js — unified versie met auto-jump DOB, IP-tracking,
// shortform (925) + co-sponsors + longform + CID/SID fix
// + pendingShortCoreg → verplaatst naar shortFormSubmitted event
// =============================================================

if (!window.formSubmitInitialized) {
  window.formSubmitInitialized = true;
  window.submittedCampaigns = window.submittedCampaigns || new Set();
  window.pendingShortCoreg = window.pendingShortCoreg || []; // 🆕 buffer

  const DEBUG = true;
  const log = (...a) => DEBUG && console.log(...a);
  const warn = (...a) => DEBUG && console.warn(...a);
  const error = (...a) => DEBUG && console.error(...a);

  // -----------------------------------------------------------
  // Tracking
  // -----------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    ["t_id", "aff_id", "sub_id", "sub2", "offer_id"].forEach(k => {
      const v = params.get(k);
      if (v) sessionStorage.setItem(k, v);
    });
  });

  // -----------------------------------------------------------
  // IP ophalen
  // -----------------------------------------------------------
  async function getIpOnce() {
    let ip = sessionStorage.getItem("user_ip");
    if (ip) return ip;

    try {
      const r = await fetch("https://api.ipify.org?format=json");
      const d = await r.json();
      ip = d.ip || "0.0.0.0";
    } catch {
      ip = "0.0.0.0";
    }
    sessionStorage.setItem("user_ip", ip);
    return ip;
  }

  // -----------------------------------------------------------
  // Payload bouwen
  // -----------------------------------------------------------
  async function buildPayload(c = {}) {
    const ip = await getIpOnce();

    const t_id = sessionStorage.getItem("t_id") || crypto.randomUUID();
    const aff_id = sessionStorage.getItem("aff_id") || "unknown";
    const offer_id = sessionStorage.getItem("offer_id") || "unknown";
    const sub_id = sessionStorage.getItem("sub_id") || "unknown";
    const sub2 = sessionStorage.getItem("sub2") || "unknown";

    const campaignUrl =
      `${window.location.origin}${window.location.pathname}?status=online`;

    // DOB
    const dobValue = sessionStorage.getItem("dob");
    let dob = "";
    if (dobValue?.includes("/")) {
      const [dd, mm, yyyy] = dobValue.split("/");
      if (dd && mm && yyyy) dob = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    }

    let cid = c.cid;
    let sid = c.sid;
    if (!cid || cid === "undefined") cid = null;
    if (!sid || sid === "undefined") sid = null;

    const payload = {
      cid,
      sid,
      firstname: sessionStorage.getItem("firstname") || "",
      lastname: sessionStorage.getItem("lastname") || "",
      email: sessionStorage.getItem("email") || "",
      gender: sessionStorage.getItem("gender") || "",
      dob,
      postcode: sessionStorage.getItem("postcode") || "",
      straat: sessionStorage.getItem("straat") || "",
      huisnummer: sessionStorage.getItem("huisnummer") || "",
      woonplaats: sessionStorage.getItem("woonplaats") || "",
      telefoon: sessionStorage.getItem("telefoon") || "",
      f_1453_campagne_url: campaignUrl,
      f_17_ipaddress: ip,
      f_55_optindate: new Date().toISOString().split(".")[0] + "+0000",
      t_id, aff_id, offer_id, sub_id, sub2,
      is_shortform: c.is_shortform || false
    };

    if (c.f_2014_coreg_answer)
      payload.f_2014_coreg_answer = c.f_2014_coreg_answer;

    if (c.f_2575_coreg_answer_dropdown)
      payload.f_2575_coreg_answer_dropdown = c.f_2575_coreg_answer_dropdown;

    return payload;
  }
  window.buildPayload = buildPayload;

  // -----------------------------------------------------------
  // Lead versturen
  // -----------------------------------------------------------
  async function fetchLead(payload) {
    if (!payload?.cid || !payload?.sid) {
      error("❌ fetchLead: ontbrekende cid/sid:", payload);
      return;
    }

    const key = `${payload.cid}_${payload.sid}`;
    if (window.submittedCampaigns.has(key)) return;

    try {
      const r = await fetch("https://globalcoregflow-nl.vercel.app/api/lead.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const t = await r.text();
      let j;
      try { j = JSON.parse(t); } catch { j = { raw: t }; }

      log(`📨 Lead verstuurd naar ${payload.cid}/${payload.sid}:`, j);
      window.submittedCampaigns.add(key);
      return j;
    } catch (e) {
      error("❌ Fout bij lead:", e);
    }
  }
  window.fetchLead = fetchLead;

  // -----------------------------------------------------------
  // Shortform logica
  // -----------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("lead-form");
    if (!form) return;
    const btn = form.querySelector(".flow-next, button[type='submit']");
    if (!btn) return;

    let submitting = false;

    const submitShortForm = async (e) => {
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
        // Save fields
        const genderEl = form.querySelector("input[name='gender']:checked");
        if (genderEl) sessionStorage.setItem("gender", genderEl.value);

        ["firstname", "lastname", "email", "dob"].forEach(id => {
          const el = document.getElementById(id);
          if (el) {
            let v = el.value.trim();
            if (id === "dob") v = v.replace(/\s/g, "");
            sessionStorage.setItem(id, v);
          }
        });

        sessionStorage.setItem("shortFormCompleted", "true");

        // async IIFE
        (async () => {
          try {
            // 1) shortform 925
            const p925 = await buildPayload({ cid: "925", sid: "34", is_shortform: true });
            window.fetchLead(p925).then(() => log("✔ Shortform lead verstuurd"));

            // 2) cosponsors
            const accepted = sessionStorage.getItem("sponsorsAccepted") === "true";
            if (accepted) {
              const r = await fetch("https://globalcoregflow-nl.vercel.app/api/cosponsors.js");
              const json = await r.json();
              if (json.data?.length) {
                Promise.allSettled(
                  json.data.map(async s => {
                    const sp = await buildPayload({ cid: s.cid, sid: s.sid, is_shortform: true });
                    return window.fetchLead(sp);
                  })
                );
              }
            }

          } catch (err) {
            error("❌ fout shortform async:", err);
          }
        })();

        // 🚀 Trigger flow-change (Swipe Pages)
        document.dispatchEvent(new Event("shortFormSubmitted"));
        log("➡️ Flow direct vervolgd (fire-and-forget)");

      } catch (e) {
        error(e);
      } finally {
        submitting = false;
        btn.disabled = false;
      }
    };

    btn.addEventListener("click", submitShortForm, true);
    form.addEventListener("keydown", e => {
      if (e.key === "Enter") submitShortForm(e);
    }, true);
  });

  // -----------------------------------------------------------
  // Longform (ongewijzigd)
  // -----------------------------------------------------------
  document.addEventListener("click", async (e) => {
    if (!e.target.matches("#submit-long-form")) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const form = document.getElementById("long-form");
    if (!form) return;

    const req = ["postcode", "straat", "huisnummer", "woonplaats", "telefoon"];
    const missing = req.filter(id => !document.getElementById(id)?.value.trim());
    if (missing.length) {
      alert("Vul alle verplichte velden in.");
      return;
    }

    // validate address
    const pc = document.getElementById("postcode").value.replace(/\s+/g, "");
    const hn = document.getElementById("huisnummer").value.trim();

    try {
      const val = await fetch("https://globalcoregflow-nl.vercel.app/api/validateAddressNL.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postcode: pc, huisnummer: hn })
      });
      const d = await val.json();
      if (!d.valid) {
        alert("Adres niet gevonden");
        return;
      }
    } catch {
      alert("Adresvalidatie mislukt.");
      return;
    }

    // Save fields
    req.forEach(id => {
      const v = document.getElementById(id)?.value.trim();
      if (v) sessionStorage.setItem(id, v);
    });

    const pending = JSON.parse(sessionStorage.getItem("longFormCampaigns") || "[]");
    if (!pending.length) {
      document.dispatchEvent(new Event("longFormSubmitted"));
      return;
    }

    (async () => {
      await Promise.allSettled(
        pending.map(async camp => {
          const ans = sessionStorage.getItem(`f_2014_coreg_answer_${camp.cid}`);
          const drop = sessionStorage.getItem(`f_2575_coreg_answer_dropdown_${camp.cid}`);
          const p = await buildPayload({
            cid: camp.cid,
            sid: camp.sid,
            f_2014_coreg_answer: ans,
            f_2575_coreg_answer_dropdown: drop
          });
          return window.fetchLead(p);
        })
      );
      sessionStorage.removeItem("longFormCampaigns");
    })();

    document.dispatchEvent(new Event("longFormSubmitted"));
  });

  // -----------------------------------------------------------
  // Sponsor akkoord
  // -----------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("accept-sponsors-btn");
    if (btn) {
      btn.addEventListener("click", () => {
        sessionStorage.setItem("sponsorsAccepted", "true");
        log("✔ Sponsors geaccepteerd");
      });
    }
  });
