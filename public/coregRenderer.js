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
// Avoids race with initFlow-lite writing sessionStorage.
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

  ordered.forEach((camp, idx) => {
    const isFinal = idx === ordered.length - 1;
    camp.isFinal = isFinal;
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

  function handleFinalCoreg() {
    log("🏁 handleFinalCoreg aangeroepen");

    const requiresLongForm = sessionStorage.getItem("requiresLongForm") === "true";
    const pending = parseJSONSafe(sessionStorage.getItem("longFormCampaigns"), []);
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

  // ============ Event Listeners ============
  sections.forEach(section => {
    const dropdown = section.querySelector(".coreg-dropdown");
    if (dropdown) {
      dropdown.addEventListener("change", async e => {
        const opt = e.target.selectedOptions[0];
        if (!opt || !opt.value) return;
        const camp = campaigns.find(c => c.id == dropdown.dataset.campaign);
        const answerValue = { answer_value: opt.value, cid: opt.dataset.cid, sid: opt.dataset.sid };
        log("🟢 Dropdown keuze →", answerValue);

        sessionStorage.setItem(`f_2575_coreg_answer_dropdown_${camp.cid}`, opt.value);

        const idx = sections.indexOf(section);
        const currentCid = String(camp.cid ?? "");
        const hasMoreSteps = sections.slice(idx + 1).some(s => String(s.dataset.cid || "") === currentCid);

        if (camp.requiresLongForm) {
          sessionStorage.setItem("requiresLongForm", "true");
          const pending = parseJSONSafe(sessionStorage.getItem("longFormCampaigns"), []);
          if (!pending.find(p => p.cid === camp.cid && p.sid === camp.sid)) {
            pending.push({ cid: camp.cid, sid: camp.sid });
            sessionStorage.setItem("longFormCampaigns", JSON.stringify(pending));
          }
          log("🕓 Longform-sponsor (dropdown) — wachten met verzending:", camp.cid);
          showNextSection(section);
          return;
        }

        if (hasMoreSteps) {
          showNextSection(section);
        } else {
          const payload = await buildCoregPayload(camp, answerValue);

          if (!payload || !payload.cid || !payload.sid) {
            warn("⚠️ Ongeldig payload voor dropdown, cid/sid ontbreken:", payload);
            showNextSection(section);
            return;
          }

          const coregBeforeShortForm = isCoregBeforeShortForm();

          if (coregBeforeShortForm) {
            const raw = sessionStorage.getItem("preShortformCoregLeads");
            const buffer = parseJSONSafe(raw, []);
            const idxBuf = buffer.findIndex(p => p.cid === payload.cid && p.sid === payload.sid);
            if (idxBuf > -1) {
              buffer[idxBuf] = payload;
              log("♻️ Bestaande buffered payload geüpdatet (dropdown):", payload.cid);
            } else {
              buffer.push(payload);
              log("🕓 Coreg vóór short form → buffered payload (dropdown):", payload.cid);
            }
            sessionStorage.setItem("preShortformCoregLeads", JSON.stringify(buffer));
            showNextSection(section);
            return;
          }

          sendLeadToDatabowl(payload);
          sessionStorage.removeItem(`coreg_answers_${camp.cid}`);
          showNextSection(section);
        }
      });
    }

    const skip = section.querySelector(".skip-link");
    if (skip) {
      skip.addEventListener("click", e => {
        e.preventDefault();
        log("⏭️ Skip link gebruikt bij:", skip.dataset.campaign);
        showNextSection(section);
      });
    }

    section.querySelectorAll(".btn-answer, .btn-skip").forEach(btn => {
      btn.addEventListener("click", async () => {
        const camp = campaigns.find(c => c.id == btn.dataset.campaign);
        const answerValue = { answer_value: btn.dataset.answer, cid: btn.dataset.cid, sid: btn.dataset.sid };
        log("🟢 Button klik →", answerValue);
        const labelText = btn.textContent.toLowerCase();
        const answerVal = (btn.dataset.answer || "").toLowerCase();
        const isNegative = btn.classList.contains("btn-skip") ||
          /(^|\s)(nee|geen interesse|sla over)(\s|$)/i.test(labelText) || answerVal === "no";
        const isPositive = !isNegative;

        if (isPositive) {
          // On-demand decide if coreg is before shortform to avoid races
          const coregBeforeShortForm = isCoregBeforeShortForm();
          const idx = sections.indexOf(section);
          const currentCid = String(camp.cid ?? "");
          const hasMoreSteps = sections.slice(idx + 1).some(s => String(s.dataset.cid || "") === currentCid);

          saveCoregAnswer(camp.cid, answerValue.answer_value);

          if (camp.requiresLongForm === true || camp.requiresLongForm === "true") {
            sessionStorage.setItem("requiresLongForm", "true");
            const pending = parseJSONSafe(sessionStorage.getItem("longFormCampaigns"), []);
            if (!pending.find(p => p.cid === camp.cid && p.sid === camp.sid)) {
              pending.push({ cid: camp.cid, sid: camp.sid });
              sessionStorage.setItem("longFormCampaigns", JSON.stringify(pending));
            }
            log("🕓 Longform-sponsor (buttons) — wachten met verzending:", camp.cid);
            showNextSection(section);
            return;
          }

          if (coregBeforeShortForm) {
            ensurePreShortformBuffer();
            const raw = sessionStorage.getItem("preShortformCoregLeads");
            const buffer = parseJSONSafe(raw, []);

            const payload = await buildCoregPayload(camp, answerValue);

            if (!payload || !payload.cid || !payload.sid) {
              warn("⚠️ Ongeldig payload — sla buffering over:", payload);
              showNextSection(section);
              return;
            }

            const idxBuf = buffer.findIndex(p => p.cid === payload.cid && p.sid === payload.sid);
            if (idxBuf > -1) {
              buffer[idxBuf] = payload;
              log("♻️ Bestaande buffered payload geüpdatet:", payload.cid);
            } else {
              buffer.push(payload);
              log("🕓 Coreg vóór short form → buffered payload:", payload.cid);
            }

            sessionStorage.setItem("preShortformCoregLeads", JSON.stringify(buffer));
            showNextSection(section);
            return;
          }

          // Standaard: coreg ná shortform → direct verzenden
          if (hasMoreSteps) {
            showNextSection(section);
          } else {
            const payload = await buildCoregPayload(camp, answerValue);
            if (payload && payload.cid && payload.sid) {
              sendLeadToDatabowl(payload);
              sessionStorage.removeItem(`coreg_answers_${camp.cid}`);
            } else {
              warn("⚠️ Ongeldig payload bij directe verzending:", payload);
            }
            showNextSection(section);
          }
        } else {
          log("⏭️ Negatief antwoord → vervolgstappen overslaan");
          const idx = sections.indexOf(section);
          const currentCid = String(camp.cid ?? "");
          let j = idx + 1;
          while (j < sections.length && String(sections[j].dataset.cid || "") === currentCid) j++;
          section.style.display = "none";
          if (j < sections.length) {
            sections[j].style.display = "block";
            updateProgressBar(j);
          } else {
            handleFinalCoreg();
          }
        }
      });
    });
  });
}

window.addEventListener("DOMContentLoaded", initCoregFlow);
