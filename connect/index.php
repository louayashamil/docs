<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/auth.php';

startSecureSession();
$loggedIn = isLoggedIn();
$user = $loggedIn ? getCurrentUser() : null;
$csrf = csrfToken();
?>
<!DOCTYPE html>
<html lang="fr" dir="ltr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#1565C0">
<meta name="description" content="NADAR Connect - Plateforme communautaire médicale des ophtalmologistes NADAR">
<title><?= APP_NAME ?></title>
<link rel="manifest" href="<?= BASE_URL ?>/manifest.json">
<link rel="icon" type="image/svg+xml" href="<?= BASE_URL ?>/assets/icons/icon.svg">
<link rel="apple-touch-icon" href="<?= BASE_URL ?>/assets/icons/icon-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?= BASE_URL ?>/assets/css/app.css">
<style>
:root{--primary:#1565C0;--primary-dark:#0D47A1;--primary-light:#1976D2;--primary-bg:#E3F2FD;--accent:#00897B;--danger:#D32F2F;--warning:#F57C00;--success:#388E3C;--text:#212121;--text-secondary:#616161;--text-hint:#9E9E9E;--bg:#F5F5F5;--surface:#FFFFFF;--border:#E0E0E0;--shadow:0 1px 3px rgba(0,0,0,.12);--shadow-lg:0 4px 16px rgba(0,0,0,.15);--radius:8px;--radius-lg:16px;--sidebar-w:320px;--header-h:56px;--composer-h:64px;--bottomnav-h:56px;--safe-bottom:env(safe-area-inset-bottom,0px)}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);line-height:1.5;overflow:hidden;height:100dvh;-webkit-font-smoothing:antialiased}
a{color:var(--primary);text-decoration:none}
button{font-family:inherit;cursor:pointer;border:none;background:none;font-size:inherit}
input,textarea,select{font-family:inherit;font-size:inherit}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 24px;border-radius:var(--radius);font-weight:600;font-size:14px;transition:all .2s;white-space:nowrap}
.btn-primary{background:var(--primary);color:#fff}.btn-primary:hover{background:var(--primary-dark)}
.btn-secondary{background:var(--primary-bg);color:var(--primary)}.btn-secondary:hover{background:#BBDEFB}
.btn-outline{border:2px solid var(--border);color:var(--text)}.btn-outline:hover{border-color:var(--primary);color:var(--primary)}
.btn-danger{background:var(--danger);color:#fff}.btn-danger:hover{background:#B71C1C}
.btn-google{background:#fff;border:2px solid var(--border);color:var(--text);padding:10px 24px;border-radius:var(--radius);font-weight:500;width:100%;display:flex;align-items:center;justify-content:center;gap:10px;transition:all .2s}.btn-google:hover{border-color:#4285F4;background:#f8f9fa}
.btn-google svg{width:20px;height:20px;flex-shrink:0}
.btn-sm{padding:6px 16px;font-size:13px}
.btn-block{width:100%}
.btn:disabled{opacity:.5;pointer-events:none}
.hidden{display:none!important}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;visibility:hidden;transition:all .25s}
.overlay.active{opacity:1;visibility:visible}
.modal{background:var(--surface);border-radius:var(--radius-lg);width:100%;max-width:480px;max-height:90vh;overflow-y:auto;box-shadow:var(--shadow-lg);transform:translateY(20px);transition:transform .25s}
.overlay.active .modal{transform:translateY(0)}
.modal-header{display:flex;align-items:center;justify-content:space-between;padding:20px 24px 0;position:sticky;top:0;background:var(--surface);z-index:1}
.modal-header h2{font-size:20px;font-weight:700}
.modal-close{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--text-secondary);transition:background .2s}.modal-close:hover{background:var(--bg)}
.modal-body{padding:20px 24px 24px}
.form-group{margin-bottom:16px}
.form-group label{display:block;font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:6px}
.form-group input,.form-group select,.form-group textarea{width:100%;padding:10px 14px;border:2px solid var(--border);border-radius:var(--radius);font-size:15px;transition:border-color .2s;background:var(--surface);color:var(--text)}
.form-group input:focus,.form-group select:focus,.form-group textarea:focus{outline:none;border-color:var(--primary)}
.form-group textarea{resize:vertical;min-height:80px}
.form-divider{display:flex;align-items:center;gap:12px;margin:20px 0;color:var(--text-hint);font-size:13px}
.form-divider::before,.form-divider::after{content:'';flex:1;height:1px;background:var(--border)}
.form-error{color:var(--danger);font-size:13px;margin-top:4px}

/* Toast */
#toast-container{position:fixed;top:16px;right:16px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none}
.toast{pointer-events:auto;display:flex;align-items:center;gap:10px;padding:12px 20px;border-radius:var(--radius);background:var(--surface);box-shadow:var(--shadow-lg);font-size:14px;font-weight:500;animation:toastIn .3s ease;max-width:360px}
.toast.success{border-left:4px solid var(--success)}.toast.error{border-left:4px solid var(--danger)}.toast.info{border-left:4px solid var(--primary)}
@keyframes toastIn{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}

/* LANDING PAGE */
.landing{height:100dvh;overflow-y:auto}
.landing-header{display:flex;align-items:center;justify-content:space-between;padding:16px 32px;background:var(--surface);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:100}
.landing-logo{display:flex;align-items:center;gap:12px;font-size:20px;font-weight:700;color:var(--primary)}
.landing-logo img{width:40px;height:40px;border-radius:10px}
.landing-nav{display:flex;gap:8px}
.hero{text-align:center;padding:80px 24px 60px;background:linear-gradient(135deg,#E3F2FD 0%,#BBDEFB 50%,#E8F5E9 100%)}
.hero-icon{width:100px;height:100px;margin:0 auto 24px;border-radius:24px;overflow:hidden}
.hero-icon img{width:100%;height:100%}
.hero h1{font-size:clamp(28px,5vw,48px);font-weight:800;color:var(--primary-dark);margin-bottom:12px}
.hero .subtitle{font-size:clamp(16px,2.5vw,20px);color:var(--primary);font-weight:500;margin-bottom:20px}
.hero .description{max-width:700px;margin:0 auto 36px;color:var(--text-secondary);font-size:clamp(14px,2vw,16px);line-height:1.7}
.hero-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:32px}
.hero-actions .btn{padding:14px 36px;font-size:16px;border-radius:12px}
.hero-note{font-size:13px;color:var(--text-hint);max-width:500px;margin:0 auto}
.hero-note strong{color:var(--text-secondary)}
.features{padding:60px 24px;background:var(--surface)}
.features h2{text-align:center;font-size:28px;margin-bottom:48px;color:var(--text)}
.features-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:32px;max-width:1000px;margin:0 auto}
.feature-card{text-align:center;padding:32px 24px}
.feature-card .icon{width:64px;height:64px;margin:0 auto 16px;border-radius:16px;background:var(--primary-bg);display:flex;align-items:center;justify-content:center;font-size:28px}
.feature-card h3{font-size:18px;margin-bottom:8px;color:var(--text)}
.feature-card p{font-size:14px;color:var(--text-secondary);line-height:1.6}
.landing-confidentiality{text-align:center;padding:40px 24px;background:var(--bg);border-top:1px solid var(--border)}
.landing-confidentiality p{max-width:600px;margin:0 auto;font-size:14px;color:var(--text-secondary);line-height:1.7}
.landing-confidentiality .shield{font-size:32px;margin-bottom:12px}
.landing-footer{text-align:center;padding:24px;font-size:13px;color:var(--text-hint);border-top:1px solid var(--border);background:var(--surface)}

/* APP SHELL */
.app-shell{display:flex;height:100dvh;overflow:hidden}
.sidebar{width:var(--sidebar-w);background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;flex-shrink:0;height:100dvh;overflow:hidden}
.sidebar-header{padding:16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.sidebar-header h2{font-size:18px;font-weight:700;color:var(--primary)}
.sidebar-actions{display:flex;gap:4px}
.sidebar-actions button{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--text-secondary);transition:background .2s}.sidebar-actions button:hover{background:var(--bg)}
.sidebar-user{padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;cursor:pointer;transition:background .2s}.sidebar-user:hover{background:var(--bg)}
.sidebar-user .avatar{width:40px;height:40px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;flex-shrink:0;overflow:hidden}
.sidebar-user .avatar img{width:100%;height:100%;object-fit:cover}
.sidebar-user .user-info{flex:1;min-width:0}
.sidebar-user .user-info .name{font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sidebar-user .user-info .status-text{font-size:12px;color:var(--text-hint)}
.group-list{flex:1;overflow-y:auto;padding:8px;display:flex;flex-direction:column}
.group-item{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:var(--radius);cursor:pointer;transition:background .2s;position:relative}
.group-item:hover{background:var(--bg)}
.group-item.active{background:var(--primary-bg)}
.group-item .group-icon{width:40px;height:40px;border-radius:50%;background:var(--primary-bg);color:var(--primary);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.group-item .group-info{flex:1;min-width:0}
.group-item .group-name{font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.group-item .group-last{font-size:12px;color:var(--text-hint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.group-item .badge{background:var(--primary);color:#fff;font-size:11px;font-weight:700;padding:2px 7px;border-radius:10px;flex-shrink:0}
.group-section{padding:8px 12px 4px;font-size:12px;font-weight:700;color:var(--text-hint);text-transform:uppercase;letter-spacing:.5px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none}
.group-section .chevron{transition:transform .2s;font-size:14px}
.group-section.collapsed .chevron{transform:rotate(-90deg)}
.group-section-items{overflow:hidden;transition:max-height .3s}
.group-section.collapsed+.group-section-items{max-height:0!important}

/* Main area */
.main-area{flex:1;display:flex;flex-direction:column;min-width:0;height:100dvh}
.main-header{height:var(--header-h);padding:0 16px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border);background:var(--surface);flex-shrink:0}
.main-header .back-btn{display:none;width:36px;height:36px;border-radius:50%;align-items:center;justify-content:center;color:var(--text-secondary)}
.main-header .header-info{flex:1;min-width:0}
.main-header .header-info h3{font-size:16px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.main-header .header-info p{font-size:12px;color:var(--text-hint)}
.main-header .header-actions{display:flex;gap:4px}
.main-header .header-actions button{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--text-secondary);transition:background .2s}.main-header .header-actions button:hover{background:var(--bg)}

/* Chat messages */
.chat-area{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:4px;background:var(--bg)}
.message{display:flex;gap:8px;max-width:80%;padding:4px 0;animation:msgIn .2s ease}
.message.sent{align-self:flex-end;flex-direction:row-reverse}
.message .msg-avatar{width:32px;height:32px;border-radius:50%;background:var(--primary-bg);color:var(--primary);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;overflow:hidden}
.message .msg-avatar img{width:100%;height:100%;object-fit:cover}
.msg-content{max-width:100%}
.msg-sender{font-size:12px;font-weight:600;color:var(--primary);margin-bottom:2px}
.msg-bubble{padding:10px 14px;border-radius:12px;background:var(--surface);box-shadow:0 1px 2px rgba(0,0,0,.08);font-size:14px;line-height:1.5;word-break:break-word;position:relative}
.message.sent .msg-bubble{background:var(--primary);color:#fff;border-bottom-right-radius:4px}
.message:not(.sent) .msg-bubble{border-bottom-left-radius:4px}
.msg-bubble img{max-width:280px;border-radius:8px;margin:4px 0;cursor:pointer;display:block}
.msg-bubble .file-attach{display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(0,0,0,.05);border-radius:8px;margin:4px 0;cursor:pointer;font-size:13px;font-weight:500}
.msg-meta{display:flex;align-items:center;gap:6px;margin-top:4px;font-size:11px;color:var(--text-hint)}
.message.sent .msg-meta{justify-content:flex-end;color:rgba(255,255,255,.7)}
.msg-actions{display:none;position:absolute;top:-4px;right:-4px;background:var(--surface);border-radius:8px;box-shadow:var(--shadow);padding:2px}
.msg-bubble:hover .msg-actions{display:flex}
.msg-actions button{width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--text-secondary)}.msg-actions button:hover{background:var(--bg)}
.date-divider{text-align:center;padding:12px 0;font-size:12px;color:var(--text-hint);font-weight:500}
.date-divider span{background:var(--bg);padding:4px 16px;border-radius:12px;border:1px solid var(--border)}
@keyframes msgIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}

/* Composer */
.composer{padding:8px 16px;padding-bottom:calc(8px + var(--safe-bottom));border-top:1px solid var(--border);background:var(--surface);display:flex;align-items:flex-end;gap:8px;flex-shrink:0}
.composer .attach-btn{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--text-secondary);flex-shrink:0;transition:background .2s}.composer .attach-btn:hover{background:var(--bg)}
.composer .composer-input{flex:1;min-height:40px;max-height:120px;padding:8px 14px;border:2px solid var(--border);border-radius:20px;resize:none;overflow-y:auto;font-size:15px;line-height:1.4;background:var(--bg);transition:border-color .2s}
.composer .composer-input:focus{outline:none;border-color:var(--primary)}
.composer .send-btn{width:40px;height:40px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .2s;opacity:.5}.composer .send-btn.active{opacity:1}.composer .send-btn:hover{background:var(--primary-dark)}
.composer-preview{padding:8px 16px;border-top:1px solid var(--border);background:var(--surface);display:flex;align-items:center;gap:12px}
.composer-preview img{width:60px;height:60px;object-fit:cover;border-radius:8px}
.composer-preview .preview-info{flex:1;font-size:13px;color:var(--text-secondary)}
.composer-preview .preview-remove{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--danger)}

/* Bottom nav - mobile */
.bottom-nav{display:none;height:var(--bottomnav-h);padding-bottom:var(--safe-bottom);border-top:1px solid var(--border);background:var(--surface);flex-shrink:0}
.bottom-nav-inner{display:flex;height:100%}
.bottom-nav-item{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;color:var(--text-hint);font-size:11px;font-weight:500;transition:color .2s;position:relative}
.bottom-nav-item.active{color:var(--primary)}
.bottom-nav-item .nav-icon{font-size:22px}
.bottom-nav-item .nav-badge{position:absolute;top:4px;right:calc(50% - 18px);width:8px;height:8px;border-radius:50%;background:var(--danger)}

/* Views */
.view-panel{position:absolute;inset:0;background:var(--bg);z-index:50;display:flex;flex-direction:column;overflow:hidden;transform:translateX(100%);transition:transform .3s ease}
.view-panel.active{transform:translateX(0)}
.view-header{height:var(--header-h);padding:0 16px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border);background:var(--surface);flex-shrink:0}
.view-header .back-btn{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--text-secondary)}
.view-header h3{flex:1;font-size:16px;font-weight:700}
.view-content{flex:1;overflow-y:auto;padding:16px}

/* Library */
.library-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px}
.library-item{background:var(--surface);border-radius:var(--radius);overflow:hidden;cursor:pointer;transition:box-shadow .2s;border:1px solid var(--border)}
.library-item:hover{box-shadow:var(--shadow)}
.library-item .thumb{width:100%;aspect-ratio:1;background:var(--primary-bg);display:flex;align-items:center;justify-content:center;font-size:32px;color:var(--primary);overflow:hidden}
.library-item .thumb img{width:100%;height:100%;object-fit:cover}
.library-item .lib-info{padding:8px 10px;font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* Agenda */
.agenda-list{display:flex;flex-direction:column;gap:12px}
.agenda-item{background:var(--surface);border-radius:var(--radius);padding:16px;border:1px solid var(--border);border-left:4px solid var(--primary)}
.agenda-item .agenda-date{font-size:12px;font-weight:700;color:var(--primary);text-transform:uppercase;margin-bottom:4px}
.agenda-item .agenda-title{font-size:15px;font-weight:600;margin-bottom:4px}
.agenda-item .agenda-desc{font-size:13px;color:var(--text-secondary)}

/* Directory */
.directory-list{display:flex;flex-direction:column;gap:8px}
.directory-item{display:flex;align-items:center;gap:12px;padding:12px;background:var(--surface);border-radius:var(--radius);border:1px solid var(--border);cursor:pointer;transition:box-shadow .2s}
.directory-item:hover{box-shadow:var(--shadow)}
.directory-item .dir-avatar{width:44px;height:44px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;flex-shrink:0;overflow:hidden}
.directory-item .dir-avatar img{width:100%;height:100%;object-fit:cover}
.directory-item .dir-info{flex:1;min-width:0}
.directory-item .dir-name{font-weight:600;font-size:14px}
.directory-item .dir-role{font-size:12px;color:var(--text-hint)}

/* Admin */
.admin-tabs{display:flex;gap:4px;padding:0 16px;background:var(--surface);border-bottom:1px solid var(--border);overflow-x:auto}
.admin-tab{padding:12px 16px;font-size:14px;font-weight:500;color:var(--text-secondary);border-bottom:2px solid transparent;white-space:nowrap;transition:all .2s}
.admin-tab.active{color:var(--primary);border-bottom-color:var(--primary)}
.admin-stat{background:var(--surface);border-radius:var(--radius);padding:20px;border:1px solid var(--border);text-align:center}
.admin-stat .stat-value{font-size:32px;font-weight:800;color:var(--primary)}
.admin-stat .stat-label{font-size:13px;color:var(--text-secondary);margin-top:4px}
.admin-stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px}
.pending-card{background:var(--surface);border-radius:var(--radius);padding:16px;border:1px solid var(--border);display:flex;align-items:center;gap:12px;margin-bottom:8px}
.pending-card .pending-info{flex:1}
.pending-card .pending-name{font-weight:600;font-size:14px}
.pending-card .pending-detail{font-size:12px;color:var(--text-hint)}
.pending-card .pending-actions{display:flex;gap:6px}

/* Profile */
.profile-card{background:var(--surface);border-radius:var(--radius-lg);padding:32px;text-align:center;border:1px solid var(--border)}
.profile-avatar{width:80px;height:80px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;margin:0 auto 16px;overflow:hidden}
.profile-avatar img{width:100%;height:100%;object-fit:cover}
.profile-name{font-size:20px;font-weight:700;margin-bottom:4px}
.profile-role{font-size:14px;color:var(--text-hint);margin-bottom:20px}
.profile-detail{display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--border);font-size:14px;text-align:left}
.profile-detail .detail-label{font-weight:600;color:var(--text-secondary);width:100px;flex-shrink:0}
.profile-actions{display:flex;flex-direction:column;gap:8px;margin-top:24px}

