<?php
/* =====================================================================
 *  SOMAR — Proxy de subida a Supabase Storage
 *
 *  POR QUÉ EXISTE: el navegador no puede subir directo a
 *  api.neura.com.py/storage/v1/* porque ese servicio no devuelve los
 *  headers CORS (el preflight OPTIONS se rechaza y fetch falla con
 *  "Failed to fetch"). CORS es una regla del NAVEGADOR: una llamada
 *  servidor→servidor no la tiene. Así que el panel sube a este archivo
 *  (mismo origen, sin CORS) y este lo reenvía a Storage.
 *
 *  SEGURIDAD: acá NO hay ningún secreto. Se reenvía el JWT del admin
 *  logueado, así que la policy "somar_media_admin_write" (is_admin())
 *  sigue decidiendo quién puede escribir. Sin sesión válida de admin,
 *  Storage rechaza. La SERVICE_ROLE_KEY nunca se usa ni se guarda acá.
 *
 *  Si algún día NEURA configura CORS en /storage/v1/*, este proxy puede
 *  eliminarse y volver a sb.storage.upload() directo (ver admin/js/storage.js).
 * ===================================================================== */

// --- Configuración (debe coincidir con js/config.js) ------------------
const SUPABASE_URL = 'https://api.neura.com.py';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc0MTAxNDYxLCJleHAiOjE5MzE3ODE0NjF9.7_wAph8IolPMXtgfpezSwS5XR62IdD__qhqCywLDp3Q';
const STORAGE_BUCKET = 'somar-media';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function fail($status, $msg) {
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    fail(405, 'Método no permitido.');
}

// --- Token del admin --------------------------------------------------
// Se manda en el body porque algunos Apache de hosting compartido filtran
// el header Authorization. Igual se acepta el header si viene.
$token = trim((string)($_POST['token'] ?? ''));
if ($token === '') {
    $hdr = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/^Bearer\s+(.+)$/i', $hdr, $m)) $token = trim($m[1]);
}
if ($token === '') fail(401, 'Falta la sesión de administrador. Cerrá sesión y volvé a entrar.');

$action = ($_POST['action'] ?? 'upload');

// =====================================================================
//  BORRAR archivos
// =====================================================================
if ($action === 'delete') {
    $paths = json_decode((string)($_POST['paths'] ?? '[]'), true);
    if (!is_array($paths) || !count($paths)) fail(400, 'No se indicaron archivos a borrar.');

    $clean = [];
    foreach ($paths as $p) {
        $p = safe_path((string)$p);
        if ($p !== null) $clean[] = $p;
    }
    if (!count($clean)) fail(400, 'Rutas inválidas.');

    $res = forward(
        'DELETE',
        SUPABASE_URL . '/storage/v1/object/' . STORAGE_BUCKET,
        json_encode(['prefixes' => $clean]),
        ['Content-Type: application/json'],
        $token
    );
    if ($res['status'] >= 400) fail($res['status'], upstream_error($res));
    echo json_encode(['ok' => true]);
    exit;
}

// =====================================================================
//  SUBIR un archivo
// =====================================================================
$path = safe_path((string)($_POST['path'] ?? ''));
if ($path === null) fail(400, 'Ruta de destino inválida.');

if (!isset($_FILES['file']) || !is_array($_FILES['file'])) fail(400, 'No llegó ningún archivo.');
$f = $_FILES['file'];

if (($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    // El caso típico acá es que el archivo superó post_max_size del hosting.
    fail(400, 'El archivo no se pudo recibir (código ' . $f['error'] . '). Probá con una imagen más liviana.');
}
if (!is_uploaded_file($f['tmp_name'])) fail(400, 'Archivo inválido.');
if (($f['size'] ?? 0) <= 0) fail(400, 'El archivo está vacío.');
if ($f['size'] > MAX_BYTES) fail(413, 'La imagen supera el máximo de 10 MB.');

// Verificar el tipo REAL del archivo, no el que declara el navegador.
// (finfo viene habilitado por defecto; getimagesize es el plan B.)
$mime = null;
if (class_exists('finfo')) {
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($f['tmp_name']);
} else {
    $info = @getimagesize($f['tmp_name']);
    if ($info && !empty($info['mime'])) $mime = $info['mime'];
}
if (!in_array($mime, ALLOWED_MIME, true)) {
    fail(415, 'Formato no permitido (' . $mime . '). Usá JPG, PNG, WebP, GIF o AVIF.');
}

$bytes = file_get_contents($f['tmp_name']);
if ($bytes === false) fail(500, 'No se pudo leer el archivo subido.');

$res = forward(
    'POST',
    SUPABASE_URL . '/storage/v1/object/' . STORAGE_BUCKET . '/' . $path,
    $bytes,
    ['Content-Type: ' . $mime, 'x-upsert: false', 'Cache-Control: max-age=3600'],
    $token
);
if ($res['status'] >= 400) fail($res['status'], upstream_error($res));

echo json_encode(['ok' => true, 'path' => $path]);
exit;

// =====================================================================
//  Helpers
// =====================================================================

/**
 * Normaliza y valida una ruta dentro del bucket.
 * Devuelve la ruta limpia, o null si es inválida.
 * Bloquea traversal ("..") y caracteres raros.
 */
function safe_path($p) {
    $p = trim($p);
    $p = ltrim($p, '/');
    if ($p === '' || strlen($p) > 300) return null;
    if (strpos($p, '..') !== false) return null;
    if (!preg_match('#^[A-Za-z0-9][A-Za-z0-9._/-]*$#', $p)) return null;
    if (substr($p, -1) === '/') return null;
    return $p;
}

/** Reenvía la petición a Supabase Storage con el JWT del admin. */
function forward($method, $url, $body, $headers, $token) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_POSTFIELDS     => $body,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 60,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_HTTPHEADER     => array_merge($headers, [
            'Authorization: Bearer ' . $token,
            'apikey: ' . SUPABASE_ANON_KEY,
        ]),
    ]);
    $out = curl_exec($ch);
    if ($out === false) {
        $err = curl_error($ch);
        curl_close($ch);
        fail(502, 'No se pudo contactar al servidor de Storage: ' . $err);
    }
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['status' => $status, 'body' => (string)$out];
}

/** Extrae un mensaje legible del error que devuelve Storage. */
function upstream_error($res) {
    $j = json_decode($res['body'], true);
    if (is_array($j)) {
        foreach (['message', 'error', 'msg'] as $k) {
            if (!empty($j[$k]) && is_string($j[$k])) return $j[$k];
        }
    }
    if ($res['status'] === 403 || $res['status'] === 401) {
        return 'Storage rechazó la subida (permisos). Verificá que tu usuario esté en admin_users con is_active = true.';
    }
    return 'Storage devolvió el código ' . $res['status'] . '.';
}
