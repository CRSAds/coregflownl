// =============================================================
// ✅ coregRenderer.js — schoon, opgeschoond, met:
//    - coreg_answer opslag per CID
//    - multistep coreg
//    - juiste longform timing
//    - coreg vóór/na shortform (pendingShortCoreg)
//    - correcte handling van has_own_campaign antwoorden
// =============================================================

if (typeof window.API_COREG === "undefined") {
  window.API_COREG = "https://globalcoregflow-nl.vercel.app/api/coreg.js";
}
const API_COREG = window.API_COREG;

// =============================================================
// 🔧 Logging toggle
// =============================================================
const DEBUG = true; // ← Zet op true bij testen, false in productie
const log = (...args) => { if (DEBUG) console.log(...args); };
const warn = (...args) => { if (DEBUG) console.warn(...args); };
const error = (...args) => { if (DEBUG) console.error(...args); };

// =============================================================
// 🔹 Helper: image URL
// =============================================================
function getImageUrl(image) {
  if (!image) return "https://via.placeholder.com/600x200?text=Geen+afbeelding";
  return image.id
    ? `https://cms.core.909play.com/assets/${image.id}`
    : image.url || "https://via.placeholder.com/600x200?text=Geen+afbeelding";
}

// =============================================================
// 🔹 HTML renderer per campagne
// =============================================================
function renderCampaignBlock(campaign, hasSteps) {
  const answers = campaign.coreg_answers || [];
  const style = (campaign.ui_style || "buttons").toLowerCase();
  const visible = hasSteps && campaign.step > 1 ? "none" : "block";
  const isFinal = campaign.isFinal ? "final-coreg" : "";

  // Dropdown style
  if (style === "dropdown") {
    return `
      <div class="coreg-section ${isFinal}" id="campaign-${campaign.id}"
           data-cid="${campaign.cid}" data-sid="${campaign.sid}"
           style="display:${visible}">
        <img src="${getImageUrl(campaign.image)}" class="coreg-image" alt="${campaign.title}" />
        <h3 class="coreg-title">${campaign.title}</h3>
        <p class="coreg-description">${campaign.description || ""}</p>
        <select class="coreg-dropdown"
                data-campaign="${campaign.id}"
                data-cid="${campaign.cid}"
                data-sid="${campaign.sid}">
          <option value="">Maak een keuze...</option>
          ${answers.map(opt => `
            <option value="${opt.answer_value}"
                    data-cid="${opt.cid}"
                    data-sid="${opt.sid}">
              ${opt.label}
            </option>`).join("")}
        </select>
        <a href="#" class="skip-link" data-campaign="${campaign.id}">Geen interesse, sla over</a>
      </div>`;
  }

  // Standaard: knoppen (JA/NEE etc.)
  return `
    <div class="coreg-section ${isFinal}" id="campaign-${campaign.id}"
         data-cid="${campaign.cid}" data-sid="${campaign.sid}"
         style="display:${visible}">
      <img src="${getImageUrl(campaign.image)}" class="coreg-image" alt="${campaign.title}" />
      <h3 class="coreg-title">${campaign.title}</h3>
      <p class="coreg-description">${campaign.description || ""}</p>
      <div class="coreg-answers">
        ${answers.map(opt => `
          <button class="flow-next btn-answer"
                  data-answer="${opt.answer_value || "yes"}"
                  data-campaign="${campaign.id}"
                  data-cid="${opt.cid}"
                  data-sid="${opt.sid}">
            ${opt.label}
          </button>`).join("")}
        <button class="flow-next btn-skip"
                data-answer="no"
                data-campaign="${campaign.id}"
                data-cid="${campaign.cid}"
                data-sid="${campaign.sid}">
          Nee, geen interesse
        </button>
      </div>
      ${campaign.more_info ? `<div class="coreg-more-info">${campaign.more_info}</div>` : ""}
    </div>`;
}