/* Notifications panel */
.notif-panel{position:fixed;top:0;right:0;width:360px;max-width:100%;height:100dvh;background:var(--surface);box-shadow:var(--shadow-lg);z-index:900;transform:translateX(100%);transition:transform .3s ease;display:flex;flex-direction:column}
.notif-panel.active{transform:translateX(0)}
.notif-panel .notif-header{padding:16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.notif-panel .notif-header h3{font-size:18px;font-weight:700}
.notif-list{flex:1;overflow-y:auto;padding:8px}
.notif-item{display:flex;gap:12px;padding:12px;border-radius:var(--radius);cursor:pointer;transition:background .2s}
.notif-item:hover{background:var(--bg)}
.notif-item.unread{background:var(--primary-bg)}
.notif-item .notif-icon{width:36px;height:36px;border-radius:50%;background:var(--primary-bg);color:var(--primary);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
.notif-item .notif-text{flex:1;font-size:13px;line-height:1.4}
.notif-item .notif-time{font-size:11px;color:var(--text-hint);margin-top:2px}

/* Search overlay */
.search-overlay{position:fixed;inset:0;background:var(--surface);z-index:950;display:flex;flex-direction:column;transform:translateY(-100%);transition:transform .3s ease}
.search-overlay.active{transform:translateY(0)}
.search-bar{display:flex;align-items:center;gap:12px;padding:8px 16px;border-bottom:1px solid var(--border)}
.search-bar input{flex:1;height:44px;border:none;font-size:16px;background:none;outline:none}
.search-bar button{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--text-secondary)}
.search-results{flex:1;overflow-y:auto;padding:16px}
.search-results .search-empty{text-align:center;padding:40px;color:var(--text-hint);font-size:14px}

/* Image viewer */
.image-viewer{position:fixed;inset:0;background:rgba(0,0,0,.95);z-index:2000;display:flex;align-items:center;justify-content:center;flex-direction:column;opacity:0;visibility:hidden;transition:all .25s}
.image-viewer.active{opacity:1;visibility:visible}
.image-viewer img{max-width:90vw;max-height:80vh;object-fit:contain;border-radius:4px;transition:transform .3s}
.image-viewer .viewer-controls{position:absolute;top:16px;right:16px;display:flex;gap:8px}
.image-viewer .viewer-controls button{width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.15);color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;backdrop-filter:blur(8px)}.image-viewer .viewer-controls button:hover{background:rgba(255,255,255,.3)}

