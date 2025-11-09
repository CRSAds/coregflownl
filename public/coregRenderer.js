// =============================================================
// ✅ coregRenderer.js — stabiele versie met coreg_answer + multistep + juiste longform timing
// =============================================================

if (typeof window.API_COREG === "undefined") {
  window.API_COREG = "https://globalcoregflow-nl.vercel.app/api/coreg.js";
}
const API_COREG = window.API_COREG;

// ============ Helper ============
function getImageUrl(image) {
  if (!image) return "https://via.placeholder.com/600x200?text=Geen+afbeelding";
  return image.id
    ? `https://cms.core.909play.com/assets/${image.id}`
    : image.url || "https://via.placeholder.com/600x200?text=Geen+afbeelding";
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
    console.log("📦 Directus campagnes:", json.data?.length);
    return json.data || [];
  } catch (err) {
    console.error("❌ Coreg fetch error:", err);
    return [];
  }
}

// ============ Lead versturen ============
async function sendLeadToDatabowl(payload) {
  console.log("🚦 sendLeadToDatabowl() aangeroepen:", payload);
  try {
    const result = await window.fetchLead(payload);
    console.log("✅ Lead verstuurd via fetchLead:", result);
    return result;
  } catch (e) {
    console.error("❌ Fout in sendLeadToDatabowl:", e);
  }
}

// ============================================================
// ✅ buildCoregPayload met multistep support + per-cid coreg_answer opslag
// ============================================================
function buildCoregPayload(campaign, answerValue) {
  console.log("🧩 buildCoregPayload() → input:", { campaign, answerValue });

  const cid = answerValue?.cid || campaign.cid;
  const sid = answerValue?.sid || campaign.sid;
  const coregAnswer = answerValue?.answer_value || answerValue || "";

  // 🧠 Multistep support: bewaar alle antwoorden per cid
  const key = `coreg_answers_${cid}`;
  const prevAnswers = JSON.parse(sessionStorage.getItem(key) || "[]");
  if (coregAnswer && !prevAnswers.includes(coregAnswer)) {
    prevAnswers.push(coregAnswer);
    sessionStorage.setItem(key, JSON.stringify(prevAnswers));
  }

  // Combineer alle antwoorden van dezelfde campagne
  const combinedAnswer = prevAnswers.join(" - ") || coregAnswer;

  // ✅ Bewaar coreg-answer per campagne voor longform-verzending
  sessionStorage.setItem(`f_2014_coreg_answer_${cid}`, combinedAnswer);

  const payload = window.buildPayload({
    cid,
    sid,
    is_shortform: false, // Altijd false zodat Databowl het als coreg lead behandelt
    coregAnswerKey: `coreg_answer_${campaign.id}`
  });

  // ✅ Voeg de gecombineerde antwoorden toe aan het payload-object
  payload.f_2014_coreg_answer = combinedAnswer;

  // ✅ Bewaar dropdownwaarde ook per campagne (indien aanwezig)
  const dropdownAnswer = sessionStorage.getItem(`f_2575_coreg_answer_dropdown_${cid}`);
  if (dropdownAnswer) {
    payload.f_2575_coreg_answer_dropdown = dropdownAnswer;
  }

  console.log("📦 buildCoregPayload() → output:", payload);
  return payload;
}

