// =============================================================
// ✅ coregRenderer.js — volledig opgeschoond + 3 kritieke fixes
//    - shortform coreg correct herkennen
//    - JA/NEE + dropdown foutloos
//    - pendingShortCoreg perfect verwerkt
//    - longform correct verwerkt
// =============================================================

if (typeof window.API_COREG === "undefined") {
  window.API_COREG = "https://globalcoregflow-nl.vercel.app/api/coreg.js";
}
const API_COREG = window.API_COREG;

// =============================================================
// 🔧 Logging toggle
// =============================================================
const DEBUG = true;
const log = (...a) => DEBUG && console.log(...a);
const warn = (...a) => DEBUG && console.warn(...a);
const error = (...a) => DEBUG && console.error(...a);

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

  // Dropdown
  if (style === "dropdown") {
    return `
      <div class="coreg-section ${isFinal}" id="campaign-${campaign.id}"
           data-cid="${campaign.cid}" data-sid="${campaign.sid}"
           style="display:${visible}">
        <img src="${getImageUrl(campaign.image)}" class="coreg-image" />
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

        <a href="#" class="skip-link" data-campaign="${campaign.id}">
          Geen interesse, sla over
        </a>
      </div>`;
  }

  // Buttons
  return `
    <div class="coreg-section ${isFinal}" id="campaign-${campaign.id}"
         data-cid="${campaign.cid}" data-sid="${campaign.sid}"
         style="display:${visible}">
      <img src="${getImageUrl(campaign.image)}" class="coreg-image" />
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
// 🔹 Fetch campagnes
// =============================================================
async function fetchCampaigns() {
  try {
    const res = await fetch(API_COREG, { cache: "no-store" });
    const json = await res.json();
    log("📦 Campagnes opgehaald:", json.data?.length);
    return json.data || [];
  } catch (err) {
    error("❌ Fout bij ophalen coreg campagnes:", err);
    return [];
  }
}

// =============================================================
// 🔹 Lead versturen (proxy)
// =============================================================
async function sendLeadToDatabowl(payload) {
  try {
    const result = await window.fetchLead(payload);
    log("📨 Lead verstuurd:", result);
  } catch (err) {
    error("❌ sendLeadToDatabowl fout:", err);
  }
}

// =============================================================
// 🔹 buildCoregPayload (samengevoegde antwoorden)
// =============================================================
async function buildCoregPayload(campaign, answerValue) {
  const cid = String(answerValue.cid || campaign.cid);
  const sid = String(answerValue.sid || campaign.sid);

  const ans = answerValue.answer_value || "";

  const key = `coreg_answers_${cid}`;
  const prev = JSON.parse(sessionStorage.getItem(key) || "[]");
  if (ans && !prev.includes(ans)) {
    prev.push(ans);
    sessionStorage.setItem(key, JSON.stringify(prev));
  }

  const combined = prev.join(" - ");
  sessionStorage.setItem(`f_2014_coreg_answer_${cid}`, combined);

  const payload = await window.buildPayload({
    cid,
    sid,
    is_shortform: false,
    f_2014_coreg_answer: combined
  });

  const drop = sessionStorage.getItem(`f_2575_coreg_answer_dropdown_${cid}`);
  if (drop) payload.f_2575_coreg_answer_dropdown = drop;

  return payload;
}

// =============================================================
// 🚀 initCoregFlow
// =============================================================
async function initCoregFlow() {
  log("🚀 initCoregFlow gestart");

  window.pendingShortCoreg = window.pendingShortCoreg || [];

  const container = document.getElementById("coreg-container");
  if (!container) return;

  const campaigns = await fetchCampaigns();
  window.allCampaigns = campaigns;

  // ✔ FIX 1 — shortform_coreg correct bepalen
  campaigns.forEach(c => {
    const lf = c.requiresLongForm ?? c.requires_long_form ?? false;
    c.requiresLongForm = lf === true || lf === "true";

    c.is_shortform_coreg =
      c.is_shortform_coreg === true ||
      c.is_shortform_coreg === "true" ||
      c.is_shortform === true ||
      c.is_shortform === "true";
  });

  // Sorteer + groepeer
  const ordered = [...campaigns].sort((a, b) => (a.order || 0) - (b.order || 0));
  const grouped = {};
  ordered.forEach(c => {
    if (c.has_coreg_flow) {
      grouped[c.cid] = grouped[c.cid] || [];
      grouped[c.cid].push(c);
    }
  });

  container.innerHTML = `
    <div class="coreg-inner">
      <h2 id="coreg-motivation" class="coreg-motivation">
        Een paar makkelijke vragen en je bent er 🎯
      </h2>

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

  const wrapper = container.querySelector("#coreg-sections");

  ordered.forEach((camp, i) => {
    const isFinal = i === ordered.length - 1;
    camp.isFinal = isFinal;

    if (camp.has_coreg_flow && grouped[camp.cid]) {
      grouped[camp.cid].forEach(step => {
        wrapper.innerHTML += renderCampaignBlock(step, true);
      });
    } else {
      wrapper.innerHTML += renderCampaignBlock(camp, false);
    }
  });

  const sections = Array.from(wrapper.querySelectorAll(".coreg-section"));
  sections.forEach((sec, i) => sec.style.display = i === 0 ? "block" : "none");

  // =========================================================
  // Helper: Toon volgende sectie
  // =========================================================
  function showNextSection(current) {
    const idx = sections.indexOf(current);
    if (idx < sections.length - 1) {
      current.style.display = "none";
      sections[idx + 1].style.display = "block";
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      handleFinalCoreg();
    }
  }

  // =========================================================
  // Helper: einde coreg → longform of finish
  // =========================================================
  function handleFinalCoreg() {
    const lf = sessionStorage.getItem("requiresLongForm") === "true";
    const pending = JSON.parse(sessionStorage.getItem("longFormCampaigns") || "[]");

    const showLF = lf || (pending.length > 0);

    if (showLF) {
      const btn = document.getElementById("coreg-longform-btn");
      if (btn) btn.click();
      return;
    }

    const finish = document.getElementById("coreg-finish-btn");
    if (finish) finish.click();
  }

  // =========================================================
  // 🟣 EVENT HANDLERS — dropdowns + buttons + skip
  // =========================================================

  sections.forEach(section => {

    // ------------------------------
    // SKIP
    // ------------------------------
    const skip = section.querySelector(".skip-link");
    if (skip) {
      skip.addEventListener("click", e => {
        e.preventDefault();

        const camp = campaigns.find(c => c.id == skip.dataset.campaign);
        const idx = sections.indexOf(section);
        const cid = String(camp.cid);

        let j = idx + 1;
        while (j < sections.length && String(sections[j].dataset.cid) === cid) j++;

        section.style.display = "none";

        if (j < sections.length) {
          sections[j].style.display = "block";
        } else {
          handleFinalCoreg();
        }
      });
    }

    // ------------------------------
    // DROPDOWN
    // ------------------------------
    const dropdown = section.querySelector(".coreg-dropdown");
    if (dropdown) {
      dropdown.addEventListener("change", async e => {
        const opt = e.target.selectedOptions[0];
        if (!opt.value) return;

        const camp = campaigns.find(c => c.id == dropdown.dataset.campaign);

        // ✔ FIX 2 — correct answerValue
        const answerValue = {
          answer_value: opt.value ?? "",
          cid: opt.dataset.cid || camp.cid,
          sid: opt.dataset.sid || camp.sid
        };

        const shortFormCompleted =
          sessionStorage.getItem("shortFormCompleted") === "true";

        const isShort = camp.is_shortform_coreg === true;
        const isLongForm = camp.requiresLongForm === true;

        const cid = answerValue.cid;

        sessionStorage.setItem(`f_2575_coreg_answer_dropdown_${cid}`, opt.value);
        sessionStorage.setItem(`coreg_answers_${cid}`, JSON.stringify([opt.value]));
        sessionStorage.setItem(`f_2014_coreg_answer_${cid}`, opt.value);

        // Longform sponsor → queue
        if (isLongForm) {
          const pendingLF = JSON.parse(sessionStorage.getItem("longFormCampaigns") || "[]");
          if (!pendingLF.find(p => p.cid === camp.cid)) {
            pendingLF.push({ cid: camp.cid, sid: camp.sid });
            sessionStorage.setItem("longFormCampaigns", JSON.stringify(pendingLF));
          }
          showNextSection(section);
          return;
        }

        // Shortform coreg
        if (isShort) {
          if (!shortFormCompleted) {
            // Queue
            window.pendingShortCoreg.push({
              cid: answerValue.cid,
              sid: answerValue.sid,
              answer_value: opt.value
            });
            sessionStorage.setItem("pendingShortCoreg", JSON.stringify(window.pendingShortCoreg));
            showNextSection(section);
            return;
          }

          // Direct verzenden
          const payload = await buildCoregPayload(camp, answerValue);
          sendLeadToDatabowl(payload);
          showNextSection(section);
          return;
        }

        // Normale coreg
        const payload = await buildCoregPayload(camp, answerValue);
        sendLeadToDatabowl(payload);
        showNextSection(section);
      });
    }

    // ------------------------------
    // BUTTONS (JA, NEE, etc.)
    // ------------------------------
    section.querySelectorAll(".btn-answer, .btn-skip").forEach(btn => {
      btn.addEventListener("click", async () => {

        const camp = campaigns.find(c => c.id == btn.dataset.campaign);

        // ✔ FIX 2 — correct answerValue
        const answerValue = {
          answer_value: btn.dataset.answer ?? "",
          cid: btn.dataset.cid || camp.cid,
          sid: btn.dataset.sid || camp.sid
        };

        const isNegative =
          btn.classList.contains("btn-skip") ||
          ["no", "nee", "geen", "interesse"].some(w =>
            (btn.textContent || "").toLowerCase().includes(w)
          );

        const isPositive = !isNegative;

        const shortFormCompleted =
          sessionStorage.getItem("shortFormCompleted") === "true";

        const isShort = camp.is_shortform_coreg === true;
        const isLongForm = camp.requiresLongForm === true;

        const answerCid = answerValue.cid;

        // ❌ NEGATIEF → skip chain
        if (!isPositive) {
          const idx = sections.indexOf(section);
          const cid = String(camp.cid);

          let j = idx + 1;
          while (j < sections.length && String(sections[j].dataset.cid) === cid) j++;

          section.style.display = "none";

          if (j < sections.length) {
            sections[j].style.display = "block";
          } else {
            handleFinalCoreg();
          }
          return;
        }

        // 🟢 POSITIEF
        // sla antwoord op
        const prev = JSON.parse(sessionStorage.getItem(`coreg_answers_${answerCid}`) || "[]");
        if (!prev.includes(answerValue.answer_value)) {
          prev.push(answerValue.answer_value);
        }
        sessionStorage.setItem(`coreg_answers_${answerCid}`, JSON.stringify(prev));
        sessionStorage.setItem(`f_2014_coreg_answer_${answerCid}`, prev.join(" - "));

        const idx = sections.indexOf(section);
        const cid = String(camp.cid);

        const hasMoreSteps = sections
          .slice(idx + 1)
          .some(s => String(s.dataset.cid) === cid);

        // 🔵 Longform sponsor
        if (isLongForm) {
          const pendingLF = JSON.parse(sessionStorage.getItem("longFormCampaigns") || "[]");
          if (!pendingLF.find(p => p.cid === camp.cid)) {
            pendingLF.push({ cid: camp.cid, sid: camp.sid });
            sessionStorage.setItem("longFormCampaigns", JSON.stringify(pendingLF));
          }
          showNextSection(section);
          return;
        }

        // 🟡 Shortform coreg
        if (isShort) {
          if (!shortFormCompleted) {
            // Queue
            window.pendingShortCoreg.push({
              cid: answerValue.cid,
              sid: answerValue.sid,
              answer_value: answerValue.answer_value
            });
            sessionStorage.setItem("pendingShortCoreg", JSON.stringify(window.pendingShortCoreg));
            showNextSection(section);
            return;
          }

          // Direct verzenden
          const payload = await buildCoregPayload(camp, answerValue);
          sendLeadToDatabowl(payload);
          showNextSection(section);
          return;
        }

        // 🔵 Meerdere stappen?
        if (hasMoreSteps) {
          showNextSection(section);
          return;
        }

        // 🟢 Normale coreg → direct verzenden
        const payload = await buildCoregPayload(camp, answerValue);
        sendLeadToDatabowl(payload);
        showNextSection(section);
      });
    });

  });

  log("✅ initCoregFlow volledig klaar");
}

// Expose globally
window.initCoregFlow = initCoregFlow;
window.addEventListener("DOMContentLoaded", initCoregFlow);
