// =============================================================
// ✅ coregRenderer.js — stabiele versie met juiste coreg_answer flow
// =============================================================

if (typeof window.API_COREG === "undefined") {
  window.API_COREG = "https://globalcoregflow-nl.vercel.app/api/coreg.js";
}
const API_COREG = window.API_COREG;

const DEBUG = false;
const log = (...a) => DEBUG && console.log(...a);
const warn = (...a) => DEBUG && console.warn(...a);
const error = (...a) => console.error(...a);

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------
function getImageUrl(image) {
  if (!image) return "https://via.placeholder.com/600x200?text=Geen+afbeelding";
  return image.id
    ? `https://cms.core.909play.com/assets/${image.id}`
    : image.url || "https://via.placeholder.com/600x200?text=Geen+afbeelding";
}

// -------------------------------------------------------------
// Render één campagne-blok
// -------------------------------------------------------------
function renderCampaignBlock(campaign, steps) {
  const answers = campaign.coreg_answers || [];
  const style = campaign.ui_style?.toLowerCase() || "buttons";
  const visible = steps && campaign.step > 1 ? "none" : "block";

  if (style === "dropdown") {
    return `
      <div class="coreg-section" id="campaign-${campaign.id}"
           data-cid="${campaign.cid}" data-sid="${campaign.sid}"
           style="display:${visible}">
           
        <img src="${getImageUrl(campaign.image)}" class="coreg-image" />
        <h3 class="coreg-title">${campaign.title}</h3>
        <p class="coreg-description">${campaign.description || ""}</p>

        <select class="coreg-dropdown" data-campaign="${campaign.id}">
          <option value="">Maak een keuze...</option>
          ${answers
            .map(
              (opt) => `
              <option value="${opt.answer_value}"
                data-cid="${opt.has_own_campaign ? opt.cid : campaign.cid}"
                data-sid="${opt.has_own_campaign ? opt.sid : campaign.sid}">
                ${opt.label}
              </option>
            `
            )
            .join("")}
        </select>

        <a href="#" class="skip-link">Geen interesse, sla over</a>
      </div>`;
  }

  return `
    <div class="coreg-section" id="campaign-${campaign.id}"
         data-cid="${campaign.cid}" data-sid="${campaign.sid}"
         style="display:${visible}">
      <img src="${getImageUrl(campaign.image)}" class="coreg-image" />
      <h3 class="coreg-title">${campaign.title}</h3>
      <p class="coreg-description">${campaign.description || ""}</p>

      <div class="coreg-answers">
        ${answers
          .map(
            (opt) => `
          <button class="btn-answer"
                  data-answer="${opt.answer_value}"
                  data-campaign="${campaign.id}"
                  data-cid="${opt.has_own_campaign ? opt.cid : campaign.cid}"
                  data-sid="${opt.has_own_campaign ? opt.sid : campaign.sid}">
            ${opt.label}
          </button>`
          )
          .join("")}

        <button class="btn-skip"
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

// -------------------------------------------------------------
// Campagnes ophalen
// -------------------------------------------------------------
async function fetchCampaigns() {
  try {
    const res = await fetch(API_COREG, { cache: "no-store" });
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    error("❌ Campagne fetch error:", err);
    return [];
  }
}

// -------------------------------------------------------------
// Coreg payload opbouwen
// -------------------------------------------------------------
async function buildCoregPayload(campaign, answerValue) {
  const cid = answerValue.cid;
  const sid = answerValue.sid;
  const ans = answerValue.answer_value;

  const key = `coreg_answers_${cid}`;
  const prev = JSON.parse(sessionStorage.getItem(key) || "[]");

  if (ans && !prev.includes(ans)) {
    prev.push(ans);
    sessionStorage.setItem(key, JSON.stringify(prev));
  }

  const combined = prev.join(" - ");
  sessionStorage.setItem(`f_2014_coreg_answer_${cid}`, combined);

  const dropdown = sessionStorage.getItem(`f_2575_coreg_answer_dropdown_${cid}`);

  const payload = await window.buildPayload({
    cid,
    sid,
    is_shortform: false,
    f_2014_coreg_answer: combined,
    f_2575_coreg_answer_dropdown: dropdown || undefined
  });

  return payload;
}

// -------------------------------------------------------------
// INIT CORE G FLOW
// -------------------------------------------------------------
async function initCoregFlow() {
  const container = document.getElementById("coreg-container");
  if (!container) return;

  const campaigns = await fetchCampaigns();
  window.allCampaigns = campaigns;

  // Normaliseer longform
  campaigns.forEach((c) => {
    const lf = c.requiresLongForm ?? c.requires_long_form ?? false;
    c.requiresLongForm = lf === true || lf === "true";
  });

  // Sorteren
  const ordered = [...campaigns].sort((a, b) => (a.order || 0) - (b.order || 0));

  // Render container
  container.innerHTML = `
    <div class="coreg-inner">
      <div class="coreg-header">
        <h2 id="coreg-motivation">Een paar makkelijke vragen en je bent er 🎯</h2>
      </div>
      <div class="ld-progress-wrap">
        <span class="progress-label">Voortgang</span>
        <span class="progress-value">0%</span>
        <div class="ld-progress"><div class="progress-bar"></div></div>
      </div>
      <div id="coreg-sections"></div>
    </div>`;

  const sectionsContainer = container.querySelector("#coreg-sections");

  ordered.forEach((camp) => {
    sectionsContainer.innerHTML += renderCampaignBlock(camp, false);
  });

  const sections = [...sectionsContainer.querySelectorAll(".coreg-section")];
  sections.forEach((s, i) => (s.style.display = i === 0 ? "block" : "none"));

  // -----------------------------------------------------------
  // PROGRESSBAR
  // -----------------------------------------------------------
  function updateProgressBar(idx) {
    const pct = Math.round(((idx + 1) / sections.length) * 100);
    container.querySelector(".progress-bar").style.width = pct + "%";
    container.querySelector(".progress-value").textContent = pct + "%";

    const mot = container.querySelector("#coreg-motivation");
    if (pct < 30) mot.textContent = "Een paar makkelijke vragen en je bent er 🎯";
    else if (pct < 60) mot.textContent = "Lekker bezig! ⚡️";
    else if (pct < 90) mot.textContent = "Bijna klaar — even volhouden! 🚀";
    else mot.textContent = "Laatste vraag! 🙌";
  }

  // -----------------------------------------------------------
  // NAVIGATIE
  // -----------------------------------------------------------
  function showNextSection(current) {
    const idx = sections.indexOf(current);
    current.style.display = "none";

    if (idx < sections.length - 1) {
      sections[idx + 1].style.display = "block";
      updateProgressBar(idx + 1);
    } else {
      document.getElementById("coreg-finish-btn")?.click();
    }
  }

  // -----------------------------------------------------------
  // EVENT LISTENERS
  // -----------------------------------------------------------
  sections.forEach((section) => {
    const cid = section.dataset.cid;

    // DROPDOWN
    const dropdown = section.querySelector(".coreg-dropdown");
    if (dropdown) {
      dropdown.addEventListener("change", async (e) => {
        const opt = e.target.selectedOptions[0];
        if (!opt.value) return;

        const camp = campaigns.find((c) => c.id == dropdown.dataset.campaign);
        sessionStorage.setItem(`f_2575_coreg_answer_dropdown_${cid}`, opt.value);

        const answerValue = {
          answer_value: opt.value,
          cid: opt.dataset.cid,
          sid: opt.dataset.sid
        };

        if (camp.requiresLongForm) {
          sessionStorage.setItem("requiresLongForm", "true");
          const pending = JSON.parse(sessionStorage.getItem("longFormCampaigns") || "[]");
          if (!pending.some((p) => p.cid === camp.cid))
            pending.push({ cid: camp.cid, sid: camp.sid });
          sessionStorage.setItem("longFormCampaigns", JSON.stringify(pending));
          return showNextSection(section);
        }

        const payload = await buildCoregPayload(camp, answerValue);
        window.fetchLead(payload);

        showNextSection(section);
      });
    }

    // SKIP
    const skip = section.querySelector(".skip-link");
    if (skip) {
      skip.addEventListener("click", (e) => {
        e.preventDefault();
        showNextSection(section);
      });
    }

    // BUTTONS
    section.querySelectorAll(".btn-answer, .btn-skip").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const camp = campaigns.find((c) => c.id == btn.dataset.campaign);
        const answer = btn.dataset.answer;
        const isNegative = answer === "no" || btn.classList.contains("btn-skip");

        const answerValue = {
          answer_value: answer,
          cid: btn.dataset.cid,
          sid: btn.dataset.sid
        };

        // SHORTFORM COREG FIX (STRICT)
        if (camp.is_shortform_coreg === true) {
          const done = sessionStorage.getItem("shortFormCompleted") === "true";

          if (!done) {
            const list = JSON.parse(sessionStorage.getItem("pendingShortCoreg") || "[]");
            list.push(answerValue);
            sessionStorage.setItem("pendingShortCoreg", JSON.stringify(list));
            return showNextSection(section);
          }
        }

        if (isNegative) return showNextSection(section);

        // LONGFORM sponsor
        if (camp.requiresLongForm) {
          sessionStorage.setItem("requiresLongForm", "true");
          const pending = JSON.parse(sessionStorage.getItem("longFormCampaigns") || "[]");
          if (!pending.some((p) => p.cid === camp.cid))
            pending.push({ cid: camp.cid, sid: camp.sid });
          sessionStorage.setItem("longFormCampaigns", JSON.stringify(pending));
          return showNextSection(section);
        }

        // NORMAAL COREG
        const payload = await buildCoregPayload(camp, answerValue);
        window.fetchLead(payload);
        showNextSection(section);
      });
    });
  });
}

window.addEventListener("DOMContentLoaded", initCoregFlow);
