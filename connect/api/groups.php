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
        listGroups();
        break;
    case 'get':
        if ($method !== 'GET') jsonResponse(['error' => 'Method not allowed'], 405);
        getGroup();
        break;
    case 'create':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireCsrf();
        createGroup();
        break;
    case 'update':
        if ($method !== 'PUT' && $method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireCsrf();
        updateGroup();
        break;
    case 'delete':
        if ($method !== 'DELETE' && $method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireCsrf();
        deleteGroup();
        break;
    default:
        jsonResponse(['error' => 'Action not found'], 404);
}

function listGroups(): void
{
    requireLogin();
    $user = getCurrentUser();
    $db = Database::getInstance();

    $stmt = $db->prepare("
        SELECT g.*, gm.role_in_group, gm.notifications_enabled, gm.muted_until, gm.last_read_message_id,
            (SELECT COUNT(*) FROM messages m WHERE m.group_id = g.id AND m.status = 'active' AND m.id > COALESCE(gm.last_read_message_id, 0)) AS unread_count,
            (SELECT m2.content FROM messages m2 WHERE m2.group_id = g.id AND m2.status = 'active' ORDER BY m2.id DESC LIMIT 1) AS last_message,
            (SELECT m3.created_at FROM messages m3 WHERE m3.group_id = g.id AND m3.status = 'active' ORDER BY m3.id DESC LIMIT 1) AS last_message_at,
            (SELECT CONCAT(u.first_name, ' ', u.last_name) FROM messages m4 JOIN users u ON u.id = m4.user_id WHERE m4.group_id = g.id AND m4.status = 'active' ORDER BY m4.id DESC LIMIT 1) AS last_message_author,
            (SELECT COUNT(*) FROM group_members gm2 WHERE gm2.group_id = g.id) AS member_count
        FROM `groups` g
        JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?
        ORDER BY g.sort_order ASC, g.name ASC
    ");
    $stmt->execute([$user['id']]);
    $groups = $stmt->fetchAll();

    foreach ($groups as &$g) {
        if ($g['last_message_at']) {
            $g['last_message_ago'] = timeAgo($g['last_message_at']);
        }
    }

    jsonResponse(['groups' => $groups]);
}

function getGroup(): void
{
    requireLogin();
    $user = getCurrentUser();
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) jsonResponse(['error' => 'ID invalide'], 400);

    $db = Database::getInstance();

    // Check membership
    $stmt = $db->prepare("SELECT * FROM group_members WHERE group_id = ? AND user_id = ?");
    $stmt->execute([$id, $user['id']]);
    if (!$stmt->fetch()) {
        jsonResponse(['error' => 'Accès non autorisé'], 403);
    }

    $stmt = $db->prepare("SELECT * FROM `groups` WHERE id = ?");
    $stmt->execute([$id]);
    $group = $stmt->fetch();
    if (!$group) jsonResponse(['error' => 'Groupe non trouvé'], 404);

    // Members
    $stmt = $db->prepare("
        SELECT u.id, u.first_name, u.last_name, u.profile_photo, u.city, u.institution, gm.role_in_group, gm.joined_at
        FROM group_members gm
        JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = ?
        ORDER BY gm.role_in_group ASC, u.last_name ASC
    ");
    $stmt->execute([$id]);
    $group['members'] = $stmt->fetchAll();

    jsonResponse(['group' => $group]);
}

function createGroup(): void
{
    requireRole(['super_admin', 'admin']);
    $user = getCurrentUser();
    $data = getInputJSON();

    $name = trim($data['name'] ?? '');
    if (empty($name)) jsonResponse(['error' => 'Nom du groupe requis'], 400);

    $slug = preg_replace('/[^a-z0-9]+/', '-', strtolower(transliterator_transliterate('Any-Latin; Latin-ASCII', $name)));
    $slug = trim($slug, '-');

    $db = Database::getInstance();

    // Check slug uniqueness
    $stmt = $db->prepare("SELECT id FROM `groups` WHERE slug = ?");
    $stmt->execute([$slug]);
    if ($stmt->fetch()) {
        $slug .= '-' . time();
    }

    $stmt = $db->prepare("INSERT INTO `groups` (name, slug, description, type, icon, is_private, comments_allowed, created_by, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $name,
        $slug,
        trim($data['description'] ?? ''),
        $data['type'] ?? 'general',
        $data['icon'] ?? null,
        $data['is_private'] ?? 0,
        $data['comments_allowed'] ?? 1,
        $user['id'],
        $data['sort_order'] ?? 0,
    ]);

    $groupId = $db->lastInsertId();

    // Add creator as admin
    $stmt = $db->prepare("INSERT INTO group_members (group_id, user_id, role_in_group) VALUES (?, ?, 'admin')");
    $stmt->execute([$groupId, $user['id']]);

    jsonResponse(['success' => true, 'group_id' => $groupId], 201);
}

function updateGroup(): void
{
    requireRole(['super_admin', 'admin']);
    $data = getInputJSON();
    $id = (int)($_GET['id'] ?? $data['id'] ?? 0);
    if ($id <= 0) jsonResponse(['error' => 'ID invalide'], 400);

    $db = Database::getInstance();
    $fields = [];
    $params = [];

    foreach (['name', 'description', 'type', 'icon', 'is_private', 'comments_allowed', 'sort_order'] as $f) {
        if (isset($data[$f])) {
            $fields[] = "`{$f}` = ?";
            $params[] = $data[$f];
        }
    }

    if (empty($fields)) jsonResponse(['error' => 'Rien à mettre à jour'], 400);
    $params[] = $id;

    $stmt = $db->prepare("UPDATE `groups` SET " . implode(', ', $fields) . " WHERE id = ?");
    $stmt->execute($params);

    jsonResponse(['success' => true]);
}

function deleteGroup(): void
{
    requireRole(['super_admin', 'admin']);
    $data = getInputJSON();
    $id = (int)($_GET['id'] ?? $data['id'] ?? 0);
    if ($id <= 0) jsonResponse(['error' => 'ID invalide'], 400);

    $db = Database::getInstance();
    $stmt = $db->prepare("DELETE FROM `groups` WHERE id = ?");
    $stmt->execute([$id]);

    jsonResponse(['success' => true]);
}
