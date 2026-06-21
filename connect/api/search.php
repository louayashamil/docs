<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/helpers.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

requireLogin();

$user = getCurrentUser();
$query = trim($_GET['q'] ?? '');
$type = $_GET['type'] ?? 'all'; // all, messages, files, members, events
$groupId = (int)($_GET['group_id'] ?? 0);
$authorId = (int)($_GET['author_id'] ?? 0);
$dateFrom = $_GET['from'] ?? '';
$dateTo = $_GET['to'] ?? '';
$page = max(1, (int)($_GET['page'] ?? 1));
$perPage = 20;

if (strlen($query) < 2) {
    jsonResponse(['error' => 'La recherche doit contenir au moins 2 caractères'], 400);
}

$db = Database::getInstance();
$results = [];
$like = "%{$query}%";

// Search messages
if ($type === 'all' || $type === 'messages') {
    $sql = "
        SELECT m.id, m.content, m.type AS message_type, m.created_at,
            CONCAT(u.first_name, ' ', u.last_name) AS author,
            u.profile_photo AS author_photo,
            g.name AS group_name, g.id AS group_id, g.slug AS group_slug,
            'message' AS result_type
        FROM messages m
        JOIN `groups` g ON g.id = m.group_id
        JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?
        LEFT JOIN users u ON u.id = m.user_id
        WHERE m.status = 'active' AND m.content LIKE ?
    ";
    $params = [$user['id'], $like];

    if ($groupId > 0) {
        $sql .= " AND m.group_id = ?";
        $params[] = $groupId;
    }
    if ($authorId > 0) {
        $sql .= " AND m.user_id = ?";
        $params[] = $authorId;
    }
    if ($dateFrom) {
        $sql .= " AND m.created_at >= ?";
        $params[] = $dateFrom . ' 00:00:00';
    }
    if ($dateTo) {
        $sql .= " AND m.created_at <= ?";
        $params[] = $dateTo . ' 23:59:59';
    }

    $sql .= " ORDER BY m.created_at DESC LIMIT ?";
    $params[] = $perPage;

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $messages = $stmt->fetchAll();
    foreach ($messages as &$m) {
        $m['time_ago'] = timeAgo($m['created_at']);
    }
    $results['messages'] = $messages;
}

// Search files/attachments
if ($type === 'all' || $type === 'files') {
    $sql = "
        SELECT a.id, a.file_name, a.file_type, a.mime_type, a.file_size, a.file_path, a.created_at,
            g.name AS group_name, g.id AS group_id,
            CONCAT(u.first_name, ' ', u.last_name) AS author,
            'file' AS result_type
        FROM attachments a
        JOIN messages m ON m.id = a.message_id AND m.status = 'active'
        JOIN `groups` g ON g.id = m.group_id
        JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?
        LEFT JOIN users u ON u.id = m.user_id
        WHERE (a.file_name LIKE ? OR a.caption LIKE ?)
    ";
    $params = [$user['id'], $like, $like];

    if ($groupId > 0) {
        $sql .= " AND m.group_id = ?";
        $params[] = $groupId;
    }

    $sql .= " ORDER BY a.created_at DESC LIMIT ?";
    $params[] = $perPage;

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $files = $stmt->fetchAll();
    foreach ($files as &$f) {
        $f['file_size_formatted'] = formatFileSize((int)$f['file_size']);
        $f['time_ago'] = timeAgo($f['created_at']);
    }
    $results['files'] = $files;
}

// Search members
if ($type === 'all' || $type === 'members') {
    $stmt = $db->prepare("
        SELECT u.id, u.first_name, u.last_name, u.city, u.institution, u.profile_photo,
            'member' AS result_type
        FROM users u
        WHERE u.status = 'active' AND u.role NOT IN ('pending','suspended')
          AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.city LIKE ? OR u.institution LIKE ?)
        ORDER BY u.last_name ASC
        LIMIT ?
    ");
    $stmt->execute([$like, $like, $like, $like, $perPage]);
    $results['members'] = $stmt->fetchAll();
}

// Search events
if ($type === 'all' || $type === 'events') {
    $sql = "
        SELECT e.id, e.title, e.description, e.event_date, e.location,
            'event' AS result_type
        FROM events e
        WHERE (e.title LIKE ? OR e.description LIKE ? OR e.location LIKE ?)
    ";
    $params = [$like, $like, $like];

    if ($dateFrom) {
        $sql .= " AND e.event_date >= ?";
        $params[] = $dateFrom;
    }
    if ($dateTo) {
        $sql .= " AND e.event_date <= ?";
        $params[] = $dateTo;
    }

    $sql .= " ORDER BY e.event_date DESC LIMIT ?";
    $params[] = $perPage;

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $results['events'] = $stmt->fetchAll();
}

jsonResponse(['query' => $query, 'results' => $results]);
