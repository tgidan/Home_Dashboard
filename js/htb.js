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
/* Module pace chart model from the most recent render; redrawn when the chart resizes */
let htbPace = null;
/* Pace chart y-axis: 'modules' (default) or 'sections'; htbPaceMix runs 0 → 1 while the lines morph to sections */
let htbPaceMode = 'modules';
let htbPaceMix  = 0;
let htbPaceAnim = 0;
/* Pace chart zoom as [first day, last day] since the start, or null for the whole period */
let htbPaceZoom = null;
/* What the pace chart shows now ({ v0, v1, mA, sA }), where a zoom animation starts from */
let htbPaceShown    = null;
let htbPaceZoomAnim = 0;
/* Profile data from the last render, so section data can rebuild the pace chart */
let htbData = null;
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

function htbSvg(tag, attrs = {}, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Calendar day (YYYY-MM-DD) of a moment in the dashboard's timezone */
function htbDay(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: HTB_TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(date));
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
      && list.every(s => !!s && name(s.name) && typeof s.done === 'boolean'
        && (s.date === undefined || (typeof s.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.date)))));
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

/* XP in the current, unfinished week (02 This week); the study rhythm chart only shows full weeks */
function renderHtbWeekXp(data) {
  const today = htbDay(Date.now());
  const weeks = [...data.weeks].sort((a, b) => a.start.localeCompare(b.start));
  const i     = weeks.findIndex(w => w.start <= today && today <= w.end);
  if (i === -1) {   // data is from an earlier week (offline snapshot or HTB unreachable)
    $('htb-week-xp-value').textContent = '–';
    $('htb-week-xp-sub').textContent   = 'No data for this week yet';
    return;
  }
  $('htb-week-xp-value').textContent = htbFmt(weeks[i].xp);
  $('htb-week-xp-sub').textContent   = htbWeekLabel(weeks[i]) + (i > 0 ? ` · last week ${htbFmt(weeks[i - 1].xp)} XP` : '');
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
  const snapshotDay = htbDay(data.updatedAt);
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

/* Render: 03 module pace — completed CPTS modules since CONFIG.htb.paceStart against two expected lines:
   a target of CONFIG.htb.paceSectionsPerWeek and a forecast at the rate achieved so far. Both give each
   module time in proportion to its section count. Days are counted as indexes from the start day. */
const HTB_DAY_MS = 24 * 60 * 60 * 1000;

const htbPaceDone     = (p, i) => p.base + p.steps.filter(s => s.i <= i).length;
const htbPaceTarget   = (p, i) => p.base + p.target.filter(s => s.i <= i).length;
const htbPaceForecast = (p, i) => !p.forecast || i < p.today ? null
  : htbPaceDone(p, p.today) + p.forecast.filter(s => s.i <= i).length;
const htbPaceDate     = (p, i, opts) => new Date(Date.parse(p.start + 'T12:00:00Z') + i * HTB_DAY_MS)
  .toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });
/* The same three lines counted in sections; the expected lines are straight, as their rate is constant */
const htbPaceSecDone     = (p, i) => i < 0 ? p.secBase : p.secDone[Math.min(i, p.today)];
const htbPaceSecTarget   = (p, i) => Math.min(p.secTotal, p.secBefore + p.perWeek * i / 7);
const htbPaceSecForecast = (p, i) => !p.forecast || i < p.today ? null
  : Math.min(p.secTotal, htbPaceSecDone(p, p.today) + p.perDay * (i - p.today));

