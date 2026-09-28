<?php
/**
 * htb-proxy.php — server-side Hack The Box Academy fetcher
 * Pulls the public profile XP matrix, Academy badges and level/streak, validates them and
 * returns the compact schema used by js/htb.js (same shape as js/htb-data.js).
 * Called as: /htb-proxy.php            (served from a short server-side cache)
 *            /htb-proxy.php?fresh=1    (bypasses the cache, e.g. refresh button)
 *
 * Only public profile data is requested; no credentials are involved.
 * The cache also acts as a rate limit: HTB is contacted at most once per $RETRY_AFTER
 * seconds, no matter how often this script is called.
 */

// Keep in sync with CONFIG.htb.profileId — hardcoded so callers cannot pick the URL
$PROFILE_ID  = '019d2a9f-0715-70fa-a685-10b7c86bf0e5';
$BASE        = "https://profile.hackthebox.com/api/v1/public/profile/$PROFILE_ID";
$XP_BASE     = 'https://profile.hackthebox.com/api/experience/v1/account';

// Inside our own account rather than the shared /tmp, so other hosting users can't touch it
$CACHE_DIR   = __DIR__ . '/cache';
$CACHE_FILE  = "$CACHE_DIR/htb.json";
$LOCK_FILE   = "$CACHE_DIR/htb.lock";     // held while one request refreshes the cache
$ATTEMPT     = "$CACHE_DIR/htb.attempt";  // mtime = last time we tried to reach HTB
$CACHE_TTL   = 15 * 60;                   // seconds
$MIN_FRESH   = 60;                        // ?fresh=1 still reuses data younger than this
$RETRY_AFTER = 60;                        // minimum gap between attempts to reach HTB
$MAX_BYTES   = 2000000;                   // largest HTB response we accept (badges ≈ 120 kB)

function respond(int $status, string $body, bool $stale = false): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    if ($stale) header('X-HTB-Stale: 1');
    echo $body;
    exit;
}

function errorResponse(int $status, string $msg): void {
    respond($status, json_encode(['error' => $msg]));
}

/** Returns the cached body if it is a real file holding dashboard JSON, else null */
function readCache(): ?string {
    global $CACHE_FILE;
    clearstatcache();
    if (is_link($CACHE_FILE) || !is_file($CACHE_FILE)) return null;
    $body = @file_get_contents($CACHE_FILE, false, null, 0, 1000000);
    $data = is_string($body) ? json_decode($body, true) : null;
    return (is_array($data) && ($data['schemaVersion'] ?? null) === 1) ? $body : null;
}

function secondsSince(string $file): int {
    clearstatcache();
    $mtime = @filemtime($file);
    return $mtime === false ? PHP_INT_MAX : time() - $mtime;
}

/** Writes via a private temp file + rename, which replaces a symlink instead of following it */
function writeCache(string $body): void {
    global $CACHE_DIR, $CACHE_FILE;
    $tmp = @tempnam($CACHE_DIR, 'htb');   // created with 0600 permissions
    if ($tmp === false) return;
    if (@file_put_contents($tmp, $body) === false || !@rename($tmp, $CACHE_FILE)) @unlink($tmp);
}

/** Serves the last good response when HTB can't be used right now */
function fail(string $msg): void {
    $cached = readCache();
    if ($cached !== null) respond(200, $cached, true);
    errorResponse(502, $msg);
}

/** Returns the decoded JSON; on failure aborts, or returns null when $optional */
function fetchJson(string $url, bool $optional = false): ?array {
    global $MAX_BYTES;
    $ctx = stream_context_create([
        'http' => [
            'timeout'         => 10,
            'user_agent'      => 'Mozilla/5.0 (compatible; HomeDashboard/1.0)',
            'header'          => "Accept: application/json\r\n",
            'follow_location' => 0,   // a redirect could point elsewhere or downgrade to plain HTTP
        ],
        'ssl' => [
            'verify_peer'      => true,
            'verify_peer_name' => true,
        ],
    ]);
    // maxlen stops the download itself, so an oversized response never fills memory
    $raw     = @file_get_contents($url, false, $ctx, 0, $MAX_BYTES + 1);
    $headers = function_exists('http_get_last_response_headers')
        ? (http_get_last_response_headers() ?? [])
        : ($http_response_header ?? []);
    $ok   = is_string($raw) && strlen($raw) <= $MAX_BYTES && preg_match('#^HTTP/\S+\s+200\b#', $headers[0] ?? '');
    $json = $ok ? json_decode($raw, true) : null;
    if (is_array($json)) return $json;
    if ($optional)       return null;
    fail('HTB could not be reached or returned an invalid response');
}

function isCount($v): bool { return (is_int($v) || is_float($v)) && $v >= 0; }

/* Without a working cache every request would hit HTB, so refuse instead */
if (!is_dir($CACHE_DIR) && !@mkdir($CACHE_DIR, 0700)) errorResponse(503, 'Cache directory unavailable');
if (is_link($CACHE_DIR) || !is_writable($CACHE_DIR))  errorResponse(503, 'Cache directory unavailable');
if (!is_file("$CACHE_DIR/.htaccess")) {
    @file_put_contents("$CACHE_DIR/.htaccess", "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n");
}

