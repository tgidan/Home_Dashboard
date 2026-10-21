<?php
/**
 * rss-proxy.php — server-side RSS fetcher
 * Whitelisted to the feeds defined in config.js; returns raw XML.
 * Called as: /rss-proxy.php?url=<encoded_feed_url>
 */

$ALLOWED = [
    'https://thehackernews.com/feeds/posts/default',
    'https://www.bleepingcomputer.com/feed/',
    'https://krebsonsecurity.com/feed/',
    'https://embracethered.com/blog/index.xml',
];

// Redirects are only followed to these hosts (over HTTPS); THN redirects to FeedBurner
$REDIRECT_HOSTS = ['thehackernews.com', 'feeds.feedburner.com', 'www.bleepingcomputer.com',
                   'krebsonsecurity.com', 'embracethered.com'];
$MAX_REDIRECTS  = 3;
$MAX_BYTES      = 5000000;

$url = $_GET['url'] ?? '';

if (!in_array($url, $ALLOWED, true)) {
    http_response_code(403);
    exit('Forbidden');
}

$ctx = stream_context_create([
    'http' => [
        'timeout'         => 10,
        'user_agent'      => 'Mozilla/5.0 (compatible; HomeDashboard/1.0)',
        'header'          => "Accept: application/rss+xml, application/atom+xml, text/xml\r\n",
        'follow_location' => 0,      // redirects are checked below instead of followed blindly
        'ignore_errors'   => true,   // needed to read the Location header of a 3xx
    ],
    'ssl' => [
        'verify_peer'      => true,
        'verify_peer_name' => true,
    ],
]);

for ($hop = 0; ; $hop++) {
    // maxlen stops the download itself, so an oversized response never fills memory
    $content = @file_get_contents($url, false, $ctx, 0, $MAX_BYTES + 1);
    $headers = function_exists('http_get_last_response_headers')
        ? (http_get_last_response_headers() ?? [])
        : ($http_response_header ?? []);
    $status   = preg_match('#^HTTP/\S+\s+(\d{3})#', $headers[0] ?? '', $m) ? (int)$m[1] : 0;
    $location = '';
    foreach ($headers as $h) {
        if (stripos($h, 'Location:') === 0) $location = trim(substr($h, 9));
    }

    if ($status < 300 || $status >= 400 || $location === '') break;

    // Only absolute HTTPS URLs on a known feed host, so a redirect can't reach internal addresses
    $next = parse_url($location);
    if ($hop >= $MAX_REDIRECTS || ($next['scheme'] ?? '') !== 'https' || isset($next['port'])
            || isset($next['user']) || !in_array(strtolower($next['host'] ?? ''), $REDIRECT_HOSTS, true)) {
        http_response_code(502);
        exit('Feed redirected to a disallowed location');
    }
    $url = $location;
}

if (!is_string($content) || $status !== 200 || strlen($content) > $MAX_BYTES) {
    http_response_code(502);
    exit('Failed to fetch feed');
}

// Always XML: forwarding the upstream type could let a compromised feed serve HTML on our origin
header('Content-Type: text/xml; charset=utf-8');
header('Cache-Control: max-age=600'); // let the browser cache for 10 min
echo $content;