function prepareHtbPace(data) {
  const start    = CONFIG.htb.paceStart;
  const perWeek  = CONFIG.htb.paceSectionsPerWeek;
  const dayIndex = t => Math.round((Date.parse(htbDay(t) + 'T12:00:00Z') - Date.parse(start + 'T12:00:00Z')) / HTB_DAY_MS);
  const done = data.badges
    .filter(b => MODULE_SUFFIX.test(b.description) && CPTS_MODULES.includes(b.description.replace(MODULE_SUFFIX, '')))
    .map(b => {
      const t = Date.parse(b.awardedAt);
      return { module: b.description.replace(MODULE_SUFFIX, ''), i: isNaN(t) ? -Infinity : dayIndex(t) };   // no date: count as done before the start
    })
    .sort((a, b) => a.i - b.i);

  const total = CPTS_MODULES.length;
  const base  = done.filter(s => s.i < 0).length;
  const today = Math.max(0, dayIndex(data.updatedAt));
  const steps = done.filter(s => s.i >= 0 && s.i <= today);

  // Sections per module; a module without section data counts as the mean of the known ones.
  // With no section data at all every module takes one week, as one module per week would
  const known = CPTS_MODULES.map(m => htbSectionProgress(m)?.total).filter(Boolean);
  const mean  = known.length ? known.reduce((a, b) => a + b, 0) / known.length : perWeek;
  const size  = m => htbSectionProgress(m)?.total ?? mean;

  // Target: the modules still open at the start, in route order, each done once its sections fit the rate
  const before    = new Set(done.filter(s => s.i < 0).map(s => s.module));
  const confirmed = new Set(done.map(s => s.module));
  const queue     = CPTS_MODULES.filter(m => !before.has(m));
  let sections = 0;
  const target    = queue.map(m => ({ module: m, i: Math.ceil((sections += size(m)) / perWeek * 7) }));
  const targetEnd = target.length ? target.at(-1).i : 0;

  // Forecast: the sections still open, at the rate achieved since the start (needs section data and a full week)
  const left       = m => confirmed.has(m) ? 0 : size(m) - (htbSectionProgress(m)?.done || 0);
  const remaining  = queue.reduce((n, m) => n + left(m), 0);
  const sinceStart = sections - remaining;
  const perDay     = sinceStart / today;
  let forecast = null;
  if (known.length && today >= 7 && sinceStart > 0 && remaining > 0) {
    let open = 0;
    forecast = queue.filter(m => !confirmed.has(m)).map(m => ({ module: m, i: today + Math.ceil((open += left(m)) / perDay) }));
  }
  const forecastEnd = forecast ? forecast.at(-1).i : null;

  // A slow start would stretch the forecast far out, so it gets at most twice the target's span
  const days = Math.max(targetEnd, Math.min(forecastEnd ?? 0, targetEnd * 2), today, 7);

  // Sections done per day: each on its own date, else its module's badge day, else today (done, but undated).
  // A confirmed module counts all its sections; one without section data counts as its estimated size
  const badgeDay = new Map(done.map(s => [s.module, s.i]));
  const secAdded = new Array(today + 1).fill(0);
  let secBase = 0;
  const add = (i, n) => { i = Math.min(i, today); if (i < 0) secBase += n; else secAdded[i] += n; };
  for (const m of CPTS_MODULES) {
    const list  = Object.hasOwn(htbSections, m) ? htbSections[m] : [];
    const badge = badgeDay.get(m);
    if (!list.length) { if (badge !== undefined) add(badge, size(m)); continue; }
    for (const s of list) {
      if (s.done && s.date) add(Math.round((Date.parse(s.date + 'T12:00:00Z') - Date.parse(start + 'T12:00:00Z')) / HTB_DAY_MS), 1);
      else if (badge !== undefined) add(badge, 1);
      else if (s.done)              add(today, 1);
    }
  }
  let secRun = secBase;
  const secDone   = secAdded.map(n => secRun += n);
  const secTotal  = CPTS_MODULES.reduce((n, m) => n + size(m), 0);
  const secBefore = [...before].reduce((n, m) => n + size(m), 0);
  // Section count at which each module is done: those done before the start first, then the target's order
  let secEnd = 0;
  const bounds = [...CPTS_MODULES.filter(m => before.has(m)), ...queue].map(m => ({ module: m, sec: secEnd += size(m) }));

  htbPace = {
    start, total, base, steps, today, target, targetEnd, forecast, forecastEnd, days,
    perWeek, perDay, secBase, secDone, secTotal, secBefore, bounds,
  };

  // Ahead or behind is counted in sections, so work inside a long module shows before its badge does
  const nowDone    = htbPaceDone(htbPace, today);
  const diff       = Math.round(sinceStart - Math.min(sections, perWeek * today / 7));
  const count      = n => `${n} section${n === 1 ? '' : 's'}`;
  const long       = { day: 'numeric', month: 'short', year: 'numeric' };
  const targetDate = htbPaceDate(htbPace, targetEnd, long);
  const rate       = +(perDay * 7).toFixed(1);
  $('htb-pace-status').textContent = `${nowDone} of ${total} done · `
    + (diff > 0 ? `${count(diff)} ahead of target` : diff < 0 ? `${count(-diff)} behind target` : 'on target')
    + ` · target ends ${targetDate}`
    + (forecast ? ` · forecast ends ${htbPaceDate(htbPace, forecastEnd, long)}`
      : !remaining ? '' : today < 7 ? ' · forecast after the first full week' : ' · no forecast yet');
  $('htb-pace-target-label').textContent   = `Target · ${perWeek} sections / week`;
  $('htb-pace-forecast-label').textContent = forecast ? `Forecast · ${rate} sections / week` : 'Forecast';
  const secNow   = Math.round(htbPaceSecDone(htbPace, today));
  const secAll   = Math.round(secTotal);
  htbPace.labels = {
    modules: `${nowDone} of ${total} CPTS modules completed; at ${perWeek} sections per week the target is ${htbPaceTarget(htbPace, today)} by today and all ${total} by ${targetDate}`
      + (forecast ? `; at the current ${rate} sections per week all ${total} would be done by ${htbPaceDate(htbPace, forecastEnd, long)}.` : '.'),
    sections: `${secNow} of ${secAll} CPTS sections completed; at ${perWeek} sections per week the target is ${Math.round(htbPaceSecTarget(htbPace, today))} by today and all ${secAll} by ${targetDate}`
      + (forecast ? `; at the current ${rate} sections per week all ${secAll} would be done by ${htbPaceDate(htbPace, forecastEnd, long)}.` : '.'),
  };
  renderHtbPaceLabels();
}

