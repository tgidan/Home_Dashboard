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

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 10,
    CURLOPT_USERAGENT      => 'Mozilla/5.0 (compatible; HomeDashboard/1.0)',
    CURLOPT_HTTPHEADER     => ['Accept: application/json'],
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS      => 3,
]);

$content    = curl_exec($ch);
$httpStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError  = curl_error($ch);
curl_close($ch);

if ($content === false || $curlError !== '') {
    http_response_code(502);
    exit('Failed to reach weather API: ' . $curlError);
}

http_response_code($httpStatus);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: max-age=300'); // 5-minute browser cache
echo $content;
