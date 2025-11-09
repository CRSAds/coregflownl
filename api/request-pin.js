// =============================================================
// ✅ request-pin.js — maakt pincode aan + registreert call in Directus
// =============================================================

// 1️⃣ Hulpfunctie om een willekeurige 3-cijferige PIN te maken
function genPin() {
  return String(Math.floor(100 + Math.random() * 900));
}

module.exports = async function handler(req, res) {
  // ✅ Universele CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Cache-Control, Authorization, X-AUTH-SIGNATURE"
  );

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method Not Allowed" });

  try {
    const { clickId, affId, offerId, subId, subId2, internalVisitId } = req.body || {};
    if (!internalVisitId)
      return res.status(400).json({ error: "internalVisitId required" });

    // 2️⃣ Maak pincode aan
    const pin = genPin();

    // 3️⃣ Bouw payload voor Directus-call
    const callBody = {
      click_id: clickId || "",
      aff_id: affId || "",
      offer_id: offerId || "",
      sub_id: subId || "",
      sub_id_2: subId2 || "",
      pincode: pin,
      status: "waiting",
      date_created: new Date().toISOString(),
      visit: internalVisitId,
    };

    // 4️⃣ Stuur naar Directus
    const r = await fetch(`${process.env.DIRECTUS_URL}/items/calls`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: callBody }), // 👈 BELANGRIJK
    });

    const json = await r.json();
    if (!r.ok) {
      console.error("❌ Directus error:", r.status, json);
      return res.status(r.status).json({ error: json });
    }

    // ✅ Succes → stuur PIN terug
    console.log(`📞 Nieuwe call aangemaakt voor visit ${internalVisitId} met PIN ${pin}`);
    return res.status(200).json({ pincode: pin });
  } catch (e) {
    console.error("❌ request-pin error:", e);
    return res.status(500).json({ error: e.message });
  }
};
