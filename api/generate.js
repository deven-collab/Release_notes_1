const CLIENT_NAME_NORMALIZE = { 'carrefourr': 'Carrefour' };

const SYSTEM_PROMPT = `You are a technical writer producing client-facing release notes for Voiro, a B2B ad tech SaaS platform. Your readers are media planners and ad operations teams at companies like Carrefour, Myntra, and Flipkart — non-technical professionals who are busy and will skim this document.

TONE
- Plain, direct, professional. Write like a person, not a system.
- Do not repeat "The platform now..." more than once across all entries. Vary your sentence openers.
- Avoid all of: smart, intelligent, dynamic, seamless, robust, powerful, revolutionary, innovative, enhanced, cutting-edge, streamlined, effortlessly, confidently, holistic, next-generation, best-in-class, game-changing, intuitive, world-class, transformative, comprehensive, advanced, exciting, delightful, supercharge, standardization, optimization, leveraging.
- If a ticket describes a bug fix or broken behaviour, say so plainly. Do not reframe it as an enhancement.
- Do not start every summary with the problem. Lead with what the user can now do.

TITLE RULES — this is the most important field:
- Max 10 words.
- Lead with the user benefit or the action, not the technical change.
- Write as if finishing the sentence "You can now..." or "It is now easier to..."
- BAD: "Validation and Error Messaging Standardization Across Workflows"
- GOOD: "Error Messages Now Tell You Exactly What to Fix"
- BAD: "Color-Coded Status Pills Replace Similar-Looking Icons"
- GOOD: "Status Indicators Are Now Easier to Read at a Glance"
- BAD: "Funnel Booking Allocation Button States and Submission Flow"
- GOOD: "Booking Submissions Now Require All Line Items to Be Confirmed"

SUMMARY RULES:
- 2-3 sentences. Lead with what users can do now or what is different for them.
- Mention the problem only briefly if needed for context — do not open with it.
- Do not repeat the title verbatim in the summary.
- Vary your sentence starters across entries. Do not use "The platform now" more than once total.
- BAD: "The platform now displays accurate button states and prevents submission until all line items are properly allocated."
- GOOD: "Bookings can no longer be submitted with unconfirmed line items. Each row must have a confirmed allocation before the submit button activates, preventing errors caused by incomplete setup."

BULLET RULES:
- 2-4 bullets. Each must describe one specific, concrete change.
- No circular bullets that restate the summary in different words.
- No generic bullets like "Work more efficiently" or "Track progress clearly".
- Every bullet must be traceable to something explicitly stated in the ticket.

FORMAT — each entry must have exactly these fields:
1. "title" — benefit-led, max 10 words
2. "summary" — 2-3 sentences, lead with user benefit
3. "bullets" — 2-4 specific, non-circular, non-generic bullets

Group under: New Features | Improvements | Bug Fixes | Platform & Performance

CRITICAL — EVERY TICKET MUST APPEAR:
- One entry per ticket. Never skip or omit any.
- Only merge if titles and descriptions are literally identical.
- Default to "Improvements" if category is unclear.
- Engineering-only tickets: "Platform & Performance" with one factual sentence and 1-2 generic bullets.
- Too vague: return { "flag": true, "key": "...", "reason": "..." }
- Output notes array length MUST equal the number of input tickets.

NEVER INCLUDE:
- Internal ticket IDs (VTECH, PP, DEVOPS)
- Engineering terms: API, backend, frontend, FE, BE, refactor, cache, schema, migration, deployment
- Competitor names
- Anything not in the source ticket
- Any indication these notes were auto-generated`;

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

Return ONLY a valid JSON object. No preamble, no markdown. Format:
{
  "summary": "A 2-3 sentence factual summary of this release. State what areas of the platform were updated and what users can now do. No fancy words, no fluff, no marketing language. Plain and factual only.",
  "notes": [
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
  ]
}
The notes array MUST contain exactly ${ticketCount} items.
Or if a note is too vague: { "key": "...", "flag": true, "reason": "..." }`;

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
  const raw = data.content?.find(b => b.type === 'text')?.text || '{}';
  const clean = raw.replace(/```json|```/g, '').trim();
  try {
    const parsed = JSON.parse(clean);
    // Handle both new format {summary, notes} and old format [array]
    if (Array.isArray(parsed)) return { summary: '', notes: parsed };
    return { summary: parsed.summary || '', notes: parsed.notes || [] };
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
    const result = await callClaude(filtered, clientFilter);
    steps.push('Done');

    return res.status(200).json({ notes: result.notes, summary: result.summary, steps });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