/* Pending validation */
.pending-page{display:flex;align-items:center;justify-content:center;height:100dvh;padding:24px;background:var(--bg)}
.pending-box{text-align:center;max-width:440px;background:var(--surface);padding:48px 32px;border-radius:var(--radius-lg);box-shadow:var(--shadow)}
.pending-box .pending-icon{font-size:64px;margin-bottom:16px}
.pending-box h2{font-size:22px;margin-bottom:12px;color:var(--text)}
.pending-box p{font-size:14px;color:var(--text-secondary);line-height:1.7;margin-bottom:24px}

/* Responsive */
@media(max-width:768px){
.sidebar{position:fixed;left:0;top:0;z-index:100;transform:translateX(-100%);transition:transform .3s ease;width:85%;max-width:320px}
.sidebar.open{transform:translateX(0)}
.sidebar-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:99;display:none}.sidebar-backdrop.active{display:block}
.main-header .back-btn{display:flex}
.bottom-nav{display:block}
.message{max-width:90%}
.notif-panel{width:100%}
}
</style>
</head>
<body>

<?php if (!$loggedIn): ?>
<!-- ==================== LANDING PAGE ==================== -->
<div class="landing" id="landing">
  <header class="landing-header">
    <div class="landing-logo">
      <img src="<?= BASE_URL ?>/assets/icons/icon.svg" alt="NADAR Connect">
      <span><?= APP_NAME ?></span>
    </div>
    <nav class="landing-nav">
      <button class="btn btn-secondary btn-sm" onclick="openModal('loginModal')">Se connecter</button>
    </nav>
  </header>

  <section class="hero">
    <div class="hero-icon">
      <img src="<?= BASE_URL ?>/assets/icons/icon.svg" alt="NADAR Connect">
    </div>
    <h1>NADAR Connect</h1>
    <p class="subtitle">Plateforme communautaire m&eacute;dicale des ophtalmologistes NADAR</p>
    <p class="description">NADAR Connect est une plateforme communautaire priv&eacute;e d&eacute;di&eacute;e aux ophtalmologistes du r&eacute;seau NADAR. Elle permet de centraliser les annonces scientifiques, les discussions professionnelles, les cas cliniques anonymis&eacute;s, les fichiers et les programmes d&rsquo;activit&eacute;s.</p>
    <div class="hero-actions">
      <button class="btn btn-primary" onclick="openModal('loginModal')">Se connecter</button>
      <button class="btn btn-outline" onclick="openModal('registerModal')">Demander l&rsquo;acc&egrave;s</button>
    </div>
    <p class="hero-note"><strong>Acc&egrave;s r&eacute;serv&eacute;</strong> aux professionnels de sant&eacute; valid&eacute;s par l&rsquo;&eacute;quipe NADAR.</p>
  </section>

  <section class="features">
    <h2>Fonctionnalit&eacute;s</h2>
    <div class="features-grid">
      <div class="feature-card">
        <div class="icon">&#128172;</div>
        <h3>Discussions</h3>
        <p>Groupes de discussion th&eacute;matiques pour &eacute;changer entre confr&egrave;res sur les pratiques cliniques et les avanc&eacute;es scientifiques.</p>
      </div>
      <div class="feature-card">
        <div class="icon">&#128065;</div>
        <h3>Cas cliniques</h3>
        <p>Partagez et analysez des cas cliniques anonymis&eacute;s dans un espace s&eacute;curis&eacute; et confidentiel.</p>
      </div>
      <div class="feature-card">
        <div class="icon">&#128197;</div>
        <h3>Agenda</h3>
        <p>Retrouvez les programmes scientifiques, conf&eacute;rences et &eacute;v&eacute;nements du r&eacute;seau NADAR.</p>
      </div>
      <div class="feature-card">
        <div class="icon">&#128218;</div>
        <h3>Biblioth&egrave;que</h3>
        <p>Acc&eacute;dez &agrave; une biblioth&egrave;que partag&eacute;e de documents, pr&eacute;sentations et publications.</p>
      </div>
      <div class="feature-card">
        <div class="icon">&#128101;</div>
        <h3>Annuaire</h3>
        <p>Consultez l&rsquo;annuaire des membres du r&eacute;seau avec leurs sp&eacute;cialit&eacute;s et coordonn&eacute;es.</p>
      </div>
      <div class="feature-card">
        <div class="icon">&#128274;</div>
        <h3>S&eacute;curit&eacute;</h3>
        <p>Plateforme priv&eacute;e avec acc&egrave;s contr&ocirc;l&eacute;, respectant la confidentialit&eacute; m&eacute;dicale et le RGPD.</p>
      </div>
    </div>
  </section>

  <section class="landing-confidentiality">
    <div class="shield">&#128737;</div>
    <p>NADAR Connect respecte la <strong>confidentialit&eacute; m&eacute;dicale</strong> et les r&eacute;glementations en vigueur. Toutes les donn&eacute;es patients partag&eacute;es doivent &ecirc;tre <strong>strictement anonymis&eacute;es</strong>. L&rsquo;acc&egrave;s est r&eacute;serv&eacute; aux professionnels de sant&eacute; valid&eacute;s.</p>
  </section>

  <footer class="landing-footer">
    &copy; <?= date('Y') ?> NADAR Connect &mdash; Tous droits r&eacute;serv&eacute;s
  </footer>
</div>

<!-- ===== LOGIN MODAL ===== -->
<div class="overlay" id="loginModal">
  <div class="modal">
    <div class="modal-header">
      <h2>Se connecter</h2>
      <button class="modal-close" onclick="closeModal('loginModal')">&times;</button>
    </div>
    <div class="modal-body">
      <form id="loginForm" onsubmit="handleLogin(event)">
        <input type="hidden" name="csrf_token" value="<?= $csrf ?>">
        <div class="form-group">
          <label for="login-email">Adresse e-mail</label>
          <input type="email" id="login-email" name="email" required autocomplete="email" placeholder="votre@email.com">
        </div>
        <div class="form-group">
          <label for="login-password">Mot de passe</label>
          <input type="password" id="login-password" name="password" required autocomplete="current-password" placeholder="Votre mot de passe">
        </div>
        <div id="login-error" class="form-error hidden"></div>
        <button type="submit" class="btn btn-primary btn-block" id="loginSubmit">Se connecter</button>
        <p style="text-align:center;margin-top:10px">
          <a href="#" onclick="event.preventDefault();closeModal('loginModal');openModal('forgotModal')" style="font-size:13px;color:var(--text-hint)">Mot de passe oubli&eacute; ?</a>
        </p>
        <div class="form-divider">ou</div>
        <button type="button" class="btn-google" onclick="handleGoogleLogin()">
          <svg viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Continuer avec Google
        </button>
      </form>
      <p style="text-align:center;margin-top:20px;font-size:13px;color:var(--text-hint)">
        Pas encore membre ? <a href="#" onclick="event.preventDefault();closeModal('loginModal');openModal('registerModal')">Demander l&rsquo;acc&egrave;s</a>
      </p>
    </div>
  </div>
</div>

