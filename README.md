# Vinci Dash

A self-contained cyberpunk-themed dashboard showing live cybersecurity news and weather. Works as a **Wallpaper Engine** background and in any browser.

## Features

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
├── .htaccess           # Apache rewrite / caching rules
├── css/
│   ├── base.css        # Reset and root variables
│   ├── layout.css      # Grid layout
│   ├── clock.css       # Clock and date styles
│   ├── news.css        # News feed, badges, source dropdown, nav
│   └── background.css  # Canvas positioning
└── js/
    ├── config.js       # All user-editable settings (location, feeds, refresh)
    ├── utils.js        # Shared helpers: $(), cache(), timeAgo(), escapeHtml()
    ├── clock.js        # Clock and date rendering
    ├── weather.js      # Weather fetch, WMO code map, forecast render
    ├── news.js         # Feed fetch, severity tagging, filtering, render
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
    ],
    itemsPerFeed: 30           // max articles stored per feed
  },
  refresh: {
    weatherMins: 30,           // weather auto-refresh interval
    newsMins:    20            // news auto-refresh interval
  }
};
```

To add a news feed, add an entry to `CONFIG.news.feeds` and add the same URL to the `$ALLOWED` array in [rss-proxy.php](rss-proxy.php).

## Data Sources

| Data | Source | Key required |
| --- | --- | --- |
| Weather | [Open-Meteo](https://open-meteo.com/) | No |
| Geolocation | [Nominatim](https://nominatim.openstreetmap.org/) (OpenStreetMap) | No |
| News | Direct RSS/Atom via `rss-proxy.php` | No |

All data sources are completely free with no account or API key required.

## Usage

### Browser / Mobile

Serve the folder with any web server that supports PHP (needed for `rss-proxy.php`). Open `index.html` in the browser. Geolocation requires HTTPS or `localhost`.

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
 - `"${Drive}:\${Steam path to Wallpaper Engine}\bin\edgewallpaper32.exe.WebView2\EBWebView\Default\Cache\*"` 
 - `"${Drive}\${Steam path to Wallpaper Engine}\bin\edgewallpaper32.exe.WebView2\EBWebView\*" -Exclude "*.json","*.log"`
 3. Open Wallpaper Engine again and everything should work.
