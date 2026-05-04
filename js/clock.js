"use strict";

/**
 * CLOCK: live time and date display
 * Depends on: utils.js ($, formatDateFull)
 */
   

function tickClock() {
  const now = new Date();
  const hh  = String(now.getHours()).padStart(2, '0');
  const mm  = String(now.getMinutes()).padStart(2, '0');
  const ss  = String(now.getSeconds()).padStart(2, '0');
  $('clock').textContent    = `${hh}:${mm}:${ss}`;
  $('date-str').textContent = formatDateFull(now);
}

function initClock() {
  tickClock();
  setInterval(tickClock, 1000);
}
