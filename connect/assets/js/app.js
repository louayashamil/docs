/**
 * NADAR Connect - Application JavaScript SPA
 * Plateforme de messagerie communautaire pour ophtalmologistes
 * Vanilla ES6+ - Aucun framework
 */

const App = {
    // =========================================================================
    // 1. STATE
    // =========================================================================
    state: {
        user: null,
        groups: [],
        currentGroup: null,
        messages: [],
        pollingInterval: null,
        pollingTimeout: null,
        unreadCounts: {},
        lastMessageIds: {},
        anonAccepted: {},
        attachments: [],
        replyTo: null,
        editingMessage: null,
        csrfToken: null,
        isMobile: window.innerWidth < 768,
        searchDebounceTimer: null,
        isLoadingMore: false,
        hasMoreMessages: true,
        currentView: 'chat',
        notificationsOpen: false,
        notifications: [],
        pendingMembers: [],
        reports: [],
        members: [],
        documents: [],
        events: [],
        adminStats: {},
        messagePage: 1,
        memberPage: 1,
        memberSearch: '',
        docCategory: '',
        toastTimeout: null
    },

    // =========================================================================
    // 2. INIT
    // =========================================================================
    init() {
        this.state.isMobile = window.innerWidth < 768;
        this.state.csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
        this.checkAuth();
        this.setupEventListeners();
        this.registerServiceWorker();
        window.addEventListener('resize', () => {
            this.state.isMobile = window.innerWidth < 768;
            this.handleResize();
        });
    },

    handleResize() {
        this.state.isMobile = window.innerWidth < 768;
        if (!this.state.isMobile) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.remove('hidden');
            const mainContent = document.getElementById('mainContent');
            if (mainContent) mainContent.classList.remove('hidden');
        }
    },

    // =========================================================================
    // 3. SETUP EVENT LISTENERS
    // =========================================================================
    setupEventListeners() {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.login();
            });
        }

        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.register();
            });
        }

        const composerForm = document.getElementById('composerForm');
        if (composerForm) {
            composerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.sendMessage();
            });
        }

        const composerInput = document.getElementById('composerInput');
        if (composerInput) {
            composerInput.addEventListener('input', () => {
                composerInput.style.height = 'auto';
                composerInput.style.height = Math.min(composerInput.scrollHeight, 120) + 'px';
            });
            composerInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        const attachBtn = document.getElementById('attachBtn');
        const fileInput = document.getElementById('fileInput');
        if (attachBtn && fileInput) {
            attachBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                Array.from(e.target.files).forEach(f => this.handleAttachment(f, 'file'));
                fileInput.value = '';
            });
        }

        const photoBtn = document.getElementById('photoBtn');
        const photoInput = document.getElementById('photoInput');
        if (photoBtn && photoInput) {
            photoBtn.addEventListener('click', () => photoInput.click());
            photoInput.addEventListener('change', (e) => {
                Array.from(e.target.files).forEach(f => this.handleAttachment(f, 'photo'));
                photoInput.value = '';
            });
        }

        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(this.state.searchDebounceTimer);
                this.state.searchDebounceTimer = setTimeout(() => {
                    this.search(e.target.value);
                }, 350);
            });
        }

        const notifBadge = document.getElementById('notifBadge');
        if (notifBadge) {
            notifBadge.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleNotifications();
            });
        }

        document.querySelectorAll('.mobile-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const view = tab.dataset.view;
                if (view) {
                    this.showView(view);
                }
                document.querySelectorAll('.mobile-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
            });
        });

        document.querySelectorAll('.group-section-toggle').forEach(btn => {
            btn.addEventListener('click', () => this.toggleOtherGroups());
        });

        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            messagesContainer.addEventListener('scroll', () => {
                if (messagesContainer.scrollTop < 80 && !this.state.isLoadingMore && this.state.hasMoreMessages) {
                    this.loadMoreMessages();
                }
            });
        }

        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.showSearch();
            }
            if (e.key === 'Escape') {
                this.hideAllModals();
                this.hideSearch();
            }
        });

        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('notificationsDropdown');
            if (dropdown && !dropdown.contains(e.target) && this.state.notificationsOpen) {
                this.toggleNotifications();
            }
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal(modal.id);
                }
            });
        });

        const imageViewer = document.getElementById('imageViewer');
        if (imageViewer) {
            imageViewer.addEventListener('click', (e) => {
                if (e.target === imageViewer) {
                    this.closeImageViewer();
                }
            });
        }

        const reportForm = document.getElementById('reportForm');
        if (reportForm) {
            reportForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitReport();
            });
        }

        window.addEventListener('beforeunload', () => {
            this.stopPolling();
        });
    },

    // =========================================================================
    // 4. API HELPER
    // =========================================================================
    async api(endpoint, options = {}) {
        const url = '/connect/api/' + endpoint;
        const config = {
            method: options.method || 'GET',
            headers: {},
            credentials: 'same-origin'
        };

        if (this.state.csrfToken) {
            config.headers['X-CSRF-Token'] = this.state.csrfToken;
        }

        if (options.body instanceof FormData) {
            config.body = options.body;
        } else if (options.body) {
            config.headers['Content-Type'] = 'application/json';
            config.body = JSON.stringify(options.body);
        }

        try {
            const response = await fetch(url, config);

            if (response.status === 401) {
                this.state.user = null;
                this.stopPolling();
                this.showLanding();
                throw new Error('Session expirée. Veuillez vous reconnecter.');
            }

            if (response.status === 403) {
                throw new Error('Accès refusé.');
            }

            if (response.status === 429) {
                throw new Error('Trop de requêtes. Veuillez patienter.');
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.message || 'Erreur serveur');
            }

            if (data.csrf_token) {
                this.state.csrfToken = data.csrf_token;
            }

            return data;
        } catch (error) {
            if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
                throw new Error('Erreur de connexion. Vérifiez votre réseau.');
            }
            throw error;
        }
    },

    // =========================================================================
    // 5. AUTH
    // =========================================================================
    async checkAuth() {
        try {
            const data = await this.api('auth.php?action=me');
            if (data && data.user) {
                this.state.user = data.user;
                if (data.user.role === 'pending') {
                    this.showWaiting();
                } else if (data.user.role === 'suspended') {
                    this.showLanding();
                } else {
                    this.showApp();
                }
            } else {
                this.showLanding();
            }
        } catch (e) {
            this.showLanding();
        }
    },

    async login() {
        const form = document.getElementById('loginForm');
        const email = form.querySelector('[name="email"]').value.trim();
        const password = form.querySelector('[name="password"]').value;

        if (!email || !password) {
            this.showToast('Veuillez remplir tous les champs.', 'error');
            return;
        }

        const submitBtn = form.querySelector('[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Connexion...';

        try {
            const data = await this.api('auth.php?action=login', {
                method: 'POST',
                body: { email, password }
            });

            if (data.success) {
                this.state.user = data.user;
                this.hideModal('loginModal');
                form.reset();

                if (data.user.role === 'pending') {
                    this.showWaiting();
                } else if (data.user.role === 'suspended') {
                    this.showToast('Votre compte a été suspendu.', 'error');
                } else {
                    this.showApp();
                }
            } else {
                this.showToast(data.error || 'Identifiants incorrects.', 'error');
            }
        } catch (e) {
            this.showToast(e.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    },

    async register() {
        const form = document.getElementById('registerForm');
        const formData = new FormData(form);

        const requiredFields = ['first_name', 'last_name', 'email', 'password', 'rpps', 'city'];
        for (const field of requiredFields) {
            if (!formData.get(field)?.trim()) {
                this.showToast('Veuillez remplir tous les champs obligatoires.', 'error');
                return;
            }
        }

        const password = formData.get('password');
        const passwordConfirm = formData.get('password_confirm');
        if (password !== passwordConfirm) {
            this.showToast('Les mots de passe ne correspondent pas.', 'error');
            return;
        }

        if (password.length < 8) {
            this.showToast('Le mot de passe doit contenir au moins 8 caractères.', 'error');
            return;
        }

        const submitBtn = form.querySelector('[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Inscription...';

        try {
            const data = await this.api('auth.php?action=register', {
                method: 'POST',
                body: formData
            });

            if (data.success) {
                this.state.user = data.user;
                this.hideModal('registerModal');
                form.reset();
                this.showWaiting();
                this.showToast('Inscription réussie ! En attente de validation.', 'success');
            } else {
                this.showToast(data.error || "Erreur lors de l'inscription.", 'error');
            }
        } catch (e) {
            this.showToast(e.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    },

    async logout() {
        try {
            await this.api('auth.php?action=logout', { method: 'POST' });
        } catch (e) {
            /* ignore */
        }
        this.state.user = null;
        this.state.groups = [];
        this.state.messages = [];
        this.state.currentGroup = null;
        this.stopPolling();
        this.showLanding();
    },

    async forgotPassword(email) {
        if (!email || !email.trim()) {
            this.showToast('Veuillez entrer votre adresse email.', 'error');
            return;
        }

        try {
            const data = await this.api('auth.php?action=forgot_password', {
                method: 'POST',
                body: { email: email.trim() }
            });
            this.showToast(data.message || 'Un email de réinitialisation a été envoyé.', 'success');
        } catch (e) {
            this.showToast(e.message, 'error');
        }
    },

    async resetPassword(token, newPassword) {
        if (!newPassword || newPassword.length < 8) {
            this.showToast('Le mot de passe doit contenir au moins 8 caractères.', 'error');
            return;
        }

        try {
            const data = await this.api('auth.php?action=reset_password', {
                method: 'POST',
                body: { token, password: newPassword }
            });
            if (data.success) {
                this.showToast('Mot de passe réinitialisé avec succès.', 'success');
                this.hideAllModals();
            }
        } catch (e) {
            this.showToast(e.message, 'error');
        }
    },

    async changePassword(currentPassword, newPassword, confirmPassword) {
        if (newPassword !== confirmPassword) {
            this.showToast('Les mots de passe ne correspondent pas.', 'error');
            return;
        }
        if (newPassword.length < 8) {
            this.showToast('Le mot de passe doit contenir au moins 8 caractères.', 'error');
            return;
        }

        try {
            const data = await this.api('auth.php?action=change_password', {
                method: 'POST',
                body: {
                    current_password: currentPassword,
                    new_password: newPassword
                }
            });
            if (data.success) {
                this.showToast('Mot de passe modifié avec succès.', 'success');
            }
        } catch (e) {
            this.showToast(e.message, 'error');
        }
    },

    // =========================================================================
    // 6. VIEW MANAGEMENT
    // =========================================================================
    showLanding() {
        const landing = document.getElementById('landingPage');
        const app = document.getElementById('appContainer');
        const waiting = document.getElementById('waitingPage');
        if (landing) landing.style.display = '';
        if (app) app.style.display = 'none';
        if (waiting) waiting.style.display = 'none';
        this.stopPolling();
    },

    showApp() {
        const landing = document.getElementById('landingPage');
        const app = document.getElementById('appContainer');
        const waiting = document.getElementById('waitingPage');
        if (landing) landing.style.display = 'none';
        if (app) app.style.display = '';
        if (waiting) waiting.style.display = 'none';

        this.updateUserUI();
        this.loadGroups();
        this.startPolling();
        this.requestNotificationPermission();
    },

    showWaiting() {
        const landing = document.getElementById('landingPage');
        const app = document.getElementById('appContainer');
        const waiting = document.getElementById('waitingPage');
        if (landing) landing.style.display = 'none';
        if (app) app.style.display = 'none';
        if (waiting) waiting.style.display = '';
        this.stopPolling();
    },

    showView(viewName) {
        const views = ['chatView', 'libraryView', 'agendaView', 'directoryView', 'adminView', 'profileView'];
        views.forEach(v => {
            const el = document.getElementById(v);
            if (el) el.style.display = 'none';
        });

        const targetView = document.getElementById(viewName + 'View') || document.getElementById(viewName);
        if (targetView) targetView.style.display = '';

        this.state.currentView = viewName;

        switch (viewName) {
            case 'chat':
                if (this.state.currentGroup) {
                    this.loadMessages(this.state.currentGroup.id);
                }
                break;
            case 'library':
                this.loadDocuments();
                break;
            case 'agenda':
                this.loadEvents();
                break;
            case 'directory':
                this.state.memberPage = 1;
                this.loadMembers();
                break;
            case 'admin':
                if (this.isAdmin()) {
                    this.loadAdminDashboard();
                }
                break;
            case 'profile':
                this.renderProfile();
                break;
        }
    },

    // =========================================================================
    // 7. GROUPS
    // =========================================================================
    async loadGroups() {
        try {
            const data = await this.api('groups.php?action=list');
            this.state.groups = data.groups || [];
            this.renderGroupList();

            if (this.state.groups.length > 0 && !this.state.currentGroup) {
                this.openGroup(this.state.groups[0]);
            }
        } catch (e) {
            this.showToast('Erreur lors du chargement des groupes.', 'error');
        }
    },

    renderGroupList() {
        const groupList = document.getElementById('groupList');
        if (!groupList) return;

        const mainGroups = this.state.groups.filter(g => g.type === 'main' || g.category === 'general');
        const otherGroups = this.state.groups.filter(g => g.type !== 'main' && g.category !== 'general');

        let html = '';

        mainGroups.forEach(group => {
            html += this.renderGroupItem(group);
        });

        if (otherGroups.length > 0) {
            html += '<div class="group-section">';
            html += '<button class="group-section-toggle" onclick="App.toggleOtherGroups()">';
            html += '<span>Autre</span>';
            html += '<span class="toggle-icon">&#9660;</span>';
            html += '</button>';
            html += '<div class="group-section-content" style="display:none;">';
            otherGroups.forEach(group => {
                html += this.renderGroupItem(group);
            });
            html += '</div></div>';
        }

        groupList.innerHTML = html;
    },

    renderGroupItem(group) {
        const unread = this.state.unreadCounts[group.id] || 0;
        const isActive = this.state.currentGroup && this.state.currentGroup.id === group.id;
        const lastMsg = group.last_message;
        let preview = '';
        let timeStr = '';

        if (lastMsg) {
            const senderName = lastMsg.sender_id === this.state.user?.id
                ? 'Vous'
                : (lastMsg.sender_name || '');
            const msgText = lastMsg.content
                ? lastMsg.content.substring(0, 50)
                : (lastMsg.has_attachment ? 'Piece jointe' : '');
            preview = senderName ? senderName + ': ' + msgText : msgText;
            if (preview.length > 55) preview = preview.substring(0, 55) + '...';
            timeStr = this.timeAgo(lastMsg.created_at);
        }

        const badgeHtml = unread > 0
            ? '<span class="unread-badge">' + (unread > 99 ? '99+' : unread) + '</span>'
            : '';

        const icon = group.icon
            || (group.type === 'clinical_cases' ? '&#127973;' : (group.type === 'main' ? '&#128172;' : '&#128101;'));

        const groupData = this.escapeHtml(JSON.stringify(group));

        return '<div class="group-item ' + (isActive ? 'active' : '') + '" data-group-id="' + group.id + '" onclick=\'App.openGroup(' + JSON.stringify(group).replace(/'/g, "\\'") + ')\'>'
            + '<div class="group-icon">' + icon + '</div>'
            + '<div class="group-info">'
            + '<div class="group-name-row">'
            + '<span class="group-name">' + this.escapeHtml(group.name) + '</span>'
            + '<span class="group-time">' + timeStr + '</span>'
            + '</div>'
            + '<div class="group-preview-row">'
            + '<span class="group-preview">' + this.escapeHtml(preview) + '</span>'
            + badgeHtml
            + '</div>'
            + '</div>'
            + '</div>';
    },

    toggleOtherGroups() {
        const content = document.querySelector('.group-section-content');
        const icon = document.querySelector('.toggle-icon');
        if (content) {
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? '' : 'none';
            if (icon) icon.innerHTML = isHidden ? '&#9650;' : '&#9660;';
        }
    },

    async openGroup(group) {
        if (typeof group === 'string') {
            group = this.state.groups.find(g => g.id === group || g.id === parseInt(group));
        }
        if (!group) return;

        this.state.currentGroup = group;
        this.state.messages = [];
        this.state.hasMoreMessages = true;
        this.state.messagePage = 1;
        this.clearReply();
        this.clearAttachments();

        const chatName = document.getElementById('chatName');
        const chatMembers = document.getElementById('chatMembers');
        if (chatName) chatName.textContent = group.name;
        if (chatMembers) chatMembers.textContent = (group.member_count || 0) + ' membres';

        this.showView('chat');

        if (this.state.isMobile) {
            const sidebar = document.getElementById('sidebar');
            const mainContent = document.getElementById('mainContent');
            if (sidebar) sidebar.classList.add('hidden');
            if (mainContent) mainContent.classList.remove('hidden');
        }

        document.querySelectorAll('.group-item').forEach(item => {
            item.classList.toggle('active', String(item.dataset.groupId) === String(group.id));
        });

        await this.loadMessages(group.id);
        this.markAsRead(group.id);
    },

    async createGroup(name, type, description) {
        if (!this.isAdmin()) {
            this.showToast('Acces reserve aux administrateurs.', 'error');
            return;
        }

        try {
            const data = await this.api('groups.php?action=create', {
                method: 'POST',
                body: { name, type, description }
            });
            if (data.success) {
                this.showToast('Groupe cree avec succes.', 'success');
                await this.loadGroups();
            }
        } catch (e) {
            this.showToast(e.message, 'error');
        }
    },

    // =========================================================================
    // 8. MESSAGES
    // =========================================================================
    async loadMessages(groupId, before) {
        if (!groupId) return;

        try {
            let endpoint = 'messages.php?action=list&group_id=' + groupId + '&limit=50';
            if (before) {
                endpoint += '&before=' + before;
            }

            const data = await this.api(endpoint);
            const msgs = data.messages || [];

            if (before) {
                this.state.messages = msgs.concat(this.state.messages);
                this.renderMessages(msgs, true);
            } else {
                this.state.messages = msgs;
                this.renderMessages(msgs, false);
                this.scrollToBottom();
            }

            this.state.hasMoreMessages = msgs.length >= 50;

            if (msgs.length > 0) {
                this.state.lastMessageIds[groupId] = msgs[msgs.length - 1].id;
            }
        } catch (e) {
            this.showToast('Erreur lors du chargement des messages.', 'error');
        }
    },

    async loadMoreMessages() {
        if (this.state.isLoadingMore || !this.state.hasMoreMessages || !this.state.currentGroup) return;

        this.state.isLoadingMore = true;
        const container = document.getElementById('messagesContainer');
        const previousHeight = container ? container.scrollHeight : 0;

        const firstMsg = this.state.messages[0];
        if (firstMsg) {
            await this.loadMessages(this.state.currentGroup.id, firstMsg.id);

            if (container) {
                const newHeight = container.scrollHeight;
                container.scrollTop = newHeight - previousHeight;
            }
        }

        this.state.isLoadingMore = false;
    },

    renderMessages(messages, prepend) {
        const container = document.getElementById('messagesContainer');
        if (!container) return;

        if (!prepend) {
            container.innerHTML = '';
        }

        const fragment = document.createDocumentFragment();
        let lastDate = prepend ? null : '';

        messages.forEach(msg => {
            const msgDate = this.formatDate(msg.created_at);
            if (msgDate !== lastDate) {
                const separator = document.createElement('div');
                separator.className = 'date-separator';
                separator.innerHTML = '<span>' + msgDate + '</span>';
                fragment.appendChild(separator);
                lastDate = msgDate;
            }

            const wrapper = document.createElement('div');
            wrapper.innerHTML = this.renderMessageBubble(msg);
            while (wrapper.firstChild) {
                fragment.appendChild(wrapper.firstChild);
            }
        });

        if (prepend && container.firstChild) {
            container.insertBefore(fragment, container.firstChild);
        } else {
            container.appendChild(fragment);
        }
    },

    renderMessageBubble(msg) {
        const isSent = msg.sender_id === this.state.user?.id;
        const bubbleClass = isSent ? 'message-bubble sent' : 'message-bubble received';
        const senderName = msg.is_anonymous ? 'Anonyme' : (msg.sender_name || 'Inconnu');

        let replyHtml = '';
        if (msg.reply_to && msg.reply_message) {
            const replyName = msg.reply_message.is_anonymous ? 'Anonyme' : (msg.reply_message.sender_name || 'Inconnu');
            const replyContent = (msg.reply_message.content || '').substring(0, 100);
            replyHtml = '<div class="reply-quote" onclick="App.scrollToMessage(' + msg.reply_to + ')">'
                + '<strong>' + this.escapeHtml(replyName) + '</strong>'
                + '<p>' + this.escapeHtml(replyContent) + '</p>'
                + '</div>';
        }

        let attachmentsHtml = '';
        if (msg.attachments && msg.attachments.length > 0) {
            attachmentsHtml = '<div class="message-attachments">';
            msg.attachments.forEach(att => {
                if (att.type && att.type.startsWith('image/')) {
                    attachmentsHtml += '<div class="attachment-image" onclick="App.openImageViewer(\'' + this.escapeHtml(att.url) + '\')">'
                        + '<img src="' + this.escapeHtml(att.thumbnail || att.url) + '" alt="' + this.escapeHtml(att.name || 'Image') + '" loading="lazy">'
                        + '</div>';
                } else if (att.type && att.type.startsWith('video/')) {
                    attachmentsHtml += '<div class="attachment-video">'
                        + '<video src="' + this.escapeHtml(att.url) + '" controls preload="metadata"></video>'
                        + '</div>';
                } else {
                    const fileIcon = this.getFileIcon(att.type || '');
                    const fileSize = att.size ? this.formatFileSize(att.size) : '';
                    attachmentsHtml += '<div class="attachment-file" onclick="App.downloadFile(\'' + this.escapeHtml(att.url) + '\', \'' + this.escapeHtml(att.name || 'fichier') + '\')">'
                        + '<span class="file-icon">' + fileIcon + '</span>'
                        + '<div class="file-info">'
                        + '<span class="file-name">' + this.escapeHtml(att.name || 'Fichier') + '</span>'
                        + '<span class="file-size">' + fileSize + '</span>'
                        + '</div>'
                        + '</div>';
                }
            });
            attachmentsHtml += '</div>';
        }

        const content = msg.content ? this.linkify(this.escapeHtml(msg.content)) : '';

        let statusHtml = '';
        if (isSent) {
            switch (msg.status) {
                case 'sent':
                    statusHtml = '<span class="msg-status">&#10003;</span>';
                    break;
                case 'delivered':
                    statusHtml = '<span class="msg-status delivered">&#10003;&#10003;</span>';
                    break;
                case 'read':
                    statusHtml = '<span class="msg-status read">&#10003;&#10003;</span>';
                    break;
                default:
                    statusHtml = '<span class="msg-status pending">&#8987;</span>';
            }
        }

        const editedLabel = msg.edited_at ? '<span class="edited-label">modifie</span>' : '';
        const pinnedHtml = msg.is_pinned ? '<div class="pinned-indicator">&#128204; Epingle</div>' : '';

        let actionsHtml = '<div class="message-actions">';
        actionsHtml += '<button class="msg-action-btn" onclick="App.replyToMessage(' + msg.id + ')" title="Repondre">&#8617;</button>';
        actionsHtml += '<button class="msg-action-btn" onclick="App.forwardMessage(' + msg.id + ')" title="Transferer">&#8599;</button>';

        if (isSent) {
            actionsHtml += '<button class="msg-action-btn" onclick="App.editMessage(' + msg.id + ')" title="Modifier">&#9998;</button>';
            actionsHtml += '<button class="msg-action-btn" onclick="App.deleteMessage(' + msg.id + ')" title="Supprimer">&#128465;</button>';
        }

        if (this.isAdmin()) {
            if (msg.is_pinned) {
                actionsHtml += '<button class="msg-action-btn" onclick="App.unpinMessage(' + msg.id + ')" title="Desepingler">&#128204;</button>';
            } else {
                actionsHtml += '<button class="msg-action-btn" onclick="App.pinMessage(' + msg.id + ')" title="Epingler">&#128204;</button>';
            }
            if (!isSent) {
                actionsHtml += '<button class="msg-action-btn" onclick="App.deleteMessage(' + msg.id + ')" title="Supprimer">&#128465;</button>';
            }
        }

        if (!isSent) {
            actionsHtml += '<button class="msg-action-btn" onclick="App.showReportModal(' + msg.id + ')" title="Signaler">&#9888;</button>';
        }

        if (isSent) {
            actionsHtml += '<button class="msg-action-btn" onclick="App.showMessageInfo(' + msg.id + ')" title="Infos">&#8505;</button>';
        }

        actionsHtml += '</div>';

        let html = '<div class="' + bubbleClass + '" data-message-id="' + msg.id + '" id="msg-' + msg.id + '">';
        html += pinnedHtml;
        if (!isSent) {
            html += '<div class="message-sender">' + this.escapeHtml(senderName) + '</div>';
        }
        html += replyHtml;
        html += attachmentsHtml;
        if (content) {
            html += '<div class="message-content">' + content + '</div>';
        }
        html += '<div class="message-meta">';
        html += editedLabel;
        html += '<span class="message-time">' + this.formatTime(msg.created_at) + '</span>';
        html += statusHtml;
        html += '</div>';
        html += actionsHtml;
        html += '</div>';

        return html;
    },

    async sendMessage() {
        const input = document.getElementById('composerInput');
        if (!input) return;

        const content = input.value.trim();
        if (!content && this.state.attachments.length === 0) return;

        const group = this.state.currentGroup;
        if (!group) return;

        if (group.type === 'clinical_cases' && !this.state.anonAccepted[group.id] && this.state.attachments.length > 0) {
            this.showAnonymizationConfirmation(() => {
                this.state.anonAccepted[group.id] = true;
                this.sendMessage();
            });
            return;
        }

        const tempId = this.generateTempId();
        const formData = new FormData();
        formData.append('group_id', group.id);
        formData.append('content', content);
        formData.append('temp_id', tempId);

        if (this.state.replyTo) {
            formData.append('reply_to', this.state.replyTo);
        }

        if (this.state.editingMessage) {
            formData.append('message_id', this.state.editingMessage);
        }

        this.state.attachments.forEach((att, idx) => {
            formData.append('attachments[' + idx + ']', att.file);
            if (att.caption) {
                formData.append('captions[' + idx + ']', att.caption);
            }
        });

        const tempMsg = {
            id: tempId,
            sender_id: this.state.user.id,
            sender_name: this.state.user.first_name + ' ' + this.state.user.last_name,
            content: content,
            created_at: new Date().toISOString(),
            status: 'sending',
            attachments: this.state.attachments.map(a => ({
                name: a.file.name,
                type: a.file.type,
                size: a.file.size,
                url: a.preview || ''
            })),
            reply_to: this.state.replyTo,
            reply_message: this.state.replyTo ? this.state.messages.find(m => m.id === this.state.replyTo) : null
        };

        this.state.messages.push(tempMsg);
        const container = document.getElementById('messagesContainer');
        if (container) {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = this.renderMessageBubble(tempMsg);
            while (wrapper.firstChild) {
                container.appendChild(wrapper.firstChild);
            }
        }
        this.scrollToBottom();

        input.value = '';
        input.style.height = 'auto';
        this.clearReply();
        this.clearAttachments();

        const action = this.state.editingMessage ? 'edit' : 'send';
        this.state.editingMessage = null;

        try {
            const data = await this.api('messages.php?action=' + action, {
                method: 'POST',
                body: formData
            });

            if (data.success && data.message) {
                const idx = this.state.messages.findIndex(m => m.id === tempId);
                if (idx !== -1) {
                    this.state.messages[idx] = data.message;
                }
                const tempBubble = document.querySelector('[data-message-id="' + tempId + '"]');
                if (tempBubble) {
                    tempBubble.outerHTML = this.renderMessageBubble(data.message);
                }
                this.state.lastMessageIds[group.id] = data.message.id;
            }
        } catch (e) {
            const tempBubble = document.querySelector('[data-message-id="' + tempId + '"]');
            if (tempBubble) {
                tempBubble.classList.add('failed');
            }
            this.showToast(e.message, 'error');
        }
    },

    async editMessage(messageId) {
        const msg = this.state.messages.find(m => m.id === messageId);
        if (!msg || msg.sender_id !== this.state.user?.id) return;

        const input = document.getElementById('composerInput');
        if (input) {
            input.value = msg.content || '';
            input.focus();
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        }

        this.state.editingMessage = messageId;

        const composerForm = document.getElementById('composerForm');
        if (composerForm) {
            let editIndicator = composerForm.querySelector('.edit-indicator');
            if (!editIndicator) {
                editIndicator = document.createElement('div');
                editIndicator.className = 'edit-indicator';
                composerForm.insertBefore(editIndicator, composerForm.firstChild);
            }
            editIndicator.innerHTML = '<span>Modification du message</span>'
                + '<button onclick="App.cancelEdit()">&times;</button>';
            editIndicator.style.display = '';
        }
    },

    cancelEdit() {
        this.state.editingMessage = null;
        const input = document.getElementById('composerInput');
        if (input) {
            input.value = '';
            input.style.height = 'auto';
        }
        const indicator = document.querySelector('.edit-indicator');
        if (indicator) indicator.style.display = 'none';
    },

    async deleteMessage(messageId) {
        if (!confirm('Supprimer ce message ?')) return;

        try {
            const data = await this.api('messages.php?action=delete', {
                method: 'POST',
                body: { message_id: messageId }
            });
            if (data.success) {
                this.state.messages = this.state.messages.filter(m => m.id !== messageId);
                const bubble = document.querySelector('[data-message-id="' + messageId + '"]');
                if (bubble) bubble.remove();
                this.showToast('Message supprime.', 'success');
            }
        } catch (e) {
            this.showToast(e.message, 'error');
        }
    },

    async pinMessage(messageId) {
        try {
            const data = await this.api('messages.php?action=pin', {
                method: 'POST',
                body: { message_id: messageId }
            });
            if (data.success) {
                const msg = this.state.messages.find(m => m.id === messageId);
                if (msg) {
                    msg.is_pinned = true;
                    const bubble = document.querySelector('[data-message-id="' + messageId + '"]');
                    if (bubble) bubble.outerHTML = this.renderMessageBubble(msg);
                }
                this.showToast('Message epingle.', 'success');
            }
        } catch (e) {
            this.showToast(e.message, 'error');
        }
    },

    async unpinMessage(messageId) {
        try {
            const data = await this.api('messages.php?action=unpin', {
                method: 'POST',
                body: { message_id: messageId }
            });
            if (data.success) {
                const msg = this.state.messages.find(m => m.id === messageId);
                if (msg) {
                    msg.is_pinned = false;
                    const bubble = document.querySelector('[data-message-id="' + messageId + '"]');
                    if (bubble) bubble.outerHTML = this.renderMessageBubble(msg);
                }
                this.showToast('Message desepingle.', 'success');
            }
        } catch (e) {
            this.showToast(e.message, 'error');
        }
    },

    async markAsRead(groupId) {
        try {
            await this.api('messages.php?action=mark_read', {
                method: 'POST',
                body: { group_id: groupId }
            });
            this.state.unreadCounts[groupId] = 0;
            this.updateUnreadBadges();
        } catch (e) {
            /* silent */
        }
    },

    async showMessageInfo(messageId) {
        try {
            const data = await this.api('messages.php?action=info&message_id=' + messageId);
            const info = data.info || {};

            const modal = document.getElementById('messageInfoModal');
            if (!modal) return;

            const readList = (info.read || []).map(u =>
                '<li>' + this.escapeHtml(u.name) + ' - ' + this.formatDateTime(u.read_at) + '</li>'
            ).join('');
            const deliveredList = (info.delivered || []).map(u =>
                '<li>' + this.escapeHtml(u.name) + ' - ' + this.formatDateTime(u.delivered_at) + '</li>'
            ).join('');
            const notDeliveredList = (info.not_delivered || []).map(u =>
                '<li>' + this.escapeHtml(u.name) + '</li>'
            ).join('');

            const content = modal.querySelector('.modal-content') || modal;
            content.innerHTML = '<div class="modal-header">'
                + '<h3>Informations du message</h3>'
                + '<button class="modal-close" onclick="App.hideModal(\'messageInfoModal\')">&times;</button>'
                + '</div>'
                + '<div class="modal-body">'
                + '<div class="info-section">'
                + '<h4>Lu par (' + (info.read?.length || 0) + ')</h4>'
                + '<ul>' + (readList || '<li>Aucun</li>') + '</ul>'
                + '</div>'
                + '<div class="info-section">'
                + '<h4>Delivre a (' + (info.delivered?.length || 0) + ')</h4>'
                + '<ul>' + (deliveredList || '<li>Aucun</li>') + '</ul>'
                + '</div>'
                + '<div class="info-section">'
                + '<h4>Non delivre (' + (info.not_delivered?.length || 0) + ')</h4>'
                + '<ul>' + (notDeliveredList || '<li>Aucun</li>') + '</ul>'
                + '</div>'
                + '</div>';

            this.showModal('messageInfoModal');
        } catch (e) {
            this.showToast(e.message, 'error');
        }
    },

    replyToMessage(messageId) {
        const msg = this.state.messages.find(m => m.id === messageId);
        if (!msg) return;

        this.state.replyTo = messageId;

        const composerForm = document.getElementById('composerForm');
        if (composerForm) {
            let replyPreview = composerForm.querySelector('.reply-preview');
            if (!replyPreview) {
                replyPreview = document.createElement('div');
                replyPreview.className = 'reply-preview';
                composerForm.insertBefore(replyPreview, composerForm.firstChild);
            }

            const senderName = msg.is_anonymous ? 'Anonyme' : (msg.sender_name || 'Inconnu');
            replyPreview.innerHTML = '<div class="reply-preview-content">'
                + '<strong>' + this.escapeHtml(senderName) + '</strong>'
                + '<p>' + this.escapeHtml((msg.content || '').substring(0, 80)) + '</p>'
                + '</div>'
                + '<button onclick="App.clearReply()">&times;</button>';
            replyPreview.style.display = '';
        }

        const input = document.getElementById('composerInput');
        if (input) input.focus();
    },

    clearReply() {
        this.state.replyTo = null;
        const replyPreview = document.querySelector('.reply-preview');
        if (replyPreview) replyPreview.style.display = 'none';
    },

    scrollToMessage(messageId) {
        const bubble = document.getElementById('msg-' + messageId);
        if (bubble) {
            bubble.scrollIntoView({ behavior: 'smooth', block: 'center' });
            bubble.classList.add('highlight');
            setTimeout(() => bubble.classList.remove('highlight'), 2000);
        }
    },

    scrollToBottom() {
        const container = document.getElementById('messagesContainer');
        if (container) {
            requestAnimationFrame(() => {
                container.scrollTop = container.scrollHeight;
            });
        }
    },

    async forwardMessage(messageId) {
        const msg = this.state.messages.find(m => m.id === messageId);
        if (!msg) return;

        const targetGroups = this.state.groups.filter(g => g.id !== this.state.currentGroup?.id);
        const groupNames = targetGroups.map((g, i) => (i + 1) + '. ' + g.name).join('\n');

        const choice = prompt('Transferer vers quel groupe ?\n' + groupNames);
        if (!choice) return;

        const idx = parseInt(choice) - 1;
        const targetGroup = targetGroups[idx];
        if (!targetGroup) {
            this.showToast('Groupe invalide.', 'error');
            return;
        }

        try {
            const data = await this.api('messages.php?action=forward', {
                method: 'POST',
                body: {
                    message_id: messageId,
                    target_group_id: targetGroup.id
                }
            });
            if (data.success) {
                this.showToast('Message transfere vers ' + targetGroup.name + '.', 'success');
            }
        } catch (e) {
            this.showToast(e.message, 'error');
        }
    },

    // =========================================================================
    // 9. ATTACHMENTS
    // =========================================================================
    handleAttachment(file, type) {
        const maxSize = type === 'photo' ? 10 * 1024 * 1024 : 25 * 1024 * 1024;
        if (file.size > maxSize) {
            const maxLabel = type === 'photo' ? '10 Mo' : '25 Mo';
            this.showToast('Fichier trop volumineux. Maximum : ' + maxLabel, 'error');
            return;
        }

        const attachment = { file: file, type: type, id: this.generateTempId(), caption: '' };

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                attachment.preview = e.target.result;
                this.state.attachments.push(attachment);
                this.renderAttachmentPreviews();
            };
            reader.readAsDataURL(file);
        } else {
            this.state.attachments.push(attachment);
            this.renderAttachmentPreviews();
        }
    },

    renderAttachmentPreviews() {
        const container = document.getElementById('attachmentPreview');
        if (!container) return;

        if (this.state.attachments.length === 0) {
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }

        container.style.display = '';
        let html = '';
        this.state.attachments.forEach(att => {
            if (att.preview) {
                html += '<div class="attachment-preview-item" data-att-id="' + att.id + '">'
                    + '<img src="' + att.preview + '" alt="' + this.escapeHtml(att.file.name) + '">'
                    + '<input type="text" class="attachment-caption" placeholder="Legende..."'
                    + ' value="' + this.escapeHtml(att.caption) + '"'
                    + ' onchange="App.updateAttachmentCaption(\'' + att.id + '\', this.value)">'
                    + '<button class="remove-attachment" onclick="App.removeAttachment(\'' + att.id + '\')">&times;</button>'
                    + '</div>';
            } else {
                const icon = this.getFileIcon(att.file.type);
                html += '<div class="attachment-preview-item file-preview" data-att-id="' + att.id + '">'
                    + '<span class="preview-file-icon">' + icon + '</span>'
                    + '<span class="preview-file-name">' + this.escapeHtml(att.file.name) + '</span>'
                    + '<span class="preview-file-size">' + this.formatFileSize(att.file.size) + '</span>'
                    + '<button class="remove-attachment" onclick="App.removeAttachment(\'' + att.id + '\')">&times;</button>'
                    + '</div>';
            }
        });
        container.innerHTML = html;
    },

    updateAttachmentCaption(attId, caption) {
        const att = this.state.attachments.find(a => a.id === attId);
        if (att) att.caption = caption;
    },

    removeAttachment(attId) {
        this.state.attachments = this.state.attachments.filter(a => a.id !== attId);
        this.renderAttachmentPreviews();
    },

    clearAttachments() {
        this.state.attachments = [];
        this.renderAttachmentPreviews();
    },

    // =========================================================================
    // 10. IMAGE VIEWER
    // =========================================================================
    openImageViewer(url) {
        const viewer = document.getElementById('imageViewer');
        const viewerImage = document.getElementById('viewerImage');
        if (viewer && viewerImage) {
            viewerImage.src = url;
            viewer.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    },

    closeImageViewer() {
        const viewer = document.getElementById('imageViewer');
        if (viewer) {
            viewer.style.display = 'none';
            document.body.style.overflow = '';
        }
    },

    downloadFile(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'fichier';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    },

    // =========================================================================
    // 11. POLLING
    // =========================================================================
    startPolling() {
        this.stopPolling();
        this.state.pollingInterval = setInterval(() => {
            this.pollUpdates();
        }, 3000);
    },

    stopPolling() {
        if (this.state.pollingInterval) {
            clearInterval(this.state.pollingInterval);
            this.state.pollingInterval = null;
        }
    },

    async pollUpdates() {
        try {
            const params = new URLSearchParams({ action: 'poll' });

            Object.entries(this.state.lastMessageIds).forEach(([gid, mid]) => {
                params.append('last_ids[' + gid + ']', mid);
            });

            if (this.state.currentGroup) {
                params.append('current_group', this.state.currentGroup.id);
            }

            const data = await this.api('messages.php?' + params.toString());

            if (data.unread_counts) {
                this.state.unreadCounts = data.unread_counts;
                this.updateUnreadBadges();
            }

            if (data.new_messages && data.new_messages.length > 0 && this.state.currentGroup) {
                const container = document.getElementById('messagesContainer');
                const isNearBottom = container
                    ? (container.scrollHeight - container.scrollTop - container.clientHeight) < 100
                    : false;

                data.new_messages.forEach(msg => {
                    const exists = this.state.messages.find(m => m.id === msg.id);
                    if (!exists) {
                        this.state.messages.push(msg);
                        if (container) {
                            const wrapper = document.createElement('div');
                            wrapper.innerHTML = this.renderMessageBubble(msg);
                            while (wrapper.firstChild) {
                                container.appendChild(wrapper.firstChild);
                            }
                        }
                    }
                });

                const lastNew = data.new_messages[data.new_messages.length - 1];
                if (lastNew) {
                    this.state.lastMessageIds[this.state.currentGroup.id] = lastNew.id;
                }

                if (isNearBottom) {
                    this.scrollToBottom();
                }

                if (this.state.currentGroup) {
                    this.markAsRead(this.state.currentGroup.id);
                }
            }

            if (data.groups) {
                this.state.groups = data.groups;
                this.renderGroupList();
            }
        } catch (e) {
            /* silent polling failure */
        }
    },

    updateUnreadBadges() {
        document.querySelectorAll('.group-item').forEach(item => {
            const gid = item.dataset.groupId;
            const badge = item.querySelector('.unread-badge');
            const count = this.state.unreadCounts[gid] || 0;

            if (count > 0) {
                if (badge) {
                    badge.textContent = count > 99 ? '99+' : count;
                    badge.style.display = '';
                } else {
                    const previewRow = item.querySelector('.group-preview-row');
                    if (previewRow) {
                        const newBadge = document.createElement('span');
                        newBadge.className = 'unread-badge';
                        newBadge.textContent = count > 99 ? '99+' : count;
                        previewRow.appendChild(newBadge);
                    }
                }
            } else if (badge) {
                badge.style.display = 'none';
            }
        });

        const totalUnread = Object.values(this.state.unreadCounts).reduce((sum, c) => sum + (c || 0), 0);
        const globalBadge = document.getElementById('notifBadge');
        if (globalBadge) {
            if (totalUnread > 0) {
                globalBadge.textContent = totalUnread > 99 ? '99+' : totalUnread;
                globalBadge.style.display = '';
            } else {
                globalBadge.style.display = 'none';
            }
        }

        if ('setAppBadge' in navigator) {
            if (totalUnread > 0) {
                navigator.setAppBadge(totalUnread).catch(() => {});
            } else {
                navigator.clearAppBadge().catch(() => {});
            }
        }
    },

    // =========================================================================
    // 12. SEARCH
    // =========================================================================
    async search(query) {
        if (!query || query.trim().length < 2) {
            this.renderSearchResults({ messages: [], members: [] });
            return;
        }

        try {
            const data = await this.api('search.php?q=' + encodeURIComponent(query.trim()));
            this.renderSearchResults(data);
        } catch (e) {
            this.showToast(e.message, 'error');
        }
    },

    renderSearchResults(results) {
        const container = document.getElementById('searchResults');
        if (!container) return;

        let html = '';
        const messages = results.messages || [];
        const members = results.members || [];

        if (messages.length === 0 && members.length === 0) {
            html = '<div class="search-empty">Aucun resultat trouve.</div>';
        }

        if (members.length > 0) {
            html += '<div class="search-section"><h4>Membres</h4>';
            members.forEach(member => {
                const initials = (member.first_name?.[0] || '') + (member.last_name?.[0] || '');
                const avatar = member.avatar
                    ? '<img src="' + this.escapeHtml(member.avatar) + '" alt="">'
                    : '<span class="avatar-initials">' + this.escapeHtml(initials) + '</span>';
                html += '<div class="search-result-item member-result">'
                    + '<div class="search-avatar">' + avatar + '</div>'
                    + '<div>'
                    + '<div class="search-name">' + this.escapeHtml(member.first_name + ' ' + member.last_name) + '</div>'
                    + '<div class="search-meta">' + this.escapeHtml(member.city || '') + '</div>'
                    + '</div>'
                    + '</div>';
            });
            html += '</div>';
        }

        if (messages.length > 0) {
            html += '<div class="search-section"><h4>Messages</h4>';
            messages.forEach(msg => {
                const senderName = msg.is_anonymous ? 'Anonyme' : (msg.sender_name || 'Inconnu');
                const preview = (msg.content || '').substring(0, 100);
                html += '<div class="search-result-item message-result" onclick="App.openGroupAndScrollToMessage(' + msg.group_id + ', ' + msg.id + ')">'
                    + '<div>'
                    + '<div class="search-name">' + this.escapeHtml(senderName) + '</div>'
                    + '<div class="search-preview">' + this.escapeHtml(preview) + '</div>'
                    + '<div class="search-meta">' + this.escapeHtml(msg.group_name || '') + ' - ' + this.timeAgo(msg.created_at) + '</div>'
                    + '</div>'
                    + '</div>';
            });
            html += '</div>';
        }

        container.innerHTML = html;
    },

    async openGroupAndScrollToMessage(groupId, messageId) {
        const group = this.state.groups.find(g => g.id === groupId || g.id === parseInt(groupId));
        if (group) {
            await this.openGroup(group);
            setTimeout(() => this.scrollToMessage(messageId), 500);
        }
        this.hideSearch();
    },

    showSearch() {
        const overlay = document.getElementById('searchOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
            const input = document.getElementById('searchInput');
            if (input) {
                input.value = '';
                input.focus();
            }
            this.renderSearchResults({ messages: [], members: [] });
        }
    },

    hideSearch() {
        const overlay = document.getElementById('searchOverlay');
        if (overlay) overlay.style.display = 'none';
    },

    // =========================================================================
    // 13. LIBRARY
    // =========================================================================
    async loadDocuments(category) {
        if (category !== undefined) {
            this.state.docCategory = category;
        }

        try {
            let endpoint = 'documents.php?action=list';
            if (this.state.docCategory) {
                endpoint += '&category=' + encodeURIComponent(this.state.docCategory);
            }
            const data = await this.api(endpoint);
            this.state.documents = data.documents || [];
            this.renderLibrary();
        } catch (e) {
            this.showToast('Erreur lors du chargement des documents.', 'error');
        }
    },

    renderLibrary() {
        const view = document.getElementById('libraryView');
        if (!view) return;

        const categories = [];
        const seen = {};
        this.state.documents.forEach(d => {
            if (d.category && !seen[d.category]) {
                seen[d.category] = true;
                categories.push(d.category);
            }
        });

        let filterHtml = '<div class="library-filters">';
        filterHtml += '<button class="filter-btn ' + (!this.state.docCategory ? 'active' : '') + '" onclick="App.loadDocuments(\'\')">Tous</button>';
        categories.forEach(cat => {
            filterHtml += '<button class="filter-btn ' + (this.state.docCategory === cat ? 'active' : '') + '"'
                + ' onclick="App.loadDocuments(\'' + this.escapeHtml(cat) + '\')">' + this.escapeHtml(cat) + '</button>';
        });
        filterHtml += '</div>';

        let adminUpload = '';
        if (this.isAdmin()) {
            adminUpload = '<div class="library-upload">'
                + '<button class="btn btn-primary" onclick="App.showDocumentUploadForm()">Ajouter un document</button>'
                + '</div>';
        }

        let gridHtml = '<div class="library-grid">';
        if (this.state.documents.length === 0) {
            gridHtml += '<div class="empty-state">Aucun document disponible.</div>';
        } else {
            this.state.documents.forEach(doc => {
                const icon = this.getFileIcon(doc.mime_type || doc.type || '');
                const size = doc.size ? this.formatFileSize(doc.size) : '';
                gridHtml += '<div class="doc-card">'
                    + '<div class="doc-icon">' + icon + '</div>'
                    + '<div class="doc-info">'
                    + '<h4 class="doc-title">' + this.escapeHtml(doc.title || doc.name) + '</h4>'
                    + (doc.description ? '<p class="doc-desc">' + this.escapeHtml(doc.description) + '</p>' : '')
                    + '<div class="doc-meta">'
                    + (doc.category ? '<span class="doc-category">' + this.escapeHtml(doc.category) + '</span>' : '')
                    + '<span class="doc-size">' + size + '</span>'
                    + '<span class="doc-date">' + this.formatDate(doc.created_at) + '</span>'
                    + '</div>'
                    + '</div>'
                    + '<button class="btn btn-sm doc-download" onclick="App.downloadFile(\'' + this.escapeHtml(doc.url) + '\', \'' + this.escapeHtml(doc.name || doc.title) + '\')">Telecharger</button>'
                    + '</div>';
            });
        }
        gridHtml += '</div>';

        view.innerHTML = '<div class="view-header"><h2>Bibliotheque</h2></div>'
            + adminUpload
            + filterHtml
            + gridHtml;
    },

    showDocumentUploadForm() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'docUploadModal';
        modal.innerHTML = '<div class="modal-content">'
            + '<div class="modal-header">'
            + '<h3>Ajouter un document</h3>'
            + '<button class="modal-close" onclick="App.hideModal(\'docUploadModal\')">&times;</button>'
            + '</div>'
            + '<div class="modal-body">'
            + '<form id="docUploadForm" onsubmit="event.preventDefault(); App.uploadDocument();">'
            + '<div class="form-group"><label>Titre</label><input type="text" name="title" required></div>'
            + '<div class="form-group"><label>Description</label><textarea name="description" rows="3"></textarea></div>'
            + '<div class="form-group"><label>Categorie</label><input type="text" name="category" placeholder="Ex: Protocoles, Formations..."></div>'
            + '<div class="form-group"><label>Fichier</label><input type="file" name="file" required></div>'
            + '<button type="submit" class="btn btn-primary">Envoyer</button>'
            + '</form>'
            + '</div>'
            + '</div>';
        modal.addEventListener('click', (e) => { if (e.target === modal) App.hideModal('docUploadModal'); });
        document.body.appendChild(modal);
        modal.style.display = 'flex';
    },

    async uploadDocument() {
        if (!this.isAdmin()) return;

        const form = document.getElementById('docUploadForm');
        if (!form) return;

        const formData = new FormData(form);

        try {
            const data = await this.api('documents.php?action=upload', {
                method: 'POST',
                body: formData
            });
            if (data.success) {
                this.showToast('Document ajoute avec succes.', 'success');
                this.hideModal('docUploadModal');
                const modal = document.getElementById('docUploadModal');
                if (modal) modal.remove();
                this.loadDocuments();
            }
        } catch (e) {
            this.showToast(e.message, 'error');
        }
    },

    // =========================================================================
    // 14. AGENDA
    // =========================================================================
    async loadEvents() {
        try {
            const data = await this.api('events.php?action=list');
            this.state.events = data.events || [];
            this.renderAgenda();
        } catch (e) {
            this.showToast('Erreur lors du chargement des evenements.', 'error');
        }
    },

    renderAgenda() {
        const view = document.getElementById('agendaView');
        if (!view) return;

        let adminBtn = '';
        if (this.isAdmin()) {
            adminBtn = '<button class="btn btn-primary" onclick="App.showCreateEventForm()">Nouvel evenement</button>';
        }

        let eventsHtml = '';
        if (this.state.events.length === 0) {
            eventsHtml = '<div class="empty-state">Aucun evenement a venir.</div>';
        } else {
            const monthNames = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec'];
            this.state.events.forEach(event => {
                const startDate = new Date(event.start_date || event.date);
                const day = startDate.getDate();
                const month = monthNames[startDate.getMonth()];
                const year = startDate.getFullYear();

                const timeStr = event.start_time
                    ? event.start_time + (event.end_time ? ' - ' + event.end_time : '')
                    : '';
                const locationStr = event.location ? this.escapeHtml(event.location) : '';
                const regLink = event.registration_url
                    ? '<a href="' + this.escapeHtml(event.registration_url) + '" target="_blank" class="btn btn-sm btn-outline">S\'inscrire</a>'
                    : '';

                eventsHtml += '<div class="event-card">'
                    + '<div class="event-date-badge">'
                    + '<span class="event-day">' + day + '</span>'
                    + '<span class="event-month">' + month + '</span>'
                    + '<span class="event-year">' + year + '</span>'
                    + '</div>'
                    + '<div class="event-info">'
                    + '<h4 class="event-title">' + this.escapeHtml(event.title) + '</h4>'
                    + (event.description ? '<p class="event-desc">' + this.escapeHtml(event.description) + '</p>' : '')
                    + '<div class="event-meta">'
                    + (locationStr ? '<span>' + locationStr + '</span>' : '')
                    + (timeStr ? '<span>' + timeStr + '</span>' : '')
                    + '</div>'
                    + regLink
                    + '</div>'
                    + '</div>';
            });
        }

        view.innerHTML = '<div class="view-header"><h2>Agenda</h2>' + adminBtn + '</div>'
            + '<div class="events-list">' + eventsHtml + '</div>';
    },

    showCreateEventForm() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'createEventModal';
        modal.innerHTML = '<div class="modal-content">'
            + '<div class="modal-header">'
            + '<h3>Nouvel evenement</h3>'
            + '<button class="modal-close" onclick="App.hideModal(\'createEventModal\')">&times;</button>'
            + '</div>'
            + '<div class="modal-body">'
            + '<form id="createEventForm" onsubmit="event.preventDefault(); App.createEvent();">'
            + '<div class="form-group"><label>Titre *</label><input type="text" name="title" required></div>'
            + '<div class="form-group"><label>Description</label><textarea name="description" rows="3"></textarea></div>'
            + '<div class="form-group"><label>Date de debut *</label><input type="date" name="start_date" required></div>'
            + '<div class="form-group"><label>Heure de debut</label><input type="time" name="start_time"></div>'
            + '<div class="form-group"><label>Heure de fin</label><input type="time" name="end_time"></div>'
            + '<div class="form-group"><label>Lieu</label><input type="text" name="location"></div>'
            + '<div class="form-group"><label>Lien d\'inscription</label><input type="url" name="registration_url" placeholder="https://..."></div>'
            + '<button type="submit" class="btn btn-primary">Creer</button>'
            + '</form>'
            + '</div>'
            + '</div>';
        modal.addEventListener('click', (e) => { if (e.target === modal) App.hideModal('createEventModal'); });
        document.body.appendChild(modal);
        modal.style.display = 'flex';
    },

    async createEvent() {
        if (!this.isAdmin()) return;

        const form = document.getElementById('createEventForm');
        if (!form) return;

        const formData = new FormData(form);
        const body = {};
        formData.forEach((value, key) => { body[key] = value; });

        if (!body.title || !body.start_date) {
            this.showToast('Veuillez remplir les champs obligatoires.', 'error');
            return;
        }

        try {
            const data = await this.api('events.php?action=create', {
                method: 'POST',
                body: body
            });
            if (data.success) {
                this.showToast('Evenement cree avec succes.', 'success');
                this.hideModal('createEventModal');
                const modal = document.getElementById('createEventModal');
                if (modal) modal.remove();
                this.loadEvents();
            }
        } catch (e) {
            this.showToast(e.message, 'error');
        }
    },

    // =========================================================================
    // 15. DIRECTORY
    // =========================================================================
    async loadMembers(search, page) {
        if (search !== undefined) this.state.memberSearch = search;
        if (page !== undefined) this.state.memberPage = page;

        try {
            let endpoint = 'members.php?action=list&page=' + this.state.memberPage + '&limit=20';
            if (this.state.memberSearch) {
                endpoint += '&search=' + encodeURIComponent(this.state.memberSearch);
            }
            const data = await this.api(endpoint);
            this.state.members = data.members || [];
            this.renderDirectory(data.total || 0, data.pages || 1);
        } catch (e) {
            this.showToast('Erreur lors du chargement de l\'annuaire.', 'error');
        }
    },

    renderDirectory(total, totalPages) {
        const view = document.getElementById('directoryView');
        if (!view) return;

        let searchHtml = '<div class="directory-search">'
            + '<input type="text" placeholder="Rechercher un membre..." value="' + this.escapeHtml(this.state.memberSearch) + '"'
            + ' oninput="clearTimeout(App._dirSearchTimer); App._dirSearchTimer = setTimeout(() => App.loadMembers(this.value, 1), 400);">'
            + '</div>';

        let membersHtml = '<div class="directory-grid">';
        if (this.state.members.length === 0) {
            membersHtml += '<div class="empty-state">Aucun membre trouve.</div>';
        } else {
            this.state.members.forEach(member => {
                const initials = ((member.first_name || '')[0] || '') + ((member.last_name || '')[0] || '');
                const avatar = member.avatar
                    ? '<img src="' + this.escapeHtml(member.avatar) + '" alt="' + this.escapeHtml(initials) + '" class="member-avatar-img">'
                    : '<div class="member-avatar-initials">' + this.escapeHtml(initials.toUpperCase()) + '</div>';

                const roleLabel = member.role === 'admin' ? 'Administrateur' : (member.role === 'moderator' ? 'Moderateur' : 'Membre');

                membersHtml += '<div class="member-card">'
                    + '<div class="member-avatar">' + avatar + '</div>'
                    + '<div class="member-info">'
                    + '<h4 class="member-name">' + this.escapeHtml(member.first_name + ' ' + member.last_name) + '</h4>'
                    + '<span class="member-role">' + roleLabel + '</span>'
                    + (member.specialty ? '<span class="member-specialty">' + this.escapeHtml(member.specialty) + '</span>' : '')
                    + (member.city ? '<span class="member-city">' + this.escapeHtml(member.city) + '</span>' : '')
                    + (member.institution ? '<span class="member-institution">' + this.escapeHtml(member.institution) + '</span>' : '')
                    + '</div>'
                    + '</div>';
            });
        }
        membersHtml += '</div>';

        let paginationHtml = '';
        if (totalPages > 1) {
            paginationHtml = '<div class="pagination">';
            for (let i = 1; i <= totalPages; i++) {
                paginationHtml += '<button class="page-btn ' + (i === this.state.memberPage ? 'active' : '') + '"'
                    + ' onclick="App.loadMembers(undefined, ' + i + ')">' + i + '</button>';
            }
            paginationHtml += '</div>';
        }

        view.innerHTML = '<div class="view-header"><h2>Annuaire</h2><span class="member-count">' + (total || 0) + ' membres</span></div>'
            + searchHtml
            + membersHtml
            + paginationHtml;
    },

    // =========================================================================
    // 16. PROFILE
    // =========================================================================
    renderProfile() {
        const view = document.getElementById('profileView');
        if (!view || !this.state.user) return;

        const user = this.state.user;
        const initials = ((user.first_name || '')[0] || '') + ((user.last_name || '')[0] || '');
        const avatar = user.avatar
            ? '<img src="' + this.escapeHtml(user.avatar) + '" alt="" class="profile-avatar-img">'
            : '<div class="profile-avatar-initials">' + this.escapeHtml(initials.toUpperCase()) + '</div>';

        const infoItems = [
            { label: 'Email', value: user.email },
            { label: 'Telephone', value: user.phone },
            { label: 'Ville', value: user.city },
            { label: 'Institution', value: user.institution },
            { label: 'Specialite', value: user.specialty },
            { label: 'RPPS', value: user.rpps },
            { label: 'Membre depuis', value: this.formatDate(user.created_at) }
        ].filter(item => item.value);

        let infoListHtml = '';
        infoItems.forEach(item => {
            infoListHtml += '<div class="profile-info-item">'
                + '<span class="info-label">' + item.label + '</span>'
                + '<span class="info-value">' + this.escapeHtml(item.value) + '</span>'
                + '</div>';
        });

        view.innerHTML = '<div class="profile-container">'
            + '<div class="profile-header">'
            + '<div class="profile-avatar">' + avatar + '</div>'
            + '<h2>' + this.escapeHtml(user.first_name + ' ' + user.last_name) + '</h2>'
            + '<span class="profile-role">' + (user.role === 'admin' ? 'Administrateur' : (user.role === 'moderator' ? 'Moderateur' : 'Membre')) + '</span>'
            + '</div>'
            + '<div class="profile-info-list">' + infoListHtml + '</div>'
            + '<div class="profile-actions">'
            + '<button class="btn btn-primary" onclick="App.showProfileEditModal()">Modifier le profil</button>'
            + '<button class="btn btn-outline" onclick="App.logout()">Deconnexion</button>'
            + '</div>'
            + '</div>';
    },

    async updateProfile(formData) {
        try {
            const data = await this.api('auth.php?action=update_profile', {
                method: 'POST',
                body: formData
            });
            if (data.success) {
                if (data.user) {
                    this.state.user = data.user;
                }
                this.showToast('Profil mis a jour avec succes.', 'success');
                this.hideModal('profileModal');
                this.renderProfile();
                this.updateUserUI();
            }
        } catch (e) {
            this.showToast(e.message, 'error');
        }
    },

    showProfileEditModal() {
        const user = this.state.user;
        if (!user) return;

        const modal = document.getElementById('profileModal');
        if (!modal) return;

        const content = modal.querySelector('.modal-content') || modal;
        content.innerHTML = '<div class="modal-header">'
            + '<h3>Modifier le profil</h3>'
            + '<button class="modal-close" onclick="App.hideModal(\'profileModal\')">&times;</button>'
            + '</div>'
            + '<div class="modal-body">'
            + '<form id="profileEditForm" onsubmit="event.preventDefault(); App.submitProfileEdit();">'
            + '<div class="form-group"><label>Prenom</label><input type="text" name="first_name" value="' + this.escapeHtml(user.first_name || '') + '" required></div>'
            + '<div class="form-group"><label>Nom</label><input type="text" name="last_name" value="' + this.escapeHtml(user.last_name || '') + '" required></div>'
            + '<div class="form-group"><label>Telephone</label><input type="tel" name="phone" value="' + this.escapeHtml(user.phone || '') + '"></div>'
            + '<div class="form-group"><label>Ville</label><input type="text" name="city" value="' + this.escapeHtml(user.city || '') + '"></div>'
            + '<div class="form-group"><label>Institution</label><input type="text" name="institution" value="' + this.escapeHtml(user.institution || '') + '"></div>'
            + '<div class="form-group"><label>Specialite</label><input type="text" name="specialty" value="' + this.escapeHtml(user.specialty || '') + '"></div>'
            + '<div class="form-group"><label>Photo de profil</label><input type="file" name="avatar" accept="image/*"></div>'
            + '<button type="submit" class="btn btn-primary">Enregistrer</button>'
            + '</form>'
            + '</div>';

        this.showModal('profileModal');
    },

    submitProfileEdit() {
        const form = document.getElementById('profileEditForm');
        if (!form) return;
        const formData = new FormData(form);
        this.updateProfile(formData);
    },

    // =========================================================================
    // 17. ADMIN
    // =========================================================================
    isAdmin() {
        return this.state.user && (this.state.user.role === 'admin' || this.state.user.role === 'superadmin');
    },

    async loadAdminDashboard() {
        if (!this.isAdmin()) return;

        try {
            const results = await Promise.all([
                this.api('admin.php?action=stats'),
                this.api('admin.php?action=pending_members'),
                this.api('admin.php?action=reports')
            ]);

            this.state.adminStats = results[0].stats || {};
            this.state.pendingMembers = results[1].members || [];
            this.state.reports = results[2].reports || [];

            this.renderAdminDashboard();
        } catch (e) {
            this.showToast('Erreur lors du chargement du tableau de bord.', 'error');
        }
    },

    renderAdminDashboard() {
        const view = document.getElementById('adminView');
        if (!view) return;

        const stats = this.state.adminStats;

        let statCards = '<div class="admin-stats">';
        const statItems = [
            { value: stats.total_members || 0, label: 'Membres' },
            { value: stats.active_members || 0, label: 'Actifs' },
            { value: stats.pending_members || 0, label: 'En attente' },
            { value: stats.total_messages || 0, label: 'Messages' },
            { value: stats.total_groups || 0, label: 'Groupes' },
            { value: stats.reports_count || 0, label: 'Signalements' }
        ];
        statItems.forEach(s => {
            statCards += '<div class="stat-card">'
                + '<div class="stat-value">' + s.value + '</div>'
                + '<div class="stat-label">' + s.label + '</div>'
                + '</div>';
        });
        statCards += '</div>';

        let pendingHtml = '<div class="admin-section"><h3>Membres en attente de validation</h3>';
        if (this.state.pendingMembers.length === 0) {
            pendingHtml += '<p class="empty-state">Aucune demande en attente.</p>';
        } else {
            pendingHtml += '<table class="admin-table"><thead><tr>'
                + '<th>Nom</th><th>Email</th><th>RPPS</th><th>Ville</th><th>Date</th><th>Actions</th>'
                + '</tr></thead><tbody>';
            this.state.pendingMembers.forEach(member => {
                pendingHtml += '<tr>'
                    + '<td>' + this.escapeHtml(member.first_name + ' ' + member.last_name) + '</td>'
                    + '<td>' + this.escapeHtml(member.email) + '</td>'
                    + '<td>' + this.escapeHtml(member.rpps || '-') + '</td>'
                    + '<td>' + this.escapeHtml(member.city || '-') + '</td>'
                    + '<td>' + this.formatDate(member.created_at) + '</td>'
                    + '<td class="action-btns">'
                    + '<button class="btn btn-sm btn-success" onclick="App.approveMember(' + member.id + ')">Approuver</button>'
                    + '<button class="btn btn-sm btn-danger" onclick="App.rejectMember(' + member.id + ')">Refuser</button>'
                    + '</td>'
                    + '</tr>';
            });
            pendingHtml += '</tbody></table>';
        }
        pendingHtml += '</div>';

        let reportsHtml = '<div class="admin-section"><h3>Signalements</h3>';
        if (this.state.reports.length === 0) {
            reportsHtml += '<p class="empty-state">Aucun signalement.</p>';
        } else {
            reportsHtml += '<table class="admin-table"><thead><tr>'
                + '<th>Signale par</th><th>Message</th><th>Raison</th><th>Date</th><th>Actions</th>'
                + '</tr></thead><tbody>';
            this.state.reports.forEach(report => {
                const msgPreview = (report.message_content || '').substring(0, 60);
                reportsHtml += '<tr>'
                    + '<td>' + this.escapeHtml(report.reporter_name || 'Inconnu') + '</td>'
                    + '<td>' + this.escapeHtml(msgPreview) + '</td>'
                    + '<td>' + this.escapeHtml(report.reason || '-') + '</td>'
                    + '<td>' + this.formatDate(report.created_at) + '</td>'
                    + '<td class="action-btns">'
                    + '<button class="btn btn-sm btn-outline" onclick="App.handleReport(' + report.id + ', \'dismiss\')">Ignorer</button>'
                    + '<button class="btn btn-sm btn-danger" onclick="App.handleReport(' + report.id + ', \'delete\')">Supprimer le message</button>'
                    + '</td>'
                    + '</tr>';
            });
            reportsHtml += '</tbody></table>';
        }
        reportsHtml += '</div>';

        view.innerHTML = '<div class="view-header"><h2>Administration</h2></div>'
            + statCards
            + pendingHtml
            + reportsHtml;
    },

    async approveMember(memberId) {
        try {
            const data = await this.api('admin.php?action=approve_member', {
                method: 'POST',
                body: { member_id: memberId }
            });
            if (data.success) {
                this.showToast('Membre approuve.', 'success');
                this.state.pendingMembers = this.state.pendingMembers.filter(m => m.id !== memberId);
                this.renderAdminDashboard();
            }
        } catch (e) {
            this.showToast(e.message, 'error');
        }
    },

    async rejectMember(memberId) {
        const reason = prompt('Raison du refus (optionnel) :');
        try {
            const data = await this.api('admin.php?action=reject_member', {
                method: 'POST',
                body: { member_id: memberId, reason: reason || '' }
            });
            if (data.success) {
                this.showToast('Membre refuse.', 'success');
                this.state.pendingMembers = this.state.pendingMembers.filter(m => m.id !== memberId);
                this.renderAdminDashboard();
            }
        } catch (e) {
            this.showToast(e.message, 'error');
        }
    },

    async suspendMember(memberId) {
        if (!confirm('Suspendre ce membre ?')) return;

        try {
            const data = await this.api('admin.php?action=suspend_member', {
                method: 'POST',
                body: { member_id: memberId }
            });
            if (data.success) {
                this.showToast('Membre suspendu.', 'success');
                this.loadAdminDashboard();
            }
        } catch (e) {
            this.showToast(e.message, 'error');
        }
    },

    async handleReport(reportId, action) {
        try {
            const data = await this.api('admin.php?action=handle_report', {
                method: 'POST',
                body: { report_id: reportId, action: action }
            });
            if (data.success) {
                const actionLabel = action === 'dismiss' ? 'Signalement ignore.' : 'Message supprime.';
                this.showToast(actionLabel, 'success');
                this.state.reports = this.state.reports.filter(r => r.id !== reportId);
                this.renderAdminDashboard();
            }
        } catch (e) {
            this.showToast(e.message, 'error');
        }
    },

    async manageMemberRole(memberId, newRole) {
        try {
            const data = await this.api('admin.php?action=change_role', {
                method: 'POST',
                body: { member_id: memberId, role: newRole }
            });
            if (data.success) {
                this.showToast('Role modifie avec succes.', 'success');
                this.loadAdminDashboard();
            }
        } catch (e) {
            this.showToast(e.message, 'error');
        }
    },

    // =========================================================================
    // 18. NOTIFICATIONS
    // =========================================================================
    async loadNotifications() {
        try {
            const data = await this.api('notifications.php?action=list');
            this.state.notifications = data.notifications || [];
            this.renderNotifications();
        } catch (e) {
            /* silent */
        }
    },

    renderNotifications() {
        const dropdown = document.getElementById('notificationsDropdown');
        if (!dropdown) return;

        if (this.state.notifications.length === 0) {
            dropdown.innerHTML = '<div class="notif-empty">Aucune notification</div>';
            return;
        }

        let html = '';
        this.state.notifications.forEach(notif => {
            const readClass = notif.read ? 'notif-read' : 'notif-unread';
            let icon = '&#128276;';
            if (notif.type === 'message') icon = '&#128172;';
            else if (notif.type === 'mention') icon = '@';
            else if (notif.type === 'approval') icon = '&#10004;';
            else if (notif.type === 'event') icon = '&#128197;';

            html += '<div class="notif-item ' + readClass + '" onclick="App.handleNotificationClick(' + notif.id + ', \'' + this.escapeHtml(notif.type) + '\', ' + (notif.reference_id || 'null') + ')">'
                + '<span class="notif-icon">' + icon + '</span>'
                + '<div class="notif-content">'
                + '<p class="notif-text">' + this.escapeHtml(notif.message || notif.text) + '</p>'
                + '<span class="notif-time">' + this.timeAgo(notif.created_at) + '</span>'
                + '</div>'
                + '</div>';
        });

        dropdown.innerHTML = html;
    },

    async handleNotificationClick(notifId, type, referenceId) {
        try {
            await this.api('notifications.php?action=mark_read', {
                method: 'POST',
                body: { notification_id: notifId }
            });
        } catch (e) {
            /* silent */
        }

        switch (type) {
            case 'message':
                if (referenceId) {
                    const group = this.state.groups.find(g => g.id === referenceId);
                    if (group) this.openGroup(group);
                }
                break;
            case 'approval':
                this.showView('admin');
                break;
            case 'event':
                this.showView('agenda');
                break;
        }

        this.toggleNotifications();
        this.loadNotifications();
    },

    toggleNotifications() {
        const dropdown = document.getElementById('notificationsDropdown');
        if (!dropdown) return;

        this.state.notificationsOpen = !this.state.notificationsOpen;
        dropdown.style.display = this.state.notificationsOpen ? '' : 'none';

        if (this.state.notificationsOpen) {
            this.loadNotifications();
        }
    },

    // =========================================================================
    // 19. MODALS
    // =========================================================================
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    },

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
        const anyVisible = document.querySelector('.modal[style*="display: flex"]');
        if (!anyVisible) {
            document.body.style.overflow = '';
        }
    },

    hideAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        document.body.style.overflow = '';
    },

    showReportModal(messageId) {
        const modal = document.getElementById('reportModal');
        if (!modal) return;

        const form = document.getElementById('reportForm');
        if (form) {
            form.reset();
            let hiddenInput = form.querySelector('input[name="message_id"]');
            if (!hiddenInput) {
                hiddenInput = document.createElement('input');
                hiddenInput.type = 'hidden';
                hiddenInput.name = 'message_id';
                form.appendChild(hiddenInput);
            }
            hiddenInput.value = messageId;
        }

        this.showModal('reportModal');
    },

    async submitReport() {
        const form = document.getElementById('reportForm');
        if (!form) return;

        const messageId = form.querySelector('input[name="message_id"]')?.value;
        const reason = form.querySelector('[name="reason"]')?.value || '';
        const details = form.querySelector('[name="details"]')?.value || '';

        if (!reason) {
            this.showToast('Veuillez selectionner une raison.', 'error');
            return;
        }

        try {
            const data = await this.api('messages.php?action=report', {
                method: 'POST',
                body: { message_id: messageId, reason: reason, details: details }
            });
            if (data.success) {
                this.showToast('Signalement envoye. Merci.', 'success');
                this.hideModal('reportModal');
            }
        } catch (e) {
            this.showToast(e.message, 'error');
        }
    },

    showAnonymizationConfirmation(callback) {
        const modal = document.getElementById('anonModal');
        if (!modal) {
            if (confirm('Les donnees patient doivent etre anonymisees avant envoi. Confirmez-vous que les donnees sont anonymisees ?')) {
                if (callback) callback();
            }
            return;
        }

        this._anonCallback = callback;

        const content = modal.querySelector('.modal-content') || modal;
        content.innerHTML = '<div class="modal-header">'
            + '<h3>Anonymisation requise</h3>'
            + '<button class="modal-close" onclick="App.hideModal(\'anonModal\')">&times;</button>'
            + '</div>'
            + '<div class="modal-body">'
            + '<p>Conformement a la reglementation, les donnees patient partagees dans les cas cliniques doivent etre <strong>anonymisees</strong>.</p>'
            + '<p>En continuant, vous confirmez que toutes les donnees personnelles identifiables (nom, prenom, date de naissance, numero de dossier, etc.) ont ete supprimees ou remplacees.</p>'
            + '<div class="modal-actions">'
            + '<button class="btn btn-outline" onclick="App.hideModal(\'anonModal\')">Annuler</button>'
            + '<button class="btn btn-primary" onclick="App.acceptAnonymization()">Je confirme l\'anonymisation</button>'
            + '</div>'
            + '</div>';

        this.showModal('anonModal');
    },

    acceptAnonymization() {
        this.hideModal('anonModal');
        if (this._anonCallback) {
            this._anonCallback();
            this._anonCallback = null;
        }
    },

    // =========================================================================
    // 20. UI HELPERS
    // =========================================================================
    showToast(message, type) {
        type = type || 'info';

        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:10000;display:flex;flex-direction:column;gap:8px;';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = 'toast toast-' + type;

        const bgColors = { success: '#d4edda', error: '#f8d7da', warning: '#fff3cd', info: '#d1ecf1' };
        const fgColors = { success: '#155724', error: '#721c24', warning: '#856404', info: '#0c5460' };
        const icons = { success: '&#10004;', error: '&#10008;', warning: '&#9888;', info: '&#8505;' };

        toast.style.cssText = 'display:flex;align-items:center;gap:8px;padding:12px 16px;border-radius:8px;'
            + 'background:' + (bgColors[type] || bgColors.info) + ';'
            + 'color:' + (fgColors[type] || fgColors.info) + ';'
            + 'box-shadow:0 4px 12px rgba(0,0,0,0.15);font-size:14px;'
            + 'animation:slideInRight 0.3s ease;min-width:280px;max-width:420px;';

        toast.innerHTML = '<span class="toast-icon">' + (icons[type] || icons.info) + '</span>'
            + '<span class="toast-message">' + this.escapeHtml(message) + '</span>'
            + '<button class="toast-close" onclick="this.parentElement.remove()">&times;</button>';

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },

    updateUserUI() {
        if (!this.state.user) return;

        const user = this.state.user;
        const initials = ((user.first_name || '')[0] || '') + ((user.last_name || '')[0] || '');

        const topbarAvatar = document.querySelector('.topbar-avatar, .user-avatar');
        if (topbarAvatar) {
            if (user.avatar) {
                topbarAvatar.innerHTML = '<img src="' + this.escapeHtml(user.avatar) + '" alt="' + this.escapeHtml(initials) + '">';
            } else {
                topbarAvatar.textContent = initials.toUpperCase();
            }
        }

        const userName = document.querySelector('.topbar-username, .user-name');
        if (userName) {
            userName.textContent = user.first_name + ' ' + user.last_name;
        }

        const adminLink = document.querySelector('.admin-link, [data-view="admin"]');
        if (adminLink) {
            adminLink.style.display = this.isAdmin() ? '' : 'none';
        }
    },

    goBack() {
        if (this.state.isMobile) {
            const sidebar = document.getElementById('sidebar');
            const mainContent = document.getElementById('mainContent');
            if (sidebar) sidebar.classList.remove('hidden');
            if (mainContent) mainContent.classList.add('hidden');
        }
    },

    showLoading(container) {
        const target = typeof container === 'string' ? document.getElementById(container) : container;
        if (target) {
            const loader = document.createElement('div');
            loader.className = 'loading-spinner';
            loader.innerHTML = '<div class="spinner"></div><p>Chargement...</p>';
            target.appendChild(loader);
        }
    },

    hideLoading(container) {
        const target = typeof container === 'string' ? document.getElementById(container) : container;
        if (target) {
            const loader = target.querySelector('.loading-spinner');
            if (loader) loader.remove();
        }
    },

    // =========================================================================
    // 21. UTILITIES
    // =========================================================================
    escapeHtml(str) {
        if (str === null || str === undefined) return '';
        str = String(str);
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return str.replace(/[&<>"']/g, function(c) { return map[c]; });
    },

    linkify(text) {
        if (!text) return '';
        text = text.replace(
            /(https?:\/\/[^\s<]+[^\s<.,;:!?\])'">\-])/gi,
            '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
        );
        text = text.replace(
            /([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi,
            '<a href="mailto:$1">$1</a>'
        );
        text = text.replace(/\n/g, '<br>');
        return text;
    },

    formatTime(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    },

    formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (d.toDateString() === today.toDateString()) {
            return "Aujourd'hui";
        }
        if (d.toDateString() === yesterday.toDateString()) {
            return 'Hier';
        }

        const options = { day: 'numeric', month: 'long' };
        if (d.getFullYear() !== today.getFullYear()) {
            options.year = 'numeric';
        }
        return d.toLocaleDateString('fr-FR', options);
    },

    formatDateTime(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    timeAgo(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';

        const now = new Date();
        const diffMs = now - d;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);
        const diffWeek = Math.floor(diffDay / 7);
        const diffMonth = Math.floor(diffDay / 30);

        if (diffSec < 30) return "a l'instant";
        if (diffSec < 60) return 'il y a ' + diffSec + ' s';
        if (diffMin < 60) return 'il y a ' + diffMin + ' min';
        if (diffHour < 24) return 'il y a ' + diffHour + ' h';
        if (diffDay < 7) return 'il y a ' + diffDay + ' j';
        if (diffWeek < 5) return 'il y a ' + diffWeek + ' sem';
        if (diffMonth < 12) return 'il y a ' + diffMonth + ' mois';
        return this.formatDate(dateStr);
    },

    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 o';
        bytes = parseInt(bytes);
        if (bytes < 1024) return bytes + ' o';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
        if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
        return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' Go';
    },

    getFileIcon(mimeType) {
        if (!mimeType) return '&#128196;';
        if (mimeType.startsWith('image/')) return '&#128444;';
        if (mimeType.startsWith('video/')) return '&#127916;';
        if (mimeType.startsWith('audio/')) return '&#127925;';
        if (mimeType.indexOf('pdf') !== -1) return '&#128213;';
        if (mimeType.indexOf('word') !== -1 || mimeType.indexOf('document') !== -1) return '&#128221;';
        if (mimeType.indexOf('sheet') !== -1 || mimeType.indexOf('excel') !== -1 || mimeType.indexOf('csv') !== -1) return '&#128202;';
        if (mimeType.indexOf('presentation') !== -1 || mimeType.indexOf('powerpoint') !== -1) return '&#128253;';
        if (mimeType.indexOf('zip') !== -1 || mimeType.indexOf('rar') !== -1 || mimeType.indexOf('tar') !== -1 || mimeType.indexOf('gz') !== -1) return '&#128451;';
        if (mimeType.indexOf('text') !== -1) return '&#128195;';
        if (mimeType.indexOf('html') !== -1 || mimeType.indexOf('xml') !== -1 || mimeType.indexOf('json') !== -1) return '&#128187;';
        return '&#128196;';
    },

    debounce(fn, delay) {
        let timer;
        return function() {
            const args = arguments;
            const context = this;
            clearTimeout(timer);
            timer = setTimeout(function() {
                fn.apply(context, args);
            }, delay);
        };
    },

    throttle(fn, limit) {
        let inThrottle = false;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                fn.apply(context, args);
                inThrottle = true;
                setTimeout(function() {
                    inThrottle = false;
                }, limit);
            }
        };
    },

    generateTempId() {
        return 'tmp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    },

    async copyToClipboard(text) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.cssText = 'position:fixed;left:-9999px;';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }
            this.showToast('Copie dans le presse-papiers.', 'success');
        } catch (e) {
            this.showToast('Impossible de copier.', 'error');
        }
    },

    // =========================================================================
    // 22. PWA / SERVICE WORKER
    // =========================================================================
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/connect/sw.js')
                .then(function(registration) {
                    registration.addEventListener('updatefound', function() {
                        const newWorker = registration.installing;
                        if (newWorker) {
                            newWorker.addEventListener('statechange', function() {
                                if (newWorker.state === 'activated') {
                                    App.showToast('Mise a jour disponible. Rechargez la page.', 'info');
                                }
                            });
                        }
                    });
                })
                .catch(function() {
                    /* silent */
                });
        }
    },

    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(function(permission) {
                if (permission === 'granted') {
                    App.showToast('Notifications activees.', 'success');
                }
            });
        }
    },

    // =========================================================================
    // INTERNAL: directory search timer
    // =========================================================================
    _dirSearchTimer: null,
    _anonCallback: null
};

