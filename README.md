# Vinci Dash

A self-contained cyberpunk-themed dashboard showing live cybersecurity news, weather, and a curated OSINT tool reference. Works as a **Wallpaper Engine** background and in any browser.

## Features

### HTB Academy Dashboard — Road to CPTS

- **Third dashboard** (between Main and OSINT) tracking progress on the Hack The Box Academy *Penetration Tester* (CPTS) path. Design contributed by a colleague and adapted to the dashboard's look.
- **Live public data** via `htb-proxy.php` — level & rank, total XP, yearly XP, active weeks, weekly XP, weekly streak and earned Academy badges from the public HTB profile. No login or API key.
  - Server-side validation and a 15-minute cache in `cache/` (web access blocked); if HTB is unreachable the last good response is served
  - HTB is contacted at most once a minute however often the proxy is called; redirects are refused and response size is capped
  - Browser cache in `localStorage` (hourly refresh) plus a bundled offline snapshot in `js/htb-data.js`, so the view is never empty
  - Status tag shows whether data is *Live*, *Cached* or an *Offline snapshot*; manual **refresh button**
- **Profile stats** — HTB level, rank and progress to the next level, total XP, badge count, active weeks
- **01 Learning path** — all 28 CPTS modules in route order, a segmented progress bar, and four collapsible sections (one open at a time, rolling open and closed; the one with the module in progress opens on load). A module counts as done only when its completion badge is publicly confirmed; modules in progress show `x / y sections` and a partly filled segment
- **02 This week** — XP earned so far in the current (unfinished) week with last week's total for comparison, plus your HTB weekly streak (XP still needed before the week resets)
- **Module sections** — every section of the module selected in the learning path (click a module row), with done / next markers; on load it shows the module in progress. Its list stretches so the column always ends level with the learning path
- **Section progress** — `data/htb-sections.json` is **generated**; don't edit it here. Edit `progress.json` in the private HackTheBox-Academy repo instead. A GitHub Action there validates it and commits the copy to this repo when it changes (only module/section names, done flags and optional completion dates are copied, never notes). A done section can carry `"date": "YYYY-MM-DD"`; the pace chart's section view uses it. Module names must match `CPTS_MODULES` in `js/htb-data.js` exactly
  - Setup: create a fine-grained PAT with access to this repo only (*Contents: Read and write*) and save it as the secret `DASHBOARD_TOKEN` in HackTheBox-Academy
  - The Action commits here, so `git pull` before pushing local changes
- **03 Study rhythm** — XP bar chart for the last 8 or 4 full weeks, with period total, last-4-weeks total and previous-4-weeks comparison
  - **Module pace** — CPTS modules completed since `CONFIG.htb.paceStart` (step line, neon green, from badge dates) against two expected lines that give each module time in proportion to its section count: a **target** of `CONFIG.htb.paceSectionsPerWeek` sections a week (dashed orange) and a **forecast** from today at the rate achieved since the start (dotted cyan, once a full week has passed). All lines start at the modules done before that date. The status line counts ahead / behind the target in sections, so progress inside a long module shows before its badge. Without section data the target falls back to one module per week. Hover or focus + arrow keys for a per-date readout
    - A **Modules / Sections** switch (modules by default) changes the y-axis to all CPTS sections; the lines morph between the two over 0.7 s (instantly with reduced motion) and the chart keeps its size. In sections the completed line steps on each section's `date`; an undated section counts on its module's badge day, or today if the module has no badge yet. Target and forecast become straight lines at their sections-per-week rate
    - **Zoom**: press on a day in the chart, drag to another day and release to zoom in on that period (also inside a zoom). The view slides there over 0.7 s (instantly with reduced motion): the x-axis narrows, the y-axis moves to fit the values in view and the grid fades between its old and new spacing, and the x-axis labels every few days when the period is under ten weeks. **Reset zoom** (next to the switch, only visible while zoomed) or Esc returns to the whole period; a click without a drag only moves the crosshair
- **04 Earned milestones** — module badges in the order earned, plus other Academy badges and modules outside the CPTS path

### OSINT Tool Dashboard

- **Second dashboard** accessible via the nav bar — completely separate from the main dashboard (no clock, weather, or news)
- Curated collection of OSINT tools organized across six investigative goals:
  - IP Addresses, Domains & URLs, File Hashes, Attack Descriptions, TTPs & Attacker Profiling, Miscellaneous
