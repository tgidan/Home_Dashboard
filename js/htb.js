"use strict";

/*
 * HTB ACADEMY DASHBOARD: Road to CPTS — profile stats, learning path,
 * weekly streak, module sections, study rhythm chart and earned badges; section
 * progress per module comes from data/htb-sections.json (synced from HackTheBox-Academy)
 * Depends on: config.js (CONFIG), utils.js ($, cache), htb-data.js
 */

const HTB_PROXY_URL    = '/htb-proxy.php';
const HTB_SECTIONS_URL = 'data/htb-sections.json';   // generated from the HackTheBox-Academy repo
const HTB_TZ           = 'Europe/Amsterdam';
const MODULE_SUFFIX    = / module completed$/;

const HTB_SOURCE_LABEL = {
  live:     'Live · public profile',
  cached:   'Cached · public profile',
  stale:    'Cached · HTB unreachable',
  snapshot: 'Offline snapshot',
};

/* Data from the most recent render; used by the period selector */
let htbWeeks = [];
/* Confirmed modules from the last profile render, so section data can re-render the route */
let htbCompleted = new Set();
/* Section progress per module name from data/htb-sections.json; {} until loaded */
let htbSections = {};
/* Module clicked in the learning path; null follows htbCurrentModule() */
let htbSelected = null;
/* The section list renders while the HTB view may be hidden, so its scroll can wait for layout */
let htbSectionsScrollPending = false;

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

/** Same limits as scripts/validate-progress.js in the HackTheBox-Academy repo */
function isValidSectionData(d) {
  const name = n => typeof n === 'string' && n.trim() !== '' && n.length <= 200;
  return !!d && d.schemaVersion === 1
    && !!d.modules && typeof d.modules === 'object' && !Array.isArray(d.modules)
    && Object.keys(d.modules).length <= 100
    && Object.values(d.modules).every(list => Array.isArray(list) && list.length <= 100
      && list.every(s => !!s && name(s.name) && typeof s.done === 'boolean'));
}

/** Returns { done, total, next } for a module with section data, else null */
function htbSectionProgress(module) {
  const list = Object.hasOwn(htbSections, module) ? htbSections[module] : null;
  if (!list || !list.length) return null;
  const next = list.find(s => !s.done);
  return { done: list.filter(s => s.done).length, total: list.length, next: next ? next.name : null };
}

/** The module being worked on: the first with sections done but no badge yet, else the next in the route */
function htbCurrentModule() {
  const open = CPTS_MODULES.filter(m => !htbCompleted.has(m));
  return open.find(m => htbSectionProgress(m)?.done) || open[0];
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
  htbCompleted = completed;
  const confirmed = CPTS_MODULES.filter(m => completed.has(m)).length;
  $('htb-confirmed-count').textContent = confirmed;
  $('htb-module-total').textContent    = CPTS_MODULES.length;

  const segments = $('htb-segments');
  segments.replaceChildren(...CPTS_MODULES.map(m => {
    if (completed.has(m)) return htbEl('i', 'complete');
    const prog = htbSectionProgress(m);
    if (!prog || !prog.done) return htbEl('i');
    const seg = htbEl('i', 'progress');   // partly filled up to the share of sections done
    seg.style.setProperty('--p', `${prog.done / prog.total * 100}%`);
    return seg;
  }));
  segments.setAttribute('aria-label', `${confirmed} of ${CPTS_MODULES.length} module completions publicly confirmed`);

  // Remember which group the user expanded so a data refresh doesn't collapse it
  const container = $('htb-route-groups');
  const prevOpen  = container.children.length
    ? new Set([...container.querySelectorAll('details[open]')].map(d => d.dataset.group))
    : null;

  // First render: open the group holding the current module, which the sections panel shows
  const currentIndex = Math.max(0, CPTS_MODULES.indexOf(htbCurrentModule()));

  const fragment = document.createDocumentFragment();
  CPTS_GROUPS.forEach(([title, start, end]) => {
    const mods    = CPTS_MODULES.slice(start, end);
    const details = htbEl('details', 'htb-route-group');
    details.name = 'htb-route-group';   // shared name: opening one group closes the others
    details.dataset.group = title;
    details.open = prevOpen ? prevOpen.has(title) : currentIndex >= start && currentIndex < end;

    const summary = htbEl('summary', '', title);
    summary.appendChild(htbEl('span', '', `${mods.filter(m => completed.has(m)).length} / ${mods.length} confirmed`));
    details.appendChild(summary);

    mods.forEach((name, j) => {
      const done = completed.has(name);
      const prog = done ? null : htbSectionProgress(name);
      const row  = htbEl('button', 'htb-module-row' + (done ? ' confirmed' : prog && prog.done ? ' in-progress' : ''));
      row.type = 'button';
      row.dataset.module = name;
      const cell = htbEl('span', 'htb-module-name', name);
      if (prog) {
        const track = htbEl('span', 'htb-track htb-section-track');
        const fill  = htbEl('i');
        fill.style.width = `${prog.done / prog.total * 100}%`;
        track.appendChild(fill);
        cell.appendChild(track);
      }
      row.append(
        htbEl('span', 'htb-symbol', done ? '✓' : String(start + j + 1).padStart(2, '0')),
        cell,
        htbEl('small', '', done ? 'Badge confirmed' : prog ? `${prog.done} / ${prog.total} sections` : 'Not confirmed'),
      );
      details.appendChild(row);
    });
    fragment.appendChild(details);
  });
  container.replaceChildren(fragment);

  const nextModule = CPTS_MODULES.find(m => !completed.has(m));
  const nextProg   = nextModule ? htbSectionProgress(nextModule) : null;
  $('htb-next-module').textContent = nextModule || 'All modules confirmed';
  $('htb-next-section').hidden     = !nextProg;
  if (nextProg) {
    $('htb-next-section').textContent = nextProg.next
      ? `Next section: ${nextProg.next} · ${nextProg.done} / ${nextProg.total} done`
      : `All ${nextProg.total} sections done · badge not confirmed yet`;
  }

  renderHtbModuleSections();
}

