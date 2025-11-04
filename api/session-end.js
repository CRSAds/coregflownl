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
    const { call_id, seconds_called } = req.body || {};
    if (!call_id) return res.status(400).json({ error: "call_id required" });

    const q = new URLSearchParams({ filter: JSON.stringify({ call_id: { _eq: call_id } }) });
    const r = await fetch(`${process.env.DIRECTUS_URL}/items/calls?${q}`, {
      headers: { "Authorization": `Bearer ${process.env.DIRECTUS_TOKEN}` }
    });
    const data = await r.json();
    const call = data.data?.[0];
    if (!call) return res.status(404).json({ error: "call_id not found" });

    await fetch(`${process.env.DIRECTUS_URL}/items/calls/${call.id}`, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${process.env.DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        seconds_called: Number(seconds_called || 0),
        status: "ended",
        date_updated: new Date().toISOString()
      })
    });

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("session-end error:", e);
    return res.status(500).json({ error: e.message });
  }
}
