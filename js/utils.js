"use strict";

/* 
 * UTILS: shared helpers used across all widgets
 */

/** Escapes HTML special characters to prevent XSS when inserting into innerHTML */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Persistent localStorage cache.
 * cache(key, value) -> stores value as JSON
 * cache(key) -> returns parsed value, or null on miss/error
 */
function cache(key, val) {
  if (val !== undefined) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  } else {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  }
}

/** Returns a human-readable relative time string, e.g. "3h ago" */
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/** Returns full date string, e.g. "Saturday  ·  5 April 2026" */
function formatDateFull(d) {
  return `${DAYS[d.getDay()]}  ·  ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
