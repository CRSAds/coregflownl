// api/call-init-with-pin.js
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-AUTH-SIGNATURE');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { call_id, pin, calling_number, called_number, country_code } = req.body || {};
    if (!call_id || !pin) return res.status(400).json({ error: 'call_id and pin required' });

    // find call by pincode
    const q = new URLSearchParams({ filter: JSON.stringify({ pincode: { _eq: pin } }) });
    const r = await fetch(`${process.env.DIRECTUS_URL}/items/calls?${q}`, {
      headers: { Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}` }
    });
    const data = await r.json();
    const call = data.data?.[0];
    if (!call) return res.status(404).json({ error: 'PIN not found' });

    // update call with call_id and numbers
    await fetch(`${process.env.DIRECTUS_URL}/items/calls/${call.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ data: {
        call_id,
        calling_number: calling_number || call.calling_number,
        called_number: called_number || call.called_number,
        country_code: country_code || call.country_code,
        status: 'active',
        date_updated: new Date().toISOString()
      }})
    });

    console.log(`📞 call-init-with-pin: linked call_id ${call_id} to PIN ${pin}`);
    return res.status(200).json({ ok: true, voiceFolderPath: `/ivr/quiz/${(country_code||'NL').toUpperCase()}` });
  } catch (e) {
    console.error('❌ call-init-with-pin error:', e);
    return res.status(500).json({ error: e.message });
  }
};
