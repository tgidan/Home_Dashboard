<?php
/**
 * weather-proxy.php — server-side weather fetcher
 * Proxies requests to api.open-meteo.com to avoid browser CORS restrictions.
 * Called as: /weather-proxy.php?latitude=..&longitude=..&<other params used by js/weather.js>
 */

// Only the parameters js/weather.js sends are forwarded, so this can't be used as a general relay
$PARAMS = ['latitude', 'longitude', 'current', 'daily', 'forecast_days', 'wind_speed_unit', 'timezone'];

$lat = $_GET['latitude']  ?? '';
$lon = $_GET['longitude'] ?? '';

if (!is_numeric($lat) || !is_numeric($lon) || abs($lat) > 90 || abs($lon) > 180) {
    http_response_code(400);
    exit('Missing or invalid coordinates');
}

$query = [];
foreach ($PARAMS as $p) {
    if (isset($_GET[$p]) && is_string($_GET[$p])) $query[$p] = $_GET[$p];
}

// Only ever contact this one endpoint — no user-supplied base URL
$url = 'https://api.open-meteo.com/v1/forecast?' . http_build_query($query);

$ctx = stream_context_create([
    'http' => [
        'timeout'         => 10,
        'user_agent'      => 'Mozilla/5.0 (compatible; HomeDashboard/1.0)',
        'header'          => "Accept: application/json\r\n",
        'follow_location' => 0,      // a redirect could point elsewhere or downgrade to plain HTTP
        'ignore_errors'   => true,   // return body even on 4xx/5xx instead of false
    ],
    'ssl' => [
        'verify_peer'      => true,
        'verify_peer_name' => true,
    ],
]);

$content = @file_get_contents($url, false, $ctx, 0, 1000000);

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
