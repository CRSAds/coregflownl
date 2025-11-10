// =============================================================
// ✅ coregRenderer.js — stabiele versie met coreg_answer + multistep + juiste longform timing
// Deze versie bevat extra normalisatie van cid/sid en on-demand detectie
// of coreg vóór shortform staat (vermijdt race met initFlow-lite).
// =============================================================

if (typeof window.API_COREG === "undefined") {
  window.API_COREG = "https://globalcoregflow-nl.vercel.app/api/coreg.js";
}
const API_COREG = window.API_COREG;

// =============================================================
// 🔧 Logging toggle
// =============================================================
const DEBUG = false; // ← Zet op true tijdens debug en false in productie
const log = (...args) => { if (DEBUG) console.log(...args); };
const warn = (...args) => { if (DEBUG) console.warn(...args); };
const error = (...args) => { if (DEBUG) console.error(...args); };

// ============ Helper ============
function getImageUrl(image) {
  if (!image) return "https://via.placeholder.com/600x200?text=Geen+afbeelding";
  return image.id
    ? `https://cms.core.909play.com/assets/${image.id}`
    : image.url || "https://via.placeholder.com/600x200?text=Geen+afbeelding";
}

// Veilige JSON parse helper
function parseJSONSafe(raw, fallback = []) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (e) {
    return fallback;
  }
}

// Normaliseer mogelijke ongeldige cid/sid waarden (strings "null"/"undefined" etc.)
function normalizeId(value, fallback) {
  if (value === null || value === undefined) return fallback;
  const s = String(value).trim();
  if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return fallback;
  return s;
}

// On-demand check of whether coreg is placed before shortform in the DOM.
// Avoids race with initFlow-lite.
function isCoregBeforeShortForm() {
  try {
    const coregEl = document.getElementById("coreg-container");
    const shortFormEl = document.getElementById("lead-form");
    if (!coregEl || !shortFormEl) {
      // fallback: if one is missing, prefer not buffering (safe default), but log
      log("ℹ️ isCoregBeforeShortForm: één van de elementen ontbreekt", { coregEl: !!coregEl, shortFormEl: !!shortFormEl });
      return false;
    }
    const coregSection = coregEl.closest(".flow-section") || coregEl;
    const shortFormSection = shortFormEl.closest(".flow-section") || shortFormEl;
    // if coregSection comes before shortFormSection in DOM -> coreg before shortform
    const before = !!(coregSection.compareDocumentPosition(shortFormSection) & Node.DOCUMENT_POSITION_FOLLOWING);
    log("ℹ️ isCoregBeforeShortForm (on-demand):", before);
    return before;
  } catch (e) {
    warn("⚠️ Fout bij isCoregBeforeShortForm:", e);
    return false;
  }
}

// ============ HTML renderer ============
function renderCampaignBlock(campaign, steps) {
  const answers = campaign.coreg_answers || [];
  const style = campaign.ui_style?.toLowerCase() || "buttons";
  const visible = steps && campaign.step > 1 ? "none" : "block";
  const isFinal = campaign.isFinal ? "final-coreg" : "";

  if (style === "dropdown") {
    return `
      <div class="coreg-section ${isFinal}" id="campaign-${campaign.id}"
           data-cid="${campaign.cid}" data-sid="${campaign.sid}"
           style="display:${visible}">
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

  // standaard: JA/NEE-knoppen
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

// ============ Fetch campagnes ============
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

// ============ Lead versturen ============
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

// ============================================================
// ✅ buildCoregPayload — async versie met correcte CID/SID & await
// ============================================================
async function buildCoregPayload(campaign, answerValue) {
  log("🧩 buildCoregPayload() → input:", { campaign, answerValue });

  // Normalize incoming answerValue cid/sid and fallback to campaign values when invalid
  answerValue = answerValue || {};
  answerValue.cid = normalizeId(answerValue.cid, campaign.cid);
  answerValue.sid = normalizeId(answerValue.sid, campaign.sid);

  const cid = answerValue.cid;
  const sid = answerValue.sid;
  const coregAnswer = answerValue?.answer_value || answerValue || "";

  const key = `coreg_answers_${cid}`;
  const prevAnswers = parseJSONSafe(sessionStorage.getItem(key), []);
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

// ============ Renderer ============
async function initCoregFlow() {
  log("🚀 initCoregFlow gestart");

  // Ensure buffer exists and valid
  function ensurePreShortformBuffer() {
    const raw = sessionStorage.getItem("preShortformCoregLeads");
    if (!raw) {
      sessionStorage.setItem("preShortformCoregLeads", JSON.stringify([]));
      log("ℹ️ Geïnitialiseerde preShortformCoregLeads buffer (nieuw)");
      return;
    }
    const parsed = parseJSONSafe(raw, null);
    if (parsed === null) {
      sessionStorage.setItem("preShortformCoregLeads", JSON.stringify([]));
      log("⚠️ Ongeldige preShortformCoregLeads gecorrigeerd naar lege array");
    } else {
      log("ℹ️ preShortformCoregLeads aanwezig");
    }
  }

  ensurePreShortformBuffer();

  function saveCoregAnswer(cid, answer) {
    if (!cid || !answer) return;
    const key = `coreg_answers_${cid}`;
    const prev = parseJSONSafe(sessionStorage.getItem(key), []);
    if (!prev.includes(answer)) {
      prev.push(answer);
      sessionStorage.setItem(key, JSON.stringify(prev));
    }
    const combined = prev.join(" - ");
    sessionStorage.setItem(`f_2014_coreg_answer_${cid}`, combined || answer);
  }

  const container = document.getElementById("coreg-container");
  if (!container) {
    warn("⚠️ Geen #coreg-container gevonden");
    return;
  }

  const campaigns = await fetchCampaigns();
  window.allCampaigns = campaigns;
  log("📊 Campagnes geladen:", campaigns);

  campaigns.forEach(c => {
    const lf = (c.requiresLongForm ?? c.requires_long_form ?? false);
    c.requiresLongForm = lf === true || lf === "true";
  });

  const ordered = [...campaigns].sort((a, b) => (a.order || 0) - (b.order || 0));
  const grouped = {};
  for (const camp of ordered) {
    if (camp.has_coreg_flow) {
      grouped[camp.cid] = grouped[camp.cid] || [];
      grouped[camp.cid].push(camp);
    }
  }

container.innerHTML = `
  <div class="coreg-inner">
    <div class="coreg-header">
      <h2 id="coreg-motivation" class="coreg-motivation">Een paar makkelijke vragen en je bent er 🎯</h2>
    </div>
    <div class="ld-progress-wrap mb-25">
      <div class="ld-progress-info">
