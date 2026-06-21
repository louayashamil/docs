<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/helpers.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

requireLogin();
requireCsrf();

if (empty($_FILES['file'])) {
    jsonResponse(['error' => 'Aucun fichier envoyé'], 400);
}

$file = $_FILES['file'];
if ($file['error'] !== UPLOAD_ERR_OK) {
    $errors = [
        UPLOAD_ERR_INI_SIZE   => 'Le fichier dépasse la taille maximale du serveur',
        UPLOAD_ERR_FORM_SIZE  => 'Le fichier dépasse la taille maximale du formulaire',
        UPLOAD_ERR_PARTIAL    => 'Le fichier n\'a été que partiellement téléchargé',
        UPLOAD_ERR_NO_FILE    => 'Aucun fichier n\'a été téléchargé',
        UPLOAD_ERR_NO_TMP_DIR => 'Dossier temporaire manquant',
        UPLOAD_ERR_CANT_WRITE => 'Échec de l\'écriture du fichier sur le disque',
    ];
    jsonResponse(['error' => $errors[$file['error']] ?? 'Erreur de téléchargement'], 400);
}

$mime = mime_content_type($file['tmp_name']);
$fileType = $_POST['type'] ?? 'image'; // image, document, video

// Validate type
if (!isAllowedFile($mime, $fileType)) {
    jsonResponse(['error' => 'Type de fichier non autorisé'], 400);
}

// Validate size
$maxSizes = ['image' => UPLOAD_MAX_IMAGE, 'document' => UPLOAD_MAX_DOC, 'video' => UPLOAD_MAX_VIDEO];
$maxSize = $maxSizes[$fileType] ?? UPLOAD_MAX_IMAGE;
if ($file['size'] > $maxSize) {
    jsonResponse(['error' => 'Fichier trop volumineux. Maximum: ' . formatFileSize($maxSize)], 400);
}

// Determine upload directory
$dirs = ['image' => 'images', 'document' => 'documents', 'video' => 'videos'];
$subDir = $dirs[$fileType] ?? 'images';
$uploadDir = __DIR__ . '/../uploads/' . $subDir . '/' . date('Y/m');

if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

// Generate unique filename
$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
$safeName = bin2hex(random_bytes(16)) . '.' . $ext;
$destPath = $uploadDir . '/' . $safeName;
$relativePath = 'uploads/' . $subDir . '/' . date('Y/m') . '/' . $safeName;

$thumbnailPath = null;

if ($fileType === 'image') {
    // Compress image
    if (!compressImage($file['tmp_name'], $destPath, 75)) {
        // Fallback: move without compression
        if (!move_uploaded_file($file['tmp_name'], $destPath)) {
            jsonResponse(['error' => 'Erreur lors de l\'enregistrement'], 500);
        }
    }

    // Create thumbnail
    $thumbDir = __DIR__ . '/../uploads/thumbnails/' . date('Y/m');
    if (!is_dir($thumbDir)) {
        mkdir($thumbDir, 0755, true);
    }
    $thumbName = 'thumb_' . $safeName;
    $thumbDest = $thumbDir . '/' . $thumbName;

    $img = @imagecreatefromjpeg($destPath) ?: @imagecreatefrompng($file['tmp_name']) ?: @imagecreatefromgif($file['tmp_name']) ?: @imagecreatefromwebp($file['tmp_name']);
    if ($img) {
        $w = imagesx($img);
        $h = imagesy($img);
        $thumbSize = 300;
        $ratio = min($thumbSize / $w, $thumbSize / $h);
        $newW = (int)($w * $ratio);
        $newH = (int)($h * $ratio);
        $thumb = imagecreatetruecolor($newW, $newH);
        imagecopyresampled($thumb, $img, 0, 0, 0, 0, $newW, $newH, $w, $h);
        imagejpeg($thumb, $thumbDest, 60);
        imagedestroy($img);
        imagedestroy($thumb);
        $thumbnailPath = 'uploads/thumbnails/' . date('Y/m') . '/' . $thumbName;
    }
} else {
    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        jsonResponse(['error' => 'Erreur lors de l\'enregistrement'], 500);
    }
}

jsonResponse([
    'success'        => true,
    'file_path'      => $relativePath,
    'file_name'      => $file['name'],
    'file_size'      => $file['size'],
    'mime_type'       => $mime,
    'file_type'       => $fileType,
    'thumbnail_path' => $thumbnailPath,
], 201);