/** Title and screen reader summary of the pace chart in the current mode */
function renderHtbPaceLabels() {
  const p = htbPace;
  if (!p) return;
  const sections = htbPaceMode === 'sections';
  $('htb-pace-title').textContent = `${sections ? 'Sections' : 'Modules'} completed since ${htbPaceDate(p, 0, { day: 'numeric', month: 'short' })}`;
  $('htb-pace-chart').setAttribute('aria-label', p.labels[htbPaceMode]);
}

/** Switches the pace chart's y-axis; the lines morph from where they are, so a second click mid-way turns them back */
function setHtbPaceMode(mode) {
  htbPaceMode = mode;
  $('htb-pace-mode').setAttribute('aria-checked', mode === 'sections');
  renderHtbPaceLabels();
  if (htbPace?.cursor != null) htbPace.show(htbPace.cursor);   // the tooltip counts in the new unit

  cancelAnimationFrame(htbPaceAnim);
  const from = htbPaceMix;
  const to   = mode === 'sections' ? 1 : 0;
  const ms   = 700 * Math.abs(to - from);
  if (!ms || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    htbPaceMix = to;
    htbPace?.draw?.(to);
    return;
  }
  const ease = k => k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2;   // ease-in-out cubic
  const t0   = performance.now();
  const tick = now => {
    const k = Math.min(1, (now - t0) / ms);
    htbPaceMix = from + (to - from) * ease(k);
    htbPace?.draw?.(htbPaceMix);
    if (k < 1) htbPaceAnim = requestAnimationFrame(tick);
  };
  htbPaceAnim = requestAnimationFrame(tick);
}

