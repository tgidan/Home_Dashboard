"use strict";

/* ═══════════════════════════════════════════════════════════════
   NEWS — single merged feed with source dropdown + day filter
   Depends on: config.js (CONFIG), utils.js ($, cache, timeAgo, MONTHS)
   ═══════════════════════════════════════════════════════════════ */

/* ─── State ──────────────────────────────────────────────────── */
let dayOffset    = 0;     // 0 = current window, +N = N days back
let activeSource = null;  // null = all, or a feed.id string

/* ═══════════════════════════════════════════════════════════════
   DAY WINDOW
   ═══════════════════════════════════════════════════════════════ */

function getWindow(offset) {
  const end = new Date();
  end.setHours(6, 0, 0, 0);
  end.setDate(end.getDate() - offset);
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return { start, end };
}

function formatWindowLabel({ start, end }) {
  // On narrow screens drop the time component to save space
  const narrow = window.innerWidth <= 600;
  const fmt = narrow
    ? d => `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`
    : d => `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${String(d.getHours()).padStart(2, '0')}:00`;
  return `${fmt(start)} \u2192 ${fmt(end)}`;
}

function filterByWindow(items, { start, end }) {
  return items.filter(item => {
    if (!item.pubDate) return false;
    const t = new Date(item.pubDate).getTime();
    return t >= start.getTime() && t < end.getTime();
  });
}

function navigateDay(delta) {
  const next = dayOffset + delta;
  if (next < 0) return;
  dayOffset = next;
  applyFilters();
}

/* ═══════════════════════════════════════════════════════════════
   SOURCE DROPDOWN
   ═══════════════════════════════════════════════════════════════ */

function setActiveSource(sourceId) {
  activeSource = sourceId === 'all' ? null : sourceId;

  // Update toggle label
  const label = activeSource === null
    ? 'All Sources'
    : CONFIG.news.feeds.find(f => f.id === activeSource)?.name ?? 'Unknown';
  $('source-toggle-label').textContent = label;

  // Sync option active states
  document.querySelectorAll('.source-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.source === (sourceId));
  });

  closeDropdown();
  applyFilters();
}

function openDropdown() {
  $('source-menu').hidden = false;
  $('source-toggle').classList.add('open');
}

function closeDropdown() {
  $('source-menu').hidden = true;
  $('source-toggle').classList.remove('open');
}

function initSourceDropdown() {
  const menu = $('source-menu');

  const addOption = (label, sourceId) => {
    const btn = document.createElement('button');
    btn.className      = 'source-option' + (sourceId === 'all' ? ' active' : '');
    btn.dataset.source = sourceId;
    btn.textContent    = label;
    btn.addEventListener('click', () => setActiveSource(sourceId));
    menu.appendChild(btn);
  };

  addOption('All Sources', 'all');
  CONFIG.news.feeds.forEach(f => addOption(f.name, f.id));

  // Toggle on button click
  $('source-toggle').addEventListener('click', e => {
    e.stopPropagation();
    $('source-menu').hidden ? openDropdown() : closeDropdown();
  });

  // Close when clicking outside
  document.addEventListener('click', () => closeDropdown());

  // Prevent clicks inside the menu from bubbling up and immediately closing it
  menu.addEventListener('click', e => e.stopPropagation());
}

/* ═══════════════════════════════════════════════════════════════
   SEVERITY
   ═══════════════════════════════════════════════════════════════ */

const HIGH_KEYWORDS   = /ransomware|zero.?day|0.?day|exploit|cve-|critical|breach|backdoor|rce|remote code|data leak|nation.state|apt\b/i;
const MEDIUM_KEYWORDS = /phishing|malware|trojan|spyware|adware|ddos|botnet|vulnerability|patch|update|attack|threat|hacker|compromise|spoof|bypass/i;

function severity(title) {
  if (HIGH_KEYWORDS.test(title))   return ['HIGH',   'badge-red'];
  if (MEDIUM_KEYWORDS.test(title)) return ['MEDIUM', 'badge-orange'];
  return ['INFO', 'badge-green'];
}

