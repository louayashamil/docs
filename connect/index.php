<?php
session_start();
$isLoggedIn = isset($_SESSION['user_id']);
$currentUser = $isLoggedIn ? $_SESSION : null;
$isPending = $isLoggedIn && ($currentUser['role'] ?? '') === 'pending';
define('BASE_URL', '/connect');
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#1565C0">
    <title>NADAR Connect</title>
    <link rel="stylesheet" href="<?= BASE_URL ?>/assets/css/style.css">
    <link rel="manifest" href="<?= BASE_URL ?>/manifest.json">
    <link rel="icon" href="<?= BASE_URL ?>/icon.svg" type="image/svg+xml">
</head>
<body>

<?php if (!$isLoggedIn): ?>
<!-- ==================== LANDING PAGE ==================== -->
<div id="landingPage" class="landing-page">

    <!-- Header -->
    <header class="landing-header">
        <div class="landing-header-inner">
            <a href="<?= BASE_URL ?>" class="logo">
                <svg class="logo-icon" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2">
                    <ellipse cx="12" cy="12" rx="10" ry="7"/>
                    <circle cx="12" cy="12" r="3"/>
                </svg>
                <span class="logo-text">NADAR Connect</span>
            </a>
            <nav class="landing-nav">
                <button class="btn btn-outline" onclick="openModal('loginModal')">Se connecter</button>
            </nav>
        </div>
    </header>

    <!-- Hero Section -->
    <section class="hero-section">
        <div class="hero-content">
            <h1 class="hero-title">Bienvenue sur NADAR Connect</h1>
            <p class="hero-subtitle">Plateforme communautaire médicale des ophtalmologistes NADAR</p>
            <p class="hero-description">
                NADAR Connect est un espace d'échange sécurisé dédié aux professionnels de l'ophtalmologie.
                Partagez des cas cliniques, participez à des discussions spécialisées, accédez à une bibliothèque
                de ressources et restez informé des événements de la communauté NADAR.
            </p>
            <div class="hero-actions">
                <button class="btn btn-primary btn-lg" onclick="openModal('loginModal')">Se connecter</button>
                <button class="btn btn-secondary btn-lg" onclick="openModal('registerModal')">Demander l'accès</button>
            </div>
            <p class="hero-note">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Accès réservé aux professionnels validés par l'administration NADAR
            </p>
        </div>
    </section>

    <!-- Features Section -->
    <section class="features-section">
        <div class="features-grid">
            <div class="feature-card">
                <div class="feature-icon">
                    <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </div>
                <h3 class="feature-title">Discussions</h3>
                <p class="feature-desc">Échangez avec vos confrères en temps réel dans des groupes de discussion thématiques.</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">
                    <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="12" rx="10" ry="7"/><circle cx="12" cy="12" r="3"/></svg>
                </div>
                <h3 class="feature-title">Cas cliniques</h3>
                <p class="feature-desc">Partagez et analysez des cas cliniques anonymisés avec la communauté.</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">
                    <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                </div>
                <h3 class="feature-title">Bibliothèque</h3>
                <p class="feature-desc">Accédez à une collection de documents, articles et ressources partagées.</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">
                    <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <h3 class="feature-title">Agenda</h3>
                <p class="feature-desc">Consultez les événements, congrès et formations à venir de la communauté.</p>
            </div>
        </div>
    </section>

    <!-- Footer -->
    <footer class="landing-footer">
        <p>&copy; <?= date('Y') ?> NADAR Connect &mdash; Plateforme confidentielle réservée aux membres validés. Toutes les données médicales partagées sont soumises au secret professionnel.</p>
    </footer>
</div>

