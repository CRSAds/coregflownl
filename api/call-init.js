// api/call-init.js
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-AUTH-SIGNATURE');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { call_id, calling_number, called_number, country_code } = req.body || {};
    if (!call_id) return res.status(400).json({ error: 'call_id required' });

    // Try to find existing call by matching called_number or recent waiting call for same called_number
    let foundCall = null;

    // Try by call_id first (maybe already present)
    const qByCallId = new URLSearchParams({ filter: JSON.stringify({ call_id: { _eq: call_id } }) });
    const rByCallId = await fetch(`${process.env.DIRECTUS_URL}/items/calls?${qByCallId}`, {
      headers: { Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}` }
    });
    const jsonByCallId = await rByCallId.json();
    if (jsonByCallId.data?.length) foundCall = jsonByCallId.data[0];

    // Otherwise try to find most recent 'waiting' call for the same called_number
    if (!foundCall && called_number) {
      const q = new URLSearchParams({
        sort: '-date_created',
        filter: JSON.stringify({ called_number: { _eq: called_number }, status: { _eq: 'waiting' } }),
        limit: 1
      });
      const r = await fetch(`${process.env.DIRECTUS_URL}/items/calls?${q}`, {
        headers: { Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}` }
      });
      const data = await r.json();
      foundCall = data.data?.[0];
    }

    if (!foundCall) {
      // If we can't find, create a stub call so session-end can still match by call_id later
      const callBody = {
        call_id,
        calling_number: calling_number || '',
        called_number: called_number || '',
        country_code: country_code || '',
        pincode: null,
        status: 'active',
        date_created: new Date().toISOString()
      };
      const rNew = await fetch(`${process.env.DIRECTUS_URL}/items/calls`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: callBody })
      });
      const jsonNew = await rNew.json();
      console.log(`📞 call-init: created stub call ${call_id}`);
      return res.status(200).json({ ok: true });
    }

    // Update found call with call_id and status active
    await fetch(`${process.env.DIRECTUS_URL}/items/calls/${foundCall.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: {
        call_id,
        calling_number: calling_number || foundCall.calling_number,
        called_number: called_number || foundCall.called_number,
        country_code: country_code || foundCall.country_code,
        status: 'active',
        date_updated: new Date().toISOString()
      }})
    });

    console.log(`📞 call-init: linked call_id ${call_id} to call record ${foundCall.id}`);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('❌ call-init error:', e);
    return res.status(500).json({ error: e.message });
  }
};
