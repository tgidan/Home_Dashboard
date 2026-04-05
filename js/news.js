"use strict";

/* ═══════════════════════════════════════════════════════════════
   NEWS — fetches and renders cybersecurity RSS feeds
   Depends on: config.js (CONFIG), utils.js ($, cache, timeAgo)
   ═══════════════════════════════════════════════════════════════ */

/* ─── Severity classification ────────────────────────────────── */
const HIGH_KEYWORDS   = /ransomware|zero.?day|0.?day|exploit|cve-|critical|breach|backdoor|rce|remote code|data leak|nation.state|apt\b/i;
const MEDIUM_KEYWORDS = /phishing|malware|trojan|spyware|adware|ddos|botnet|vulnerability|patch|update|attack|threat|hacker|compromise|spoof|bypass/i;

function severity(title) {
  if (HIGH_KEYWORDS.test(title))   return ['HIGH',   'badge-red'];
  if (MEDIUM_KEYWORDS.test(title)) return ['MEDIUM', 'badge-orange'];
  return ['INFO', 'badge-green'];
}

/* ─── Render ─────────────────────────────────────────────────── */
function renderFeed(feedCfg, items) {
  const list = $(`list-${feedCfg.id}`);
  const cnt  = $(`cnt-${feedCfg.id}`);

  if (!items || items.length === 0) {
    list.innerHTML = `<li class="state-msg">No articles found</li>`;
    cnt.textContent = '0';
    return;
  }

  cnt.textContent = items.length;
  list.innerHTML  = items.map(item => {
    const [sev, cls] = severity(item.title || '');
    // Sanitise the title to prevent XSS from feed content
    const title = item.title
      ? item.title.replace(/</g, '&lt;').replace(/>/g, '&gt;')
      : '(no title)';
    return `
      <li>
        <a class="article-item" href="${item.link || '#'}" target="_blank" rel="noopener noreferrer">
          <div class="article-meta">
            <span class="article-badge ${cls}">${sev}</span>
            <span class="article-time">${timeAgo(item.pubDate)}</span>
          </div>
          <div class="article-title">${title}</div>
        </a>
      </li>
    `;
  }).join('');
}

/* ─── Fetch single feed ──────────────────────────────────────── */
async function fetchFeed(feedCfg) {
  const key = `feed_${feedCfg.id}`;
  try {
    const encoded = encodeURIComponent(feedCfg.url);
    const res     = await fetch(
      `https://api.rss2json.com/v1/api.json?rss_url=${encoded}&count=${CONFIG.news.itemsPerFeed}`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok') throw new Error('Feed error: ' + data.message);
    cache(key, data.items);
    renderFeed(feedCfg, data.items);
  } catch (e) {
    const cached = cache(key);
    if (cached) {
      renderFeed(feedCfg, cached);
    } else {
      $(`list-${feedCfg.id}`).innerHTML = `<li class="state-msg">⚠️ Failed to load</li>`;
    }
    console.warn(`Feed "${feedCfg.name}" failed:`, e.message);
  }
}

/* ─── Refresh all feeds in parallel ─────────────────────────── */
async function refreshAllFeeds() {
  await Promise.all(CONFIG.news.feeds.map(fetchFeed));
}

/* ─── Init ───────────────────────────────────────────────────── */
async function initFeeds() {
  // Render any cached content immediately so columns aren't blank
  CONFIG.news.feeds.forEach(f => {
    const cached = cache(`feed_${f.id}`);
    if (cached) renderFeed(f, cached);
  });

  await refreshAllFeeds();
  setInterval(refreshAllFeeds, CONFIG.refresh.newsMins * 60 * 1000);
}
