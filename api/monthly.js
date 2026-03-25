const MONTHLY_SYSTEM_PROMPT = `You are writing a monthly product update for Voiro, a B2B ad tech SaaS platform. Your audience is a mix of internal leadership, client leadership, and operations teams.

TONE & STYLE — study these principles carefully:
- Narrative and strategic. Write like a thoughtful product leader, not a changelog.
- Lead with the theme of the month — what problem space did this cycle address?
- Each section should explain the "why" behind the change, not just the "what".
- Use operational impact and user impact as separate lenses.
- Sentences should be direct and confident. No fluff, no marketing speak.
- Avoid: seamless, robust, powerful, innovative, revolutionary, cutting-edge, game-changing, exciting, delightful.
- Vary sentence length. Mix short punchy sentences with longer explanatory ones.
- Do not use "The platform now..." as an opener. Find more varied, human entries.

STRUCTURE — generate exactly this JSON structure:
{
  "month": "Month Year",
  "tagline": "A short thematic subtitle — 5-8 words capturing the focus of this cycle",
  "intro": "2-3 sentences. Set the context for this month. What theme connected the work? What problem space was the team operating in?",
  "sections": [
    {
      "title": "Section title — benefit or outcome focused, not technical",
      "body": "2-4 sentences. Explain what changed, why it matters, and what it enables. Write for someone who understands the business but not the code.",
      "operational_impact": "One sentence. What changes for ops teams day-to-day?",
      "user_impact": "One sentence. What changes for end users?"
    }
  ],
  "closing": "2-3 sentences. Synthesise the month. What does this release collectively move towards? Optional: one sentence on what's coming next if inferable from the tickets.",
  "cta": "If you have questions or feedback on any of these updates, please reach out to your Voiro point of contact."
}

RULES:
- One section per meaningful ticket. Never skip a ticket.
- Only merge tickets if they are literally the same feature.
- Section titles must be outcome-focused. BAD: "GST Timezone Update". GOOD: "Market-Accurate Timestamps for Gulf Operations".
- Do not use internal ticket IDs anywhere.
- Do not use engineering terms: API, backend, frontend, schema, refactor, migration, deployment, cache.
- The intro and closing must connect the sections into a coherent narrative — not just list them.
- Return ONLY valid JSON. No preamble, no markdown fences.`;

