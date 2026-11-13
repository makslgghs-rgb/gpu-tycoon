// МОДУЛЬ 9: Надёжное автосохранение (каждую 1 минуту, при сворачивании/закрытии и после действий)

const SaveSystem = {
    SAVE_KEY: 'gpu_tycoon_full_gamestate_v2',

    saveGame() {
        try {
            const customChips = {};
            if (typeof PART_CATALOG !== 'undefined') {
                for (const [key, spec] of Object.entries(PART_CATALOG)) {
                    if (key.startsWith('custom_part_')) {
                        customChips[key] = spec;
                    }
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
                } : null,
                savedAt: Date.now()
            };

            localStorage.setItem(this.SAVE_KEY, JSON.stringify(state));

            if (typeof ProfileSystem !== 'undefined') {
                ProfileSystem.syncMyProgressToRegistry();
            }
        } catch (e) {
            console.warn("Ошибка сохранения:", e);
        }
    },

    loadGame() {
        try {
            const raw = localStorage.getItem(this.SAVE_KEY);
            if (!raw) return false;

            const state = JSON.parse(raw);
            if (!state) return false;

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
            return true;
        } catch (e) {
            console.warn("Ошибка загрузки сохранения:", e);
            return false;
        }
    },

    clearSave() {
        localStorage.removeItem(this.SAVE_KEY);
    }
};

// 1. Автосохранение ровно каждую 1 минуту (60 000 мс)
setInterval(() => {
    SaveSystem.saveGame();
}, 60000);

// 2. Сохранение при сворачивании вкладки / переключении приложения на телефоне
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        SaveSystem.saveGame();
    }
});

// 3. Сохранение при закрытии или обновлении страницы (для ПК и мобильных браузеров)
window.addEventListener('pagehide', () => {
    SaveSystem.saveGame();
});

window.addEventListener('beforeunload', () => {
    SaveSystem.saveGame();
});

// Автоматическая загрузка сохранения сразу после инициализации всех скриптов
window.addEventListener('DOMContentLoaded', () => {
    SaveSystem.loadGame();
});
