function genPin() { return String(Math.floor(100 + Math.random() * 900)); }

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { clickId, affId, offerId, subId, subId2, internalVisitId } = req.body || {};
    if (!internalVisitId) return res.status(400).json({ error: "internalVisitId required" });

    const pin = genPin();

    const callBody = {
      click_id: clickId,
      aff_id: affId,
      offer_id: offerId,
      sub_id: subId,
      sub_id_2: subId2,
      pincode: pin,
      status: "waiting",
      date_created: new Date().toISOString(),
      visit: internalVisitId
    };

    const r = await fetch(`${process.env.DIRECTUS_URL}/items/calls`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.DIRECTUS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(callBody)
    });

    const json = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: json });

    return res.status(200).json({ pincode: pin });
  } catch (e) {
    console.error("request-pin error:", e);
    return res.status(500).json({ error: e.message });
  }
}