<!-- ===== FORGOT PASSWORD MODAL ===== -->
<div class="overlay" id="forgotModal">
  <div class="modal">
    <div class="modal-header">
      <h2>Mot de passe oubli&eacute;</h2>
      <button class="modal-close" onclick="closeModal('forgotModal')">&times;</button>
    </div>
    <div class="modal-body">
      <p style="font-size:14px;color:var(--text-secondary);margin-bottom:20px">Entrez votre adresse e-mail. Si un compte existe, vous recevrez un lien de r&eacute;initialisation.</p>
      <form id="forgotForm" onsubmit="handleForgot(event)">
        <input type="hidden" name="csrf_token" value="<?= $csrf ?>">
        <div class="form-group">
          <label for="forgot-email">Adresse e-mail</label>
          <input type="email" id="forgot-email" name="email" required placeholder="votre@email.com">
        </div>
        <div id="forgot-error" class="form-error hidden"></div>
        <div id="forgot-success" class="hidden" style="color:var(--success);font-size:13px;margin-bottom:12px"></div>
        <button type="submit" class="btn btn-primary btn-block">Envoyer le lien</button>
      </form>
      <p style="text-align:center;margin-top:16px;font-size:13px">
        <a href="#" onclick="event.preventDefault();closeModal('forgotModal');openModal('loginModal')">Retour &agrave; la connexion</a>
      </p>
    </div>
  </div>
</div>

<!-- ===== REGISTER MODAL ===== -->
<div class="overlay" id="registerModal">
  <div class="modal" style="max-width:520px">
    <div class="modal-header">
      <h2>Demander l&rsquo;acc&egrave;s</h2>
      <button class="modal-close" onclick="closeModal('registerModal')">&times;</button>
    </div>
    <div class="modal-body">
      <form id="registerForm" onsubmit="handleRegister(event)" enctype="multipart/form-data">
        <input type="hidden" name="csrf_token" value="<?= $csrf ?>">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label for="reg-first">Pr&eacute;nom</label>
            <input type="text" id="reg-first" name="first_name" required placeholder="Pr&eacute;nom">
          </div>
          <div class="form-group">
            <label for="reg-last">Nom</label>
            <input type="text" id="reg-last" name="last_name" required placeholder="Nom">
          </div>
        </div>
        <div class="form-group">
          <label for="reg-email">Adresse e-mail</label>
          <input type="email" id="reg-email" name="email" required placeholder="votre@email.com">
        </div>
        <div class="form-group">
          <label for="reg-password">Mot de passe</label>
          <input type="password" id="reg-password" name="password" required minlength="8" placeholder="8 caract&egrave;res minimum">
        </div>
        <div class="form-group">
          <label for="reg-city">Ville</label>
          <input type="text" id="reg-city" name="city" required placeholder="Votre ville">
        </div>
        <div class="form-group">
          <label for="reg-status">Statut professionnel</label>
          <select id="reg-status" name="status" required>
            <option value="">S&eacute;lectionnez votre statut</option>
            <option value="ophtalmologue">Ophtalmologue</option>
            <option value="résident">R&eacute;sident</option>
            <option value="professeur">Professeur</option>
            <option value="invité">Invit&eacute;</option>
          </select>
        </div>
        <div class="form-group">
          <label for="reg-institution">Institution / &Eacute;tablissement</label>
          <input type="text" id="reg-institution" name="institution" placeholder="Nom de votre &eacute;tablissement">
        </div>
        <div class="form-group">
          <label for="reg-photo">Photo de profil</label>
          <input type="file" id="reg-photo" name="profile_photo" accept="image/jpeg,image/png,image/webp" style="padding:8px">
        </div>
        <div id="register-error" class="form-error hidden"></div>
        <button type="submit" class="btn btn-primary btn-block" id="registerSubmit">Envoyer la demande</button>
      </form>
      <p style="text-align:center;margin-top:16px;font-size:13px">
        D&eacute;j&agrave; membre ? <a href="#" onclick="event.preventDefault();closeModal('registerModal');openModal('loginModal')">Se connecter</a>
      </p>
    </div>
  </div>
</div>

<?php else: ?>
<?php
  $userInitials = mb_strtoupper(mb_substr($user['first_name'],0,1) . mb_substr($user['last_name'],0,1));
  $userName = htmlspecialchars($user['first_name'] . ' ' . $user['last_name']);
  $userRole = htmlspecialchars($user['role']);
?>

