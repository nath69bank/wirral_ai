// Renders one acca from data/accas/<date>.json. All model-written text goes in
// via textContent, never innerHTML.

const $ = (id) => document.getElementById(id);

const MARKET_TAGS = {
  shots_on_target: ['Shots OT', 'shots'],
  shots: ['Shots', 'shots'],
  cards: ['Card', 'cards'],
  fouls: ['Fouls', 'cards'],
  corners: ['Corners', ''],
  goals: ['Goals', ''],
  assists: ['Assist', ''],
  btts: ['BTTS', ''],
  other: ['Other', ''],
};

async function getJSON(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

function prettyDate(iso) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London',
  });
}

function pick(tpl, { tag, tagClass, selection, odds, why }) {
  const li = tpl.content.firstElementChild.cloneNode(true);
  const t = li.querySelector('.tag');
  t.textContent = tag;
  if (tagClass) t.classList.add(tagClass);
  li.querySelector('.sel').textContent = selection;
  li.querySelector('.odds').textContent = odds && odds !== 'n/a' ? odds : '';
  li.querySelector('.why').textContent = why;
  return li;
}

function safeUrl(u) {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function render(acca) {
  const gw = acca.gameweek ? ` · Gameweek ${acca.gameweek}` : '';
  $('meta').textContent = `${prettyDate(acca.date)}${gw}`;
  $('headline').textContent = acca.headline;
  $('summary').textContent = acca.summary;
  $('total').textContent = acca.est_total_odds;
  document.title = `${acca.headline} · Acca Lab`;

  const badge = $('lineups');
  const lineupText = { confirmed: 'Team sheets confirmed', predicted: 'Predicted line-ups', mixed: 'Some line-ups confirmed' };
  badge.textContent = lineupText[acca.lineup_status] || '';
  badge.classList.toggle('confirmed', acca.lineup_status === 'confirmed');

  const legTpl = $('leg-tpl');
  const pickTpl = $('pick-tpl');
  const legs = $('legs');
  legs.replaceChildren(
    ...acca.legs.map((leg, i) => {
      const el = legTpl.content.firstElementChild.cloneNode(true);
      el.querySelector('.leg-no').textContent = i + 1;
      el.querySelector('.fixture').textContent = `${leg.home} v ${leg.away}`;
      el.querySelector('.ko').textContent = leg.kickoff_uk;
      el.querySelector('.picks').append(
        pick(pickTpl, {
          tag: leg.result.type === 'double_chance' ? 'Double chance' : 'Match win',
          tagClass: 'result',
          selection: leg.result.selection,
          odds: leg.result.est_odds,
          why: leg.result.why,
        }),
        ...leg.props.map((p) => {
          const [tag, cls] = MARKET_TAGS[p.market] || MARKET_TAGS.other;
          return pick(pickTpl, { tag, tagClass: cls, selection: p.selection, odds: p.est_odds, why: p.why });
        }),
      );
      el.querySelector('.check').textContent = leg.check;
      el.querySelector('.leg-odds').textContent = `Leg ≈ ${leg.est_leg_odds}`;
      return el;
    }),
  );

  $('safer').textContent = acca.safer.change;
  $('safer-odds').textContent = acca.safer.est_odds;
  $('bigger').textContent = acca.bigger.change;
  $('bigger-odds').textContent = acca.bigger.est_odds;

  $('left-out-panel').hidden = !acca.left_out.length;
  $('left-out').replaceChildren(
    ...acca.left_out.map((g) => {
      const li = document.createElement('li');
      const b = document.createElement('strong');
      b.textContent = g.fixture;
      li.append(b, ` — ${g.reason}`);
      return li;
    }),
  );

  $('sources').replaceChildren(
    ...acca.sources.map((s) => {
      const li = document.createElement('li');
      const href = safeUrl(s.url);
      if (href) {
        const a = document.createElement('a');
        a.href = href;
        a.rel = 'noopener nofollow';
        a.target = '_blank';
        a.textContent = s.title || href;
        li.append(a);
      } else {
        li.textContent = s.title;
      }
      return li;
    }),
  );
}

async function show(date) {
  $('error').hidden = true;
  try {
    render(await getJSON(`data/accas/${date}.json`));
  } catch (e) {
    $('error').textContent = `Couldn't load the acca for ${date}. ${e.message}`;
    $('error').hidden = false;
  }
}

async function main() {
  let index;
  try {
    index = await getJSON('data/index.json');
  } catch {
    index = { accas: [] };
  }
  if (!index.accas.length) {
    $('meta').textContent = 'No accas yet';
    $('headline').textContent = 'The first acca appears on the next Premier League matchday.';
    return;
  }

  const select = $('archive');
  select.replaceChildren(
    ...index.accas.map((a) => {
      const o = document.createElement('option');
      o.value = a.date;
      o.textContent = `${prettyDate(a.date)}${a.gameweek ? ` (GW${a.gameweek})` : ''}`;
      return o;
    }),
  );

  const wanted = new URLSearchParams(location.search).get('date');
  const date = index.accas.some((a) => a.date === wanted) ? wanted : index.accas[0].date;
  select.value = date;
  select.addEventListener('change', () => {
    const url = new URL(location.href);
    url.searchParams.set('date', select.value);
    history.replaceState(null, '', url);
    show(select.value);
  });
  await show(date);
}

main();