/* Serve from cache while fresh */
$ttl    = isset($_GET['fresh']) ? $MIN_FRESH : $CACHE_TTL;
$cached = readCache();
if ($cached !== null && secondsSince($CACHE_FILE) < $ttl) respond(200, $cached);

/* Only one request refreshes at a time; the others get the current cache meanwhile */
$lock = @fopen($LOCK_FILE, 'c');
if ($lock === false) errorResponse(503, 'Cache lock unavailable');
if (!flock($lock, LOCK_EX | LOCK_NB)) {
    if ($cached !== null) respond(200, $cached);
    flock($lock, LOCK_EX);   // nothing to serve yet: wait for the refresh in progress
}

// Another request may have refreshed the cache while we waited for the lock
$cached = readCache();
if ($cached !== null && secondsSince($CACHE_FILE) < $ttl) respond(200, $cached);

// Back off after a recent attempt (e.g. HTB was down), so it isn't retried on every request
if (secondsSince($ATTEMPT) < $RETRY_AFTER) fail('HTB was contacted recently; try again shortly');
@touch($ATTEMPT);
// The lock is released automatically when the script exits

/* Fetch + validate */
$matrix = fetchJson("$BASE/matrix");
$badges = fetchJson("$BASE/badges/academy");

foreach (['total_xp', 'period_total_xp', 'weeks_active'] as $k) {
    if (!isCount($matrix[$k] ?? null)) fail("Invalid matrix field: $k");
}
if (!isCount($badges['total_awarded'] ?? null))                     fail('Invalid badge count');
if (!is_array($matrix['months'] ?? null) || !is_array($badges['categories'] ?? null)) {
    fail('The structure of the HTB data has changed');
}

$weeks = [];
foreach ($matrix['months'] as $month) {
    foreach ((array)($month['weeks'] ?? []) as $w) {
        if (($w['is_placeholder'] ?? true) !== false) continue;
        if (!isCount($w['xp_earned'] ?? null)) fail('Invalid weekly XP');
        $start = (string)($w['start_at'] ?? '');
        $end   = (string)($w['end_at']   ?? '');
        if (!preg_match('/^\d{4}-\d{2}-\d{2} /', $start) || !preg_match('/^\d{4}-\d{2}-\d{2} /', $end)) {
            fail('Invalid week dates');
        }
        // Keyed by start date to de-duplicate weeks that straddle two months
        $weeks[substr($start, 0, 10)] = ['start' => substr($start, 0, 10), 'end' => substr($end, 0, 10), 'xp' => $w['xp_earned']];
    }
}
ksort($weeks);
if (count($weeks) < 8) fail('Not enough weekly data received');

$earned = [];
foreach ($badges['categories'] as $cat) {
    foreach ((array)($cat['badges'] ?? []) as $b) {
        if (($b['awarded'] ?? false) !== true) continue;
        if (!is_string($b['name'] ?? null) || !is_string($b['description'] ?? null)) fail('Invalid badge');
        $earned[] = ['name' => $b['name'], 'description' => $b['description'], 'awardedAt' => $b['awarded_at'] ?? null];
    }
}
if (count($earned) !== $badges['total_awarded']) fail('Badge count mismatch');

/* Level, rank and weekly streak live under the account id, not the profile id.
   Optional: if this part breaks, XP and badges are still served. */
$level  = null;
$streak = null;
$profile   = fetchJson($BASE, true);
$accountId = $profile['data']['account_id'] ?? '';
if (is_string($accountId) && preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/', $accountId)) {
    $xp = fetchJson("$XP_BASE/$accountId", true);
    if ($xp && is_int($xp['level'] ?? null) && is_string($xp['levelTitle'] ?? null)
            && isCount($xp['levelExperiencePoints'] ?? null) && isCount($xp['experienceUntilNextLevel'] ?? null)) {
        $level = [
            'value'     => $xp['level'],
            'rank'      => $xp['levelTitle'],
            'xpInLevel' => $xp['levelExperiencePoints'],
            'xpToNext'  => $xp['experienceUntilNextLevel'],
        ];
    }
    $sd = $xp['streakData'] ?? null;
    if (is_array($sd) && isCount($sd['counter'] ?? null) && isCount($sd['currentExperiencePoints'] ?? null)
            && isCount($sd['requiredExperiencePoints'] ?? null)) {
        $streak = [
            'weeks'      => $sd['counter'],
            'xp'         => $sd['currentExperiencePoints'],
            'requiredXp' => $sd['requiredExperiencePoints'],
            'completed'  => ($sd['isCompleted'] ?? false) === true,
            'inDanger'   => ($sd['inDanger'] ?? false) === true,
            'expiresAt'  => is_string($sd['expiresAt'] ?? null) ? $sd['expiresAt'] : null,
        ];
    }
}

$body = json_encode([
    'schemaVersion' => 1,
    'profileId'     => $PROFILE_ID,
    'updatedAt'     => gmdate('c'),
    'totalXp'       => $matrix['total_xp'],
    'periodXp'      => $matrix['period_total_xp'],
    'weeksActive'   => $matrix['weeks_active'],
    'weeks'         => array_values($weeks),
    'badges'        => $earned,
    'level'         => $level,
    'streak'        => $streak,
], JSON_UNESCAPED_SLASHES);

writeCache($body);
respond(200, $body);
