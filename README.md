# Vinci Dash

A self-contained dashboard displaying live cybersecurity news and weather. Works as a **Wallpaper Engine** background and in any mobile browser.

## Features

- **Live clock** — updates every second
- **Weather** — current conditions via [Open-Meteo](https://open-meteo.com/) (free, no API key)
- **Cybersecurity news** — from The Hacker News, Bleeping Computer, and Krebs on Security
- **Severity tagging** — articles auto-tagged HIGH / MEDIUM / INFO based on keywords
- Responsive layout for both 1920×1080 desktop and mobile screens

## Usage

### Browser / Mobile

Open `index.html` directly in any browser, or serve it with a local web server.

### Wallpaper Engine

1. Open Wallpaper Engine → **Workshop** → **Create Wallpaper**
2. Select this folder (`Home_Dashboard/`) or drag `index.html` in
3. The `project.json` is already configured for web wallpaper type

## Configuration

Edit the `CONFIG` block at the top of the `<script>` in `index.html`:

```js
const CONFIG = {
  location: {
    latitude:       52.3676,   // fallback coordinates
    longitude:      4.9041,
    city:           'Amsterdam',
    country:        'NL',
    useGeolocation: true,      // auto-detect location via browser
    units:          'celsius'  // 'celsius' or 'fahrenheit'
  },
  news: {
    itemsPerFeed: 10           // articles to show per source
  },
  refresh: {
    weatherMins: 30,           // weather refresh interval
    newsMins:    20            // news refresh interval
  }
};
```

## Data Sources

| Data | API | Key required |
| --- | --- | --- |
| Weather | Open-Meteo | No |
| News | RSS2JSON (free tier) | No |
| Geolocation | Nominatim (OpenStreetMap) | No |

All APIs are completely free with no account or API key needed.
