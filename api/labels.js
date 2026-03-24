export const config = { maxDuration: 15 };

const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_TOKEN = process.env.JIRA_TOKEN;

function jiraHeaders() {
  return {
    'Authorization': 'Basic ' + Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString('base64'),
    'Accept': 'application/json'
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};

  if (!email || !ALLOWED_EMAILS.includes(email.toLowerCase())) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  try {
    // Fetch all labels used in the PP project
    const url = `${JIRA_BASE_URL}/rest/api/3/label?maxResults=200`;
    const res2 = await fetch(url, { headers: jiraHeaders() });
    const data = await res2.json();

    // Filter to only client-looking labels — exclude generic ones
    const excluded = ['product', 'bug', 'enhancement', 'tech-debt', 'internal'];
    const labels = (data.values || [])
      .filter(l => !excluded.includes(l.toLowerCase()))
      .sort();

    return res.status(200).json({ labels });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
