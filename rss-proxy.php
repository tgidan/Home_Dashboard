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

$url = $_GET['url'] ?? '';

if (!in_array($url, $ALLOWED, true)) {
    http_response_code(403);
    exit('Forbidden');
}

$ctx = stream_context_create([
    'http' => [
        'timeout'    => 10,
        'user_agent' => 'Mozilla/5.0 (compatible; HomeDashboard/1.0)',
        'header'     => "Accept: application/rss+xml, application/atom+xml, text/xml\r\n",
    ],
    'ssl' => [
        'verify_peer'      => true,
        'verify_peer_name' => true,
    ],
]);

$content = @file_get_contents($url, false, $ctx);

if ($content === false) {
    http_response_code(502);
    exit('Failed to fetch feed');
}

// Forward the content-type if available; fall back to XML
$ct = 'text/xml; charset=utf-8';
foreach ((array)($http_response_header ?? []) as $h) {
    if (stripos($h, 'Content-Type:') === 0) {
        $ct = trim(substr($h, 13));
        break;
    }
}

header('Content-Type: ' . $ct);
header('Cache-Control: max-age=600'); // let the browser cache for 10 min
echo $content;