/** Round axis bounds around [min, max]: the smallest step from the list that needs at most 5 grid lines */
function htbPaceAxis(min, max, steps) {
  for (const step of steps) {
    const lo = Math.floor(min / step) * step;
    const hi = Math.max(lo + step, Math.ceil(max / step) * step);
    if ((hi - lo) / step <= 5 || step === steps.at(-1)) return { lo, hi, step };
  }
}

/** The three lines, sampled per day from v0 to v1 as [class, [[day, modules before, after, sections before, after], …]].
    A stepped line jumps from the value before a day to the value after it; a straight one has both equal. Both
    modes share the days, so morphing slides each point straight up or down while its x stays put */
function htbPaceLines(p, v0, v1) {
  const lines = [];
  const line  = (cls, from, to, mod, sec) => {
    const pts = [];
    for (let i = Math.max(from, v0); i <= Math.min(to, v1); i++) pts.push([i, ...mod(i), ...sec(i)]);
    if (pts.length) lines.push([cls, pts]);
  };
  const stepped  = (v, first, from) => i => [i === from ? first : v(i - 1), v(i)];
  const straight = v => i => [v(i), v(i)];

  // Target: a step up on each day the target rate would have finished the next module; in sections a steady climb
  line('pace', 0, p.days, stepped(i => htbPaceTarget(p, i), p.base, 0), straight(i => htbPaceSecTarget(p, i)));
  // Forecast: from today's count, a step up on each day the current rate would finish the next module
  if (p.forecast) {
    line('forecast', p.today, p.days,
      stepped(i => htbPaceForecast(p, i), htbPaceDone(p, p.today), p.today), straight(i => htbPaceSecForecast(p, i)));
  }
  // Completed: a step at each badge date, or at each section's date, drawn up to today
  line('done', 0, p.today, stepped(i => htbPaceDone(p, i), p.base, 0), stepped(i => htbPaceSecDone(p, i), p.secBase, 0));
  return lines;
}

/** Where the chart settles for a zoom: the days in view and both y-axes. The whole period shows the whole route;
    a zoom gets round bounds around the values in view. Null when the zoom no longer fits the data */
function htbPaceFrame(p, zoom) {
  if (!zoom) {
    const secStep = [10, 20, 25, 50, 100, 200, 250, 500].find(s => p.secTotal / s <= 5) ?? 1000;
    return { v0: 0, v1: p.days, mA: { lo: 0, hi: p.total, step: 7 }, sA: { lo: 0, hi: p.secTotal, step: secStep } };
  }
  const v0 = Math.max(0, zoom[0]), v1 = Math.min(p.days, zoom[1]);
  if (v1 - v0 < 1) return null;
  const pts    = htbPaceLines(p, v0, v1).flatMap(([, pts]) => pts);
  const extent = (a, b) => {
    const vals = pts.flatMap(pt => [pt[a], pt[b]]);
    return [Math.min(...vals), Math.max(...vals)];
  };
  return {
    v0, v1,
    mA: htbPaceAxis(...extent(1, 2), [1, 2, 5, 10]),
    sA: htbPaceAxis(...extent(3, 4), [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500]),
  };
}

/** Zooms the pace chart to a range of days, or back to the whole period with null. The view slides there from
    wherever it is, so a new selection during the animation simply changes course */
function setHtbPaceZoom(range) {
  const p = htbPace;
  htbPaceZoom = range;
  $('htb-pace-reset').classList.toggle('on', !!range);
  cancelAnimationFrame(htbPaceZoomAnim);
  const from = htbPaceShown;
  const to   = p && htbPaceFrame(p, range);
  if (!from || !to || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    renderHtbPace();
    return;
  }
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = k => k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2;   // ease-in-out cubic
  const axis = (a, b, k) => ({ lo: lerp(a.lo, b.lo, k), hi: lerp(a.hi, b.hi, k), step: b.step, from: a.step, k });
  const t0   = performance.now();
  const tick = now => {
    const t = Math.min(1, (now - t0) / 700);
    const k = ease(t);
    renderHtbPace(t < 1 ? {
      v0: lerp(from.v0, to.v0, k), v1: lerp(from.v1, to.v1, k), mA: axis(from.mA, to.mA, k), sA: axis(from.sA, to.sA, k),
    } : null);
    if (t < 1) htbPaceZoomAnim = requestAnimationFrame(tick);
  };
  htbPaceZoomAnim = requestAnimationFrame(tick);
}

