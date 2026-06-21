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
        listEvents();
        break;
    case 'get':
        requireLogin();
        getEvent();
        break;
    case 'create':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireCsrf();
        requireRole(['super_admin', 'admin']);
        createEvent();
        break;
    case 'update':
        if ($method !== 'PUT' && $method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireCsrf();
        requireRole(['super_admin', 'admin']);
        updateEvent();
        break;
    case 'delete':
        if ($method !== 'DELETE' && $method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireCsrf();
        requireRole(['super_admin', 'admin']);
        deleteEvent();
        break;
    default:
        jsonResponse(['error' => 'Action not found'], 404);
}

function listEvents(): void
{
    $db = Database::getInstance();
    $from = $_GET['from'] ?? date('Y-m-d');
    $to = $_GET['to'] ?? date('Y-m-d', strtotime('+1 year'));
    $page = max(1, (int)($_GET['page'] ?? 1));
    $perPage = 20;

    $stmt = $db->prepare("SELECT COUNT(*) FROM events WHERE event_date BETWEEN ? AND ?");
    $stmt->execute([$from, $to]);
    $total = (int)$stmt->fetchColumn();

    $offset = ($page - 1) * $perPage;
    $stmt = $db->prepare("
        SELECT e.*, CONCAT(u.first_name, ' ', u.last_name) AS created_by_name
        FROM events e
        LEFT JOIN users u ON u.id = e.created_by
        WHERE e.event_date BETWEEN ? AND ?
        ORDER BY e.event_date ASC
        LIMIT ? OFFSET ?
    ");
    $stmt->execute([$from, $to, $perPage, $offset]);

    jsonResponse([
        'events' => $stmt->fetchAll(),
        'pagination' => paginate($total, $page, $perPage),
    ]);
}

function getEvent(): void
{
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) jsonResponse(['error' => 'ID invalide'], 400);

    $db = Database::getInstance();
    $stmt = $db->prepare("
        SELECT e.*, CONCAT(u.first_name, ' ', u.last_name) AS created_by_name
        FROM events e LEFT JOIN users u ON u.id = e.created_by WHERE e.id = ?
    ");
    $stmt->execute([$id]);
    $event = $stmt->fetch();
    if (!$event) jsonResponse(['error' => 'Événement non trouvé'], 404);

    jsonResponse(['event' => $event]);
}

function createEvent(): void
{
    $user = getCurrentUser();
    $data = getInputJSON();

    $title = trim($data['title'] ?? '');
    $eventDate = $data['event_date'] ?? '';
    if (empty($title) || empty($eventDate)) {
        jsonResponse(['error' => 'Titre et date requis'], 400);
    }

    $db = Database::getInstance();
    $stmt = $db->prepare("INSERT INTO events (title, description, event_date, start_time, end_time, location, registration_link, file_path, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $title,
        trim($data['description'] ?? ''),
        $eventDate,
        $data['start_time'] ?? null,
        $data['end_time'] ?? null,
        trim($data['location'] ?? ''),
        trim($data['registration_link'] ?? ''),
        $data['file_path'] ?? null,
        $user['id'],
    ]);

    jsonResponse(['success' => true, 'event_id' => (int)$db->lastInsertId()], 201);
}

function updateEvent(): void
{
    $data = getInputJSON();
    $id = (int)($_GET['id'] ?? $data['id'] ?? 0);
    if ($id <= 0) jsonResponse(['error' => 'ID invalide'], 400);

    $db = Database::getInstance();
    $fields = [];
    $params = [];

    foreach (['title', 'description', 'event_date', 'start_time', 'end_time', 'location', 'registration_link', 'file_path'] as $f) {
        if (isset($data[$f])) {
            $fields[] = "`{$f}` = ?";
            $params[] = $data[$f];
        }
    }

    if (empty($fields)) jsonResponse(['error' => 'Rien à mettre à jour'], 400);
    $params[] = $id;

    $stmt = $db->prepare("UPDATE events SET " . implode(', ', $fields) . " WHERE id = ?");
    $stmt->execute($params);

    jsonResponse(['success' => true]);
}

function deleteEvent(): void
{
    $data = getInputJSON();
    $id = (int)($_GET['id'] ?? $data['id'] ?? 0);
    if ($id <= 0) jsonResponse(['error' => 'ID invalide'], 400);

    $db = Database::getInstance();
    $stmt = $db->prepare("DELETE FROM events WHERE id = ?");
    $stmt->execute([$id]);

    jsonResponse(['success' => true]);
}