<!-- ==================== LOGIN MODAL ==================== -->
<div id="loginModal" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="loginModalTitle">
    <div class="modal modal-sm">
        <div class="modal-header">
            <h2 id="loginModalTitle" class="modal-title">Se connecter</h2>
            <button class="btn-icon modal-close" onclick="closeModal('loginModal')" aria-label="Fermer">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
        <form id="loginForm" class="modal-body" method="POST" action="<?= BASE_URL ?>/api/auth/login.php">
            <div class="form-group">
                <label for="loginEmail">Adresse email</label>
                <input type="email" id="loginEmail" name="email" class="form-input" placeholder="votre@email.com" required>
            </div>
            <div class="form-group">
                <label for="loginPassword">Mot de passe</label>
                <input type="password" id="loginPassword" name="password" class="form-input" placeholder="••••••••" required>
            </div>
            <div class="form-row form-row-between">
                <label class="checkbox-label">
                    <input type="checkbox" name="remember"> Se souvenir de moi
                </label>
                <a href="#" class="link-sm" id="forgotPasswordLink">Mot de passe oublié ?</a>
            </div>
            <div id="loginError" class="alert alert-error" style="display:none"></div>
            <button type="submit" class="btn btn-primary btn-block">Se connecter</button>
            <div class="divider"><span>ou</span></div>
            <button type="button" id="googleSignInBtn" class="btn btn-google btn-block">
                <svg viewBox="0 0 24 24" width="18" height="18"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continuer avec Google
            </button>
        </form>
    </div>
</div>

<!-- ==================== REGISTER MODAL ==================== -->
<div id="registerModal" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="registerModalTitle">
    <div class="modal modal-md">
        <div class="modal-header">
            <h2 id="registerModalTitle" class="modal-title">Demander l'accès</h2>
            <button class="btn-icon modal-close" onclick="closeModal('registerModal')" aria-label="Fermer">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
        <form id="registerForm" class="modal-body" method="POST" action="<?= BASE_URL ?>/api/auth/register.php" enctype="multipart/form-data">
            <div class="form-row">
                <div class="form-group form-group-half">
                    <label for="regFirstName">Prénom</label>
                    <input type="text" id="regFirstName" name="first_name" class="form-input" required>
                </div>
                <div class="form-group form-group-half">
                    <label for="regLastName">Nom</label>
                    <input type="text" id="regLastName" name="last_name" class="form-input" required>
                </div>
            </div>
            <div class="form-group">
                <label for="regEmail">Adresse email</label>
                <input type="email" id="regEmail" name="email" class="form-input" placeholder="votre@email.com" required>
            </div>
            <div class="form-group">
                <label for="regPassword">Mot de passe</label>
                <input type="password" id="regPassword" name="password" class="form-input" minlength="8" required>
            </div>
            <div class="form-row">
                <div class="form-group form-group-half">
                    <label for="regCity">Ville</label>
                    <input type="text" id="regCity" name="city" class="form-input" required>
                </div>
                <div class="form-group form-group-half">
                    <label for="regStatus">Statut</label>
                    <select id="regStatus" name="status" class="form-input" required>
                        <option value="">-- Sélectionner --</option>
                        <option value="Ophtalmologue">Ophtalmologue</option>
                        <option value="Résident">Résident</option>
                        <option value="Professeur">Professeur</option>
                        <option value="Invité">Invité</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label for="regInstitution">Institution / Établissement</label>
                <input type="text" id="regInstitution" name="institution" class="form-input">
            </div>
            <div class="form-group">
                <label for="regPhoto">Photo de profil <span class="text-muted">(optionnel)</span></label>
                <input type="file" id="regPhoto" name="profile_photo" class="form-input-file" accept="image/*">
            </div>
            <div class="form-group">
                <label class="checkbox-label">
                    <input type="checkbox" id="regCharter" name="charter_accepted" required>
                    J'accepte la <a href="#" class="link-sm">charte de la communauté NADAR</a>
                </label>
            </div>
            <div id="registerSuccess" class="alert alert-success" style="display:none"></div>
            <div id="registerError" class="alert alert-error" style="display:none"></div>
            <button type="submit" class="btn btn-primary btn-block">Demander l'accès</button>
        </form>
    </div>
</div>

