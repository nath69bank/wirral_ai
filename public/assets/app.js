// All server text goes in via textContent, never innerHTML.

const $ = (id) => document.getElementById(id);

const TIERS = {
  cmd: { key: '⌘', name: 'CMD', label: 'Small' },
  shift: { key: '⇧', name: 'SHIFT', label: 'Medium' },
  cash: { key: '$', name: 'CASH', label: 'Gamble' },
};
const SPORTS = { football: 'Football', horse_racing: 'Horse racing', mma: 'UFC / MMA', boxing: 'Boxing', mixed: 'Multi-sport' };
const TYPES = { acca: 'Acca', bet_builder: 'Bet builder', single: 'Single', each_way: 'Each way', multiple: 'Multiple' };
const RESULTS = { won: 'Won', lost: 'Lost', void: 'Void', placed: 'Placed', pending: 'Pending' };

const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else n.setAttribute(k, v);
  }
  n.append(...kids.filter((k) => k != null));
  return n;
};

async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || `HTTP ${res.status}`), { status: res.status });
  return body;
}

function prettyDate(iso) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' });
}

function toast(text, action) {
  const t = $('toast');
  t.replaceChildren(el('p', { text }), action ?? el('button', { class: 'link', type: 'button', text: 'Close' }));
  t.hidden = false;
  t.querySelector('button')?.addEventListener('click', () => (t.hidden = true), { once: !action });
}

