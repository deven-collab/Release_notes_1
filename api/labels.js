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
    // Fetch all contexts for customfield_10627 (Customer/Product Category)
    const contextUrl = `${JIRA_BASE_URL}/rest/api/3/field/customfield_10627/context?maxResults=10`;
    const contextRes = await fetch(contextUrl, { headers: jiraHeaders() });
    const contextData = await contextRes.json();

    const contextId = contextData.values?.[0]?.id;
    if (!contextId) {
      return res.status(200).json({ labels: [] });
    }

    // Fetch options for this context
    const optionsUrl = `${JIRA_BASE_URL}/rest/api/3/field/customfield_10627/context/${contextId}/option?maxResults=100`;
    const optionsRes = await fetch(optionsUrl, { headers: jiraHeaders() });
    const optionsData = await optionsRes.json();

    const labels = (optionsData.values || [])
      .map(opt => opt.value)
      .filter(Boolean)
      .sort();

    return res.status(200).json({ labels });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
