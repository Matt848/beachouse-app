// Pulls 38° The Bathhouse events (sound sessions and anything else in the Trybe
// "SOUND SESSIONS + EVENTS" category) and writes docs/events.json for the app's What's On list.
// Runs in GitHub Actions on a schedule, so when the team adds or edits an event in Trybe, the app picks it up.
// Usage: node scripts/fetch-events.mjs docs/events.json
import { writeFileSync } from 'node:fs';

const SHOP = 'https://38thebathhouse.try.be';
const CATEGORY = '6928f73553c3da9ff80797b4'; // SOUND SESSIONS + EVENTS
const OUT = process.argv[2] || 'docs/events.json';
const DAYS = 'Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday';
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const get = async url => { const r = await fetch(url, { headers: { 'user-agent': 'BeachouseApp/1.0 (+events sync)' } }); if (!r.ok) throw new Error(url + ' ' + r.status); return r.text(); };
const decode = s => s.replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#039;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const text = html => decode(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const tidy = t => t.replace(/\s*\|\s*.*(calendar|schedule).*$/i, '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

function isoFor(day, monthName, now) {
  const m = MONTHS.indexOf(monthName); let y = now.getFullYear();
  if (m < now.getMonth() - 2) y++; // a January date seen in November belongs to next year
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

async function main() {
  const now = new Date();
  const cat = await get(`${SHOP}/offerings/categories/${CATEGORY}/events`);
  const links = [...new Set([...cat.matchAll(/https:\/\/38thebathhouse\.try\.be\/items\/[a-f0-9]+\/[a-z0-9-]+/g)].map(m => m[0]))];
  const events = [];
  for (const url of links) {
    const html = await get(url);
    const title = decode((html.match(/<title>([^<]*)<\/title>/) || [, ''])[1]).replace(/\s*·.*$/, '').trim();
    const img = (html.match(/https:\/\/cdn\.try\.be\/[^"' ]+?\.(?:jpg|jpeg|png|webp)/i) || [])[0] || '';
    const body = text(html);
    const main = body.slice(body.indexOf('Home ' + title) >= 0 ? body.indexOf('Home ' + title) : 0);
    const price = (main.match(/From (A\$[\d.,]+)/) || [])[1] || '';
    const dur = (main.match(/Lasts ([^A-Z]+?)(?= WEEK| Monday| Tuesday| Wednesday| Thursday| Friday| Saturday| Sunday| From |$)/) || [])[1] || '';
    const mins = (() => { const h = +(dur.match(/(\d+) hour/) || [, 0])[1]; const m = +(dur.match(/(\d+) minute/) || [, 0])[1]; return h * 60 + m || null; })();
    const name = tidy(title);
    const re = new RegExp(`(${DAYS}),?\\s+(\\d{1,2})\\s+(${MONTHS.join('|')}),?\\s+(\\d{1,2}(?::\\d{2})?\\s?[ap]m)\\s*[—–-]?\\s*([A-Za-z][A-Za-z '&.-]*?)?(?=\\s+(?:WEEK|${DAYS}|From)\\b|$)`, 'g');
    const seen = new Set(); let found = 0;
    for (const m of main.matchAll(re)) {
      const date = isoFor(+m[2], m[3], now); const time = m[4].replace(/\s/g, '').toLowerCase();
      const key = date + time; if (seen.has(key)) continue; seen.add(key); found++;
      events.push({ date, time, title: name, host: (m[5] || '').trim(), mins, price, url, img });
    }
    if (!found) events.push({ date: null, time: null, title: name, host: '', mins, price, url, img });
  }
  const today = now.toISOString().slice(0, 10);
  const upcoming = events.filter(e => !e.date || e.date >= today).sort((a, b) => (a.date || '9999') < (b.date || '9999') ? -1 : 1);
  const out = { updated: now.toISOString(), source: `${SHOP}/offerings/categories/${CATEGORY}`, events: upcoming };
  writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(`Wrote ${upcoming.length} events to ${OUT}`);
}
main().catch(e => { console.error(e); process.exit(1); });
