<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/db.php';
header('Content-Type: text/plain; charset=utf-8');

try {
    $db = Database::getInstance();
    echo "DB OK\n";

    $stmt = $db->prepare("SELECT id, email, role, status, password_hash FROM users WHERE email = ?");
    $stmt->execute(['louayashamil@gmail.com']);
    $user = $stmt->fetch();

    if (!$user) {
        echo "User NOT FOUND\n";
    } else {
        echo "User found: id={$user['id']}, role={$user['role']}, status={$user['status']}\n";
        echo "Password verify: " . (password_verify('Za3lanlih1@', $user['password_hash']) ? 'OK' : 'FAIL') . "\n";
        echo "Hash: " . substr($user['password_hash'], 0, 20) . "...\n";
    }

    $tables = $db->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    echo "Tables: " . implode(', ', $tables) . "\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
