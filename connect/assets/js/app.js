/**
 * NADAR Connect - Complete JavaScript SPA
 * Vanilla JS (ES6+), no frameworks
 */

const BASE_URL = '/connect';

const NadarConnect = {
    state: {
        currentUser: null,
        currentGroup: null,
        groups: [],
        messages: [],
        unreadCounts: {},
        pollingInterval: null,
        currentView: 'chat',
        replyingTo: null,
        mentionDropdownVisible: false,
        mentionQuery: '',
        membersCache: [],
        lastMessageId: null,
        loadingMore: false,
        pwaInstallPrompt: null,
        isMobile: window.innerWidth <= 768,
        autreExpanded: false,
        attachments: [],
        editingMessageId: null,
        contextMenuTarget: null,
        longPressTimer: null,
        searchDebounceTimer: null,
        composerMentionStart: -1
    },

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    init() {
        this.checkAuth().then(user => {
            if (user) {
                this.state.currentUser = user;
                this.showView('chat');
                this.loadGroups();
                this.startPolling();
                this.loadNotifications();
                this.renderUserInfo();
            } else {
                this.showView('login');
            }
        }).catch(() => {
            this.showView('login');
        });

        this.setupEventListeners();
        this.registerServiceWorker();
        this.setupPWAInstallPrompt();
    },

    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', e => {
                e.preventDefault();
                const email = document.getElementById('login-email').value.trim();
                const password = document.getElementById('login-password').value;
                this.login(email, password);
            });
        }

        // Register form
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', e => {
                e.preventDefault();
                const formData = new FormData(registerForm);
                this.register(formData);
            });
        }

        // Forgot password form
        const forgotForm = document.getElementById('forgot-password-form');
        if (forgotForm) {
            forgotForm.addEventListener('submit', e => {
                e.preventDefault();
                const email = document.getElementById('forgot-email').value.trim();
                this.forgotPassword(email);
            });
        }

        // Send message button
        const sendBtn = document.getElementById('send-message-btn');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.handleSendMessage());
        }

        // Composer textarea
        const composer = document.getElementById('message-composer');
        if (composer) {
            composer.addEventListener('keydown', e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleSendMessage();
                }
            });
            composer.addEventListener('input', () => {
                this.autoResizeComposer(composer);
                this.handleMentionAutocomplete(composer);
            });
        }

        // File input
        const fileInput = document.getElementById('file-input');
        if (fileInput) {
            fileInput.addEventListener('change', e => {
                const files = Array.from(e.target.files);
                if (files.length === 0) return;
                const imageFiles = files.filter(f => f.type.startsWith('image/'));
                const otherFiles = files.filter(f => !f.type.startsWith('image/'));
                if (imageFiles.length > 0) this.showImagePreview(imageFiles);
                if (otherFiles.length > 0) this.showFilePreview(otherFiles);
                fileInput.value = '';
            });
        }

        // Attachment button
        const attachBtn = document.getElementById('attach-btn');
        if (attachBtn) {
            attachBtn.addEventListener('click', () => {
                const fi = document.getElementById('file-input');
                if (fi) fi.click();
            });
        }

        // Group list clicks (delegation)
        const groupList = document.getElementById('group-list');
        if (groupList) {
            groupList.addEventListener('click', e => {
                const item = e.target.closest('[data-group-id]');
                if (item) {
                    this.openGroup(parseInt(item.dataset.groupId, 10));
                }
            });
        }

        // Modal close buttons
        document.addEventListener('click', e => {
            if (e.target.classList.contains('modal-close') || e.target.classList.contains('modal-overlay')) {
                const modal = e.target.closest('.modal');
                if (modal) this.hideModal(modal.id);
            }
        });

        // Search input
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', e => {
                const query = e.target.value.trim();
                this.searchDebounceTimer && clearTimeout(this.searchDebounceTimer);
                this.searchDebounceTimer = setTimeout(() => {
                    if (query.length >= 2) {
                        this.search(query, {});
                    } else {
                        const sr = document.getElementById('search-results');
                        if (sr) sr.innerHTML = '';
                    }
                }, 300);
            });
        }

        // Image viewer (delegation)
        document.addEventListener('click', e => {
            if (e.target.classList.contains('chat-image')) {
                this.openImageViewer(e.target.src);
            }
        });

        // Context menu / long-press on messages
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.addEventListener('contextmenu', e => {
                const msgEl = e.target.closest('[data-message-id]');
                if (msgEl) {
                    e.preventDefault();
                    this.showContextMenu(e, msgEl.dataset.messageId);
                }
            });
            chatMessages.addEventListener('touchstart', e => {
                const msgEl = e.target.closest('[data-message-id]');
                if (msgEl) {
                    this.longPressTimer = setTimeout(() => {
                        const touch = e.touches[0];
                        this.showContextMenu({ clientX: touch.clientX, clientY: touch.clientY }, msgEl.dataset.messageId);
                    }, 600);
                }
            }, { passive: true });
            chatMessages.addEventListener('touchend', () => {
                if (this.longPressTimer) {
                    clearTimeout(this.longPressTimer);
                    this.longPressTimer = null;
                }
            });
            chatMessages.addEventListener('touchmove', () => {
                if (this.longPressTimer) {
                    clearTimeout(this.longPressTimer);
                    this.longPressTimer = null;
                }
            });

            // Infinite scroll (load older messages)
            chatMessages.addEventListener('scroll', () => {
                if (chatMessages.scrollTop < 100 && !this.state.loadingMore && this.state.messages.length > 0) {
                    this.loadOlderMessages();
                }
            });
        }

        // Bottom tab navigation
        const bottomNav = document.getElementById('bottom-nav');
        if (bottomNav) {
            bottomNav.addEventListener('click', e => {
                const tab = e.target.closest('[data-view]');
                if (tab) {
                    this.showView(tab.dataset.view);
                    bottomNav.querySelectorAll('[data-view]').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                }
            });
        }

        // Sidebar nav links
        document.querySelectorAll('[data-nav-view]').forEach(link => {
            link.addEventListener('click', e => {
                e.preventDefault();
                this.showView(link.dataset.navView);
            });
        });

        // Profile edit form
        const profileForm = document.getElementById('profile-form');
        if (profileForm) {
            profileForm.addEventListener('submit', e => {
                e.preventDefault();
                const formData = new FormData(profileForm);
                const data = {};
                formData.forEach((val, key) => { data[key] = val; });
                this.updateProfile(data);
            });
        }

        // Profile photo upload
        const profilePhotoInput = document.getElementById('profile-photo-input');
        if (profilePhotoInput) {
            profilePhotoInput.addEventListener('change', e => {
                if (e.target.files[0]) {
                    this.uploadProfilePhoto(e.target.files[0]);
                }
            });
        }

        // Admin action buttons (delegation)
        const adminPanel = document.getElementById('admin-panel');
        if (adminPanel) {
            adminPanel.addEventListener('click', e => {
                const btn = e.target.closest('[data-admin-action]');
                if (!btn) return;
                const action = btn.dataset.adminAction;
                const id = parseInt(btn.dataset.id, 10);
                switch (action) {
                    case 'approve': this.approveMember(id); break;
                    case 'reject': this.rejectMember(id); break;
                    case 'suspend': this.suspendMember(id); break;
                    case 'dismiss-report': this.handleReport(id, 'dismiss'); break;
                    case 'warn-report': this.handleReport(id, 'warn'); break;
                    case 'ban-report': this.handleReport(id, 'ban'); break;
                }
                const roleSelect = btn.closest('.admin-member-row')?.querySelector('[data-role-select]');
                if (action === 'change-role' && roleSelect) {
                    this.changeRole(id, roleSelect.value);
                }
            });
        }

        // Autre section expand/collapse
        document.addEventListener('click', e => {
            if (e.target.closest('.autre-toggle')) {
                this.state.autreExpanded = !this.state.autreExpanded;
                const autreList = document.getElementById('autre-groups');
                const toggleIcon = e.target.closest('.autre-toggle').querySelector('.toggle-icon');
                if (autreList) {
                    autreList.style.display = this.state.autreExpanded ? 'block' : 'none';
                }
                if (toggleIcon) {
                    toggleIcon.textContent = this.state.autreExpanded ? '▲' : '▼';
                }
            }
        });

        // PWA install prompt
        window.addEventListener('beforeinstallprompt', e => {
            e.preventDefault();
            this.state.pwaInstallPrompt = e;
            const installBtn = document.getElementById('pwa-install-btn');
            if (installBtn) {
                installBtn.style.display = 'block';
                installBtn.addEventListener('click', () => {
                    this.state.pwaInstallPrompt.prompt();
                    this.state.pwaInstallPrompt.userChoice.then(choice => {
                        if (choice.outcome === 'accepted') {
                            installBtn.style.display = 'none';
                        }
                        this.state.pwaInstallPrompt = null;
                    });
                });
            }
        });

        // Close context menu on click elsewhere
        document.addEventListener('click', e => {
            if (!e.target.closest('.context-menu')) {
                const existing = document.querySelector('.context-menu');
                if (existing) existing.remove();
            }
        });

        // Mention dropdown click
        document.addEventListener('click', e => {
            const mentionItem = e.target.closest('.mention-item');
            if (mentionItem) {
                this.insertMention(mentionItem.dataset.username, mentionItem.dataset.displayName);
            }
        });

        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', e => {
                e.preventDefault();
                this.logout();
            });
        }

        // Back button (mobile chat -> sidebar)
        const backBtn = document.getElementById('back-to-sidebar');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                document.getElementById('sidebar')?.classList.remove('hidden');
                document.getElementById('chat-panel')?.classList.add('hidden');
            });
        }

        // Notification bell
        const notifBtn = document.getElementById('notification-btn');
        if (notifBtn) {
            notifBtn.addEventListener('click', () => {
                this.showModal('notifications-modal');
                this.loadNotifications();
            });
        }

        // Show login/register toggle links
        document.addEventListener('click', e => {
            if (e.target.id === 'show-register') {
                e.preventDefault();
                document.getElementById('login-view')?.classList.add('hidden');
                document.getElementById('register-view')?.classList.remove('hidden');
            }
            if (e.target.id === 'show-login') {
                e.preventDefault();
                document.getElementById('register-view')?.classList.add('hidden');
                document.getElementById('login-view')?.classList.remove('hidden');
            }
            if (e.target.id === 'show-forgot') {
                e.preventDefault();
                document.getElementById('login-view')?.classList.add('hidden');
                document.getElementById('forgot-view')?.classList.remove('hidden');
            }
            if (e.target.id === 'back-to-login') {
                e.preventDefault();
                document.getElementById('forgot-view')?.classList.add('hidden');
                document.getElementById('login-view')?.classList.remove('hidden');
            }
        });

        // Reply cancel
        document.addEventListener('click', e => {
            if (e.target.id === 'cancel-reply') {
                this.state.replyingTo = null;
                const replyBar = document.getElementById('reply-bar');
                if (replyBar) replyBar.style.display = 'none';
            }
        });

        // Edit cancel
        document.addEventListener('click', e => {
            if (e.target.id === 'cancel-edit') {
                this.state.editingMessageId = null;
                const composer = document.getElementById('message-composer');
                if (composer) composer.value = '';
                const editBar = document.getElementById('edit-bar');
                if (editBar) editBar.style.display = 'none';
            }
        });

        // Window resize
        window.addEventListener('resize', () => {
            this.state.isMobile = window.innerWidth <= 768;
        });

        // Library category filter
        document.addEventListener('click', e => {
            const tab = e.target.closest('.library-tab');
            if (tab) {
                document.querySelectorAll('.library-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.loadDocuments(tab.dataset.category || '');
            }
        });

        // Report form submit
        const reportForm = document.getElementById('report-form');
        if (reportForm) {
            reportForm.addEventListener('submit', e => {
                e.preventDefault();
                const reason = document.getElementById('report-reason').value;
                const comment = document.getElementById('report-comment').value;
                const messageId = parseInt(reportForm.dataset.messageId, 10);
                this.reportMessage(messageId, reason, comment);
                this.hideModal('report-modal');
            });
        }

        // Push notification request
        const pushBtn = document.getElementById('enable-push-btn');
        if (pushBtn) {
            pushBtn.addEventListener('click', () => this.requestPushPermission());
        }
    },

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register(`${BASE_URL}/sw.js`).catch(() => {
                // Service worker registration failed silently
            });
        }
    },

    setupPWAInstallPrompt() {
        window.addEventListener('appinstalled', () => {
            this.state.pwaInstallPrompt = null;
            const installBtn = document.getElementById('pwa-install-btn');
            if (installBtn) installBtn.style.display = 'none';
        });
    },

    renderUserInfo() {
        const user = this.state.currentUser;
        if (!user) return;
        const nameEl = document.getElementById('user-display-name');
        if (nameEl) nameEl.textContent = `${user.first_name} ${user.last_name}`;
        const avatarEl = document.getElementById('user-avatar');
        if (avatarEl) {
            if (user.photo_url) {
                avatarEl.innerHTML = `<img src="${this.escapeHtml(user.photo_url)}" alt="Avatar" class="avatar-img">`;
            } else {
                avatarEl.innerHTML = `<img src="${this.generateInitialsAvatar(user.first_name + ' ' + user.last_name)}" alt="Avatar" class="avatar-img">`;
            }
        }
        // Show admin nav if admin
        const adminNav = document.getElementById('admin-nav');
        if (adminNav) {
            adminNav.style.display = (user.role === 'admin' || user.role === 'superadmin') ? 'block' : 'none';
        }
    },

    // =========================================================================
    // API WRAPPER
    // =========================================================================

    async api(endpoint, options = {}) {
        const url = `${BASE_URL}/${endpoint}`;
        const headers = options.headers || {};

        // Add CSRF token
        const csrfMeta = document.querySelector('meta[name="csrf-token"]');
        if (csrfMeta) {
            headers['X-CSRF-Token'] = csrfMeta.getAttribute('content');
        }

        // If body is not FormData, set JSON content type
        if (options.body && !(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
            if (typeof options.body === 'object') {
                options.body = JSON.stringify(options.body);
            }
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers,
                credentials: 'same-origin'
            });

            if (response.status === 401) {
                this.state.currentUser = null;
                this.showView('login');
                return null;
            }

            const data = await response.json();

            if (!response.ok) {
                const errMsg = data.error || data.message || `Erreur ${response.status}`;
                this.showToast(errMsg, 'error');
                return null;
            }

            return data;
        } catch (err) {
            this.showToast('Erreur de connexion au serveur', 'error');
            console.error('API Error:', err);
            return null;
        }
    },

    // =========================================================================
    // AUTHENTICATION
    // =========================================================================

    async login(email, password) {
        if (!email || !password) {
            this.showToast('Veuillez remplir tous les champs', 'warning');
            return;
        }
        this.showLoading();
        const result = await this.api('api/auth.php?action=login', {
            method: 'POST',
            body: { email, password }
        });
        this.hideLoading();
        if (result && result.success) {
            this.state.currentUser = result.user;
            this.showToast('Connexion réussie', 'success');
            setTimeout(() => window.location.reload(), 500);
        }
    },

    async register(formData) {
        this.showLoading();
        const result = await this.api('api/auth.php?action=register', {
            method: 'POST',
            body: formData
        });
        this.hideLoading();
        if (result && result.success) {
            this.showToast('Inscription envoyée ! Votre compte est en attente de validation par un administrateur.', 'success');
            document.getElementById('register-view')?.classList.add('hidden');
            document.getElementById('login-view')?.classList.remove('hidden');
            const pendingNotice = document.getElementById('pending-notice');
            if (pendingNotice) {
                pendingNotice.style.display = 'block';
                pendingNotice.textContent = 'Votre inscription est en attente de validation. Vous recevrez un email une fois approuvé.';
            }
        }
    },

    async logout() {
        this.showLoading();
        await this.api('api/auth.php?action=logout', { method: 'POST' });
        this.hideLoading();
        this.stopPolling();
        this.state.currentUser = null;
        this.state.groups = [];
        this.state.messages = [];
        window.location.reload();
    },

    async forgotPassword(email) {
        if (!email) {
            this.showToast('Veuillez entrer votre adresse email', 'warning');
            return;
        }
        this.showLoading();
        const result = await this.api('api/auth.php?action=forgot-password', {
            method: 'POST',
            body: { email }
        });
        this.hideLoading();
        if (result) {
            this.showToast('Si cette adresse existe, un lien de réinitialisation a été envoyé.', 'success');
        }
    },

    async checkAuth() {
        const result = await this.api('api/auth.php?action=me');
        if (result && result.user) {
            return result.user;
        }
        return null;
    },

    // =========================================================================
    // GROUPS
    // =========================================================================

    async loadGroups() {
        const result = await this.api('api/groups.php');
        if (result && result.groups) {
            this.state.groups = result.groups;
            if (result.unread_counts) {
                this.state.unreadCounts = result.unread_counts;
            }
            this.renderGroupList();

            // Auto-open first group if none selected
            if (!this.state.currentGroup && this.state.groups.length > 0) {
                this.openGroup(this.state.groups[0].id);
            }
        }
    },

    renderGroupList() {
        const container = document.getElementById('group-list');
        if (!container) return;

        const groups = this.state.groups;
        const generalGroup = groups.find(g => g.slug === 'discussion-generale' || g.name === 'Discussion générale');
        const otherGroups = groups.filter(g => g !== generalGroup);

        let html = '';

        // Discussion générale at top
        if (generalGroup) {
            html += this.renderGroupItem(generalGroup, true);
        }

        // Autre section
        if (otherGroups.length > 0) {
            html += `
                <div class="autre-section">
                    <div class="autre-toggle">
                        <span class="autre-label">Autre</span>
                        <span class="toggle-icon">${this.state.autreExpanded ? '▲' : '▼'}</span>
                    </div>
                    <div id="autre-groups" style="display: ${this.state.autreExpanded ? 'block' : 'none'}">
                        ${otherGroups.map(g => this.renderGroupItem(g, false)).join('')}
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    },

    renderGroupItem(group, isPrimary) {
        const unread = this.state.unreadCounts[group.id] || 0;
        const isActive = this.state.currentGroup && this.state.currentGroup.id === group.id;
        const initials = this.getGroupInitials(group.name);
        const color = this.hashColor(group.name);
        const lastMsg = group.last_message;
        const lastMsgPreview = lastMsg ? this.truncate(lastMsg.content || '', 40) : '';
        const lastMsgTime = lastMsg ? this.timeAgo(new Date(lastMsg.created_at)) : '';

        return `
            <div class="group-item ${isActive ? 'active' : ''} ${isPrimary ? 'group-primary' : ''}" data-group-id="${group.id}">
                <div class="group-avatar" style="background-color: ${color}">
                    <span class="group-initials">${this.escapeHtml(initials)}</span>
                </div>
                <div class="group-info">
                    <div class="group-name-row">
                        <span class="group-name">${this.escapeHtml(group.name)}</span>
                        <span class="group-time">${lastMsgTime}</span>
                    </div>
                    <div class="group-preview-row">
                        <span class="group-preview">${this.escapeHtml(lastMsgPreview)}</span>
                        ${unread > 0 ? `<span class="unread-badge">${unread > 99 ? '99+' : unread}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    },

    getGroupInitials(name) {
        const words = name.split(/\s+/).filter(Boolean);
        if (words.length >= 2) {
            return (words[0][0] + words[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    },

    truncate(str, len) {
        if (str.length <= len) return str;
        return str.substring(0, len) + '…';
    },

    // =========================================================================
    // OPEN GROUP
    // =========================================================================

    async openGroup(groupId) {
        const group = this.state.groups.find(g => g.id === groupId);
        if (!group) return;

        this.state.currentGroup = group;
        this.state.messages = [];
        this.state.lastMessageId = null;
        this.state.replyingTo = null;
        this.state.editingMessageId = null;
        this.state.attachments = [];

        // Update UI header
        const chatHeader = document.getElementById('chat-header-name');
        if (chatHeader) chatHeader.textContent = group.name;

        const chatHeaderDesc = document.getElementById('chat-header-description');
        if (chatHeaderDesc) chatHeaderDesc.textContent = group.description || '';

        const membersCount = document.getElementById('chat-members-count');
        if (membersCount) membersCount.textContent = group.member_count ? `${group.member_count} membres` : '';

        // Clear reply/edit bars
        const replyBar = document.getElementById('reply-bar');
        if (replyBar) replyBar.style.display = 'none';
        const editBar = document.getElementById('edit-bar');
        if (editBar) editBar.style.display = 'none';
        const composer = document.getElementById('message-composer');
        if (composer) composer.value = '';

        // Update active state
        this.renderGroupList();

        // Mobile: show chat panel, hide sidebar
        if (this.state.isMobile) {
            document.getElementById('sidebar')?.classList.add('hidden');
            document.getElementById('chat-panel')?.classList.remove('hidden');
        }

        // Load messages
        await this.loadMessages(groupId);
        this.markAsRead(groupId);

        // Check if clinical cases group -> show anonymization notice
        if (group.slug === 'cas-cliniques' || group.name.toLowerCase().includes('cas clinique')) {
            this.showAnonymizationConfirmation();
        }
    },

    // =========================================================================
    // MESSAGES
    // =========================================================================

    async loadMessages(groupId, before = null) {
        let endpoint = `api/messages.php?group_id=${groupId}`;
        if (before) endpoint += `&before=${before}`;

        const result = await this.api(endpoint);
        if (result && result.messages) {
            if (before) {
                this.state.messages = [...result.messages, ...this.state.messages];
                this.renderMessages(result.messages, true);
            } else {
                this.state.messages = result.messages;
                this.renderMessages(result.messages, false);
            }
            if (this.state.messages.length > 0) {
                this.state.lastMessageId = this.state.messages[this.state.messages.length - 1].id;
            }
            return result.messages;
        }
        return [];
    },

    renderMessages(messages, append) {
        const container = document.getElementById('chat-messages');
        if (!container) return;

        if (!append) {
            container.innerHTML = '';
        }

        const fragment = document.createDocumentFragment();
        let lastDate = null;

        const allMessages = append ? messages : this.state.messages;
        const startIndex = append && this.state.messages.length > messages.length
            ? 0
            : 0;

        if (!append) {
            // Render all messages with date separators
            allMessages.forEach(msg => {
                const msgDate = this.formatDate(new Date(msg.created_at));
                if (msgDate !== lastDate) {
                    lastDate = msgDate;
                    const dateSep = document.createElement('div');
                    dateSep.className = 'date-separator';
                    dateSep.innerHTML = `<span>${msgDate}</span>`;
                    fragment.appendChild(dateSep);
                }
                const msgEl = document.createElement('div');
                msgEl.innerHTML = this.renderMessageBubble(msg);
                fragment.appendChild(msgEl.firstElementChild);
            });
            container.appendChild(fragment);
            container.scrollTop = container.scrollHeight;
        } else {
            // Prepend older messages
            const prevHeight = container.scrollHeight;
            messages.forEach(msg => {
                const msgDate = this.formatDate(new Date(msg.created_at));
                if (msgDate !== lastDate) {
                    lastDate = msgDate;
                    const dateSep = document.createElement('div');
                    dateSep.className = 'date-separator';
                    dateSep.innerHTML = `<span>${msgDate}</span>`;
                    fragment.appendChild(dateSep);
                }
                const msgEl = document.createElement('div');
                msgEl.innerHTML = this.renderMessageBubble(msg);
                fragment.appendChild(msgEl.firstElementChild);
            });
            container.insertBefore(fragment, container.firstChild);
            container.scrollTop = container.scrollHeight - prevHeight;
        }
    },

    appendNewMessages(messages) {
        const container = document.getElementById('chat-messages');
        if (!container) return;
        const wasAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;

        const fragment = document.createDocumentFragment();
        messages.forEach(msg => {
            const msgEl = document.createElement('div');
            msgEl.innerHTML = this.renderMessageBubble(msg);
            fragment.appendChild(msgEl.firstElementChild);
        });
        container.appendChild(fragment);

        if (wasAtBottom) {
            container.scrollTop = container.scrollHeight;
        }
    },

    async sendMessage(groupId, content, attachments = []) {
        if (!content && attachments.length === 0) return;

        const replyTo = this.state.replyingTo;

        if (attachments.length > 0) {
            const formData = new FormData();
            formData.append('group_id', groupId);
            if (content) formData.append('content', content);
            if (replyTo) formData.append('reply_to', replyTo);
            attachments.forEach((file, i) => {
                formData.append(`files[${i}]`, file);
            });
            // Optimistic message
            const optimisticMsg = this.createOptimisticMessage(content, attachments);
            this.state.messages.push(optimisticMsg);
            this.appendNewMessages([optimisticMsg]);

            const result = await this.api('api/messages.php', {
                method: 'POST',
                body: formData
            });
            if (result && result.message) {
                // Replace optimistic message
                const idx = this.state.messages.findIndex(m => m.id === optimisticMsg.id);
                if (idx !== -1) {
                    this.state.messages[idx] = result.message;
                }
                this.state.lastMessageId = result.message.id;
                this.refreshChatUI();
            }
        } else {
            const body = { group_id: groupId, content };
            if (replyTo) body.reply_to = replyTo;

            const optimisticMsg = this.createOptimisticMessage(content, []);
            this.state.messages.push(optimisticMsg);
            this.appendNewMessages([optimisticMsg]);

            const result = await this.api('api/messages.php', {
                method: 'POST',
                body
            });
            if (result && result.message) {
                const idx = this.state.messages.findIndex(m => m.id === optimisticMsg.id);
                if (idx !== -1) {
                    this.state.messages[idx] = result.message;
                }
                this.state.lastMessageId = result.message.id;
                this.refreshChatUI();
            }
        }

        // Clear reply state
        this.state.replyingTo = null;
        const replyBar = document.getElementById('reply-bar');
        if (replyBar) replyBar.style.display = 'none';
        this.state.attachments = [];
    },

    createOptimisticMessage(content, attachments) {
        const user = this.state.currentUser;
        return {
            id: 'temp-' + Date.now(),
            content: content || '',
            sender_id: user.id,
            sender_name: `${user.first_name} ${user.last_name}`,
            sender_photo: user.photo_url,
            created_at: new Date().toISOString(),
            status: 'sending',
            attachments: attachments.map(f => ({
                name: f.name,
                size: f.size,
                type: f.type,
                url: f.type.startsWith('image/') ? URL.createObjectURL(f) : null
            })),
            reply_to: this.state.replyingTo ? this.state.messages.find(m => m.id === this.state.replyingTo) : null,
            is_pinned: false,
            reactions: []
        };
    },

    refreshChatUI() {
        this.renderMessages(this.state.messages, false);
    },

    async editMessage(messageId, content) {
        const result = await this.api('api/messages.php', {
            method: 'PUT',
            body: { id: messageId, content }
        });
        if (result && result.success) {
            const idx = this.state.messages.findIndex(m => m.id === messageId);
            if (idx !== -1) {
                this.state.messages[idx].content = content;
                this.state.messages[idx].edited = true;
            }
            this.refreshChatUI();
            this.showToast('Message modifié', 'success');
        }
        this.state.editingMessageId = null;
        const editBar = document.getElementById('edit-bar');
        if (editBar) editBar.style.display = 'none';
    },

    async deleteMessage(messageId) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce message ?')) return;
        const result = await this.api(`api/messages.php?id=${messageId}`, {
            method: 'DELETE'
        });
        if (result && result.success) {
            this.state.messages = this.state.messages.filter(m => m.id !== messageId);
            const el = document.querySelector(`[data-message-id="${messageId}"]`);
            if (el) el.remove();
            this.showToast('Message supprimé', 'success');
        }
    },

    async reportMessage(messageId, reason, comment) {
        const result = await this.api('api/messages.php?action=report', {
            method: 'POST',
            body: { message_id: messageId, reason, comment }
        });
        if (result && result.success) {
            this.showToast('Signalement envoyé', 'success');
        }
    },

    async pinMessage(messageId) {
        const result = await this.api('api/messages.php?action=pin', {
            method: 'POST',
            body: { message_id: messageId }
        });
        if (result && result.success) {
            const idx = this.state.messages.findIndex(m => m.id === messageId);
            if (idx !== -1) {
                this.state.messages[idx].is_pinned = !this.state.messages[idx].is_pinned;
            }
            this.refreshChatUI();
            this.showToast('Message épinglé', 'success');
        }
    },

    async markAsRead(groupId) {
        await this.api('api/messages.php?action=read', {
            method: 'POST',
            body: { group_id: groupId }
        });
        this.state.unreadCounts[groupId] = 0;
        this.renderGroupList();
    },

    async getMessageInfo(messageId) {
        const result = await this.api(`api/messages.php?action=info&id=${messageId}`);
        if (result) {
            const modal = document.getElementById('message-info-modal');
            if (!modal) return;

            let html = '<div class="message-info-content"><h3>Informations du message</h3>';

            if (result.delivered_to && result.delivered_to.length > 0) {
                html += '<h4>Distribué à</h4><ul class="receipt-list">';
                result.delivered_to.forEach(r => {
                    html += `<li><span class="receipt-name">${this.escapeHtml(r.name)}</span> <span class="receipt-time">${this.formatTime(new Date(r.delivered_at))}</span></li>`;
                });
                html += '</ul>';
            }

            if (result.read_by && result.read_by.length > 0) {
                html += '<h4>Lu par</h4><ul class="receipt-list">';
                result.read_by.forEach(r => {
                    html += `<li><span class="receipt-name">${this.escapeHtml(r.name)}</span> <span class="receipt-time">${this.formatTime(new Date(r.read_at))}</span></li>`;
                });
                html += '</ul>';
            }

            html += '</div>';
            const body = modal.querySelector('.modal-body');
            if (body) body.innerHTML = html;
            this.showModal('message-info-modal');
        }
    },

    renderMessageBubble(msg) {
        const isOwn = this.state.currentUser && msg.sender_id === this.state.currentUser.id;
        const isSystem = msg.type === 'system';

        if (isSystem) {
            return `
                <div class="message-bubble message-system" data-message-id="${msg.id}">
                    <div class="system-message-text">${this.escapeHtml(msg.content)}</div>
                </div>
            `;
        }

        const senderName = msg.sender_name || 'Utilisateur';
        const senderPhoto = msg.sender_photo;
        const avatarHtml = senderPhoto
            ? `<img src="${this.escapeHtml(senderPhoto)}" alt="" class="message-avatar">`
            : `<img src="${this.generateInitialsAvatar(senderName)}" alt="" class="message-avatar">`;

        let contentHtml = '';

        // Reply quote
        if (msg.reply_to && typeof msg.reply_to === 'object') {
            contentHtml += `
                <div class="reply-quote">
                    <span class="reply-author">${this.escapeHtml(msg.reply_to.sender_name || '')}</span>
                    <span class="reply-text">${this.escapeHtml(this.truncate(msg.reply_to.content || '', 80))}</span>
                </div>
            `;
        }

        // Text content
        if (msg.content) {
            const processedContent = this.processMessageContent(msg.content);
            contentHtml += `<div class="message-text">${processedContent}</div>`;
        }

        // Attachments
        if (msg.attachments && msg.attachments.length > 0) {
            msg.attachments.forEach(att => {
                if (att.type && att.type.startsWith('image/')) {
                    contentHtml += `<div class="message-image"><img src="${this.escapeHtml(att.url)}" alt="${this.escapeHtml(att.name || 'Image')}" class="chat-image" loading="lazy"></div>`;
                } else {
                    const icon = this.getFileIcon(att.name || att.type || '');
                    contentHtml += `
                        <a href="${this.escapeHtml(att.url)}" class="message-file" download="${this.escapeHtml(att.name || 'fichier')}" target="_blank">
                            <span class="file-icon">${icon}</span>
                            <div class="file-info">
                                <span class="file-name">${this.escapeHtml(att.name || 'Fichier')}</span>
                                <span class="file-size">${att.size ? this.formatFileSize(att.size) : ''}</span>
                            </div>
                        </a>
                    `;
                }
            });
        }

        // Time and status
        const time = this.formatTime(new Date(msg.created_at));
        let statusHtml = '';
        if (isOwn) {
            if (msg.status === 'sending') {
                statusHtml = '<span class="msg-status">⏳</span>';
            } else if (msg.status === 'sent') {
                statusHtml = '<span class="msg-status">✓</span>';
            } else if (msg.status === 'delivered') {
                statusHtml = '<span class="msg-status">✓✓</span>';
            } else if (msg.status === 'read') {
                statusHtml = '<span class="msg-status msg-read">✓✓</span>';
            } else {
                statusHtml = '<span class="msg-status">✓</span>';
            }
        }

        const editedLabel = msg.edited ? ' <span class="edited-label">modifié</span>' : '';
        const pinnedLabel = msg.is_pinned ? '<div class="pinned-label">📌 Épinglé</div>' : '';

        return `
            <div class="message-bubble ${isOwn ? 'message-own' : 'message-other'}" data-message-id="${msg.id}">
                ${pinnedLabel}
                ${!isOwn ? `<div class="message-sender-row">${avatarHtml}<span class="sender-name">${this.escapeHtml(senderName)}</span></div>` : ''}
                <div class="message-content">
                    ${contentHtml}
                </div>
                <div class="message-meta">
                    <span class="message-time">${time}${editedLabel}</span>
                    ${statusHtml}
                </div>
            </div>
        `;
    },

    processMessageContent(content) {
        let safe = this.escapeHtml(content);

        // Convert URLs to links
        safe = safe.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');

        // Convert @mentions to styled spans
        safe = safe.replace(/@(\w+)/g, '<span class="mention">@$1</span>');

        // Convert line breaks
        safe = safe.replace(/\n/g, '<br>');

        // Bold **text**
        safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // Italic *text*
        safe = safe.replace(/\*(.+?)\*/g, '<em>$1</em>');

        return safe;
    },

    getFileIcon(nameOrType) {
        const ext = nameOrType.includes('.') ? nameOrType.split('.').pop().toLowerCase() : nameOrType;
        const icons = {
            pdf: '📄',
            doc: '📃', docx: '📃',
            xls: '📊', xlsx: '📊',
            ppt: '📊', pptx: '📊',
            zip: '📁', rar: '📁',
            mp4: '🎥', avi: '🎥', mov: '🎥',
            mp3: '🎧', wav: '🎧',
            txt: '📄',
            csv: '📊'
        };
        return icons[ext] || '📂';
    },

    handleSendMessage() {
        const composer = document.getElementById('message-composer');
        if (!composer || !this.state.currentGroup) return;

        const content = composer.value.trim();

        // Handle edit mode
        if (this.state.editingMessageId) {
            if (content) {
                this.editMessage(this.state.editingMessageId, content);
            }
            composer.value = '';
            this.autoResizeComposer(composer);
            return;
        }

        if (!content && this.state.attachments.length === 0) return;

        this.sendMessage(this.state.currentGroup.id, content, this.state.attachments);
        composer.value = '';
        this.state.attachments = [];
        this.autoResizeComposer(composer);

        // Clear attachment preview
        const preview = document.getElementById('attachment-preview');
        if (preview) preview.innerHTML = '';
    },

    async loadOlderMessages() {
        if (!this.state.currentGroup || this.state.messages.length === 0) return;
        this.state.loadingMore = true;
        const oldestId = this.state.messages[0].id;
        await this.loadMessages(this.state.currentGroup.id, oldestId);
        this.state.loadingMore = false;
    },

    // =========================================================================
    // POLLING
    // =========================================================================

    startPolling() {
        this.stopPolling();
        this.state.pollingInterval = setInterval(() => {
            this.pollNewMessages();
        }, 3000);
    },

    stopPolling() {
        if (this.state.pollingInterval) {
            clearInterval(this.state.pollingInterval);
            this.state.pollingInterval = null;
        }
    },

    async pollNewMessages() {
        // Poll for new messages in current group
        if (this.state.currentGroup && this.state.lastMessageId) {
            const result = await this.api(
                `api/messages.php?action=poll&group_id=${this.state.currentGroup.id}&after=${this.state.lastMessageId}`
            );
            if (result && result.messages && result.messages.length > 0) {
                // Filter out own optimistic messages
                const newMsgs = result.messages.filter(
                    m => !this.state.messages.some(existing => existing.id === m.id)
                );
                if (newMsgs.length > 0) {
                    this.state.messages.push(...newMsgs);
                    this.state.lastMessageId = newMsgs[newMsgs.length - 1].id;
                    this.appendNewMessages(newMsgs);

                    // Play notification sound for others' messages
                    const hasOthers = newMsgs.some(m => m.sender_id !== this.state.currentUser.id);
                    if (hasOthers) {
                        this.playNotificationSound();
                    }
                }
            }
        }

        // Poll unread counts for all groups
        const countsResult = await this.api('api/messages.php?action=unread-counts');
        if (countsResult && countsResult.counts) {
            const oldCounts = { ...this.state.unreadCounts };
            this.state.unreadCounts = countsResult.counts;

            // Check if any new unreads appeared
            let hasNewUnread = false;
            for (const gId in countsResult.counts) {
                if ((countsResult.counts[gId] || 0) > (oldCounts[gId] || 0)) {
                    hasNewUnread = true;
                    break;
                }
            }
            if (hasNewUnread) {
                this.renderGroupList();
                this.updateTotalUnreadBadge();
            }
        }
    },

    playNotificationSound() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.1;
            oscillator.start();
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
            oscillator.stop(audioCtx.currentTime + 0.3);
        } catch (e) {
            // Audio not available
        }
    },

    updateTotalUnreadBadge() {
        const total = this.getUnreadCount();
        const badge = document.getElementById('total-unread-badge');
        if (badge) {
            badge.textContent = total > 0 ? (total > 99 ? '99+' : total) : '';
            badge.style.display = total > 0 ? 'inline-flex' : 'none';
        }
        // Update page title
        document.title = total > 0 ? `(${total}) NADAR Connect` : 'NADAR Connect';
    },

    // =========================================================================
    // UPLOADS
    // =========================================================================

    uploadFile(file) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const formData = new FormData();
            formData.append('file', file);

            // Create progress element
            const progressContainer = document.getElementById('upload-progress');
            let progressBar = null;
            if (progressContainer) {
                progressContainer.style.display = 'block';
                progressContainer.innerHTML = `
                    <div class="upload-progress-item">
                        <span class="upload-filename">${this.escapeHtml(file.name)}</span>
                        <div class="progress-bar-track">
                            <div class="progress-bar-fill" id="progress-fill"></div>
                        </div>
                        <span class="upload-percent">0%</span>
                    </div>
                `;
                progressBar = progressContainer.querySelector('.progress-bar-fill');
            }

            xhr.upload.addEventListener('progress', e => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    if (progressBar) progressBar.style.width = percent + '%';
                    const percentEl = progressContainer?.querySelector('.upload-percent');
                    if (percentEl) percentEl.textContent = percent + '%';
                }
            });

            xhr.addEventListener('load', () => {
                if (progressContainer) progressContainer.style.display = 'none';
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const result = JSON.parse(xhr.responseText);
                        resolve(result);
                    } catch (e) {
                        reject(new Error('Invalid response'));
                    }
                } else {
                    reject(new Error(`Upload failed: ${xhr.status}`));
                }
            });

            xhr.addEventListener('error', () => {
                if (progressContainer) progressContainer.style.display = 'none';
                this.showToast('Échec de l\'envoi du fichier', 'error');
                reject(new Error('Upload failed'));
            });

            const csrfMeta = document.querySelector('meta[name="csrf-token"]');
            xhr.open('POST', `${BASE_URL}/api/upload.php`);
            if (csrfMeta) {
                xhr.setRequestHeader('X-CSRF-Token', csrfMeta.getAttribute('content'));
            }
            xhr.send(formData);
        });
    },

    compressImage(file) {
        return new Promise((resolve, reject) => {
            const maxWidth = 1920;
            const maxHeight = 1920;
            const quality = 0.8;

            const reader = new FileReader();
            reader.onload = e => {
                const img = new Image();
                img.onload = () => {
                    let { width, height } = img;

                    // Only resize if needed
                    if (width <= maxWidth && height <= maxHeight) {
                        resolve(file);
                        return;
                    }

                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob(
                        blob => {
                            if (blob) {
                                const compressed = new File([blob], file.name, {
                                    type: 'image/jpeg',
                                    lastModified: Date.now()
                                });
                                resolve(compressed);
                            } else {
                                resolve(file);
                            }
                        },
                        'image/jpeg',
                        quality
                    );
                };
                img.onerror = () => reject(new Error('Image load failed'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('File read failed'));
            reader.readAsDataURL(file);
        });
    },

    showImagePreview(files) {
        const modal = document.getElementById('image-preview-modal');
        if (!modal) {
            // Create modal dynamically
            this.createImagePreviewModal(files);
            return;
        }

        const body = modal.querySelector('.modal-body');
        if (!body) return;

        let html = '<div class="image-preview-grid">';
        files.forEach((file, index) => {
            const objectUrl = URL.createObjectURL(file);
            html += `
                <div class="image-preview-item" data-index="${index}">
                    <img src="${objectUrl}" alt="${this.escapeHtml(file.name)}" class="preview-thumb">
                    <span class="preview-name">${this.escapeHtml(file.name)}</span>
                    <button class="preview-remove" data-index="${index}">&times;</button>
                </div>
            `;
        });
        html += '</div>';
        html += `
            <div class="preview-caption">
                <input type="text" id="image-caption" placeholder="Ajouter une légende..." class="caption-input">
            </div>
            <div class="preview-actions">
                <button class="btn btn-secondary preview-cancel">Annuler</button>
                <button class="btn btn-primary preview-send">Envoyer</button>
            </div>
        `;
        body.innerHTML = html;

        // Remove button handler
        body.querySelectorAll('.preview-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.index, 10);
                files.splice(idx, 1);
                if (files.length === 0) {
                    this.hideModal('image-preview-modal');
                } else {
                    this.showImagePreview(files);
                }
            });
        });

        // Cancel
        body.querySelector('.preview-cancel')?.addEventListener('click', () => {
            this.hideModal('image-preview-modal');
        });

        // Send
        body.querySelector('.preview-send')?.addEventListener('click', async () => {
            const caption = document.getElementById('image-caption')?.value || '';
            this.hideModal('image-preview-modal');
            // Compress images before sending
            const compressed = await Promise.all(files.map(f => this.compressImage(f)));
            this.state.attachments = compressed;
            const composer = document.getElementById('message-composer');
            if (composer && caption) composer.value = caption;
            this.handleSendMessage();
        });

        this.showModal('image-preview-modal');
    },

    createImagePreviewModal(files) {
        const modal = document.createElement('div');
        modal.id = 'image-preview-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-overlay modal-close"></div>
            <div class="modal-dialog">
                <div class="modal-header">
                    <h3>Aperçu des images</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body"></div>
            </div>
        `;
        document.body.appendChild(modal);
        this.showImagePreview(files);
    },

    showFilePreview(files) {
        let modal = document.getElementById('file-preview-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'file-preview-modal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-overlay modal-close"></div>
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h3>Fichiers à envoyer</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body"></div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        const body = modal.querySelector('.modal-body');
        if (!body) return;

        let html = '<div class="file-preview-list">';
        files.forEach((file, index) => {
            const icon = this.getFileIcon(file.name);
            html += `
                <div class="file-preview-card" data-index="${index}">
                    <span class="file-icon-large">${icon}</span>
                    <div class="file-preview-info">
                        <span class="file-preview-name">${this.escapeHtml(file.name)}</span>
                        <span class="file-preview-size">${this.formatFileSize(file.size)}</span>
                    </div>
                    <button class="preview-remove" data-index="${index}">&times;</button>
                </div>
            `;
        });
        html += '</div>';
        html += `
            <div class="preview-actions">
                <button class="btn btn-secondary preview-cancel">Annuler</button>
                <button class="btn btn-primary preview-send">Envoyer</button>
            </div>
        `;
        body.innerHTML = html;

        body.querySelectorAll('.preview-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.index, 10);
                files.splice(idx, 1);
                if (files.length === 0) {
                    this.hideModal('file-preview-modal');
                } else {
                    this.showFilePreview(files);
                }
            });
        });

        body.querySelector('.preview-cancel')?.addEventListener('click', () => {
            this.hideModal('file-preview-modal');
        });

        body.querySelector('.preview-send')?.addEventListener('click', () => {
            this.hideModal('file-preview-modal');
            this.state.attachments = [...files];
            this.handleSendMessage();
        });

        this.showModal('file-preview-modal');
    },

    // =========================================================================
    // UI
    // =========================================================================

    showView(viewName) {
        this.state.currentView = viewName;
        const views = ['login', 'chat', 'library', 'agenda', 'directory', 'admin', 'profile'];
        views.forEach(v => {
            const el = document.getElementById(`${v}-view`) || document.getElementById(`${v}-panel`);
            if (el) el.classList.add('hidden');
        });

        // Also handle auth views
        const authViews = ['login-view', 'register-view', 'forgot-view'];
        if (viewName === 'login') {
            authViews.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });
            const loginView = document.getElementById('login-view');
            if (loginView) loginView.classList.remove('hidden');
            const authContainer = document.getElementById('auth-container');
            if (authContainer) authContainer.classList.remove('hidden');
            const appContainer = document.getElementById('app-container');
            if (appContainer) appContainer.classList.add('hidden');
            return;
        }

        // Show app container, hide auth
        const authContainer = document.getElementById('auth-container');
        if (authContainer) authContainer.classList.add('hidden');
        const appContainer = document.getElementById('app-container');
        if (appContainer) appContainer.classList.remove('hidden');

        const target = document.getElementById(`${viewName}-view`) || document.getElementById(`${viewName}-panel`);
        if (target) target.classList.remove('hidden');

        // Load data for specific views
        switch (viewName) {
            case 'library':
                this.loadDocuments('');
                break;
            case 'agenda':
                this.loadEvents();
                break;
            case 'directory':
                this.loadMembers('', 1);
                break;
            case 'admin':
                if (this.state.currentUser && (this.state.currentUser.role === 'admin' || this.state.currentUser.role === 'superadmin')) {
                    this.loadAdminStats();
                    this.loadPendingMembers();
                    this.loadReports();
                }
                break;
            case 'profile':
                this.loadProfile();
                break;
            case 'chat':
                // Show sidebar + chat on desktop
                const sidebar = document.getElementById('sidebar');
                const chatPanel = document.getElementById('chat-panel');
                if (sidebar) sidebar.classList.remove('hidden');
                if (chatPanel && !this.state.isMobile) chatPanel.classList.remove('hidden');
                break;
        }

        // Update bottom nav active state
        document.querySelectorAll('[data-view]').forEach(el => {
            el.classList.toggle('active', el.dataset.view === viewName);
        });
    },

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.add('modal-visible');
        modal.style.display = 'flex';
        requestAnimationFrame(() => {
            modal.classList.add('modal-fade-in');
        });
        document.body.style.overflow = 'hidden';
    },

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.remove('modal-fade-in');
        modal.classList.add('modal-fade-out');
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('modal-visible', 'modal-fade-out');
            document.body.style.overflow = '';
        }, 300);
    },

    showToast(message, type = 'info') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:10000;display:flex;flex-direction:column;gap:8px;';
            document.body.appendChild(container);
        }

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            display:flex;align-items:center;gap:8px;padding:12px 20px;border-radius:8px;
            color:#fff;font-size:14px;max-width:350px;box-shadow:0 4px 12px rgba(0,0,0,0.2);
            transform:translateX(120%);transition:transform 0.3s ease;cursor:pointer;
        `;
        const bgColors = {
            success: '#27ae60',
            error: '#e74c3c',
            warning: '#f39c12',
            info: '#3498db'
        };
        toast.style.backgroundColor = bgColors[type] || bgColors.info;
        toast.innerHTML = `<span>${icons[type] || ''}</span><span>${this.escapeHtml(message)}</span>`;

        container.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(0)';
        });

        toast.addEventListener('click', () => {
            toast.style.transform = 'translateX(120%)';
            setTimeout(() => toast.remove(), 300);
        });

        setTimeout(() => {
            toast.style.transform = 'translateX(120%)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    showLoading() {
        let overlay = document.getElementById('loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            overlay.style.cssText = `
                position:fixed;top:0;left:0;width:100%;height:100%;
                background:rgba(0,0,0,0.4);display:flex;align-items:center;
                justify-content:center;z-index:10001;
            `;
            overlay.innerHTML = `
                <div class="loading-spinner" style="
                    width:48px;height:48px;border:4px solid rgba(255,255,255,0.3);
                    border-top-color:#fff;border-radius:50%;
                    animation:spin 0.8s linear infinite;
                "></div>
            `;
            // Add keyframes if not present
            if (!document.getElementById('spinner-keyframes')) {
                const style = document.createElement('style');
                style.id = 'spinner-keyframes';
                style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
                document.head.appendChild(style);
            }
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'flex';
    },

    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.style.display = 'none';
    },

    autoResizeComposer(textarea) {
        textarea.style.height = 'auto';
        const maxHeight = 120;
        textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px';
    },

    openImageViewer(src) {
        let viewer = document.getElementById('image-viewer');
        if (!viewer) {
            viewer = document.createElement('div');
            viewer.id = 'image-viewer';
            viewer.style.cssText = `
                position:fixed;top:0;left:0;width:100%;height:100%;
                background:rgba(0,0,0,0.95);display:flex;align-items:center;
                justify-content:center;z-index:10002;cursor:zoom-out;
            `;
            viewer.addEventListener('click', () => {
                viewer.style.display = 'none';
            });
            document.body.appendChild(viewer);
        }
        viewer.innerHTML = `<img src="${this.escapeHtml(src)}" style="max-width:90%;max-height:90%;object-fit:contain;">`;
        viewer.style.display = 'flex';
    },

    showContextMenu(event, messageId) {
        // Remove existing
        const existing = document.querySelector('.context-menu');
        if (existing) existing.remove();

        this.state.contextMenuTarget = messageId;
        const msg = this.state.messages.find(m => String(m.id) === String(messageId));
        const isOwn = msg && this.state.currentUser && msg.sender_id === this.state.currentUser.id;
        const isAdmin = this.state.currentUser && (this.state.currentUser.role === 'admin' || this.state.currentUser.role === 'superadmin');

        let menuItems = [
            { label: 'Répondre', action: 'reply', icon: '↩' },
        ];

        if (isOwn) {
            menuItems.push({ label: 'Modifier', action: 'edit', icon: '✏' });
            menuItems.push({ label: 'Supprimer', action: 'delete', icon: '🗑' });
        }

        if (isOwn || isAdmin) {
            menuItems.push({ label: 'Infos', action: 'info', icon: 'ℹ' });
        }

        if (isAdmin) {
            menuItems.push({ label: 'Épingler', action: 'pin', icon: '📌' });
        }

        if (!isOwn) {
            menuItems.push({ label: 'Signaler', action: 'report', icon: '⚠' });
        }

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.cssText = `
            position:fixed;z-index:9999;background:#fff;border-radius:8px;
            box-shadow:0 4px 16px rgba(0,0,0,0.15);overflow:hidden;min-width:160px;
        `;

        let menuHtml = '';
        menuItems.forEach(item => {
            menuHtml += `
                <div class="context-menu-item" data-action="${item.action}" style="
                    padding:10px 16px;cursor:pointer;display:flex;align-items:center;gap:8px;
                    font-size:14px;transition:background 0.15s;
                " onmouseover="this.style.background='#f0f0f0'" onmouseout="this.style.background='transparent'">
                    <span>${item.icon}</span>
                    <span>${item.label}</span>
                </div>
            `;
        });
        menu.innerHTML = menuHtml;

        // Position
        const x = event.clientX || 0;
        const y = event.clientY || 0;
        menu.style.left = Math.min(x, window.innerWidth - 200) + 'px';
        menu.style.top = Math.min(y, window.innerHeight - (menuItems.length * 40 + 20)) + 'px';

        document.body.appendChild(menu);

        // Handle clicks
        menu.addEventListener('click', e => {
            const item = e.target.closest('[data-action]');
            if (!item) return;
            const action = item.dataset.action;
            menu.remove();

            switch (action) {
                case 'reply':
                    this.startReply(messageId);
                    break;
                case 'edit':
                    this.startEdit(messageId);
                    break;
                case 'delete':
                    this.deleteMessage(parseInt(messageId, 10));
                    break;
                case 'info':
                    this.getMessageInfo(parseInt(messageId, 10));
                    break;
                case 'pin':
                    this.pinMessage(parseInt(messageId, 10));
                    break;
                case 'report':
                    this.showReportDialog(messageId);
                    break;
            }
        });
    },

    startReply(messageId) {
        const msg = this.state.messages.find(m => String(m.id) === String(messageId));
        if (!msg) return;

        this.state.replyingTo = msg.id;
        const replyBar = document.getElementById('reply-bar');
        if (replyBar) {
            replyBar.style.display = 'flex';
            const replyName = replyBar.querySelector('.reply-bar-name');
            const replyText = replyBar.querySelector('.reply-bar-text');
            if (replyName) replyName.textContent = msg.sender_name || '';
            if (replyText) replyText.textContent = this.truncate(msg.content || '', 60);
        }

        const composer = document.getElementById('message-composer');
        if (composer) composer.focus();
    },

    startEdit(messageId) {
        const msg = this.state.messages.find(m => String(m.id) === String(messageId));
        if (!msg) return;

        this.state.editingMessageId = msg.id;
        const composer = document.getElementById('message-composer');
        if (composer) {
            composer.value = msg.content || '';
            composer.focus();
            this.autoResizeComposer(composer);
        }

        const editBar = document.getElementById('edit-bar');
        if (editBar) {
            editBar.style.display = 'flex';
            const editText = editBar.querySelector('.edit-bar-text');
            if (editText) editText.textContent = this.truncate(msg.content || '', 60);
        }
    },

    showReportDialog(messageId) {
        const reportForm = document.getElementById('report-form');
        if (reportForm) {
            reportForm.dataset.messageId = messageId;
            const reasonSelect = document.getElementById('report-reason');
            const commentInput = document.getElementById('report-comment');
            if (reasonSelect) reasonSelect.value = '';
            if (commentInput) commentInput.value = '';
        }
        this.showModal('report-modal');
    },

    // =========================================================================
    // SEARCH
    // =========================================================================

    async search(query, filters = {}) {
        const params = new URLSearchParams({ q: query, ...filters });
        const result = await this.api(`api/search.php?${params}`);
        if (result) {
            this.renderSearchResults(result);
        }
    },

    renderSearchResults(results) {
        const container = document.getElementById('search-results');
        if (!container) return;

        let html = '';

        // Messages
        if (results.messages && results.messages.length > 0) {
            html += '<div class="search-section"><h4 class="search-section-title">Messages</h4>';
            results.messages.forEach(msg => {
                html += `
                    <div class="search-result-item" data-group-id="${msg.group_id}" data-message-id="${msg.id}">
                        <div class="search-result-meta">
                            <span class="search-sender">${this.escapeHtml(msg.sender_name || '')}</span>
                            <span class="search-group">${this.escapeHtml(msg.group_name || '')}</span>
                            <span class="search-time">${this.timeAgo(new Date(msg.created_at))}</span>
                        </div>
                        <div class="search-result-content">${this.escapeHtml(this.truncate(msg.content || '', 120))}</div>
                    </div>
                `;
            });
            html += '</div>';
        }

        // Files
        if (results.files && results.files.length > 0) {
            html += '<div class="search-section"><h4 class="search-section-title">Fichiers</h4>';
            results.files.forEach(file => {
                html += `
                    <a href="${this.escapeHtml(file.url)}" class="search-result-item search-file" target="_blank" download>
                        <span class="file-icon">${this.getFileIcon(file.name)}</span>
                        <div class="search-file-info">
                            <span class="search-file-name">${this.escapeHtml(file.name)}</span>
                            <span class="search-file-size">${this.formatFileSize(file.size)}</span>
                        </div>
                    </a>
                `;
            });
            html += '</div>';
        }

        // Members
        if (results.members && results.members.length > 0) {
            html += '<div class="search-section"><h4 class="search-section-title">Membres</h4>';
            results.members.forEach(member => {
                const avatar = member.photo_url
                    ? `<img src="${this.escapeHtml(member.photo_url)}" class="search-member-avatar">`
                    : `<img src="${this.generateInitialsAvatar(member.name)}" class="search-member-avatar">`;
                html += `
                    <div class="search-result-item search-member">
                        ${avatar}
                        <div class="search-member-info">
                            <span class="search-member-name">${this.escapeHtml(member.name)}</span>
                            <span class="search-member-specialty">${this.escapeHtml(member.specialty || '')}</span>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }

        if (!html) {
            html = '<div class="search-empty">Aucun résultat trouvé</div>';
        }

        container.innerHTML = html;
        container.style.display = 'block';

        // Click handler for message results -> navigate to group/message
        container.querySelectorAll('[data-group-id]').forEach(el => {
            el.addEventListener('click', () => {
                const gid = parseInt(el.dataset.groupId, 10);
                this.openGroup(gid);
                container.style.display = 'none';
                const searchInput = document.getElementById('search-input');
                if (searchInput) searchInput.value = '';
            });
        });
    },

    // =========================================================================
    // LIBRARY
    // =========================================================================

    async loadDocuments(category) {
        let endpoint = 'api/library.php';
        if (category) endpoint += `?category=${encodeURIComponent(category)}`;
        const result = await this.api(endpoint);
        if (result && result.documents) {
            this.renderLibrary(result.documents, result.categories || []);
        }
    },

    renderLibrary(docs, categories = []) {
        const container = document.getElementById('library-content');
        if (!container) return;

        let html = '';

        // Category tabs
        if (categories.length > 0) {
            html += '<div class="library-tabs">';
            html += '<button class="library-tab active" data-category="">Tous</button>';
            categories.forEach(cat => {
                html += `<button class="library-tab" data-category="${this.escapeHtml(cat)}">${this.escapeHtml(cat)}</button>`;
            });
            html += '</div>';
        }

        // Document grid
        html += '<div class="library-grid">';
        if (docs.length === 0) {
            html += '<div class="library-empty">Aucun document disponible</div>';
        } else {
            docs.forEach(doc => {
                const icon = this.getFileIcon(doc.filename || doc.name || '');
                html += `
                    <div class="library-card">
                        <div class="library-card-icon">${icon}</div>
                        <div class="library-card-info">
                            <h4 class="library-card-name">${this.escapeHtml(doc.name || doc.filename || 'Document')}</h4>
                            <div class="library-card-meta">
                                <span class="library-card-size">${doc.size ? this.formatFileSize(doc.size) : ''}</span>
                                <span class="library-card-date">${doc.created_at ? this.formatDate(new Date(doc.created_at)) : ''}</span>
                            </div>
                            ${doc.category ? `<span class="library-card-category">${this.escapeHtml(doc.category)}</span>` : ''}
                        </div>
                        <a href="${this.escapeHtml(doc.url || '#')}" class="btn btn-sm btn-primary library-download" download target="_blank">
                            Télécharger
                        </a>
                    </div>
                `;
            });
        }
        html += '</div>';

        container.innerHTML = html;
    },

    // =========================================================================
    // AGENDA
    // =========================================================================

    async loadEvents() {
        const result = await this.api('api/agenda.php');
        if (result && result.events) {
            this.renderAgenda(result.events);
        }
    },

    renderAgenda(events) {
        const container = document.getElementById('agenda-content');
        if (!container) return;

        if (events.length === 0) {
            container.innerHTML = '<div class="agenda-empty">Aucun événement à venir</div>';
            return;
        }

        let html = '<div class="agenda-timeline">';
        let currentMonth = '';

        events.forEach(event => {
            const eventDate = new Date(event.start_date || event.date);
            const monthYear = eventDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

            if (monthYear !== currentMonth) {
                currentMonth = monthYear;
                html += `<div class="agenda-month-header">${this.escapeHtml(monthYear)}</div>`;
            }

            const dayStr = eventDate.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
            const timeStr = event.start_time || this.formatTime(eventDate);
            const endTime = event.end_time || (event.end_date ? this.formatTime(new Date(event.end_date)) : '');

            html += `
                <div class="agenda-event">
                    <div class="agenda-event-date">
                        <span class="agenda-day">${this.escapeHtml(dayStr)}</span>
                        <span class="agenda-time">${this.escapeHtml(timeStr)}${endTime ? ' - ' + this.escapeHtml(endTime) : ''}</span>
                    </div>
                    <div class="agenda-event-content">
                        <h4 class="agenda-event-title">${this.escapeHtml(event.title)}</h4>
                        ${event.location ? `<div class="agenda-event-location">📍 ${this.escapeHtml(event.location)}</div>` : ''}
                        ${event.description ? `<p class="agenda-event-desc">${this.escapeHtml(event.description)}</p>` : ''}
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    },

    // =========================================================================
    // DIRECTORY
    // =========================================================================

    async loadMembers(search = '', page = 1) {
        let endpoint = `api/members.php?page=${page}`;
        if (search) endpoint += `&search=${encodeURIComponent(search)}`;
        const result = await this.api(endpoint);
        if (result && result.members) {
            this.state.membersCache = result.members;
            this.renderDirectory(result.members, result.total || 0, result.page || 1, result.pages || 1);
        }
    },

    renderDirectory(members, total = 0, currentPage = 1, totalPages = 1) {
        const container = document.getElementById('directory-content');
        if (!container) return;

        let html = `
            <div class="directory-header">
                <input type="text" id="directory-search" placeholder="Rechercher un membre..." class="directory-search-input" value="">
                <span class="directory-count">${total} membre${total > 1 ? 's' : ''}</span>
            </div>
            <div class="directory-grid">
        `;

        if (members.length === 0) {
            html += '<div class="directory-empty">Aucun membre trouvé</div>';
        } else {
            members.forEach(member => {
                const name = `${member.first_name || ''} ${member.last_name || ''}`.trim();
                const avatarHtml = member.photo_url
                    ? `<img src="${this.escapeHtml(member.photo_url)}" class="directory-avatar" alt="">`
                    : `<img src="${this.generateInitialsAvatar(name)}" class="directory-avatar" alt="">`;

                html += `
                    <div class="directory-card">
                        <div class="directory-card-avatar">${avatarHtml}</div>
                        <h4 class="directory-card-name">${this.escapeHtml(name)}</h4>
                        ${member.specialty ? `<div class="directory-card-specialty">${this.escapeHtml(member.specialty)}</div>` : ''}
                        ${member.city ? `<div class="directory-card-city">📍 ${this.escapeHtml(member.city)}</div>` : ''}
                    </div>
                `;
            });
        }

        html += '</div>';

        // Pagination
        if (totalPages > 1) {
            html += '<div class="directory-pagination">';
            for (let p = 1; p <= totalPages; p++) {
                html += `<button class="pagination-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
            }
            html += '</div>';
        }

        container.innerHTML = html;

        // Search input handler
        const searchInput = document.getElementById('directory-search');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce(e => {
                this.loadMembers(e.target.value.trim(), 1);
            }, 400));
        }

        // Pagination handler
        container.querySelectorAll('.pagination-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = parseInt(btn.dataset.page, 10);
                const search = document.getElementById('directory-search')?.value || '';
                this.loadMembers(search, page);
            });
        });
    },

    // =========================================================================
    // PROFILE
    // =========================================================================

    async loadProfile() {
        const result = await this.api('api/auth.php?action=me');
        if (result && result.user) {
            this.state.currentUser = result.user;
            this.renderProfile(result.user);
        }
    },

    renderProfile(user) {
        const container = document.getElementById('profile-content');
        if (!container) return;

        const name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
        const avatarHtml = user.photo_url
            ? `<img src="${this.escapeHtml(user.photo_url)}" class="profile-photo" id="profile-photo-display">`
            : `<img src="${this.generateInitialsAvatar(name)}" class="profile-photo" id="profile-photo-display">`;

        container.innerHTML = `
            <div class="profile-header">
                <div class="profile-avatar-section">
                    ${avatarHtml}
                    <label for="profile-photo-input" class="profile-photo-edit">📷 Changer la photo</label>
                    <input type="file" id="profile-photo-input" accept="image/*" style="display:none">
                </div>
                <h2 class="profile-name">${this.escapeHtml(name)}</h2>
                <span class="profile-role">${this.escapeHtml(user.role || 'membre')}</span>
            </div>
            <form id="profile-form" class="profile-form">
                <div class="form-group">
                    <label>Prénom</label>
                    <input type="text" name="first_name" value="${this.escapeHtml(user.first_name || '')}" required>
                </div>
                <div class="form-group">
                    <label>Nom</label>
                    <input type="text" name="last_name" value="${this.escapeHtml(user.last_name || '')}" required>
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" name="email" value="${this.escapeHtml(user.email || '')}" readonly>
                </div>
                <div class="form-group">
                    <label>Téléphone</label>
                    <input type="tel" name="phone" value="${this.escapeHtml(user.phone || '')}">
                </div>
                <div class="form-group">
                    <label>Spécialité</label>
                    <input type="text" name="specialty" value="${this.escapeHtml(user.specialty || '')}">
                </div>
                <div class="form-group">
                    <label>Ville</label>
                    <input type="text" name="city" value="${this.escapeHtml(user.city || '')}">
                </div>
                <div class="form-group">
                    <label>Bio</label>
                    <textarea name="bio" rows="3">${this.escapeHtml(user.bio || '')}</textarea>
                </div>
                <button type="submit" class="btn btn-primary">Enregistrer</button>
            </form>
            <div class="profile-actions">
                <button id="enable-push-btn" class="btn btn-secondary">Activer les notifications push</button>
                <button id="logout-btn" class="btn btn-danger">Se déconnecter</button>
            </div>
        `;

        // Re-bind event listeners for dynamically created elements
        const profilePhotoInput = document.getElementById('profile-photo-input');
        if (profilePhotoInput) {
            profilePhotoInput.addEventListener('change', e => {
                if (e.target.files[0]) this.uploadProfilePhoto(e.target.files[0]);
            });
        }

        const profileForm = document.getElementById('profile-form');
        if (profileForm) {
            profileForm.addEventListener('submit', e => {
                e.preventDefault();
                const formData = new FormData(profileForm);
                const data = {};
                formData.forEach((val, key) => { data[key] = val; });
                this.updateProfile(data);
            });
        }

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', e => {
                e.preventDefault();
                this.logout();
            });
        }

        const pushBtn = document.getElementById('enable-push-btn');
        if (pushBtn) {
            pushBtn.addEventListener('click', () => this.requestPushPermission());
        }
    },

    async updateProfile(data) {
        this.showLoading();
        const result = await this.api('api/profile.php', {
            method: 'PUT',
            body: data
        });
        this.hideLoading();
        if (result && result.success) {
            if (result.user) this.state.currentUser = result.user;
            this.showToast('Profil mis à jour', 'success');
            this.renderUserInfo();
        }
    },

    async uploadProfilePhoto(file) {
        this.showLoading();
        const compressed = await this.compressImage(file);
        const formData = new FormData();
        formData.append('photo', compressed);

        const result = await this.api('api/profile.php?action=photo', {
            method: 'POST',
            body: formData
        });
        this.hideLoading();
        if (result && result.success) {
            if (result.photo_url) {
                this.state.currentUser.photo_url = result.photo_url;
                const photo = document.getElementById('profile-photo-display');
                if (photo) photo.src = result.photo_url;
            }
            this.renderUserInfo();
            this.showToast('Photo mise à jour', 'success');
        }
    },

    // =========================================================================
    // ADMIN
    // =========================================================================

    async loadPendingMembers() {
        const result = await this.api('api/admin.php?action=pending');
        if (result && result.members) {
            this.renderPendingMembers(result.members);
        }
    },

    async approveMember(id) {
        const result = await this.api('api/admin.php?action=approve', {
            method: 'POST',
            body: { member_id: id }
        });
        if (result && result.success) {
            this.showToast('Membre approuvé', 'success');
            this.loadPendingMembers();
            this.loadAdminStats();
        }
    },

    async rejectMember(id) {
        if (!confirm('Rejeter cette inscription ?')) return;
        const result = await this.api('api/admin.php?action=reject', {
            method: 'POST',
            body: { member_id: id }
        });
        if (result && result.success) {
            this.showToast('Inscription rejetée', 'success');
            this.loadPendingMembers();
            this.loadAdminStats();
        }
    },

    async suspendMember(id) {
        if (!confirm('Suspendre ce membre ?')) return;
        const result = await this.api('api/admin.php?action=suspend', {
            method: 'POST',
            body: { member_id: id }
        });
        if (result && result.success) {
            this.showToast('Membre suspendu', 'success');
            this.loadPendingMembers();
        }
    },

    async changeRole(id, role) {
        const result = await this.api('api/admin.php?action=change-role', {
            method: 'POST',
            body: { member_id: id, role }
        });
        if (result && result.success) {
            this.showToast('Rôle modifié', 'success');
        }
    },

    async loadReports() {
        const result = await this.api('api/admin.php?action=reports');
        if (result && result.reports) {
            this.renderReports(result.reports);
        }
    },

    async handleReport(id, action) {
        const result = await this.api('api/admin.php?action=handle-report', {
            method: 'POST',
            body: { report_id: id, action }
        });
        if (result && result.success) {
            const labels = { dismiss: 'Signalement rejeté', warn: 'Avertissement envoyé', ban: 'Membre banni' };
            this.showToast(labels[action] || 'Action effectuée', 'success');
            this.loadReports();
        }
    },

    async loadAdminStats() {
        const result = await this.api('api/admin.php?action=stats');
        if (result && result.stats) {
            this.renderAdminDashboard(result.stats);
        }
    },

    renderAdminDashboard(stats) {
        const container = document.getElementById('admin-stats');
        if (!container) return;

        container.innerHTML = `
            <div class="admin-stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${stats.total_members || 0}</div>
                    <div class="stat-label">Membres</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.pending_members || 0}</div>
                    <div class="stat-label">En attente</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.total_messages || 0}</div>
                    <div class="stat-label">Messages</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.total_groups || 0}</div>
                    <div class="stat-label">Groupes</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.active_today || 0}</div>
                    <div class="stat-label">Actifs aujourd'hui</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.pending_reports || 0}</div>
                    <div class="stat-label">Signalements</div>
                </div>
            </div>
        `;
    },

    renderPendingMembers(members) {
        const container = document.getElementById('admin-pending');
        if (!container) return;

        if (members.length === 0) {
            container.innerHTML = '<p class="admin-empty">Aucune inscription en attente</p>';
            return;
        }

        let html = '<h3>Inscriptions en attente</h3><div class="admin-table">';
        html += `
            <div class="admin-table-header">
                <span>Nom</span>
                <span>Email</span>
                <span>Spécialité</span>
                <span>Date</span>
                <span>Actions</span>
            </div>
        `;

        members.forEach(member => {
            const name = `${member.first_name || ''} ${member.last_name || ''}`.trim();
            html += `
                <div class="admin-member-row">
                    <span>${this.escapeHtml(name)}</span>
                    <span>${this.escapeHtml(member.email || '')}</span>
                    <span>${this.escapeHtml(member.specialty || '-')}</span>
                    <span>${member.created_at ? this.formatDate(new Date(member.created_at)) : ''}</span>
                    <span class="admin-actions">
                        <button class="btn btn-sm btn-success" data-admin-action="approve" data-id="${member.id}">Approuver</button>
                        <button class="btn btn-sm btn-danger" data-admin-action="reject" data-id="${member.id}">Rejeter</button>
                    </span>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    },

    renderReports(reports) {
        const container = document.getElementById('admin-reports');
        if (!container) return;

        if (reports.length === 0) {
            container.innerHTML = '<p class="admin-empty">Aucun signalement en attente</p>';
            return;
        }

        let html = '<h3>Signalements</h3><div class="admin-table">';
        html += `
            <div class="admin-table-header">
                <span>Message</span>
                <span>Signalé par</span>
                <span>Raison</span>
                <span>Date</span>
                <span>Actions</span>
            </div>
        `;

        reports.forEach(report => {
            html += `
                <div class="admin-report-row">
                    <span class="report-message-preview">${this.escapeHtml(this.truncate(report.message_content || '', 60))}</span>
                    <span>${this.escapeHtml(report.reporter_name || '')}</span>
                    <span>${this.escapeHtml(report.reason || '')}</span>
                    <span>${report.created_at ? this.formatDate(new Date(report.created_at)) : ''}</span>
                    <span class="admin-actions">
                        <button class="btn btn-sm btn-secondary" data-admin-action="dismiss-report" data-id="${report.id}">Rejeter</button>
                        <button class="btn btn-sm btn-warning" data-admin-action="warn-report" data-id="${report.id}">Avertir</button>
                        <button class="btn btn-sm btn-danger" data-admin-action="ban-report" data-id="${report.id}">Bannir</button>
                    </span>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    },

    // =========================================================================
    // NOTIFICATIONS
    // =========================================================================

    async loadNotifications() {
        const result = await this.api('api/notifications.php');
        if (result && result.notifications) {
            this.renderNotifications(result.notifications);
        }
    },

    renderNotifications(notifications) {
        const container = document.getElementById('notifications-list');
        if (!container) return;

        if (notifications.length === 0) {
            container.innerHTML = '<div class="notifications-empty">Aucune notification</div>';
            return;
        }

        let html = '';
        notifications.forEach(notif => {
            html += `
                <div class="notification-item ${notif.read ? '' : 'notification-unread'}" data-notification-id="${notif.id}">
                    <div class="notification-content">
                        <p class="notification-text">${this.escapeHtml(notif.message || notif.content || '')}</p>
                        <span class="notification-time">${this.timeAgo(new Date(notif.created_at))}</span>
                    </div>
                    ${!notif.read ? '<button class="notification-mark-read" data-notif-id="' + notif.id + '">Marquer lu</button>' : ''}
                </div>
            `;
        });
        container.innerHTML = html;

        // Mark as read handlers
        container.querySelectorAll('.notification-mark-read').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                this.markNotificationRead(parseInt(btn.dataset.notifId, 10));
                const item = btn.closest('.notification-item');
                if (item) item.classList.remove('notification-unread');
                btn.remove();
            });
        });
    },

    async markNotificationRead(id) {
        await this.api('api/notifications.php', {
            method: 'POST',
            body: { notification_id: id, action: 'read' }
        });
    },

    getUnreadCount() {
        let total = 0;
        for (const gId in this.state.unreadCounts) {
            total += this.state.unreadCounts[gId] || 0;
        }
        return total;
    },

    async requestPushPermission() {
        if (!('Notification' in window)) {
            this.showToast('Les notifications ne sont pas supportées par ce navigateur', 'warning');
            return;
        }

        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            this.showToast('Notifications activées', 'success');

            // Subscribe to push if service worker available
            if ('serviceWorker' in navigator && 'PushManager' in window) {
                try {
                    const registration = await navigator.serviceWorker.ready;
                    const subscription = await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: this.urlBase64ToUint8Array(
                            document.querySelector('meta[name="vapid-public-key"]')?.getAttribute('content') || ''
                        )
                    });

                    // Send subscription to server
                    await this.api('api/notifications.php?action=subscribe', {
                        method: 'POST',
                        body: { subscription: JSON.stringify(subscription) }
                    });
                } catch (err) {
                    console.error('Push subscription failed:', err);
                }
            }
        } else if (permission === 'denied') {
            this.showToast('Notifications bloquées. Vérifiez les paramètres du navigateur.', 'warning');
        }
    },

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; i++) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    },

    // =========================================================================
    // ANONYMIZATION
    // =========================================================================

    showAnonymizationConfirmation() {
        let modal = document.getElementById('anonymization-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'anonymization-modal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-overlay modal-close"></div>
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h3>Rappel important</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="anonymization-warning">
                            <div class="anonymization-icon">⚠️</div>
                            <h4>Anonymisation des données cliniques</h4>
                            <p>Avant de partager un cas clinique, veuillez vous assurer que toutes les données permettant d'identifier le patient ont été retirées ou modifiées :</p>
                            <ul>
                                <li>Nom et prénom du patient</li>
                                <li>Date de naissance exacte</li>
                                <li>Numéro de dossier</li>
                                <li>Adresse et téléphone</li>
                                <li>Tout élément d'identification sur les images</li>
                            </ul>
                            <p><strong>En publiant dans ce groupe, vous confirmez que les données sont anonymisées.</strong></p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary anonymization-confirm">J'ai compris et je confirme</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelector('.anonymization-confirm')?.addEventListener('click', () => {
                this.hideModal('anonymization-modal');
            });
        }

        this.showModal('anonymization-modal');
    },

    // =========================================================================
    // @MENTION AUTOCOMPLETE
    // =========================================================================

    handleMentionAutocomplete(textarea) {
        const text = textarea.value;
        const cursorPos = textarea.selectionStart;

        // Find @ before cursor
        let atPos = -1;
        for (let i = cursorPos - 1; i >= 0; i--) {
            if (text[i] === '@') {
                atPos = i;
                break;
            }
            if (text[i] === ' ' || text[i] === '\n') {
                break;
            }
        }

        if (atPos === -1) {
            this.hideMentionDropdown();
            return;
        }

        const query = text.substring(atPos + 1, cursorPos).toLowerCase();
        this.state.composerMentionStart = atPos;

        if (query.length === 0) {
            // Show all cached members
            this.showMentionDropdown(this.state.membersCache.slice(0, 10), textarea);
            return;
        }

        // Filter members
        const filtered = this.state.membersCache.filter(m => {
            const fullName = `${m.first_name || ''} ${m.last_name || ''}`.toLowerCase();
            return fullName.includes(query);
        }).slice(0, 8);

        if (filtered.length > 0) {
            this.showMentionDropdown(filtered, textarea);
        } else {
            // Fetch from server
            this.api(`api/members.php?search=${encodeURIComponent(query)}&limit=8`).then(result => {
                if (result && result.members) {
                    this.showMentionDropdown(result.members, textarea);
                }
            });
        }
    },

    showMentionDropdown(members, textarea) {
        let dropdown = document.getElementById('mention-dropdown');
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.id = 'mention-dropdown';
            dropdown.className = 'mention-dropdown';
            dropdown.style.cssText = `
                position:absolute;z-index:9999;background:#fff;border:1px solid #ddd;
                border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.12);max-height:200px;
                overflow-y:auto;min-width:200px;
            `;
            const composerContainer = textarea.closest('.composer-container') || textarea.parentElement;
            if (composerContainer) {
                composerContainer.style.position = 'relative';
                composerContainer.appendChild(dropdown);
            } else {
                document.body.appendChild(dropdown);
            }
        }

        if (members.length === 0) {
            this.hideMentionDropdown();
            return;
        }

        let html = '';
        members.forEach(m => {
            const name = `${m.first_name || ''} ${m.last_name || ''}`.trim();
            const username = m.username || name.replace(/\s+/g, '.').toLowerCase();
            const avatar = m.photo_url
                ? `<img src="${this.escapeHtml(m.photo_url)}" class="mention-avatar" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">`
                : `<img src="${this.generateInitialsAvatar(name)}" class="mention-avatar" style="width:28px;height:28px;border-radius:50%;">`;

            html += `
                <div class="mention-item" data-username="${this.escapeHtml(username)}" data-display-name="${this.escapeHtml(name)}" style="
                    display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;
                " onmouseover="this.style.background='#f0f0f0'" onmouseout="this.style.background='transparent'">
                    ${avatar}
                    <span class="mention-name" style="font-size:14px;">${this.escapeHtml(name)}</span>
                </div>
            `;
        });

        dropdown.innerHTML = html;
        dropdown.style.display = 'block';
        dropdown.style.bottom = (textarea.offsetHeight + 4) + 'px';
        dropdown.style.left = '0';

        this.state.mentionDropdownVisible = true;
    },

    hideMentionDropdown() {
        const dropdown = document.getElementById('mention-dropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
        this.state.mentionDropdownVisible = false;
    },

    insertMention(username, displayName) {
        const composer = document.getElementById('message-composer');
        if (!composer) return;

        const text = composer.value;
        const atPos = this.state.composerMentionStart;
        const cursorPos = composer.selectionStart;

        const before = text.substring(0, atPos);
        const after = text.substring(cursorPos);
        const mention = `@${username} `;

        composer.value = before + mention + after;
        composer.selectionStart = composer.selectionEnd = before.length + mention.length;
        composer.focus();

        this.hideMentionDropdown();
    },

    // =========================================================================
    // UTILS
    // =========================================================================

    formatTime(date) {
        if (!(date instanceof Date) || isNaN(date)) return '';
        const h = String(date.getHours()).padStart(2, '0');
        const m = String(date.getMinutes()).padStart(2, '0');
        return `${h}:${m}`;
    },

    formatDate(date) {
        if (!(date instanceof Date) || isNaN(date)) return '';
        const d = String(date.getDate()).padStart(2, '0');
        const mo = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        return `${d}/${mo}/${y}`;
    },

    timeAgo(date) {
        if (!(date instanceof Date) || isNaN(date)) return '';
        const now = new Date();
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffH = Math.floor(diffMin / 60);
        const diffD = Math.floor(diffH / 24);

        if (diffSec < 30) return 'à l\'instant';
        if (diffSec < 60) return `il y a ${diffSec}s`;
        if (diffMin < 60) return `il y a ${diffMin} min`;
        if (diffH < 24) return `il y a ${diffH}h`;
        if (diffD === 1) return 'hier';
        if (diffD < 7) return `il y a ${diffD}j`;
        if (diffD < 30) {
            const weeks = Math.floor(diffD / 7);
            return `il y a ${weeks} sem.`;
        }
        if (diffD < 365) {
            const months = Math.floor(diffD / 30);
            return `il y a ${months} mois`;
        }
        const years = Math.floor(diffD / 365);
        return `il y a ${years} an${years > 1 ? 's' : ''}`;
    },

    escapeHtml(str) {
        if (str === null || str === undefined) return '';
        const s = String(str);
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return s.replace(/[&<>"']/g, c => map[c]);
    },

    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        const size = (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0);
        return `${size} ${units[i]}`;
    },

    debounce(fn, ms) {
        let timer = null;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), ms);
        };
    },

    generateInitialsAvatar(name) {
        if (!name) name = '?';
        const parts = name.trim().split(/\s+/);
        let initials = '';
        if (parts.length >= 2) {
            initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        } else {
            initials = parts[0].substring(0, 2).toUpperCase();
        }

        const color = this.hashColor(name);
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="40" fill="${color}"/>
                <text x="40" y="40" text-anchor="middle" dy="0.35em" fill="#fff"
                    font-family="Arial, sans-serif" font-size="28" font-weight="600">
                    ${this.escapeHtml(initials)}
                </text>
            </svg>
        `;
        return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    },

    hashColor(str) {
        const colors = [
            '#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12',
            '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b',
            '#8e44ad', '#2980b9', '#27ae60', '#d35400', '#2c3e50',
            '#7f8c8d', '#f1c40f', '#e91e63', '#00bcd4', '#ff5722'
        ];
        let hash = 0;
        for (let i = 0; i < (str || '').length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
            hash = hash & hash;
        }
        return colors[Math.abs(hash) % colors.length];
    }
};

// =========================================================================
// BOOTSTRAP
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {
    NadarConnect.init();
});