<!-- ==================== APP SHELL ==================== -->
<div class="app-shell" id="app">
  <!-- Sidebar backdrop for mobile -->
  <div class="sidebar-backdrop" id="sidebarBackdrop" onclick="toggleSidebar(false)"></div>

  <!-- Sidebar -->
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-header">
      <h2>NADAR Connect</h2>
      <div class="sidebar-actions">
        <button onclick="openNotifPanel()" title="Notifications">&#128276;</button>
        <button onclick="openSearchOverlay()" title="Rechercher">&#128269;</button>
      </div>
    </div>
    <div class="sidebar-user" onclick="showView('profileView')">
      <div class="avatar">
        <?php if ($user['profile_photo']): ?>
          <img src="<?= BASE_URL ?>/uploads/<?= htmlspecialchars($user['profile_photo']) ?>" alt="<?= $userName ?>">
        <?php else: ?>
          <?= $userInitials ?>
        <?php endif; ?>
      </div>
      <div class="user-info">
        <div class="name"><?= $userName ?></div>
        <div class="status-text"><?= $userRole ?></div>
      </div>
    </div>
    <div class="group-list" id="groupList">
      <!-- Discussion générale - always prominent -->
      <div class="group-item active" data-group="discussion-generale" onclick="selectGroup(this,'discussion-generale','Discussion générale')">
        <div class="group-icon">&#128172;</div>
        <div class="group-info">
          <div class="group-name">Discussion g&eacute;n&eacute;rale</div>
          <div class="group-last">Bienvenue sur NADAR Connect</div>
        </div>
        <span class="badge hidden" id="badge-general"></span>
      </div>

      <!-- Autre section (expandable) -->
      <div class="group-section" id="sectionAutre" onclick="toggleSection('sectionAutre')">
        Autre <span class="chevron">&#9660;</span>
      </div>
      <div class="group-section-items" id="sectionAutreItems" style="max-height:500px">
        <div class="group-item" data-group="cas-cliniques" onclick="selectGroup(this,'cas-cliniques','Cas cliniques')">
          <div class="group-icon">&#128065;</div>
          <div class="group-info">
            <div class="group-name">Cas cliniques</div>
            <div class="group-last">Cas anonymis&eacute;s</div>
          </div>
          <span class="badge hidden" id="badge-cas-cliniques"></span>
        </div>
        <div class="group-item" data-group="annonces-officielles" onclick="selectGroup(this,'annonces-officielles','Annonces officielles')">
          <div class="group-icon">&#128227;</div>
          <div class="group-info">
            <div class="group-name">Annonces scientifiques</div>
            <div class="group-last">Derni&egrave;res annonces</div>
          </div>
          <span class="badge hidden" id="badge-annonces"></span>
        </div>
        <div class="group-item" data-group="congres-formations" onclick="selectGroup(this,'congres-formations','Congrès et formations')">
          <div class="group-icon">&#127891;</div>
          <div class="group-info">
            <div class="group-name">Formation continue</div>
            <div class="group-last">Ressources p&eacute;dagogiques</div>
          </div>
          <span class="badge hidden" id="badge-formation"></span>
        </div>
        <div class="group-item" data-group="retine" onclick="selectGroup(this,'retine','Rétine')">
          <div class="group-icon">&#9879;</div>
          <div class="group-info">
            <div class="group-name">Techniques chirurgicales</div>
            <div class="group-last">Discussions chirurgicales</div>
          </div>
          <span class="badge hidden" id="badge-chirurgie"></span>
        </div>
      </div>

      <!-- Sidebar bottom navigation items -->
      <div style="margin-top:auto;padding-top:8px;border-top:1px solid var(--border)">
        <div class="group-item" onclick="showView('libraryView')">
          <div class="group-icon">&#128218;</div>
          <div class="group-info"><div class="group-name">Biblioth&egrave;que</div></div>
        </div>
        <div class="group-item" onclick="showView('agendaView')">
          <div class="group-icon">&#128197;</div>
          <div class="group-info"><div class="group-name">Agenda</div></div>
        </div>
        <div class="group-item" onclick="showView('directoryView')">
          <div class="group-icon">&#128101;</div>
          <div class="group-info"><div class="group-name">Annuaire</div></div>
        </div>
        <?php if ($user['role'] === 'admin'): ?>
        <div class="group-item" onclick="showView('adminView')">
          <div class="group-icon">&#9881;</div>
          <div class="group-info"><div class="group-name">Administration</div></div>
        </div>
        <?php endif; ?>
      </div>
    </div>
  </aside>

  <!-- Main area -->
  <div class="main-area" id="mainArea" style="position:relative">
    <!-- Main header -->
    <div class="main-header" id="mainHeader">
      <button class="back-btn" onclick="toggleSidebar(true)">&#9776;</button>
      <div class="header-info">
        <h3 id="headerTitle">Discussion g&eacute;n&eacute;rale</h3>
        <p id="headerSubtitle">Groupe principal</p>
      </div>
      <div class="header-actions">
        <button onclick="openSearchOverlay()" title="Rechercher">&#128269;</button>
        <button onclick="openNotifPanel()" title="Notifications">&#128276;</button>
        <button id="headerMenuBtn" onclick="toggleHeaderMenu()" title="Plus">&#8942;</button>
      </div>
    </div>

    <!-- Chat area -->
    <div class="chat-area" id="chatArea">
      <div class="date-divider"><span>Aujourd&rsquo;hui</span></div>
      <div class="message">
        <div class="msg-avatar">NC</div>
        <div class="msg-content">
          <div class="msg-sender">NADAR Connect</div>
          <div class="msg-bubble">
            Bienvenue sur NADAR Connect ! Cette plateforme est d&eacute;di&eacute;e aux &eacute;changes professionnels entre ophtalmologistes du r&eacute;seau NADAR. Respectez la confidentialit&eacute; m&eacute;dicale dans toutes vos publications.
            <div class="msg-actions">
              <button onclick="openMsgInfo()" title="Info">&#8505;</button>
              <button onclick="openReportModal()" title="Signaler">&#9873;</button>
            </div>
          </div>
          <div class="msg-meta">10:00</div>
        </div>
      </div>
    </div>

    <!-- Composer preview (hidden by default) -->
    <div class="composer-preview hidden" id="composerPreview">
      <img id="previewThumb" src="" alt="">
      <div class="preview-info" id="previewInfo">fichier.jpg</div>
      <button class="preview-remove" onclick="clearAttachment()" title="Supprimer">&times;</button>
    </div>

    <!-- Composer -->
    <div class="composer" id="composer">
      <button class="attach-btn" onclick="document.getElementById('fileInput').click()" title="Joindre">&#128206;</button>
      <input type="file" id="fileInput" style="display:none" accept="image/*,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,video/mp4,video/webm" onchange="handleFileSelect(event)">
      <textarea class="composer-input" id="composerInput" placeholder="&Eacute;crivez un message..." rows="1" oninput="autoResizeComposer(this)"></textarea>
      <button class="send-btn" id="sendBtn" onclick="sendMessage()" title="Envoyer">&#10148;</button>
    </div>

    <!-- ===== VIEW PANELS (slide over main area) ===== -->

    <!-- Library View -->
    <div class="view-panel" id="libraryView">
      <div class="view-header">
        <button class="back-btn" onclick="hideView('libraryView')">&#8592;</button>
        <h3>Biblioth&egrave;que</h3>
      </div>
      <div class="view-content">
        <div class="library-grid" id="libraryGrid">
          <div class="library-item">
            <div class="thumb">&#128196;</div>
            <div class="lib-info">Protocole chirurgical.pdf</div>
          </div>
          <div class="library-item">
            <div class="thumb">&#128196;</div>
            <div class="lib-info">Guide r&eacute;tine.pdf</div>
          </div>
          <div class="library-item">
            <div class="thumb">&#128247;</div>
            <div class="lib-info">OCT r&eacute;f&eacute;rence.png</div>
          </div>
          <div class="library-item">
            <div class="thumb">&#128196;</div>
            <div class="lib-info">Pr&eacute;sentation congr&egrave;s.pptx</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Agenda View -->
    <div class="view-panel" id="agendaView">
      <div class="view-header">
        <button class="back-btn" onclick="hideView('agendaView')">&#8592;</button>
        <h3>Agenda</h3>
      </div>
      <div class="view-content">
        <div class="agenda-list" id="agendaList">
          <div class="agenda-item">
            <div class="agenda-date">Prochainement</div>
            <div class="agenda-title">Aucun &eacute;v&eacute;nement programm&eacute;</div>
            <div class="agenda-desc">Les &eacute;v&eacute;nements et activit&eacute;s NADAR appara&icirc;tront ici.</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Directory View -->
    <div class="view-panel" id="directoryView">
      <div class="view-header">
        <button class="back-btn" onclick="hideView('directoryView')">&#8592;</button>
        <h3>Annuaire</h3>
      </div>
      <div class="view-content">
        <div style="margin-bottom:16px">
          <input type="text" placeholder="Rechercher un membre..." style="width:100%;padding:10px 14px;border:2px solid var(--border);border-radius:var(--radius);font-size:14px" oninput="filterDirectory(this.value)">
        </div>
        <div class="directory-list" id="directoryList">
          <div class="directory-item">
            <div class="dir-avatar"><?= $userInitials ?></div>
            <div class="dir-info">
              <div class="dir-name"><?= $userName ?></div>
              <div class="dir-role"><?= $userRole ?></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Profile View -->
    <div class="view-panel" id="profileView">
      <div class="view-header">
        <button class="back-btn" onclick="hideView('profileView')">&#8592;</button>
        <h3>Mon profil</h3>
      </div>
      <div class="view-content">
        <div class="profile-card">
          <div class="profile-avatar">
            <?php if ($user['profile_photo']): ?>
              <img src="<?= BASE_URL ?>/uploads/<?= htmlspecialchars($user['profile_photo']) ?>" alt="<?= $userName ?>">
            <?php else: ?>
              <?= $userInitials ?>
            <?php endif; ?>
          </div>
          <div class="profile-name"><?= $userName ?></div>
          <div class="profile-role"><?= $userRole ?></div>
          <div class="profile-detail"><span class="detail-label">E-mail</span><span><?= htmlspecialchars($user['email']) ?></span></div>
          <div class="profile-actions">
            <button class="btn btn-secondary" onclick="openModal('profileEditModal')">Modifier le profil</button>
            <button class="btn btn-outline" onclick="handleLogout()">Se d&eacute;connecter</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Admin View -->
    <div class="view-panel" id="adminView">
      <div class="view-header">
        <button class="back-btn" onclick="hideView('adminView')">&#8592;</button>
        <h3>Administration</h3>
      </div>
      <div class="admin-tabs">
        <button class="admin-tab active" onclick="switchAdminTab(this,'adminPending')">En attente</button>
        <button class="admin-tab" onclick="switchAdminTab(this,'adminReports')">Signalements</button>
        <button class="admin-tab" onclick="switchAdminTab(this,'adminStats')">Statistiques</button>
      </div>
      <div class="view-content">
        <div id="adminPending">
          <h4 style="margin-bottom:16px;font-size:16px">Membres en attente de validation</h4>
          <div id="pendingList">
            <p style="color:var(--text-hint);font-size:14px;text-align:center;padding:24px">Aucune demande en attente.</p>
          </div>
        </div>
        <div id="adminReports" class="hidden">
          <h4 style="margin-bottom:16px;font-size:16px">Signalements</h4>
          <div id="reportsList">
            <p style="color:var(--text-hint);font-size:14px;text-align:center;padding:24px">Aucun signalement.</p>
          </div>
        </div>
        <div id="adminStats" class="hidden">
          <div class="admin-stats-grid">
            <div class="admin-stat"><div class="stat-value" id="statMembers">0</div><div class="stat-label">Membres</div></div>
            <div class="admin-stat"><div class="stat-value" id="statMessages">0</div><div class="stat-label">Messages</div></div>
            <div class="admin-stat"><div class="stat-value" id="statGroups">0</div><div class="stat-label">Groupes</div></div>
            <div class="admin-stat"><div class="stat-value" id="statFiles">0</div><div class="stat-label">Fichiers</div></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Bottom navigation (mobile) -->
  <div class="bottom-nav" id="bottomNav">
    <div class="bottom-nav-inner">
      <button class="bottom-nav-item active" onclick="switchBottomTab(this,'discussions')">
        <span class="nav-icon">&#128172;</span>
        Discussions
      </button>
      <button class="bottom-nav-item" onclick="switchBottomTab(this,'autres')">
        <span class="nav-icon">&#9776;</span>
        Autres
      </button>
      <button class="bottom-nav-item" onclick="switchBottomTab(this,'profil')">
        <span class="nav-icon">&#128100;</span>
        Profil
      </button>
    </div>
  </div>
</div>

<!-- ===== PROFILE EDIT MODAL ===== -->
<div class="overlay" id="profileEditModal">
  <div class="modal" style="max-width:520px">
    <div class="modal-header">
      <h2>Modifier le profil</h2>
      <button class="modal-close" onclick="closeModal('profileEditModal')">&times;</button>
    </div>
    <div class="modal-body">
      <form id="profileEditForm" onsubmit="handleProfileEdit(event)" enctype="multipart/form-data">
        <input type="hidden" name="csrf_token" value="<?= $csrf ?>">
        <div style="text-align:center;margin-bottom:20px">
          <div class="profile-avatar" style="margin:0 auto 12px;cursor:pointer" onclick="document.getElementById('editPhoto').click()">
            <?php if ($user['profile_photo']): ?>
              <img src="<?= BASE_URL ?>/uploads/<?= htmlspecialchars($user['profile_photo']) ?>" alt="" id="editPhotoPreview">
            <?php else: ?>
              <span id="editPhotoInitials"><?= $userInitials ?></span>
            <?php endif; ?>
          </div>
          <input type="file" id="editPhoto" name="profile_photo" accept="image/jpeg,image/png,image/webp" style="display:none" onchange="previewEditPhoto(event)">
          <button type="button" style="font-size:13px;color:var(--primary)" onclick="document.getElementById('editPhoto').click()">Changer la photo</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label for="edit-first">Pr&eacute;nom</label>
            <input type="text" id="edit-first" name="first_name" value="<?= htmlspecialchars($user['first_name']) ?>" required>
          </div>
          <div class="form-group">
            <label for="edit-last">Nom</label>
            <input type="text" id="edit-last" name="last_name" value="<?= htmlspecialchars($user['last_name']) ?>" required>
          </div>
        </div>
        <div class="form-group">
          <label for="edit-email">Adresse e-mail</label>
          <input type="email" id="edit-email" value="<?= htmlspecialchars($user['email']) ?>" disabled style="background:var(--bg)">
        </div>
        <div id="profile-edit-error" class="form-error hidden"></div>
        <button type="submit" class="btn btn-primary btn-block">Enregistrer</button>
      </form>
    </div>
  </div>
</div>

<!-- ===== IMAGE VIEWER ===== -->
<div class="image-viewer" id="imageViewer" onclick="closeImageViewer(event)">
  <div class="viewer-controls">
    <button onclick="event.stopPropagation();zoomImage(1)" title="Zoom +">+</button>
    <button onclick="event.stopPropagation();zoomImage(-1)" title="Zoom -">&minus;</button>
    <button onclick="event.stopPropagation();closeImageViewer()" title="Fermer">&times;</button>
  </div>
  <img id="viewerImage" src="" alt="Aper&ccedil;u" style="cursor:grab">
