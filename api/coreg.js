import { fetchWithRetry } from "./utils/fetchDirectus.js";

export default async function handler(req, res) {
  // === CORS ===
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const url = `${process.env.DIRECTUS_URL}/items/coreg_campaigns?filter[is_live][_eq]=true&fields=*,image.id,image.filename_download,coreg_answers.*,coreg_dropdown_options.*,more_info&sort=order`;

    const json = await fetchWithRetry(url, {
      headers: { Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}` },
    });

    let campaigns = (json.data || []).map((camp) => {
      const normalizedCid = camp.cid || camp.campaign_id || null;
      const normalizedSid = camp.sid || camp.source_id || null;

      const answers = (camp.coreg_answers || []).map((ans) => ({
        id: ans.id,
        label: ans.label || "",
        answer_value: ans.value || ans.answer_value || "",
        has_own_campaign: !!ans.has_own_campaign,
        cid: ans.has_own_campaign
          ? ans.cid || ans.campaign_id || normalizedCid
          : normalizedCid,
        sid: ans.has_own_campaign
          ? ans.sid || ans.source_id || normalizedSid
          : normalizedSid,
      }));

      const dropdowns = (camp.coreg_dropdown_options || []).map((opt) => ({
        id: opt.id,
        label: opt.label || "",
        value: opt.value || "",
        has_own_campaign: !!opt.has_own_campaign,
        cid: opt.has_own_campaign
          ? opt.cid || opt.campaign_id || normalizedCid
          : normalizedCid,
        sid: opt.has_own_campaign
          ? opt.sid || opt.source_id || normalizedSid
          : normalizedSid,
      }));

      const is_shortform_coreg =
        camp.is_shortform_coreg === true ||
        camp.is_shortform_coreg === "true" ||
        camp.is_shortform === true ||
        camp.is_shortform === "true";

      return {
        ...camp,
        cid: normalizedCid,
        sid: normalizedSid,
        is_shortform_coreg,
        coreg_answers: answers,
        coreg_dropdown_options: dropdowns,
      };
    });

    console.log(`✅ ${campaigns.length} coreg campagnes geladen`);
    res.status(200).json({ data: campaigns });
  } catch (err) {
    console.error("❌ Fout bij ophalen coreg campagnes:", err);
    res.status(500).json({ error: err.message });
  }
}
