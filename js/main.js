"use strict";

/* ═══════════════════════════════════════════════════════════════
   MAIN — application boot and footer refresh ticker
   Depends on: all other js/ files
   ═══════════════════════════════════════════════════════════════ */

/** Updates the footer "Updated Xm ago" label once per minute */
function startRefreshTicker() {
  let lastUpdate = new Date();

  const tick = () => {
    const diff   = Math.floor((Date.now() - lastUpdate) / 60000);
    const status = diff < 1 ? 'Updated just now' : `Updated ${diff}m ago`;
    $('last-updated').textContent    = status;
    $('refresh-status').textContent  = 'Online';
  };

  tick();
  setInterval(tick, 60 * 1000);

  // Wrap refreshAllFeeds so the timestamp resets after each refresh
  const _orig = refreshAllFeeds;
  window.refreshAllFeeds = async () => {
    await _orig();
    lastUpdate = new Date();
    tick();
  };
}

/* ─── Boot ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initWeather();
  initFeeds().then(startRefreshTicker);
});
