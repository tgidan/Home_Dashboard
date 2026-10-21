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
        'timeout'        => 10,
        'user_agent'     => 'Mozilla/5.0 (compatible; HomeDashboard/1.0)',
        'header'         => "Accept: application/json\r\n",
        'ignore_errors'  => true,   // return body even on 4xx/5xx instead of false
    ],
    'ssl' => [
        'verify_peer'      => true,
        'verify_peer_name' => true,
    ],
]);

$content = @file_get_contents($url, false, $ctx);

if ($content === false) {
    http_response_code(502);
    exit('Failed to reach weather API');
}

// Forward the upstream HTTP status code
$httpStatus = 200;
foreach ((array)($http_response_header ?? []) as $h) {
    if (preg_match('#^HTTP/\S+\s+(\d+)#', $h, $m)) {
        $httpStatus = (int)$m[1];
    }
}

http_response_code($httpStatus);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: max-age=300');
echo $content;