</div>

<!-- ===== MESSAGE INFO MODAL ===== -->
<div class="overlay" id="msgInfoModal">
  <div class="modal" style="max-width:380px">
    <div class="modal-header">
      <h2>Infos du message</h2>
      <button class="modal-close" onclick="closeModal('msgInfoModal')">&times;</button>
    </div>
    <div class="modal-body">
      <div style="margin-bottom:16px">
        <div style="font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:8px">D&eacute;livr&eacute;</div>
        <div style="display:flex;align-items:center;gap:8px;font-size:14px">
          <span style="color:var(--success)">&#10003;&#10003;</span>
          <span id="msgDeliveredTime">--</span>
        </div>
      </div>
      <div>
        <div style="font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:8px">Lu par</div>
        <div id="msgReadList" style="font-size:14px;color:var(--text-hint)">Aucune confirmation de lecture</div>
      </div>
    </div>
  </div>
</div>

<!-- ===== REPORT MODAL ===== -->
<div class="overlay" id="reportModal">
  <div class="modal" style="max-width:420px">
    <div class="modal-header">
      <h2>Signaler un message</h2>
      <button class="modal-close" onclick="closeModal('reportModal')">&times;</button>
    </div>
    <div class="modal-body">
      <form id="reportForm" onsubmit="handleReport(event)">
        <input type="hidden" name="csrf_token" value="<?= $csrf ?>">
        <input type="hidden" name="message_id" id="reportMsgId" value="">
        <div class="form-group">
          <label>Raison du signalement</label>
          <select name="reason" required>
            <option value="">S&eacute;lectionnez une raison</option>
            <option value="spam">Spam</option>
            <option value="inappropriate">Contenu inappropri&eacute;</option>
            <option value="confidentiality">Violation de confidentialit&eacute;</option>
            <option value="harassment">Harc&egrave;lement</option>
            <option value="other">Autre</option>
          </select>
        </div>
        <div class="form-group">
          <label for="report-details">D&eacute;tails (optionnel)</label>
          <textarea id="report-details" name="details" placeholder="D&eacute;crivez le probl&egrave;me..." rows="3"></textarea>
        </div>
        <div id="report-error" class="form-error hidden"></div>
        <button type="submit" class="btn btn-danger btn-block">Envoyer le signalement</button>
      </form>
    </div>
  </div>
</div>

<!-- ===== EDIT MESSAGE MODAL ===== -->
<div class="overlay" id="editMsgModal">
  <div class="modal" style="max-width:420px">
    <div class="modal-header">
      <h2>Modifier le message</h2>
      <button class="modal-close" onclick="closeModal('editMsgModal')">&times;</button>
    </div>
    <div class="modal-body">
      <form id="editMsgForm" onsubmit="handleEditMessage(event)">
        <input type="hidden" name="csrf_token" value="<?= $csrf ?>">
        <input type="hidden" name="message_id" id="editMsgId" value="">
        <div class="form-group">
          <label for="editMsgText">Message</label>
          <textarea id="editMsgText" name="content" rows="4" required></textarea>
        </div>
        <div id="edit-msg-error" class="form-error hidden"></div>
        <button type="submit" class="btn btn-primary btn-block">Enregistrer</button>
      </form>
    </div>
  </div>
</div>

<!-- ===== ANONYMIZATION CONFIRMATION MODAL ===== -->
<div class="overlay" id="anonModal">
  <div class="modal" style="max-width:440px">
    <div class="modal-header">
      <h2>Anonymisation requise</h2>
      <button class="modal-close" onclick="closeModal('anonModal')">&times;</button>
    </div>
    <div class="modal-body">
      <div style="text-align:center;font-size:48px;margin-bottom:16px">&#9888;</div>
      <p style="font-size:14px;color:var(--text-secondary);line-height:1.7;margin-bottom:20px;text-align:center">
        Vous publiez dans le groupe <strong>Cas cliniques</strong>. Assurez-vous que toutes les donn&eacute;es patient sont <strong>strictement anonymis&eacute;es</strong> conform&eacute;ment aux r&egrave;gles de confidentialit&eacute; m&eacute;dicale.
      </p>
      <ul style="font-size:13px;color:var(--text-secondary);margin-bottom:24px;padding-left:20px;line-height:2">
        <li>Aucun nom, pr&eacute;nom ou identifiant patient</li>
        <li>Aucune date de naissance pr&eacute;cise</li>
        <li>Aucune photo identifiable (visage, tatouage...)</li>
        <li>Aucune localisation pr&eacute;cise</li>
      </ul>
      <div style="display:flex;gap:8px">
        <button class="btn btn-outline" style="flex:1" onclick="closeModal('anonModal')">Annuler</button>
        <button class="btn btn-primary" style="flex:1" onclick="confirmAnonymized()">Je confirme l&rsquo;anonymisation</button>
      </div>
    </div>
  </div>
</div>

<!-- ===== FILE/IMAGE PREVIEW BEFORE SEND MODAL ===== -->
<div class="overlay" id="fileSendModal">
  <div class="modal" style="max-width:500px">
    <div class="modal-header">
      <h2>Envoyer un fichier</h2>
      <button class="modal-close" onclick="closeModal('fileSendModal')">&times;</button>
    </div>
    <div class="modal-body">
      <div style="text-align:center;margin-bottom:16px">
        <img id="fileSendPreview" src="" alt="" style="max-width:100%;max-height:300px;border-radius:8px;display:none">
        <div id="fileSendIcon" style="font-size:64px;color:var(--primary);display:none">&#128196;</div>
      </div>
      <div style="font-size:14px;font-weight:600;margin-bottom:4px" id="fileSendName">fichier.jpg</div>
      <div style="font-size:12px;color:var(--text-hint);margin-bottom:16px" id="fileSendSize">0 Ko</div>
      <div class="form-group">
        <textarea id="fileSendCaption" placeholder="Ajouter un commentaire (optionnel)..." rows="2" style="width:100%;padding:10px 14px;border:2px solid var(--border);border-radius:var(--radius);font-size:14px;resize:none"></textarea>
      </div>
      <button class="btn btn-primary btn-block" onclick="confirmFileSend()">Envoyer</button>
    </div>
  </div>
</div>

<!-- ===== GENERIC CONFIRMATION DIALOG ===== -->
<div class="overlay" id="confirmDialog">
  <div class="modal" style="max-width:380px">
    <div class="modal-header">
      <h2 id="confirmTitle">Confirmation</h2>
      <button class="modal-close" onclick="closeModal('confirmDialog')">&times;</button>
    </div>
    <div class="modal-body">
      <p id="confirmMessage" style="font-size:14px;color:var(--text-secondary);margin-bottom:24px;line-height:1.6"></p>
      <div style="display:flex;gap:8px">
        <button class="btn btn-outline" style="flex:1" onclick="closeModal('confirmDialog')">Annuler</button>
        <button class="btn btn-danger" style="flex:1" id="confirmAction" onclick="confirmDialogAction()">Confirmer</button>
      </div>
    </div>
  </div>
</div>

<!-- ===== SEARCH OVERLAY ===== -->
<div class="search-overlay" id="searchOverlay">
  <div class="search-bar">
    <button onclick="closeSearchOverlay()">&#8592;</button>
    <input type="text" id="searchInput" placeholder="Rechercher des messages, fichiers, membres..." oninput="handleSearch(this.value)">
    <button onclick="document.getElementById('searchInput').value='';handleSearch('')">&#10005;</button>
  </div>
  <div class="search-results" id="searchResults">
    <div class="search-empty">Tapez pour rechercher dans les messages, fichiers et membres.</div>
  </div>
</div>

<!-- ===== NOTIFICATION PANEL ===== -->
<div class="notif-panel" id="notifPanel">
  <div class="notif-header">
    <h3>Notifications</h3>
    <button onclick="closeNotifPanel()" style="font-size:20px">&times;</button>
  </div>
  <div class="notif-list" id="notifList">
    <div class="notif-item">
      <div class="notif-icon">&#128172;</div>
      <div>
        <div class="notif-text">Bienvenue sur NADAR Connect !</div>
        <div class="notif-time">Maintenant</div>
      </div>
    </div>
  </div>
</div>

<?php endif; ?>

<!-- ===== PENDING VALIDATION PAGE ===== -->
<div class="pending-page hidden" id="pendingPage">
  <div class="pending-box">
    <div class="pending-icon">&#9203;</div>
    <h2>Demande en cours de validation</h2>
    <p>Votre demande d&rsquo;acc&egrave;s a &eacute;t&eacute; envoy&eacute;e. Un administrateur NADAR v&eacute;rifiera votre profil et validera votre inscription. Vous recevrez un e-mail de confirmation une fois votre compte activ&eacute;.</p>
    <button class="btn btn-secondary" onclick="handleLogout()">Se d&eacute;connecter</button>
  </div>
</div>

<!-- Toast container -->
<div id="toast-container"></div>

<script>
var BASE_URL = '<?= BASE_URL ?>';
var CSRF = '<?= $csrf ?>';
var IS_LOGGED_IN = <?= $loggedIn ? 'true' : 'false' ?>;
<?php if ($loggedIn): ?>
var CURRENT_USER = <?= json_encode([
  'id' => $user['id'],
  'email' => $user['email'],
  'first_name' => $user['first_name'],
  'last_name' => $user['last_name'],
  'role' => $user['role'],
  'profile_photo' => $user['profile_photo'],
]) ?>;
<?php else: ?>
var CURRENT_USER = null;
<?php endif; ?>