/** Draws the pace chart at a frame (days in view and both y-axes); without one, where the zoom settles */
function renderHtbPace(frame = null) {
  const p   = htbPace;
  const box = $('htb-pace-chart');
  const W   = box.clientWidth;
  if (!p || !W) return;   // view hidden: the ResizeObserver draws it once it has a size

  if (!frame) {
    cancelAnimationFrame(htbPaceZoomAnim);   // a resize or new data during a zoom animation jumps to its end
    frame = htbPaceFrame(p, htbPaceZoom);
    if (!frame) {                            // the zoomed range no longer fits the data
      htbPaceZoom = null;
      $('htb-pace-reset').classList.remove('on');
      frame = htbPaceFrame(p, null);
    }
  }
  htbPaceShown = frame;
  const { v0, v1, mA, sA } = frame;
  const inView = i => i >= v0 && i <= v1;
  p.view = [Math.ceil(v0), Math.floor(v1)];

  const H = box.clientHeight || 200;
  const m = { t: 26, r: 14, b: 22, l: 26 };
  const x = i => m.l + (i - v0) / (v1 - v0) * (W - m.l - m.r);
  // The forecast's end label gets its own row above the target's when the two would overlap
  const forecastShown = p.forecast && p.forecastEnd <= p.days && inView(p.forecastEnd);
  const stacked       = forecastShown && inView(p.targetEnd) && Math.abs(x(p.forecastEnd) - x(p.targetEnd)) < 96;
  if (stacked) m.t += 12;
  const plot = H - m.t - m.b;
  const svg  = htbSvg('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' });

  // Both modes share the plot: a value is drawn at its place on that mode's axis, blended by the mix (0 modules, 1 sections)
  const Y = (mv, sv, mix) => m.t + (1 - (mv - mA.lo) / (mA.hi - mA.lo) * (1 - mix) - (sv - sA.lo) / (sA.hi - sA.lo) * mix) * plot;
  // Elements of one mode only, as [element, strength]; they crossfade while the lines morph
  const onlyModules = [], onlySections = [];

  // Recessive grid with a label per step of each axis. While zooming, the old step fades out as the new one fades
  // in, and a step whose lines crowd together fades out on its own
  const grid = (list, yv, v, w) => {
    const els = [
      htbSvg('line', { class: 'htb-pace-grid', x1: m.l, x2: W - m.r, y1: yv, y2: yv }),
      htbSvg('text', { class: 'htb-pace-axis', x: m.l - 6, y: yv + 3, 'text-anchor': 'end' }, v),
    ];
    list?.push(...els.map(el => [el, w]));
    svg.append(...els);
  };
  const shared = !mA.lo && !sA.lo;   // both axes start at 0, so the baseline is shared
  if (shared) grid(null, Y(0, 0, 0), 0, 1);
  const steps = (list, a, yOf) => {
    const sets = a.from === undefined || a.from === a.step ? [[a.step, 1]] : [[a.from, 1 - a.k], [a.step, a.k]];
    for (const [step, w0] of sets) {
      const w = w0 * Math.min(1, Math.max(0, (step / (a.hi - a.lo) * plot - 10) / 14));
      if (w < 0.01) continue;
      for (let v = Math.ceil(a.lo / step - 1e-9) * step; v <= a.hi + 1e-9; v += step) {
        if (!(shared && v === 0)) grid(list, yOf(v), v, w);
      }
    }
  };
  steps(onlyModules, mA, v => Y(v, 0, 0));
  steps(onlySections, sA, v => Y(0, v, 1));

  // X axis: the start day and the first of each month, or every few days from the start when under ten weeks
  // are in view (skipped when it would collide). Tied to fixed days, so the labels slide along while zooming
  const every = v1 - v0 > 70 ? 0 : [1, 2, 7, 14].find(s => x(v0 + s) - x(v0) >= 44) ?? 14;
  let lastTick = -Infinity;
  for (let i = Math.ceil(v0); i <= v1; i++) {
    const date = new Date(Date.parse(p.start + 'T12:00:00Z') + i * HTB_DAY_MS);
    if (i > 0 && (every ? i % every : date.getUTCDate() !== 1)) continue;
    if (x(i) - lastTick < 44) continue;
    const label = i === 0 || every ? htbPaceDate(p, i, { day: 'numeric', month: 'short' })
      : htbPaceDate(p, i, date.getUTCMonth() === 0 ? { month: 'short', year: 'numeric' } : { month: 'short' });
    svg.append(htbSvg('text', { class: 'htb-pace-axis', x: x(i), y: H - 6, 'text-anchor': i === 0 ? 'start' : 'middle' }, label));
    lastTick = x(i);
  }

  // Lines: sampled a day past each edge and clipped to the plot, so they run to the edges mid-zoom
  const clip = htbSvg('clipPath', { id: 'htb-pace-clip' });
  clip.append(htbSvg('rect', { x: m.l, y: 0, width: W - m.l - m.r, height: H }));
  const plotArea = htbSvg('g', { 'clip-path': 'url(#htb-pace-clip)' });

  // Sections mode only: a horizontal line at the count where each module is done, drawn in from left to right
  // with the switch, bottom one first
  const bounds = p.bounds.filter(b => b.sec >= sA.lo - 1e-9 && b.sec <= sA.hi + 1e-9).map(b => {
    const y  = Y(0, b.sec, 1);
    const el = htbSvg('line', { class: 'htb-pace-module', x1: m.l, x2: m.l, y1: y, y2: y });
    plotArea.append(el);
    return el;
  });
  const lines = htbPaceLines(p, Math.floor(v0), Math.ceil(v1)).map(([cls, pts]) => {
    const path = htbSvg('path', { class: `htb-pace-line ${cls}` });
    plotArea.append(path);
    return [path, pts.map(([i, ...vals]) => [x(i).toFixed(1), ...vals])];
  });
  svg.append(clip, plotArea);

  // Markers: each module completion, the end of both expected lines and today's count, when in view
  const dots = p.steps.flatMap((s, k) => {
    if (!inView(s.i)) return [];
    const dot = htbSvg('circle', { class: 'htb-pace-dot', cx: x(s.i), r: 4 });
    svg.append(dot);
    return [[dot, p.base + k + 1, htbPaceSecDone(p, s.i)]];
  });
  const label = (list, attrs, text) => {
    const t = htbSvg('text', { class: 'htb-pace-value', ...attrs }, text);
    list.push([t, 1]);
    svg.append(t);
    return t;
  };
  const ends = [];
  if (inView(p.targetEnd)) ends.push([p.targetEnd, 'pace', 10]);
  if (forecastShown)       ends.push([p.forecastEnd, 'forecast', stacked ? 22 : 10]);
  const endEls = ends.map(([i, cls, above]) => {
    const at   = { x: x(i), 'text-anchor': 'end' };
    const date = htbPaceDate(p, i, { day: 'numeric', month: 'short' });
    const dot  = htbSvg('circle', { class: `htb-pace-dot ${cls}`, cx: x(i), r: 4 });
    svg.append(dot);
    return [dot, above, label(onlyModules, at, `${p.total} · ${date}`), label(onlySections, at, `${Math.round(p.secTotal)} · ${date}`)];
  });
  // The forecast continues to the right of today, so the count moves to the left of it
  const leftOf = p.forecast || x(p.today) > W - m.r - 30;
  const nowAt  = { x: x(p.today) + (leftOf ? -8 : 8), 'text-anchor': leftOf ? 'end' : 'start' };
  const now    = [htbPaceDone(p, p.today), htbPaceSecDone(p, p.today)];
  const nowEls = inView(p.today) ? [label(onlyModules, nowAt, now[0]), label(onlySections, nowAt, Math.round(now[1]))] : [];

  p.draw = mix => {
    bounds.forEach((el, k) => {
      const delay = bounds.length > 1 ? 0.4 * k / (bounds.length - 1) : 0;
      const grow  = Math.min(1, Math.max(0, (mix - delay) / 0.6));
      el.setAttribute('x2', m.l + grow * (W - m.l - m.r));
    });
    for (const [path, pts] of lines) {
      path.setAttribute('d', pts.map(([px, mL, mR, sL, sR], k) =>
        `${k ? 'L' : 'M'}${px},${Y(mL, sL, mix).toFixed(1)}L${px},${Y(mR, sR, mix).toFixed(1)}`).join(''));
    }
    for (const [dot, mv, sv] of dots) dot.setAttribute('cy', Y(mv, sv, mix));
    for (const [dot, above, ...els] of endEls) {
      const top = Y(p.total, p.secTotal, mix);
      dot.setAttribute('cy', top);
      for (const el of els) el.setAttribute('y', top - above);
    }
    for (const el of nowEls)          el.setAttribute('y', Y(...now, mix) - 8);
    for (const [el, w] of onlyModules)  el.setAttribute('opacity', w * (1 - mix));
    for (const [el, w] of onlySections) el.setAttribute('opacity', w * mix);
  };
  p.draw(htbPaceMix);

  // Hover layer: a crosshair snaps to the nearest day; the tooltip lists all three lines.
  // Dragging across it selects a period to zoom in on
  const cross = htbSvg('line', { class: 'htb-pace-cross', y1: m.t - 6, y2: H - m.b, visibility: 'hidden' });
  const brush = htbSvg('rect', { class: 'htb-pace-brush', y: m.t - 6, height: H - m.b - m.t + 6, visibility: 'hidden' });
  const hit   = htbSvg('rect', { class: 'htb-pace-hit', x: m.l, y: 0, width: W - m.l - m.r, height: H - m.b });
  svg.append(brush, cross, hit);

  const tip = $('htb-pace-tip');
  p.show = i => {
    i = Math.max(p.view[0], Math.min(p.view[1], i));
    p.cursor = i;
    cross.setAttribute('x1', x(i));
    cross.setAttribute('x2', x(i));
    cross.setAttribute('visibility', 'visible');

    const row = (cls, value, label) => {
      const r = htbEl('div', 'htb-pace-tip-row');
      r.append(htbEl('i', 'htb-key' + cls), htbEl('b', '', String(value)), htbEl('span', '', label));
      return r;
    };
    const sections = htbPaceMode === 'sections';
    const count    = v => v == null ? '–' : Math.round(v);
    tip.replaceChildren(
      htbEl('div', 'htb-pace-tip-date', htbPaceDate(p, i, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })),
      row('', i <= p.today ? count((sections ? htbPaceSecDone : htbPaceDone)(p, i)) : '–', 'Completed'),
      row(' pace', count((sections ? htbPaceSecTarget : htbPaceTarget)(p, i)), 'Target'),
      row(' forecast', count((sections ? htbPaceSecForecast : htbPaceForecast)(p, i)), 'Forecast'),
      ...p.steps.filter(s => s.i === i).map(s => htbEl('div', 'htb-pace-tip-module', `✓ ${s.module}`)),
    );
    tip.hidden = false;
    const left = x(i) > W / 2 ? x(i) - 12 - tip.offsetWidth : x(i) + 12;
    tip.style.left = `${Math.max(0, left)}px`;
  };
  p.hide = () => {
    p.cursor = null;
    cross.setAttribute('visibility', 'hidden');
    tip.hidden = true;
  };

  // Press on the start day, drag to the end day and release to zoom in; a press without a drag only moves the crosshair
  const dayAt = e => {
    const r = svg.getBoundingClientRect();
    return Math.max(p.view[0], Math.min(p.view[1], Math.round(v0 + (e.clientX - r.left - m.l) / (W - m.l - m.r) * (v1 - v0))));
  };
  let drag = null;
  p.cancelDrag = () => {
    if (!drag) return false;
    drag = null;
    brush.setAttribute('visibility', 'hidden');
    return true;
  };
  hit.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    hit.setPointerCapture(e.pointerId);   // keeps the drag going when the pointer leaves the chart
    drag = { day: dayAt(e), px: e.clientX };
  });
  hit.addEventListener('pointermove', e => {
    const i = dayAt(e);
    p.show(i);
    if (!drag) return;
    brush.setAttribute('x', x(Math.min(drag.day, i)));
    brush.setAttribute('width', Math.abs(x(i) - x(drag.day)));
    brush.setAttribute('visibility', 'visible');
  });
  hit.addEventListener('pointerup', e => {
    if (!drag) return;
    const i     = dayAt(e);
    const moved = Math.abs(e.clientX - drag.px) >= 6;
    const days  = [Math.min(drag.day, i), Math.max(drag.day, i)];
    p.cancelDrag();
    if (moved && days[1] - days[0] >= 1) setHtbPaceZoom(days);
  });
  hit.addEventListener('pointercancel', () => p.cancelDrag());

  box.querySelector('svg')?.remove();
  box.prepend(svg);
  if (p.cursor != null) p.show(p.cursor);
}

