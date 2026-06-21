<?php
define('DB_HOST', 'localhost');
define('DB_NAME', 'nadar_connect');
define('DB_USER', 'root');
define('DB_PASS', '');
define('UPLOAD_MAX_IMAGE', 20 * 1024 * 1024);
define('UPLOAD_MAX_DOC', 100 * 1024 * 1024);
define('UPLOAD_MAX_VIDEO', 100 * 1024 * 1024);
define('ALLOWED_IMAGE_TYPES', ['image/jpeg','image/png','image/gif','image/webp']);
define('ALLOWED_DOC_TYPES', ['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
define('ALLOWED_VIDEO_TYPES', ['video/mp4','video/webm']);
define('BASE_URL', '/connect');
define('APP_NAME', 'NADAR Connect');