/* ═══════════════════════════════════════════════════════════════
   RENDER
   ═══════════════════════════════════════════════════════════════ */

function renderMergedFeed(items) {
  const list = $('feed-merged');

  if (!items || items.length === 0) {
    list.innerHTML = `
      <li class="state-msg-wrapper">
        <div class="state-msg">No articles in this period</div>
      </li>`;
    return;
  }

  list.innerHTML = items.map(item => {
    const [sev, cls] = severity(item.title || '');
    const title = escapeHtml(item.title || '(no title)');
    const href  = /^https?:\/\//i.test(item.link) ? item.link : '#';
    return `
      <li>
        <a class="article-item" href="${href}" target="_blank" rel="noopener noreferrer">
          <div class="article-meta">
            <div class="article-meta-left">
              <span class="article-badge ${cls}">${sev}</span>
              <span class="article-source">${escapeHtml(item._sourceName)}</span>
            </div>
            <span class="article-time">${timeAgo(item.pubDate)}</span>
          </div>
          <div class="article-title">${title}</div>
        </a>
      </li>
    `;
  }).join('');
}

/* ─── Collect, filter, sort, render ─────────────────────────── */
function applyFilters() {
  const win = getWindow(dayOffset);

  $('day-label').textContent = formatWindowLabel(win);
  $('nav-next').disabled     = dayOffset <= 0;

  // Merge all cached items and tag each with its source
  let items = [];
  CONFIG.news.feeds.forEach(f => {
    const cached = cache(`feed_${f.id}`);
    if (cached) {
      cached.forEach(item => items.push({
        ...item,
        _sourceId:   f.id,
        _sourceName: f.name,
      }));
    }
  });

  // Apply day window
  items = filterByWindow(items, win);

  // Apply source filter
  if (activeSource !== null) {
    items = items.filter(item => item._sourceId === activeSource);
  }

  // Newest first
  items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  renderMergedFeed(items);
}

/* ═══════════════════════════════════════════════════════════════
   FETCH
   ═══════════════════════════════════════════════════════════════ */

/** Returns the most recent 6 AM (today if past 6, yesterday if before 6) */
function getLastSixAm() {
  const d = new Date();
  d.setHours(6, 0, 0, 0);
  if (d > new Date()) d.setDate(d.getDate() - 1);
  return d;
}

async function fetchFeed(feedCfg) {
  const key      = `feed_${feedCfg.id}`;
  const tsKey    = `feed_${feedCfg.id}_fetchedAt`;
  const cached   = cache(key);
  const fetchedAt = cache(tsKey);

  // Use cached data if it was fetched after the last 6 AM
  if (cached && fetchedAt && new Date(fetchedAt) >= getLastSixAm()) {
    return; // already fresh, skip API call
  }
  
  try {
    const encoded = encodeURIComponent(feedCfg.url);
    const res     = await fetch(
      `https://api.rss2json.com/v1/api.json?rss_url=${encoded}&count=${CONFIG.news.itemsPerFeed}`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok') throw new Error('Feed error: ' + data.message);
    cache(key, data.items);
    cache(tsKey, new Date().toISOString());
  } catch (e) {
    console.warn(`Feed "${feedCfg.name}" failed:`, e.message);
    // stale cache (if any) is still in localStorage — applyFilters will use it
  }
}

async function refreshAllFeeds() {
  await Promise.all(CONFIG.news.feeds.map(fetchFeed));
  applyFilters();
}

/* ═══════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════ */

async function initFeeds() {
  initSourceDropdown();

  $('nav-prev').addEventListener('click', () => navigateDay(+1));
  $('nav-next').addEventListener('click', () => navigateDay(-1));

  // Render from cache immediately so the list isn't blank on load
  applyFilters();

  await refreshAllFeeds();

  setInterval(refreshAllFeeds, CONFIG.refresh.newsMins * 60 * 1000);
}