<?php elseif ($isPending): ?>
<!-- ==================== WAITING PAGE ==================== -->
<div id="waitingPage" class="waiting-page">
    <div class="waiting-content">
        <div class="waiting-icon">
            <svg viewBox="0 0 24 24" width="80" height="80" fill="none" stroke="#1565C0" stroke-width="1.5">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
            </svg>
        </div>
        <h1 class="waiting-title">Votre demande est en cours de traitement</h1>
        <p class="waiting-text">Un administrateur NADAR validera votre inscription prochainement.</p>
        <p class="waiting-subtext">Vous recevrez une notification par email dès que votre accès sera activé.</p>
        <a href="<?= BASE_URL ?>/api/auth/logout.php" class="btn btn-outline">Se déconnecter</a>
    </div>
</div>

<?php else: ?>
<!-- ==================== APP SHELL ==================== -->
<div id="appShell" class="app-shell">

    <!-- Top Bar -->
    <header id="topBar" class="top-bar">
        <div class="top-bar-left">
            <button id="menuToggle" class="btn-icon mobile-only" aria-label="Menu">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <a href="<?= BASE_URL ?>" class="logo">
                <svg class="logo-icon" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="12" rx="10" ry="7"/><circle cx="12" cy="12" r="3"/></svg>
                <span class="logo-text">NADAR Connect</span>
            </a>
        </div>
        <div class="top-bar-right">
            <button id="searchToggle" class="btn-icon" aria-label="Rechercher">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
            <button id="notificationsBtn" class="btn-icon notifications-btn" aria-label="Notifications">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                <span id="notificationBadge" class="badge badge-red" style="display:none">0</span>
            </button>
            <div id="userMenuWrapper" class="user-menu-wrapper">
                <button id="userMenuBtn" class="btn-icon user-avatar-btn" aria-label="Menu utilisateur">
                    <img id="userAvatar" class="avatar avatar-sm" src="<?= BASE_URL ?>/assets/img/default-avatar.png" alt="Avatar">
                </button>
                <div id="userDropdown" class="dropdown" style="display:none">
                    <a href="#" class="dropdown-item" data-action="openProfile">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        Profil
                    </a>
                    <?php if (($currentUser['role'] ?? '') === 'admin'): ?>
                    <a href="#" class="dropdown-item" data-action="openAdmin">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                        Panneau d'administration
                    </a>
                    <?php endif; ?>
                    <div class="dropdown-divider"></div>
                    <a href="<?= BASE_URL ?>/api/auth/logout.php" class="dropdown-item dropdown-item-danger">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        Déconnexion
                    </a>
                </div>
            </div>
        </div>
    </header>

    <!-- Search Results Overlay -->
    <div id="searchOverlay" class="search-overlay" style="display:none">
        <div class="search-overlay-header">
            <div class="search-input-wrap">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" id="globalSearchInput" class="search-input-full" placeholder="Rechercher messages, fichiers, membres...">
            </div>
            <button class="btn-icon" onclick="closeSearchOverlay()" aria-label="Fermer">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
        <div id="searchResults" class="search-results"></div>
    </div>

    <div class="app-layout">
        <!-- Left Sidebar -->
        <aside id="sidebar" class="sidebar">
            <div class="sidebar-search">
                <div class="search-input-wrap">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" id="sidebarSearch" class="form-input form-input-sm" placeholder="Rechercher un groupe...">
                </div>
            </div>
            <div class="sidebar-groups">
                <!-- Discussion générale (always prominent) -->
                <div id="generalGroup" class="group-item group-item-active" data-group-id="general">
                    <div class="group-item-icon">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    </div>
                    <div class="group-item-content">
                        <div class="group-item-header">
                            <span class="group-item-name">Discussion générale</span>
                            <span class="group-item-time"></span>
                        </div>
                        <p class="group-item-preview"></p>
                    </div>
                    <span class="badge badge-primary group-item-badge" style="display:none">0</span>
                </div>

                <!-- Autre (collapsible) -->
                <div class="sidebar-section">
                    <button id="otherGroupsToggle" class="sidebar-section-toggle" aria-expanded="true">
                        Autre
                        <svg class="toggle-arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    <div id="otherGroupsList" class="sidebar-section-list">
                        <!-- Groups populated by JS -->
                    </div>
                </div>
            </div>
        </aside>

        <!-- Main Content -->
        <main id="mainContent" class="main-content">
            <!-- Chat Header -->
            <div id="chatHeader" class="chat-header">
                <button id="backToList" class="btn-icon mobile-only" aria-label="Retour">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                </button>
                <div class="chat-header-info">
                    <h2 id="chatGroupName" class="chat-group-name">Discussion générale</h2>
                    <span id="chatMembersCount" class="chat-members-count"></span>
                </div>
                <div class="chat-header-actions">
                    <button id="pinBtn" class="btn-icon" aria-label="Messages épinglés" title="Messages épinglés">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 4.5l-4 4L7 10l-1.5 1.5 7 7L14 17l1.5-4 4-4"/><line x1="9" y1="15" x2="4.5" y2="19.5"/></svg>
                    </button>
                    <button id="groupInfoBtn" class="btn-icon" aria-label="Infos du groupe" title="Infos du groupe">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    </button>
                </div>
            </div>

            <!-- Messages Container -->
            <div id="messagesContainer" class="messages-container">
                <!-- Messages loaded by JS -->
            </div>

            <!-- File/Image Preview Area -->
            <div id="attachmentPreview" class="attachment-preview" style="display:none">
                <div id="attachmentPreviewContent" class="attachment-preview-content"></div>
                <button id="attachmentPreviewRemove" class="btn-icon btn-icon-sm" aria-label="Supprimer">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>

            <!-- Composer Bar -->
            <div id="composerBar" class="composer-bar">
                <button id="attachPhotoBtn" class="btn-icon" aria-label="Joindre une photo" title="Joindre une photo">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </button>
                <button id="attachFileBtn" class="btn-icon" aria-label="Joindre un fichier" title="Joindre un fichier">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                </button>
                <textarea id="messageInput" class="composer-input" placeholder="Écrire un message..." rows="1"></textarea>
                <button id="emojiBtn" class="btn-icon" aria-label="Emoji" title="Emoji">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                </button>
                <button id="sendBtn" class="btn-icon btn-send" aria-label="Envoyer" title="Envoyer">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
                <input type="file" id="photoInput" accept="image/*" style="display:none">
                <input type="file" id="fileInput" style="display:none">
            </div>
        </main>

        <!-- Right Panel -->
        <aside id="rightPanel" class="right-panel" style="display:none">
            <div class="right-panel-header">
                <h3 id="rightPanelTitle" class="right-panel-title">Infos du groupe</h3>
                <button id="rightPanelClose" class="btn-icon" aria-label="Fermer">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
            <div id="rightPanelContent" class="right-panel-content">
                <div id="groupInfoSection" class="panel-section">
                    <div id="groupDescription" class="group-description"></div>
                </div>
                <div id="membersSection" class="panel-section">
                    <h4 class="panel-section-title">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        Membres
                    </h4>
                    <div id="membersList" class="members-list"></div>
                </div>
                <div id="sharedFilesSection" class="panel-section">
                    <h4 class="panel-section-title">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                        Fichiers partagés
                    </h4>
                    <div id="sharedFilesList" class="shared-files-list"></div>
                </div>
            </div>
        </aside>
    </div>

    <!-- Mobile Bottom Tabs -->
    <nav id="bottomTabs" class="bottom-tabs mobile-only">
        <button class="bottom-tab bottom-tab-active" data-tab="discussions">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>Discussions</span>
        </button>
        <button class="bottom-tab" data-tab="autre">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
            <span>Autre</span>
        </button>
        <button class="bottom-tab" data-tab="profil">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>Profil</span>
        </button>
    </nav>
