// МОДУЛЬ 6: Профиль игрока, вход/регистрация + надёжное автосохранение всего прогресса

const ProfileSystem = {
    STORAGE_KEY: 'gpu_tycoon_profile_v2',
    REGISTRY_KEY: 'gpu_tycoon_accounts_registry_v1',
    GAMESTATE_KEY: 'gpu_tycoon_saved_progress_v3',

    user: null,
    accountsRegistry: {},
    authMode: 'register',
    isPasswordVisible: false,

    AVATARS: ["🧑‍💻", "👨‍🔬", "🤖", "🦊", "👑", "🚀"],
    selectedAvatar: "🧑‍💻",

    init() {
        this.loadFromStorage();
        this.loadGameProgress();
        this.updateHeaderButton();
        this.bindEvents();

        // Автосохранение ровно каждую 1 минуту (60 000 мс)
        setInterval(() => this.saveGameProgress(), 60000);

        // Сохранение при сворачивании вкладки / переключении приложения на телефоне
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') this.saveGameProgress();
        });

        // Сохранение при закрытии или обновлении страницы
        window.addEventListener('pagehide', () => this.saveGameProgress());
        window.addEventListener('beforeunload', () => this.saveGameProgress());
    },

    // Сохранение полного прогресса игры (деньги, репутация, год, технологии, заводы, рынок)
    saveGameProgress() {
        try {
            const customChips = {};
            if (typeof PART_CATALOG !== 'undefined') {
                for (const [key, spec] of Object.entries(PART_CATALOG)) {
                    if (key.startsWith('custom_part_')) customChips[key] = spec;
                }
            }

            const playerComp = (typeof MarketSystem !== 'undefined')
                ? MarketSystem.competitors.find(c => c.id === 'player')
                : null;

            const state = {
                money: money,
                reputation: reputation,
                year: year,
                unlockedParts: Array.from(unlockedParts),
                customChips: customChips,
                factories: (typeof FactorySystem !== 'undefined') ? {
                    discountLevel: FactorySystem.discountFactoryLevel,
                    prodLevel: FactorySystem.productionFactoryLevel,
                    selectedPart: FactorySystem.selectedPartToProduce,
                    progress: FactorySystem.productionProgress,
                    inventory: FactorySystem.inventory
                } : null,
                playerMarket: playerComp ? {
                    share: playerComp.share,
                    flagship: playerComp.flagship,
                    power: playerComp.power
                } : null
            };

            localStorage.setItem(this.GAMESTATE_KEY, JSON.stringify(state));
            this.syncMyProgressToRegistry();
        } catch (e) {
            console.warn("Ошибка сохранения прогресса:", e);
        }
    },

    // Восстановление полного прогресса при входе или обновлении страницы
    loadGameProgress() {
        try {
            const raw = localStorage.getItem(this.GAMESTATE_KEY);
            if (!raw) return;

            const state = JSON.parse(raw);
            if (!state) return;

            if (typeof state.money === 'number') money = state.money;
            if (typeof state.reputation === 'number') reputation = state.reputation;
            if (typeof state.year === 'number' && state.year > year) year = state.year;

            if (state.customChips) {
                for (const [key, spec] of Object.entries(state.customChips)) {
                    PART_CATALOG[key] = spec;
                }
            }

            if (Array.isArray(state.unlockedParts)) {
                unlockedParts.clear();
                state.unlockedParts.forEach(k => {
                    if (PART_CATALOG[k]) unlockedParts.add(k);
                });
            }

            if (state.factories && typeof FactorySystem !== 'undefined') {
                FactorySystem.discountFactoryLevel = state.factories.discountLevel || 0;
                FactorySystem.productionFactoryLevel = state.factories.prodLevel || 0;
                FactorySystem.selectedPartToProduce = state.factories.selectedPart || 'vram';
                FactorySystem.productionProgress = state.factories.progress || 0;
                FactorySystem.inventory = state.factories.inventory || {};
                FactorySystem.updateBadge();
            }

            if (state.playerMarket) {
                const playerComp = MarketSystem.competitors.find(c => c.id === 'player');
                if (playerComp) {
                    playerComp.share = state.playerMarket.share || 1;
                    playerComp.flagship = state.playerMarket.flagship || "Нет релизов";
                    playerComp.power = state.playerMarket.power || 0;
                }
            }

            if (moneyEl) moneyEl.textContent = `$${money.toLocaleString()}`;
            if (repEl) repEl.textContent = reputation;
            if (yearEl) yearEl.textContent = year;
            if (myShareBadge) myShareBadge.textContent = `${MarketSystem.getPlayerShare()}%`;

            buildToolbar();
            onCircuitChanged();
        } catch (e) {
            console.warn("Ошибка загрузки прогресса:", e);
        }
    },
    loadFromStorage() {
        try {
            const rawReg = localStorage.getItem(this.REGISTRY_KEY);
            if (rawReg) this.accountsRegistry = JSON.parse(rawReg);

            const rawUser = localStorage.getItem(this.STORAGE_KEY);
            if (rawUser) this.user = JSON.parse(rawUser);
        } catch (e) {
            console.warn("Ошибка загрузки профиля:", e);
        }
    },

    saveToStorage() {
        try {
            localStorage.setItem(this.REGISTRY_KEY, JSON.stringify(this.accountsRegistry));
            if (this.user) {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.user));
            } else {
                localStorage.removeItem(this.STORAGE_KEY);
            }
        } catch (e) {
            console.warn("Ошибка сохранения профиля:", e);
        }
    },

    hashPassword(nick, password) {
        const str = `${nick.toLowerCase().trim()}::salt_gpu_tycoon::${password}`;
        let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
        for (let i = 0; i < str.length; i++) {
            const ch = str.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 2654435761);
            h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
    },

    mergeRegistry(remoteRegistry) {
        if (!remoteRegistry || typeof remoteRegistry !== 'object') return;
        let updated = false;

        for (const [nickKey, acc] of Object.entries(remoteRegistry)) {
            if (!acc || !acc.nickname || !acc.passwordHash) continue;

            if (!this.accountsRegistry[nickKey]) {
                this.accountsRegistry[nickKey] = acc;
                updated = true;
            } else if ((acc.updatedAt || 0) > (this.accountsRegistry[nickKey].updatedAt || 0)) {
                this.accountsRegistry[nickKey] = acc;
                updated = true;
            }
        }

        if (updated) this.saveToStorage();
    },

    syncMyProgressToRegistry() {
        if (!this.user) return;
        const key = this.user.nickname.toLowerCase();
        if (this.accountsRegistry[key]) {
            this.accountsRegistry[key].money = money;
            this.accountsRegistry[key].reputation = reputation;
            this.accountsRegistry[key].updatedAt = Date.now();
            this.saveToStorage();
        }
    },

    updateHeaderButton() {
        const badge = document.getElementById('profile-btn-label');
        if (!badge) return;
        badge.textContent = this.user ? `${this.user.avatar} ${this.user.nickname}` : "👤 Войти / Рег.";
    },

    bindEvents() {
        const profileBtn = document.getElementById('profile-btn');
        const profileModal = document.getElementById('profile-modal');
        const closeProfileBtn = document.getElementById('close-profile-btn');

        if (profileBtn) {
            profileBtn.addEventListener('click', () => {
                this.isPasswordVisible = false;
                this.renderModal();
                profileModal.classList.remove('hidden');
            });
        }

        if (closeProfileBtn) {
            closeProfileBtn.addEventListener('click', () => {
                this.isPasswordVisible = false;
                profileModal.classList.add('hidden');
            });
        }

        if (profileModal) {
            profileModal.addEventListener('click', (e) => {
                if (e.target === profileModal) {
                    this.isPasswordVisible = false;
                    profileModal.classList.add('hidden');
                }
            });
        }
    },

    isNicknameTaken(nickname) {
        const key = nickname.trim().toLowerCase();
        if (this.accountsRegistry[key]) return true;

        if (typeof P2PNetwork !== 'undefined' && P2PNetwork.peers) {
            const onlineMatch = Object.values(P2PNetwork.peers).some(
                p => p.nickname && p.nickname.trim().toLowerCase() === key
            );
            if (onlineMatch) return true;
        }
        return false;
    },

    register(nickname, password) {
        const cleanNick = nickname.trim();
        const cleanPass = password.trim();

        if (cleanNick.length < 3) {
            addLog("⚠️ Никнейм должен содержать минимум 3 символа!", true);
            return;
        }
        if (cleanPass.length < 4) {
            addLog("⚠️ Пароль должен содержать минимум 4 символа!", true);
            return;
        }
        if (this.isNicknameTaken(cleanNick)) {
            addLog(`⛔ Никнейм <strong>${cleanNick}</strong> уже занят другим игроком!`, true);
            return;
        }

        const now = new Date();
        const regDate = now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const passHash = this.hashPassword(cleanNick, cleanPass);
        const nickKey = cleanNick.toLowerCase();

        this.accountsRegistry[nickKey] = {
            nickname: cleanNick,
            passwordHash: passHash,
            avatar: this.selectedAvatar,
            regDate: regDate,
            money: money,
            reputation: reputation,
            updatedAt: Date.now()
        };

        this.user = {
            nickname: cleanNick,
            avatar: this.selectedAvatar,
            regDate: regDate,
            savedPassword: cleanPass,
            friends: []
        };

        this.isPasswordVisible = false;
        this.saveToStorage();
        this.saveGameProgress();
        this.updateHeaderButton();
        this.renderModal();

        if (typeof P2PNetwork !== 'undefined') P2PNetwork.broadcastState('sync');
        addLog(`👤 Зарегистрирован уникальный профиль: <strong>${this.user.avatar} ${this.user.nickname}</strong>.`);
    },

    login(nickname, password) {
        const cleanNick = nickname.trim();
        const cleanPass = password.trim();
        const nickKey = cleanNick.toLowerCase();

        const record = this.accountsRegistry[nickKey];
        if (!record) {
            addLog(`⛔ Аккаунт <strong>${cleanNick}</strong> не найден в базе!`, true);
            return;
        }

        if (this.hashPassword(cleanNick, cleanPass) !== record.passwordHash) {
            addLog(`⛔ Неверный пароль для аккаунта <strong>${record.nickname}</strong>!`, true);
            return;
        }

        this.user = {
            nickname: record.nickname,
            avatar: record.avatar || "🧑‍💻",
            regDate: record.regDate || "14.11.2026",
            savedPassword: cleanPass,
            friends: this.user?.friends || []
        };

        if (typeof record.money === 'number' && record.money > 0) {
            money = record.money;
            if (moneyEl) moneyEl.textContent = `$${money.toLocaleString()}`;
        }
        if (typeof record.reputation === 'number') {
            reputation = record.reputation;
            if (repEl) repEl.textContent = reputation;
        }

        this.isPasswordVisible = false;
        this.saveToStorage();
        this.saveGameProgress();
        this.updateHeaderButton();
        this.renderModal();

        if (typeof P2PNetwork !== 'undefined') P2PNetwork.broadcastState('sync');
        addLog(`🔓 Выполнен вход в профиль <strong>${this.user.avatar} ${this.user.nickname}</strong>!`);
    },

    addFriend(friendNick) {
        if (!this.user) return;
        const cleanName = friendNick.trim();
        if (cleanName.length < 2) return;

        if (cleanName.toLowerCase() === this.user.nickname.toLowerCase()) {
            addLog("⚠️ Нельзя добавить самого себя в друзья!", true);
            return;
        }

        const exists = this.user.friends.some(f => f.nickname.toLowerCase() === cleanName.toLowerCase());
        if (exists) {
            addLog(`⚠️ Игрок <strong>${cleanName}</strong> уже есть в списке друзей!`, true);
            return;
        }

        const nickKey = cleanName.toLowerCase();
        const regData = this.accountsRegistry[nickKey];

        this.user.friends.push({
            nickname: regData ? regData.nickname : cleanName,
            avatar: regData ? regData.avatar : "🧑‍💻",
            status: "Офлайн",
            money: regData ? regData.money : 4000
        });

        this.saveToStorage();
        this.renderModal();
        addLog(`🤝 Игрок <strong>${cleanName}</strong> добавлен в ваш список друзей!`);
    },

    removeFriend(index) {
        if (!this.user) return;
        this.user.friends.splice(index, 1);
        this.saveToStorage();
        this.renderModal();
    },

    logout() {
        this.user = null;
        this.authMode = 'login';
        this.isPasswordVisible = false;
        this.saveToStorage();
        this.updateHeaderButton();
        this.renderModal();
        addLog("🔒 Вы вышли из аккаунта.");
    },
    renderModal() {
        const container = document.getElementById('profile-body');
        if (!container) return;

        // 1. Окно регистрации / входа
        if (!this.user) {
            const isReg = (this.authMode === 'register');

            let avatarsHtml = '';
            if (isReg) {
                this.AVATARS.forEach(av => {
                    const active = (av === this.selectedAvatar) ? 'active' : '';
                    avatarsHtml += `<button type="button" class="avatar-pick-btn ${active}" data-av="${av}">${av}</button>`;
                });
            }

            container.innerHTML = `
                <div class="auth-tabs" style="display:flex; gap:8px; margin-bottom:14px;">
                    <button type="button" id="tab-reg-btn" class="size-btn ${isReg ? 'active' : ''}">📝 Регистрация</button>
                    <button type="button" id="tab-login-btn" class="size-btn ${!isReg ? 'active' : ''}">🔑 Войти</button>
                </div>

                <div class="reg-box">
                    <h3>${isReg ? 'Создание уникального аккаунта' : 'Вход в существующий профиль'}</h3>
                    <p class="reg-sub">
                        ${isReg
                            ? 'Никнейм закрепляется за вами в P2P-сети. Вы всегда сможете подсмотреть свой пароль в профиле по кнопке.'
                            : 'Введите ваш никнейм и пароль для восстановления профиля и баланса.'}
                    </p>

                    ${isReg ? `
                        <label class="reg-label">Выберите аватар:</label>
                        <div class="avatar-picker">${avatarsHtml}</div>
                    ` : ''}

                    <label class="reg-label">Уникальный никнейм:</label>
                    <input type="text" id="auth-nick-input" class="reg-input" maxlength="16" placeholder="Например: SiliconMaster">

                    <label class="reg-label" style="margin-top:10px;">Пароль:</label>
                    <input type="password" id="auth-pass-input" class="reg-input" maxlength="32" placeholder="Минимум 4 символа">

                    <button id="auth-submit-btn" class="primary-btn" style="width:100%; margin-top:14px;">
                        ${isReg ? 'Зарегистрироваться' : 'Войти в аккаунт'}
                    </button>
                </div>
            `;

            document.getElementById('tab-reg-btn')?.addEventListener('click', () => {
                this.authMode = 'register';
                this.renderModal();
            });

            document.getElementById('tab-login-btn')?.addEventListener('click', () => {
                this.authMode = 'login';
                this.renderModal();
            });

            container.querySelectorAll('.avatar-pick-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.selectedAvatar = btn.dataset.av;
                    this.renderModal();
                });
            });

            const submitBtn = document.getElementById('auth-submit-btn');
            const nickInput = document.getElementById('auth-nick-input');
            const passInput = document.getElementById('auth-pass-input');

            const handleAuth = () => {
                if (isReg) {
                    this.register(nickInput.value, passInput.value);
                } else {
                    this.login(nickInput.value, passInput.value);
                }
            };

            if (submitBtn) submitBtn.addEventListener('click', handleAuth);
            if (passInput) {
                passInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') handleAuth();
                });
            }
            return;
        }

        // 2. Карточка авторизованного профиля с защищённым показом пароля
        const rawPass = this.user.savedPassword || '••••••••';
        const maskedPass = '•'.repeat(Math.max(6, rawPass.length));
        const shownPasswordText = this.isPasswordVisible ? rawPass : maskedPass;
        const toggleBtnLabel = this.isPasswordVisible ? '🙈 Скрыть' : '👁 Показать';

        let friendsHtml = '';
        if (this.user.friends.length === 0) {
            friendsHtml = `<p class="empty-stock">Список друзей пока пуст. Добавьте друга по нику выше!</p>`;
        } else {
            this.user.friends.forEach((fr, idx) => {
                let livePeer = null;
                if (typeof P2PNetwork !== 'undefined' && P2PNetwork.peers) {
                    livePeer = Object.values(P2PNetwork.peers).find(
                        p => p.nickname && p.nickname.toLowerCase() === fr.nickname.toLowerCase()
                    );
                }

                const regInfo = this.accountsRegistry[fr.nickname.toLowerCase()];
                const isOnline = Boolean(livePeer);
                const statusText = isOnline ? `Онлайн (${year} г.)` : 'Офлайн';
                const displayMoney = livePeer ? livePeer.money : (regInfo ? regInfo.money : fr.money);

                friendsHtml += `
                    <div class="friend-row">
                        <div class="friend-left">
                            <span class="friend-avatar">${fr.avatar}</span>
                            <div>
                                <div class="friend-name">
                                    ${fr.nickname}
                                    <span class="status-dot ${isOnline ? 'online' : 'offline'}"></span>
                                </div>
                                <div class="friend-status">${statusText} • Баланс: $${(displayMoney || 0).toLocaleString()}</div>
                            </div>
                        </div>
                        <button class="remove-friend-btn" data-idx="${idx}" title="Удалить из друзей">✖</button>
                    </div>
                `;
            });
        }

        container.innerHTML = `
            <div class="profile-card">
                <div class="profile-main-info">
                    <div class="profile-big-avatar">${this.user.avatar}</div>
                    <div>
                        <div class="profile-nick">${this.user.nickname}</div>
                        <div class="profile-meta">📅 Дата регистрации: <strong>${this.user.regDate}</strong></div>
                        <div class="profile-meta">💰 Текущий бюджет: <strong style="color:#4ade80">$${money.toLocaleString()}</strong></div>
                        <div class="profile-meta">🏆 Репутация: <strong style="color:#facc15">${reputation} ★</strong> • Год: <strong>${year}</strong></div>
                        <div class="profile-meta" style="margin-top:6px; display:flex; align-items:center; gap:8px;">
                            <span>🔑 Пароль: <strong style="color:#e2e8f0; letter-spacing:1px;">${shownPasswordText}</strong></span>
                            <button type="button" id="toggle-pass-view-btn" style="padding:3px 8px; font-size:11px; background:#1e293b; color:#93c5fd; border:1px solid #475569; border-radius:5px; cursor:pointer;">
                                ${toggleBtnLabel}
                            </button>
                        </div>
                    </div>
                </div>
                <button id="profile-logout-btn" class="logout-btn">Выйти</button>
            </div>

            <div class="friends-section">
                <h3>👥 Друзья (${this.user.friends.length})</h3>
                <div class="add-friend-bar">
                    <input type="text" id="add-friend-input" placeholder="Введите ник друга..." maxlength="16">
                    <button id="add-friend-btn" class="add-friend-btn">+ Добавить</button>
                </div>
                <div class="friends-list">${friendsHtml}</div>
            </div>
        `;

        document.getElementById('toggle-pass-view-btn')?.addEventListener('click', () => {
            this.isPasswordVisible = !this.isPasswordVisible;
            this.renderModal();
        });

        const addFriendBtn = document.getElementById('add-friend-btn');
        const addFriendInput = document.getElementById('add-friend-input');
        if (addFriendBtn && addFriendInput) {
            addFriendBtn.addEventListener('click', () => this.addFriend(addFriendInput.value));
            addFriendInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.addFriend(addFriendInput.value);
            });
        }

        container.querySelectorAll('.remove-friend-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.removeFriend(Number(btn.dataset.idx));
            });
        });

        const logoutBtn = document.getElementById('profile-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
    }
};

window.addEventListener('DOMContentLoaded', () => {
    ProfileSystem.init();
});
