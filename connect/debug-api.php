<?php
header('Content-Type: text/html; charset=utf-8');
?>
<h3>Test API Login</h3>
<div id="result">En cours...</div>
<script>
fetch('/connect/api/auth.php?action=login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    credentials: 'same-origin',
    body: JSON.stringify({email: 'louayashamil@gmail.com', password: 'Za3lanlih1@'})
})
.then(r => r.text())
.then(t => document.getElementById('result').innerText = 'Response: ' + t)
.catch(e => document.getElementById('result').innerText = 'Error: ' + e.message);
</script>
