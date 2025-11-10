// =============================================================
// ✅ coregRenderer.js — stabiele versie met buffer fix + index navigatie
// =============================================================

if (typeof window.API_COREG === "undefined") {
  window.API_COREG = "https://globalcoregflow-nl.vercel.app/api/coreg.js";
}
const API_COREG = window.API_COREG;

// =============================================================
// 🔧 Logging toggle
// =============================================================
const DEBUG = true; // ← Zet op true tijdens testen, false in productie
const log = (...args) => { if (DEBUG) console.log(...args); };
const warn = (...args) => { if (DEBUG) console.warn(...args); };
const error = (...args) => { if (DEBUG) console.error(...args); };

// =============================================================
// 🔹 Helpers
// =============================================================
function getImageUrl(image) {
  if (!image) return "https://via.placeholder.com/600x200?text=Geen+afbeelding";
  return image.id
    ? `https://cms.core.909play.com/assets/${image.id}`
    : image.url || "https://via.placeholder.com/600x200?text=Geen+afbeelding";
}

function parseJSONSafe(raw, fallback = []) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function normalizeId(value, fallback) {
  if (value === null || value === undefined) return fallback;
  const s = String(value).trim();
  if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return fallback;
  return s;
}

function isCoregBeforeShortForm() {
  try {
    const coregEl = document.getElementById("coreg-container");
    const shortFormEl = document.getElementById("lead-form");
    if (!coregEl || !shortFormEl) return false;
    const coregSection = coregEl.closest(".flow-section") || coregEl;
    const shortFormSection = shortFormEl.closest(".flow-section") || shortFormEl;
    const before = !!(coregSection.compareDocumentPosition(shortFormSection) & Node.DOCUMENT_POSITION_FOLLOWING);
    log("ℹ️ isCoregBeforeShortForm:", before);
    return before;
  } catch (e) {
    warn("⚠️ Fout bij isCoregBeforeShortForm:", e);
    return false;
  }
}

// 🕓 Wacht op buildPayload beschikbaarheid
async function waitForBuildPayload(maxWait = 3000) {
  const start = Date.now();
  while (typeof window.buildPayload !== "function" && Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, 100));
  }
  if (typeof window.buildPayload !== "function") {
    warn("⚠️ buildPayload niet beschikbaar binnen timeout");
  }
}

// =============================================================
// 🔹 Renderer
// =============================================================
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

// =============================================================
// 🔹 Fetch & Payload
// =============================================================
async function fetchCampaigns() {
  try {
    const res = await fetch(API_COREG, { cache: "no-store" });
    const json = await res.json();
    log("📦 Directus campagnes:", json.data?.length);
    return json.data || [];
  } catch (err) {
    error("❌ Coreg fetch error:", err);
    return [];
  }
}

async function sendLeadToDatabowl(payload) {
  try {
    const result = await window.fetchLead(payload);
    log("✅ Lead verstuurd:", payload.cid, payload.sid);
    return result;
  } catch (e) {
    error("❌ Fout in sendLeadToDatabowl:", e);
  }
}

async function buildCoregPayload(campaign, answerValue) {
  await waitForBuildPayload();
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

  return payload;
}

// =============================================================
// 🔹 Init Coreg Flow
// =============================================================
async function initCoregFlow() {
  log("🚀 initCoregFlow gestart");
  const container = document.getElementById("coreg-container");
  if (!container) return;

  // Buffer initialiseren
  if (!sessionStorage.getItem("preShortformCoregLeads")) {
    sessionStorage.setItem("preShortformCoregLeads", JSON.stringify([]));
  }

  const campaigns = await fetchCampaigns();
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
    <div id="coreg-sections"></div>
  </div>`;

  const sectionsContainer = container.querySelector("#coreg-sections");
  ordered.forEach((camp, idx) => {
    camp.isFinal = idx === ordered.length - 1;
    if (camp.has_coreg_flow && grouped[camp.cid]) {
      grouped[camp.cid].forEach(step => {
        sectionsContainer.innerHTML += renderCampaignBlock(step, true);
      });
    } else {
      sectionsContainer.innerHTML += renderCampaignBlock(camp, false);
    }
  });

  const sections = Array.from(sectionsContainer.querySelectorAll(".coreg-section"));
  sections.forEach((s, i) => (s.style.display = i === 0 ? "block" : "none"));

  // Event handlers
  sections.forEach(section => {
    section.querySelectorAll(".btn-answer, .btn-skip").forEach(btn => {
      btn.addEventListener("click", async () => {
        const camp = campaigns.find(c => c.id == btn.dataset.campaign);
        const answerValue = { answer_value: btn.dataset.answer, cid: btn.dataset.cid, sid: btn.dataset.sid };
        const labelText = btn.textContent.toLowerCase();
        const answerVal = (btn.dataset.answer || "").toLowerCase();
        const isNegative = btn.classList.contains("btn-skip") ||
          /(^|\s)(nee|geen interesse|sla over)(\s|$)/i.test(labelText) || answerVal === "no";
        const isPositive = !isNegative;

        const idx = sections.indexOf(section);
        section.style.display = "none";

        if (!isPositive) {
          if (idx < sections.length - 1) sections[idx + 1].style.display = "block";
          else handleFinalCoreg();
          return;
        }

        const coregBeforeShortForm = isCoregBeforeShortForm();
        const payload = await buildCoregPayload(camp, answerValue);

        if (!payload.cid) payload.cid = camp.cid;
        if (!payload.sid) payload.sid = camp.sid;

        if (camp.requiresLongForm) {
          let pending = parseJSONSafe(sessionStorage.getItem("longFormCampaigns"), []);
          if (!pending.find(p => p.cid === camp.cid && p.sid === camp.sid)) {
            pending.push({ cid: camp.cid, sid: camp.sid });
            sessionStorage.setItem("longFormCampaigns", JSON.stringify(pending));
          }
        } else if (coregBeforeShortForm) {
          const raw = sessionStorage.getItem("preShortformCoregLeads");
          const buffer = parseJSONSafe(raw, []);
          const idxBuf = buffer.findIndex(p => p.cid === payload.cid && p.sid === payload.sid);
          if (idxBuf > -1) buffer[idxBuf] = payload;
          else buffer.push(payload);
          sessionStorage.setItem("preShortformCoregLeads", JSON.stringify(buffer));
          log("🕓 Coreg vóór short form → buffered:", payload.cid, payload.sid);
        } else {
          sendLeadToDatabowl(payload);
        }

        if (idx < sections.length - 1) {
          sections[idx + 1].style.display = "block";
          log(`➡️ Volgende coreg-sectie getoond (${idx + 1}/${sections.length})`);
        } else {
          handleFinalCoreg();
        }
      });
    });
  });
}

// =============================================================
// ✅ Detecteer einde coreg flow en dispatch event
// =============================================================
function handleFinalCoreg() {
  log("🏁 Coreg flow volledig afgerond — dispatch coregFlowCompleted event");
  document.dispatchEvent(new Event("coregFlowCompleted"));
}

window.addEventListener("DOMContentLoaded", initCoregFlow);
