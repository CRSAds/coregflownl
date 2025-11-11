// api/request-pin.js
function genPin() {
  return String(Math.floor(100 + Math.random() * 900));
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Authorization, X-AUTH-SIGNATURE');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  try {
    const { clickId, affId, offerId, subId, subId2, internalVisitId } = req.body || {};
    if (!internalVisitId) return res.status(400).json({ error: 'internalVisitId required' });

    const pin = genPin();
    const callBody = {
      click_id: clickId || '',
      aff_id: affId || '',
      offer_id: offerId || '',
      sub_id: subId || '',
      sub_id_2: subId2 || '',
      pincode: pin,
      call_id: null,
      status: 'waiting', // waiting | active | confirmed | ended
      date_created: new Date().toISOString(),
      visit: internalVisitId
    };

    const r = await fetch(`${process.env.DIRECTUS_URL}/items/calls`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ data: callBody })
    });

    const json = await r.json();
    if (!r.ok) {
      console.error('❌ Directus error:', r.status, json);
      return res.status(r.status).json({ error: json });
    }

    console.log(`📞 Call created for visit ${internalVisitId} with PIN ${pin}`);
    return res.status(200).json({ pincode: pin });
  } catch (e) {
    console.error('❌ request-pin error:', e);
    return res.status(500).json({ error: e.message });
  }
};
