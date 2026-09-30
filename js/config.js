"use strict";

/** CONFIG: edit this file to customise your dashboard */
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
      { id: 'etr',   name: 'Embrace The Red',   url: 'https://embracethered.com/blog/index.xml' },
    ],
    itemsPerFeed: 30
  },
  htb: {
    profileId:  '019d2a9f-0715-70fa-a685-10b7c86bf0e5',   // also hardcoded in htb-proxy.php
    username:   'DVERKADE',
    fullName:   'Daan Verkade',
    showFullName: false,                                  // true shows the full name next to the username
    paceStart:  '2026-09-14',                             // start of the module pace chart
    paceSectionsPerWeek: 15                               // target rate; each module gets time for its section count
  },
  refresh: {
    weatherMins: 30,
    newsMins:    20,
    htbMins:     60
  }
};
