"use strict";

/*
 * HTB ACADEMY DASHBOARD: Road to CPTS — profile stats, learning path,
 * weekly goal, study rhythm chart and earned badges
 * Depends on: config.js (CONFIG), utils.js ($, cache), htb-data.js
 */

const HTB_PROXY_URL   = '/htb-proxy.php';
const HTB_GOAL_KEY    = 'htb_weekgoal';
const HTB_TZ          = 'Europe/Amsterdam';
const MODULE_SUFFIX   = / module completed$/;

const HTB_SOURCE_LABEL = {
  live:     'Live · public profile',
  cached:   'Cached · public profile',
  stale:    'Cached · HTB unreachable',
  snapshot: 'Offline snapshot',
};

/* Data from the most recent render; used by the period selector */
let htbWeeks = [];

/* Helpers */
const htbFmt = n => n.toLocaleString('en-GB');
const htbSum = ws => ws.reduce((n, w) => n + w.xp, 0);

function htbDateLabel(isoDay) {
  return new Date(isoDay + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: HTB_TZ });
}

function htbWeekLabel(w) {
  return `${htbDateLabel(w.start)} – ${htbDateLabel(w.end)}`;
}

function htbEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className)          node.className   = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Rejects anything that doesn't match the schema produced by htb-proxy.php */
function isValidHtbData(d) {
  const count = v => typeof v === 'number' && v >= 0;
  return !!d && d.schemaVersion === 1
    && count(d.totalXp) && count(d.periodXp) && count(d.weeksActive)
    && Array.isArray(d.weeks)  && d.weeks.every(w => typeof w.start === 'string' && typeof w.end === 'string' && count(w.xp))
    && Array.isArray(d.badges) && d.badges.every(b => typeof b.name === 'string' && typeof b.description === 'string')
    && !isNaN(new Date(d.updatedAt))
    // level/streak are optional: null when HTB's experience endpoint was unavailable
    && (d.level  == null || (Number.isInteger(d.level.value) && typeof d.level.rank === 'string' && count(d.level.xpInLevel) && count(d.level.xpToNext)))
    && (d.streak == null || (count(d.streak.weeks) && count(d.streak.xp) && count(d.streak.requiredXp)));
}

/* Render: hero + stats */
function renderHtbHeader(data, source) {
  $('htb-source-tag').textContent = HTB_SOURCE_LABEL[source];
  $('htb-source-tag').dataset.source = source;
  $('htb-updated').textContent = 'Updated ' + new Date(data.updatedAt).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: HTB_TZ,
  });

  const moduleBadges = data.badges.filter(b => MODULE_SUFFIX.test(b.description));
  $('htb-total-xp').textContent     = htbFmt(data.totalXp);
  $('htb-period-total').textContent = htbFmt(data.periodXp);
  $('htb-weeks-active').textContent = data.weeksActive;
  $('htb-badge-count').textContent  = data.badges.length;
  $('htb-badge-detail').textContent = `${moduleBadges.length} module badges · ${data.badges.length - moduleBadges.length} other`;
}

/* Level/rank — falls back to the bundled snapshot if the live data lacks it */
function renderHtbLevel(data) {
  const lvl  = data.level || HTB_SNAPSHOT.level;
  const span = lvl.xpInLevel + lvl.xpToNext;
  $('htb-level-label').textContent = 'HTB Level' + (data.level ? '' : ' · last known');
  $('htb-level').textContent       = lvl.value;
  $('htb-rank').textContent        = lvl.rank;
  $('htb-level-track').style.width = `${span ? Math.min(100, lvl.xpInLevel / span * 100) : 0}%`;
  $('htb-level-sub').textContent   = `${htbFmt(lvl.xpInLevel)} / ${htbFmt(span)} XP · ${htbFmt(lvl.xpToNext)} to level ${lvl.value + 1}`;
}