function jiraHeaders() {
  return {
    'Authorization': 'Basic ' + Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN}`).toString('base64'),
    'Accept': 'application/json'
  };
}

async function fetchIssue(key, fields = 'summary,issuelinks,customfield_10627,description,status,issuetype') {
  const url = `${process.env.JIRA_BASE_URL}/rest/api/3/issue/${key}?fields=${fields}`;
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
    return parts.slice(0, 15).join(' ');
  }
  return '';
}

function detectProjectKey(id) {
  if (id.startsWith('PP-')) return 'PP';
  if (id.startsWith('VTECH-')) return 'VTECH';
  if (id.startsWith('DEVOPS-')) return 'DEVOPS';
  return 'UNKNOWN';
}

async function resolveTicketToContent(key) {
  const issue = await fetchIssue(key);
  const project = detectProjectKey(key);

  if (project === 'PP') {
    return {
      key,
      summary: issue.fields.summary,
      description: extractDescription(issue.fields.description),
      source: 'PP'
    };
  }

  if (project === 'VTECH') {
    // Try to find PP parent via Cloners link
    const cloneLink = (issue.fields.issuelinks || []).find(
      l => l.type.name === 'Cloners' && l.outwardIssue?.key?.startsWith('PP-')
    );
    if (cloneLink) {
      const pp = await fetchIssue(cloneLink.outwardIssue.key, 'summary,description');
      return {
        key: cloneLink.outwardIssue.key,
        summary: pp.fields.summary,
        description: extractDescription(pp.fields.description),
        source: 'PP via VTECH'
      };
    }
    return {
      key,
      summary: issue.fields.summary,
      description: extractDescription(issue.fields.description),
      source: 'VTECH'
    };
  }

  if (project === 'DEVOPS') {
    // Traverse: DEVOPS → VTECH → PP
    const vtechLinks = (issue.fields.issuelinks || [])
      .filter(l => l.type.name === 'Blocks' && l.inwardIssue)
      .map(l => l.inwardIssue.key);

    const results = [];
    const seen = new Set();

    await Promise.all(vtechLinks.map(async vk => {
      try {
        const vtech = await fetchIssue(vk, 'summary,issuelinks,description');
        const cloneLink = (vtech.fields.issuelinks || []).find(
          l => l.type.name === 'Cloners' && l.outwardIssue?.key?.startsWith('PP-')
        );
        if (cloneLink) {
          const ppKey = cloneLink.outwardIssue.key;
          if (!seen.has(ppKey)) {
            seen.add(ppKey);
            const pp = await fetchIssue(ppKey, 'summary,description');
            results.push({
              key: ppKey,
              summary: pp.fields.summary,
              description: extractDescription(pp.fields.description),
              source: 'PP via DEVOPS'
            });
          }
        } else {
          if (!seen.has(vk)) {
            seen.add(vk);
            results.push({
              key: vk,
              summary: vtech.fields.summary,
              description: extractDescription(vtech.fields.description),
              source: 'VTECH via DEVOPS'
            });
          }
        }
      } catch (e) { /* skip failed tickets */ }
    }));

    return results.length > 0 ? results : [{
      key,
      summary: issue.fields.summary,
      description: extractDescription(issue.fields.description),
      source: 'DEVOPS'
    }];
  }

  return { key, summary: issue.fields.summary, description: extractDescription(issue.fields.description), source: 'UNKNOWN' };
}

function extractTicketId(input) {
  const m = (input || '').trim().match(/browse\/([A-Z]+-\d+)/i) || (input || '').trim().match(/([A-Z]+-\d+)/i);
  return m ? m[1].toUpperCase() : (input || '').trim().toUpperCase();
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
  const { email, tickets, month } = req.body || {};

  if (!email || !ALLOWED_EMAILS.includes(email.toLowerCase())) {
    return res.status(403).json({ error: 'Access denied.' });
  }
  if (!tickets || !tickets.length) {
    return res.status(400).json({ error: 'Please provide at least one ticket.' });
  }

  try {
    // Resolve all tickets in parallel
    const ticketIds = tickets.map(extractTicketId).filter(Boolean);
    const resolvedArrays = await Promise.all(ticketIds.map(id => resolveTicketToContent(id).then(r => Array.isArray(r) ? r : [r]).catch(() => [])));
    const allTickets = resolvedArrays.flat();

    // Deduplicate by key
    const seen = new Set();
    const unique = allTickets.filter(t => { if (seen.has(t.key)) return false; seen.add(t.key); return true; });

    if (!unique.length) return res.status(200).json({ error: 'No content found for the provided tickets.' });

    const ticketList = unique.map(t =>
      `Key: ${t.key}\nTitle: ${t.summary}\nDescription: ${t.description || 'No description.'}`
    ).join('\n\n---\n\n');

    const monthLabel = month || new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' });

    const prompt = `Generate the monthly product update for ${monthLabel}.

There are ${unique.length} tickets below. Generate one section per ticket (do not skip any).

${ticketList}

Return ONLY valid JSON matching the specified structure.`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 6000,
        system: MONTHLY_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!claudeRes.ok) throw new Error(`Claude API error: ${claudeRes.status}`);
    const data = await claudeRes.json();
    const raw = data.content?.find(b => b.type === 'text')?.text || '{}';
    const clean = raw.replace(/```json|```/g, '').trim();

    try {
      const result = JSON.parse(clean);
      return res.status(200).json({ result });
    } catch (e) {
      throw new Error(`Parse error: ${clean.slice(0, 200)}`);
    }

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
