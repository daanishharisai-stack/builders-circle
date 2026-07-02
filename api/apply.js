const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GENDER_OPTIONS = ['Male', 'Female'];
const OCCUPATION_OPTIONS = ['School', 'College', 'Working', 'Other'];
const INTEREST_OPTIONS = ['Just exploring', 'Serious', 'All in'];

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const {
    name, email, gender, occupation, interest,
    participated, skills, conditions, commitment, company,
  } = req.body || {};

  // honeypot: bots fill hidden fields, humans never see this one
  if (company) {
    res.status(200).json({ ok: true });
    return;
  }

  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ ok: false, error: 'Name is required.' });
    return;
  }

  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    res.status(400).json({ ok: false, error: 'A valid email is required.' });
    return;
  }

  if (commitment !== true) {
    res.status(400).json({ ok: false, error: 'The commitment box must be ticked.' });
    return;
  }

  const { NOTION_TOKEN, NOTION_DATABASE_ID } = process.env;

  if (!NOTION_TOKEN || !NOTION_DATABASE_ID) {
    console.error('Missing NOTION_TOKEN or NOTION_DATABASE_ID env vars');
    res.status(500).json({ ok: false, error: 'Server is not configured yet.' });
    return;
  }

  const text = (value, max) => ({
    rich_text: [{ text: { content: (value || '').toString().trim().slice(0, max) } }],
  });

  const properties = {
    Name: { title: [{ text: { content: name.trim().slice(0, 200) } }] },
    Email: { email: email.trim().slice(0, 200) },
    'Participated Before': text(participated, 2000),
    Skills: text(skills, 2000),
    Conditions: text(conditions, 2000),
    'Time Commitment': { checkbox: true },
    'Submitted At': { date: { start: new Date().toISOString() } },
    Source: { select: { name: 'Landing Page' } },
  };

  if (GENDER_OPTIONS.includes(gender)) {
    properties.Gender = { select: { name: gender } };
  }
  if (OCCUPATION_OPTIONS.includes(occupation)) {
    properties.Occupation = { select: { name: occupation } };
  }
  if (INTEREST_OPTIONS.includes(interest)) {
    properties['Interest Level'] = { select: { name: interest } };
  }

  try {
    const notionRes = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_DATABASE_ID },
        properties,
      }),
    });

    if (!notionRes.ok) {
      const body = await notionRes.text();
      console.error('Notion API error', notionRes.status, body);
      res.status(502).json({ ok: false, error: 'Could not save your application. Please try again.' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Notion request failed', err);
    res.status(500).json({ ok: false, error: 'Could not save your application. Please try again.' });
  }
};
