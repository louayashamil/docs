<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/helpers.php';

header('Content-Type: application/json; charset=utf-8');

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// All admin endpoints require admin role
if (!in_array($action, [])) {
    // Checked per-action below for flexibility
}

switch ($action) {
    case 'pending':
        requireRole(['super_admin', 'admin']);
        listPending();
        break;
    case 'approve':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireRole(['super_admin', 'admin']);
        approveUser();
        break;
    case 'reject':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireRole(['super_admin', 'admin']);
        rejectUser();
        break;
    case 'suspend':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireRole(['super_admin', 'admin']);
        suspendUser();
        break;
    case 'role':
        if ($method !== 'PUT' && $method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireRole(['super_admin']);
        changeRole();
        break;
    case 'reports':
        requireRole(['super_admin', 'admin', 'moderator']);
        listReports();
        break;
    case 'handle-report':
    case 'report-action':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireRole(['super_admin', 'admin', 'moderator']);
        handleReport();
        break;
    case 'stats':
        requireRole(['super_admin', 'admin']);
        getStats();
        break;
    case 'batch-import':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireRole(['super_admin', 'admin']);
        batchImport();
        break;
    default:
        jsonResponse(['error' => 'Action not found'], 404);
}

function listPending(): void
{
    $db = Database::getInstance();
    $stmt = $db->prepare("SELECT id, first_name, last_name, email, phone, city, institution, created_at FROM users WHERE role = 'pending' OR status = 'pending' ORDER BY created_at DESC");
    $stmt->execute();
    jsonResponse(['pending' => $stmt->fetchAll()]);
}

function approveUser(): void
{
    $data = getInputJSON();
    $id = (int)($_GET['id'] ?? $data['user_id'] ?? $data['id'] ?? 0);
    if ($id <= 0) jsonResponse(['error' => 'ID invalide'], 400);

    $db = Database::getInstance();

    $stmt = $db->prepare("UPDATE users SET role = 'member', status = 'active', email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = ? AND (role = 'pending' OR status = 'pending')");
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        jsonResponse(['error' => 'Utilisateur non trouvé ou déjà validé'], 404);
    }

    // Add to all non-private groups
    $stmt = $db->prepare("
        INSERT IGNORE INTO group_members (group_id, user_id, role_in_group)
        SELECT g.id, ?, 'member' FROM `groups` g WHERE g.is_private = 0
    ");
    $stmt->execute([$id]);

    // Notify user
    $stmt = $db->prepare("INSERT INTO notifications (user_id, type, title, body) VALUES (?, 'system', 'Compte validé', 'Votre compte NADAR Connect a été approuvé. Bienvenue !')");
    $stmt->execute([$id]);

    jsonResponse(['success' => true]);
}

function rejectUser(): void
{
    $data = getInputJSON();
    $id = (int)($_GET['id'] ?? $data['user_id'] ?? $data['id'] ?? 0);
    if ($id <= 0) jsonResponse(['error' => 'ID invalide'], 400);

    $db = Database::getInstance();
    $stmt = $db->prepare("DELETE FROM users WHERE id = ? AND role = 'pending'");
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        jsonResponse(['error' => 'Utilisateur non trouvé ou déjà validé'], 404);
    }

    jsonResponse(['success' => true]);
}

function suspendUser(): void
{
    $data = getInputJSON();
    $id = (int)($_GET['id'] ?? $data['id'] ?? 0);
    if ($id <= 0) jsonResponse(['error' => 'ID invalide'], 400);

    $user = getCurrentUser();
    if ((int)$user['id'] === $id) {
        jsonResponse(['error' => 'Vous ne pouvez pas vous suspendre vous-même'], 400);
    }

    $db = Database::getInstance();
    $stmt = $db->prepare("SELECT role FROM users WHERE id = ?");
    $stmt->execute([$id]);
    $target = $stmt->fetch();
    if (!$target) jsonResponse(['error' => 'Utilisateur non trouvé'], 404);

    if ($target['role'] === 'super_admin') {
        jsonResponse(['error' => 'Impossible de suspendre un super administrateur'], 403);
    }

    $stmt = $db->prepare("UPDATE users SET role = 'suspended', status = 'suspended' WHERE id = ?");
    $stmt->execute([$id]);

    jsonResponse(['success' => true]);
}

