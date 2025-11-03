function genPin() { return String(Math.floor(100 + Math.random() * 900)); }

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { clickId, internalVisitId } = req.body || {};
    if (!internalVisitId) return res.status(400).json({ error: "internalVisitId required" });

    let pin, tries = 0, ok = false, out;
    while (tries < 5 && !ok) {
      pin = genPin();
      const callBody = {
        click_id: clickId || "",
        visit_id: internalVisitId,
        pincode: pin,
        status: "waiting",
        created_at: new Date().toISOString()
      };
      const r = await fetch(`${process.env.DIRECTUS_URL}/items/calls`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.DIRECTUS_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(callBody)
      });
      if (r.ok) { ok = true; out = await r.json(); break; }
      const txt = await r.text();
      if (!/unique/i.test(txt)) return res.status(r.status).json({ error: txt });
      tries++;
    }
    if (!ok) return res.status(500).json({ error: "Failed to create unique PIN" });

    return res.status(200).json({ pincode: pin });
  } catch (e) {
    console.error("request-pin error:", e);
    return res.status(500).json({ error: e.message });
  }
}
