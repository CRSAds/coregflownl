// =============================================================
// ✅ coregRenderer.js — productieversie (lichte opschoning + multistep fix)
// =============================================================

if (typeof window.API_COREG === "undefined") {
  window.API_COREG = "https://globalcoregflow-nl.vercel.app/api/coreg.js";
}
const API_COREG = window.API_COREG;

// =============================================================
// Logging toggle
// =============================================================
const DEBUG = false;
const log   = (...a) => DEBUG && console.log(...a);
const warn  = (...a) => DEBUG && console.warn(...a);
const error = (...a) => console.error(...a);

// =============================================================
// Helpers
// =============================================================
function getImageUrl(image) {
  if (!image) return "https://via.placeholder.com/600x200?text=Geen+afbeelding";
  return image.id
    ? `https://cms.core.909play.com/assets/${image.id}`
    : image.url || "https://via.placeholder.com/600x200?text=Geen+afbeelding";
}

// =============================================================
// Renderer
// =============================================================
function renderCampaignBlock(campaign, steps) {
  const answers = campaign.coreg_answers || [];
  const style = (campaign.ui_style || "").toLowerCase();
  const visible = steps && campaign.step > 1 ? "none" : "block";
  const isFinal = campaign.isFinal ? "final-coreg" : "";

  // ------------------------------
  // DROPDOWN
  // ------------------------------
  if (style === "dropdown") {
    return `
      <div class="coreg-section ${isFinal}" id="campaign-${campaign.id}"
           data-cid="${campaign.cid}" data-sid="${campaign.sid}"
           style="display:${visible}">
        <img src="${getImageUrl(campaign.image)}" class="coreg-image">
        <h3 class="coreg-title">${campaign.title}</h3>
        <p class="coreg-description">${campaign.description || ""}</p>

        <select class="coreg-dropdown"
                data-campaign="${campaign.id}"
                data-cid="${campaign.cid}"
                data-sid="${campaign.sid}">
          <option value="">Maak een keuze...</option>
          ${answers.map(opt => `
            <option value="${opt.answer_value}"
              data-cid="${opt.has_own_campaign ? opt.cid : campaign.cid}"
              data-sid="${opt.has_own_campaign ? opt.sid : campaign.sid}">
              ${opt.label}
            </option>
          `).join("")}
        </select>

        <a href="#" class="skip-link" data-campaign="${campaign.id}">
          Geen interesse, sla over
        </a>
      </div>`;
  }

  // ------------------------------
  // BUTTONS
  // ------------------------------
  return `
    <div class="coreg-section ${isFinal}" id="campaign-${campaign.id}"
         data-cid="${campaign.cid}" data-sid="${campaign.sid}"
         style="display:${visible}">
      <img src="${getImageUrl(campaign.image)}" class="coreg-image">
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
          </button>`
        ).join("")}

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
// Fetch campagnes
// =============================================================
async function fetchCampaigns() {
  try {
    const res = await fetch(API_COREG, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    error("❌ Coreg fetch error:", err);
    return [];
  }
}

// =============================================================
// Payload opbouwen
// =============================================================
async function buildCoregPayload(campaign, answerValue) {
  if (!answerValue?.cid) answerValue.cid = campaign.cid;
  if (!answerValue?.sid) answerValue.sid = campaign.sid;

  const cid = answerValue.cid;
  const sid = answerValue.sid;

  // Stapel antwoorden
  const key = `coreg_answers_${cid}`;
  const prev = JSON.parse(sessionStorage.getItem(key) || "[]");

  if (answerValue.answer_value && !prev.includes(answerValue.answer_value)) {
    prev.push(answerValue.answer_value);
    sessionStorage.setItem(key, JSON.stringify(prev));
  }

  const combined = prev.join(" - ");
  sessionStorage.setItem(`f_2014_coreg_answer_${cid}`, combined);

  const payload = await window.buildPayload({
    cid,
    sid,
    f_2014_coreg_answer: combined,
    is_shortform: false
  });

  const dropdown = sessionStorage.getItem(`f_2575_coreg_answer_dropdown_${cid}`);
  if (dropdown) payload.f_2575_coreg_answer_dropdown = dropdown;

  return payload;
}

// =============================================================
// Coreg Flow Controller
// =============================================================
async function initCoregFlow() {

  sessionStorage.setItem("requiresLongForm", "false");
  sessionStorage.removeItem("longFormCampaigns");

  const container = document.getElementById("coreg-container");
  if (!container) return;

  const campaigns = await fetchCampaigns();

  // Normalize longform flags
  campaigns.forEach(c => {
    c.requiresLongForm =
      c.requiresLongForm === true ||
      c.requiresLongForm === "true" ||
      c.requires_long_form === true ||
      c.requires_long_form === "true";
  });

  // Sort + group multistep
  const ordered = [...campaigns].sort((a, b) => (a.order || 0) - (b.order || 0));
  const grouped = {};
  ordered.forEach(c => {
    if (c.has_coreg_flow) {
      grouped[c.cid] ??= [];
      grouped[c.cid].push(c);
    }
  });

  // Render UI
  container.innerHTML = `
    <div class="coreg-inner">
      <div class="coreg-header">
        <h2 id="coreg-motivation" class="coreg-motivation">Beantwoord nu deze vragen 🎯</h2>
      </div>

      <div class="ld-progress-wrap mb-25">
        <div class="ld-progress-info">
          <span class="progress-label">Voortgang</span>
          <span class="progress-value text-primary">0%</span>
        </div>
        <div class="ld-progress"><div class="progress-bar" style="width:0%"></div></div>
      </div>

      <div id="coreg-sections"></div>
    </div>`;

  const sectionsContainer = container.querySelector("#coreg-sections");

  ordered.forEach((camp, idx) => {
    camp.isFinal = idx === ordered.length - 1;
    if (grouped[camp.cid]) {
      grouped[camp.cid].forEach(step => {
        sectionsContainer.innerHTML += renderCampaignBlock(step, true);
      });
    } else {
      sectionsContainer.innerHTML += renderCampaignBlock(camp, false);
    }
  });

  const sections = [...sectionsContainer.querySelectorAll(".coreg-section")];
  sections.forEach((s, i) => s.style.display = i === 0 ? "block" : "none");

  // =============================================================
  // Progress bar
  // =============================================================
  function updateProgressBar(idx) {
    const pct = Math.round(((idx + 1) / sections.length) * 100);
    container.querySelector(".progress-bar").style.width = pct + "%";
    container.querySelector(".progress-value").textContent = pct + "%";

    const mot = container.querySelector("#coreg-motivation");
    if (pct < 25) mot.textContent = "Beantwoord nu deze vragen 🎯";
    else if (pct < 50) mot.textContent = "Top! Nog maar een paar vragen ⚡️";
    else if (pct < 75) mot.textContent = "Over de helft — even volhouden! 🚀";
    else if (pct < 100) mot.textContent = "Bijna klaar — laatste vragen 🙌";
    else mot.textContent = "Geweldig! Laatste vraag! 🎉";
  }

  // =============================================================
  // 🔥 De ENIGE juiste next-step functie (bugfix)
  // =============================================================
  function goToNextSection(current) {
    const idx = sections.indexOf(current);

    // ❌ BELANGRIJK: ALLE secties eerst verbergen — voorkomt dubbele zichtbaarheid
    sections.forEach(sec => sec.style.display = "none");

    if (idx < sections.length - 1) {
      const next = sections[idx + 1];
      next.style.display = "block";
      updateProgressBar(idx + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      handleFinalCoreg();
    }
  }

  // =============================================================
  // Final handler
  // =============================================================
  function handleFinalCoreg() {
    const needLF = sessionStorage.getItem("requiresLongForm") === "true";
    const pending = JSON.parse(sessionStorage.getItem("longFormCampaigns") || "[]");

    if (needLF || pending.length) {
      document.getElementById("coreg-longform-btn")?.click();
    } else {
      document.getElementById("coreg-finish-btn")?.click();
    }
  }

  // =============================================================
  // 🔥 EVENT HANDLERS
  // =============================================================

  sections.forEach(section => {
    const dropdown = section.querySelector(".coreg-dropdown");

    // -------------------------------------------------------------
    // DROPDOWN HANDLER  (volledig gefixt)
    // -------------------------------------------------------------
    if (dropdown) {
      dropdown.addEventListener("change", async e => {
        const opt = e.target.selectedOptions[0];
        if (!opt.value) return;

        const camp = campaigns.find(c => c.id == dropdown.dataset.campaign);

        // Altijd opslaan
        sessionStorage.setItem(`f_2575_coreg_answer_dropdown_${camp.cid}`, opt.value);
        sessionStorage.setItem(`f_2014_coreg_answer_${camp.cid}`, opt.value);

        const answerValue = {
          answer_value: opt.value,
          cid: opt.dataset.cid,
          sid: opt.dataset.sid
        };

        // Long form case
        if (camp.requiresLongForm) {
          sessionStorage.setItem("requiresLongForm", "true");

          const pending = JSON.parse(sessionStorage.getItem("longFormCampaigns") || "[]");
          if (!pending.some(p => p.cid === camp.cid))
            pending.push({ cid: camp.cid, sid: camp.sid });

          sessionStorage.setItem("longFormCampaigns", JSON.stringify(pending));

          goToNextSection(section);
          return;
        }

        // Multistep?
        const idx = sections.indexOf(section);
        const hasMoreSteps = sections.slice(idx + 1)
          .some(s => s.dataset.cid == camp.cid);

        if (hasMoreSteps) {
          goToNextSection(section);
        } else {
          const payload = await buildCoregPayload(camp, answerValue);
          window.fetchLead(payload);
          goToNextSection(section);
        }
      });
    }

    // -------------------------------------------------------------
    // SKIP HANDLER
    // -------------------------------------------------------------
    const skip = section.querySelector(".skip-link");
    if (skip) {
      skip.addEventListener("click", e => {
        e.preventDefault();
        goToNextSection(section);
      });
    }

    // -------------------------------------------------------------
    // BUTTONS (JA/NEE)
    // -------------------------------------------------------------
    section.querySelectorAll(".btn-answer, .btn-skip").forEach(btn => {
      btn.addEventListener("click", async () => {
        const camp = campaigns.find(c => c.id == btn.dataset.campaign);
        const answer = btn.dataset.answer;
        const negative = btn.classList.contains("btn-skip") || answer === "no";

        const answerValue = {
          answer_value: answer,
          cid: btn.dataset.cid,
          sid: btn.dataset.sid
        };

        // -------------------------------------------------
        // NEE
        // -------------------------------------------------
        if (negative) {
          goToNextSection(section);
          return;
        }

        // -------------------------------------------------
        // JA — reqlongform
        // -------------------------------------------------
        const shortDone = sessionStorage.getItem("shortFormCompleted") === "true";

        if (camp.requiresLongForm) {
          sessionStorage.setItem("requiresLongForm", "true");
          sessionStorage.setItem(`f_2014_coreg_answer_${camp.cid}`, answer);

          const pending = JSON.parse(sessionStorage.getItem("longFormCampaigns") || "[]");
          if (!pending.some(p => p.cid === camp.cid))
            pending.push({ cid: camp.cid, sid: camp.sid });

          sessionStorage.setItem("longFormCampaigns", JSON.stringify(pending));

          goToNextSection(section);
          return;
        }

        // -------------------------------------------------
        // JA — shortform coreg
        // -------------------------------------------------
        if (camp.is_shortform_coreg) {
          if (!shortDone) {
            window.pendingShortCoreg ||= [];
            window.pendingShortCoreg.push(answerValue);

            sessionStorage.setItem("pendingShortCoreg",
              JSON.stringify(window.pendingShortCoreg)
            );

            goToNextSection(section);
            return;
          }

          const payload = await buildCoregPayload(camp, answerValue);
          window.fetchLead(payload);
          goToNextSection(section);
          return;
        }

        // -------------------------------------------------
        // NORMAAL COREG (JA)
        // -------------------------------------------------
        const idx = sections.indexOf(section);
        const nextSteps = sections.slice(idx + 1)
          .some(s => s.dataset.cid == camp.cid);

        if (nextSteps) {
          goToNextSection(section);
        } else {
          const payload = await buildCoregPayload(camp, answerValue);
          window.fetchLead(payload);
          goToNextSection(section);
        }
      });
    });
  });
}

// Start
window.addEventListener("DOMContentLoaded", initCoregFlow);

if (!DEBUG) console.info("🎉 coregRenderer loaded successfully");