// =============================================================================
// 23-24. DOMCONTENTLOADED + CSS ANIMATIONS
// =============================================================================
document.addEventListener('DOMContentLoaded', function() {
    var style = document.createElement('style');
    style.textContent = '@keyframes slideInRight {'
        + 'from { transform: translateX(100%); opacity: 0; }'
        + 'to { transform: translateX(0); opacity: 1; }'
        + '}'
        + '@keyframes highlightMsg {'
        + '0% { background-color: rgba(255, 193, 7, 0.3); }'
        + '100% { background-color: transparent; }'
        + '}'
        + '.message-bubble.highlight {'
        + 'animation: highlightMsg 2s ease;'
        + '}'
        + '.toast-close {'
        + 'background: none; border: none; font-size: 18px; cursor: pointer;'
        + 'margin-left: 8px; opacity: 0.6; line-height: 1;'
        + '}'
        + '.toast-close:hover { opacity: 1; }'
        + '.loading-spinner {'
        + 'display: flex; flex-direction: column; align-items: center;'
        + 'justify-content: center; padding: 40px; color: #666;'
        + '}'
        + '.spinner {'
        + 'width: 32px; height: 32px; border: 3px solid #e0e0e0;'
        + 'border-top-color: #1a73e8; border-radius: 50%;'
        + 'animation: spin 0.8s linear infinite;'
        + '}'
        + '@keyframes spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(style);

    App.init();
});
