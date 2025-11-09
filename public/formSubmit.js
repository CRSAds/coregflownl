// =============================================================
// ✅ formSubmit.js — stabiele shortform + co-sponsor verzending (met enkel DOB-veld)
// =============================================================

if (!window.formSubmitInitialized) {
  window.formSubmitInitialized = true;
  window.submittedCampaigns = window.submittedCampaigns || new Set();

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
  // 🔹 Payload opbouwen
  // -----------------------------------------------------------
  function buildPayload(campaign = {}) {
    const t_id = sessionStorage.getItem("t_id") || crypto.randomUUID();
    const aff_id = sessionStorage.getItem("aff_id") || "unknown";
    const offer_id = sessionStorage.getItem("offer_id") || "unknown";
    const sub_id = sessionStorage.getItem("sub_id") || "unknown";
    const sub2 = sessionStorage.getItem("sub2") || "unknown";
    const campaignUrl = `${window.location.origin}${window.location.pathname}?status=online`;

    // ✅ Nieuw: geboortedatum in ISO 8601 (yyyy-mm-dd)
    const dobValue = sessionStorage.getItem("dob");
    let dob = "";
    if (dobValue && dobValue.includes("/")) {
      const [rawDD, rawMM, rawYYYY] = dobValue.split("/");
      const dd = (rawDD || "").replace(/\s/g, "");
      const mm = (rawMM || "").replace(/\s/g, "");
      const yyyy = (rawYYYY || "").replace(/\s/g, "");
      if (dd && mm && yyyy) {
        dob = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
      }
    }

    return {
      // vaste Databowl-campagne ID’s
      cid: campaign.cid || "925",
      sid: campaign.sid || "34",

      // formulierdata
      gender: sessionStorage.getItem("gender") || "",
      firstname: sessionStorage.getItem("firstname") || "",
      lastname: sessionStorage.getItem("lastname") || "",
      email: sessionStorage.getItem("email") || "",
      postcode: sessionStorage.getItem("postcode") || "",
      straat: sessionStorage.getItem("straat") || "",
      huisnummer: sessionStorage.getItem("huisnummer") || "",
      woonplaats: sessionStorage.getItem("woonplaats") || "",
      telefoon: sessionStorage.getItem("telefoon") || "",

      // tracking & meta
      dob,                  // 🔹 juiste key voor backend
      t_id,                 // 🔹 juiste key
      aff_id,               // 🔹 juiste key
      offer_id,             // 🔹 juiste key
      sub_id,               // 🔹 juiste key
      sub2,
      f_1453_campagne_url: campaignUrl,

      // flags
      is_shortform: campaign.is_shortform || false
    };
  }
  window.buildPayload = buildPayload;

  // -----------------------------------------------------------
  // 🔹 Lead versturen naar Databowl
  // -----------------------------------------------------------
  async function fetchLead(payload) {
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
      try {
        result = text ? JSON.parse(text) : {};
      } catch {
        result = { raw: text };
      }

      console.log(`📨 Lead verstuurd naar ${payload.cid}/${payload.sid}:`, result);
      window.submittedCampaigns.add(key);
      return result;
    } catch (err) {
      console.error("❌ Fout bij lead versturen:", err);
      return { success: false, error: err };
    }
  }
  window.fetchLead = fetchLead;

// -----------------------------------------------------------
// 🔹 Live form tracking (short + long)
// -----------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const shortForm = document.querySelector("#lead-form");
  const longForm = document.querySelector("#long-form");

  [shortForm, longForm].forEach(form => {
    if (!form) return;
    form.querySelectorAll("input").forEach(input => {
      const name = input.name || input.id;
      if (!name) return;
      const save = () => {
        if (input.type === "radio" && !input.checked) return;
        sessionStorage.setItem(name, (input.value || "").trim());
      };
      input.addEventListener("input", save);
      input.addEventListener("change", save);
    });
  });

  console.log("🧠 Live form tracking actief (short + long)");
}); // ✅ sluit eerste blok


