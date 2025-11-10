// =============================================================
// ✅ coregRenderer.js — stabiele & opgeschoonde versie
// =============================================================

if (typeof window.API_COREG === "undefined") {
  window.API_COREG = "https://globalcoregflow-nl.vercel.app/api/coreg.js";
}
const API_COREG = window.API_COREG;

// =============================================================
// 🔧 Logging
// =============================================================
const DEBUG = true;
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
// 🔹 HTML Renderer
// =============================================================
function renderCampaignBlock(campaign, steps) {
  const answers = campaign.coreg_answers || [];
  const style = campaign.ui_style?.toLowerCase() || "buttons";
  const visible = steps && campaign.step > 1 ? "none" : "block";
  const isFinal = campaign.isFinal ? "final-coreg" : "";

  // Dropdown variant
  if (style === "dropdown") {
    return `
      <div class="coreg-section ${isFinal}" id="campaign-${campaign.id}"
           data-cid="${campaign.cid}" data-sid="${campaign.sid}" style="display:${visible}">
        <img src="${getImageUrl(campaign.image)}" class="coreg-image" alt="${campaign.title}" />
        <h3 class="coreg-title">${campaign.title}</h3>
        <p class="coreg-description">${campaign.description || ""}</p>
        <select class="coreg-dropdown" data-campaign="${campaign.id}" data-cid="${campaign.cid}" data-sid="${campaign.sid}">
          <option value="">Maak een keuze...</option>
          ${answers.map(opt => `
            <option value="${opt.answer_value}"
                    data-cid="${opt.has_own_campaign ? opt.cid : campaign.cid}"
                    data-sid="${opt.has_own_campaign ? opt.sid : campaign.sid}">
              ${opt.label}
            </option>`).join("")}
        </select>
        <a href="#" class="skip-link" data-campaign="${campaign.id}">Geen interesse, sla over</a>
      </div>`;
  }

  // Standaard: buttons
  return `
    <div class="coreg-section ${isFinal}" id="campaign-${campaign.id}"
         data-cid="${campaign.cid}" data-sid="${campaign.sid}" style="display:${visible}">
      <img src="${getImageUrl(campaign.image)}" class="coreg-image" alt="${campaign.title}" />
      <h3 class="coreg-title">${campaign.title}</h3>
      <p class="coreg-description">${campaign.description || ""}</p>
      <div class="coreg-answers">
        ${answers.map(opt => `
          <button class="flow-next btn-answer"
                  data-answer="${opt.answer_value || "yes"}"
                  data-campaign="${campaign.id}"
                  data-cid="${opt.has_own_campaign ? opt.cid : campaign.cid}"
                  data-sid="${opt.has_own_campaign ? opt.sid : campaign.sid}">
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
    log("📦 Directus campagnes geladen:", json.data?.length);
    return json.data || [];
  } catch (err) {
    error("❌ Coreg fetch error:", err);
    return [];
  }
}

// =============================================================
// 🔹 Payload opbouwen voor verzending
// =============================================================
async function buildCoregPayload(campaign, answerValue) {
  log("🧩 buildCoregPayload() → input:", { campaign, answerValue });

  const cid = answerValue?.cid || campaign.cid;
  const sid = answerValue?.sid || campaign.sid;
  const coregAnswer = answerValue?.answer_value || answerValue || "";

  const key = `coreg_answers_${cid}`;
  const prev = JSON.parse(sessionStorage.getItem(key) || "[]");
  if (coregAnswer && !prev.includes(coregAnswer)) {
    prev.push(coregAnswer);
    sessionStorage.setItem(key, JSON.stringify(prev));
  }
  const combined = prev.join(" - ") || coregAnswer;
  sessionStorage.setItem(`f_2014_coreg_answer_${cid}`, combined);

  const payload = await window.buildPayload({
    cid,
    sid,
    is_shortform: false,
    f_2014_coreg_answer: combined,
  });

  const dropdownAns = sessionStorage.getItem(`f_2575_coreg_answer_dropdown_${cid}`);
  if (dropdownAns) payload.f_2575_coreg_answer_dropdown = dropdownAns;

  log("📦 buildCoregPayload() → output:", payload);
  return payload;
}

// =============================================================
// 🔹 Lead naar Databowl versturen
// =============================================================
async function sendLeadToDatabowl(payload) {
  try {
    log("🚀 Verzenden naar Databowl:", payload);
    const result = await window.fetchLead(payload);
    log("✅ Lead verstuurd:", result);
    return result;
  } catch (e) {
    error("❌ Fout bij lead-verzending:", e);
  }
}