/** Renders every data-driven part of the view */
function renderHtb(data, source) {
  const completed = new Set(
    data.badges.filter(b => MODULE_SUFFIX.test(b.description)).map(b => b.description.replace(MODULE_SUFFIX, ''))
  );
  htbData = data;
  renderHtbHeader(data, source);
  renderHtbLevel(data);
  renderHtbStreak(data);
  renderHtbWeekXp(data);
  renderHtbRoute(completed);
  renderHtbBadges(data);
  prepareHtbWeeks(data);
  renderHtbChart();
  prepareHtbPace(data);
  renderHtbPace();
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
  if (htbData) {   // module sizes changed, so the expected lines move
    prepareHtbPace(htbData);
    renderHtbPace();
  }
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

  // Module pace chart: redraw at the new width; same tooltip on keyboard focus as on hover
  const pace = $('htb-pace-chart');
  new ResizeObserver(() => renderHtbPace()).observe(pace);
  pace.addEventListener('pointerleave', () => htbPace?.hide?.());
  // Keyboard focus only: a mouse press focuses the chart too, and starts a zoom selection where it is
  pace.addEventListener('focus', () => pace.matches(':focus-visible') && htbPace?.show?.(htbPace.today));
  pace.addEventListener('blur',  () => htbPace?.hide?.());
  pace.addEventListener('keydown', e => {
    const p = htbPace;
    if (!p?.show) return;
    if (e.key === 'Escape') {   // cancels a selection in progress, else leaves the zoom
      if (p.cancelDrag())  e.preventDefault();
      else if (htbPaceZoom) { e.preventDefault(); setHtbPaceZoom(null); }
      return;
    }
    const cur  = p.cursor ?? p.today;
    const keys = { ArrowLeft: cur - 7, ArrowRight: cur + 7, Home: p.view[0], End: p.view[1] };
    if (!(e.key in keys)) return;
    e.preventDefault();
    p.show(keys[e.key]);
  });
  $('htb-pace-mode').addEventListener('click', () => setHtbPaceMode(htbPaceMode === 'modules' ? 'sections' : 'modules'));
  $('htb-pace-reset').addEventListener('click', () => setHtbPaceZoom(null));
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
