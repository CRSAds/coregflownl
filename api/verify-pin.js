// api/verify-pin.js
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-AUTH-SIGNATURE');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { pin } = req.body || {};
    if (!pin) return res.status(400).json({ error: 'PIN required' });

    const q = new URLSearchParams({ filter: JSON.stringify({ pincode: { _eq: pin } }) });
    const r = await fetch(`${process.env.DIRECTUS_URL}/items/calls?${q}`, {
      headers: { Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}` }
    });
    const json = await r.json();
    const call = json.data?.[0];
    if (!call) return res.status(404).json({ error: 'PIN not found' });

    // Mark confirmed
    await fetch(`${process.env.DIRECTUS_URL}/items/calls/${call.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { status: 'confirmed', date_updated: new Date().toISOString() } })
    });

    console.log(`✅ PIN ${pin} confirmed for call ${call.call_id || call.id}`);
    return res.status(200).json({ ok: true, call_id: call.call_id || null });
  } catch (e) {
    console.error('❌ verify-pin error:', e);
    return res.status(500).json({ error: e.message });
  }
};
