module.exports = async function handler(req, res) {
  // ✅ Universele CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  try {
    const { call_id, pincode, calling_number, called_number, country_code } = req.body || {};
    if (!call_id || !pincode) return res.status(400).json({ error: "call_id and pincode required" });

    // Zoek call op pincode
    const q = new URLSearchParams({ filter: JSON.stringify({ pincode: { _eq: pincode } }) });
    const r = await fetch(`${process.env.DIRECTUS_URL}/items/calls?${q}`, {
      headers: { "Authorization": `Bearer ${process.env.DIRECTUS_TOKEN}` }
    });
    const data = await r.json();
    const call = data.data?.[0];
    if (!call) return res.status(404).json({ error: "PIN not found" });

    // Update call
    await fetch(`${process.env.DIRECTUS_URL}/items/calls/${call.id}`, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${process.env.DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        call_id,
        calling_number,
        called_number,
        country_code,
        status: "active"
      })
    });

    // Placeholder logic voor IVR pad
    const voiceFolderPath = `/ivr/quiz/${(country_code || "NL").toUpperCase()}`;

    res.status(200).json({ voiceFolderPath });
  } catch (e) {
    console.error("call-init error:", e);
    return res.status(500).json({ error: e.message });
  }
}
