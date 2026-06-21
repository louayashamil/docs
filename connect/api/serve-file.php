<?php
session_start();

// Check authentication
if (!isset($_SESSION['user_id'])) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Forbidden: authentication required']);
    exit;
}

// Get and sanitize path
$path = isset($_GET['path']) ? $_GET['path'] : '';
$path = str_replace('..', '', $path);
$path = ltrim($path, '/');

// Ensure path stays within uploads directory
$uploadsDir = realpath(__DIR__ . '/../uploads');
$fullPath = realpath($uploadsDir . '/' . $path);

if (!$fullPath || strpos($fullPath, $uploadsDir) !== 0) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'File not found']);
    exit;
}

// Check file exists
if (!is_file($fullPath)) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'File not found']);
    exit;
}

// Determine MIME type
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mimeType = $finfo->file($fullPath);
if (!$mimeType) {
    $mimeType = mime_content_type($fullPath);
}
if (!$mimeType) {
    $mimeType = 'application/octet-stream';
}

// Serve the file
header('Content-Type: ' . $mimeType);
header('Content-Length: ' . filesize($fullPath));
header('Content-Disposition: inline; filename="' . basename($fullPath) . '"');

readfile($fullPath);
exit;
