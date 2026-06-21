<?php
echo "OK - PHP fonctionne!";
echo "<br>Server: " . ($_SERVER['SERVER_SOFTWARE'] ?? 'unknown');
echo "<br>HTTPS: " . ($_SERVER['HTTPS'] ?? 'off');
echo "<br>Protocol: " . ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? 'none');
