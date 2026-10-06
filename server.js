// SmartCampus backend: static hosting + validated REST API in front of Supabase.
// Zero dependencies (Node 18+). Every call forwards the user's own JWT, so Row Level Security still applies.
const http = require('http'), fs = require('fs'), path = require('path');
for (const f of ['.env.local', '.env']) {
  try { for (const l of fs.readFileSync(path.join(__dirname, f), 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  } } catch {}
}
const E = process.env;
const BASE = (E.SUPABASE_URL || E.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const KEY = E.SUPABASE_PUBLISHABLE_KEY || E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || E.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const PORT = E.PORT || 3000, PUB = path.join(__dirname, 'public');

const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const bad = (res, message) => send(res, 400, { message });
const str = (v, n) => String(v ?? '').trim().slice(0, n);
const readBody = req => new Promise((ok, no) => {
  let d = ''; req.on('data', c => { d += c; if (d.length > 1e5) { no(new Error('Body too large')); req.destroy(); } });
  req.on('end', () => { try { ok(d ? JSON.parse(d) : {}); } catch { no(new Error('Invalid JSON')); } });
});
const rest = (token, p, o = {}) => fetch(`${BASE}/rest/v1/${p}`, { ...o, headers: { apikey: KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...o.headers } });
const forward = async (res, r, okCode) => { const t = await r.text(); res.writeHead(r.ok && okCode ? okCode : r.status, { 'Content-Type': 'application/json' }); res.end(t || '{}'); };
const getUser = async token => { const r = await fetch(BASE + '/auth/v1/user', { headers: { apikey: KEY, Authorization: 'Bearer ' + token } }); return r.ok ? r.json() : null; };
const REP = { Prefer: 'return=representation' };

async function api(req, res, u) {
  if (u.pathname === '/api/health') return send(res, 200, { ok: true, supabase: !!(BASE && KEY) });
  if (u.pathname === '/api/config') return send(res, 200, { url: BASE, key: KEY });
  if (!BASE || !KEY) return send(res, 503, { message: 'Supabase is not configured (.env.local)' });
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const me = token && await getUser(token);
  if (!me) return send(res, 401, { message: 'Session expired. Please log in again.' });
  const [what, id] = u.pathname.split('/').slice(2), m = req.method;

  if (what === 'profile') {
    if (m === 'GET') return forward(res, await rest(token, `profiles?id=eq.${me.id}&select=*`, { headers: { Accept: 'application/vnd.pgrst.object+json' } }));
    if (m === 'POST') {
      const b = await readBody(req);
      const row = { id: me.id, email: me.email, full_name: str(b.full_name, 80), college_id: str(b.college_id, 40),
        department: str(b.department, 60), academic_year: str(b.academic_year, 30), role: b.role === 'faculty' ? 'faculty' : 'student' };
      if (!row.full_name) return bad(res, 'Name is required');
      return forward(res, await rest(token, 'profiles?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(row) }), 201);
    }
  }
  if (what === 'resources') {
    if (m === 'GET') return forward(res, await rest(token, 'shared_resources?select=*&order=created_at.desc&limit=200'));
    if (m === 'POST') {
      const b = await readBody(req);
      const p = await (await rest(token, `profiles?id=eq.${me.id}&select=full_name,role`)).json().catch(() => []);
      const row = { user_id: me.id, title: str(b.title, 120), category: str(b.category, 40) || 'Notes', subject: str(b.subject, 80),
        semester: str(b.semester, 20) || 'All', branch: str(b.branch, 40) || 'All', description: str(b.description, 600),
        author: p[0]?.full_name || str(b.author, 80) || 'SmartCampus User', role: p[0]?.role === 'faculty' ? 'Faculty' : 'Student',
        visibility: str(b.visibility, 40) || 'Everyone', link: /^https?:\/\//i.test(b.link || '') ? str(b.link, 500) : '' };
      if (!row.title || !row.subject) return bad(res, 'Title and subject are required');
      return forward(res, await rest(token, 'shared_resources', { method: 'POST', headers: REP, body: JSON.stringify(row) }), 201);
    }
    if (m === 'DELETE' && /^[\w-]+$/.test(id || '')) {
      const r = await rest(token, `shared_resources?id=eq.${id}`, { method: 'DELETE', headers: REP });
      const rows = r.ok ? await r.json() : null;
      if (rows && !rows.length) return send(res, 403, { message: 'Not allowed, or resource not found' });
      return rows ? send(res, 200, { deleted: rows.length }) : forward(res, r);
    }
  }
  if (what === 'peers') {
    if (m === 'GET') return forward(res, await rest(token, 'peer_mentors?select=*&order=created_at.desc&limit=200'));
    if (m === 'POST') {
      const b = await readBody(req);
      const row = { user_id: me.id, name: str(b.name, 80), dept: str(b.dept, 40), year: str(b.year, 20) || '2nd Year',
        tags: (Array.isArray(b.tags) ? b.tags : []).map(t => str(t, 30)).filter(Boolean).slice(0, 8),
        resource: str(b.resource, 120), contact: str(b.contact, 80) };
      if (!row.name) return bad(res, 'Student name is required');
      return forward(res, await rest(token, 'peer_mentors', { method: 'POST', headers: REP, body: JSON.stringify(row) }), 201);
    }
    if (m === 'DELETE' && /^[\w-]+$/.test(id || '')) {
      const r = await rest(token, `peer_mentors?id=eq.${id}`, { method: 'DELETE', headers: REP });
      const rows = r.ok ? await r.json() : null;
      if (rows && !rows.length) return send(res, 403, { message: 'Not allowed, or student not found' });
      return rows ? send(res, 200, { deleted: rows.length }) : forward(res, r);
    }
  }
  if (what === 'transactions') {
    if (m === 'GET') return forward(res, await rest(token, `transactions?user_id=eq.${me.id}&select=*&order=created_at.desc&limit=500`));
    if (m === 'POST') {
      const b = await readBody(req), amount = Number(b.amount);
      const row = { user_id: me.id, title: str(b.title, 80), amount, type: b.type === 'income' ? 'income' : 'expense' };
      if (!row.title) return bad(res, 'Description is required');
      if (!(amount > 0 && amount < 1e9)) return bad(res, 'Amount must be a positive number');
      return forward(res, await rest(token, 'transactions', { method: 'POST', headers: REP, body: JSON.stringify(row) }), 201);
    }
  }
  send(res, 404, { message: 'Unknown endpoint' });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
function serve(res, u) {
  let p = decodeURIComponent(u.pathname); if (p === '/') p = '/index.html';
  const f = path.normalize(path.join(PUB, p));
  if (!f.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    res.end(d);
  });
}

http.createServer(async (req, res) => {
  try { const u = new URL(req.url, 'http://localhost'); return u.pathname.startsWith('/api/') ? await api(req, res, u) : serve(res, u); }
  catch (e) { send(res, /JSON|large/.test(e.message) ? 400 : 502, { message: e.message }); }
}).listen(PORT, () => console.log(`SmartCampus running → http://localhost:${PORT}  (Supabase: ${BASE && KEY ? 'configured' : 'NOT configured, demo mode'})`));
