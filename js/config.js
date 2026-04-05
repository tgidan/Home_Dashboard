"use strict";

/* ═══════════════════════════════════════════════════════════════
   CONFIG — edit this file to customise your dashboard
   ═══════════════════════════════════════════════════════════════ */
const CONFIG = {
  location: {
    latitude:       52.3676,   // fallback coordinates if geolocation fails
    longitude:      4.9041,
    city:           'Amsterdam',
    country:        'NL',
    useGeolocation: true,      // set false to always use the coords above
    units:          'celsius'  // 'celsius' | 'fahrenheit'
  },
  news: {
    feeds: [
      { id: 'thn',   name: 'The Hacker News',  url: 'https://thehackernews.com/feeds/posts/default' },
      { id: 'bc',    name: 'Bleeping Computer', url: 'https://www.bleepingcomputer.com/feed/' },
      { id: 'krebs', name: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/' },
    ],
    itemsPerFeed: 10
  },
  refresh: {
    weatherMins: 30,
    newsMins:    20
  }
};