/* Weekly streak (02 This week) — hidden when missing or already expired */
function renderHtbStreak(data) {
  const s       = data.streak;
  const expires = s && s.expiresAt ? new Date(s.expiresAt) : null;
  const box     = $('htb-streak');
  if (!s || (expires && expires < Date.now())) { box.hidden = true; return; }

  box.hidden = false;
  box.className = s.completed ? 'completed' : s.inDanger ? 'danger' : '';
  $('htb-streak-weeks').textContent  = `Weekly streak · ${s.weeks} week${s.weeks === 1 ? '' : 's'}`;
  $('htb-streak-xp').textContent     = `${htbFmt(s.xp)} / ${htbFmt(s.requiredXp)} XP`;
  $('htb-streak-track').style.width  = `${s.requiredXp ? Math.min(100, s.xp / s.requiredXp * 100) : 100}%`;

  // HTB weeks end Sunday 23:59 UTC; in local time that would read as Monday
  const deadline = expires
    ? expires.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
    : 'the end of the week';
  $('htb-streak-sub').textContent = s.completed
    ? 'Streak secured for this week. ✓'
    : `${htbFmt(Math.max(0, s.requiredXp - s.xp))} XP more before ${deadline} to keep it going.`;
}

/* Render: 01 learning path */
function renderHtbRoute(completed) {
  const confirmed = CPTS_MODULES.filter(m => completed.has(m)).length;
  $('htb-confirmed-count').textContent = confirmed;
  $('htb-module-total').textContent    = CPTS_MODULES.length;

  const segments = $('htb-segments');
  segments.replaceChildren(...CPTS_MODULES.map(m => htbEl('i', completed.has(m) ? 'complete' : '')));
  segments.setAttribute('aria-label', `${confirmed} of ${CPTS_MODULES.length} module completions publicly confirmed`);

  // Remember which groups the user expanded so a data refresh doesn't collapse them
  const container = $('htb-route-groups');
  const prevOpen  = container.children.length
    ? new Set([...container.querySelectorAll('details[open]')].map(d => d.dataset.group))
    : null;

  const fragment = document.createDocumentFragment();
  CPTS_GROUPS.forEach(([title, start, end], g) => {
    const mods    = CPTS_MODULES.slice(start, end);
    const details = htbEl('details', 'htb-route-group');
    details.dataset.group = title;
    details.open = prevOpen ? prevOpen.has(title) : g === 0;

    const summary = htbEl('summary', '', title);
    summary.appendChild(htbEl('span', '', `${mods.filter(m => completed.has(m)).length} / ${mods.length} confirmed`));
    details.appendChild(summary);

    mods.forEach((name, j) => {
      const done = completed.has(name);
      const row  = htbEl('div', 'htb-module-row' + (done ? ' confirmed' : ''));
      row.append(
        htbEl('span', 'htb-symbol', done ? '✓' : String(start + j + 1).padStart(2, '0')),
        htbEl('span', 'htb-module-name', name),
        htbEl('small', '', done ? 'Badge confirmed' : 'Not confirmed'),
      );
      details.appendChild(row);
    });
    fragment.appendChild(details);
  });
  container.replaceChildren(fragment);

  $('htb-next-module').textContent = CPTS_MODULES.find(m => !completed.has(m)) || 'All modules confirmed';
}

