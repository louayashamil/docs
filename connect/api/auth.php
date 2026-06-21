<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/helpers.php';

header('Content-Type: application/json; charset=utf-8');

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

switch ($action) {
    case 'login':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        handleLogin();
        break;
    case 'register':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        handleRegister();
        break;
    case 'logout':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        handleLogout();
        break;
    case 'forgot-password':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        handleForgotPassword();
        break;
    case 'me':
        if ($method !== 'GET') jsonResponse(['error' => 'Method not allowed'], 405);
        handleMe();
        break;
    default:
        jsonResponse(['error' => 'Action not found'], 404);
}

function handleLogin(): void
{
    $data = getInputJSON();
    $email = trim($data['email'] ?? '');
    $password = $data['password'] ?? '';

    if (empty($email) || empty($password)) {
        jsonResponse(['error' => 'Email et mot de passe requis'], 400);
    }

    $db = Database::getInstance();
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

    // Check login attempts
    $stmt = $db->prepare("SELECT COUNT(*) FROM login_attempts WHERE (email = ? OR ip_address = ?) AND attempted_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)");
    $stmt->execute([$email, $ip]);
    if ($stmt->fetchColumn() >= 5) {
        jsonResponse(['error' => 'Trop de tentatives. Réessayez dans 15 minutes.'], 429);
    }

    // Find user
    $stmt = $db->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        // Log attempt
        $stmt = $db->prepare("INSERT INTO login_attempts (email, ip_address) VALUES (?, ?)");
        $stmt->execute([$email, $ip]);
        jsonResponse(['error' => 'Email ou mot de passe incorrect'], 401);
    }

    if ($user['status'] === 'suspended') {
        jsonResponse(['error' => 'Votre compte a été suspendu'], 403);
    }
    if ($user['status'] === 'pending' || $user['role'] === 'pending') {
        jsonResponse(['error' => 'Votre compte est en attente de validation'], 403);
    }

    // Create session
    startSecureSession();
    session_regenerate_id(true);
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['user_email'] = $user['email'];
    $_SESSION['user_first_name'] = $user['first_name'];
    $_SESSION['user_last_name'] = $user['last_name'];
    $_SESSION['user_role'] = $user['role'];
    $_SESSION['user_photo'] = $user['profile_photo'];
    $_SESSION['_created'] = time();

    // Rehash if needed
    if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
        $stmt = $db->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
        $stmt->execute([password_hash($password, PASSWORD_DEFAULT), $user['id']]);
    }

    jsonResponse([
        'success' => true,
        'user' => [
            'id' => $user['id'],
            'first_name' => $user['first_name'],
            'last_name' => $user['last_name'],
            'email' => $user['email'],
            'role' => $user['role'],
            'profile_photo' => $user['profile_photo'],
        ],
        'csrf_token' => csrfToken(),
    ]);
}

function handleRegister(): void
{
    $data = getInputJSON();
    $required = ['first_name', 'last_name', 'email', 'password', 'phone', 'city', 'institution'];
    foreach ($required as $field) {
        if (empty(trim($data[$field] ?? ''))) {
            jsonResponse(['error' => "Le champ {$field} est requis"], 400);
        }
    }

    $email = filter_var(trim($data['email']), FILTER_VALIDATE_EMAIL);
    if (!$email) {
        jsonResponse(['error' => 'Adresse email invalide'], 400);
    }

    if (strlen($data['password']) < 8) {
        jsonResponse(['error' => 'Le mot de passe doit contenir au moins 8 caractères'], 400);
    }

    $db = Database::getInstance();

    $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        jsonResponse(['error' => 'Cette adresse email est déjà utilisée'], 409);
    }

    $stmt = $db->prepare("INSERT INTO users (first_name, last_name, email, phone, city, institution, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'pending')");
    $stmt->execute([
        trim($data['first_name']),
        trim($data['last_name']),
        $email,
        trim($data['phone']),
        trim($data['city']),
        trim($data['institution']),
        password_hash($data['password'], PASSWORD_DEFAULT),
    ]);

    jsonResponse(['success' => true, 'message' => 'Inscription enregistrée. Un administrateur validera votre compte.'], 201);
}

function handleLogout(): void
{
    startSecureSession();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
    jsonResponse(['success' => true]);
}

function handleForgotPassword(): void
{
    $data = getInputJSON();
    $email = filter_var(trim($data['email'] ?? ''), FILTER_VALIDATE_EMAIL);
    if (!$email) {
        jsonResponse(['error' => 'Adresse email invalide'], 400);
    }

    $db = Database::getInstance();
    $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    // Always return success to prevent email enumeration
    if ($user) {
        $token = bin2hex(random_bytes(32));
        $expires = date('Y-m-d H:i:s', strtotime('+1 hour'));
        $stmt = $db->prepare("UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?");
        $stmt->execute([$token, $expires, $user['id']]);
        // In production, send email with reset link containing $token
    }

    jsonResponse(['success' => true, 'message' => 'Si cette adresse existe, un email de réinitialisation a été envoyé.']);
}

function handleMe(): void
{
    requireLogin();
    $user = getCurrentUser();
    $db = Database::getInstance();
    $stmt = $db->prepare("SELECT id, first_name, last_name, email, phone, city, institution, role, profile_photo, created_at FROM users WHERE id = ?");
    $stmt->execute([$user['id']]);
    $full = $stmt->fetch();

    if (!$full) {
        jsonResponse(['error' => 'Utilisateur non trouvé'], 404);
    }

    $full['csrf_token'] = csrfToken();
    jsonResponse(['user' => $full]);
}