// ✅ Slimme DOB input handler — dd / mm / jjjj (stable caret, max 8 digits, auto-jump dag→maand & maand→jaar)
document.addEventListener("DOMContentLoaded", () => {
  const dobInput = document.getElementById("dob");
  if (!dobInput) return;

  // Placeholder & input hints
  dobInput.setAttribute("placeholder", "dd / mm / jjjj");
  dobInput.setAttribute("inputmode", "numeric");
  dobInput.setAttribute("maxlength", "14");

  const formatWithSpaces = (digits) => {
    // Build "dd / mm / jjjj" progressively
    let out = "";
    const len = digits.length;

    if (len >= 1) out += digits[0];
    if (len >= 2) out += digits[1];
    if (len >= 2) out += " / ";
    if (len >= 3) out += digits[2];
    if (len >= 4) out += digits[3];
    if (len >= 4) out += " / ";
    if (len >= 5) out += digits[4];
    if (len >= 6) out += digits[5];
    if (len >= 7) out += digits[6];
    if (len >= 8) out += digits[7];

    return out;
  };

  const countDigitsBefore = (str, pos) => {
    let c = 0;
    for (let i = 0; i < Math.min(pos, str.length); i++) {
      if (/\d/.test(str[i])) c++;
    }
    return c;
  };

  const caretFromDigitIndex = (val, targetDigitIdx) => {
    if (targetDigitIdx <= 0) return 0;
    let count = 0;
    for (let i = 0; i < val.length; i++) {
      if (/\d/.test(val[i])) {
        count++;
        if (count === targetDigitIdx) return i + 1;
      }
    }
    return val.length;
  };

  // Block non-digits via beforeinput
  dobInput.addEventListener("beforeinput", (e) => {
    if (e.inputType === "insertText" && !/[0-9]/.test(e.data)) e.preventDefault();
  });

  // Remember caret before mutation
  const rememberCaret = () => {
    dobInput._prevVal = dobInput.value;
    dobInput._prevPos = dobInput.selectionStart ?? dobInput.value.length;
  };
  dobInput.addEventListener("keydown", rememberCaret);
  dobInput.addEventListener("click", rememberCaret);

  // Main input handler
  dobInput.addEventListener("input", () => {
    const prevVal = dobInput._prevVal || "";
    const prevPos = dobInput._prevPos ?? dobInput.selectionStart ?? prevVal.length;
    const prevDigitsBefore = countDigitsBefore(prevVal, prevPos);

    // Digits only, max 8
    let digits = dobInput.value.replace(/\D/g, "").slice(0, 8);

    // ✅ Leading zero rules + cursor jump flags
    let jumpToMonth = false;
    let jumpToYear = false;

    // Day 4–9 -> 04–09
    if (digits.length === 1 && parseInt(digits[0], 10) >= 4) {
      digits = "0" + digits;
      jumpToMonth = true; // after filling day, move to month
    }

    // Month first digit 2–9 -> 0X
    if (digits.length === 3 && parseInt(digits[2], 10) >= 2) {
      digits = digits.slice(0, 2) + "0" + digits.slice(2);
      jumpToYear = true; // after filling month, move to year
    }

    const formatted = formatWithSpaces(digits);
    dobInput.value = formatted;

    // Caret restoration + jumps
    let newCaret = caretFromDigitIndex(formatted, Math.min(prevDigitsBefore + 1, digits.length));
    if (jumpToMonth && digits.length === 2) {
      // move to after first " / "
      newCaret = formatted.indexOf("/") + 3;
    } else if (jumpToYear && digits.length === 4) {
      // move to after second " / "
      newCaret = formatted.lastIndexOf("/") + 3;
    }
    dobInput.setSelectionRange(newCaret, newCaret);

    // Store compact form dd/mm/jjjj (no spaces)
    const compact = formatted.replace(/\s/g, "");
    sessionStorage.setItem("dob", compact);

    dobInput._prevVal = formatted;
    dobInput._prevPos = newCaret;
  });

  // Fallback keypress filter
  dobInput.addEventListener("keypress", (e) => {
    if (!/[0-9]/.test(e.key)) e.preventDefault();
  });
}); // ✅ sluit tweede blok


  // -----------------------------------------------------------
  // 🔹 Shortform submit (ná geldige invoer) → 925 + co-sponsors
  // -----------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    const shortForm = document.querySelector("#lead-form");
    if (!shortForm) return;

    let shortFormSubmitted = false;

    shortForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (shortFormSubmitted) return;
      shortFormSubmitted = true;

      if (!shortForm.checkValidity()) {
        console.warn("⚠️ Formulier niet volledig ingevuld");
        shortForm.reportValidity();
        shortFormSubmitted = false;
        return;
      }

      console.log("🟢 Shortform verzonden...");

      // cache velden
      shortForm.querySelectorAll("input").forEach(input => {
      const name = input.name || input.id;
      if (!name) return;
      let val = (input.value || "").trim();
      // Speciaal voor DOB: verwijder spaties zodat dd/mm/jjjj compact blijft
      if (name === "dob") {
        val = val.replace(/\s/g, ""); // "05/05/1980"
      }
      if (val) sessionStorage.setItem(name, val);
    });

      // hoofdlead
      const basePayload = buildPayload({ cid: "925", sid: "34", is_shortform: true });
      await fetchLead(basePayload);
      console.log("✅ Shortform lead verzonden naar campagne 925");

      // -----------------------------------------------------------
      // 🔹 Coreg sponsors versturen NA short form als coreg eerder is ingevuld
      // -----------------------------------------------------------
      if (window.coregAnswersReady) {
        const allCoregKeys = Object.keys(sessionStorage).filter(k => k.startsWith("f_2014_coreg_answer_"));
        if (allCoregKeys.length > 0) {
          console.log(`🧩 ${allCoregKeys.length} coreg-antwoorden gevonden — verwerken...`);
          const pendingLongForms = JSON.parse(sessionStorage.getItem("longFormCampaigns") || "[]");
          for (const key of allCoregKeys) {
            const cid = key.replace("f_2014_coreg_answer_", "");
            const answer = sessionStorage.getItem(key);
            const isLongForm = pendingLongForms.some(p => String(p.cid) === cid);
            if (isLongForm) {
              console.log(`⏸️ ${cid} is longform — wachten tot long form submit`);
              continue;
            }
            const sid = "34";
            const payload = buildPayload({ cid, sid, is_shortform: false });
            payload.f_2014_coreg_answer = answer;
            console.log(`📨 Coreg sponsor ${cid} (shortform) wordt nu verstuurd na short form`);
            await fetchLead(payload);
          }
        } else {
          console.log("ℹ️ Geen coreg-antwoorden gevonden om te versturen na short form.");
        }
      }

      // co-sponsors (alleen als akkoord eerder is gegeven)
      const accepted = sessionStorage.getItem("sponsorsAccepted") === "true";
      if (accepted) {
        try {
          const res = await fetch("https://globalcoregflow-nl.vercel.app/api/cosponsors.js");
          const json = await res.json();
          if (json.data && json.data.length > 0) {
            console.log(`📡 Verstuur naar ${json.data.length} co-sponsors...`);
            await Promise.allSettled(json.data.map(async sponsor => {
              if (!sponsor.cid || !sponsor.sid) return;
              const sponsorPayload = buildPayload({
                cid: sponsor.cid,
                sid: sponsor.sid,
                is_shortform: true
              });
              await fetchLead(sponsorPayload);
            }));
          } else {
            console.log("ℹ️ Geen actieve co-sponsors gevonden.");
          }
        } catch (err) {
          console.error("❌ Fout bij ophalen/versturen co-sponsors:", err);
        }
      } else {
        console.log("⚠️ Voorwaarden niet geaccepteerd — alleen hoofdlead verzonden.");
      }

      // ⚠️ Belangrijk: géén auto-click op .flow-next hier.
      // Swipe Pages regelt de sectiewissel al via de knop-click.
    });
  });

  // -------------------------------------------------------------
  // 🔹 Longform submit
  // -------------------------------------------------------------
  function waitForLongForm() {
    const btn = document.getElementById("submit-long-form");
    const form = document.getElementById("long-form");
    if (!btn || !form) {
      setTimeout(waitForLongForm, 300);
      return;
    }
    console.log("✅ Long form gevonden, listeners actief");

    let submitting = false;
    btn.addEventListener("click", async () => {
      if (submitting) return;
      submitting = true;

      const fields = ["postcode", "straat", "huisnummer", "woonplaats", "telefoon"];
      const values = Object.fromEntries(fields.map(id => [id, document.getElementById(id)?.value.trim() || ""]));

      if (Object.values(values).some(v => !v)) {
        alert("Vul alle verplichte velden in voordat je doorgaat.");
        submitting = false;
        return;
      }

      for (const [k, v] of Object.entries(values)) sessionStorage.setItem(k, v);
      const pending = JSON.parse(sessionStorage.getItem("longFormCampaigns") || "[]");
      if (!pending.length) {
        console.warn("⚠️ Geen longform-campagnes gevonden om te versturen");
        submitting = false;
        return;
      }

      for (const camp of pending) {
        const payload = window.buildPayload(camp);

        // 🎯 Coreg-antwoorden toevoegen aan payload
        const coregAnswer = sessionStorage.getItem(`f_2014_coreg_answer_${payload.cid}`);
        if (coregAnswer) {
          payload.f_2014_coreg_answer = coregAnswer;
        }
        
        const dropdownAnswer = sessionStorage.getItem(`f_2575_coreg_answer_dropdown_${payload.cid}`);
        if (dropdownAnswer) {
          payload.f_2575_coreg_answer_dropdown = dropdownAnswer;
        }

        console.log("📨 Longform payload naar Databowl:", payload);
        await window.fetchLead(payload);
      }

      console.log("✅ Longform-leads verzonden");
      sessionStorage.removeItem("longFormCampaigns");
      submitting = false;
      document.dispatchEvent(new Event("longFormSubmitted"));
    });
  }

  waitForLongForm();

  // -----------------------------------------------------------
  // 🔹 Sponsor akkoord tracking
  // -----------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    const acceptBtn = document.getElementById("accept-sponsors-btn");
    if (!acceptBtn) return;
    acceptBtn.addEventListener("click", () => {
      sessionStorage.setItem("sponsorsAccepted", "true");
      console.log("✅ Sponsors akkoord: true");
    });
  });
}
