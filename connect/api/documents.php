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
        listDocuments();
        break;
    case 'get':
        requireLogin();
        getDocument();
        break;
    case 'create':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireCsrf();
        requireLogin();
        createDocument();
        break;
    case 'update':
        if ($method !== 'PUT' && $method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireCsrf();
        requireLogin();
        updateDocument();
        break;
    case 'delete':
        if ($method !== 'DELETE' && $method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireCsrf();
        requireRole(['super_admin', 'admin']);
        deleteDocument();
        break;
    default:
        jsonResponse(['error' => 'Action not found'], 404);
}

function listDocuments(): void
{
    $db = Database::getInstance();
    $category = trim($_GET['category'] ?? '');
    $search = trim($_GET['search'] ?? '');
    $page = max(1, (int)($_GET['page'] ?? 1));
    $perPage = 20;

    $where = "WHERE 1=1";
    $params = [];

    if ($category !== '') {
        $where .= " AND d.category = ?";
        $params[] = $category;
    }
    if ($search !== '') {
        $where .= " AND (d.title LIKE ? OR d.description LIKE ?)";
        $like = "%{$search}%";
        $params[] = $like;
        $params[] = $like;
    }

    $stmt = $db->prepare("SELECT COUNT(*) FROM documents d {$where}");
    $stmt->execute($params);
    $total = (int)$stmt->fetchColumn();

    $offset = ($page - 1) * $perPage;
    $stmt = $db->prepare("
        SELECT d.*, CONCAT(u.first_name, ' ', u.last_name) AS uploaded_by_name
        FROM documents d
        LEFT JOIN users u ON u.id = d.uploaded_by
        {$where}
        ORDER BY d.created_at DESC
        LIMIT ? OFFSET ?
    ");
    $params[] = $perPage;
    $params[] = $offset;
    $stmt->execute($params);

    $docs = $stmt->fetchAll();
    foreach ($docs as &$d) {
        $d['file_size_formatted'] = formatFileSize((int)$d['file_size']);
        $d['time_ago'] = timeAgo($d['created_at']);
    }

    // Get categories
    $stmt = $db->query("SELECT DISTINCT category FROM documents WHERE category IS NOT NULL AND category != '' ORDER BY category");
    $categories = $stmt->fetchAll(PDO::FETCH_COLUMN);

    jsonResponse([
        'documents' => $docs,
        'categories' => $categories,
        'pagination' => paginate($total, $page, $perPage),
    ]);
}

function getDocument(): void
{
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) jsonResponse(['error' => 'ID invalide'], 400);

    $db = Database::getInstance();
    $stmt = $db->prepare("
        SELECT d.*, CONCAT(u.first_name, ' ', u.last_name) AS uploaded_by_name
        FROM documents d LEFT JOIN users u ON u.id = d.uploaded_by WHERE d.id = ?
    ");
    $stmt->execute([$id]);
    $doc = $stmt->fetch();
    if (!$doc) jsonResponse(['error' => 'Document non trouvé'], 404);

    $doc['file_size_formatted'] = formatFileSize((int)$doc['file_size']);
    jsonResponse(['document' => $doc]);
}

function createDocument(): void
{
    $user = getCurrentUser();
    $data = getInputJSON();

    $title = trim($data['title'] ?? '');
    if (empty($title)) jsonResponse(['error' => 'Titre requis'], 400);
    if (empty($data['file_path'])) jsonResponse(['error' => 'Fichier requis'], 400);

    $db = Database::getInstance();
    $stmt = $db->prepare("INSERT INTO documents (title, description, category, file_name, file_path, file_size, mime_type, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $title,
        trim($data['description'] ?? ''),
        trim($data['category'] ?? ''),
        $data['file_name'] ?? basename($data['file_path']),
        $data['file_path'],
        $data['file_size'] ?? 0,
        $data['mime_type'] ?? 'application/octet-stream',
        $user['id'],
    ]);

    jsonResponse(['success' => true, 'document_id' => (int)$db->lastInsertId()], 201);
}

function updateDocument(): void
{
    $user = getCurrentUser();
    $data = getInputJSON();
    $id = (int)($_GET['id'] ?? $data['id'] ?? 0);
    if ($id <= 0) jsonResponse(['error' => 'ID invalide'], 400);

    $db = Database::getInstance();

    // Check ownership or admin
    $stmt = $db->prepare("SELECT uploaded_by FROM documents WHERE id = ?");
    $stmt->execute([$id]);
    $doc = $stmt->fetch();
    if (!$doc) jsonResponse(['error' => 'Document non trouvé'], 404);

    if ((int)$doc['uploaded_by'] !== (int)$user['id'] && !in_array($user['role'], ['super_admin', 'admin'])) {
        jsonResponse(['error' => 'Non autorisé'], 403);
    }

    $fields = [];
    $params = [];
    foreach (['title', 'description', 'category'] as $f) {
        if (isset($data[$f])) {
            $fields[] = "`{$f}` = ?";
            $params[] = $data[$f];
        }
    }

    if (empty($fields)) jsonResponse(['error' => 'Rien à mettre à jour'], 400);
    $params[] = $id;

    $stmt = $db->prepare("UPDATE documents SET " . implode(', ', $fields) . " WHERE id = ?");
    $stmt->execute($params);

    jsonResponse(['success' => true]);
}

function deleteDocument(): void
{
    $data = getInputJSON();
    $id = (int)($_GET['id'] ?? $data['id'] ?? 0);
    if ($id <= 0) jsonResponse(['error' => 'ID invalide'], 400);

    $db = Database::getInstance();

    // Delete file
    $stmt = $db->prepare("SELECT file_path FROM documents WHERE id = ?");
    $stmt->execute([$id]);
    $doc = $stmt->fetch();
    if ($doc && file_exists(__DIR__ . '/../' . $doc['file_path'])) {
        @unlink(__DIR__ . '/../' . $doc['file_path']);
    }

    $stmt = $db->prepare("DELETE FROM documents WHERE id = ?");
    $stmt->execute([$id]);

    jsonResponse(['success' => true]);
}
