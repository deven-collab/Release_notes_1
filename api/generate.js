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

// Normalize known typos in Jira custom field values
const CLIENT_NAME_NORMALIZE = { 'carrefourr': 'Carrefour' };
function normalizeClient(val) {
  if (!val) return '';
  return CLIENT_NAME_NORMALIZE[val.toLowerCase()] || val;
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

function matchesStatus(ticketStatus, statusFilter) {
  if (!statusFilter || statusFilter.length === 0) return true;
  return statusFilter.map(s => s.toLowerCase()).includes((ticketStatus || '').toLowerCase());
}

function matchesClient(clientCategory, clientFilter, allClientOptions) {
  // No filter or all clients selected — include everything
  if (!clientFilter || clientFilter.length === 0) return true;
  if (allClientOptions && clientFilter.length >= allClientOptions.length) return true;
  const normalized = normalizeClient(clientCategory || '');
  const val = normalized.toLowerCase();
  // "Product" label means applies to all clients
  if (val === 'product') return true;
  // Empty means engineering ticket — include when subset selected too
  if (!val) return true;
  return clientFilter.map(c => c.toLowerCase()).includes(val);
}

async function callClaude(tickets, clientName) {
  const ticketList = tickets.map(t =>
    `Ticket: ${t.key}\nTitle: ${t.summary}\nClient: ${t.clientCategory || 'All'}\nDescription: ${t.description || 'No description provided.'}\nEngineering-only: ${t.engineeringOnly ? 'Yes' : 'No'}`
  ).join('\n\n---\n\n');


  const ticketCount = tickets.length;

  const clientLabel = Array.isArray(clientName) ? clientName.join(', ') : clientName;

  const prompt = `Generate release notes for ${clientLabel}.

There are ${ticketCount} tickets below. Your output array MUST contain exactly ${ticketCount} items — one per ticket, no exceptions.

Here are the tickets:

${ticketList}

Return ONLY a JSON array of exactly ${ticketCount} items. No preamble, no markdown fences. Each item must be:
{
  "key": "...",
  "ppKey": "...",
  "category": "New Features" | "Improvements" | "Bug Fixes" | "Platform & Performance",
  "title": "...",
  "summary": "...",
  "bullets": ["...", "..."],
  "client": "...",
  "flag": false
}
Or if a ticket is too vague:
{
  "key": "...",
  "flag": true,
  "reason": "..."
}
The "client" field should be the client name from the ticket data above.
The "ppKey" field should be the ticket key (e.g. PP-1225) for reference.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6000,
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

  const { email, devopsTicket, clientFilter, statusFilter, allClientOptions } = req.body || {};

  if (!email || !ALLOWED_EMAILS.includes(email.toLowerCase())) {
    return res.status(403).json({ error: 'Access denied. Your email is not authorised.' });
  }
  if (!devopsTicket || !clientFilter || !statusFilter) {
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

    // Step 2: Fetch all VTECH tickets in parallel
    const vtechResults = await Promise.all(
      vtechLinks.map(vk => fetchIssue(vk, 'summary,issuelinks,customfield_10627,description,status'))
    );

    // Step 3: Identify PP tickets needed, fetch them in parallel
    const ppKeysNeeded = [];
    const vtechToPP = {};

    for (let i = 0; i < vtechLinks.length; i++) {
      const vk = vtechLinks[i];
      const vtech = vtechResults[i];
      const cloneLink = (vtech.fields.issuelinks || []).find(
        l => l.type.name === 'Cloners' && l.outwardIssue?.key?.startsWith('PP-')
      );
      if (cloneLink) {
        const ppKey = cloneLink.outwardIssue.key;
        vtechToPP[vk] = ppKey;
        if (!ppKeysNeeded.includes(ppKey)) ppKeysNeeded.push(ppKey);
      }
    }

    // Fetch all PP tickets in parallel
    const ppResults = await Promise.all(
      ppKeysNeeded.map(pk => fetchIssue(pk, 'summary,customfield_10627,description,status'))
    );
    const ppByKey = {};
    ppKeysNeeded.forEach((pk, i) => { ppByKey[pk] = ppResults[i]; });

    // Step 4: Build ppMap with status filtering
    const ppMap = {};

    for (let i = 0; i < vtechLinks.length; i++) {
      const vk = vtechLinks[i];
      const vtech = vtechResults[i];
      const vtechStatus = vtech.fields.status?.name;

      if (vtechToPP[vk]) {
        const ppKey = vtechToPP[vk];
        if (ppMap[ppKey]) continue; // deduplicate
        if (!matchesStatus(vtechStatus, statusFilter)) {
          steps.push(`Skipping ${ppKey} — status "${vtechStatus}" not selected`);
          continue;
        }
        const pp = ppByKey[ppKey];
        ppMap[ppKey] = {
          key: ppKey,
          ppKey: ppKey,
          summary: pp.fields.summary,
          description: extractDescription(pp.fields.description),
          clientCategory: normalizeClient(pp.fields.customfield_10627?.value || ''),
          engineeringOnly: false
        };
      } else {
        if (ppMap[vk]) continue;
        if (!matchesStatus(vtechStatus, statusFilter)) {
          steps.push(`Skipping ${vk} — status "${vtechStatus}" not selected`);
          continue;
        }
        ppMap[vk] = {
          key: vk,
          ppKey: null,
          summary: vtech.fields.summary,
          description: extractDescription(vtech.fields.description),
          clientCategory: normalizeClient(vtech.fields.customfield_10627?.value || ''),
          engineeringOnly: true
        };
      }
    }

    // Step 5: Filter by client
    const filtered = Object.values(ppMap).filter(t => matchesClient(t.clientCategory, clientFilter, allClientOptions));
    steps.push(`${filtered.length} tickets match filters`);

    if (filtered.length === 0) {
      return res.status(200).json({ notes: [], steps, empty: true });
    }

    // Step 6: Generate with Claude
    steps.push('Generating release notes...');
    const notes = await callClaude(filtered, clientFilter);
    steps.push('Done');

    return res.status(200).json({ notes, steps });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
