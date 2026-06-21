<?php
require_once __DIR__ . '/config.php';

function sanitize(string $str): string
{
    return htmlspecialchars($str, ENT_QUOTES | ENT_HTML5, 'UTF-8');
}

function timeAgo(string $datetime): string
{
    $now  = new DateTime();
    $past = new DateTime($datetime);
    $diff = $now->diff($past);

    if ($diff->y > 0) return $diff->y === 1 ? 'il y a 1 an' : "il y a {$diff->y} ans";
    if ($diff->m > 0) return $diff->m === 1 ? 'il y a 1 mois' : "il y a {$diff->m} mois";
    if ($diff->d >= 7) {
        $weeks = (int)floor($diff->d / 7);
        return $weeks === 1 ? 'il y a 1 semaine' : "il y a {$weeks} semaines";
    }
    if ($diff->d > 0) return $diff->d === 1 ? 'il y a 1 jour' : "il y a {$diff->d} jours";
    if ($diff->h > 0) return $diff->h === 1 ? 'il y a 1 heure' : "il y a {$diff->h} heures";
    if ($diff->i > 0) return $diff->i === 1 ? 'il y a 1 minute' : "il y a {$diff->i} minutes";
    return "à l'instant";
}

function formatFileSize(int $bytes): string
{
    if ($bytes >= 1073741824) return number_format($bytes / 1073741824, 2) . ' Go';
    if ($bytes >= 1048576) return number_format($bytes / 1048576, 2) . ' Mo';
    if ($bytes >= 1024) return number_format($bytes / 1024, 2) . ' Ko';
    return $bytes . ' o';
}

function generateAvatar(string $name): string
{
    $parts = explode(' ', trim($name));
    $initials = '';
    foreach (array_slice($parts, 0, 2) as $p) {
        $initials .= mb_strtoupper(mb_substr($p, 0, 1));
    }
    $colors = ['#4A90D9','#50C878','#E74C3C','#F39C12','#9B59B6','#1ABC9C','#E67E22','#3498DB'];
    $colorIndex = crc32($name) % count($colors);
    $bg = $colors[abs($colorIndex)];

    $svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">'
         . '<rect width="100" height="100" fill="' . $bg . '"/>'
         . '<text x="50" y="55" font-family="Arial,sans-serif" font-size="40" fill="white" '
         . 'text-anchor="middle" dominant-baseline="middle">' . sanitize($initials) . '</text>'
         . '</svg>';

    return 'data:image/svg+xml;base64,' . base64_encode($svg);
}

function compressImage(string $source, string $destination, int $quality = 75): bool
{
    $info = getimagesize($source);
    if (!$info) return false;

    switch ($info['mime']) {
        case 'image/jpeg':
            $img = imagecreatefromjpeg($source);
            break;
        case 'image/png':
            $img = imagecreatefrompng($source);
            break;
        case 'image/gif':
            $img = imagecreatefromgif($source);
            break;
        case 'image/webp':
            $img = imagecreatefromwebp($source);
            break;
        default:
            return false;
    }

    if (!$img) return false;

    // Resize if too large (max 2000px on longest side)
    $w = imagesx($img);
    $h = imagesy($img);
    $maxDim = 2000;
    if ($w > $maxDim || $h > $maxDim) {
        $ratio = min($maxDim / $w, $maxDim / $h);
        $newW = (int)($w * $ratio);
        $newH = (int)($h * $ratio);
        $resized = imagecreatetruecolor($newW, $newH);
        imagecopyresampled($resized, $img, 0, 0, 0, 0, $newW, $newH, $w, $h);
        imagedestroy($img);
        $img = $resized;
    }

    $result = imagejpeg($img, $destination, $quality);
    imagedestroy($img);
    return $result;
}

function isAllowedFile(string $mime, string $type): bool
{
    switch ($type) {
        case 'image': return in_array($mime, ALLOWED_IMAGE_TYPES, true);
        case 'document': return in_array($mime, ALLOWED_DOC_TYPES, true);
        case 'video': return in_array($mime, ALLOWED_VIDEO_TYPES, true);
        default: return false;
    }
}

function jsonResponse($data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function getInputJSON(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function paginate(int $total, int $page, int $perPage): array
{
    return [
        'total'       => $total,
        'page'        => $page,
        'per_page'    => $perPage,
        'total_pages' => (int)ceil($total / $perPage),
    ];
}