/* Render: sections of the selected module (defaults to the module being worked on) */
function renderHtbModuleSections() {
  const nextModule = CPTS_MODULES.find(m => !htbCompleted.has(m));
  const module     = htbSelected || htbCurrentModule() || CPTS_MODULES.at(-1);

  for (const row of $('htb-route-groups').querySelectorAll('.htb-module-row')) {
    const on = row.dataset.module === module;
    row.classList.toggle('selected', on);
    row.setAttribute('aria-pressed', on);
  }

  const list = Object.hasOwn(htbSections, module) ? htbSections[module] : [];
  const prog = htbSectionProgress(module);
  const tags = [];
  if (htbCompleted.has(module))  tags.push('Badge confirmed');
  if (module === nextModule)     tags.push('Next in the route');
  $('htb-sections-module').textContent = module;
  $('htb-sections-sub').textContent    = [prog ? `${prog.done} / ${prog.total} sections done` : 'No section data yet', ...tags].join(' · ');
  $('htb-sections-track').parentElement.hidden = !prog;
  if (prog) $('htb-sections-track').style.width = `${prog.done / prog.total * 100}%`;

  const next = list.findIndex(s => !s.done);
  $('htb-sections-list').replaceChildren(...list.map((s, i) => {
    const li = htbEl('li', s.done ? 'done' : i === next ? 'next' : '');
    li.append(htbEl('span', 'htb-symbol', s.done ? '✓' : String(i + 1).padStart(2, '0')), htbEl('span', '', s.name));
    return li;
  }));
  htbSectionsScrollPending = !scrollHtbSectionsToNext();
}

/** Scrolls the section list (not the page) to the next open section; false while the list is hidden */
function scrollHtbSectionsToNext() {
  const ol = $('htb-sections-list');
  if (!ol.clientHeight) return false;
  const next = ol.querySelector('li.next');
  ol.scrollTop = next ? next.offsetTop - ol.clientHeight / 3 : 0;
  return true;
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

/* Section progress: a static file, revalidated with the server on every fetch */
async function fetchHtbSections() {
  const res = await fetch(HTB_SECTIONS_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTB sections HTTP ${res.status}`);
  const data = await res.json();
  if (!isValidSectionData(data)) throw new Error('HTB sections file has unexpected data');

  cache('htb_sections', data);
  htbSections = data.modules;
  renderHtbRoute(htbCompleted);
}

/* Manual refresh (bypasses the TTL on both browser and server cache) */
async function refreshHtb() {
  const btn = $('htb-refresh-btn');
  btn.disabled = true;
  btn.classList.add('spinning');
  fetchHtbSections().catch(e => console.warn('HTB sections refresh failed:', e));
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

  $('htb-route-groups').addEventListener('click', e => {
    const row = e.target.closest('.htb-module-row');
    if (!row) return;
    htbSelected = row.dataset.module;
    renderHtbModuleSections();
  });
  new ResizeObserver(() => {
    if (htbSectionsScrollPending) htbSectionsScrollPending = !scrollHtbSectionsToNext();
  }).observe($('htb-sections-list'));
  $('htb-period').addEventListener('change', renderHtbChart);
  $('htb-refresh-btn').addEventListener('click', refreshHtb);

  // Show the last good data immediately, falling back to the bundled snapshot
  const cachedSections = cache('htb_sections');
  if (isValidSectionData(cachedSections)) htbSections = cachedSections.modules;
  const cached = cache('htb_data');
  if (isValidHtbData(cached)) renderHtb(cached, 'cached');
  else                        renderHtb(HTB_SNAPSHOT, 'snapshot');

  const update = () => {
    fetchHtb().catch(e => console.warn('HTB fetch failed:', e));
    fetchHtbSections().catch(e => console.warn('HTB sections fetch failed:', e));
  };
  update();
  setInterval(update, CONFIG.refresh.htbMins * 60 * 1000);
}