function changeRole(): void
{
    $data = getInputJSON();
    $id = (int)($_GET['id'] ?? $data['id'] ?? 0);
    $newRole = $data['role'] ?? '';

    if ($id <= 0) jsonResponse(['error' => 'ID invalide'], 400);

    $validRoles = ['admin', 'moderator', 'member'];
    if (!in_array($newRole, $validRoles)) {
        jsonResponse(['error' => 'Rôle invalide'], 400);
    }

    $user = getCurrentUser();
    if ((int)$user['id'] === $id) {
        jsonResponse(['error' => 'Vous ne pouvez pas changer votre propre rôle'], 400);
    }

    $db = Database::getInstance();
    $stmt = $db->prepare("UPDATE users SET role = ? WHERE id = ? AND role != 'super_admin'");
    $stmt->execute([$newRole, $id]);

    jsonResponse(['success' => true]);
}

function listReports(): void
{
    $db = Database::getInstance();
    $status = $_GET['status'] ?? 'pending';

    $stmt = $db->prepare("
        SELECT r.*, m.content AS message_content, m.group_id,
            CONCAT(ru.first_name, ' ', ru.last_name) AS reported_by_name,
            CONCAT(mu.first_name, ' ', mu.last_name) AS message_author,
            g.name AS group_name
        FROM reports r
        JOIN messages m ON m.id = r.message_id
        JOIN users ru ON ru.id = r.reported_by
        LEFT JOIN users mu ON mu.id = m.user_id
        LEFT JOIN `groups` g ON g.id = m.group_id
        WHERE r.status = ?
        ORDER BY r.created_at DESC
    ");
    $stmt->execute([$status]);

    jsonResponse(['reports' => $stmt->fetchAll()]);
}

function handleReport(): void
{
    $data = getInputJSON();
    $id = (int)($_GET['id'] ?? $data['id'] ?? 0);
    $reportAction = $data['action'] ?? ''; // reviewed, dismissed, delete_message
    $user = getCurrentUser();

    if ($id <= 0) jsonResponse(['error' => 'ID invalide'], 400);

    $db = Database::getInstance();

    if ($reportAction === 'delete_message') {
        // Delete the reported message
        $stmt = $db->prepare("SELECT message_id FROM reports WHERE id = ?");
        $stmt->execute([$id]);
        $report = $stmt->fetch();
        if ($report) {
            $stmt = $db->prepare("UPDATE messages SET status = 'moderated', deleted_at = NOW() WHERE id = ?");
            $stmt->execute([$report['message_id']]);
        }
        $newStatus = 'reviewed';
    } else {
        $newStatus = in_array($reportAction, ['reviewed', 'dismissed']) ? $reportAction : 'reviewed';
    }

    $stmt = $db->prepare("UPDATE reports SET status = ?, reviewed_by = ? WHERE id = ?");
    $stmt->execute([$newStatus, $user['id'], $id]);

    jsonResponse(['success' => true]);
}

function getStats(): void
{
    $db = Database::getInstance();

    $stats = [];

    $stmt = $db->query("SELECT COUNT(*) FROM users WHERE status = 'active'");
    $stats['active_users'] = (int)$stmt->fetchColumn();

    $stmt = $db->query("SELECT COUNT(*) FROM users WHERE role = 'pending' OR status = 'pending'");
    $stats['pending_users'] = (int)$stmt->fetchColumn();

    $stmt = $db->query("SELECT COUNT(*) FROM messages WHERE status = 'active'");
    $stats['total_messages'] = (int)$stmt->fetchColumn();

    $stmt = $db->query("SELECT COUNT(*) FROM messages WHERE status = 'active' AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)");
    $stats['messages_this_week'] = (int)$stmt->fetchColumn();

    $stmt = $db->query("SELECT COUNT(*) FROM `groups`");
    $stats['total_groups'] = (int)$stmt->fetchColumn();

    $stmt = $db->query("SELECT COUNT(*) FROM reports WHERE status = 'pending'");
    $stats['pending_reports'] = (int)$stmt->fetchColumn();

    $stmt = $db->query("SELECT COUNT(*) FROM events WHERE event_date >= CURDATE()");
    $stats['upcoming_events'] = (int)$stmt->fetchColumn();

    $stmt = $db->query("SELECT COUNT(*) FROM documents");
    $stats['total_documents'] = (int)$stmt->fetchColumn();

    // Most active groups
    $stmt = $db->query("
        SELECT g.name, COUNT(m.id) AS message_count
        FROM `groups` g
        LEFT JOIN messages m ON m.group_id = g.id AND m.status = 'active' AND m.created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY g.id
        ORDER BY message_count DESC
        LIMIT 5
    ");
    $stats['top_groups'] = $stmt->fetchAll();

    // Recent registrations
    $stmt = $db->query("SELECT COUNT(*) FROM users WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)");
    $stats['new_users_month'] = (int)$stmt->fetchColumn();

    jsonResponse(['stats' => $stats]);
}

function batchImport(): void
{
    if (empty($_FILES['file'])) {
        jsonResponse(['error' => 'Fichier CSV requis'], 400);
    }

    $file = $_FILES['file'];
    $mime = mime_content_type($file['tmp_name']);
    if (!in_array($mime, ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel'])) {
        jsonResponse(['error' => 'Format CSV requis'], 400);
    }

    $handle = fopen($file['tmp_name'], 'r');
    if (!$handle) jsonResponse(['error' => 'Impossible de lire le fichier'], 500);

    $db = Database::getInstance();
    $header = fgetcsv($handle, 0, ',');
    if (!$header) {
        fclose($handle);
        jsonResponse(['error' => 'Fichier vide'], 400);
    }

    // Normalize header
    $header = array_map(function ($h) {
        return strtolower(trim(str_replace(["\xEF\xBB\xBF", '"'], '', $h)));
    }, $header);

    $requiredCols = ['email', 'first_name', 'last_name'];
    foreach ($requiredCols as $col) {
        if (!in_array($col, $header)) {
            fclose($handle);
            jsonResponse(['error' => "Colonne manquante: {$col}"], 400);
        }
    }

    $stmt = $db->prepare("INSERT INTO users (first_name, last_name, email, phone, city, institution, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'member', 'active') ON DUPLICATE KEY UPDATE first_name = VALUES(first_name)");

    $imported = 0;
    $errors = [];
    $row = 1;

    while (($data = fgetcsv($handle, 0, ',')) !== false) {
        $row++;
        $record = array_combine($header, array_pad($data, count($header), ''));

        $email = filter_var(trim($record['email'] ?? ''), FILTER_VALIDATE_EMAIL);
        if (!$email) {
            $errors[] = "Ligne {$row}: email invalide";
            continue;
        }

        $tempPass = bin2hex(random_bytes(8));
        try {
            $stmt->execute([
                trim($record['first_name']),
                trim($record['last_name']),
                $email,
                trim($record['phone'] ?? ''),
                trim($record['city'] ?? ''),
                trim($record['institution'] ?? ''),
                password_hash($tempPass, PASSWORD_DEFAULT),
            ]);
            $imported++;
        } catch (PDOException $e) {
            $errors[] = "Ligne {$row}: " . $e->getMessage();
        }
    }

    fclose($handle);
    jsonResponse(['success' => true, 'imported' => $imported, 'errors' => $errors]);
}