</div>

<!-- ==================== IMAGE VIEWER MODAL ==================== -->
<div id="imageViewerModal" class="modal-overlay modal-overlay-dark" style="display:none" role="dialog" aria-modal="true" aria-label="Visualiseur d'image">
    <div class="image-viewer">
        <div class="image-viewer-toolbar">
            <button class="btn-icon btn-icon-light" id="imageZoomIn" aria-label="Zoom avant">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            </button>
            <button class="btn-icon btn-icon-light" id="imageDownload" aria-label="Télécharger">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
            <button class="btn-icon btn-icon-light" onclick="closeModal('imageViewerModal')" aria-label="Fermer">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
        <div class="image-viewer-content">
            <img id="imageViewerImg" class="image-viewer-img" src="" alt="Image">
        </div>
    </div>
</div>

<!-- ==================== MESSAGE INFO MODAL ==================== -->
<div id="messageInfoModal" class="modal-overlay" style="display:none" role="dialog" aria-modal="true" aria-labelledby="messageInfoTitle">
    <div class="modal modal-sm">
        <div class="modal-header">
            <h2 id="messageInfoTitle" class="modal-title">Infos du message</h2>
            <button class="btn-icon modal-close" onclick="closeModal('messageInfoModal')" aria-label="Fermer">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
        <div class="modal-body">
            <div class="message-info-section">
                <h4 class="message-info-label">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                    Envoyé
                </h4>
                <span id="messageInfoSent" class="message-info-time"></span>
            </div>
            <div class="message-info-section">
                <h4 class="message-info-label">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/><polyline points="16 6 5 17 0 12" transform="translate(4,0)"/></svg>
                    Distribué
                </h4>
                <div id="messageInfoDelivered" class="message-info-list"></div>
            </div>
            <div class="message-info-section">
                <h4 class="message-info-label">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#1565C0" stroke-width="2"><polyline points="20 6 9 17 4 12"/><polyline points="16 6 5 17 0 12" transform="translate(4,0)"/></svg>
                    Lu
                </h4>
                <div id="messageInfoRead" class="message-info-list"></div>
            </div>
        </div>
    </div>
