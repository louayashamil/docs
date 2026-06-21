<?php
require_once __DIR__ . '/includes/config.php';

// Connect to existing database
try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER,
        DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    die("Connection failed: " . $e->getMessage());
}

// Create tables
$pdo->exec("
CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20) DEFAULT NULL,
    city VARCHAR(100) DEFAULT NULL,
    institution VARCHAR(255) DEFAULT NULL,
    role ENUM('super_admin','admin','moderator','member','pending','suspended') NOT NULL DEFAULT 'pending',
    status ENUM('active','inactive','pending','suspended') NOT NULL DEFAULT 'pending',
    profile_photo VARCHAR(500) DEFAULT NULL,
    password_hash VARCHAR(255) NOT NULL,
    google_id VARCHAR(255) DEFAULT NULL,
    email_verified_at DATETIME DEFAULT NULL,
    anonymization_accepted TINYINT(1) DEFAULT 0,
    charter_accepted TINYINT(1) DEFAULT 0,
    reset_token VARCHAR(255) DEFAULT NULL,
    reset_expires DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

$pdo->exec("
CREATE TABLE IF NOT EXISTS `groups` (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT DEFAULT NULL,
    type ENUM('general','announcement','scientific','clinical_cases','library','agenda') NOT NULL DEFAULT 'general',
    icon VARCHAR(50) DEFAULT NULL,
    is_private TINYINT(1) DEFAULT 0,
    comments_allowed TINYINT(1) DEFAULT 1,
    created_by INT UNSIGNED DEFAULT NULL,
    sort_order INT DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

$pdo->exec("
CREATE TABLE IF NOT EXISTS group_members (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    group_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    role_in_group ENUM('admin','moderator','member') NOT NULL DEFAULT 'member',
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    muted_until DATETIME DEFAULT NULL,
    last_read_message_id INT UNSIGNED DEFAULT NULL,
    notifications_enabled TINYINT(1) NOT NULL DEFAULT 1,
    UNIQUE KEY unique_membership (group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

$pdo->exec("
CREATE TABLE IF NOT EXISTS messages (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    group_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED DEFAULT NULL,
    parent_message_id INT UNSIGNED DEFAULT NULL,
    content TEXT DEFAULT NULL,
    type ENUM('text','image','file','video','voice','system') NOT NULL DEFAULT 'text',
    status ENUM('active','deleted','moderated') NOT NULL DEFAULT 'active',
    is_pinned TINYINT(1) DEFAULT 0,
    edited_at DATETIME DEFAULT NULL,
    deleted_at DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_message_id) REFERENCES messages(id) ON DELETE SET NULL,
    INDEX idx_group_created (group_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

$pdo->exec("
CREATE TABLE IF NOT EXISTS attachments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    message_id INT UNSIGNED NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
    thumbnail_path VARCHAR(500) DEFAULT NULL,
    caption TEXT DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

$pdo->exec("
CREATE TABLE IF NOT EXISTS message_receipts (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    message_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    delivered_at DATETIME DEFAULT NULL,
    read_at DATETIME DEFAULT NULL,
    UNIQUE KEY unique_receipt (message_id, user_id),
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

$pdo->exec("
CREATE TABLE IF NOT EXISTS notifications (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    group_id INT UNSIGNED DEFAULT NULL,
    message_id INT UNSIGNED DEFAULT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'message',
    title VARCHAR(255) NOT NULL,
    body TEXT DEFAULT NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE SET NULL,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL,
    INDEX idx_user_read (user_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

$pdo->exec("
CREATE TABLE IF NOT EXISTS reports (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    message_id INT UNSIGNED NOT NULL,
    reported_by INT UNSIGNED NOT NULL,
    reason ENUM('patient_data','inappropriate','scientific_error','spam','other') NOT NULL,
    comment TEXT DEFAULT NULL,
    status ENUM('pending','reviewed','dismissed') NOT NULL DEFAULT 'pending',
    reviewed_by INT UNSIGNED DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

$pdo->exec("
CREATE TABLE IF NOT EXISTS events (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    event_date DATE NOT NULL,
    start_time TIME DEFAULT NULL,
    end_time TIME DEFAULT NULL,
    location VARCHAR(255) DEFAULT NULL,
    registration_link VARCHAR(500) DEFAULT NULL,
    file_path VARCHAR(500) DEFAULT NULL,
    created_by INT UNSIGNED DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_event_date (event_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

$pdo->exec("
CREATE TABLE IF NOT EXISTS documents (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    category VARCHAR(100) DEFAULT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_by INT UNSIGNED DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

$pdo->exec("
CREATE TABLE IF NOT EXISTS login_attempts (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email_time (email, attempted_at),
    INDEX idx_ip_time (ip_address, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

echo "Tables created successfully.\n";

// --- Seed Data ---

// Users
$users = [
    ['Louay', 'Ashamil', 'louayashamil@gmail.com', 'Za3lanlih1@', 'super_admin', 'Casablanca', 'CHU Ibn Rochd'],
    ['Paramessa', 'Gor', 'paramessagor@gmail.com', 'Moussikar1@', 'admin', 'Marrakech', 'CHU Mohammed VI'],
    ['Youssef', 'El Amrani', 'y.elamrani@example.com', 'Demo1234!', 'member', 'Rabat', 'Hôpital des Spécialités'],
    ['Fatima', 'Benali', 'f.benali@example.com', 'Demo1234!', 'member', 'Fès', 'CHU Hassan II'],
    ['Karim', 'Ouazzani', 'k.ouazzani@example.com', 'Demo1234!', 'member', 'Tanger', 'Clinique du Détroit'],
    ['Samira', 'Naciri', 's.naciri@example.com', 'Demo1234!', 'member', 'Agadir', 'Clinique Atlas'],
    ['Hassan', 'Lahlou', 'h.lahlou@example.com', 'Demo1234!', 'member', 'Meknès', 'CHU Moulay Ismaïl'],
];

$stmt = $pdo->prepare("INSERT INTO users (first_name, last_name, email, password_hash, role, status, city, institution, email_verified_at, charter_accepted, anonymization_accepted) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, NOW(), 1, 1)");
$userIds = [];
foreach ($users as $u) {
    $hash = password_hash($u[3], PASSWORD_DEFAULT);
    $stmt->execute([$u[0], $u[1], $u[2], $hash, $u[4], $u[5], $u[6]]);
    $userIds[] = $pdo->lastInsertId();
}
echo count($users) . " users inserted.\n";

// Groups
$groups = [
    ['Discussion générale', 'discussion-generale', 'Échanges entre membres', 'general', 'chat', 1],
    ['Annonces officielles', 'annonces-officielles', 'Communications officielles NADAR', 'announcement', 'megaphone', 2],
    ['Cas cliniques', 'cas-cliniques', 'Présentation et discussion de cas cliniques', 'clinical_cases', 'stethoscope', 3],
    ['Rétine', 'retine', 'Discussion sur la rétine médicale et chirurgicale', 'scientific', 'eye', 4],
    ['Cataracte', 'cataracte', 'Chirurgie de la cataracte et IOL', 'scientific', 'eye', 5],
    ['Glaucome', 'glaucome', 'Glaucome : diagnostic et traitement', 'scientific', 'eye', 6],
    ['Cornée', 'cornee', 'Pathologies cornéennes et chirurgie réfractive', 'scientific', 'eye', 7],
    ['Ophtalmologie pédiatrique', 'ophtalmo-pediatrique', 'Ophtalmologie de l\'enfant', 'scientific', 'baby', 8],
    ['Congrès et formations', 'congres-formations', 'Annonces de congrès et formations continues', 'general', 'calendar', 9],
    ['Publications scientifiques', 'publications-scientifiques', 'Partage d\'articles et publications', 'scientific', 'book', 10],
    ['Bibliothèque NADAR', 'bibliotheque-nadar', 'Documents et ressources partagés', 'library', 'folder', 11],
    ['Agenda NADAR', 'agenda-nadar', 'Calendrier des événements NADAR', 'agenda', 'calendar', 12],
];

$stmtG = $pdo->prepare("INSERT INTO `groups` (name, slug, description, type, icon, sort_order, created_by, comments_allowed) VALUES (?, ?, ?, ?, ?, ?, ?, 1)");
$groupIds = [];
foreach ($groups as $g) {
    $stmtG->execute([$g[0], $g[1], $g[2], $g[3], $g[4], $g[5], $userIds[0]]);
    $groupIds[] = $pdo->lastInsertId();
}
echo count($groups) . " groups inserted.\n";

// Add all active members to all groups
$stmtMem = $pdo->prepare("INSERT INTO group_members (group_id, user_id, role_in_group) VALUES (?, ?, ?)");
foreach ($groupIds as $gid) {
    foreach ($userIds as $idx => $uid) {
        $role = $idx === 0 ? 'admin' : ($idx === 1 ? 'admin' : 'member');
        $stmtMem->execute([$gid, $uid, $role]);
    }
}
echo "All members added to all groups.\n";

// Demo messages
$demoMessages = [
    [$groupIds[0], $userIds[0], "Bienvenue sur NADAR Connect ! Cette plateforme est dédiée aux échanges entre ophtalmologistes."],
    [$groupIds[0], $userIds[2], "Merci pour cette initiative ! Très content de rejoindre la communauté."],
    [$groupIds[0], $userIds[3], "Bonjour à tous, hâte de partager des cas cliniques intéressants."],
    [$groupIds[1], $userIds[0], "Le prochain congrès NADAR aura lieu du 15 au 17 mars 2026 à Marrakech."],
    [$groupIds[1], $userIds[1], "Les inscriptions sont ouvertes sur le site officiel."],
    [$groupIds[2], $userIds[4], "Cas intéressant : patient de 65 ans avec décollement de rétine rhegmatogène bilatéral."],
    [$groupIds[2], $userIds[3], "Avez-vous fait une échographie B-scan ? Quel est l'état du vitré ?"],
    [$groupIds[3], $userIds[5], "Nouvelle étude sur l'efficacité des anti-VEGF dans la DMLA néovasculaire."],
    [$groupIds[4], $userIds[6], "Quel IOL préférez-vous pour les patients avec astigmatisme cornéen > 2D ?"],
    [$groupIds[5], $userIds[2], "Prise en charge d'un glaucome juvénile : quelles sont vos recommandations ?"],
];
$stmtMsg = $pdo->prepare("INSERT INTO messages (group_id, user_id, content, type, status) VALUES (?, ?, ?, 'text', 'active')");
foreach ($demoMessages as $m) {
    $stmtMsg->execute([$m[0], $m[1], $m[2]]);
}
echo count($demoMessages) . " demo messages inserted.\n";

// Demo events
$stmtEv = $pdo->prepare("INSERT INTO events (title, description, event_date, start_time, end_time, location, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)");
$stmtEv->execute(['Congrès NADAR 2026', 'Congrès annuel de la NADAR', '2026-03-15', '08:00', '18:00', 'Palais des Congrès, Marrakech', $userIds[0]]);
$stmtEv->execute(['Atelier Chirurgie Réfractive', 'Formation pratique en chirurgie réfractive', '2026-04-10', '09:00', '16:00', 'CHU Ibn Rochd, Casablanca', $userIds[1]]);
$stmtEv->execute(['Webinaire Rétine', 'Les dernières avancées en rétine médicale', '2026-02-20', '19:00', '21:00', 'En ligne (Zoom)', $userIds[0]]);
echo "3 demo events inserted.\n";

// Demo documents
$stmtDoc = $pdo->prepare("INSERT INTO documents (title, description, category, file_name, file_path, file_size, mime_type, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
$stmtDoc->execute(['Guide NADAR - Bonnes pratiques', 'Guide des bonnes pratiques en ophtalmologie', 'Guides', 'guide-nadar.pdf', 'uploads/documents/guide-nadar.pdf', 2048000, 'application/pdf', $userIds[0]]);
$stmtDoc->execute(['Protocole anti-VEGF', 'Protocole d\'injection intravitréenne', 'Protocoles', 'protocole-anti-vegf.pdf', 'uploads/documents/protocole-anti-vegf.pdf', 1024000, 'application/pdf', $userIds[1]]);
echo "2 demo documents inserted.\n";

echo "\n=== Installation terminée avec succès ! ===\n";
echo "Super Admin: louayashamil@gmail.com\n";
echo "Admin: paramessagor@gmail.com\n";
echo "IMPORTANT: Supprimez ce fichier install.php après l'installation.\n";
