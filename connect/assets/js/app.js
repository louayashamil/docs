/**
 * NADAR Connect - Application JavaScript SPA
 * Plateforme de messagerie communautaire pour ophtalmologistes
 * Vanilla ES6+ - Aucun framework
 */

const App = {
    // =========================================================================
    // STATE
    // =========================================================================
    state: {
        user: null,
        groups: [],
        currentGroup: null,
        messages: [],
        polling: null,
        unreadCounts: {},
        lastMessageIds: {},
        anonAccepted: false,
        attachments: [],
        replyTo: null,
        editingMessage: null,
        csrfToken: '',
        isMobile: window.innerWidth < 769,
        searchTimer: null,
        loadingOlder: false,
        reportingMessageId: null,
        anonCallback: null,
        notificationsOpen: false,
        currentView: 'chatView',
        typingTimer: null,
        onlineUsers: new Set(),
        messageObserver: null,
        touchStartY: 0,
        touchStartX: 0,
        longPressTimer: null,
        contextMessageId: null,
        profileEditData: {},
    },

    // =========================================================================
    // INITIALIZATION
    // =========================================================================
    async init() {
        this.setupEventListeners();
        this.setupResizeHandler();
        this.setupKeyboardShortcuts();
        this.setupIntersectionObserver();
        await this.checkAuth();
        this.registerServiceWorker();
        this.requestNotificationPermission();
    },

    setupResizeHandler() {
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                const wasMobile = this.state.isMobile;
                this.state.isMobile = window.innerWidth < 769;
                if (wasMobile !== this.state.isMobile) {
                    this.handleResponsiveChange();
                }
            }, 150);
        });
    },

    handleResponsiveChange() {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        if (!sidebar || !mainContent) return;

        if (this.state.isMobile) {
            if (this.state.currentGroup) {
                sidebar.classList.add('hidden');
                mainContent.classList.remove('hidden');
            } else {
                sidebar.classList.remove('hidden');
                mainContent.classList.add('hidden');
            }
        } else {
            sidebar.classList.remove('hidden');
            mainContent.classList.remove('hidden');
        }
    },

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+K or Cmd+K for search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.showSearch();
                return;
            }
            // Escape to close modals/overlays
            if (e.key === 'Escape') {
                this.closeImageViewer();
                this.hideSearch();
                this.hideAllModals();
                const dropdown = document.getElementById('notificationsDropdown');
                if (dropdown && !dropdown.classList.contains('hidden')) {
                    dropdown.classList.add('hidden');
                }
            }
        });
    },

    setupIntersectionObserver() {
        if ('IntersectionObserver' in window) {
            this.state.messageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            delete img.dataset.src;
                            this.state.messageObserver.unobserve(img);
                        }
                    }
                });
            }, { rootMargin: '200px' });
        }
    },

    setupEventListeners() {
        // ---- Login form ----
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = loginForm.querySelector('[name="email"]')?.value?.trim();
                const password = loginForm.querySelector('[name="password"]')?.value;
                if (email && password) {
                    this.login(email, password);
                }
            });
        }

        // ---- Register form ----
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(registerForm);
                this.register(formData);
            });
        }

        // ---- Composer form ----
        const composerForm = document.getElementById('composerForm');
        if (composerForm) {
            composerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.sendMessage();
            });
        }

        // ---- Composer input auto-resize + Enter to send ----
        const composerInput = document.getElementById('composerInput');
        if (composerInput) {
            composerInput.addEventListener('input', () => {
                this.autoResizeTextarea(composerInput);
            });

            composerInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            composerInput.addEventListener('paste', (e) => {
                const items = e.clipboardData?.items;
                if (!items) return;
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.startsWith('image/')) {
                        e.preventDefault();
                        const file = items[i].getAsFile();
                        if (file) {
                            this.handleAttachment([file], 'image');
                        }
                        break;
                    }
                }
            });
        }

        // ---- Attach button ----
        const attachBtn = document.getElementById('attachBtn');
        if (attachBtn) {
            attachBtn.addEventListener('click', () => {
                document.getElementById('fileInput')?.click();
            });
        }

        // ---- Photo button ----
        const photoBtn = document.getElementById('photoBtn');
        if (photoBtn) {
            photoBtn.addEventListener('click', () => {
                document.getElementById('photoInput')?.click();
            });
        }

        // ---- Send button ----
        const sendBtn = document.getElementById('sendBtn');
        if (sendBtn) {
            sendBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.sendMessage();
            });
        }

        // ---- File input change ----
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleAttachment(e.target.files, 'file');
                    e.target.value = '';
                }
            });
        }

        // ---- Photo input change ----
        const photoInput = document.getElementById('photoInput');
        if (photoInput) {
            photoInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleAttachment(e.target.files, 'image');
                    e.target.value = '';
                }
            });
        }

        // ---- Search input ----
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(this.state.searchTimer);
                this.state.searchTimer = setTimeout(() => {
                    this.search(e.target.value.trim());
                }, 400);
            });

            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.hideSearch();
                }
            });
        }

        // ---- Notification bell ----
        const notifBell = document.getElementById('notifBadge')?.parentElement
            || document.querySelector('.notification-bell');
        if (notifBell) {
            notifBell.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleNotifications();
            });
        }

        // ---- Modal close buttons ----
        document.addEventListener('click', (e) => {
            // Close button inside modals
            if (e.target.classList.contains('modal-close') || e.target.closest('.modal-close')) {
                const modal = e.target.closest('.modal-overlay');
                if (modal) {
                    modal.classList.remove('active');
                    document.body.style.overflow = '';
                }
            }

            // Click on overlay background
            if (e.target.classList.contains('modal-overlay')) {
                e.target.classList.remove('active');
                document.body.style.overflow = '';
            }

            // Close notifications dropdown when clicking outside
            const dropdown = document.getElementById('notificationsDropdown');
            if (dropdown && !dropdown.classList.contains('hidden')) {
                if (!e.target.closest('.notification-bell') && !e.target.closest('#notificationsDropdown')) {
                    dropdown.classList.add('hidden');
                }
            }
        });

        // ---- Mobile tab clicks ----
        document.querySelectorAll('.mobile-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const view = tab.dataset.view;
                if (view) {
                    document.querySelectorAll('.mobile-tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    if (view === 'groups') {
                        this.goBack();
                    } else {
                        this.showView(view + 'View');
                    }
                }
            });
        });

        // ---- Group section toggle (Autre) ----
        document.addEventListener('click', (e) => {
            const toggle = e.target.closest('.group-section-toggle');
            if (toggle) {
                this.toggleOtherGroups();
            }
        });

        // ---- Messages container scroll (infinite scroll) ----
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            messagesContainer.addEventListener('scroll', () => {
                if (messagesContainer.scrollTop < 100 && !this.state.loadingOlder) {
                    this.loadOlderMessages();
                }
            });

            // Touch events for long press on messages
            messagesContainer.addEventListener('touchstart', (e) => {
                const msgEl = e.target.closest('.message');
                if (msgEl) {
                    this.state.touchStartY = e.touches[0].clientY;
                    this.state.touchStartX = e.touches[0].clientX;
                    this.state.longPressTimer = setTimeout(() => {
                        const msgId = parseInt(msgEl.dataset.msgId);
                        if (msgId) this.showMessageContextMenu(msgId, e.touches[0].clientX, e.touches[0].clientY);
                    }, 600);
                }
            });

            messagesContainer.addEventListener('touchmove', () => {
                if (this.state.longPressTimer) {
                    clearTimeout(this.state.longPressTimer);
                    this.state.longPressTimer = null;
                }
            });

            messagesContainer.addEventListener('touchend', () => {
                if (this.state.longPressTimer) {
                    clearTimeout(this.state.longPressTimer);
                    this.state.longPressTimer = null;
                }
            });
        }

        // ---- Image viewer close ----
        const imageViewer = document.getElementById('imageViewer');
        if (imageViewer) {
            imageViewer.addEventListener('click', (e) => {
                if (e.target === imageViewer || e.target.classList.contains('viewer-close')) {
                    this.closeImageViewer();
                }
            });
        }

        // ---- Report form ----
        const reportForm = document.getElementById('reportForm');
        if (reportForm) {
            reportForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitReport();
            });
        }

        // ---- Window click to close context menu ----
        document.addEventListener('click', (e) => {
            const contextMenu = document.getElementById('contextMenu');
            if (contextMenu && !e.target.closest('#contextMenu')) {
                contextMenu.remove();
            }
        });

        // ---- Visibility change - pause/resume polling ----
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopPolling();
            } else {
                if (this.state.user && this.state.user.role !== 'pending') {
                    this.startPolling();
                    if (this.state.currentGroup) {
                        this.pollUpdates();
                    }
                }
            }
        });
    },

    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        const maxHeight = 150;
        const newHeight = Math.min(textarea.scrollHeight, maxHeight);
        textarea.style.height = newHeight + 'px';
        textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
    },

    // =========================================================================
    // API HELPER
    // =========================================================================
    async api(endpoint, options = {}) {
        const url = '/connect/api/' + endpoint;
        const defaultHeaders = {
            'X-Requested-With': 'XMLHttpRequest',
        };

        if (this.state.csrfToken) {
            defaultHeaders['X-CSRF-Token'] = this.state.csrfToken;
        }

        const fetchOptions = {
            credentials: 'same-origin',
            ...options,
            headers: {
                ...defaultHeaders,
                ...(options.headers || {}),
            },
        };

        if (options.body && !(options.body instanceof FormData)) {
            fetchOptions.headers['Content-Type'] = 'application/json';
            fetchOptions.body = JSON.stringify(options.body);
        }

        try {
            const res = await fetch(url, fetchOptions);

            if (res.status === 401) {
                this.state.user = null;
                this.stopPolling();
                this.showLanding();
                return null;
            }

            if (res.status === 403) {
                this.showToast('Accès refusé', 'error');
                return null;
            }

            if (res.status === 429) {
                this.showToast('Trop de requêtes. Veuillez patienter.', 'error');
                return null;
            }

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || data.message || 'Erreur serveur');
            }

            // Update CSRF token if provided
            if (data.csrf_token) {
                this.state.csrfToken = data.csrf_token;
            }

            return data;
        } catch (err) {
            if (err.name === 'TypeError' && err.message.includes('fetch')) {
                this.showToast('Erreur de connexion réseau', 'error');
                return null;
            }
            throw err;
        }
    },

    // =========================================================================
    // AUTH
    // =========================================================================
    async checkAuth() {
        try {
            const data = await this.api('auth.php?action=me');
            if (data && data.user) {
                this.state.user = data.user;
                this.state.csrfToken = data.csrf_token || '';
                if (data.user.role === 'pending') {
                    this.showWaiting();
                } else {
                    this.showApp();
                }
            } else {
                this.showLanding();
            }
        } catch (err) {
            this.showLanding();
        }
    },

    async login(email, password) {
        const submitBtn = document.querySelector('#loginForm button[type="submit"]');
        const errorEl = document.getElementById('loginError');

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Connexion...';
        }
        if (errorEl) errorEl.textContent = '';

        try {
            const data = await this.api('auth.php?action=login', {
                method: 'POST',
                body: { email, password },
            });

            if (data && data.user) {
                this.state.user = data.user;
                this.state.csrfToken = data.csrf_token || '';

                if (data.user.role === 'pending') {
                    this.hideModal('loginModal');
                    this.showWaiting();
                } else if (data.user.role === 'blocked') {
                    if (errorEl) errorEl.textContent = 'Votre compte est bloqué. Contactez un administrateur.';
                } else {
                    this.hideModal('loginModal');
                    this.showApp();
                    this.showToast('Bienvenue, ' + this.escapeHtml(data.user.first_name) + ' !', 'success');
                }
            }
        } catch (err) {
            const msg = err.message || 'Identifiants incorrects';
            if (errorEl) errorEl.textContent = msg;
            else this.showToast(msg, 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Se connecter';
            }
        }
    },

    async register(formData) {
        const submitBtn = document.querySelector('#registerForm button[type="submit"]');
        const errorEl = document.getElementById('registerError');
        const successEl = document.getElementById('registerSuccess');

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Inscription...';
        }
        if (errorEl) errorEl.textContent = '';
        if (successEl) successEl.textContent = '';

        try {
            formData.append('action', 'register');
            const data = await this.api('auth.php?action=register', {
                method: 'POST',
                body: formData,
            });

            if (data && data.success) {
                if (successEl) {
                    successEl.textContent = data.message || 'Inscription réussie ! Votre demande est en cours de validation.';
                }
                const form = document.getElementById('registerForm');
                if (form) form.reset();

                setTimeout(() => {
                    this.hideModal('registerModal');
                    this.showToast('Demande d\'inscription envoyée', 'success');
                }, 2000);
            }
        } catch (err) {
            const msg = err.message || 'Erreur lors de l\'inscription';
            if (errorEl) errorEl.textContent = msg;
            else this.showToast(msg, 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'S\'inscrire';
            }
        }
    },

    async logout() {
        try {
            await this.api('auth.php?action=logout', { method: 'POST' });
        } catch (err) {
            // Continue with local logout even if API fails
        }
        this.state.user = null;
        this.state.currentGroup = null;
        this.state.messages = [];
        this.state.groups = [];
        this.state.unreadCounts = {};
        this.state.anonAccepted = false;
        this.stopPolling();
        this.showLanding();
        this.showToast('Déconnexion réussie', 'success');
    },

    async forgotPassword(email) {
        if (!email) {
            this.showToast('Veuillez saisir votre adresse email', 'error');
            return;
        }

        try {
            const data = await this.api('auth.php?action=forgot-password', {
                method: 'POST',
                body: { email },
            });

            if (data && data.success) {
                this.showToast('Un email de réinitialisation a été envoyé', 'success');
                this.hideModal('forgotPasswordModal');
            }
        } catch (err) {
            this.showToast(err.message || 'Erreur lors de l\'envoi', 'error');
        }
    },

    async resetPassword(token, newPassword) {
        try {
            const data = await this.api('auth.php?action=reset-password', {
                method: 'POST',
                body: { token, password: newPassword },
            });

            if (data && data.success) {
                this.showToast('Mot de passe modifié avec succès', 'success');
                this.showModal('loginModal');
            }
        } catch (err) {
            this.showToast(err.message || 'Erreur lors de la réinitialisation', 'error');
        }
    },

    async changePassword(currentPassword, newPassword) {
        try {
            const data = await this.api('auth.php?action=change-password', {
                method: 'POST',
                body: { current_password: currentPassword, new_password: newPassword },
            });

            if (data && data.success) {
                this.showToast('Mot de passe modifié avec succès', 'success');
            }
        } catch (err) {
            this.showToast(err.message || 'Erreur lors du changement', 'error');
        }
    },

    // =========================================================================
    // VIEW MANAGEMENT
    // =========================================================================
    showLanding() {
        document.getElementById('landingPage')?.classList.remove('hidden');
        document.getElementById('appContainer')?.classList.add('hidden');
        document.getElementById('waitingPage')?.classList.add('hidden');
    },

    showApp() {
        document.getElementById('landingPage')?.classList.add('hidden');
        document.getElementById('appContainer')?.classList.remove('hidden');
        document.getElementById('waitingPage')?.classList.add('hidden');
        this.loadGroups();
        this.startPolling();
        this.updateUserUI();
    },

    showWaiting() {
        document.getElementById('landingPage')?.classList.add('hidden');
        document.getElementById('appContainer')?.classList.add('hidden');
        document.getElementById('waitingPage')?.classList.remove('hidden');
    },

    showView(viewName) {
        const views = ['chatView', 'libraryView', 'agendaView', 'directoryView', 'adminView', 'profileView'];
        views.forEach(v => {
            const el = document.getElementById(v);
            if (el) el.classList.toggle('hidden', v !== viewName);
        });

        this.state.currentView = viewName;

        // Update mobile tab active state
        document.querySelectorAll('.mobile-tab').forEach(tab => {
            const tabView = tab.dataset.view;
            if (tabView) {
                tab.classList.toggle('active', tabView + 'View' === viewName);
            }
        });

        // Load data for the selected view
        switch (viewName) {
            case 'libraryView':
                this.loadDocuments();
                break;
            case 'agendaView':
                this.loadEvents();
                break;
            case 'directoryView':
                this.loadMembers();
                break;
            case 'adminView':
                this.loadAdminDashboard();
                break;
            case 'profileView':
                this.renderProfile();
                break;
            case 'chatView':
                if (this.state.currentGroup) {
                    this.scrollToBottom();
                }
                break;
        }
    },

    // =========================================================================
    // GROUPS
    // =========================================================================
    async loadGroups() {
        try {
            const data = await this.api('groups.php?action=list');
            if (data && data.groups) {
                this.state.groups = data.groups;
                this.renderGroupList();

                // Auto-open first group if none selected
                if (!this.state.currentGroup && data.groups.length > 0) {
                    this.openGroup(data.groups[0].id);
                }
            }
        } catch (err) {
            this.showToast('Erreur de chargement des salons', 'error');
        }
    },

    renderGroupList() {
        const container = document.getElementById('groupList');
        if (!container) return;

        // Separate general from others
        const generalGroup = this.state.groups.find(g => g.type === 'general');
        const otherGroups = this.state.groups.filter(g => g.type !== 'general');

        let html = '';

        // Discussion generale at top
        if (generalGroup) {
            html += this.renderGroupItem(generalGroup);
        }

        // Specialty/thematic groups (non-general, non-other)
        const mainGroups = otherGroups.filter(g =>
            ['announcement', 'clinical_cases', 'scientific'].includes(g.type)
        );
        mainGroups.forEach(g => {
            html += this.renderGroupItem(g);
        });

        // "Autre" section with collapsible toggle
        const autreGroups = otherGroups.filter(g =>
            !['announcement', 'clinical_cases', 'scientific'].includes(g.type)
        );
        if (autreGroups.length > 0) {
            const expanded = this.state.autreExpanded !== false;
            html += `<div class="group-section-header group-section-toggle" onclick="App.toggleOtherGroups()">
                <span>Autre</span>
                <svg class="arrow ${expanded ? '' : 'rotated'}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"/>
                </svg>
            </div>`;
            html += `<div class="group-section-content" id="otherGroups" ${expanded ? '' : 'style="display:none"'}>`;
            autreGroups.forEach(g => {
                html += this.renderGroupItem(g);
            });
            html += `</div>`;
        }

        container.innerHTML = html;
    },

    renderGroupItem(group) {
        const unread = this.state.unreadCounts[group.id] || group.unread_count || 0;
        const isActive = this.state.currentGroup && this.state.currentGroup.id === group.id;
        const lastMsg = group.last_message || '';
        const lastTime = group.last_message_time
            ? this.formatTime(new Date(group.last_message_time))
            : '';
        const initials = group.name
            .split(' ')
            .map(w => w[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();

        const icons = {
            general: '💬',
            announcement: '📢',
            clinical_cases: '🔬',
            scientific: '🧪',
            library: '📚',
            agenda: '📅',
        };
        const icon = icons[group.type] || '💬';

        return `<div class="group-item ${isActive ? 'active' : ''}" onclick="App.openGroup(${group.id})" data-group-id="${group.id}">
            <div class="group-avatar" title="${this.escapeHtml(group.name)}">${icon}</div>
            <div class="group-info">
                <div class="group-name">${this.escapeHtml(group.name)}</div>
                <div class="group-preview">${this.escapeHtml(this.truncate(lastMsg, 45))}</div>
            </div>
            <div class="group-meta">
                <span class="group-time">${lastTime}</span>
                ${unread > 0 ? `<span class="group-badge">${unread > 99 ? '99+' : unread}</span>` : ''}
            </div>
        </div>`;
    },

    toggleOtherGroups() {
        const el = document.getElementById('otherGroups');
        const arrow = document.querySelector('.group-section-toggle .arrow');
        if (el) {
            const isHidden = el.style.display === 'none';
            el.style.display = isHidden ? '' : 'none';
            this.state.autreExpanded = isHidden;
        }
        if (arrow) {
            arrow.classList.toggle('rotated');
        }
    },

    async openGroup(groupId) {
        const group = this.state.groups.find(g => g.id === groupId);
        if (!group) return;

        this.state.currentGroup = group;
        this.state.messages = [];
        this.state.replyTo = null;
        this.state.editingMessage = null;
        this.state.attachments = [];
        this.state.anonAccepted = false;
        this.clearAttachments();
        this.clearReply();

        // Show chat view
        this.showView('chatView');

        // Update chat header
        const chatName = document.getElementById('chatName');
        if (chatName) chatName.textContent = group.name;

        const chatMembers = document.getElementById('chatMembers');
        if (chatMembers) {
            chatMembers.textContent = group.member_count
                ? `${group.member_count} membres`
                : '';
        }

        // Show loading
        const container = document.getElementById('messagesContainer');
        if (container) {
            container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
        }

        // Highlight active group in sidebar
        document.querySelectorAll('.group-item').forEach(el => {
            el.classList.toggle('active', parseInt(el.dataset.groupId) === groupId);
        });

        // Mobile: hide sidebar, show main
        if (this.state.isMobile) {
            document.getElementById('sidebar')?.classList.add('hidden');
            document.getElementById('mainContent')?.classList.remove('hidden');
        }

        // Load messages
        await this.loadMessages(groupId);

        // Mark as read
        this.markAsRead(groupId);

        // Focus composer
        const composerInput = document.getElementById('composerInput');
        if (composerInput && !this.state.isMobile) {
            composerInput.focus();
        }
    },

    async createGroup(name, type, description) {
        if (!this.isAdmin()) {
            this.showToast('Seuls les administrateurs peuvent créer des salons', 'error');
            return;
        }

        try {
            const data = await this.api('groups.php?action=create', {
                method: 'POST',
                body: { name, type, description },
            });
            if (data && data.group) {
                this.state.groups.push(data.group);
                this.renderGroupList();
                this.showToast('Salon créé avec succès', 'success');
                this.openGroup(data.group.id);
            }
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    // =========================================================================
    // MESSAGES
    // =========================================================================
    async loadMessages(groupId, before = null) {
        let url = `messages.php?action=list&group_id=${groupId}&limit=50`;
        if (before) url += `&before=${before}`;

        try {
            const data = await this.api(url);
            if (!data || !data.messages) return;

            if (before) {
                // Prepend older messages
                this.state.messages = [...data.messages, ...this.state.messages];
                this.renderMessages(data.messages, true);
            } else {
                this.state.messages = data.messages;
                this.renderMessages(data.messages, false);
            }

            if (data.messages.length > 0) {
                this.state.lastMessageIds[groupId] =
                    data.messages[data.messages.length - 1].id;
            }
        } catch (err) {
            const container = document.getElementById('messagesContainer');
            if (container) {
                container.innerHTML =
                    '<div class="empty-state"><p>Erreur de chargement des messages</p></div>';
            }
        }
    },

    async loadOlderMessages() {
        if (this.state.loadingOlder || !this.state.currentGroup) return;
        if (this.state.messages.length === 0) return;

        this.state.loadingOlder = true;
        const oldestId = this.state.messages[0]?.id;

        if (oldestId) {
            await this.loadMessages(this.state.currentGroup.id, oldestId);
        }

        this.state.loadingOlder = false;
    },

    renderMessages(messages, prepend = false) {
        const container = document.getElementById('messagesContainer');
        if (!container) return;

        if (messages.length === 0 && !prepend) {
            container.innerHTML =
                '<div class="empty-state"><p>Aucun message pour le moment</p><p>Soyez le premier à écrire !</p></div>';
            return;
        }

        // Group messages by date
        let html = '';
        let lastDate = prepend ? null : '';
        let lastAuthor = null;

        messages.forEach((msg, idx) => {
            const msgDate = new Date(msg.created_at);
            const dateStr = this.formatDate(msgDate);

            // Date separator
            if (dateStr !== lastDate) {
                html += `<div class="date-separator"><span>${dateStr}</span></div>`;
                lastDate = dateStr;
                lastAuthor = null;
            }

            // Group consecutive messages from same author
            const isConsecutive = lastAuthor === msg.user_id &&
                idx > 0 &&
                (new Date(msg.created_at) - new Date(messages[idx - 1]?.created_at)) < 120000;

            html += this.renderMessageBubble(msg, isConsecutive);
            lastAuthor = msg.user_id;
        });

        if (prepend) {
            const scrollHeight = container.scrollHeight;
            const scrollTop = container.scrollTop;
            container.insertAdjacentHTML('afterbegin', html);
            // Maintain scroll position
            container.scrollTop = scrollTop + (container.scrollHeight - scrollHeight);
        } else {
            container.innerHTML = html;
            this.scrollToBottom();
        }
    },

    renderMessageBubble(msg, isConsecutive = false) {
        const isSent = this.state.user && msg.user_id === this.state.user.id;
        const sideClass = isSent ? 'sent' : 'received';
        const pinnedClass = msg.is_pinned ? 'message-pinned' : '';
        const consecutiveClass = isConsecutive ? 'consecutive' : '';

        // Status icons for sent messages
        let statusHtml = '';
        if (isSent) {
            if (msg.read_count > 0) {
                statusHtml = '<span class="message-status read" title="Lu">✓✓</span>';
            } else if (msg.delivered_count > 0) {
                statusHtml = '<span class="message-status delivered" title="Reçu">✓✓</span>';
            } else {
                statusHtml = '<span class="message-status" title="Envoyé">✓</span>';
            }
        }

        // Reply quote
        let replyHtml = '';
        if (msg.parent_message) {
            const parentContent = msg.parent_message.content || '';
            const parentAuthor = msg.parent_message.author || msg.parent_message.author_name || '';
            replyHtml = `<div class="message-reply" onclick="App.scrollToMessage(${msg.parent_message_id})">
                <div class="message-reply-author">${this.escapeHtml(parentAuthor)}</div>
                <div class="message-reply-text">${this.escapeHtml(this.truncate(parentContent, 100))}</div>
            </div>`;
        }

        // Attachments
        let attachHtml = '';
        if (msg.attachments && msg.attachments.length > 0) {
            attachHtml += '<div class="message-attachments">';
            msg.attachments.forEach(att => {
                if (att.file_type === 'image' || (att.mime_type && att.mime_type.startsWith('image/'))) {
                    const src = att.file_path.startsWith('http') ? att.file_path : '/connect/' + att.file_path;
                    attachHtml += `<div class="message-image-wrapper">
                        <img class="message-image" src="${this.escapeHtml(src)}" alt="${this.escapeHtml(att.file_name || '')}" onclick="App.openImageViewer('${this.escapeHtml(src)}')" loading="lazy">
                        ${att.caption ? `<div class="message-caption">${this.escapeHtml(att.caption)}</div>` : ''}
                    </div>`;
                } else if (att.file_type === 'video' || (att.mime_type && att.mime_type.startsWith('video/'))) {
                    const src = att.file_path.startsWith('http') ? att.file_path : '/connect/' + att.file_path;
                    attachHtml += `<div class="message-video-wrapper">
                        <video class="message-video" controls preload="metadata" style="max-width:300px;border-radius:6px">
                            <source src="${this.escapeHtml(src)}" type="${this.escapeHtml(att.mime_type || 'video/mp4')}">
                        </video>
                    </div>`;
                } else {
                    const src = att.file_path.startsWith('http') ? att.file_path : '/connect/' + att.file_path;
                    const fileIcon = this.getFileIcon(att.mime_type);
                    attachHtml += `<div class="message-file" onclick="App.downloadFile('${this.escapeHtml(src)}', '${this.escapeHtml(att.file_name || 'fichier')}')">
                        <div class="message-file-icon">${fileIcon}</div>
                        <div class="message-file-info">
                            <div class="message-file-name">${this.escapeHtml(att.file_name || 'Fichier')}</div>
                            <div class="message-file-size">${this.formatFileSize(att.file_size)}</div>
                        </div>
                        <div class="message-file-download">⬇</div>
                    </div>`;
                }
            });
            attachHtml += '</div>';
        }

        // Author name for received messages (skip if consecutive)
        let authorHtml = '';
        if (!isSent && !isConsecutive) {
            const authorColor = this.getAuthorColor(msg.user_id);
            authorHtml = `<div class="message-author" style="color:${authorColor}">${this.escapeHtml(msg.author_name || '')}</div>`;
        }

        // Content with link detection
        const content = msg.content ? this.linkify(this.escapeHtml(msg.content)) : '';

        // Pinned indicator
        const pinnedIndicator = msg.is_pinned
            ? '<div class="pinned-indicator">📌 Message épinglé</div>'
            : '';

        // Message actions (hover/tap menu)
        let actionsHtml = '<div class="message-actions">';
        actionsHtml += `<button onclick="App.replyToMessage(${msg.id})" title="Répondre">↩</button>`;
        if (isSent) {
            actionsHtml += `<button onclick="App.editMessage(${msg.id})" title="Modifier">✎</button>`;
        }
        if (isSent || this.isAdmin()) {
            actionsHtml += `<button onclick="App.deleteMessage(${msg.id})" title="Supprimer">🗑</button>`;
        }
        if (!isSent) {
            actionsHtml += `<button onclick="App.showReportModal(${msg.id})" title="Signaler">⚑</button>`;
        }
        if (this.isAdmin()) {
            const pinLabel = msg.is_pinned ? 'Désépingler' : 'Épingler';
            const pinAction = msg.is_pinned ? 'unpinMessage' : 'pinMessage';
            actionsHtml += `<button onclick="App.${pinAction}(${msg.id})" title="${pinLabel}">📌</button>`;
        }
        actionsHtml += `<button onclick="App.forwardMessage(${msg.id})" title="Transférer">➡</button>`;
        actionsHtml += `<button onclick="App.showMessageInfo(${msg.id})" title="Info">ℹ</button>`;
        actionsHtml += '</div>';

        return `<div class="message ${sideClass} ${pinnedClass} ${consecutiveClass}" id="msg-${msg.id}" data-msg-id="${msg.id}">
            <div class="message-bubble">
                ${pinnedIndicator}
                ${authorHtml}
                ${replyHtml}
                ${attachHtml}
                ${content ? `<div class="message-text">${content}</div>` : ''}
                <div class="message-meta">
                    ${msg.edited_at ? '<span class="message-edited">modifié</span>' : ''}
                    <span class="message-time">${this.formatTime(new Date(msg.created_at))}</span>
                    ${statusHtml}
                </div>
                ${actionsHtml}
            </div>
        </div>`;
    },

    async sendMessage() {
        const input = document.getElementById('composerInput');
        if (!input) return;

        const content = input.value.trim();
        if (!content && this.state.attachments.length === 0) return;
        if (!this.state.currentGroup) return;

        // Check anonymization for clinical cases
        if (this.state.currentGroup.type === 'clinical_cases' && !this.state.anonAccepted) {
            this.showAnonymizationConfirmation(() => {
                this.state.anonAccepted = true;
                this.sendMessage();
            });
            return;
        }

        // Build FormData
        const formData = new FormData();
        formData.append('action', 'create');
        formData.append('group_id', this.state.currentGroup.id);
        if (content) formData.append('content', content);
        if (this.state.replyTo) {
            formData.append('parent_message_id', this.state.replyTo.id);
        }
        if (this.state.csrfToken) {
            formData.append('csrf_token', this.state.csrfToken);
        }

        // Add attachments
        this.state.attachments.forEach((att, i) => {
            formData.append(`files[${i}]`, att.file);
            if (att.caption) {
                formData.append(`captions[${i}]`, att.caption);
            }
        });

        // Clear input immediately for responsiveness
        const savedContent = input.value;
        const savedReply = this.state.replyTo;
        const savedAttachments = [...this.state.attachments];
        input.value = '';
        input.style.height = 'auto';
        this.clearAttachments();
        this.clearReply();

        // Optimistic message
        const tempId = this.generateTempId();
        const tempMsg = {
            id: tempId,
            user_id: this.state.user.id,
            author_name: this.state.user.first_name + ' ' + this.state.user.last_name,
            content: content,
            created_at: new Date().toISOString(),
            attachments: [],
            parent_message: savedReply ? {
                author: savedReply.author_name,
                content: savedReply.content,
            } : null,
            parent_message_id: savedReply ? savedReply.id : null,
            _temp: true,
        };
        this.state.messages.push(tempMsg);
        const container = document.getElementById('messagesContainer');
        if (container) {
            // Remove empty state if present
            const emptyState = container.querySelector('.empty-state');
            if (emptyState) emptyState.remove();

            container.insertAdjacentHTML('beforeend', this.renderMessageBubble(tempMsg));
            this.scrollToBottom();
        }

        try {
            const data = await this.api('messages.php?action=create', {
                method: 'POST',
                body: formData,
            });

            if (data && data.message) {
                // Replace temp message with real one
                const tempIdx = this.state.messages.findIndex(m => m.id === tempId);
                if (tempIdx > -1) {
                    this.state.messages[tempIdx] = data.message;
                }
                const tempEl = document.getElementById(`msg-${tempId}`);
                if (tempEl) {
                    tempEl.outerHTML = this.renderMessageBubble(data.message);
                }
                this.scrollToBottom();
            }
        } catch (err) {
            this.showToast('Erreur d\'envoi: ' + err.message, 'error');
            // Remove temp message
            this.state.messages = this.state.messages.filter(m => m.id !== tempId);
            const tempEl = document.getElementById(`msg-${tempId}`);
            if (tempEl) tempEl.remove();
            // Restore input
            input.value = savedContent;
            this.state.replyTo = savedReply;
            this.state.attachments = savedAttachments;
            this.renderAttachmentPreviews();
            if (savedReply) this.replyToMessage(savedReply.id);
        }
    },

    async editMessage(msgId) {
        const msg = this.state.messages.find(m => m.id === msgId);
        if (!msg) return;

        // Show inline edit UI
        const msgEl = document.getElementById(`msg-${msgId}`);
        if (!msgEl) return;

        const textEl = msgEl.querySelector('.message-text');
        if (!textEl) return;

        const originalContent = msg.content || '';
        textEl.innerHTML = `<div class="edit-inline">
            <textarea class="edit-textarea" id="editInput-${msgId}">${this.escapeHtml(originalContent)}</textarea>
            <div class="edit-actions">
                <button class="btn btn-sm btn-primary" onclick="App.saveEdit(${msgId})">Enregistrer</button>
                <button class="btn btn-sm" onclick="App.cancelEdit(${msgId})">Annuler</button>
            </div>
        </div>`;

        const editInput = document.getElementById(`editInput-${msgId}`);
        if (editInput) {
            editInput.focus();
            editInput.setSelectionRange(editInput.value.length, editInput.value.length);
            this.autoResizeTextarea(editInput);

            editInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.saveEdit(msgId);
                }
                if (e.key === 'Escape') {
                    this.cancelEdit(msgId);
                }
            });
        }

        this.state.editingMessage = msgId;
    },

    async saveEdit(msgId) {
        const editInput = document.getElementById(`editInput-${msgId}`);
        if (!editInput) return;

        const newContent = editInput.value.trim();
        const msg = this.state.messages.find(m => m.id === msgId);
        if (!msg) return;

        if (!newContent) {
            this.showToast('Le message ne peut pas être vide', 'error');
            return;
        }

        if (newContent === msg.content) {
            this.cancelEdit(msgId);
            return;
        }

        try {
            await this.api('messages.php?action=edit', {
                method: 'POST',
                body: { message_id: msgId, content: newContent },
            });
            msg.content = newContent;
            msg.edited_at = new Date().toISOString();
            const el = document.getElementById(`msg-${msgId}`);
            if (el) el.outerHTML = this.renderMessageBubble(msg);
            this.state.editingMessage = null;
            this.showToast('Message modifié', 'success');
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    cancelEdit(msgId) {
        const msg = this.state.messages.find(m => m.id === msgId);
        if (!msg) return;
        const el = document.getElementById(`msg-${msgId}`);
        if (el) el.outerHTML = this.renderMessageBubble(msg);
        this.state.editingMessage = null;
    },

    async deleteMessage(msgId) {
        if (!confirm('Supprimer ce message ?')) return;

        try {
            await this.api('messages.php?action=delete', {
                method: 'POST',
                body: { message_id: msgId },
            });
            this.state.messages = this.state.messages.filter(m => m.id !== msgId);
            const el = document.getElementById(`msg-${msgId}`);
            if (el) {
                el.classList.add('message-removing');
                setTimeout(() => el.remove(), 300);
            }
            this.showToast('Message supprimé', 'success');
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    async pinMessage(msgId) {
        try {
            await this.api('messages.php?action=pin', {
                method: 'POST',
                body: { message_id: msgId },
            });
            const msg = this.state.messages.find(m => m.id === msgId);
            if (msg) {
                msg.is_pinned = true;
                const el = document.getElementById(`msg-${msgId}`);
                if (el) el.outerHTML = this.renderMessageBubble(msg);
            }
            this.showToast('Message épinglé', 'success');
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    async unpinMessage(msgId) {
        try {
            await this.api('messages.php?action=unpin', {
                method: 'POST',
                body: { message_id: msgId },
            });
            const msg = this.state.messages.find(m => m.id === msgId);
            if (msg) {
                msg.is_pinned = false;
                const el = document.getElementById(`msg-${msgId}`);
                if (el) el.outerHTML = this.renderMessageBubble(msg);
            }
            this.showToast('Message désépinglé', 'success');
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    async markAsRead(groupId) {
        try {
            await this.api('messages.php?action=mark-read', {
                method: 'POST',
                body: { group_id: groupId },
            });
            this.state.unreadCounts[groupId] = 0;
            this.updateUnreadBadges();
        } catch (err) {
            // Silently fail
        }
    },

    async showMessageInfo(msgId) {
        try {
            const data = await this.api(`messages.php?action=info&message_id=${msgId}`);
            if (!data) return;

            const modal = document.getElementById('messageInfoModal');
            const body = modal?.querySelector('.modal-body') || document.getElementById('messageInfoBody');
            if (!body) return;

            const renderList = (items, timeField) => {
                if (!items || items.length === 0) return '<p class="text-muted">Aucun</p>';
                return '<ul class="info-list">' + items.map(r =>
                    `<li>
                        <span class="info-name">${this.escapeHtml(r.name || r.first_name + ' ' + r.last_name)}</span>
                        ${r[timeField] ? `<span class="info-time">${this.formatDateTime(new Date(r[timeField]))}</span>` : ''}
                    </li>`
                ).join('') + '</ul>';
            };

            body.innerHTML = `
                <div class="info-section">
                    <h4>✓✓ Lu par (${data.read?.length || 0})</h4>
                    ${renderList(data.read, 'read_at')}
                </div>
                <div class="info-section">
                    <h4>✓✓ Reçu par (${data.delivered?.length || 0})</h4>
                    ${renderList(data.delivered, 'delivered_at')}
                </div>
                <div class="info-section">
                    <h4>Non reçu (${data.not_delivered?.length || 0})</h4>
                    ${renderList(data.not_delivered, null)}
                </div>`;

            this.showModal('messageInfoModal');
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    replyToMessage(msgId) {
        const msg = this.state.messages.find(m => m.id === msgId);
        if (!msg) return;

        this.state.replyTo = msg;
        let replyBar = document.getElementById('replyBar');
        if (!replyBar) {
            // Create reply bar above composer
            const composerForm = document.getElementById('composerForm');
            if (composerForm) {
                replyBar = document.createElement('div');
                replyBar.id = 'replyBar';
                composerForm.parentNode.insertBefore(replyBar, composerForm);
            }
        }

        if (replyBar) {
            replyBar.innerHTML = `<div class="reply-preview">
                <div class="reply-preview-bar"></div>
                <div class="reply-preview-content">
                    <div class="reply-preview-author">${this.escapeHtml(msg.author_name || '')}</div>
                    <div class="reply-preview-text">${this.escapeHtml(this.truncate(msg.content || '', 80))}</div>
                </div>
                <button class="reply-close" onclick="App.clearReply()" title="Annuler la réponse">✕</button>
            </div>`;
            replyBar.classList.remove('hidden');
        }

        const composerInput = document.getElementById('composerInput');
        if (composerInput) composerInput.focus();
    },

    clearReply() {
        this.state.replyTo = null;
        const replyBar = document.getElementById('replyBar');
        if (replyBar) {
            replyBar.innerHTML = '';
            replyBar.classList.add('hidden');
        }
    },

    scrollToMessage(msgId) {
        const el = document.getElementById(`msg-${msgId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('highlight');
            setTimeout(() => el.classList.remove('highlight'), 2000);
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

    async forwardMessage(msgId) {
        const msg = this.state.messages.find(m => m.id === msgId);
        if (!msg) return;

        // Show group selection for forwarding
        const groups = this.state.groups.filter(g =>
            !this.state.currentGroup || g.id !== this.state.currentGroup.id
        );
        if (groups.length === 0) {
            this.showToast('Aucun autre salon disponible', 'error');
            return;
        }

        let html = '<div class="forward-dialog"><h4>Transférer vers :</h4><div class="forward-list">';
        groups.forEach(g => {
            html += `<div class="forward-item" onclick="App.doForwardMessage(${msgId}, ${g.id})">
                <span>${this.escapeHtml(g.name)}</span>
            </div>`;
        });
        html += '</div></div>';

        // Use a temporary modal
        let forwardModal = document.getElementById('forwardModal');
        if (!forwardModal) {
            forwardModal = document.createElement('div');
            forwardModal.id = 'forwardModal';
            forwardModal.className = 'modal-overlay';
            forwardModal.innerHTML = `<div class="modal">
                <div class="modal-header">
                    <h3>Transférer le message</h3>
                    <button class="modal-close" onclick="App.hideModal('forwardModal')">✕</button>
                </div>
                <div class="modal-body" id="forwardModalBody"></div>
            </div>`;
            document.body.appendChild(forwardModal);
        }

        document.getElementById('forwardModalBody').innerHTML = html;
        this.showModal('forwardModal');
    },

    async doForwardMessage(msgId, targetGroupId) {
        try {
            await this.api('messages.php?action=forward', {
                method: 'POST',
                body: { message_id: msgId, target_group_id: targetGroupId },
            });
            this.hideModal('forwardModal');
            this.showToast('Message transféré', 'success');
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    showMessageContextMenu(msgId, x, y) {
        // Remove existing context menu
        const existing = document.getElementById('contextMenu');
        if (existing) existing.remove();

        const msg = this.state.messages.find(m => m.id === msgId);
        if (!msg) return;

        const isSent = this.state.user && msg.user_id === this.state.user.id;

        let menuHtml = '<div id="contextMenu" class="context-menu" style="top:' + y + 'px;left:' + x + 'px">';
        menuHtml += `<div class="context-item" onclick="App.replyToMessage(${msgId});document.getElementById('contextMenu')?.remove()">↩ Répondre</div>`;
        menuHtml += `<div class="context-item" onclick="App.forwardMessage(${msgId});document.getElementById('contextMenu')?.remove()">➡ Transférer</div>`;
        if (msg.content) {
            menuHtml += `<div class="context-item" onclick="App.copyToClipboard('${this.escapeHtml(msg.content.replace(/'/g, "\\'"))}');document.getElementById('contextMenu')?.remove()">📋 Copier</div>`;
        }
        if (isSent) {
            menuHtml += `<div class="context-item" onclick="App.editMessage(${msgId});document.getElementById('contextMenu')?.remove()">✎ Modifier</div>`;
            menuHtml += `<div class="context-item danger" onclick="App.deleteMessage(${msgId});document.getElementById('contextMenu')?.remove()">🗑 Supprimer</div>`;
        } else {
            menuHtml += `<div class="context-item" onclick="App.showReportModal(${msgId});document.getElementById('contextMenu')?.remove()">⚑ Signaler</div>`;
        }
        if (this.isAdmin()) {
            const pinLabel = msg.is_pinned ? '📌 Désépingler' : '📌 Épingler';
            const pinAction = msg.is_pinned ? 'unpinMessage' : 'pinMessage';
            menuHtml += `<div class="context-item" onclick="App.${pinAction}(${msgId});document.getElementById('contextMenu')?.remove()">${pinLabel}</div>`;
        }
        menuHtml += `<div class="context-item" onclick="App.showMessageInfo(${msgId});document.getElementById('contextMenu')?.remove()">ℹ Info</div>`;
        menuHtml += '</div>';

        document.body.insertAdjacentHTML('beforeend', menuHtml);

        // Adjust position if off screen
        const menu = document.getElementById('contextMenu');
        if (menu) {
            const rect = menu.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                menu.style.left = (window.innerWidth - rect.width - 10) + 'px';
            }
            if (rect.bottom > window.innerHeight) {
                menu.style.top = (window.innerHeight - rect.height - 10) + 'px';
            }
        }
    },

    getAuthorColor(userId) {
        const colors = [
            '#e17055', '#00b894', '#0984e3', '#6c5ce7',
            '#fdcb6e', '#e84393', '#00cec9', '#ff7675',
            '#74b9ff', '#a29bfe', '#55efc4', '#fab1a0',
        ];
        return colors[(userId || 0) % colors.length];
    },

    // =========================================================================
    // ATTACHMENTS
    // =========================================================================
    handleAttachment(files, type) {
        const maxFiles = 10;
        if (this.state.attachments.length + files.length > maxFiles) {
            this.showToast(`Maximum ${maxFiles} fichiers par message`, 'error');
            return;
        }

        Array.from(files).forEach(file => {
            const maxSize = type === 'image' ? 20 * 1024 * 1024 : 100 * 1024 * 1024;
            if (file.size > maxSize) {
                this.showToast(
                    `"${file.name}" est trop volumineux (max ${this.formatFileSize(maxSize)})`,
                    'error'
                );
                return;
            }

            // Validate file type
            const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            const blockedTypes = ['application/x-executable', 'application/x-msdownload'];
            if (type === 'image' && !allowedImageTypes.includes(file.type)) {
                this.showToast('Type d\'image non supporté', 'error');
                return;
            }
            if (blockedTypes.includes(file.type)) {
                this.showToast('Type de fichier non autorisé', 'error');
                return;
            }

            this.state.attachments.push({
                file: file,
                type: file.type.startsWith('image/') ? 'image' : 'file',
                caption: '',
                preview: null,
            });

            // Generate preview for images
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                const idx = this.state.attachments.length - 1;
                reader.onload = (e) => {
                    if (this.state.attachments[idx]) {
                        this.state.attachments[idx].preview = e.target.result;
                        this.renderAttachmentPreviews();
                    }
                };
                reader.readAsDataURL(file);
            }
        });

        this.renderAttachmentPreviews();
    },

    renderAttachmentPreviews() {
        const container = document.getElementById('attachmentPreview');
        if (!container) return;

        if (this.state.attachments.length === 0) {
            container.classList.add('hidden');
            container.innerHTML = '';
            return;
        }

        container.classList.remove('hidden');
        container.innerHTML = this.state.attachments
            .map((att, i) => {
                if (att.type === 'image' || att.file.type.startsWith('image/')) {
                    const src = att.preview || URL.createObjectURL(att.file);
                    return `<div class="attachment-preview" data-index="${i}">
                        <img src="${src}" alt="${this.escapeHtml(att.file.name)}">
                        <button class="remove" onclick="App.removeAttachment(${i})" title="Retirer">✕</button>
                        <input type="text" class="attachment-caption" placeholder="Ajouter une légende..."
                            value="${this.escapeHtml(att.caption)}"
                            onchange="App.state.attachments[${i}].caption=this.value">
                    </div>`;
                } else {
                    return `<div class="attachment-file-preview" data-index="${i}">
                        <div class="message-file-icon">${this.getFileIcon(att.file.type)}</div>
                        <div class="attachment-file-info">
                            <div class="attachment-file-name">${this.escapeHtml(att.file.name)}</div>
                            <div class="attachment-file-size">${this.formatFileSize(att.file.size)}</div>
                        </div>
                        <button class="remove" onclick="App.removeAttachment(${i})" title="Retirer">✕</button>
                    </div>`;
                }
            })
            .join('');
    },

    removeAttachment(index) {
        this.state.attachments.splice(index, 1);
        this.renderAttachmentPreviews();
    },

    clearAttachments() {
        this.state.attachments = [];
        this.renderAttachmentPreviews();
    },

    // =========================================================================
    // IMAGE VIEWER
    // =========================================================================
    openImageViewer(src) {
        const viewer = document.getElementById('imageViewer');
        const img = document.getElementById('viewerImage');
        if (viewer && img) {
            img.src = src;
            img.alt = 'Image en plein écran';
            viewer.classList.remove('hidden');
            document.body.style.overflow = 'hidden';

            // Keyboard navigation
            this._viewerKeyHandler = (e) => {
                if (e.key === 'Escape') this.closeImageViewer();
            };
            document.addEventListener('keydown', this._viewerKeyHandler);
        }
    },

    closeImageViewer() {
        const viewer = document.getElementById('imageViewer');
        if (viewer) {
            viewer.classList.add('hidden');
            document.body.style.overflow = '';
            if (this._viewerKeyHandler) {
                document.removeEventListener('keydown', this._viewerKeyHandler);
                this._viewerKeyHandler = null;
            }
        }
    },

    downloadFile(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'download';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 100);
    },

    // =========================================================================
    // POLLING
    // =========================================================================
    startPolling() {
        this.stopPolling();
        this.state.polling = setInterval(() => this.pollUpdates(), 3000);
    },

    stopPolling() {
        if (this.state.polling) {
            clearInterval(this.state.polling);
            this.state.polling = null;
        }
    },

    async pollUpdates() {
        try {
            // Poll unread counts
            const countData = await this.api('notifications.php?action=unread-counts');
            if (countData && countData.counts) {
                const oldCounts = { ...this.state.unreadCounts };
                this.state.unreadCounts = countData.counts;
                this.updateUnreadBadges();

                // Detect new unreads in non-current groups for notification
                for (const [groupId, count] of Object.entries(countData.counts)) {
                    const gId = parseInt(groupId);
                    if (this.state.currentGroup && gId === this.state.currentGroup.id) continue;
                    if (count > (oldCounts[groupId] || 0)) {
                        // New message in another group - update group list preview
                        this.refreshGroupPreview(gId);
                    }
                }
            }

            // Poll new messages in current group
            if (this.state.currentGroup) {
                const lastId = this.state.messages.length > 0
                    ? Math.max(...this.state.messages.filter(m => !m._temp).map(m => m.id))
                    : 0;

                const msgData = await this.api(
                    `messages.php?action=list&group_id=${this.state.currentGroup.id}&after=${lastId}&limit=50`
                );

                if (msgData && msgData.messages && msgData.messages.length > 0) {
                    const container = document.getElementById('messagesContainer');
                    const isNearBottom = container
                        ? container.scrollHeight - container.scrollTop - container.clientHeight < 200
                        : false;

                    msgData.messages.forEach(msg => {
                        // Skip if we already have this message (or it's our own temp message)
                        if (this.state.messages.find(m => m.id === msg.id)) return;

                        this.state.messages.push(msg);
                        if (container) {
                            // Remove empty state
                            const emptyState = container.querySelector('.empty-state');
                            if (emptyState) emptyState.remove();

                            container.insertAdjacentHTML(
                                'beforeend',
                                this.renderMessageBubble(msg)
                            );
                        }
                    });

                    // Auto scroll if user was near bottom
                    if (isNearBottom) {
                        this.scrollToBottom();
                    } else if (msgData.messages.length > 0) {
                        // Show "new messages" indicator
                        this.showNewMessageIndicator(msgData.messages.length);
                    }

                    // Mark as read if we're viewing
                    if (!document.hidden) {
                        this.markAsRead(this.state.currentGroup.id);
                    }
                }
            }
        } catch (err) {
            // Silently fail - polling will retry
        }
    },

    showNewMessageIndicator(count) {
        let indicator = document.getElementById('newMsgIndicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'newMsgIndicator';
            indicator.className = 'new-message-indicator';
            const container = document.getElementById('messagesContainer');
            if (container) container.parentNode.appendChild(indicator);
        }
        indicator.textContent = `↓ ${count} nouveau${count > 1 ? 'x' : ''} message${count > 1 ? 's' : ''}`;
        indicator.classList.remove('hidden');
        indicator.onclick = () => {
            this.scrollToBottom();
            indicator.classList.add('hidden');
        };
    },

    async refreshGroupPreview(groupId) {
        try {
            const data = await this.api(`groups.php?action=info&group_id=${groupId}`);
            if (data && data.group) {
                const idx = this.state.groups.findIndex(g => g.id === groupId);
                if (idx > -1) {
                    this.state.groups[idx] = { ...this.state.groups[idx], ...data.group };
                    this.renderGroupList();
                }
            }
        } catch (err) {
            // Silently fail
        }
    },

    updateUnreadBadges() {
        // Update group item badges
        this.state.groups.forEach(g => {
            const count = this.state.unreadCounts[g.id] || 0;
            const badgeEl = document.querySelector(
                `.group-item[data-group-id="${g.id}"] .group-badge`
            );
            if (badgeEl) {
                badgeEl.textContent = count > 99 ? '99+' : count;
                badgeEl.style.display = count > 0 ? '' : 'none';
            }
        });

        // Update global notification badge
        const total = Object.values(this.state.unreadCounts).reduce(
            (sum, c) => sum + (parseInt(c) || 0),
            0
        );
        const globalBadge = document.getElementById('notifBadge');
        if (globalBadge) {
            globalBadge.textContent = total > 99 ? '99+' : total;
            globalBadge.style.display = total > 0 ? '' : 'none';
        }

        // Update page title
        if (total > 0) {
            document.title = `(${total}) NADAR Connect`;
        } else {
            document.title = 'NADAR Connect';
        }

        // PWA badge
        if ('setAppBadge' in navigator) {
            if (total > 0) {
                navigator.setAppBadge(total).catch(() => {});
            } else {
                navigator.clearAppBadge().catch(() => {});
            }
        }
    },

    // =========================================================================
    // SEARCH
    // =========================================================================
    async search(query) {
        if (!query || query.length < 2) {
            const container = document.getElementById('searchResults');
            if (container) container.innerHTML = '';
            return;
        }

        try {
            const data = await this.api(
                `search.php?action=search&q=${encodeURIComponent(query)}`
            );
            this.renderSearchResults(data);
        } catch (err) {
            // Silently fail
        }
    },

    renderSearchResults(data) {
        const container = document.getElementById('searchResults');
        if (!container || !data) return;

        let html = '';

        // Messages results
        if (data.messages && data.messages.length > 0) {
            html += '<div class="search-section"><h4>Messages</h4>';
            data.messages.forEach(m => {
                const groupName = m.group_name || '';
                const content = m.content || '';
                const author = m.author_name || '';
                const time = m.created_at ? this.timeAgo(new Date(m.created_at)) : '';

                html += `<div class="search-result-item" onclick="App.navigateToMessage(${m.group_id}, ${m.id})">
                    <div class="search-result-group">${this.escapeHtml(groupName)}</div>
                    <div class="search-result-text">${this.highlightText(this.escapeHtml(this.truncate(content, 120)), document.getElementById('searchInput')?.value || '')}</div>
                    <div class="search-result-meta">${this.escapeHtml(author)} · ${time}</div>
                </div>`;
            });
            html += '</div>';
        }

        // Members results
        if (data.members && data.members.length > 0) {
            html += '<div class="search-section"><h4>Membres</h4>';
            data.members.forEach(m => {
                const name = (m.first_name || '') + ' ' + (m.last_name || '');
                const info = [m.city, m.institution].filter(Boolean).join(' · ');

                html += `<div class="search-result-item">
                    <div class="search-result-text">${this.escapeHtml(name.trim())}</div>
                    ${info ? `<div class="search-result-meta">${this.escapeHtml(info)}</div>` : ''}
                </div>`;
            });
            html += '</div>';
        }

        // Documents results
        if (data.documents && data.documents.length > 0) {
            html += '<div class="search-section"><h4>Documents</h4>';
            data.documents.forEach(d => {
                html += `<div class="search-result-item" onclick="App.showView('libraryView')">
                    <div class="search-result-text">${this.getFileIcon(d.mime_type)} ${this.escapeHtml(d.title || d.file_name)}</div>
                    <div class="search-result-meta">${this.formatFileSize(d.file_size)}</div>
                </div>`;
            });
            html += '</div>';
        }

        if (!html) {
            html = '<div class="search-empty"><p>Aucun résultat pour cette recherche</p></div>';
        }

        container.innerHTML = html;
    },

    highlightText(text, query) {
        if (!query || query.length < 2) return text;
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedQuery})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    },

    async navigateToMessage(groupId, msgId) {
        this.hideSearch();
        await this.openGroup(groupId);
        // Wait for messages to render, then scroll
        setTimeout(() => this.scrollToMessage(msgId), 500);
    },

    showSearch() {
        const overlay = document.getElementById('searchOverlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            const input = document.getElementById('searchInput');
            if (input) {
                input.value = '';
                input.focus();
            }
            document.getElementById('searchResults').innerHTML = '';
        }
    },

    hideSearch() {
        const overlay = document.getElementById('searchOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
        const input = document.getElementById('searchInput');
        if (input) input.value = '';
        const results = document.getElementById('searchResults');
        if (results) results.innerHTML = '';
    },

    // =========================================================================
    // LIBRARY (Documents)
    // =========================================================================
    async loadDocuments(category = '') {
        try {
            let url = 'documents.php?action=list';
            if (category) url += `&category=${encodeURIComponent(category)}`;
            const data = await this.api(url);
            this.renderLibrary(data?.documents || [], data?.categories || []);
        } catch (err) {
            this.showToast('Erreur de chargement des documents', 'error');
        }
    },

    renderLibrary(docs, categories) {
        const container = document.getElementById('libraryContent');
        if (!container) return;

        let html = '<div class="library-header">';
        html += '<h2>Bibliothèque</h2>';

        // Category filter
        if (categories && categories.length > 0) {
            html += '<div class="library-filters">';
            html += `<button class="filter-btn active" onclick="App.filterDocuments('')">Tous</button>`;
            categories.forEach(cat => {
                html += `<button class="filter-btn" onclick="App.filterDocuments('${this.escapeHtml(cat)}')">${this.escapeHtml(cat)}</button>`;
            });
            html += '</div>';
        }

        // Upload button for admins
        if (this.isAdmin()) {
            html += `<button class="btn btn-primary" onclick="App.showUploadDocumentModal()">
                <span>+</span> Ajouter un document
            </button>`;
        }
        html += '</div>';

        if (docs.length === 0) {
            html += '<div class="empty-state"><p>Aucun document pour le moment</p></div>';
        } else {
            html += '<div class="library-grid">';
            docs.forEach(doc => {
                const icon = this.getFileIcon(doc.mime_type);
                const date = doc.created_at ? this.formatDate(new Date(doc.created_at)) : '';
                const size = this.formatFileSize(doc.file_size);
                const path = doc.file_path?.startsWith('http') ? doc.file_path : '/connect/' + doc.file_path;

                html += `<div class="doc-card">
                    <div class="doc-icon">${icon}</div>
                    <div class="doc-info">
                        <div class="doc-title">${this.escapeHtml(doc.title || doc.file_name)}</div>
                        ${doc.category ? `<div class="doc-category">${this.escapeHtml(doc.category)}</div>` : ''}
                        ${doc.description ? `<div class="doc-description">${this.escapeHtml(this.truncate(doc.description, 100))}</div>` : ''}
                        <div class="doc-meta">
                            <span>${size}</span>
                            <span>${date}</span>
                            ${doc.author_name ? `<span>par ${this.escapeHtml(doc.author_name)}</span>` : ''}
                        </div>
                        <div class="doc-actions">
                            <button class="btn btn-sm btn-primary" onclick="App.downloadFile('${this.escapeHtml(path)}', '${this.escapeHtml(doc.file_name || 'document')}')">
                                Télécharger
                            </button>
                            ${this.isAdmin() ? `<button class="btn btn-sm btn-danger" onclick="App.deleteDocument(${doc.id})">Supprimer</button>` : ''}
                        </div>
                    </div>
                </div>`;
            });
            html += '</div>';
        }

        container.innerHTML = html;
    },

    filterDocuments(category) {
        // Update active filter button
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.textContent === (category || 'Tous'));
        });
        this.loadDocuments(category);
    },

    showUploadDocumentModal() {
        let modal = document.getElementById('uploadDocModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'uploadDocModal';
            modal.className = 'modal-overlay';
            modal.innerHTML = `<div class="modal">
                <div class="modal-header">
                    <h3>Ajouter un document</h3>
                    <button class="modal-close" onclick="App.hideModal('uploadDocModal')">✕</button>
                </div>
                <div class="modal-body">
                    <form id="uploadDocForm" onsubmit="event.preventDefault();App.uploadDocument()">
                        <div class="form-group">
                            <label>Titre</label>
                            <input type="text" name="title" required class="form-input" placeholder="Titre du document">
                        </div>
                        <div class="form-group">
                            <label>Catégorie</label>
                            <input type="text" name="category" class="form-input" placeholder="Ex: Protocoles, Articles...">
                        </div>
                        <div class="form-group">
                            <label>Description</label>
                            <textarea name="description" class="form-input" rows="3" placeholder="Description optionnelle"></textarea>
                        </div>
                        <div class="form-group">
                            <label>Fichier</label>
                            <input type="file" name="file" required class="form-input">
                        </div>
                        <button type="submit" class="btn btn-primary btn-block">Envoyer</button>
                    </form>
                </div>
            </div>`;
            document.body.appendChild(modal);
        }
        this.showModal('uploadDocModal');
    },

    async uploadDocument() {
        const form = document.getElementById('uploadDocForm');
        if (!form) return;

        const formData = new FormData(form);
        formData.append('action', 'upload');

        try {
            const data = await this.api('documents.php?action=upload', {
                method: 'POST',
                body: formData,
            });
            if (data && data.success) {
                this.showToast('Document ajouté', 'success');
                this.hideModal('uploadDocModal');
                form.reset();
                this.loadDocuments();
            }
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    async deleteDocument(docId) {
        if (!confirm('Supprimer ce document ?')) return;
        try {
            await this.api('documents.php?action=delete', {
                method: 'POST',
                body: { document_id: docId },
            });
            this.showToast('Document supprimé', 'success');
            this.loadDocuments();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    // =========================================================================
    // AGENDA (Events)
    // =========================================================================
    async loadEvents() {
        try {
            const data = await this.api('events.php?action=list');
            this.renderAgenda(data?.events || []);
        } catch (err) {
            this.showToast('Erreur de chargement des événements', 'error');
        }
    },

    renderAgenda(events) {
        const container = document.getElementById('agendaContent');
        if (!container) return;

        let html = '<div class="agenda-header">';
        html += '<h2>Agenda</h2>';
        if (this.isAdmin()) {
            html += `<button class="btn btn-primary" onclick="App.showCreateEventModal()">
                <span>+</span> Ajouter un événement
            </button>`;
        }
        html += '</div>';

        if (events.length === 0) {
            html += '<div class="empty-state"><p>Aucun événement programmé</p></div>';
        } else {
            // Group events: upcoming vs past
            const now = new Date();
            const upcoming = events.filter(e => new Date(e.event_date) >= now);
            const past = events.filter(e => new Date(e.event_date) < now);

            if (upcoming.length > 0) {
                html += '<h3 class="agenda-section-title">À venir</h3>';
                html += '<div class="agenda-list">';
                upcoming.forEach(evt => {
                    html += this.renderEventCard(evt);
                });
                html += '</div>';
            }

            if (past.length > 0) {
                html += '<h3 class="agenda-section-title">Passés</h3>';
                html += '<div class="agenda-list past">';
                past.forEach(evt => {
                    html += this.renderEventCard(evt, true);
                });
                html += '</div>';
            }
        }

        container.innerHTML = html;
    },

    renderEventCard(evt, isPast = false) {
        const d = new Date(evt.event_date);
        const months = [
            'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun',
            'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc',
        ];
        const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

        return `<div class="event-card ${isPast ? 'past' : ''}">
            <div class="event-date-badge">
                <span class="event-day-name">${days[d.getDay()]}</span>
                <span class="event-day">${d.getDate()}</span>
                <span class="event-month">${months[d.getMonth()]}</span>
                <span class="event-year">${d.getFullYear()}</span>
            </div>
            <div class="event-info">
                <div class="event-title">${this.escapeHtml(evt.title)}</div>
                ${evt.location ? `<div class="event-detail">📍 ${this.escapeHtml(evt.location)}</div>` : ''}
                ${evt.start_time ? `<div class="event-detail">🕐 ${this.escapeHtml(evt.start_time)}${evt.end_time ? ' - ' + this.escapeHtml(evt.end_time) : ''}</div>` : ''}
                ${evt.description ? `<div class="event-description">${this.escapeHtml(evt.description)}</div>` : ''}
                <div class="event-actions">
                    ${evt.registration_link && !isPast ? `<a href="${this.escapeHtml(evt.registration_link)}" target="_blank" rel="noopener" class="btn btn-sm btn-accent">S'inscrire</a>` : ''}
                    ${this.isAdmin() ? `<button class="btn btn-sm btn-danger" onclick="App.deleteEvent(${evt.id})">Supprimer</button>` : ''}
                </div>
            </div>
        </div>`;
    },

    showCreateEventModal() {
        let modal = document.getElementById('createEventModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'createEventModal';
            modal.className = 'modal-overlay';
            modal.innerHTML = `<div class="modal">
                <div class="modal-header">
                    <h3>Ajouter un événement</h3>
                    <button class="modal-close" onclick="App.hideModal('createEventModal')">✕</button>
                </div>
                <div class="modal-body">
                    <form id="createEventForm" onsubmit="event.preventDefault();App.createEvent()">
                        <div class="form-group">
                            <label>Titre *</label>
                            <input type="text" name="title" required class="form-input">
                        </div>
                        <div class="form-group">
                            <label>Date *</label>
                            <input type="date" name="event_date" required class="form-input">
                        </div>
                        <div class="form-group form-row">
                            <div>
                                <label>Heure début</label>
                                <input type="time" name="start_time" class="form-input">
                            </div>
                            <div>
                                <label>Heure fin</label>
                                <input type="time" name="end_time" class="form-input">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Lieu</label>
                            <input type="text" name="location" class="form-input">
                        </div>
                        <div class="form-group">
                            <label>Description</label>
                            <textarea name="description" class="form-input" rows="3"></textarea>
                        </div>
                        <div class="form-group">
                            <label>Lien d'inscription</label>
                            <input type="url" name="registration_link" class="form-input" placeholder="https://...">
                        </div>
                        <button type="submit" class="btn btn-primary btn-block">Créer</button>
                    </form>
                </div>
            </div>`;
            document.body.appendChild(modal);
        }
        this.showModal('createEventModal');
    },

    async createEvent() {
        const form = document.getElementById('createEventForm');
        if (!form) return;

        const formData = new FormData(form);
        const body = {};
        for (const [key, value] of formData.entries()) {
            if (value) body[key] = value;
        }

        try {
            const data = await this.api('events.php?action=create', {
                method: 'POST',
                body: body,
            });
            if (data && data.success) {
                this.showToast('Événement créé', 'success');
                this.hideModal('createEventModal');
                form.reset();
                this.loadEvents();
            }
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    async deleteEvent(eventId) {
        if (!confirm('Supprimer cet événement ?')) return;
        try {
            await this.api('events.php?action=delete', {
                method: 'POST',
                body: { event_id: eventId },
            });
            this.showToast('Événement supprimé', 'success');
            this.loadEvents();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    // =========================================================================
    // DIRECTORY (Members)
    // =========================================================================
    async loadMembers(searchQuery = '', page = 1) {
        try {
            let url = `members.php?action=list&page=${page}&per_page=30`;
            if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
            const data = await this.api(url);
            this.renderDirectory(data?.members || [], data?.total || 0, page, searchQuery);
        } catch (err) {
            this.showToast('Erreur de chargement de l\'annuaire', 'error');
        }
    },

    renderDirectory(members, total, page, searchQuery) {
        const container = document.getElementById('directoryContent');
        if (!container) return;

        let html = '<div class="directory-header">';
        html += '<h2>Annuaire des membres</h2>';
        html += `<div class="directory-search">
            <input type="text" class="form-input" placeholder="Rechercher un membre..."
                value="${this.escapeHtml(searchQuery || '')}"
                oninput="App.debounce(() => App.loadMembers(this.value), 400)()">
        </div>`;
        html += `<div class="directory-count">${total} membre${total > 1 ? 's' : ''}</div>`;
        html += '</div>';

        if (members.length === 0) {
            html += '<div class="empty-state"><p>Aucun membre trouvé</p></div>';
        } else {
            html += '<div class="directory-grid">';
            members.forEach(m => {
                const initials = (
                    (m.first_name?.[0] || '') + (m.last_name?.[0] || '')
                ).toUpperCase();

                const avatar = m.profile_photo
                    ? `<img src="/connect/${this.escapeHtml(m.profile_photo)}" class="member-avatar" alt="${this.escapeHtml(m.first_name)}" loading="lazy">`
                    : `<div class="member-avatar member-avatar-initials">${initials}</div>`;

                const roleBadge = m.role === 'admin' || m.role === 'super_admin'
                    ? '<span class="role-badge admin">Admin</span>'
                    : '';

                html += `<div class="member-card">
                    ${avatar}
                    <div class="member-name">${this.escapeHtml((m.first_name || '') + ' ' + (m.last_name || ''))} ${roleBadge}</div>
                    ${m.specialty ? `<div class="member-specialty">${this.escapeHtml(m.specialty)}</div>` : ''}
                    ${m.city ? `<div class="member-city">📍 ${this.escapeHtml(m.city)}</div>` : ''}
                    ${m.institution ? `<div class="member-institution">🏥 ${this.escapeHtml(m.institution)}</div>` : ''}
                    ${m.email ? `<div class="member-email"><a href="mailto:${this.escapeHtml(m.email)}">${this.escapeHtml(m.email)}</a></div>` : ''}
                </div>`;
            });
            html += '</div>';

            // Pagination
            const totalPages = Math.ceil(total / 30);
            if (totalPages > 1) {
                html += '<div class="pagination">';
                for (let i = 1; i <= totalPages; i++) {
                    html += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="App.loadMembers('${this.escapeHtml(searchQuery || '')}', ${i})">${i}</button>`;
                }
                html += '</div>';
            }
        }

        container.innerHTML = html;
    },

    // =========================================================================
    // PROFILE
    // =========================================================================
    renderProfile() {
        const container = document.getElementById('profileContent');
        if (!container || !this.state.user) return;

        const u = this.state.user;
        const initials = (
            (u.first_name?.[0] || '') + (u.last_name?.[0] || '')
        ).toUpperCase();

        container.innerHTML = `
            <div class="profile-page">
                <div class="profile-card">
                    <div class="profile-avatar-wrapper">
                        ${u.profile_photo
                            ? `<img src="/connect/${this.escapeHtml(u.profile_photo)}" class="profile-avatar" alt="Photo de profil">`
                            : `<div class="profile-avatar profile-avatar-initials">${initials}</div>`}
                    </div>
                    <h2 class="profile-name">${this.escapeHtml((u.first_name || '') + ' ' + (u.last_name || ''))}</h2>
                    ${u.specialty ? `<div class="profile-specialty">${this.escapeHtml(u.specialty)}</div>` : ''}

                    <div class="profile-info-list">
                        <div class="profile-info-item">
                            <span class="profile-info-label">Email</span>
                            <span class="profile-info-value">${this.escapeHtml(u.email)}</span>
                        </div>
                        <div class="profile-info-item">
                            <span class="profile-info-label">Téléphone</span>
                            <span class="profile-info-value">${this.escapeHtml(u.phone || '-')}</span>
                        </div>
                        <div class="profile-info-item">
                            <span class="profile-info-label">Ville</span>
                            <span class="profile-info-value">${this.escapeHtml(u.city || '-')}</span>
                        </div>
                        <div class="profile-info-item">
                            <span class="profile-info-label">Établissement</span>
                            <span class="profile-info-value">${this.escapeHtml(u.institution || '-')}</span>
                        </div>
                        <div class="profile-info-item">
                            <span class="profile-info-label">Statut</span>
                            <span class="profile-info-value">${this.escapeHtml(this.getRoleLabel(u.role))}</span>
                        </div>
                        <div class="profile-info-item">
                            <span class="profile-info-label">Membre depuis</span>
                            <span class="profile-info-value">${u.created_at ? this.formatDate(new Date(u.created_at)) : '-'}</span>
                        </div>
                    </div>

                    <div class="profile-actions">
                        <button class="btn btn-primary" onclick="App.showProfileEditModal()">Modifier le profil</button>
                        <button class="btn btn-outline" onclick="App.showChangePasswordModal()">Changer le mot de passe</button>
                        <button class="btn btn-danger" onclick="App.logout()">Déconnexion</button>
                    </div>
                </div>
            </div>`;
    },

    getRoleLabel(role) {
        const labels = {
            super_admin: 'Super Administrateur',
            admin: 'Administrateur',
            member: 'Membre',
            pending: 'En attente de validation',
            blocked: 'Bloqué',
        };
        return labels[role] || role || '';
    },

    showProfileEditModal() {
        const u = this.state.user;
        if (!u) return;

        let modal = document.getElementById('profileEditModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'profileEditModal';
            modal.className = 'modal-overlay';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `<div class="modal">
            <div class="modal-header">
                <h3>Modifier le profil</h3>
                <button class="modal-close" onclick="App.hideModal('profileEditModal')">✕</button>
            </div>
            <div class="modal-body">
                <form id="profileEditForm" onsubmit="event.preventDefault();App.saveProfileEdit()">
                    <div class="form-group">
                        <label>Prénom *</label>
                        <input type="text" name="first_name" class="form-input" value="${this.escapeHtml(u.first_name || '')}" required>
                    </div>
                    <div class="form-group">
                        <label>Nom *</label>
                        <input type="text" name="last_name" class="form-input" value="${this.escapeHtml(u.last_name || '')}" required>
                    </div>
                    <div class="form-group">
                        <label>Téléphone</label>
                        <input type="tel" name="phone" class="form-input" value="${this.escapeHtml(u.phone || '')}">
                    </div>
                    <div class="form-group">
                        <label>Ville</label>
                        <input type="text" name="city" class="form-input" value="${this.escapeHtml(u.city || '')}">
                    </div>
                    <div class="form-group">
                        <label>Établissement</label>
                        <input type="text" name="institution" class="form-input" value="${this.escapeHtml(u.institution || '')}">
                    </div>
                    <div class="form-group">
                        <label>Spécialité</label>
                        <input type="text" name="specialty" class="form-input" value="${this.escapeHtml(u.specialty || '')}">
                    </div>
                    <div class="form-group">
                        <label>Photo de profil</label>
                        <input type="file" name="profile_photo" class="form-input" accept="image/*">
                    </div>
                    <button type="submit" class="btn btn-primary btn-block">Enregistrer</button>
                </form>
            </div>
        </div>`;

        this.showModal('profileEditModal');
    },

    async saveProfileEdit() {
        const form = document.getElementById('profileEditForm');
        if (!form) return;

        const formData = new FormData(form);
        formData.append('action', 'update');

        try {
            const data = await this.api('members.php?action=update', {
                method: 'POST',
                body: formData,
            });
            if (data && data.user) {
                this.state.user = { ...this.state.user, ...data.user };
                this.renderProfile();
                this.updateUserUI();
                this.showToast('Profil mis à jour', 'success');
                this.hideModal('profileEditModal');
            }
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    async updateProfile(formData) {
        try {
            const data = await this.api('members.php?action=update', {
                method: 'POST',
                body: formData,
            });
            if (data && data.user) {
                this.state.user = { ...this.state.user, ...data.user };
                this.renderProfile();
                this.updateUserUI();
                this.showToast('Profil mis à jour', 'success');
                this.hideModal('profileModal');
            }
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    showChangePasswordModal() {
        let modal = document.getElementById('changePasswordModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'changePasswordModal';
            modal.className = 'modal-overlay';
            modal.innerHTML = `<div class="modal">
                <div class="modal-header">
                    <h3>Changer le mot de passe</h3>
                    <button class="modal-close" onclick="App.hideModal('changePasswordModal')">✕</button>
                </div>
                <div class="modal-body">
                    <form id="changePasswordForm" onsubmit="event.preventDefault();App.handleChangePassword()">
                        <div class="form-group">
                            <label>Mot de passe actuel</label>
                            <input type="password" name="current_password" class="form-input" required>
                        </div>
                        <div class="form-group">
                            <label>Nouveau mot de passe</label>
                            <input type="password" name="new_password" class="form-input" required minlength="8">
                        </div>
                        <div class="form-group">
                            <label>Confirmer le nouveau mot de passe</label>
                            <input type="password" name="confirm_password" class="form-input" required>
                        </div>
                        <div id="changePasswordError" class="form-error"></div>
                        <button type="submit" class="btn btn-primary btn-block">Modifier</button>
                    </form>
                </div>
            </div>`;
            document.body.appendChild(modal);
        }
        document.getElementById('changePasswordForm')?.reset();
        document.getElementById('changePasswordError').textContent = '';
        this.showModal('changePasswordModal');
    },

    async handleChangePassword() {
        const form = document.getElementById('changePasswordForm');
        const errorEl = document.getElementById('changePasswordError');
        if (!form) return;

        const currentPassword = form.querySelector('[name="current_password"]').value;
        const newPassword = form.querySelector('[name="new_password"]').value;
        const confirmPassword = form.querySelector('[name="confirm_password"]').value;

        if (newPassword !== confirmPassword) {
            if (errorEl) errorEl.textContent = 'Les mots de passe ne correspondent pas';
            return;
        }

        if (newPassword.length < 8) {
            if (errorEl) errorEl.textContent = 'Le mot de passe doit contenir au moins 8 caractères';
            return;
        }

        try {
            await this.changePassword(currentPassword, newPassword);
            this.hideModal('changePasswordModal');
        } catch (err) {
            if (errorEl) errorEl.textContent = err.message;
        }
    },

    // =========================================================================
    // ADMIN
    // =========================================================================
    isAdmin() {
        return (
            this.state.user &&
            ['super_admin', 'admin'].includes(this.state.user.role)
        );
    },

    async loadAdminDashboard() {
        if (!this.isAdmin()) {
            this.showView('chatView');
            return;
        }

        const container = document.getElementById('adminContent');
        if (container) {
            container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
        }

        try {
            const [stats, pending, reports] = await Promise.all([
                this.api('admin.php?action=stats'),
                this.api('admin.php?action=pending'),
                this.api('admin.php?action=reports'),
            ]);
            this.renderAdminDashboard(stats, pending, reports);
        } catch (err) {
            this.showToast(err.message, 'error');
            if (container) {
                container.innerHTML =
                    '<div class="empty-state"><p>Erreur de chargement du tableau de bord</p></div>';
            }
        }
    },

    renderAdminDashboard(stats, pending, reports) {
        const container = document.getElementById('adminContent');
        if (!container) return;

        const s = stats || {};
        const pendingMembers = pending?.members || [];
        const reportsList = reports?.reports || [];

        let html = `<div class="admin-container">
            <h2>Tableau de bord administrateur</h2>

            <div class="admin-stats">
                <div class="stat-card">
                    <div class="stat-icon">👥</div>
                    <div class="stat-value">${s.total_members || 0}</div>
                    <div class="stat-label">Membres actifs</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">⏳</div>
                    <div class="stat-value">${s.pending_members || 0}</div>
                    <div class="stat-label">En attente</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">💬</div>
                    <div class="stat-value">${s.total_messages || 0}</div>
                    <div class="stat-label">Messages</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">📁</div>
                    <div class="stat-value">${s.total_groups || 0}</div>
                    <div class="stat-label">Salons</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">📄</div>
                    <div class="stat-value">${s.total_documents || 0}</div>
                    <div class="stat-label">Documents</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">⚠️</div>
                    <div class="stat-value">${s.open_reports || 0}</div>
                    <div class="stat-label">Signalements</div>
                </div>
            </div>

            <div class="admin-section">
                <h3>Demandes d'inscription (${pendingMembers.length})</h3>
                ${pendingMembers.length === 0
                    ? '<p class="text-muted">Aucune demande en attente</p>'
                    : `<div class="admin-table-wrapper"><table class="admin-table">
                    <thead>
                        <tr>
                            <th>Nom</th>
                            <th>Email</th>
                            <th>Ville</th>
                            <th>Établissement</th>
                            <th>Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pendingMembers.map(m => `<tr>
                            <td>${this.escapeHtml((m.first_name || '') + ' ' + (m.last_name || ''))}</td>
                            <td>${this.escapeHtml(m.email || '')}</td>
                            <td>${this.escapeHtml(m.city || '-')}</td>
                            <td>${this.escapeHtml(m.institution || '-')}</td>
                            <td>${m.created_at ? this.formatDate(new Date(m.created_at)) : '-'}</td>
                            <td class="action-cell">
                                <button class="btn btn-sm btn-primary" onclick="App.approveMember(${m.id})">Accepter</button>
                                <button class="btn btn-sm btn-danger" onclick="App.rejectMember(${m.id})">Refuser</button>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table></div>`}
            </div>

            <div class="admin-section">
                <h3>Signalements (${reportsList.length})</h3>
                ${reportsList.length === 0
                    ? '<p class="text-muted">Aucun signalement</p>'
                    : `<div class="admin-table-wrapper"><table class="admin-table">
                    <thead>
                        <tr>
                            <th>Message</th>
                            <th>Auteur</th>
                            <th>Motif</th>
                            <th>Signalé par</th>
                            <th>Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reportsList.map(r => `<tr>
                            <td title="${this.escapeHtml(r.content || '')}">${this.escapeHtml(this.truncate(r.content || '', 50))}</td>
                            <td>${this.escapeHtml(r.author_name || '-')}</td>
                            <td>${this.escapeHtml(r.reason || '-')}</td>
                            <td>${this.escapeHtml(r.reporter_name || '-')}</td>
                            <td>${r.created_at ? this.formatDate(new Date(r.created_at)) : '-'}</td>
                            <td class="action-cell">
                                <button class="btn btn-sm btn-outline" onclick="App.handleReport(${r.id}, 'dismiss')">Ignorer</button>
                                <button class="btn btn-sm btn-danger" onclick="App.handleReport(${r.id}, 'delete')">Supprimer msg</button>
                                <button class="btn btn-sm btn-danger" onclick="App.handleReport(${r.id}, 'suspend')">Suspendre auteur</button>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table></div>`}
            </div>

            <div class="admin-section">
                <h3>Gestion des salons</h3>
                <button class="btn btn-primary" onclick="App.showCreateGroupModal()">Créer un salon</button>
            </div>
        </div>`;

        container.innerHTML = html;
    },

    showCreateGroupModal() {
        let modal = document.getElementById('createGroupModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'createGroupModal';
            modal.className = 'modal-overlay';
            modal.innerHTML = `<div class="modal">
                <div class="modal-header">
                    <h3>Créer un salon</h3>
                    <button class="modal-close" onclick="App.hideModal('createGroupModal')">✕</button>
                </div>
                <div class="modal-body">
                    <form id="createGroupForm" onsubmit="event.preventDefault();App.handleCreateGroup()">
                        <div class="form-group">
                            <label>Nom du salon *</label>
                            <input type="text" name="name" class="form-input" required>
                        </div>
                        <div class="form-group">
                            <label>Type</label>
                            <select name="type" class="form-input">
                                <option value="general">Général</option>
                                <option value="announcement">Annonces</option>
                                <option value="clinical_cases">Cas cliniques</option>
                                <option value="scientific">Scientifique</option>
                                <option value="other">Autre</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Description</label>
                            <textarea name="description" class="form-input" rows="3"></textarea>
                        </div>
                        <button type="submit" class="btn btn-primary btn-block">Créer</button>
                    </form>
                </div>
            </div>`;
            document.body.appendChild(modal);
        }
        this.showModal('createGroupModal');
    },

    async handleCreateGroup() {
        const form = document.getElementById('createGroupForm');
        if (!form) return;
        const name = form.querySelector('[name="name"]').value.trim();
        const type = form.querySelector('[name="type"]').value;
        const description = form.querySelector('[name="description"]').value.trim();
        if (!name) return;

        await this.createGroup(name, type, description);
        this.hideModal('createGroupModal');
        form.reset();
    },

    async approveMember(id) {
        try {
            await this.api('admin.php?action=approve', {
                method: 'POST',
                body: { user_id: id },
            });
            this.showToast('Membre approuvé', 'success');
            this.loadAdminDashboard();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    async rejectMember(id) {
        if (!confirm('Refuser cette demande d\'inscription ?')) return;
        try {
            await this.api('admin.php?action=reject', {
                method: 'POST',
                body: { user_id: id },
            });
            this.showToast('Demande refusée', 'success');
            this.loadAdminDashboard();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    async suspendMember(id) {
        if (!confirm('Suspendre ce membre ?')) return;
        try {
            await this.api('admin.php?action=suspend', {
                method: 'POST',
                body: { user_id: id },
            });
            this.showToast('Membre suspendu', 'success');
            this.loadAdminDashboard();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    async handleReport(id, action) {
        try {
            await this.api('admin.php?action=handle-report', {
                method: 'POST',
                body: { report_id: id, action: action },
            });
            this.showToast('Signalement traité', 'success');
            this.loadAdminDashboard();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    async manageMemberRole(userId, newRole) {
        if (!confirm(`Changer le rôle de ce membre en "${this.getRoleLabel(newRole)}" ?`)) return;
        try {
            await this.api('admin.php?action=change-role', {
                method: 'POST',
                body: { user_id: userId, role: newRole },
            });
            this.showToast('Rôle modifié', 'success');
            this.loadAdminDashboard();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    // =========================================================================
    // NOTIFICATIONS
    // =========================================================================
    async loadNotifications() {
        try {
            const data = await this.api('notifications.php?action=list');
            this.renderNotifications(data?.notifications || []);
        } catch (err) {
            // Silently fail
        }
    },

    renderNotifications(notifs) {
        const container = document.getElementById('notificationsDropdown');
        if (!container) return;

        if (notifs.length === 0) {
            container.innerHTML =
                '<div class="notif-empty"><p>Aucune notification</p></div>';
            return;
        }

        container.innerHTML = notifs
            .map(n => {
                const isUnread = !n.is_read;
                const time = n.created_at
                    ? this.timeAgo(new Date(n.created_at))
                    : '';

                return `<div class="notification-item ${isUnread ? 'unread' : ''}"
                    onclick="App.handleNotificationClick(${n.id}, ${n.group_id || 'null'}, ${n.message_id || 'null'})">
                    <div class="notif-content">
                        <div class="notif-title">${this.escapeHtml(n.title || '')}</div>
                        <div class="notif-body">${this.escapeHtml(n.body || '')}</div>
                        <div class="notif-time">${time}</div>
                    </div>
                    ${isUnread ? '<div class="notif-dot"></div>' : ''}
                </div>`;
            })
            .join('');

        // Add "mark all as read" button
        const hasUnread = notifs.some(n => !n.is_read);
        if (hasUnread) {
            container.insertAdjacentHTML(
                'beforeend',
                '<div class="notif-footer"><button class="btn btn-sm btn-outline" onclick="App.markAllNotificationsRead()">Tout marquer comme lu</button></div>'
            );
        }
    },

    async handleNotificationClick(notifId, groupId, messageId) {
        // Mark as read
        try {
            await this.api('notifications.php?action=read', {
                method: 'POST',
                body: { notification_id: notifId },
            });
        } catch (err) {
            // Continue anyway
        }

        // Navigate
        this.toggleNotifications();
        if (groupId) {
            await this.openGroup(groupId);
            if (messageId) {
                setTimeout(() => this.scrollToMessage(messageId), 500);
            }
        }
    },

    async markAllNotificationsRead() {
        try {
            await this.api('notifications.php?action=read-all', {
                method: 'POST',
            });
            this.loadNotifications();
            this.showToast('Notifications marquées comme lues', 'success');
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    toggleNotifications() {
        const dd = document.getElementById('notificationsDropdown');
        if (!dd) return;

        const isVisible = !dd.classList.contains('hidden');
        if (isVisible) {
            dd.classList.add('hidden');
        } else {
            dd.classList.remove('hidden');
            this.loadNotifications();
        }
    },

    // =========================================================================
    // MODALS
    // =========================================================================
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            // Focus first input
            const firstInput = modal.querySelector(
                'input:not([type="hidden"]):not([type="file"]), textarea, select'
            );
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        }
    },

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    hideAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(m => {
            m.classList.remove('active');
        });
        document.body.style.overflow = '';
    },

    showReportModal(msgId) {
        this.state.reportingMessageId = msgId;
        const reasonSelect = document.getElementById('reportReason');
        const commentArea = document.getElementById('reportComment');
        if (reasonSelect) reasonSelect.value = '';
        if (commentArea) commentArea.value = '';
        this.showModal('reportModal');
    },

    async submitReport() {
        const reason = document.getElementById('reportReason')?.value;
        const comment = document.getElementById('reportComment')?.value || '';

        if (!reason) {
            this.showToast('Veuillez sélectionner un motif', 'error');
            return;
        }

        try {
            await this.api('messages.php?action=report', {
                method: 'POST',
                body: {
                    message_id: this.state.reportingMessageId,
                    reason: reason,
                    comment: comment,
                },
            });
            this.showToast('Message signalé aux administrateurs', 'success');
            this.hideModal('reportModal');
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    showAnonymizationConfirmation(callback) {
        this.state.anonCallback = callback;
        const modal = document.getElementById('anonModal');
        if (modal) {
            // Set up confirm button handler
            const confirmBtn = modal.querySelector('.confirm-anon');
            if (confirmBtn) {
                confirmBtn.onclick = () => this.acceptAnonymization();
            }
            const cancelBtn = modal.querySelector('.cancel-anon');
            if (cancelBtn) {
                cancelBtn.onclick = () => this.hideModal('anonModal');
            }
        }
        this.showModal('anonModal');
    },

    acceptAnonymization() {
        this.state.anonAccepted = true;
        this.hideModal('anonModal');
        if (typeof this.state.anonCallback === 'function') {
            this.state.anonCallback();
            this.state.anonCallback = null;
        }
    },

    // =========================================================================
    // UI HELPERS
    // =========================================================================
    showToast(message, type = 'info') {
        // Remove existing toasts
        document.querySelectorAll('.toast').forEach(t => {
            t.classList.remove('show');
            setTimeout(() => t.remove(), 300);
        });

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
        const icon = icons[type] || icons.info;

        toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-message">${this.escapeHtml(message)}</span>`;
        document.body.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Auto dismiss
        const duration = type === 'error' ? 5000 : 3000;
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    updateUserUI() {
        if (!this.state.user) return;

        // Update topbar user button/avatar
        const userBtn = document.getElementById('userMenuBtn');
        if (userBtn) {
            const initials = (
                (this.state.user.first_name?.[0] || '') +
                (this.state.user.last_name?.[0] || '')
            ).toUpperCase();

            if (this.state.user.profile_photo) {
                userBtn.innerHTML = `<img src="/connect/${this.escapeHtml(this.state.user.profile_photo)}" alt="${initials}" class="topbar-avatar">`;
            } else {
                userBtn.textContent = initials;
            }
        }

        // Update user name display
        const userNameEl = document.getElementById('userName');
        if (userNameEl) {
            userNameEl.textContent = (this.state.user.first_name || '') + ' ' + (this.state.user.last_name || '');
        }

        // Show/hide admin link
        const adminLink = document.getElementById('adminLink');
        if (adminLink) {
            adminLink.classList.toggle('hidden', !this.isAdmin());
        }

        // Show/hide admin tab on mobile
        const adminTab = document.querySelector('.mobile-tab[data-view="admin"]');
        if (adminTab) {
            adminTab.classList.toggle('hidden', !this.isAdmin());
        }
    },

    goBack() {
        if (this.state.isMobile) {
            document.getElementById('sidebar')?.classList.remove('hidden');
            document.getElementById('mainContent')?.classList.add('hidden');
        }
    },

    showLoading(container) {
        if (typeof container === 'string') {
            container = document.getElementById(container);
        }
        if (container) {
            container.innerHTML =
                '<div class="loading-spinner"><div class="spinner"></div></div>';
        }
    },

    hideLoading(container) {
        if (typeof container === 'string') {
            container = document.getElementById(container);
        }
        if (container) {
            const spinner = container.querySelector('.loading-spinner');
            if (spinner) spinner.remove();
        }
    },

    // =========================================================================
    // UTILITIES
    // =========================================================================
    escapeHtml(str) {
        if (str === null || str === undefined) return '';
        const s = String(str);
        const div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    },

    linkify(text) {
        if (!text) return '';
        // URLs
        text = text.replace(
            /(https?:\/\/[^\s<>"']+)/g,
            '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
        );
        // Email addresses
        text = text.replace(
            /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
            '<a href="mailto:$1">$1</a>'
        );
        // Newlines to <br>
        text = text.replace(/\n/g, '<br>');
        return text;
    },

    formatTime(date) {
        if (!(date instanceof Date) || isNaN(date.getTime())) return '';
        return date.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
        });
    },

    formatDate(date) {
        if (!(date instanceof Date) || isNaN(date.getTime())) return '';
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return "Aujourd'hui";
        }
        if (date.toDateString() === yesterday.toDateString()) {
            return 'Hier';
        }
        return date.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
        });
    },

    formatDateTime(date) {
        if (!(date instanceof Date) || isNaN(date.getTime())) return '';
        return (
            this.formatDate(date) +
            ' à ' +
            this.formatTime(date)
        );
    },

    timeAgo(date) {
        if (!(date instanceof Date) || isNaN(date.getTime())) return '';
        const seconds = Math.floor((new Date() - date) / 1000);

        if (seconds < 30) return "à l'instant";
        if (seconds < 60) return `il y a ${seconds}s`;

        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `il y a ${minutes} min`;

        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `il y a ${hours}h`;

        const days = Math.floor(hours / 24);
        if (days === 1) return 'hier';
        if (days < 7) return `il y a ${days}j`;

        const weeks = Math.floor(days / 7);
        if (weeks < 4) return `il y a ${weeks} sem.`;

        return this.formatDate(date);
    },

    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 o';
        const sizes = ['o', 'Ko', 'Mo', 'Go', 'To'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        const val = bytes / Math.pow(1024, i);
        return (i === 0 ? val : val.toFixed(1)) + ' ' + sizes[i];
    },

    getFileIcon(mimeType) {
        if (!mimeType) return '📄';
        const type = mimeType.toLowerCase();
        if (type.includes('pdf')) return '📕';
        if (type.includes('word') || type.includes('document') || type.includes('docx') || type.includes('doc')) return '📘';
        if (type.includes('presentation') || type.includes('powerpoint') || type.includes('pptx') || type.includes('ppt')) return '📙';
        if (type.includes('spreadsheet') || type.includes('excel') || type.includes('xlsx') || type.includes('xls') || type.includes('csv')) return '📗';
        if (type.includes('image') || type.includes('png') || type.includes('jpg') || type.includes('jpeg') || type.includes('gif')) return '🖼';
        if (type.includes('video') || type.includes('mp4') || type.includes('avi') || type.includes('mov')) return '🎬';
        if (type.includes('audio') || type.includes('mp3') || type.includes('wav')) return '🎵';
        if (type.includes('zip') || type.includes('rar') || type.includes('tar') || type.includes('compressed') || type.includes('archive')) return '📦';
        if (type.includes('text') || type.includes('txt')) return '📝';
        if (type.includes('html') || type.includes('css') || type.includes('javascript') || type.includes('json')) return '💻';
        return '📄';
    },

    truncate(str, maxLength) {
        if (!str) return '';
        if (str.length <= maxLength) return str;
        return str.substring(0, maxLength) + '...';
    },

    debounce(fn, ms) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), ms);
        };
    },

    throttle(fn, ms) {
        let lastCall = 0;
        return (...args) => {
            const now = Date.now();
            if (now - lastCall >= ms) {
                lastCall = now;
                fn.apply(this, args);
            }
        };
    },

    generateTempId() {
        return 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                this.showToast('Copié dans le presse-papier', 'success');
            }).catch(() => {
                this.fallbackCopyToClipboard(text);
            });
        } else {
            this.fallbackCopyToClipboard(text);
        }
    },

    fallbackCopyToClipboard(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            this.showToast('Copié dans le presse-papier', 'success');
        } catch (err) {
            this.showToast('Impossible de copier', 'error');
        }
        textarea.remove();
    },

    // =========================================================================
    // PWA / SERVICE WORKER
    // =========================================================================
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker
                .register('/connect/sw.js')
                .then(registration => {
                    // Check for updates periodically
                    setInterval(() => {
                        registration.update();
                    }, 60 * 60 * 1000); // Every hour
                })
                .catch(err => {
                    // Service worker registration failed - not critical
                });
        }
    },

    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            // Don't request immediately, wait for user interaction
            const requestOnInteraction = () => {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        this.subscribeToPushNotifications();
                    }
                });
                document.removeEventListener('click', requestOnInteraction);
            };
            // Request after first user interaction with the app
            setTimeout(() => {
                document.addEventListener('click', requestOnInteraction, { once: true });
            }, 5000);
        } else if ('Notification' in window && Notification.permission === 'granted') {
            this.subscribeToPushNotifications();
        }
    },

    async subscribeToPushNotifications() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(
                    // This would be the VAPID public key from the server
                    document.querySelector('meta[name="vapid-key"]')?.content || ''
                ),
            });

            // Send subscription to server
            await this.api('notifications.php?action=subscribe', {
                method: 'POST',
                body: { subscription: JSON.stringify(subscription) },
            });
        } catch (err) {
            // Push subscription failed - not critical
        }
    },

    urlBase64ToUint8Array(base64String) {
        if (!base64String) return new Uint8Array(0);
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    },
};

// =========================================================================
// Initialize on DOM ready
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Handle PWA install prompt
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
        installBtn.classList.remove('hidden');
        installBtn.addEventListener('click', () => {
            e.prompt();
            e.userChoice.then(choice => {
                if (choice.outcome === 'accepted') {
                    installBtn.classList.add('hidden');
                }
            });
        });
    }
});

// Handle network status
window.addEventListener('online', () => {
    App.showToast('Connexion rétablie', 'success');
    if (App.state.user && App.state.user.role !== 'pending') {
        App.startPolling();
    }
});

window.addEventListener('offline', () => {
    App.showToast('Connexion perdue', 'warning');
    App.stopPolling();
});