// =============================================================
// 🧭 Coreg Flow Initialisatie
// =============================================================
async function initCoregFlow() {
  log("🚀 initCoregFlow gestart");

  const container = document.getElementById("coreg-container");
  if (!container) return warn("⚠️ Geen #coreg-container gevonden");

  const campaigns = await fetchCampaigns();
  window.allCampaigns = campaigns;
  log("📊 Campagnes geladen:", campaigns);

  campaigns.forEach(c => {
    const lf = c.requiresLongForm ?? c.requires_long_form ?? false;
    c.requiresLongForm = lf === true || lf === "true";
  });

  const ordered = campaigns.sort((a, b) => (a.order || 0) - (b.order || 0));
  const grouped = {};
  for (const c of ordered) {
    if (c.has_coreg_flow) {
      grouped[c.cid] = grouped[c.cid] || [];
      grouped[c.cid].push(c);
    }
  }

  container.innerHTML = `
    <div class="coreg-inner">
      <div class="coreg-header"><h2 id="coreg-motivation" class="coreg-motivation">
        Een paar makkelijke vragen en je bent er 🎯
      </h2></div>
      <div class="ld-progress-wrap mb-25">
        <div class="ld-progress-info">
          <span class="progress-label">Voortgang</span>
          <span class="progress-value text-primary">0%</span>
        </div>
        <div class="ld-progress" role="progressbar" data-progress="0">
          <div class="progress-bar" style="width:0%;"></div>
        </div>
      </div>
      <div id="coreg-sections"></div>
    </div>`;

  const sectionContainer = container.querySelector("#coreg-sections");
  ordered.forEach((camp, i) => {
    const isFinal = i === ordered.length - 1;
    camp.isFinal = isFinal;
    if (camp.has_coreg_flow && grouped[camp.cid]) {
      grouped[camp.cid].forEach(step => sectionContainer.innerHTML += renderCampaignBlock(step, true));
    } else {
      sectionContainer.innerHTML += renderCampaignBlock(camp, false);
    }
  });

  const sections = Array.from(sectionContainer.querySelectorAll(".coreg-section"));
  sections.forEach((s, i) => (s.style.display = i === 0 ? "block" : "none"));

  // ============================================================
  // 🔹 Voortgangsbalk
  // ============================================================
  function updateProgressBar(i) {
    const percent = Math.round(((i + 1) / sections.length) * 100);
    const bar = container.querySelector(".progress-bar");
    const label = container.querySelector(".progress-value");
    if (bar) bar.style.width = `${percent}%`;
    if (label) label.textContent = `${percent}%`;

    const mot = container.querySelector("#coreg-motivation");
    if (mot) {
      if (percent < 50) mot.textContent = "Top! Nog maar een paar vragen ⚡️";
      else if (percent < 75) mot.textContent = "Over de helft — even volhouden! 🚀";
      else mot.textContent = "Bijna klaar — laatste vragen 🙌";
    }
  }

  // ============================================================
  // 🔹 Einde van flow
  // ============================================================
  function handleFinalCoreg() {
    log("🏁 handleFinalCoreg aangeroepen");

    const requiresLongForm = sessionStorage.getItem("requiresLongForm") === "true";
    const pending = JSON.parse(sessionStorage.getItem("longFormCampaigns") || "[]");
    const btnLongform = document.getElementById("coreg-longform-btn");
    const btnFinish = document.getElementById("coreg-finish-btn");

    if ((requiresLongForm || pending.length > 0) && btnLongform) {
      log("🧾 Toon longform");
      btnLongform.click();
    } else if (btnFinish) {
      sessionStorage.setItem("coregFlowCompleted", "true");
      window.coregAnswersReady = true;
      log("✅ Coreg afgerond → antwoorden klaar om te versturen");
      btnFinish.click();
    } else {
      warn("⚠️ Geen longform- of finish-knop gevonden");
      sessionStorage.setItem("coregFlowCompleted", "true");
      window.coregAnswersReady = true;
    }
  }

  // ============================================================
  // 🔹 Volgende sectie tonen
  // ============================================================
  function showNextSection(current) {
    const i = sections.indexOf(current);
    if (i < sections.length - 1) {
      current.style.display = "none";
      sections[i + 1].style.display = "block";
      updateProgressBar(i + 1);
    } else handleFinalCoreg();
  }

  // ============================================================
  // 🔹 Eventlisteners voor antwoorden
  // ============================================================
  sections.forEach(section => {
    // Dropdowns
    const dropdown = section.querySelector(".coreg-dropdown");
    if (dropdown) {
      dropdown.addEventListener("change", async e => {
        const opt = e.target.selectedOptions[0];
        if (!opt?.value) return;
        const camp = campaigns.find(c => c.id == dropdown.dataset.campaign);
        sessionStorage.setItem(`f_2575_coreg_answer_dropdown_${camp.cid}`, opt.value);
        const payload = await buildCoregPayload(camp, {
          answer_value: opt.value, cid: opt.dataset.cid, sid: opt.dataset.sid
        });
        if (window.shortFormCompleted) await sendLeadToDatabowl(payload);
        showNextSection(section);
      });
    }

    // Knoppen (ja/nee)
    section.querySelectorAll(".btn-answer, .btn-skip").forEach(btn => {
      btn.addEventListener("click", async () => {
        const camp = campaigns.find(c => c.id == btn.dataset.campaign);
        const answerValue = { answer_value: btn.dataset.answer, cid: btn.dataset.cid, sid: btn.dataset.sid };
        const isPositive = !btn.classList.contains("btn-skip") &&
          !/nee|geen interesse|sla over/i.test(btn.textContent);

        if (isPositive) {
          if (camp.requiresLongForm) {
            const pending = JSON.parse(sessionStorage.getItem("longFormCampaigns") || "[]");
            if (!pending.find(p => p.cid === camp.cid)) pending.push({ cid: camp.cid, sid: camp.sid });
            sessionStorage.setItem("longFormCampaigns", JSON.stringify(pending));
            sessionStorage.setItem("requiresLongForm", "true");
          } else {
            const payload = await buildCoregPayload(camp, answerValue);
            if (window.shortFormCompleted) await sendLeadToDatabowl(payload);
          }
        }

        showNextSection(section);
      });
    });

    // Skip link
    const skip = section.querySelector(".skip-link");
    if (skip) skip.addEventListener("click", e => {
      e.preventDefault();
      showNextSection(section);
    });
  });
}

// =============================================================
// 🚀 Init
// =============================================================
window.coregAnswersReady = true;
window.addEventListener("DOMContentLoaded", initCoregFlow);
