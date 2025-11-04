export default async function handler(req, res) {
  // ✅ Universele CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Authorization, X-AUTH-SIGNATURE');

  // ✅ Preflight (OPTIONS) meteen afsluiten
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ✅ Alleen POST requests toestaan
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    // ... hier komt je eigen code
  } catch (e) {
    console.error('API error:', e);
    return res.status(500).json({ error: e.message });
  }
}

  try {
    const { clickId, affId, offerId, subId, subId2, isMobile } = req.body || {};

    const payload = {
      click_id: clickId || crypto.randomUUID(),
      aff_id: affId || "",
      offer_id: offerId || "",
      sub_id: subId || "",
      sub_id_2: subId2 || "",
      is_mobile: !!isMobile,
      date_created: new Date().toISOString()
    };

    const r = await fetch(`${process.env.DIRECTUS_URL}/items/visits`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.DIRECTUS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const json = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: json });

    return res.status(200).json({ internalVisitId: json.data?.id });
  } catch (e) {
    console.error("register-visit error:", e);
    return res.status(500).json({ error: e.message });
  }
}
