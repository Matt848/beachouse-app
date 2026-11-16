// Cloudflare Worker for app.beachousebondi.com/api/coach
// Keeps the Anthropic API key on the server. Set the secret with: wrangler secret put ANTHROPIC_API_KEY
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/track') return track(request, env);
    if (url.pathname !== '/api/coach') return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    let body;
    try { body = await request.json(); } catch { return new Response('Bad request', { status: 400 }); }
    const messages = (body.messages || []).slice(-12).filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));
    if (!messages.length || messages[messages.length - 1].role !== 'user') return new Response('Bad request', { status: 400 });
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: env.COACH_MODEL || 'claude-haiku-4-5', max_tokens: 500, system: String(body.system || '').slice(0, 8000), messages })
    });
    if (!r.ok) return new Response(JSON.stringify({ error: 'coach_unavailable' }), { status: 502, headers: { 'content-type': 'application/json' } });
    const j = await r.json();
    const text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
    return new Response(JSON.stringify({ text }), { headers: { 'content-type': 'application/json' } });
  }
};

// First-party event log for the app (checkout clicks, shares) with the ad channel each member came from.
// Bind a KV namespace called TRACK_KV in wrangler.toml to keep the events; without it they only go to the Worker logs.
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
async function track(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS });
  let ev;
  try { ev = JSON.parse((await request.text()).slice(0, 8000)); } catch { return new Response('Bad request', { status: 400, headers: CORS }); }
  const rec = { ...ev, received: new Date().toISOString(), country: request.cf && request.cf.country };
  const key = `ev:${rec.received}:${crypto.randomUUID()}`;
  if (env.TRACK_KV) await env.TRACK_KV.put(key, JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 400 });
  else console.log('track', JSON.stringify(rec));
  return new Response(null, { status: 204, headers: CORS });
}
