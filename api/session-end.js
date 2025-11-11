// api/session-end.js
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-AUTH-SIGNATURE');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const {
      call_id,
      called_number,
      calling_number,
      seconds_called,
      number_of_questions,
      questions_correct,
      country_code
    } = req.body || {};
    if (!call_id) return res.status(400).json({ error: 'call_id required' });

    const q = new URLSearchParams({ filter: JSON.stringify({ call_id: { _eq: call_id } }) });
    const r = await fetch(`${process.env.DIRECTUS_URL}/items/calls?${q}`, {
      headers: { Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}` }
    });
    const data = await r.json();
    const call = data.data?.[0];
    if (!call) return res.status(404).json({ error: 'call_id not found' });

    const updateBody = {
      seconds_called: Number(seconds_called || 0),
      number_of_questions: Number(number_of_questions || 0),
      questions_correct: Number(questions_correct || 0),
      called_number: called_number || call.called_number,
      calling_number: calling_number || call.calling_number,
      country_code: country_code || call.country_code,
      status: 'ended',
      date_updated: new Date().toISOString()
    };

    await fetch(`${process.env.DIRECTUS_URL}/items/calls/${call.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: updateBody })
    });

    console.log(`📞 Call ${call_id} ended (${updateBody.seconds_called}s, ${updateBody.questions_correct}/${updateBody.number_of_questions})`);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('❌ session-end error:', e);
    return res.status(500).json({ error: e.message });
  }
};