/* Render: 04 milestones */
function renderHtbBadges(data) {
  const moduleBadges = data.badges
    .filter(b => MODULE_SUFFIX.test(b.description))
    .sort((a, b) => String(a.awardedAt).localeCompare(String(b.awardedAt)));

  $('htb-module-badge-count').textContent = `${moduleBadges.length} module badges`;

  $('htb-badges').replaceChildren(...moduleBadges.map(b => {
    const moduleName = b.description.replace(MODULE_SUFFIX, '');
    const inRoute    = CPTS_MODULES.includes(moduleName);
    const card       = htbEl('div', 'htb-badge' + (inRoute ? '' : ' outside'));
    const body       = htbEl('div');
    const date       = b.awardedAt ? ' · ' + new Date(b.awardedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    body.append(htbEl('b', '', moduleName), htbEl('small', '', b.name + date));
    card.append(htbEl('span', 'htb-badge-icon', inRoute ? '✓' : '·'), body);
    return card;
  }));

  const others  = data.badges.filter(b => !MODULE_SUFFIX.test(b.description)).map(b => b.name);
  const outside = moduleBadges.map(b => b.description.replace(MODULE_SUFFIX, '')).filter(m => !CPTS_MODULES.includes(m));
  const parts   = [];
  if (others.length)  parts.push(`Also earned: ${others.join(' · ')}.`);
  if (outside.length) parts.push(`${outside.join(', ')} ${outside.length === 1 ? 'falls' : 'fall'} outside the ${CPTS_MODULES.length} CPTS modules.`);
  $('htb-other-badges').textContent = parts.join(' ');
  $('htb-other-badges').hidden      = parts.length === 0;
}

/* Render: 03 study rhythm */
function prepareHtbWeeks(data) {
  // Only count weeks that had fully ended when the data was fetched, so a
  // stale snapshot doesn't invent empty weeks for time spent offline
  const snapshotDay = new Intl.DateTimeFormat('en-CA', { timeZone: HTB_TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(data.updatedAt));
  htbWeeks = data.weeks
    .filter(w => w.end < snapshotDay)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(-8);

  $('htb-recent-xp').textContent   = htbFmt(htbSum(htbWeeks.slice(-4))) + ' XP';
  $('htb-previous-xp').textContent = `Previous 4 weeks: ${htbFmt(htbSum(htbWeeks.slice(-8, -4)))} XP.`;
}

function renderHtbChart() {
  const visible = htbWeeks.slice(-Number($('htb-period').value));
  const max     = Math.max(1, ...visible.map(w => w.xp));
  const chart   = $('htb-chart');

  chart.replaceChildren(...visible.map((w, i) => {
    const wrap = htbEl('div', 'htb-bar-wrap' + (i >= visible.length - 4 ? ' recent' : ''));
    wrap.title = `${htbWeekLabel(w)}: ${htbFmt(w.xp)} XP`;
    const bar  = htbEl('div', 'htb-bar');
    bar.style.height = `${w.xp / max * 100}%`;
    bar.appendChild(htbEl('span', 'htb-bar-value', htbFmt(w.xp)));
    wrap.appendChild(bar);
    return wrap;
  }));

  chart.setAttribute('aria-label', visible.map(w => `${htbWeekLabel(w)}: ${w.xp} XP`).join('; ') || 'No full weeks');
  $('htb-chart-start').textContent = visible.length ? htbDateLabel(visible[0].start) : 'No full weeks';
  $('htb-chart-end').textContent   = visible.length ? htbDateLabel(visible.at(-1).end) : '';
  $('htb-period-xp').textContent   = htbFmt(htbSum(visible));
}

/** Renders every data-driven part of the view */
function renderHtb(data, source) {
  const completed = new Set(
    data.badges.filter(b => MODULE_SUFFIX.test(b.description)).map(b => b.description.replace(MODULE_SUFFIX, ''))
  );
  renderHtbHeader(data, source);
  renderHtbLevel(data);
  renderHtbStreak(data);
  renderHtbRoute(completed);
  renderHtbBadges(data);
  prepareHtbWeeks(data);
  renderHtbChart();
}

/* 02 weekly goal — stored only in this browser */
function isValidGoal(g) {
  return !!g && typeof g.goal === 'string' && g.goal.length <= 500
    && typeof g.module === 'string' && (g.module === '' || CPTS_MODULES.includes(g.module))
    && typeof g.done === 'boolean';
}

function saveHtbGoal(input) {
  if (!isValidGoal(input)) throw new Error('Invalid weekly goal. Choose an existing module and at most 500 characters.');
  localStorage.setItem(HTB_GOAL_KEY, JSON.stringify(input));
  $('htb-goal-module').value = input.module;
  $('htb-goal-text').value   = input.goal;
  $('htb-goal-done').checked = input.done;
  $('htb-goal-status').textContent = 'Saved in this browser. ✓';
  $('htb-focus').classList.toggle('done', input.done);
}

function initHtbGoal() {
  const select = $('htb-goal-module');
  for (const name of CPTS_MODULES) {
    const opt = htbEl('option', '', name);
    opt.value = name;
    select.appendChild(opt);
  }

  try {
    const stored = JSON.parse(localStorage.getItem(HTB_GOAL_KEY));
    if (isValidGoal(stored)) {
      select.value               = stored.module;
      $('htb-goal-text').value   = stored.goal;
      $('htb-goal-done').checked = stored.done;
      $('htb-focus').classList.toggle('done', stored.done);
    }
  } catch {
    $('htb-goal-status').textContent = 'Local storage is unavailable or could not be read.';
  }

  $('htb-goal-form').addEventListener('submit', e => {
    e.preventDefault();
    try {
      saveHtbGoal({ module: select.value, goal: $('htb-goal-text').value.trim(), done: $('htb-goal-done').checked });
    } catch {
      $('htb-goal-status').textContent = 'Saving failed. Check that browser storage is allowed.';
    }
  });

}

/* Fetch */
async function fetchHtb(force = false) {
  const fetchedAt = cache('htb_fetchedAt');
  if (!force && fetchedAt && Date.now() - new Date(fetchedAt).getTime() < CONFIG.refresh.htbMins * 60 * 1000) return;

  const res = await fetch(HTB_PROXY_URL + (force ? '?fresh=1' : ''));
  if (!res.ok) throw new Error(`HTB proxy HTTP ${res.status}`);
  const data = await res.json();
  if (!isValidHtbData(data)) throw new Error('HTB proxy returned unexpected data');

  const source = res.headers.get('X-HTB-Stale') ? 'stale' : 'live';
  cache('htb_data', data);
  cache('htb_source', source);
  cache('htb_fetchedAt', new Date().toISOString());
  renderHtb(data, source);
}

/* Manual refresh (bypasses the TTL on both browser and server cache) */
async function refreshHtb() {
  const btn = $('htb-refresh-btn');
  btn.disabled = true;
  btn.classList.add('spinning');
  try {
    await fetchHtb(true);
  } catch (e) {
    console.warn('HTB refresh failed:', e);
    $('htb-source-tag').textContent = 'Refresh failed · ' + HTB_SOURCE_LABEL[$('htb-source-tag').dataset.source];
  } finally {
    btn.disabled = false;
    btn.classList.remove('spinning');
  }
}

/* Init */
function initHtb() {
  const profileUrl = `https://profile.hackthebox.com/profile/${CONFIG.htb.profileId}`;
  $('htb-profile-link').href = profileUrl;
  $('htb-badges-link').href  = `${profileUrl}?tab=badges`;
  // Full name is opt-in: the dashboard may be publicly reachable
  const handle = htbEl('span', '', `@${CONFIG.htb.username}`);
  if (CONFIG.htb.showFullName) $('htb-who').replaceChildren(document.createTextNode(CONFIG.htb.fullName + ' '), htbEl('span', '', '/ '), handle);
  else                         $('htb-who').replaceChildren(handle);

  initHtbGoal();
  $('htb-period').addEventListener('change', renderHtbChart);
  $('htb-refresh-btn').addEventListener('click', refreshHtb);

  // Show the last good data immediately, falling back to the bundled snapshot
  const cached = cache('htb_data');
  if (isValidHtbData(cached)) renderHtb(cached, 'cached');
  else                        renderHtb(HTB_SNAPSHOT, 'snapshot');

  fetchHtb().catch(e => console.warn('HTB fetch failed:', e));
  setInterval(() => fetchHtb().catch(e => console.warn('HTB fetch failed:', e)), CONFIG.refresh.htbMins * 60 * 1000);
}
