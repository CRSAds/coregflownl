// =============================================================
// ✅ register-visit.js — veilige versie met Directus logging + CORS fix
// =============================================================
module.exports = async function handler(req, res) {
  // --- CORS (altijd bovenaan) ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Cache-Control, Authorization, X-AUTH-SIGNATURE'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { clickId, affId, offerId, subId, subId2, isMobile } = req.body || {};

    const payload = {
      click_id: clickId || crypto.randomUUID(),
      aff_id: affId || '',
      offer_id: offerId || '',
      sub_id: subId || '',
      sub_id_2: subId2 || '',
      is_mobile: !!isMobile,
      used_for_pixel_firing: false,
      date_created: new Date().toISOString(),
    };

    const r = await fetch(`${process.env.DIRECTUS_URL}/items/visits`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: payload }),
    });

    const json = await r.json();
    if (!r.ok) {
      // Zet CORS opnieuw voor veilige error response
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Cache-Control, Authorization, X-AUTH-SIGNATURE'
      );
      console.error('❌ Directus error:', r.status, json);
      return res.status(r.status).json({ error: json });
    }

    // ✅ Succes — stuur internalVisitId terug
    return res.status(200).json({ internalVisitId: json.data?.id || null });
  } catch (e) {
    // Zet CORS opnieuw bij crash
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Cache-Control, Authorization, X-AUTH-SIGNATURE'
    );

    console.error('❌ register-visit error:', e);
    return res.status(500).json({ error: e.message });
  }
};
