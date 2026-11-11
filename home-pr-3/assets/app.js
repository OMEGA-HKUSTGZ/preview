// The only scripts on the site: remember who is looking, keep countdowns current, filter and search.
// Nothing is sent anywhere; the choice of person lives in this browser's localStorage.
// On the live build (body[data-status]) the page also reads the gateway's model status once; see the end.
(() => {
  const body = document.body;
  const now = () => (body.dataset.now ? new Date(body.dataset.now) : new Date());
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };

  // ---- navigation on small screens
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');
  const closeNav = () => { toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', '打开导航'); nav.classList.remove('is-open'); };
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? '关闭导航' : '打开导航');
    nav.classList.toggle('is-open', open);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') { closeNav(); toggle.focus(); } });

  // ---- countdowns: calendar days in Shanghai
  const day = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(d);
  const daysTo = (iso) => Math.round((Date.parse(day(new Date(iso)) + 'T00:00:00Z') - Date.parse(day(now()) + 'T00:00:00Z')) / 86400000);
  for (const el of document.querySelectorAll('[data-at]')) {
    const n = daysTo(el.dataset.at);
    if ('days' in el.dataset) {
      el.querySelector('b').textContent = n;
      el.classList.toggle('is-soon', n <= 7);
    } else {
      el.textContent = n === 0 ? '今天' : n > 0 ? `还有 ${n} 天` : `已过 ${-n} 天`;
    }
  }
  // A deadline that passed since the last build drops out of the list.
  for (const li of document.querySelectorAll('[data-end]')) if (new Date(li.dataset.end) < now()) li.remove();

  // ---- who is looking
  const who = document.getElementById('who');
  const me = () => store.get('lab-home:me') ?? body.dataset.defaultViewer ?? '';
  if (who) {
    const show = (id) => {
      const blocks = [...document.querySelectorAll('#people [data-person]')];
      const mine = blocks.find((b) => b.dataset.person === id) ?? blocks.find((b) => b.dataset.person === '');
      for (const b of blocks) b.hidden = b !== mine;
      who.value = mine.dataset.person;
      document.getElementById('greeting').textContent = mine.dataset.name ? `${mine.dataset.name}，这周和你有关的事` : '这周和你有关的事';
    };
    who.addEventListener('change', () => { store.set('lab-home:me', who.value); show(who.value); });
    show(me());
  }
  // On a minutes page, mark the rows that are mine.
  for (const el of document.querySelectorAll('[data-owners]')) if (me() && el.dataset.owners.split(' ').includes(me())) el.classList.add('is-mine');

  // ---- affairs: whose pages, and copying the sentence for the agent
  const go = (id, subPath) => { location.href = `${body.dataset.base}affairs/p/${id}/${subPath}`; };
  const viewWho = document.getElementById('view-who');
  viewWho?.addEventListener('change', () => { store.set('lab-home:me', viewWho.value); store.set('lab-home:member', viewWho.value); go(viewWho.value, viewWho.dataset.sub); });
  if (viewWho) store.set('lab-home:member', viewWho.value);
  for (const a of document.querySelectorAll('a[data-me]')) a.addEventListener('click', () => store.set('lab-home:me', a.dataset.me));
  // Back from the PI's pages to the member last looked at.
  const back = document.querySelector('a[data-view="member"]:not([aria-current])');
  const last = store.get('lab-home:member');
  if (back && last && /^[a-z0-9-]+$/.test(last)) back.href = `${body.dataset.base}affairs/p/${last}/${back.dataset.sub}`;
  back?.addEventListener('click', () => store.set('lab-home:me', back.href.split('/affairs/p/')[1].split('/')[0]));
  for (const b of document.querySelectorAll('button.copy')) {
    b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = '已复制'; } catch { b.textContent = '复制不了，请手动选中'; }
      setTimeout(() => { b.textContent = '复制'; }, 1800);
    });
  }

  // ---- deadlines: direction and kind filters
  const dls = document.getElementById('dls');
  if (dls) {
    const papers = document.getElementById('dl-papers');
    const chips = [...document.querySelectorAll('#dl-dirs .chip')];
    let dir = new URLSearchParams(location.search).get('d') ?? '';
    const apply = () => {
      let shown = 0;
      for (const c of chips) c.classList.toggle('is-on', c.dataset.dir === dir);
      for (const li of dls.children) {
        const dirs = li.dataset.dirs ? li.dataset.dirs.split(' ') : [];
        const ok = (!dir || !dirs.length || dirs.includes(dir)) && (!papers.checked || ['paper', 'abstract'].includes(li.dataset.kind));
        li.hidden = !ok;
        if (ok) shown++;
      }
      document.getElementById('dl-empty').hidden = shown > 0;
    };
    for (const c of chips) c.addEventListener('click', () => { dir = c.dataset.dir; apply(); });
    papers.addEventListener('change', apply);
    apply();
  }

  // ---- library: search in the browser
  const q = document.getElementById('q');
  if (q) {
    const docs = [...document.getElementById('docs').children];
    const chips = [...document.querySelectorAll('.search .chip')];
    const count = document.getElementById('q-count');
    let kind = '';
    let index = new Map();
    const apply = () => {
      const terms = q.value.toLowerCase().split(/\s+/).filter(Boolean);
      let shown = 0;
      for (const li of docs) {
        const text = (index.get(li.dataset.id) ?? li.textContent).toLowerCase();
        const ok = (!kind || li.dataset.kind === kind) && terms.every((t) => text.includes(t));
        li.hidden = !ok;
        const snip = li.querySelector('.snippet');
        snip.hidden = true;
        if (ok) {
          shown++;
          // Show where the first term was found when it is not already visible on the card.
          const full = index.get(li.dataset.id);
          if (terms.length && full && !li.querySelector('h3').textContent.toLowerCase().includes(terms[0])) {
            const at = full.toLowerCase().indexOf(terms[0]);
            if (at >= 0) {
              snip.textContent = '';
              const from = Math.max(0, at - 28);
              snip.append(`${from ? '…' : ''}${full.slice(from, at)}`);
              const mark = document.createElement('mark');
              mark.textContent = full.slice(at, at + terms[0].length);
              snip.append(mark, `${full.slice(at + terms[0].length, at + terms[0].length + 48)}…`);
              snip.hidden = false;
            }
          }
        }
      }
      count.textContent = terms.length || kind ? `找到 ${shown} 项` : `共 ${docs.length} 项`;
      document.getElementById('q-empty').hidden = shown > 0;
    };
    for (const c of chips) c.addEventListener('click', () => { kind = c.dataset.kind; for (const x of chips) x.classList.toggle('is-on', x === c); apply(); });
    q.addEventListener('input', apply);
    q.value = new URLSearchParams(location.search).get('q') ?? '';
    fetch(q.dataset.index).then((r) => r.json()).then((list) => { index = new Map(list.map((e) => [e.id, e.text])); apply(); }).catch(apply);
  }

  // ---- live build only: model service state, asked from the gateway once when the page opens
  // The build decides no state. body[data-status] is the gateway's status address (same origin as this page,
  // so the signed-in session goes with the request). Shape: docs/inputs.md, "spark-ops".
  const targets = [...document.querySelectorAll('[data-model]')];
  if (body.dataset.status && targets.length) {
    const paint = (el, key, label, waiting) => {
      el.querySelector('.dot').className = `dot dot-${key}`;
      el.querySelector('[data-state-label]').textContent = label;
      const state = el.querySelector('.state');
      if (state) state.className = `state state-${key}`;
      const w = el.querySelector('[data-waiting]');
      if (w) w.textContent = waiting == null ? '—' : `${waiting} 个请求`;
    };
    // Beijing time, 'HH:MM' or 'MM-DD HH:MM'; '' when the gateway sent no usable time.
    const clock = (iso, withDay) => {
      if (Number.isNaN(Date.parse(iso))) return '';
      const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
      return `${withDay ? `${p.month}-${p.day} ` : ''}${p.hour}:${p.minute}`;
    };
    fetch(body.dataset.status, { credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' } })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((status) => {
        if (!Array.isArray(status.models)) throw new Error('shape');
        for (const el of targets) {
          const names = [el.dataset.model, ...el.dataset.aliases.split(' ').filter(Boolean)];
          const st = status.models.find((m) => m.name === names[0]) ?? status.models.find((m) => names.includes(m.name));
          // In the band on the home page, a model that is not running is simply not listed.
          if (!st) { if (el.classList.contains('svc')) el.hidden = true; else paint(el, 'off', '未上线'); continue; }
          if (!st.online) paint(el, 'down', '不可用', st.waiting);
          else if (st.enabled && st.healthy != null && st.healthy < st.enabled) paint(el, 'degraded', `降级（${st.healthy}/${st.enabled} 组）`, st.waiting);
          else paint(el, 'ok', '正常', st.waiting);
        }
        const at = clock(status.at) && `${clock(status.at)} 查询`;
        for (const el of document.querySelectorAll('[data-status-at]')) {
          el.textContent = el.closest('.service-band') ? at : [at, typeof status.ttft_p50 === 'number' ? `首字延迟中位数 ${status.ttft_p50.toFixed(1)} 秒` : ''].filter(Boolean).join(' · ') + (at ? '。' : '');
        }
        const alerts = document.querySelector('[data-alerts]');
        for (const a of alerts && Array.isArray(status.alerts) ? status.alerts : []) {
          const li = document.createElement('li');
          const dot = document.createElement('span');
          dot.className = 'dot dot-degraded';
          const since = document.createElement('span');
          since.className = 'muted';
          since.textContent = clock(a.since, true) && ` · 自 ${clock(a.since, true)}`;
          li.append(dot, String(a.summary || a.name || ''), since);
          alerts.append(li);
          alerts.hidden = false;
        }
      })
      .catch(() => { for (const el of targets) paint(el, 'unknown', '状态见门户状态页'); });
  }
})();
