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
        listMessages();
        break;
    case 'create':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireCsrf();
        createMessage();
        break;
    case 'update':
        if ($method !== 'PUT' && $method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireCsrf();
        updateMessage();
        break;
    case 'delete':
        if ($method !== 'DELETE' && $method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireCsrf();
        deleteMessage();
        break;
    case 'report':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireCsrf();
        reportMessage();
        break;
    case 'pin':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireCsrf();
        pinMessage();
        break;
    case 'read':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireCsrf();
        markRead();
        break;
    case 'info':
        if ($method !== 'GET') jsonResponse(['error' => 'Method not allowed'], 405);
        messageInfo();
        break;
    default:
        jsonResponse(['error' => 'Action not found'], 404);
}

function listMessages(): void
{
    requireLogin();
    $user = getCurrentUser();
    $groupId = (int)($_GET['group_id'] ?? 0);
    $before = (int)($_GET['before'] ?? 0);
    $limit = 50;

    if ($groupId <= 0) jsonResponse(['error' => 'group_id requis'], 400);

    $db = Database::getInstance();

    // Check membership
    $stmt = $db->prepare("SELECT id FROM group_members WHERE group_id = ? AND user_id = ?");
    $stmt->execute([$groupId, $user['id']]);
    if (!$stmt->fetch()) jsonResponse(['error' => 'Accès non autorisé'], 403);

    $sql = "
        SELECT m.*, u.first_name, u.last_name, u.profile_photo,
            (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', a.id, 'file_name', a.file_name, 'file_path', a.file_path, 'file_type', a.file_type, 'mime_type', a.mime_type, 'file_size', a.file_size, 'thumbnail_path', a.thumbnail_path, 'caption', a.caption))
             FROM attachments a WHERE a.message_id = m.id) AS attachments,
            pm.content AS parent_content,
            pu.first_name AS parent_author_first, pu.last_name AS parent_author_last
        FROM messages m
        LEFT JOIN users u ON u.id = m.user_id
        LEFT JOIN messages pm ON pm.id = m.parent_message_id
        LEFT JOIN users pu ON pu.id = pm.user_id
        WHERE m.group_id = ? AND m.status != 'deleted'
    ";
    $params = [$groupId];

    if ($before > 0) {
        $sql .= " AND m.id < ?";
        $params[] = $before;
    }

    $sql .= " ORDER BY m.id DESC LIMIT ?";
    $params[] = $limit;

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $messages = $stmt->fetchAll();

    foreach ($messages as &$msg) {
        if ($msg['attachments']) {
            $msg['attachments'] = json_decode($msg['attachments'], true);
        } else {
            $msg['attachments'] = [];
        }
        $msg['time_ago'] = timeAgo($msg['created_at']);
        $msg['is_own'] = ((int)$msg['user_id'] === (int)$user['id']);
    }

    $hasMore = count($messages) === $limit;
    jsonResponse(['messages' => array_reverse($messages), 'has_more' => $hasMore]);
}

function createMessage(): void
{
    requireLogin();
    $user = getCurrentUser();
    $data = getInputJSON();

    $groupId = (int)($data['group_id'] ?? 0);
    $content = trim($data['content'] ?? '');
    $type = $data['type'] ?? 'text';
    $parentId = !empty($data['parent_message_id']) ? (int)$data['parent_message_id'] : null;

    if ($groupId <= 0) jsonResponse(['error' => 'group_id requis'], 400);
    if (empty($content) && $type === 'text') jsonResponse(['error' => 'Contenu requis'], 400);

    $db = Database::getInstance();

    // Check membership and mute
    $stmt = $db->prepare("SELECT * FROM group_members WHERE group_id = ? AND user_id = ?");
    $stmt->execute([$groupId, $user['id']]);
    $membership = $stmt->fetch();
    if (!$membership) jsonResponse(['error' => 'Accès non autorisé'], 403);

    if ($membership['muted_until'] && strtotime($membership['muted_until']) > time()) {
        jsonResponse(['error' => 'Vous êtes en sourdine dans ce groupe'], 403);
    }

    // Check comments allowed
    $stmt = $db->prepare("SELECT comments_allowed FROM `groups` WHERE id = ?");
    $stmt->execute([$groupId]);
    $group = $stmt->fetch();
    if ($group && !$group['comments_allowed'] && !in_array($user['role'], ['super_admin', 'admin'])) {
        jsonResponse(['error' => 'Les commentaires ne sont pas autorisés dans ce groupe'], 403);
    }

    $stmt = $db->prepare("INSERT INTO messages (group_id, user_id, parent_message_id, content, type, status) VALUES (?, ?, ?, ?, ?, 'active')");
    $stmt->execute([$groupId, $user['id'], $parentId, $content, $type]);
    $messageId = (int)$db->lastInsertId();

    // Handle attachment if provided
    if (!empty($data['attachment_path'])) {
        $stmt = $db->prepare("INSERT INTO attachments (message_id, file_name, file_path, file_type, mime_type, file_size, thumbnail_path, caption) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $messageId,
            $data['attachment_name'] ?? basename($data['attachment_path']),
            $data['attachment_path'],
            $data['attachment_type'] ?? 'file',
            $data['attachment_mime'] ?? 'application/octet-stream',
            $data['attachment_size'] ?? 0,
            $data['attachment_thumbnail'] ?? null,
            $data['attachment_caption'] ?? null,
        ]);
    }

    // Create notifications for group members
    $stmt = $db->prepare("
        INSERT INTO notifications (user_id, group_id, message_id, type, title, body)
        SELECT gm.user_id, ?, ?, 'message', ?, ?
        FROM group_members gm
        WHERE gm.group_id = ? AND gm.user_id != ? AND gm.notifications_enabled = 1
          AND (gm.muted_until IS NULL OR gm.muted_until < NOW())
    ");
    $authorName = $user['first_name'] . ' ' . $user['last_name'];
    $stmt->execute([$groupId, $messageId, "Nouveau message de {$authorName}", mb_substr($content, 0, 100), $groupId, $user['id']]);

    jsonResponse(['success' => true, 'message_id' => $messageId], 201);
}

function updateMessage(): void
{
    requireLogin();
    $user = getCurrentUser();
    $data = getInputJSON();
    $id = (int)($_GET['id'] ?? $data['id'] ?? 0);
    $content = trim($data['content'] ?? '');

    if ($id <= 0 || empty($content)) jsonResponse(['error' => 'ID et contenu requis'], 400);

    $db = Database::getInstance();
    $stmt = $db->prepare("SELECT * FROM messages WHERE id = ? AND status = 'active'");
    $stmt->execute([$id]);
    $msg = $stmt->fetch();

    if (!$msg) jsonResponse(['error' => 'Message non trouvé'], 404);
    if ((int)$msg['user_id'] !== (int)$user['id']) jsonResponse(['error' => 'Non autorisé'], 403);

    // 15 min edit window
    if (strtotime($msg['created_at']) < strtotime('-15 minutes')) {
        jsonResponse(['error' => 'Le délai de modification est dépassé (15 minutes)'], 403);
    }

    $stmt = $db->prepare("UPDATE messages SET content = ?, edited_at = NOW() WHERE id = ?");
    $stmt->execute([$content, $id]);

    jsonResponse(['success' => true]);
}

function deleteMessage(): void
{
    requireLogin();
    $user = getCurrentUser();
    $data = getInputJSON();
    $id = (int)($_GET['id'] ?? $data['id'] ?? 0);
    if ($id <= 0) jsonResponse(['error' => 'ID requis'], 400);

    $db = Database::getInstance();
    $stmt = $db->prepare("SELECT * FROM messages WHERE id = ?");
    $stmt->execute([$id]);
    $msg = $stmt->fetch();

    if (!$msg) jsonResponse(['error' => 'Message non trouvé'], 404);

    $isAuthor = ((int)$msg['user_id'] === (int)$user['id']);
    $isAdmin = in_array($user['role'], ['super_admin', 'admin', 'moderator']);

    if (!$isAuthor && !$isAdmin) {
        jsonResponse(['error' => 'Non autorisé'], 403);
    }

    $stmt = $db->prepare("UPDATE messages SET status = 'deleted', deleted_at = NOW() WHERE id = ?");
    $stmt->execute([$id]);

    jsonResponse(['success' => true]);
}

function reportMessage(): void
{
    requireLogin();
    $user = getCurrentUser();
    $data = getInputJSON();
    $id = (int)($_GET['id'] ?? $data['id'] ?? 0);
    $reason = $data['reason'] ?? '';
    $comment = trim($data['comment'] ?? '');

    if ($id <= 0) jsonResponse(['error' => 'ID requis'], 400);

    $validReasons = ['patient_data', 'inappropriate', 'scientific_error', 'spam', 'other'];
    if (!in_array($reason, $validReasons)) {
        jsonResponse(['error' => 'Raison invalide'], 400);
    }

    $db = Database::getInstance();

    // Check message exists
    $stmt = $db->prepare("SELECT id FROM messages WHERE id = ?");
    $stmt->execute([$id]);
    if (!$stmt->fetch()) jsonResponse(['error' => 'Message non trouvé'], 404);

    $stmt = $db->prepare("INSERT INTO reports (message_id, reported_by, reason, comment) VALUES (?, ?, ?, ?)");
    $stmt->execute([$id, $user['id'], $reason, $comment]);

    // Notify admins
    $stmt = $db->prepare("
        INSERT INTO notifications (user_id, group_id, message_id, type, title, body)
        SELECT u.id, NULL, ?, 'report', 'Nouveau signalement', ?
        FROM users u WHERE u.role IN ('super_admin', 'admin')
    ");
    $stmt->execute([$id, "Message signalé pour: {$reason}"]);

    jsonResponse(['success' => true], 201);
}

function pinMessage(): void
{
    requireRole(['super_admin', 'admin', 'moderator']);
    $data = getInputJSON();
    $id = (int)($_GET['id'] ?? $data['id'] ?? 0);
    if ($id <= 0) jsonResponse(['error' => 'ID requis'], 400);

    $db = Database::getInstance();
    $stmt = $db->prepare("SELECT is_pinned FROM messages WHERE id = ?");
    $stmt->execute([$id]);
    $msg = $stmt->fetch();
    if (!$msg) jsonResponse(['error' => 'Message non trouvé'], 404);

    $newPin = $msg['is_pinned'] ? 0 : 1;
    $stmt = $db->prepare("UPDATE messages SET is_pinned = ? WHERE id = ?");
    $stmt->execute([$newPin, $id]);

    jsonResponse(['success' => true, 'is_pinned' => (bool)$newPin]);
}

function markRead(): void
{
    requireLogin();
    $user = getCurrentUser();
    $data = getInputJSON();
    $groupId = (int)($data['group_id'] ?? 0);
    $messageId = (int)($data['message_id'] ?? 0);

    if ($groupId <= 0 || $messageId <= 0) jsonResponse(['error' => 'group_id et message_id requis'], 400);

    $db = Database::getInstance();

    // Update last_read_message_id
    $stmt = $db->prepare("UPDATE group_members SET last_read_message_id = GREATEST(COALESCE(last_read_message_id, 0), ?) WHERE group_id = ? AND user_id = ?");
    $stmt->execute([$messageId, $groupId, $user['id']]);

    // Insert/update receipts for all messages up to this one
    $stmt = $db->prepare("
        INSERT INTO message_receipts (message_id, user_id, read_at)
        SELECT m.id, ?, NOW()
        FROM messages m
        WHERE m.group_id = ? AND m.id <= ? AND m.user_id != ?
          AND NOT EXISTS (SELECT 1 FROM message_receipts mr WHERE mr.message_id = m.id AND mr.user_id = ?)
    ");
    $stmt->execute([$user['id'], $groupId, $messageId, $user['id'], $user['id']]);

    // Mark notifications as read
    $stmt = $db->prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND group_id = ? AND message_id <= ?");
    $stmt->execute([$user['id'], $groupId, $messageId]);

    jsonResponse(['success' => true]);
}

function messageInfo(): void
{
    requireLogin();
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) jsonResponse(['error' => 'ID requis'], 400);

    $db = Database::getInstance();
    $stmt = $db->prepare("
        SELECT mr.*, u.first_name, u.last_name
        FROM message_receipts mr
        JOIN users u ON u.id = mr.user_id
        WHERE mr.message_id = ?
        ORDER BY mr.read_at DESC
    ");
    $stmt->execute([$id]);

    jsonResponse(['receipts' => $stmt->fetchAll()]);
}
