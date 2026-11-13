// МОДУЛЬ 9: Автосохранение и восстановление полного прогресса корпорации

const SaveSystem = {
    SAVE_KEY: 'gpu_tycoon_full_gamestate_v1',

    saveGame() {
        try {
            // Собираем только пользовательские чипы из Chip Fab
            const customChips = {};
            for (const [key, spec] of Object.entries(PART_CATALOG)) {
                if (key.startsWith('custom_part_')) {
                    customChips[key] = spec;
                }
            }

            const playerComp = MarketSystem.competitors.find(c => c.id === 'player');

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

            // Дублируем прогресс в реестр аккаунтов профиля
            if (typeof ProfileSystem !== 'undefined') {
                ProfileSystem.syncMyProgressToRegistry();
            }
        } catch (e) {
            console.warn("Ошибка автосохранения:", e);
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

            // Восстанавливаем кастомные чипы из Chip Fab
            if (state.customChips) {
                for (const [key, spec] of Object.entries(state.customChips)) {
                    PART_CATALOG[key] = spec;
                }
            }

            // Восстанавливаем изученные технологии
            if (Array.isArray(state.unlockedParts)) {
                unlockedParts.clear();
                state.unlockedParts.forEach(k => {
                    if (PART_CATALOG[k]) unlockedParts.add(k);
                });
            }

            // Восстанавливаем заводы и склад
            if (state.factories && typeof FactorySystem !== 'undefined') {
                FactorySystem.discountFactoryLevel = state.factories.discountLevel || 0;
                FactorySystem.productionFactoryLevel = state.factories.prodLevel || 0;
                FactorySystem.selectedPartToProduce = state.factories.selectedPart || 'vram';
                FactorySystem.productionProgress = state.factories.progress || 0;
                FactorySystem.inventory = state.factories.inventory || {};
                FactorySystem.updateBadge();
            }

            // Восстанавливаем твой флагман и долю рынка
            if (state.playerMarket) {
                const playerComp = MarketSystem.competitors.find(c => c.id === 'player');
                if (playerComp) {
                    playerComp.share = state.playerMarket.share || 1;
                    playerComp.flagship = state.playerMarket.flagship || "Нет релизов";
                    playerComp.power = state.playerMarket.power || 0;
                }
            }

            // Обновляем весь интерфейс на экране
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

// Автоматически сохраняем прогресс каждые 5 секунд и перед закрытием/обновлением вкладки
window.addEventListener('beforeunload', () => {
    SaveSystem.saveGame();
});

setInterval(() => {
    SaveSystem.saveGame();
}, 5000);