var currentGroup = 'discussion-generale';
var currentZoom = 1;
var pendingFile = null;
var confirmCallback = null;

/* ============ MODAL SYSTEM ============ */
function openModal(id) {
  var el = document.getElementById(id);
  if (el) { el.classList.add('active'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  var el = document.getElementById(id);
  if (el) { el.classList.remove('active'); document.body.style.overflow = ''; }
}
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.overlay.active').forEach(function(o) { o.classList.remove('active'); });
    closeImageViewer();
    closeSearchOverlay();
    closeNotifPanel();
    document.body.style.overflow = '';
  }
});
document.querySelectorAll('.overlay').forEach(function(o) {
  o.addEventListener('click', function(e) { if (e.target === o) closeModal(o.id); });
});

/* ============ TOAST ============ */
function showToast(message, type) {
  type = type || 'info';
  var container = document.getElementById('toast-container');
  var toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(function() { toast.style.opacity = '0'; toast.style.transform = 'translateX(40px)'; setTimeout(function() { toast.remove(); }, 300); }, 4000);
}

/* ============ AUTH HANDLERS ============ */
function handleLogin(e) {
  e.preventDefault();
  var form = document.getElementById('loginForm');
  var errEl = document.getElementById('login-error');
  var btn = document.getElementById('loginSubmit');
  errEl.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Connexion...';
  var fd = new FormData(form);
  fetch(BASE_URL + '/api/auth.php?action=login', { method: 'POST', body: fd })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.success) {
        if (data.pending) {
          var landing = document.getElementById('landing');
          if (landing) landing.classList.add('hidden');
          closeModal('loginModal');
          document.getElementById('pendingPage').classList.remove('hidden');
        } else {
          window.location.reload();
        }
      } else {
        errEl.textContent = data.error || 'Identifiants incorrects';
        errEl.classList.remove('hidden');
      }
    })
    .catch(function() { errEl.textContent = 'Erreur de connexion'; errEl.classList.remove('hidden'); })
    .finally(function() { btn.disabled = false; btn.textContent = 'Se connecter'; });
}

function handleGoogleLogin() {
  showToast('La connexion Google sera disponible prochainement.', 'info');
}

function handleRegister(e) {
  e.preventDefault();
  var form = document.getElementById('registerForm');
  var errEl = document.getElementById('register-error');
  var btn = document.getElementById('registerSubmit');
  errEl.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Envoi...';
  var fd = new FormData(form);
  fetch(BASE_URL + '/api/auth.php?action=register', { method: 'POST', body: fd })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.success) {
        closeModal('registerModal');
        var landing = document.getElementById('landing');
        if (landing) landing.classList.add('hidden');
        document.getElementById('pendingPage').classList.remove('hidden');
      } else {
        errEl.textContent = data.error || 'Erreur lors de l\'inscription';
        errEl.classList.remove('hidden');
      }
    })
    .catch(function() { errEl.textContent = 'Erreur de connexion'; errEl.classList.remove('hidden'); })
    .finally(function() { btn.disabled = false; btn.textContent = 'Envoyer la demande'; });
}

function handleForgot(e) {
  e.preventDefault();
  var errEl = document.getElementById('forgot-error');
  var successEl = document.getElementById('forgot-success');
  errEl.classList.add('hidden');
  successEl.classList.add('hidden');
  var fd = new FormData(document.getElementById('forgotForm'));
  fetch(BASE_URL + '/api/forgot-password.php', { method: 'POST', body: fd })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.success) {
        successEl.textContent = 'Si un compte existe avec cet e-mail, un lien de réinitialisation a été envoyé.';
        successEl.classList.remove('hidden');
      } else {
        errEl.textContent = data.error || 'Erreur';
        errEl.classList.remove('hidden');
      }
    })
    .catch(function() { errEl.textContent = 'Erreur de connexion'; errEl.classList.remove('hidden'); });
}

function handleLogout() {
  fetch(BASE_URL + '/api/auth.php?action=logout', {
    method: 'POST',
    headers: { 'X-CSRF-TOKEN': CSRF }
  }).finally(function() { window.location.href = BASE_URL + '/'; });
}

function handleProfileEdit(e) {
  e.preventDefault();
  var errEl = document.getElementById('profile-edit-error');
  errEl.classList.add('hidden');
  var fd = new FormData(document.getElementById('profileEditForm'));
  fetch(BASE_URL + '/api/members.php?action=update', { method: 'POST', body: fd })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.success) {
        closeModal('profileEditModal');
        showToast('Profil mis à jour', 'success');
        setTimeout(function() { window.location.reload(); }, 1000);
      } else {
        errEl.textContent = data.error || 'Erreur';
        errEl.classList.remove('hidden');
      }
    })
    .catch(function() { errEl.textContent = 'Erreur de connexion'; errEl.classList.remove('hidden'); });
}

function previewEditPhoto(e) {
  var file = e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(ev) {
    var avatar = e.target.closest('.modal-body').querySelector('.profile-avatar');
    avatar.innerHTML = '<img src="' + ev.target.result + '" alt="" id="editPhotoPreview">';
  };
  reader.readAsDataURL(file);
}

/* ============ SIDEBAR ============ */
function toggleSidebar(open) {
  var sidebar = document.getElementById('sidebar');
  var backdrop = document.getElementById('sidebarBackdrop');
  if (!sidebar || !backdrop) return;
  if (open) { sidebar.classList.add('open'); backdrop.classList.add('active'); }
  else { sidebar.classList.remove('open'); backdrop.classList.remove('active'); }
}

function toggleSection(id) {
  document.getElementById(id).classList.toggle('collapsed');
}

function selectGroup(el, groupId, groupName) {
  currentGroup = groupId;
  document.querySelectorAll('.group-item').forEach(function(g) { g.classList.remove('active'); });
  el.classList.add('active');
  document.getElementById('headerTitle').textContent = groupName;
  document.getElementById('headerSubtitle').textContent = 'Groupe';
  hideAllViews();
  toggleSidebar(false);
  loadMessages(groupId);
}

/* ============ VIEWS ============ */
function showView(viewId) {
  hideAllViews();
  var view = document.getElementById(viewId);
  if (view) view.classList.add('active');
  toggleSidebar(false);
}

function hideView(viewId) {
  var view = document.getElementById(viewId);
  if (view) view.classList.remove('active');
}

function hideAllViews() {
  document.querySelectorAll('.view-panel').forEach(function(v) { v.classList.remove('active'); });
}

/* ============ CHAT ============ */
function loadMessages(groupId) {
  var chat = document.getElementById('chatArea');
  if (!chat) return;
  fetch(BASE_URL + '/api/messages.php?group=' + encodeURIComponent(groupId))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.messages && data.messages.length > 0) {
        chat.innerHTML = '<div class="date-divider"><span>Aujourd\'hui</span></div>';
        data.messages.forEach(function(msg) { appendMessage(msg); });
        chat.scrollTop = chat.scrollHeight;
      }
    })
    .catch(function() {});
}

function appendMessage(msg) {
  var chat = document.getElementById('chatArea');
  if (!chat) return;
  var isSent = CURRENT_USER && msg.user_id == CURRENT_USER.id;
  var initials = ((msg.first_name || '?').charAt(0) + (msg.last_name || '?').charAt(0)).toUpperCase();
  var avatarHtml = msg.profile_photo
    ? '<img src="' + BASE_URL + '/uploads/' + escapeHtml(msg.profile_photo) + '" alt="">'
    : initials;
  var actionsHtml = '<div class="msg-actions">' +
    '<button onclick="openMsgInfo()" title="Info">&#8505;</button>' +
    (isSent ? '<button onclick="openEditMsgModal(\'' + msg.id + '\',this)" title="Modifier">&#9998;</button>' : '') +
    '<button onclick="openReportModal(\'' + msg.id + '\')" title="Signaler">&#9873;</button>' +
    '</div>';
  var contentHtml = '';
  if (msg.image) {
    contentHtml += '<img src="' + BASE_URL + '/uploads/' + escapeHtml(msg.image) + '" alt="Image" onclick="openImageViewer(this.src)">';
  }
  if (msg.file) {
    contentHtml += '<div class="file-attach" onclick="window.open(\'' + BASE_URL + '/uploads/' + escapeHtml(msg.file) + '\')">&#128196; ' + escapeHtml(msg.file_name || 'Fichier') + '</div>';
  }
  contentHtml += msg.content ? '<span>' + escapeHtml(msg.content) + '</span>' : '';
  var time = msg.created_at ? new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
  var html = '<div class="message ' + (isSent ? 'sent' : '') + '" data-id="' + msg.id + '">' +
    '<div class="msg-avatar">' + avatarHtml + '</div>' +
    '<div class="msg-content">' +
    (isSent ? '' : '<div class="msg-sender">' + escapeHtml((msg.first_name || '') + ' ' + (msg.last_name || '')) + '</div>') +
    '<div class="msg-bubble">' + contentHtml + actionsHtml + '</div>' +
    '<div class="msg-meta">' + time + (isSent ? ' &#10003;&#10003;' : '') + '</div>' +
    '</div></div>';
  chat.insertAdjacentHTML('beforeend', html);
}

function escapeHtml(text) {
  var d = document.createElement('div');
  d.textContent = text || '';
  return d.innerHTML;
}

/* ============ COMPOSER ============ */
function autoResizeComposer(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  var sendBtn = document.getElementById('sendBtn');
  if (sendBtn) sendBtn.classList.toggle('active', el.value.trim().length > 0 || pendingFile !== null);
}

