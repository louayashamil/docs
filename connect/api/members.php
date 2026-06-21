<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/helpers.php';

header('Content-Type: application/json; charset=utf-8');

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

switch ($action) {
    case 'list':
        if ($method !== 'GET') jsonResponse(['error' => 'Method not allowed'], 405);
        listMembers();
        break;
    case 'get':
        if ($method !== 'GET') jsonResponse(['error' => 'Method not allowed'], 405);
        getMember();
        break;
    case 'update':
        if ($method !== 'PUT' && $method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        updateMember();
        break;
    case 'photo':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireCsrf();
        uploadPhoto();
        break;
    default:
        jsonResponse(['error' => 'Action not found'], 404);
}

function listMembers(): void
{
    requireLogin();
    $db = Database::getInstance();
    $page = max(1, (int)($_GET['page'] ?? 1));
    $perPage = 20;
    $search = trim($_GET['search'] ?? '');
    $city = trim($_GET['city'] ?? '');

    $where = "WHERE u.role NOT IN ('pending','suspended') AND u.status = 'active'";
    $params = [];

    if ($search !== '') {
        $where .= " AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR u.institution LIKE ?)";
        $like = "%{$search}%";
        $params = array_merge($params, [$like, $like, $like, $like]);
    }
    if ($city !== '') {
        $where .= " AND u.city = ?";
        $params[] = $city;
    }

    // Count
    $stmt = $db->prepare("SELECT COUNT(*) FROM users u {$where}");
    $stmt->execute($params);
    $total = (int)$stmt->fetchColumn();

    $offset = ($page - 1) * $perPage;
    $stmt = $db->prepare("SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.city, u.institution, u.role, u.profile_photo, u.created_at FROM users u {$where} ORDER BY u.last_name ASC LIMIT ? OFFSET ?");
    $params[] = $perPage;
    $params[] = $offset;
    $stmt->execute($params);

    jsonResponse([
        'members' => $stmt->fetchAll(),
        'pagination' => paginate($total, $page, $perPage),
    ]);
}

function getMember(): void
{
    requireLogin();
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) jsonResponse(['error' => 'ID invalide'], 400);

    $db = Database::getInstance();
    $stmt = $db->prepare("SELECT id, first_name, last_name, email, phone, city, institution, role, profile_photo, created_at FROM users WHERE id = ? AND status = 'active'");
    $stmt->execute([$id]);
    $member = $stmt->fetch();
    if (!$member) jsonResponse(['error' => 'Membre non trouvé'], 404);

    // Groups in common
    $user = getCurrentUser();
    $stmt = $db->prepare("
        SELECT g.id, g.name, g.slug
        FROM `groups` g
        JOIN group_members gm1 ON gm1.group_id = g.id AND gm1.user_id = ?
        JOIN group_members gm2 ON gm2.group_id = g.id AND gm2.user_id = ?
    ");
    $stmt->execute([$user['id'], $id]);
    $member['common_groups'] = $stmt->fetchAll();

    jsonResponse(['member' => $member]);
}

function updateMember(): void
{
    requireLogin();
    $user = getCurrentUser();

    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (strpos($contentType, 'multipart/form-data') !== false || strpos($contentType, 'application/x-www-form-urlencoded') !== false) {
        $data = $_POST;
    } else {
        $data = getInputJSON();
    }

    $id = (int)($_GET['id'] ?? $data['id'] ?? $user['id']);

    if ($id <= 0) jsonResponse(['error' => 'ID invalide'], 400);
    if ((int)$user['id'] !== $id && !in_array($user['role'], ['super_admin', 'admin'])) {
        jsonResponse(['error' => 'Non autorisé'], 403);
    }

    $db = Database::getInstance();
    $allowed = ['first_name', 'last_name', 'email', 'phone', 'city', 'institution'];
    $fields = [];
    $params = [];

    foreach ($allowed as $f) {
        if (isset($data[$f])) {
            $fields[] = "`{$f}` = ?";
            $params[] = trim($data[$f]);
        }
    }

    if (empty($fields)) jsonResponse(['error' => 'Rien à mettre à jour'], 400);
    $params[] = $id;

    $stmt = $db->prepare("UPDATE users SET " . implode(', ', $fields) . " WHERE id = ?");
    $stmt->execute($params);

    // Update session if own profile
    if ((int)$user['id'] === $id) {
        if (isset($data['first_name'])) $_SESSION['user_first_name'] = $data['first_name'];
        if (isset($data['last_name'])) $_SESSION['user_last_name'] = $data['last_name'];
    }

    jsonResponse(['success' => true]);
}

function uploadPhoto(): void
{
    requireLogin();
    $user = getCurrentUser();
    $id = (int)($_GET['id'] ?? $_POST['id'] ?? 0);

    if ($id <= 0) jsonResponse(['error' => 'ID invalide'], 400);
    if ((int)$user['id'] !== $id && !in_array($user['role'], ['super_admin', 'admin'])) {
        jsonResponse(['error' => 'Non autorisé'], 403);
    }

    if (empty($_FILES['photo'])) {
        jsonResponse(['error' => 'Aucune photo envoyée'], 400);
    }

    $file = $_FILES['photo'];
    $mime = mime_content_type($file['tmp_name']);
    if (!in_array($mime, ALLOWED_IMAGE_TYPES)) {
        jsonResponse(['error' => 'Type de fichier non autorisé'], 400);
    }
    if ($file['size'] > UPLOAD_MAX_IMAGE) {
        jsonResponse(['error' => 'Photo trop volumineuse'], 400);
    }

    $uploadDir = __DIR__ . '/../uploads/profiles';
    if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $safeName = 'profile_' . $id . '_' . bin2hex(random_bytes(8)) . '.jpg';
    $destPath = $uploadDir . '/' . $safeName;
    $relativePath = 'uploads/profiles/' . $safeName;

    if (!compressImage($file['tmp_name'], $destPath, 80)) {
        if (!move_uploaded_file($file['tmp_name'], $destPath)) {
            jsonResponse(['error' => 'Erreur lors de l\'enregistrement'], 500);
        }
    }

    // Delete old photo
    $db = Database::getInstance();
    $stmt = $db->prepare("SELECT profile_photo FROM users WHERE id = ?");
    $stmt->execute([$id]);
    $old = $stmt->fetchColumn();
    if ($old && file_exists(__DIR__ . '/../' . $old)) {
        @unlink(__DIR__ . '/../' . $old);
    }

    $stmt = $db->prepare("UPDATE users SET profile_photo = ? WHERE id = ?");
    $stmt->execute([$relativePath, $id]);

    if ((int)$user['id'] === $id) {
        $_SESSION['user_photo'] = $relativePath;
    }

    jsonResponse(['success' => true, 'profile_photo' => $relativePath]);
}