- **Color-coded importance** — each card has a colored left border and badge:
  - Red = Critical, Orange = Relevant, Yellow = Occasional, Default = Standard
- Tools appearing in multiple goals are **deduplicated** — goals, tags, and notes are merged; highest importance wins
- **Filter bar** with four combinable filters:
  - Search box (searches tool names, tags, goals, and notes)
  - Importance toggle buttons
  - Goal dropdown
  - Application/tag dropdown (scoped to the selected goal)
- **Result count** shown live as filters change
- Clicking a card opens a **subview panel** (modal overlay) showing:
  - All goals the tool belongs to
  - Full application/tag list
  - Per-goal notes (with goal heading when multiple goals have notes)
  - "Visit Tool" button that opens the tool's website in a new tab
- Subview can be closed via the ✕ button, clicking outside, or pressing Escape

### Weather

- Current conditions via [Open-Meteo](https://open-meteo.com/) — free, no API key required
- Stats: temperature, feels-like, max today, humidity, wind speed, precipitation
- **7-day forecast strip** with emoji icons and daily high temperatures
- Auto-detects location via the browser Geolocation API; reverse-geocodes to a human-readable city name via Nominatim (OpenStreetMap)
- Falls back to configured coordinates if geolocation is unavailable or denied
- **Manual refresh button** with animated spinner; respects a configurable TTL to avoid unnecessary API calls
- Cached in `localStorage` — panel shows instantly on reload from cache

### Cybersecurity News

- Aggregates RSS feeds from The Hacker News, Bleeping Computer, and Krebs on Security
- **Severity tagging** — articles auto-tagged HIGH / MEDIUM / INFO based on title keywords
- **Day-window navigation** — Navigate between days. Dashboard will initially show news from 6AM yesterday until today 6AM, as the intention is to read the news in the morning. Navigation will shift this interval.
- **Source dropdown** — filter by individual feed or view all sources merged
- Newest articles first within each window
- **Manual refresh button** with animated spinner; invalidates per-feed cache timestamps
- Cached in `localStorage` per feed; stale cache is shown on load while a fresh fetch runs in the background

### Clock

- Live clock updating every second
- Full date line (e.g. `Tuesday · 8 April 2026`)

### Animated Background

- Procedurally generated cyberpunk cityscape rendered on an HTML5 canvas
- Three parallax building layers (far, mid, near) with randomised heights and widths
- Animated glowing windows (cyan, purple, amber, cold white) that pulse independently
- Rooftop antennas with blinking red tips
- Neon horizontal sign strips (cyan and hot pink) with glow and reflection
- Twinkling stars in a deep-navy sky with purple nebula and cyan horizon glow
- Animated rain with angle and opacity variation
- Wet-road neon puddle reflections on the ground
- Fully responsive — rebuilds the scene on window resize

### Status Footer

- Online / offline status indicator

## Project Structure

```text
Home_Dashboard/
├── index.html          # Main entry point and layout
├── project.json        # Wallpaper Engine metadata
├── rss-proxy.php       # Server-side RSS fetcher (CORS bypass, whitelist enforced)
├── htb-proxy.php       # Server-side HTB public profile fetcher (validated, cached)
├── cache/              # htb-proxy.php cache; .htaccess denies web access (must be writable by PHP)
├── data/
│   └── htb-sections.json  # HTB section progress, generated from the HackTheBox-Academy repo
├── .htaccess           # Apache rewrite / caching rules
├── css/
│   ├── base.css        # Reset and root variables
│   ├── layout.css      # Grid layout
│   ├── clock.css       # Clock and date styles
│   ├── news.css        # News feed, badges, source dropdown, nav
│   ├── osint.css       # OSINT dashboard: nav, cards, filters, subview overlay
│   ├── htb.css         # HTB Academy dashboard: stats, route, goal form, chart, badges
│   └── background.css  # Canvas positioning
└── js/
    ├── config.js       # All user-editable settings (location, feeds, refresh)
    ├── utils.js        # Shared helpers: $(), cache(), timeAgo(), escapeHtml()
    ├── clock.js        # Clock and date rendering
    ├── weather.js      # Weather fetch, WMO code map, forecast render
    ├── news.js         # Feed fetch, severity tagging, filtering, render
    ├── osint-data.js   # Static OSINT tool data: tables, URLs, deduplication logic
    ├── osint.js        # OSINT dashboard: filter UI, grid render, subview logic
    ├── htb-data.js     # CPTS module list/sections + offline HTB profile snapshot
    ├── htb.js          # HTB Academy dashboard: fetch, render, weekly goal
    ├── background.js   # Cityscape canvas animation
    └── main.js         # Boot sequence and refresh status ticker
```

## Configuration

Edit [js/config.js](js/config.js):

```js
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
      { id: 'etr', name: 'Embrace the Red', url: 'https://embracethered.com/blog/index.xml' },
    ],
    itemsPerFeed: 30           // max articles stored per feed
  },
  htb: {
    profileId: '019d2a9f-…',   // public HTB profile id (also set in htb-proxy.php)
    username:  'DVERKADE',
    fullName:  'Daan Verkade',
    showFullName: false,       // true shows the full name next to the username
    paceStart: '2026-09-14',   // start of the module pace chart
    paceSectionsPerWeek: 12    // target rate for the pace chart
  },
  refresh: {
    weatherMins: 30,           // weather auto-refresh interval
    newsMins:    20,           // news auto-refresh interval
    htbMins:     60            // HTB profile auto-refresh interval
  }
};
```

To track a different HTB profile, change `CONFIG.htb.profileId` **and** `$PROFILE_ID` in [htb-proxy.php](htb-proxy.php). If HTB updates the CPTS path, edit `CPTS_MODULES` / `CPTS_GROUPS` in [js/htb-data.js](js/htb-data.js).

To add a news feed, add an entry to `CONFIG.news.feeds` and add the same URL to the `$ALLOWED` array in [rss-proxy.php](rss-proxy.php).

## Data Sources

| Data | Source | Key required |
| --- | --- | --- |
| Weather | [Open-Meteo](https://open-meteo.com/) | No |
| Geolocation | [Nominatim](https://nominatim.openstreetmap.org/) (OpenStreetMap) | No |
| News | Direct RSS/Atom via `rss-proxy.php` | No |
| HTB Academy | Public [HTB profile](https://profile.hackthebox.com/) and experience APIs via `htb-proxy.php` | No |
| HTB section progress | `data/htb-sections.json`, synced from the private HackTheBox-Academy repo | No (the sync Action uses a PAT) |

All data sources are completely free with no account or API key required.

## Usage

### Browser / Mobile

Serve the folder with any web server that supports PHP (needed for `rss-proxy.php`, `weather-proxy.php` and `htb-proxy.php`). Upload `cache/.htaccess` too and make sure PHP can write to `cache/`; without it `htb-proxy.php` returns 503 and the HTB tab stays on its offline snapshot. Open `index.html` in the browser. Geolocation requires HTTPS or `localhost`.

### Wallpaper Engine (2.7.3)

1. Open Wallpaper Engine → **Workshop** → **Create Wallpaper**
2. Select this folder (`Home_Dashboard/`) or drag `index.html` in
3. `project.json` is pre-configured for the web wallpaper type

OR (How I do it)

1. Open Wallpaper Engine → **Open Wallpaper** → **Open from URL**
2. Fill in the following:
  - URL: 'http(s)\://${link_to_dashboard}'
  - Name: '${Name}'
  - Hide Desktop icons: '${Button_combo}' 
  - Use livestream mode: 'personal preference'
3. Select wallpaper and enjoy!

#### Wallpaper Engine tip:
Wallpaper Engine has its own cache for loading in URLs (option 2) which is nice, but comes with the downside of some updates to the website won't load in. This is because Wallpaper Engine cached the files from the website. **Perform the following steps** to fix this:
1. Close Wallpaper Engine (Windows taskbar → show hidden icons → Right click Wallpaper Engine → Left click 'Quit')
2. Perform the following two commandos in PowerShell
 - `Remove-Item -Recurse -Force "${Drive}:\${Steam path to Wallpaper Engine}\bin\edgewallpaper32.exe.WebView2\EBWebView\Default\Cache\*"` 
 - `Remove-Item -Recurse -Force "${Drive}\${Steam path to Wallpaper Engine}\bin\edgewallpaper32.exe.WebView2\EBWebView\*" -Exclude "*.json","*.log"`
 3. Open Wallpaper Engine again and everything should work.