</div>

<!-- ==================== REPORT MESSAGE MODAL ==================== -->
<div id="reportModal" class="modal-overlay" style="display:none" role="dialog" aria-modal="true" aria-labelledby="reportModalTitle">
    <div class="modal modal-sm">
        <div class="modal-header">
            <h2 id="reportModalTitle" class="modal-title">Signaler un message</h2>
            <button class="btn-icon modal-close" onclick="closeModal('reportModal')" aria-label="Fermer">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
        <form id="reportForm" class="modal-body">
            <input type="hidden" id="reportMessageId" name="message_id">
            <div class="form-group">
                <label for="reportReason">Motif du signalement</label>
                <select id="reportReason" name="reason" class="form-input" required>
                    <option value="">-- Sélectionner --</option>
                    <option value="inappropriate">Contenu inapproprié</option>
                    <option value="spam">Spam</option>
                    <option value="harassment">Harcèlement</option>
                    <option value="misinformation">Désinformation médicale</option>
                    <option value="privacy">Violation de confidentialité</option>
                    <option value="other">Autre</option>
                </select>
            </div>
            <div class="form-group">
                <label for="reportComment">Commentaire</label>
                <textarea id="reportComment" name="comment" class="form-input" rows="3" placeholder="Précisez le motif..."></textarea>
            </div>
            <button type="submit" class="btn btn-danger btn-block">Envoyer le signalement</button>
        </form>
    </div>
</div>

