const CLIENT_NAME_NORMALIZE = { 'carrefourr': 'Carrefour' };

const SYSTEM_PROMPT = `You are a professional technical writer generating client-facing release notes for Voiro, a B2B ad tech SaaS platform. Your audience is non-technical media planners and ad operations teams.

TONE & FORMAT
- Professional and formal throughout
- Each entry must follow this exact structure:
  1. "title": A clear, benefit-led headline
  2. "summary": 2-3 sentences explaining what changed and why it benefits the user
  3. "bullets": An array of 2-4 concise bullet points. Each starts with a strong verb and focuses on user benefit.
- Group all entries under exactly these four categories:
  New Features | Improvements | Bug Fixes | Platform & Performance

CRITICAL — EVERY TICKET MUST APPEAR IN THE OUTPUT:
- Produce one output entry for every single ticket. Never skip or omit any.
- Only merge tickets if they have literally identical titles and descriptions.
- If category is unclear, default to "Improvements".
- Engineering-only tickets go under "Platform & Performance" with generic benefit-led language.
- If a ticket is too vague, return: { "flag": true, "key": "...", "reason": "..." }
- Output array length MUST equal the number of tickets provided.

HARD RULES — NEVER include:
- Internal ticket IDs (VTECH, PP, DEVOPS, or similar)
- Technical terms: API, backend, frontend, FE, BE, refactor, cache, schema, migration, deployment
- Competitor names or references
- Speculation beyond the source ticket description
- Any indication notes were auto-generated

CONTENT RULES
- Present tense: "The platform now...", "Users can now..."
- Focus on user benefit, not implementation
- Bug fixes: "An issue affecting X has been resolved."
- Engineering tickets: generic Platform & Performance language only`;

function jiraHeaders() {
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_TOKEN;
  return {
    'Authorization': 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64'),
    'Accept': 'application/json'
  };
}

async function fetchIssue(key, fields = 'summary,issuelinks,customfield_10627,description,status') {
  const url = `${process.env.JIRA_BASE_URL}/rest/api/3/issue/${key}?fields=${fields}`;
  const res = await fetch(url, { headers: jiraHeaders() });
  if (!res.ok) throw new Error(`Jira fetch failed for ${key}: ${res.status}`);
  return res.json();
}

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
    return parts.slice(0, 12).join(' ');
  }
  return '';
}

function matchesStatus(ticketStatus, statusFilter) {
  if (!statusFilter || statusFilter.length === 0) return true;
  return statusFilter.map(s => s.toLowerCase()).includes((ticketStatus || '').toLowerCase());
}

function matchesClient(clientCategory, clientFilter, allClientOptions) {
  if (!clientFilter || clientFilter.length === 0) return true;
  if (allClientOptions && clientFilter.length >= allClientOptions.length) return true;
  const val = normalizeClient(clientCategory || '').toLowerCase();
  if (val === 'product') return true;
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

There are ${ticketCount} tickets. Your output array MUST contain exactly ${ticketCount} items.

${ticketList}

Return ONLY a valid JSON array of exactly ${ticketCount} items. No preamble, no markdown. Each item:
{
  "key": "...",
  "ppKey": "...",
  "category": "New Features" | "Improvements" | "Bug Fixes" | "Platform & Performance",
  "title": "...",
  "summary": "...",
  "bullets": ["...", "...", "..."],
  "client": "...",
  "flag": false
}
Or if too vague: { "key": "...", "flag": true, "reason": "..." }`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = data.content?.find(b => b.type === 'text')?.text || '[]';
  const clean = raw.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch (e) {
    throw new Error(`Claude response parse error: ${clean.slice(0, 200)}`);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
  const { email, devopsTicket, clientFilter, statusFilter, allClientOptions } = req.body || {};

  if (!email || !ALLOWED_EMAILS.includes(email.toLowerCase())) {
    return res.status(403).json({ error: 'Access denied.' });
  }
  if (!devopsTicket || !clientFilter || !statusFilter) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const steps = [];

    // Step 1: Fetch DEVOPS ticket
    const devops = await fetchIssue(devopsTicket.toUpperCase());
    const vtechLinks = (devops.fields.issuelinks || [])
      .filter(l => l.type.name === 'Blocks' && l.inwardIssue)
      .map(l => l.inwardIssue.key);
    steps.push(`Found ${vtechLinks.length} linked tickets`);

    // Step 2: Fetch all VTECH tickets in parallel
    const vtechResults = await Promise.all(
      vtechLinks.map(vk => fetchIssue(vk, 'summary,issuelinks,customfield_10627,description,status'))
    );

    // Step 3: Identify PP tickets, fetch in parallel
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
        if (ppMap[ppKey]) continue;
        if (!matchesStatus(vtechStatus, statusFilter)) { steps.push(`Skipping ${ppKey} — status "${vtechStatus}" not selected`); continue; }
        const pp = ppByKey[ppKey];
        ppMap[ppKey] = {
          key: ppKey, ppKey,
          summary: pp.fields.summary,
          description: extractDescription(pp.fields.description),
          clientCategory: normalizeClient(pp.fields.customfield_10627?.value || ''),
          engineeringOnly: false
        };
      } else {
        if (ppMap[vk]) continue;
        if (!matchesStatus(vtechStatus, statusFilter)) { steps.push(`Skipping ${vk} — status "${vtechStatus}" not selected`); continue; }
        ppMap[vk] = {
          key: vk, ppKey: null,
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
    const notes = await callClaude(filtered, clientFilter);
    steps.push('Done');

    return res.status(200).json({ notes, steps });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