// =============================================================
// 🔹 Campagnes ophalen
// =============================================================
async function fetchCampaigns() {
  try {
    const res = await fetch(API_COREG, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    log("📦 Directus campagnes:", json.data?.length);
    return json.data || [];
  } catch (err) {
    error("❌ Coreg fetch error:", err);
    return [];
  }
}

// =============================================================
// 🔹 Lead versturen (proxy naar fetchLead)
// =============================================================
async function sendLeadToDatabowl(payload) {
  log("🚦 sendLeadToDatabowl() aangeroepen:", payload);
  try {
    const result = await window.fetchLead(payload);
    log("✅ Lead verstuurd via fetchLead:", result);
    return result;
  } catch (e) {
    error("❌ Fout in sendLeadToDatabowl:", e);
  }
}

// =============================================================
// 🔹 buildCoregPayload — bouwt payload incl. samengevoegde antwoorden
// =============================================================
async function buildCoregPayload(campaign, answerValue) {
  log("🧩 buildCoregPayload() → input:", { campaign, answerValue });

  if (answerValue?.cid === "undefined" || !answerValue?.cid) {
    answerValue.cid = campaign.cid;
  }
  if (answerValue?.sid === "undefined" || !answerValue?.sid) {
    answerValue.sid = campaign.sid;
  }

  const cid = String(answerValue.cid);
  const sid = String(answerValue.sid);
  const coregAnswer = answerValue?.answer_value || answerValue || "";

  const key = `coreg_answers_${cid}`;
  const prevAnswers = JSON.parse(sessionStorage.getItem(key) || "[]");
  if (coregAnswer && !prevAnswers.includes(coregAnswer)) {
    prevAnswers.push(coregAnswer);
    sessionStorage.setItem(key, JSON.stringify(prevAnswers));
  }

  const combinedAnswer = prevAnswers.join(" - ") || coregAnswer;
  sessionStorage.setItem(`f_2014_coreg_answer_${cid}`, combinedAnswer);

  const payload = await window.buildPayload({
    cid,
    sid,
    is_shortform: false,
    f_2014_coreg_answer: combinedAnswer
  });

  const dropdownAnswer = sessionStorage.getItem(`f_2575_coreg_answer_dropdown_${cid}`);
  if (dropdownAnswer) payload.f_2575_coreg_answer_dropdown = dropdownAnswer;

  log("📦 buildCoregPayload() → output:", payload);
  return payload;
}

// =============================================================
// 🚀 initCoregFlow — hoofd renderer & logica
// =============================================================
async function initCoregFlow() {
  log("🚀 initCoregFlow gestart");

  // 🔸 Antwoord per CID opslaan
  function saveCoregAnswer(cid, answer) {
    if (!cid || !answer) return;
    const key = `coreg_answers_${cid}`;
    const prev = JSON.parse(sessionStorage.getItem(key) || "[]");
    if (!prev.includes(answer)) {
      prev.push(answer);
      sessionStorage.setItem(key, JSON.stringify(prev));
    }
    const combined = prev.join(" - ");
    sessionStorage.setItem(`f_2014_coreg_answer_${cid}`, combined || answer);
  }

  // 🔸 Shortform-coreg tijdelijk queue-en (voor coreg vóór shortform)
  function queueShortCoreg(camp, answerValue) {
    const answerCid = String(answerValue?.cid || camp?.cid || "");
    const answerSid = String(answerValue?.sid || camp?.sid || "");
    if (!answerCid || !answerSid) return;

    window.pendingShortCoreg = window.pendingShortCoreg || [];
    window.pendingShortCoreg.push({
      cid: answerCid,
      sid: answerSid,
      answer_value: answerValue?.answer_value || answerValue || "",
    });

    try {
      sessionStorage.setItem(
        "pendingShortCoreg",
        JSON.stringify(window.pendingShortCoreg)
      );
    } catch (e) {
      warn("⚠️ Kon pendingShortCoreg niet in sessionStorage opslaan:", e);
    }

    log("🟡 Shortform coreg opgeslagen (pendingShortCoreg):", answerCid, answerSid);
  }

  const container = document.getElementById("coreg-container");
  if (!container) {
    warn("⚠️ Geen #coreg-container gevonden");
    return;
  }

  const campaigns = await fetchCampaigns();
  window.allCampaigns = campaigns;
  log("📊 Campagnes geladen:", campaigns);

  // Normaliseer flags
  campaigns.forEach(c => {
    const lf = (c.requiresLongForm ?? c.requires_long_form ?? false);
    c.requiresLongForm = lf === true || lf === "true";

    c.is_shortform_coreg =
      c.is_shortform_coreg === true ||
      c.is_shortform_coreg === "true";
  });

  // Sorteren & groeperen
  const ordered = [...campaigns].sort((a, b) => (a.order || 0) - (b.order || 0));
  const groupedByCid = {};
  for (const camp of ordered) {
    if (camp.has_coreg_flow) {
      groupedByCid[camp.cid] = groupedByCid[camp.cid] || [];
      groupedByCid[camp.cid].push(camp);
    }
  }

  // Container HTML
  container.innerHTML = `
    <div class="coreg-inner">
      <div class="coreg-header">
        <h2 id="coreg-motivation" class="coreg-motivation">
          Een paar makkelijke vragen en je bent er 🎯
        </h2>
      </div>
      <div class="ld-progress-wrap mb-25">
        <div class="ld-progress-info">
          <span class="progress-label">Voortgang</span>
          <span class="progress-value text-primary">0%</span>
        </div>
        <div class="ld-progress lh-8" role="progressbar" data-progress="0">
          <div class="progress-bar" style="width:0%;"></div>
        </div>
      </div>
      <div id="coreg-sections"></div>
    </div>`;

  const sectionsContainer = container.querySelector("#coreg-sections");

  // Coreg secties renderen
  ordered.forEach((camp, idx) => {
    const isFinal = idx === ordered.length - 1;
    camp.isFinal = isFinal;

    if (camp.has_coreg_flow && groupedByCid[camp.cid]) {
      groupedByCid[camp.cid].forEach(step => {
        sectionsContainer.innerHTML += renderCampaignBlock(step, true);
      });
    } else {
      sectionsContainer.innerHTML += renderCampaignBlock(camp, false);
    }
  });

  const sections = Array.from(sectionsContainer.querySelectorAll(".coreg-section"));
  sections.forEach((s, i) => (s.style.display = i === 0 ? "block" : "none"));

  // 🔸 Progressbar
  function updateProgressBar(sectionIdx) {
    const total = sections.length;
    const current = Math.max(1, Math.min(sectionIdx + 1, total));
    const percent = Math.round((current / total) * 100);

    const wrap = container.querySelector('.ld-progress[role="progressbar"]');
    const val = container.querySelector('.progress-value.text-primary');
    const motivationEl = container.querySelector('#coreg-motivation');

    if (wrap) {
      wrap.setAttribute("data-progress", percent);
      wrap.querySelector(".progress-bar").style.width = percent + "%";
    }
    if (val) val.textContent = percent + "%";

    if (motivationEl) {
      let msg = "Een paar makkelijke vragen en je bent er 🎯";
      if (percent >= 25 && percent < 50) msg = "Top! Nog maar een paar vragen ⚡️";
      else if (percent >= 50 && percent < 75) msg = "Over de helft — even volhouden! 🚀";
      else if (percent >= 75 && percent < 100) msg = "Bijna klaar — laatste vragen 🙌";
      else if (percent >= 100) msg = "Geweldig! Laatste vraag! 🎉";
      motivationEl.textContent = msg;
    }
  }

  // 🔸 Volgende sectie tonen
  function showNextSection(current) {
    const idx = sections.indexOf(current);
    if (idx < sections.length - 1) {
      current.style.display = "none";
      sections[idx + 1].style.display = "block";
      updateProgressBar(idx + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      log("🏁 Laatste coreg bereikt – einde flow");
      handleFinalCoreg();
    }
  }

  // 🔸 Laatste coreg → longform of finish
  function handleFinalCoreg() {
    log("🏁 handleFinalCoreg aangeroepen");

    const requiresLongForm = sessionStorage.getItem("requiresLongForm") === "true";
    const pending = JSON.parse(sessionStorage.getItem("longFormCampaigns") || "[]");
    const hasLongFormCampaigns = Array.isArray(pending) && pending.length > 0;

    const btnLongform = document.getElementById("coreg-longform-btn");
    const btnFinish = document.getElementById("coreg-finish-btn");

    if ((requiresLongForm || hasLongFormCampaigns) && btnLongform) {
      log("🧾 Alle coreg vragen afgerond → toon long form", pending);
      btnLongform.click();
    } else if (btnFinish) {
      log("✅ Geen longform sponsors → afronden coreg flow");
      btnFinish.click();
    } else {
      warn("⚠️ Geen longform- of finish-knop gevonden");
    }
  }

  // ===========================================================
  // 🎯 Event listeners per coreg-section
  // ===========================================================
  sections.forEach(section => {

    // -------------------------------
    // DROPDOWN HANDLER
    // -------------------------------
    const dropdown = section.querySelector(".coreg-dropdown");
    if (dropdown) {
      dropdown.addEventListener("change", async e => {
        const opt = e.target.selectedOptions[0];
        if (!opt || !opt.value) return;

        const camp = campaigns.find(c => c.id == dropdown.dataset.campaign);
        const answerValue = {
          answer_value: opt.value,
          cid: opt.dataset.cid || camp.cid,
          sid: opt.dataset.sid || camp.sid
        };

        log("🟢 Dropdown keuze →", answerValue);

        const answerCid = answerValue.cid || camp.cid;
        sessionStorage.setItem(`f_2575_coreg_answer_dropdown_${answerCid}`, opt.value);
        saveCoregAnswer(answerCid, answerValue.answer_value);

        const idx = sections.indexOf(section);
        const currentCid = String(camp.cid ?? "");
        const hasMoreSteps = sections.slice(idx + 1)
          .some(s => String(s.dataset.cid || "") === currentCid);

        const isLongForm = camp.requiresLongForm === true;
        const isShortCoreg =
          camp.is_shortform_coreg === true ||
          camp.is_shortform_coreg === "true";
        const shortFormCompleted = sessionStorage.getItem("shortFormCompleted") === "true";

        // LONGFORM → alleen queue voor longform
        if (isLongForm) {
          sessionStorage.setItem("requiresLongForm", "true");
          const pendingLF = JSON.parse(sessionStorage.getItem("longFormCampaigns") || "[]");
          if (!pendingLF.find(p => p.cid === camp.cid && p.sid === camp.sid)) {
            pendingLF.push({ cid: camp.cid, sid: camp.sid });
            sessionStorage.setItem("longFormCampaigns", JSON.stringify(pendingLF));
          }
          log("🕓 Longform-sponsor (dropdown) — wachten tot longform is ingevuld:", camp.cid);
          showNextSection(section);
          return;
        }

        // SHORTFORM COREG
        if (isShortCoreg) {
          if (!shortFormCompleted) {
            queueShortCoreg(camp, answerValue);
            showNextSection(section);
            return;
          }

          // Shortform al voltooid → direct versturen
          log("🚀 Shortform AL voltooid → direct shortform-coreg (dropdown) lead verzenden:", answerCid);
          const payload = await buildCoregPayload(camp, answerValue);
          sendLeadToDatabowl(payload);
          sessionStorage.removeItem(`coreg_answers_${answerCid}`);
          showNextSection(section);
          return;
        }

        // Meerdere stappen in dezelfde campagne?
        if (hasMoreSteps) {
          showNextSection(section);
          return;
        }

        // Normale coreg → direct versturen
        const payload = await buildCoregPayload(camp, answerValue);
        sendLeadToDatabowl(payload);
        sessionStorage.removeItem(`coreg_answers_${answerCid}`);
        showNextSection(section);
      });
    }

    // -------------------------------
    // SKIP LINK
    // -------------------------------
    const skip = section.querySelector(".skip-link");
    if (skip) {
      skip.addEventListener("click", e => {
        e.preventDefault();
        log("⏭️ Skip link gebruikt bij campagne:", skip.dataset.campaign);

        const camp = campaigns.find(c => c.id == skip.dataset.campaign);
        const idx = sections.indexOf(section);
        const currentCid = String(camp?.cid ?? "");

        let j = idx + 1;
        while (j < sections.length && String(sections[j].dataset.cid || "") === currentCid) {
          j++;
        }

        section.style.display = "none";

        if (j < sections.length) {
          sections[j].style.display = "block";
          updateProgressBar(j);
        } else {
          handleFinalCoreg();
        }
      });
    }

    // -------------------------------
    // BUTTON HANDLER (JA/NEE etc.)
    // -------------------------------
    section.querySelectorAll(".btn-answer, .btn-skip").forEach(btn => {
      btn.addEventListener("click", async () => {
        const camp = campaigns.find(c => c.id == btn.dataset.campaign);
        const answerValue = {
          answer_value: btn.dataset.answer,
          cid: btn.dataset.cid || camp.cid,
          sid: btn.dataset.sid || camp.sid
        };

        log("🟢 Button klik →", answerValue);

        const labelText = (btn.textContent || "").toLowerCase();
        const answerVal = (btn.dataset.answer || "").toLowerCase();

        const isNegative =
          btn.classList.contains("btn-skip") ||
          /(^|\s)(nee|geen interesse|sla over)(\s|$)/i.test(labelText) ||
          answerVal === "no";

        const isPositive = !isNegative;
        const answerCid = answerValue.cid || camp.cid;

        const shortFormCompleted = sessionStorage.getItem("shortFormCompleted") === "true";
        const isShortCoreg =
          camp.is_shortform_coreg === true ||
          camp.is_shortform_coreg === "true";
        const isLongForm = camp.requiresLongForm === true;

        // ❌ Negatief antwoord → hele campaign flow overslaan
        if (!isPositive) {
          log("⏭️ Negatief antwoord → vervolgstappen overslaan");

          const idx = sections.indexOf(section);
          const currentCid = String(camp.cid ?? "");

          let j = idx + 1;
          while (j < sections.length && String(sections[j].dataset.cid || "") === currentCid) {
            j++;
          }

          section.style.display = "none";

          if (j < sections.length) {
            sections[j].style.display = "block";
            updateProgressBar(j);
          } else {
            handleFinalCoreg();
          }
          return;
        }

        // ✅ Positief antwoord
        log("🟢 Positief antwoord", { answerCid });

        saveCoregAnswer(answerCid, answerValue.answer_value);

        const idx = sections.indexOf(section);
        const currentCid = String(camp.cid ?? "");
        const hasMoreSteps = sections.slice(idx + 1)
          .some(s => String(s.dataset.cid || "") === currentCid);

        // 🟣 LONGFORM SPONSOR
        if (isLongForm) {
          sessionStorage.setItem("requiresLongForm", "true");
          const pendingLF = JSON.parse(sessionStorage.getItem("longFormCampaigns") || "[]");
          if (!pendingLF.find(p => p.cid === camp.cid && p.sid === camp.sid)) {
            pendingLF.push({ cid: camp.cid, sid: camp.sid });
            sessionStorage.setItem("longFormCampaigns", JSON.stringify(pendingLF));
          }

          log("🕓 Longform-sponsor — wachten tot longform is ingevuld:", camp.cid);
          showNextSection(section);
          return;
        }

        // 🟡 SHORTFORM COREG
        if (isShortCoreg) {
          // CASE 1: shortform nog niet ingevuld → queue
          if (!shortFormCompleted) {
            queueShortCoreg(camp, answerValue);
            log("🟡 Shortform nog niet voltooid → opgeslagen in pendingShortCoreg");
            showNextSection(section);
            return;
          }

          // CASE 2: shortform al ingevuld → direct versturen
          log("🚀 Shortform AL voltooid → direct shortform-coreg lead verzenden:", answerCid);
          const payload = await buildCoregPayload(camp, answerValue);
          sendLeadToDatabowl(payload);
          sessionStorage.removeItem(`coreg_answers_${answerCid}`);
          showNextSection(section);
          return;
        }

        // 🔵 Meerdere stappen in deze coreg-campagne?
        if (hasMoreSteps) {
          showNextSection(section);
          return;
        }

        // 🟢 Normale coreg sponsor → direct versturen
        const payload = await buildCoregPayload(camp, answerValue);
        sendLeadToDatabowl(payload);
        sessionStorage.removeItem(`coreg_answers_${answerCid}`);
        showNextSection(section);
      });
    });
  });

  log("✅ initCoregFlow volledig geïnitialiseerd");
}

// Zorg dat initCoregFlow wereldwijd beschikbaar is (system check)
window.initCoregFlow = initCoregFlow;
window.addEventListener("DOMContentLoaded", initCoregFlow);