// ============ Renderer ============
async function initCoregFlow() {
  console.log("🚀 initCoregFlow gestart");

  // 🧠 Helper: sla coreg-antwoorden per campagne op
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

  const container = document.getElementById("coreg-container");
  if (!container) {
    console.warn("⚠️ Geen #coreg-container gevonden");
    return;
  }

  const campaigns = await fetchCampaigns();
  window.allCampaigns = campaigns;
  console.log("📊 Campagnes geladen:", campaigns);

  // Normaliseer veldnamen
  campaigns.forEach(c => {
  const lf = (c.requiresLongForm ?? c.requires_long_form ?? false);
  c.requiresLongForm = lf === true || lf === "true";
});

  // Sorteren + groeperen
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
      <h2 id="coreg-motivation" class="coreg-motivation">Laten we beginnen — minder dan een minuut 👇</h2>
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

  // ============ Helpers ============
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

  // Dynamische motiverende tekst
  if (motivationEl) {
    let msg = "Laten we beginnen — dit duurt maar een minuut 👇";
    if (percent >= 25 && percent < 50) msg = "Top! Je doet het goed — nog een paar vragen 🎯";
    else if (percent >= 50 && percent < 75) msg = "Je bent over de helft — even volhouden! 🚀";
    else if (percent >= 75 && percent < 100) msg = "Bijna klaar — laatste vragen 🙌";
    else if (percent >= 100) msg = "Geweldig! Je hebt alle vragen beantwoord 🎉";
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
      console.log("🏁 Laatste coreg bereikt – einde flow");
      handleFinalCoreg();
    }
  }

  function handleFinalCoreg() {
    console.log("🏁 handleFinalCoreg aangeroepen");

    const requiresLongForm = sessionStorage.getItem("requiresLongForm") === "true";
    const pending = JSON.parse(sessionStorage.getItem("longFormCampaigns") || "[]");
    const hasLongFormCampaigns = Array.isArray(pending) && pending.length > 0;

    const btnLongform = document.getElementById("coreg-longform-btn");
    const btnFinish = document.getElementById("coreg-finish-btn");

    if ((requiresLongForm || hasLongFormCampaigns) && btnLongform) {
      console.log("🧾 Alle coreg vragen afgerond → toon long form", pending);
      btnLongform.click();
    } else if (btnFinish) {
      console.log("✅ Geen longform sponsors → afronden coreg flow");
      btnFinish.click();
    } else {
      console.warn("⚠️ Geen longform- of finish-knop gevonden");
    }
  }

  // ============ Event Listeners ============
  sections.forEach(section => {
    // Dropdown
    const dropdown = section.querySelector(".coreg-dropdown");
    if (dropdown) {
      dropdown.addEventListener("change", e => {
        const opt = e.target.selectedOptions[0];
        if (!opt || !opt.value) return;
        const camp = campaigns.find(c => c.id == dropdown.dataset.campaign);
        const answerValue = {
          answer_value: opt.value,
          cid: opt.dataset.cid,
          sid: opt.dataset.sid
        };
        console.log("🟢 Dropdown keuze →", answerValue);

        sessionStorage.setItem(`f_2575_coreg_answer_dropdown_${camp.cid}`, opt.value);

        const idx = sections.indexOf(section);
        const currentCid = String(camp.cid ?? "");
        const hasMoreSteps = sections.slice(idx + 1).some(s => String(s.dataset.cid || "") === currentCid);

        if (camp.requiresLongForm) {
        sessionStorage.setItem("requiresLongForm", "true");
        const pending = JSON.parse(sessionStorage.getItem("longFormCampaigns") || "[]");
        if (!pending.find(p => p.cid === camp.cid && p.sid === camp.sid)) {
          pending.push({ cid: camp.cid, sid: camp.sid });
          sessionStorage.setItem("longFormCampaigns", JSON.stringify(pending));
        }
        console.log("🕓 Longform-sponsor (buttons) — wachten met verzending:", camp.cid);
        showNextSection(section);
        return; // ⛔ STOP — niet direct posten
      }

        if (hasMoreSteps) {
          showNextSection(section);
        } else {
          const payload = buildCoregPayload(camp, answerValue);
          sendLeadToDatabowl(payload);
          sessionStorage.removeItem(`coreg_answers_${camp.cid}`); // 🧹 reset antwoorden
          showNextSection(section);
        }
      });
    }

    // Skip
    const skip = section.querySelector(".skip-link");
    if (skip) {
      skip.addEventListener("click", e => {
        e.preventDefault();
        console.log("⏭️ Skip link gebruikt bij:", skip.dataset.campaign);
        showNextSection(section);
      });
    }

    // Buttons
    section.querySelectorAll(".btn-answer, .btn-skip").forEach(btn => {
      btn.addEventListener("click", () => {
        const camp = campaigns.find(c => c.id == btn.dataset.campaign);
        const answerValue = {
          answer_value: btn.dataset.answer,
          cid: btn.dataset.cid,
          sid: btn.dataset.sid
        };
        console.log("🟢 Button klik →", answerValue);

        const labelText = btn.textContent.toLowerCase();
        const answerVal = (btn.dataset.answer || "").toLowerCase();
        const isNegative =
          btn.classList.contains("btn-skip") ||
          /(^|\s)(nee|geen interesse|sla over)(\s|$)/i.test(labelText) ||
          answerVal === "no";
        const isPositive = !isNegative;

        if (isPositive) {
        const idx = sections.indexOf(section);
        const currentCid = String(camp.cid ?? "");
        const hasMoreSteps = sections.slice(idx + 1).some(s => String(s.dataset.cid || "") === currentCid);
          saveCoregAnswer(camp.cid, answerValue.answer_value);
      
        // ✅ Controleer zowel boolean als string
        if (camp.requiresLongForm === true || camp.requiresLongForm === "true") {
          sessionStorage.setItem("requiresLongForm", "true");
          const pending = JSON.parse(sessionStorage.getItem("longFormCampaigns") || "[]");
          if (!pending.find(p => p.cid === camp.cid && p.sid === camp.sid)) {
            pending.push({ cid: camp.cid, sid: camp.sid });
            sessionStorage.setItem("longFormCampaigns", JSON.stringify(pending));
          }
          console.log("🕓 Longform-sponsor (buttons) — wachten met verzending:", camp.cid);
          showNextSection(section);
          return; // ⛔ STOP — niet direct posten
        }
      
        if (hasMoreSteps) {
          showNextSection(section);
        } else {
          // ✅ Alleen shortform coreg direct versturen
          const payload = buildCoregPayload(camp, answerValue);
          sendLeadToDatabowl(payload);
          sessionStorage.removeItem(`coreg_answers_${camp.cid}`); // 🧹 reset antwoorden
          showNextSection(section);
        }
      } else {
        console.log("⏭️ Negatief antwoord → vervolgstappen overslaan");
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

// 🔹 Signaal: coreg-antwoorden kunnen beschikbaar zijn vóór het short form
window.coregAnswersReady = true;

window.addEventListener("DOMContentLoaded", initCoregFlow);
