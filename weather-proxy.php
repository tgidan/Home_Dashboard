<?php
/**
 * weather-proxy.php — server-side weather fetcher
 * Proxies requests to api.open-meteo.com to avoid browser CORS restrictions.
 * Called as: /weather-proxy.php?<query_string_forwarded_as-is>
 */

$qs = $_SERVER['QUERY_STRING'] ?? '';

if ($qs === '') {
    http_response_code(400);
    exit('Missing query string');
}

// Only ever contact this one endpoint — no user-supplied base URL
$url = 'https://api.open-meteo.com/v1/forecast?' . $qs;

$ctx = stream_context_create([
    'http' => [
        'timeout'    => 10,
        'user_agent' => 'Mozilla/5.0 (compatible; HomeDashboard/1.0)',
        'header'     => "Accept: application/json\r\n",
    ],
    'ssl' => [
        'verify_peer'      => true,
        'verify_peer_name' => true,
    ],
]);

$content = @file_get_contents($url, false, $ctx);

if ($content === false) {
    http_response_code(502);
    exit('Failed to fetch weather data');
}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: max-age=300'); // 5-minute browser cache
echo $content;
