<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/helpers.php';

header('Content-Type: application/json; charset=utf-8');

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

switch ($action) {
    case 'list':
        requireLogin();
        listNotifications();
        break;
    case 'read':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireCsrf();
        requireLogin();
        markRead();
        break;
    case 'read-all':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireCsrf();
        requireLogin();
        markAllRead();
        break;
    case 'unread-count':
        requireLogin();
        unreadCount();
        break;
    default:
        jsonResponse(['error' => 'Action not found'], 404);
}

function listNotifications(): void
{
    $user = getCurrentUser();
    $db = Database::getInstance();
    $page = max(1, (int)($_GET['page'] ?? 1));
    $perPage = 30;

    $stmt = $db->prepare("SELECT COUNT(*) FROM notifications WHERE user_id = ?");
    $stmt->execute([$user['id']]);
    $total = (int)$stmt->fetchColumn();

    $offset = ($page - 1) * $perPage;
    $stmt = $db->prepare("
        SELECT n.*, g.name AS group_name, g.slug AS group_slug
        FROM notifications n
        LEFT JOIN `groups` g ON g.id = n.group_id
        WHERE n.user_id = ?
        ORDER BY n.created_at DESC
        LIMIT ? OFFSET ?
    ");
    $stmt->execute([$user['id'], $perPage, $offset]);
    $notifs = $stmt->fetchAll();

    foreach ($notifs as &$n) {
        $n['time_ago'] = timeAgo($n['created_at']);
    }

    jsonResponse([
        'notifications' => $notifs,
        'pagination' => paginate($total, $page, $perPage),
    ]);
}

function markRead(): void
{
    $user = getCurrentUser();
    $data = getInputJSON();
    $id = (int)($_GET['id'] ?? $data['id'] ?? 0);
    if ($id <= 0) jsonResponse(['error' => 'ID invalide'], 400);

    $db = Database::getInstance();
    $stmt = $db->prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?");
    $stmt->execute([$id, $user['id']]);

    jsonResponse(['success' => true]);
}

function markAllRead(): void
{
    $user = getCurrentUser();
    $db = Database::getInstance();
    $stmt = $db->prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0");
    $stmt->execute([$user['id']]);

    jsonResponse(['success' => true, 'updated' => $stmt->rowCount()]);
}

function unreadCount(): void
{
    $user = getCurrentUser();
    $db = Database::getInstance();
    $stmt = $db->prepare("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0");
    $stmt->execute([$user['id']]);

    jsonResponse(['unread_count' => (int)$stmt->fetchColumn()]);
}