<!-- ==================== ANONYMIZATION CONFIRMATION MODAL ==================== -->
<div id="anonymizationModal" class="modal-overlay" style="display:none" role="dialog" aria-modal="true" aria-labelledby="anonymizationTitle">
    <div class="modal modal-sm">
        <div class="modal-header">
            <h2 id="anonymizationTitle" class="modal-title">Confirmation d'anonymisation</h2>
            <button class="btn-icon modal-close" onclick="closeModal('anonymizationModal')" aria-label="Fermer">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
        <div class="modal-body">
            <div class="alert alert-warning">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <p>Vous publiez dans le groupe <strong>Cas cliniques</strong>. Assurez-vous que toutes les données patient sont anonymisées conformément aux règles de confidentialité médicale.</p>
            </div>
            <label class="checkbox-label">
                <input type="checkbox" id="anonymizationConfirm" required>
                Je confirme que ce cas clinique est entièrement anonymisé et ne contient aucune donnée permettant d'identifier un patient.
            </label>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="closeModal('anonymizationModal')">Annuler</button>
                <button id="anonymizationSubmit" class="btn btn-primary" disabled>Publier</button>
            </div>
        </div>
    </div>
</div>

<!-- ==================== PROFILE EDIT MODAL ==================== -->
<div id="profileEditModal" class="modal-overlay" style="display:none" role="dialog" aria-modal="true" aria-labelledby="profileEditTitle">
    <div class="modal modal-md">
        <div class="modal-header">
            <h2 id="profileEditTitle" class="modal-title">Modifier le profil</h2>
            <button class="btn-icon modal-close" onclick="closeModal('profileEditModal')" aria-label="Fermer">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
        <form id="profileEditForm" class="modal-body" enctype="multipart/form-data">
            <div class="profile-avatar-edit">
                <img id="profileEditAvatar" class="avatar avatar-lg" src="<?= BASE_URL ?>/assets/img/default-avatar.png" alt="Avatar">
                <button type="button" id="changeAvatarBtn" class="btn btn-outline btn-sm">Changer la photo</button>
                <input type="file" id="profilePhotoInput" name="profile_photo" accept="image/*" style="display:none">
            </div>
            <div class="form-row">
                <div class="form-group form-group-half">
                    <label for="profileFirstName">Prénom</label>
                    <input type="text" id="profileFirstName" name="first_name" class="form-input" required>
                </div>
                <div class="form-group form-group-half">
                    <label for="profileLastName">Nom</label>
                    <input type="text" id="profileLastName" name="last_name" class="form-input" required>
                </div>
            </div>
            <div class="form-group">
                <label for="profileCity">Ville</label>
                <input type="text" id="profileCity" name="city" class="form-input">
            </div>
            <div class="form-group">
                <label for="profileInstitution">Institution</label>
                <input type="text" id="profileInstitution" name="institution" class="form-input">
            </div>
            <div class="form-group">
                <label for="profileBio">Bio</label>
                <textarea id="profileBio" name="bio" class="form-input" rows="3" placeholder="Quelques mots sur vous..."></textarea>
            </div>
            <div id="profileEditError" class="alert alert-error" style="display:none"></div>
            <button type="submit" class="btn btn-primary btn-block">Enregistrer</button>
        </form>
    </div>
</div>

<!-- ==================== ADMIN PANEL MODAL ==================== -->
<div id="adminPanelModal" class="modal-overlay" style="display:none" role="dialog" aria-modal="true" aria-labelledby="adminPanelTitle">
    <div class="modal modal-lg">
        <div class="modal-header">
            <h2 id="adminPanelTitle" class="modal-title">Panneau d'administration</h2>
            <button class="btn-icon modal-close" onclick="closeModal('adminPanelModal')" aria-label="Fermer">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
        <div class="modal-body">
            <div class="admin-tabs">
                <button class="admin-tab admin-tab-active" data-admin-tab="pending">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                    Membres en attente
                </button>
                <button class="admin-tab" data-admin-tab="reports">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
                    Signalements
                </button>
                <button class="admin-tab" data-admin-tab="stats">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                    Statistiques
                </button>
            </div>
            <div id="adminTabContent" class="admin-tab-content">
                <div id="adminPending" class="admin-panel-view">
                    <div id="pendingMembersList" class="admin-list"></div>
                    <p id="pendingEmpty" class="text-muted text-center" style="display:none">Aucune demande en attente.</p>
                </div>
                <div id="adminReports" class="admin-panel-view" style="display:none">
                    <div id="reportsList" class="admin-list"></div>
                    <p id="reportsEmpty" class="text-muted text-center" style="display:none">Aucun signalement.</p>
                </div>
                <div id="adminStats" class="admin-panel-view" style="display:none">
                    <div class="stats-grid">
                        <div class="stat-card">
                            <span class="stat-value" id="statMembers">--</span>
                            <span class="stat-label">Membres</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-value" id="statMessages">--</span>
                            <span class="stat-label">Messages</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-value" id="statGroups">--</span>
                            <span class="stat-label">Groupes</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-value" id="statFiles">--</span>
                            <span class="stat-label">Fichiers</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- ==================== EVENT DETAIL MODAL ==================== -->
