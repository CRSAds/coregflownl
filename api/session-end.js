export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-AUTH-SIGNATURE");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { call_id, seconds_called } = req.body || {};
    if (!call_id) return res.status(400).json({ error: "call_id required" });

    // Zoek call via call_id
    const q = new URLSearchParams({ filter: JSON.stringify({ call_id: { _eq: call_id } }) });
    const fr = await fetch(`${process.env.DIRECTUS_URL}/items/calls?${q}`, {
      headers: { "Authorization": `Bearer ${process.env.DIRECTUS_TOKEN}` }
    });
    const found = await fr.json();
    const call = found?.data?.[0];
    if (!call) return res.status(404).json({ error: "call_id not found" });

    await fetch(`${process.env.DIRECTUS_URL}/items/calls/${call.id}`, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${process.env.DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ended", duration_seconds: Number(seconds_called || 0), ended_at: new Date().toISOString() })
    });

    // TODO: omzet/postback logica toevoegen (op basis van settings)
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("session-end error:", e);
    return res.status(500).json({ error: e.message });
  }
}
