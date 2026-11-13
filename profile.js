// МОДУЛЬ 6: Профиль игрока, регистрация с паролем, вход и распределённый реестр аккаунтов

const ProfileSystem = {
    STORAGE_KEY: 'gpu_tycoon_profile_v2',
    REGISTRY_KEY: 'gpu_tycoon_accounts_registry_v1',

    user: null, // Текущий авторизованный аккаунт
    accountsRegistry: {}, // Распределённый реестр ников: { nickLower: { nickname, passwordHash, avatar, regDate, money, reputation } }
    authMode: 'register', // 'register' или 'login'

    AVATARS: ["🧑‍💻", "👨‍🔬", "🤖", "🦊", "👑", "🚀"],
    selectedAvatar: "🧑‍💻",

    init() {
        this.loadFromStorage();
        this.updateHeaderButton();
        this.bindEvents();
    },

    loadFromStorage() {
        try {
            const rawReg = localStorage.getItem(this.REGISTRY_KEY);
            if (rawReg) {
                this.accountsRegistry = JSON.parse(rawReg);
            }

            const rawUser = localStorage.getItem(this.STORAGE_KEY);
            if (rawUser) {
                this.user = JSON.parse(rawUser);
            }
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

    // Простой и надёжный хэш пароля (чтобы не хранить пароль в открытом виде)
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

    // Объединение локального реестра аккаунтов с реестром из P2P-сети
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

        if (updated) {
            this.saveToStorage();
        }
    },

    // Обновление прогресса текущего игрока в реестре (вызывается при релизах)
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
                this.renderModal();
                profileModal.classList.remove('hidden');
            });
        }

        if (closeProfileBtn) {
            closeProfileBtn.addEventListener('click', () => profileModal.classList.add('hidden'));
        }

        if (profileModal) {
            profileModal.addEventListener('click', (e) => {
                if (e.target === profileModal) profileModal.classList.add('hidden');
            });
        }
    },

    // Проверка, занят ли никнейм в реестре или среди онлайн-игроков
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

    // Регистрация нового аккаунта
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
            addLog(`⛔ Никнейм <strong>${cleanNick}</strong> уже занят другим игроком! Выберите другой или нажмите «Войти».`, true);
            return;
        }

        const now = new Date();
        const regDate = now.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        const passHash = this.hashPassword(cleanNick, cleanPass);
        const nickKey = cleanNick.toLowerCase();

        const accountRecord = {
            nickname: cleanNick,
            passwordHash: passHash,
            avatar: this.selectedAvatar,
            regDate: regDate,
            money: money,
            reputation: reputation,
            updatedAt: Date.now()
        };

        this.accountsRegistry[nickKey] = accountRecord;
        this.user = {
            nickname: cleanNick,
            avatar: this.selectedAvatar,
            regDate: regDate,
            friends: []
        };

        this.saveToStorage();
        this.updateHeaderButton();
        this.renderModal();

        // Рассылаем новый аккаунт в P2P-сеть, чтобы другие игроки знали, что ник занят
        if (typeof P2PNetwork !== 'undefined') {
            P2PNetwork.broadcastState('sync');
        }

        addLog(`👤 Зарегистрирован уникальный профиль: <strong>${this.user.avatar} ${this.user.nickname}</strong> (Дата: ${regDate}).`);
    },

    // Вход в существующий аккаунт по нику и паролю
    login(nickname, password) {
        const cleanNick = nickname.trim();
        const cleanPass = password.trim();
        const nickKey = cleanNick.toLowerCase();

        const record = this.accountsRegistry[nickKey];
        if (!record) {
            addLog(`⛔ Аккаунт <strong>${cleanNick}</strong> не найден в базе! Проверьте ник или зарегистрируйтесь.`, true);
            return;
        }

        const inputHash = this.hashPassword(cleanNick, cleanPass);
        if (inputHash !== record.passwordHash) {
            addLog(`⛔ Неверный пароль для аккаунта <strong>${record.nickname}</strong>!`, true);
            return;
        }

        this.user = {
            nickname: record.nickname,
            avatar: record.avatar || "🧑‍💻",
            regDate: record.regDate || "01.01.2026",
            friends: this.user?.friends || []
        };

        // Восстанавливаем капитал и репутацию аккаунта, если они сохранились в реестре
        if (typeof record.money === 'number' && record.money > 0) {
            money = record.money;
            if (moneyEl) moneyEl.textContent = `$${money.toLocaleString()}`;
        }
        if (typeof record.reputation === 'number') {
            reputation = record.reputation;
            if (repEl) repEl.textContent = reputation;
        }

        this.saveToStorage();
        this.updateHeaderButton();
        this.renderModal();

        if (typeof P2PNetwork !== 'undefined') {
            P2PNetwork.broadcastState('sync');
        }

        addLog(`🔓 Выполнен вход в профиль <strong>${this.user.avatar} ${this.user.nickname}</strong>!`);
    },
    // Добавление друга по нику
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

    // Выход из аккаунта (сам аккаунт остаётся в реестре, в него можно войти снова по паролю)
    logout() {
        this.user = null;
        this.authMode = 'login';
        this.saveToStorage();
        this.updateHeaderButton();
        this.renderModal();
        addLog("🔒 Вы вышли из аккаунта.");
    },

    renderModal() {
        const container = document.getElementById('profile-body');
        if (!container) return;

        // 1. Если игрок не вошёл — показываем вкладки "Регистрация" и "Войти"
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
                            ? 'Никнейм закрепляется за вами в P2P-сети. Запомните пароль, чтобы входить с любого устройства!'
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

        // 2. Если игрок авторизован — показываем карточку профиля и друзей с живым статусом из сети
        let friendsHtml = '';
        if (this.user.friends.length === 0) {
            friendsHtml = `<p class="empty-stock">Список друзей пока пуст. Добавьте друга по нику выше!</p>`;
        } else {
            this.user.friends.forEach((fr, idx) => {
                // Проверяем, есть ли друг сейчас в P2P-сети
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