<div id="eventDetailModal" class="modal-overlay" style="display:none" role="dialog" aria-modal="true" aria-labelledby="eventDetailTitle">
    <div class="modal modal-md">
        <div class="modal-header">
            <h2 id="eventDetailTitle" class="modal-title">Détail de l'événement</h2>
            <button class="btn-icon modal-close" onclick="closeModal('eventDetailModal')" aria-label="Fermer">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
        <div class="modal-body">
            <div class="event-detail">
                <div class="event-meta">
                    <span id="eventDate" class="event-date">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </span>
                    <span id="eventLocation" class="event-location">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    </span>
                </div>
                <div id="eventDescription" class="event-description"></div>
                <div id="eventAttendees" class="event-attendees"></div>
            </div>
        </div>
    </div>
</div>

<!-- ==================== DOCUMENT UPLOAD MODAL ==================== -->
<div id="documentUploadModal" class="modal-overlay" style="display:none" role="dialog" aria-modal="true" aria-labelledby="documentUploadTitle">
    <div class="modal modal-sm">
        <div class="modal-header">
            <h2 id="documentUploadTitle" class="modal-title">Partager un document</h2>
            <button class="btn-icon modal-close" onclick="closeModal('documentUploadModal')" aria-label="Fermer">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
        <form id="documentUploadForm" class="modal-body" enctype="multipart/form-data">
            <div class="form-group">
                <label for="docFile">Fichier</label>
                <input type="file" id="docFile" name="document" class="form-input-file" required>
            </div>
            <div class="form-group">
                <label for="docTitle">Titre</label>
                <input type="text" id="docTitle" name="title" class="form-input" required>
            </div>
            <div class="form-group">
                <label for="docDescription">Description</label>
                <textarea id="docDescription" name="description" class="form-input" rows="2"></textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Partager</button>
        </form>
    </div>
</div>

<!-- ==================== MEMBER PROFILE MODAL ==================== -->
<div id="memberProfileModal" class="modal-overlay" style="display:none" role="dialog" aria-modal="true" aria-labelledby="memberProfileTitle">
    <div class="modal modal-sm">
        <div class="modal-header">
            <h2 id="memberProfileTitle" class="modal-title">Profil du membre</h2>
            <button class="btn-icon modal-close" onclick="closeModal('memberProfileModal')" aria-label="Fermer">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
        <div class="modal-body">
            <div class="member-profile-card">
                <img id="memberProfileAvatar" class="avatar avatar-xl" src="" alt="Avatar">
                <h3 id="memberProfileName" class="member-profile-name"></h3>
                <span id="memberProfileStatus" class="member-profile-status badge"></span>
                <div class="member-profile-details">
                    <p id="memberProfileCity" class="member-profile-detail">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        <span></span>
                    </p>
                    <p id="memberProfileInstitution" class="member-profile-detail">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                        <span></span>
                    </p>
                    <p id="memberProfileBio" class="member-profile-bio"></p>
                </div>
            </div>
        </div>
    </div>
</div>

<?php endif; ?>

<script src="<?= BASE_URL ?>/assets/js/app.js"></script>
<script>
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/connect/sw.js');
}
</script>
</body>
</html>
