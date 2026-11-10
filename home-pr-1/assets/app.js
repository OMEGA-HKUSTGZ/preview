// The only scripts on the site: remember who is looking, keep countdowns current, filter and search.
// Nothing is sent anywhere; the choice of person lives in this browser's localStorage.
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
})();