function safeUrl(u) {
  try {
    const url = new URL(u);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function betCard(bet) {
  const t = TIERS[bet.tier];
  const node = $('bet-tpl').content.firstElementChild.cloneNode(true);
  node.classList.add(bet.tier);
  node.querySelector('.bet-key').textContent = t.key;
  if (bet.tier === 'cash') node.querySelector('.bet-key').classList.add('cash');
  node.querySelector('.bet-tier').textContent = `${t.name} · ${t.label} · ${SPORTS[bet.sport]} ${TYPES[bet.bet_type].toLowerCase()}`;
  node.querySelector('.bet-odds').textContent = bet.odds;
  node.querySelector('.bet-stake').textContent = `${bet.stake_pts}pt stake`;
  const legs = node.querySelector('.legs');
  const foot = node.querySelector('.bet-foot');

  if (bet.locked) {
    node.classList.add('locked');
    node.querySelector('h3').textContent = `${bet.legs_count}-leg ${TYPES[bet.bet_type].toLowerCase()}`;
    // Placeholder rows under the blur; the real selections never reach the browser.
    for (let i = 0; i < bet.legs_count; i++) {
      legs.append(el('li', { class: 'leg' }, el('span', { class: 'leg-event', text: 'Members only · Event and time' }), el('span', { class: 'leg-sel', text: 'Selection hidden until you join' }), el('span', { class: 'leg-odds', text: '?/?' })));
    }
    foot.remove();
    node.append(
      el('div', { class: 'lock' },
        el('div', {},
          el('p', { text: '🔒 Members only' }),
          el('p', { class: 'meta', text: `First start ${bet.first_start ?? 'today'} UK` }),
          el('a', { class: 'primary', href: '#join', text: 'Unlock today\'s bets', style: 'text-decoration:none;display:inline-block' }),
        ),
      ),
    );
    return node;
  }

  node.querySelector('h3').textContent = bet.title;
  for (const l of bet.legs) {
    legs.append(
      el('li', { class: 'leg' },
        el('span', { class: 'leg-event', text: `${l.event} · ${l.start_uk}` }),
        el('span', { class: 'leg-sel', text: l.selection }),
        el('span', { class: 'leg-odds', text: l.odds }),
        el('p', { class: 'leg-why', text: l.reasoning }),
      ),
    );
  }
  foot.append(
    el('p', { class: 'value' }, el('b', { text: 'Why it\'s value: ' }), bet.value_case),
    el('p', { class: 'check' }, el('b', { text: 'Check before placing: ' }), bet.check),
  );
  if (bet.result && bet.result !== 'pending') {
    const p = bet.result === 'won' ? `+${Math.round(bet.stake_pts * (bet.decimal_odds - 1) * 100) / 100}pts` : bet.result === 'lost' ? `-${bet.stake_pts}pts` : bet.profit_pts != null ? `${bet.profit_pts}pts` : '';
    foot.prepend(el('span', { class: `result ${bet.result}`, text: `${RESULTS[bet.result]} ${p}`.trim() }));
    if (bet.settled_note) foot.append(el('p', { class: 'check', text: bet.settled_note }));
  }
  return node;
}

function renderCard(data) {
  const bets = $('bets');
  if (!data.card) {
    bets.replaceChildren(el('div', { class: 'empty', text: 'The first card lands on the next matchday. Check back soon.' }));
    return;
  }
  const { card } = data;
  $('card-summary').textContent = card.summary || (data.locked ? 'Today\'s bets are live. Join to see the selections.' : '');
  bets.replaceChildren(
    ...(card.bets.length ? card.bets.map(betCard) : [el('div', { class: 'empty', text: 'No bet cleared the value bar today, so nothing was posted. That\'s the system working.' })]),
  );

  $('passed-panel').hidden = !card.passed_on;
  $('passed').textContent = card.passed_on || '';
  const sources = (card.sources || []).map((s) => {
    const href = safeUrl(s.url);
    return el('li', {}, href ? el('a', { href, rel: 'noopener nofollow', target: '_blank', text: s.title || href }) : s.title);
  });
  $('sources-panel').hidden = !sources.length;
  $('sources').replaceChildren(...sources);
}

function stat(label, r, key) {
  const sign = r.profit_pts > 0 ? '+' : '';
  return el('div', { class: 'stat' },
    el('div', { class: 'k' }, key ? el('kbd', { class: key === '$' ? 'cash' : '', text: key }) : null, label),
    el('div', { class: `v ${r.profit_pts > 0 ? 'up' : r.profit_pts < 0 ? 'down' : ''}`, text: `${sign}${r.profit_pts}pts` }),
    el('div', { class: 's', text: r.bets ? `${r.won}/${r.bets} won · ROI ${r.roi}%` : 'No settled bets yet' }),
  );
}

function renderRecord(rec) {
  $('stats').replaceChildren(
    stat('All tiers', rec.overall),
    ...Object.entries(TIERS).map(([k, t]) => stat(t.name, rec.tiers[k], t.key)),
  );
}

let current;

async function load(date) {
  try {
    const data = await api(`/api/card${date ? `?date=${encodeURIComponent(date)}` : ''}`);
    current = data;
    renderCard(data);
    renderRecord(data.record);
    if (data.price_label) $('price').replaceChildren(...priceParts(data.price_label));
    $('join-box').hidden = data.member;
    $('member-box').hidden = !data.member;
    $('nav-join').hidden = data.member;
    $('nav-account').hidden = !data.member;

    const select = $('date');
    if (select.options.length !== data.dates.length) {
      select.replaceChildren(...data.dates.map((d) => el('option', { value: d, text: prettyDate(d) })));
    }
    select.value = data.date ?? '';
    select.parentElement.hidden = !data.dates.length;
  } catch (e) {
    $('bets').replaceChildren(el('div', { class: 'empty', text: `Couldn't load the card (${e.message}). Refresh to try again.` }));
  }
}

function priceParts(label) {
  const [amount, ...rest] = label.split('/');
  return rest.length ? [amount, el('small', { text: ` /${rest.join('/')}` })] : [label];
}

async function busy(button, fn) {
  button.disabled = true;
  try {
    await fn();
  } catch (e) {
    toast(e.status === 401 ? 'Your membership has lapsed. Join again to continue.' : 'That didn\'t work. Please try again in a minute.');
  } finally {
    button.disabled = false;
  }
}

$('date').addEventListener('change', (e) => {
  const url = new URL(location.href);
  url.searchParams.set('date', e.target.value);
  history.replaceState(null, '', url);
  load(e.target.value);
});

$('checkout').addEventListener('click', (e) => busy(e.currentTarget, async () => {
  location.href = (await api('/api/checkout', { method: 'POST' })).url;
}));

$('tg').addEventListener('click', (e) => busy(e.currentTarget, async () => {
  const { url } = await api('/api/telegram', { method: 'POST' });
  window.open(url, '_blank', 'noopener');
}));

$('portal').addEventListener('click', (e) => busy(e.currentTarget, async () => {
  location.href = (await api('/api/auth?action=portal', { method: 'POST' })).url;
}));

$('nav-account').addEventListener('click', () => $('member-box').scrollIntoView());

$('logout').addEventListener('click', async () => {
  await api('/api/auth?action=logout', { method: 'POST' }).catch(() => {});
  load(current?.date);
});

$('login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const button = e.currentTarget.querySelector('button');
  button.disabled = true;
  try {
    await api('/api/auth?action=login', { method: 'POST', body: { email: $('email').value } });
    $('login-msg').textContent = 'If that email has an active membership, a sign-in link is on its way.';
  } catch {
    $('login-msg').textContent = 'Check the email address and try again.';
  } finally {
    button.disabled = false;
  }
});

const params = new URLSearchParams(location.search);
const notices = {
  failed: 'We couldn\'t confirm that payment. If you were charged, use the sign-in link below.',
  expired: 'That sign-in link has expired. Request a new one below.',
  lapsed: 'Your membership isn\'t active. Join again to unlock the bets.',
};
if (params.get('welcome')) {
  const join = el('button', { class: 'primary', type: 'button', text: 'Join Telegram' });
  toast('Welcome in. Today\'s bets are unlocked.', join);
  join.addEventListener('click', () => $('tg').click());
} else if (notices[params.get('signin')]) {
  toast(notices[params.get('signin')]);
}
load(params.get('date'));
