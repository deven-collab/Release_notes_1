export const config = { maxDuration: 30 };

const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_TOKEN = process.env.JIRA_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `You are a professional technical writer generating client-facing release notes for Voiro, a B2B ad tech SaaS platform. Your audience is non-technical media planners and ad operations teams.

TONE & FORMAT
- Professional and formal throughout
- Each entry: 2-3 sentences — what changed, and the benefit to the user
- Group all entries under exactly these four categories (omit a category if empty):
  New Features | Improvements | Bug Fixes | Platform & Performance

HARD RULES — NEVER include:
- Internal ticket IDs of any kind (VTECH, PP, DEVOPS, or similar)
- Technical terms: API, backend, frontend, FE, BE, refactor, cache, schema, migration, deployment, or similar engineering language
- Competitor names or references
- Any item that is incomplete, in QA, or pending verification
- Speculation or detail not present in the source ticket description
- Any indication that these notes were auto-generated

CONTENT RULES
- Write in present tense: "The platform now...", "Users can now..."
- Focus on user benefit, not what was technically built
- Bug fixes → reframe neutrally: "An issue affecting X has been resolved."
- Engineering-only tickets with no product context → place under "Platform & Performance" with generic benefit-led language only. Example: "Ongoing platform improvements have been applied to ensure a consistent and stable experience."
- If two tickets describe the same feature → merge into one entry
- If a ticket description is too vague to write a meaningful note → return a flag object: { "flag": true, "key": "...", "reason": "..." }. Do not hallucinate content for vague tickets.`;

function jiraHeaders() {
  return {
    'Authorization': 'Basic ' + Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString('base64'),
    'Accept': 'application/json'
  };
}

async function fetchIssue(key, fields = 'summary,issuelinks,customfield_10627,description,status') {
  const url = `${JIRA_BASE_URL}/rest/api/3/issue/${key}?fields=${fields}`;
  const res = await fetch(url, { headers: jiraHeaders() });
  if (!res.ok) throw new Error(`Jira fetch failed for ${key}: ${res.status}`);
  return res.json();
}

function extractADF(node) {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  if (node.content) return node.content.map(extractADF).join(' ');
  return '';
}

function extractDescription(desc) {
  if (!desc) return '';
  if (typeof desc === 'string') return desc;
  if (desc.type === 'doc') {
    const parts = [];
    for (const block of (desc.content || [])) {
      if (['heading', 'paragraph', 'listItem'].includes(block.type)) {
        const text = extractADF(block).trim();
        if (text) parts.push(text);
      }
    }
    return parts.slice(0, 8).join(' ');
  }
  return '';
}

const INCOMPLETE_STATUSES = ['qa in progress', 'pending verification', 'in progress', 'dev to do (github)', 'to do', 'open'];

function isIncomplete(status) {
  return INCOMPLETE_STATUSES.includes((status || '').toLowerCase());
}

function matchesClient(clientCategory, clientFilter) {
  if (!clientFilter || clientFilter === 'all') return true;
  const val = (clientCategory || '').toLowerCase();
  if (val === 'product') return true;
  return val === clientFilter.toLowerCase();
}

async function callClaude(tickets, clientName) {
  const ticketList = tickets.map(t =>
    `Ticket: ${t.key}\nTitle: ${t.summary}\nDescription: ${t.description || 'No description provided.'}\nEngineering-only: ${t.engineeringOnly ? 'Yes' : 'No'}`
  ).join('\n\n---\n\n');

  const clientLabel = clientName === 'all' ? 'all clients' : clientName;

  const prompt = `Generate release notes for ${clientLabel}.

Here are the tickets:

${ticketList}

Return ONLY a JSON array. No preamble, no markdown fences. Each item must be:
{
  "key": "...",
  "category": "New Features" | "Improvements" | "Bug Fixes" | "Platform & Performance",
  "title": "...",
  "description": "...",
  "flag": false
}
Or if a ticket is too vague:
{
  "key": "...",
  "flag": true,
  "reason": "..."
}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await res.json();
  const raw = data.content?.find(b => b.type === 'text')?.text || '[]';
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, devopsTicket, clientFilter } = req.body || {};

  // Auth — email whitelist
  if (!email || !ALLOWED_EMAILS.includes(email.toLowerCase())) {
    return res.status(403).json({ error: 'Access denied. Your email is not authorised.' });
  }

  if (!devopsTicket || !clientFilter) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const steps = [];

    // Step 1: Fetch DEVOPS ticket
    steps.push(`Fetching ${devopsTicket}...`);
    const devops = await fetchIssue(devopsTicket.toUpperCase());
    const vtechLinks = (devops.fields.issuelinks || [])
      .filter(l => l.type.name === 'Blocks' && l.inwardIssue)
      .map(l => l.inwardIssue.key);

    steps.push(`Found ${vtechLinks.length} linked tickets`);

    // Step 2: Resolve each VTECH → PP
    const ppMap = {};

    for (const vk of vtechLinks) {
      const vtech = await fetchIssue(vk, 'summary,issuelinks,customfield_10627,description,status');
      const cloneLink = (vtech.fields.issuelinks || []).find(
        l => l.type.name === 'Cloners' && l.outwardIssue?.key?.startsWith('PP-')
      );

      if (cloneLink) {
        const ppKey = cloneLink.outwardIssue.key;
        if (ppMap[ppKey]) continue; // deduplicate
        const pp = await fetchIssue(ppKey, 'summary,customfield_10627,description,status');
        // Skip incomplete items
        if (isIncomplete(pp.fields.status?.name)) {
          steps.push(`Skipping ${ppKey} (${pp.fields.status?.name})`);
          continue;
        }
        ppMap[ppKey] = {
          key: ppKey,
          summary: pp.fields.summary,
          description: extractDescription(pp.fields.description),
          clientCategory: pp.fields.customfield_10627?.value || '',
          engineeringOnly: false
        };
      } else {
        // No PP parent — engineering ticket
        if (ppMap[vk]) continue;
        if (isIncomplete(vtech.fields.status?.name)) {
          steps.push(`Skipping ${vk} (${vtech.fields.status?.name})`);
          continue;
        }
        ppMap[vk] = {
          key: vk,
          summary: vtech.fields.summary,
          description: extractDescription(vtech.fields.description),
          clientCategory: vtech.fields.customfield_10627?.value || '',
          engineeringOnly: true
        };
      }
    }

    // Step 3: Filter by client
    const filtered = Object.values(ppMap).filter(t => matchesClient(t.clientCategory, clientFilter));
    steps.push(`${filtered.length} tickets match client filter`);

    if (filtered.length === 0) {
      return res.status(200).json({ notes: [], steps, empty: true });
    }

    // Step 4: Generate with Claude
    steps.push('Generating release notes...');
    const notes = await callClaude(filtered, clientFilter);
    steps.push('Done');

    return res.status(200).json({ notes, steps });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