function sendMessage() {
  var input = document.getElementById('composerInput');
  if (!input) return;
  var content = input.value.trim();
  if (!content && !pendingFile) return;

  if (currentGroup === 'cas-cliniques' && !window._anonConfirmed) {
    openModal('anonModal');
    return;
  }

  var fd = new FormData();
  fd.append('csrf_token', CSRF);
  fd.append('group', currentGroup);
  fd.append('content', content);
  if (pendingFile) fd.append('file', pendingFile);

  fetch(BASE_URL + '/api/messages.php', { method: 'POST', body: fd })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.success) {
        if (data.message) appendMessage(data.message);
        input.value = '';
        input.style.height = 'auto';
        clearAttachment();
        var chat = document.getElementById('chatArea');
        if (chat) chat.scrollTop = chat.scrollHeight;
        document.getElementById('sendBtn').classList.remove('active');
        window._anonConfirmed = false;
      } else {
        showToast(data.error || 'Erreur', 'error');
      }
    })
    .catch(function() { showToast('Erreur de connexion', 'error'); });
}

function confirmAnonymized() {
  window._anonConfirmed = true;
  closeModal('anonModal');
  sendMessage();
}

function handleFileSelect(e) {
  var file = e.target.files[0];
  if (!file) return;
  pendingFile = file;
  var isImage = file.type.startsWith('image/');
  var preview = document.getElementById('fileSendPreview');
  var icon = document.getElementById('fileSendIcon');
  document.getElementById('fileSendName').textContent = file.name;
  document.getElementById('fileSendSize').textContent = formatSize(file.size);
  if (isImage) {
    var reader = new FileReader();
    reader.onload = function(ev) { preview.src = ev.target.result; preview.style.display = 'block'; icon.style.display = 'none'; };
    reader.readAsDataURL(file);
  } else {
    preview.style.display = 'none';
    icon.style.display = 'block';
  }
  openModal('fileSendModal');
  e.target.value = '';
}

function confirmFileSend() {
  var caption = document.getElementById('fileSendCaption').value.trim();
  var input = document.getElementById('composerInput');
  if (caption && input) input.value = caption;
  closeModal('fileSendModal');
  var cp = document.getElementById('composerPreview');
  var thumb = document.getElementById('previewThumb');
  var info = document.getElementById('previewInfo');
  if (pendingFile && cp && info) {
    info.textContent = pendingFile.name;
    if (pendingFile.type.startsWith('image/') && thumb) {
      var r = new FileReader();
      r.onload = function(ev) { thumb.src = ev.target.result; };
      r.readAsDataURL(pendingFile);
    } else if (thumb) {
      thumb.src = '';
    }
    cp.classList.remove('hidden');
  }
  var sendBtn = document.getElementById('sendBtn');
  if (sendBtn) sendBtn.classList.add('active');
  document.getElementById('fileSendCaption').value = '';
}

function clearAttachment() {
  pendingFile = null;
  var cp = document.getElementById('composerPreview');
  if (cp) cp.classList.add('hidden');
  var thumb = document.getElementById('previewThumb');
  if (thumb) thumb.src = '';
  var sendBtn = document.getElementById('sendBtn');
  var input = document.getElementById('composerInput');
  if (sendBtn && input) sendBtn.classList.toggle('active', input.value.trim().length > 0);
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' o';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' Ko';
  return (bytes / 1048576).toFixed(1) + ' Mo';
}

/* ============ IMAGE VIEWER ============ */
function openImageViewer(src) {
  currentZoom = 1;
  var viewer = document.getElementById('imageViewer');
  var img = document.getElementById('viewerImage');
  if (!viewer || !img) return;
  img.src = src;
  img.style.transform = 'scale(1)';
  viewer.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeImageViewer(e) {
  if (e && e.target && e.target.tagName === 'IMG') return;
  var viewer = document.getElementById('imageViewer');
  if (viewer) viewer.classList.remove('active');
  document.body.style.overflow = '';
}

function zoomImage(dir) {
  currentZoom = Math.max(0.5, Math.min(4, currentZoom + dir * 0.5));
  var img = document.getElementById('viewerImage');
  if (img) img.style.transform = 'scale(' + currentZoom + ')';
}

/* ============ MESSAGE MODALS ============ */
function openMsgInfo() {
  var el = document.getElementById('msgDeliveredTime');
  if (el) el.textContent = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  openModal('msgInfoModal');
}

function openReportModal(msgId) {
  var el = document.getElementById('reportMsgId');
  if (el) el.value = msgId || '';
  openModal('reportModal');
}

function handleReport(e) {
  e.preventDefault();
  var fd = new FormData(document.getElementById('reportForm'));
  fetch(BASE_URL + '/api/report.php', { method: 'POST', body: fd })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      closeModal('reportModal');
      showToast(data.success ? 'Signalement envoyé' : (data.error || 'Erreur'), data.success ? 'success' : 'error');
    })
    .catch(function() { showToast('Erreur', 'error'); });
}

function openEditMsgModal(msgId, btn) {
  var idEl = document.getElementById('editMsgId');
  if (idEl) idEl.value = msgId;
  var bubble = btn.closest('.msg-bubble');
  var span = bubble ? bubble.querySelector('span') : null;
  var textEl = document.getElementById('editMsgText');
  if (textEl) textEl.value = span ? span.textContent : '';
  openModal('editMsgModal');
}

function handleEditMessage(e) {
  e.preventDefault();
  var fd = new FormData(document.getElementById('editMsgForm'));
  fetch(BASE_URL + '/api/messages.php', {
    method: 'PUT',
    headers: { 'X-CSRF-TOKEN': CSRF, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message_id: fd.get('message_id'), content: fd.get('content'), csrf_token: CSRF })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      closeModal('editMsgModal');
      if (data.success) {
        showToast('Message modifié', 'success');
        loadMessages(currentGroup);
      } else {
        showToast(data.error || 'Erreur', 'error');
      }
    })
    .catch(function() { showToast('Erreur', 'error'); });
}

/* ============ SEARCH ============ */
function openSearchOverlay() {
  var el = document.getElementById('searchOverlay');
  if (el) el.classList.add('active');
  var input = document.getElementById('searchInput');
  if (input) input.focus();
}

function closeSearchOverlay() {
  var el = document.getElementById('searchOverlay');
  if (el) el.classList.remove('active');
}

function handleSearch(query) {
  var results = document.getElementById('searchResults');
  if (!results) return;
  if (!query.trim()) {
    results.innerHTML = '<div class="search-empty">Tapez pour rechercher dans les messages, fichiers et membres.</div>';
    return;
  }
  fetch(BASE_URL + '/api/search.php?q=' + encodeURIComponent(query))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.results && data.results.length > 0) {
        results.innerHTML = data.results.map(function(r) {
          return '<div class="notif-item" style="cursor:pointer"><div class="notif-icon">&#128269;</div><div><div class="notif-text">' + escapeHtml(r.text || r.content || '') + '</div><div class="notif-time">' + escapeHtml(r.source || '') + '</div></div></div>';
        }).join('');
      } else {
        results.innerHTML = '<div class="search-empty">Aucun résultat pour « ' + escapeHtml(query) + ' »</div>';
      }
    })
    .catch(function() { results.innerHTML = '<div class="search-empty">Erreur de recherche</div>'; });
}

/* ============ NOTIFICATIONS ============ */
function openNotifPanel() {
  var el = document.getElementById('notifPanel');
  if (el) el.classList.add('active');
}

function closeNotifPanel() {
  var el = document.getElementById('notifPanel');
  if (el) el.classList.remove('active');
}

/* ============ DIRECTORY ============ */
function filterDirectory(query) {
  var items = document.querySelectorAll('#directoryList .directory-item');
  query = query.toLowerCase();
  items.forEach(function(item) {
    var name = item.querySelector('.dir-name');
    item.style.display = (name && name.textContent.toLowerCase().indexOf(query) >= 0) ? '' : 'none';
  });
}

/* ============ ADMIN ============ */
function switchAdminTab(btn, tabId) {
  document.querySelectorAll('.admin-tab').forEach(function(t) { t.classList.remove('active'); });
  btn.classList.add('active');
  ['adminPending', 'adminReports', 'adminStats'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', id !== tabId);
  });
}

/* ============ BOTTOM NAV (mobile) ============ */
function switchBottomTab(btn, tab) {
  document.querySelectorAll('.bottom-nav-item').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  hideAllViews();
  if (tab === 'discussions') {
    toggleSidebar(true);
  } else if (tab === 'autres') {
    showView('libraryView');
  } else if (tab === 'profil') {
    showView('profileView');
  }
}

/* ============ HEADER MENU ============ */
function toggleHeaderMenu() {
  showConfirmDialog('Menu', 'Options supplémentaires disponibles : Bibliothèque, Agenda, Annuaire.', function() {});
}

/* ============ CONFIRMATION DIALOG ============ */
function showConfirmDialog(title, message, callback) {
  var titleEl = document.getElementById('confirmTitle');
  var msgEl = document.getElementById('confirmMessage');
  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  confirmCallback = callback;
  openModal('confirmDialog');
}

function confirmDialogAction() {
  closeModal('confirmDialog');
  if (typeof confirmCallback === 'function') confirmCallback();
  confirmCallback = null;
}

/* ============ COMPOSER KEYBOARD ============ */
if (IS_LOGGED_IN) {
  var composerInput = document.getElementById('composerInput');
  if (composerInput) {
    composerInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
  }
}

/* ============ SERVICE WORKER ============ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register(BASE_URL + '/sw.js').catch(function() {});
  });
}
</script>
</body>
</html>
