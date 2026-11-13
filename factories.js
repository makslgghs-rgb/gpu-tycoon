// МОДУЛЬ 5: Система заводов (Снижение себестоимости и производство с учетом сложности/цены детали)

const FactorySystem = {
    discountFactoryLevel: 0,
    productionFactoryLevel: 0,
    selectedPartToProduce: 'vram',
    productionProgress: 0, // Накопленный прогресс производства в единицах деталей (например, 0.4 = 40% от 1 детали)

    inventory: {},

    MAX_DISCOUNT_LEVEL: 5,
    MAX_PROD_LEVEL: 5,

    DISCOUNT_LEVELS: [
        { level: 1, cost: 6000,   discount: 10, desc: "Автоматизированная пайка SMD (-10% к цене всех деталей)" },
        { level: 2, cost: 18000,  discount: 20, desc: "Роботизированные линии сборки (-20% к цене всех деталей)" },
        { level: 3, cost: 50000,  discount: 30, desc: "Собственная резка текстолита (-30% к цене всех деталей)" },
        { level: 4, cost: 140000, discount: 42, desc: "Прямые контракты на кремний (-42% к цене всех деталей)" },
        { level: 5, cost: 400000, discount: 55, desc: "Мега-гигафабрика полного цикла (-55% к цене всех деталей)" }
    ],

    // Мощность цеха в долларах/год: чем дороже деталь, тем дольше она собирается!
    PROD_LEVELS: [
        { level: 1, cost: 8000,   powerBudget: 1500,  desc: "Малый цех (мощность $1,500/год)" },
        { level: 2, cost: 25000,  powerBudget: 4000,  desc: "Средняя линия (мощность $4,000/год)" },
        { level: 3, cost: 70000,  powerBudget: 10000, desc: "Крупный конвейер (мощность $10,000/год)" },
        { level: 4, cost: 180000, powerBudget: 24000, desc: "Авто-фабрика (мощность $24,000/год)" },
        { level: 5, cost: 500000, powerBudget: 60000, desc: "Кремниевый кластер (мощность $60,000/год)" }
    ],

    getPriceMultiplier() {
        if (this.discountFactoryLevel <= 0) return 1.0;
        const cfg = this.DISCOUNT_LEVELS[this.discountFactoryLevel - 1];
        return cfg ? (1 - cfg.discount / 100) : 1.0;
    },

    getDiscountPercent() {
        if (this.discountFactoryLevel <= 0) return 0;
        const cfg = this.DISCOUNT_LEVELS[this.discountFactoryLevel - 1];
        return cfg ? cfg.discount : 0;
    },

    getProductionBudget() {
        if (this.productionFactoryLevel <= 0) return 0;
        const cfg = this.PROD_LEVELS[this.productionFactoryLevel - 1];
        return cfg ? cfg.powerBudget : 0;
    },

    // Расчет скорости производства выбранной детали (деталей в год и лет на 1 деталь)
    getProductionRate(partKey = this.selectedPartToProduce) {
        const budget = this.getProductionBudget();
        const spec = PART_CATALOG[partKey];
        if (budget <= 0 || !spec) {
            return { itemsPerYear: 0, yearsPerItem: 0 };
        }

        const itemCost = Math.max(50, spec.cost);
        const itemsPerYear = budget / itemCost;
        const yearsPerItem = itemCost / budget;

        return { itemsPerYear, yearsPerItem };
    },

    getStockCount(partKey) {
        return this.inventory[partKey] || 0;
    },

    getTotalStock() {
        return Object.values(this.inventory).reduce((sum, val) => sum + val, 0);
    },

    upgradeDiscountFactory() {
        if (this.discountFactoryLevel >= this.MAX_DISCOUNT_LEVEL) return;
        const nextCfg = this.DISCOUNT_LEVELS[this.discountFactoryLevel];
        if (money < nextCfg.cost) {
            addLog(`⚠️ Недостаточно средств! Нужно $${nextCfg.cost.toLocaleString()}.`, true);
            return;
        }
        money -= nextCfg.cost;
        this.discountFactoryLevel++;
        moneyEl.textContent = `$${money.toLocaleString()}`;
        addLog(`🏭 Построен <strong>Завод оптимизации (Ур. ${this.discountFactoryLevel})</strong>! Скидка на все детали теперь <strong>-${nextCfg.discount}%</strong>.`);
        this.renderModal();
        onCircuitChanged();
    },

    upgradeProductionFactory() {
        if (this.productionFactoryLevel >= this.MAX_PROD_LEVEL) return;
        const nextCfg = this.PROD_LEVELS[this.productionFactoryLevel];
        if (money < nextCfg.cost) {
            addLog(`⚠️ Недостаточно средств! Нужно $${nextCfg.cost.toLocaleString()}.`, true);
            return;
        }
        money -= nextCfg.cost;
        this.productionFactoryLevel++;
        moneyEl.textContent = `$${money.toLocaleString()}`;
        addLog(`⚙️ Построен <strong>Производственный завод (Ур. ${this.productionFactoryLevel})</strong>! Мощность линии: <strong>$${nextCfg.powerBudget.toLocaleString()}/год</strong>.`);
        this.renderModal();
        this.updateBadge();
    },

    // Ежегодное накопление прогресса и выпуск готовых деталей
    produceYearlyBatch() {
        if (this.productionFactoryLevel <= 0) return null;

        const partKey = this.selectedPartToProduce;
        const spec = PART_CATALOG[partKey];
        if (!spec) return null;

        const { itemsPerYear } = this.getProductionRate(partKey);
        this.productionProgress += itemsPerYear;

        const completedCount = Math.floor(this.productionProgress);
        if (completedCount > 0) {
            this.productionProgress -= completedCount;
            this.inventory[partKey] = (this.inventory[partKey] || 0) + completedCount;
            this.updateBadge();
            return { partName: spec.name, icon: spec.icon, count: completedCount, isFinished: true };
        }

        // Если деталь еще собирается (накоплено меньше 100%)
        const percent = Math.round(this.productionProgress * 100);
        return { partName: spec.name, icon: spec.icon, count: 0, percent, isFinished: false };
    },
    sellFromStock(partKey, amount = 1) {
        const current = this.getStockCount(partKey);
        if (current <= 0) return;

        const sellCount = Math.min(current, amount);
        const spec = PART_CATALOG[partKey];
        const unitSellPrice = Math.round(spec.cost * 0.8);
        const totalGain = unitSellPrice * sellCount;

        this.inventory[partKey] -= sellCount;
        if (this.inventory[partKey] <= 0) delete this.inventory[partKey];

        money += totalGain;
        moneyEl.textContent = `$${money.toLocaleString()}`;
        addLog(`💰 Продано со склада: <strong>${spec.icon} ${spec.name} (${sellCount} шт.)</strong> за <strong>+$${totalGain.toLocaleString()}</strong>.`);

        this.updateBadge();
        this.renderModal();
        onCircuitChanged();
    },

    consumeUsedStock(usedCountsMap) {
        for (const [partKey, usedAmount] of Object.entries(usedCountsMap)) {
            if (this.inventory[partKey]) {
                this.inventory[partKey] = Math.max(0, this.inventory[partKey] - usedAmount);
                if (this.inventory[partKey] <= 0) delete this.inventory[partKey];
            }
        }
        this.updateBadge();
    },

    updateBadge() {
        const badge = document.getElementById('factory-stock-badge');
        if (badge) {
            badge.textContent = `${this.getTotalStock()} шт.`;
        }
    },

    renderModal() {
        const container = document.getElementById('factories-body');
        if (!container) return;

        const discPercent = this.getDiscountPercent();
        const nextDisc = this.DISCOUNT_LEVELS[this.discountFactoryLevel];

        const powerBudget = this.getProductionBudget();
        const nextProd = this.PROD_LEVELS[this.productionFactoryLevel];
        const rate = this.getProductionRate(this.selectedPartToProduce);
        const progressPercent = Math.min(100, Math.round(this.productionProgress * 100));

        // Понятный текст скорости: либо "X шт./год", либо "1 шт. за Y лет"
        let speedText = "Завод не построен";
        if (this.productionFactoryLevel > 0) {
            if (rate.itemsPerYear >= 1) {
                speedText = `${rate.itemsPerYear.toFixed(1)} шт. / год`;
            } else {
                speedText = `1 шт. за ${rate.yearsPerItem.toFixed(1)} лет (${Math.round(rate.itemsPerYear * 100)}% / год)`;
            }
        }

        let optionsHtml = '';
        for (const [key, spec] of Object.entries(PART_CATALOG)) {
            if (!unlockedParts.has(key)) continue;
            const selected = (key === this.selectedPartToProduce) ? 'selected' : '';
            optionsHtml += `<option value="${key}" ${selected}>${spec.icon} ${spec.name} ($${spec.cost.toLocaleString()})</option>`;
        }

        let stockHtml = '';
        const stockEntries = Object.entries(this.inventory);
        if (stockEntries.length === 0) {
            stockHtml = `<p class="empty-stock">Склад пуст. Постройте производственный завод, чтобы получать бесплатные детали!</p>`;
        } else {
            stockEntries.forEach(([key, count]) => {
                const spec = PART_CATALOG[key];
                if (!spec) return;
                const sellOnePrice = Math.round(spec.cost * 0.8);
                stockHtml += `
                    <div class="stock-item">
                        <div>
                            <strong>${spec.icon} ${spec.name}</strong> — <span class="stock-qty">${count} шт.</span>
                            <div class="stock-sub">Ставится на плату бесплатно ($0) или продаётся по $${sellOnePrice.toLocaleString()}/шт.</div>
                        </div>
                        <div class="stock-btns">
                            <button class="sell-stock-btn" onclick="FactorySystem.sellFromStock('${key}', 1)">Продать 1 ($${sellOnePrice.toLocaleString()})</button>
                            ${count > 1 ? `<button class="sell-stock-btn all" onclick="FactorySystem.sellFromStock('${key}', ${count})">Все ($${(sellOnePrice * count).toLocaleString()})</button>` : ''}
                        </div>
                    </div>
                `;
            });
        }

        container.innerHTML = `
            <div class="factories-grid">
                <div class="factory-card">
                    <div>
                        <div class="factory-badge">ТИП 1 • ЭКОНОМИЯ</div>
                        <h3>📉 Завод оптимизации цен</h3>
                        <p class="factory-desc">Снижает себестоимость всех покупаемых компонентов при сборке видеокарты.</p>
                        <div class="factory-stat">
                            Уровень: <strong>${this.discountFactoryLevel} / ${this.MAX_DISCOUNT_LEVEL}</strong><br>
                            Скидка на детали: <strong style="color:#4ade80">-${discPercent}%</strong>
                        </div>
                    </div>
                    ${nextDisc ? `
                        <button id="upgrade-disc-btn" class="factory-upgrade-btn" ${money < nextDisc.cost ? 'disabled' : ''}>
                            Улучшить до Ур. ${nextDisc.level} ($${nextDisc.cost.toLocaleString()})<br>
                            <span style="font-size:11px;font-weight:normal">${nextDisc.desc}</span>
                        </button>
                    ` : `<div class="max-level-badge">✔ Максимальный уровень (-${discPercent}%)</div>`}
                </div>

                <div class="factory-card">
                    <div>
                        <div class="factory-badge prod">ТИП 2 • ПРОИЗВОДСТВО</div>
                        <h3>⚙️ Производственный завод</h3>
                        <p class="factory-desc">Скорость зависит от цены детали: дешёвые штампуются пачками, а дорогие кастом-чипы собираются несколько лет.</p>
                        <div class="factory-stat">
                            Уровень: <strong>${this.productionFactoryLevel} / ${this.MAX_PROD_LEVEL}</strong> (Мощность: $${powerBudget.toLocaleString()}/год)<br>
                            Скорость: <strong style="color:#38bdf8">${speedText}</strong><br>
                            Готовность текущей детали: <strong>${progressPercent}%</strong>
                            <div class="bar-bg" style="margin-top:6px;">
                                <div class="bar-fill" style="width: ${progressPercent}%; background-color: #38bdf8;"></div>
                            </div>
                        </div>
                        <label class="prod-select-label">Линия штамповки (при смене прогресс сбрасывается):</label>
                        <select id="factory-part-select" class="factory-select">${optionsHtml}</select>
                    </div>
                    ${nextProd ? `
                        <button id="upgrade-prod-btn" class="factory-upgrade-btn prod" ${money < nextProd.cost ? 'disabled' : ''}>
                            Улучшить до Ур. ${nextProd.level} ($${nextProd.cost.toLocaleString()})<br>
                            <span style="font-size:11px;font-weight:normal">${nextProd.desc}</span>
                        </button>
                    ` : `<div class="max-level-badge">✔ Максимальный уровень ($${powerBudget.toLocaleString()}/год)</div>`}
                </div>
            </div>

            <div class="warehouse-box">
                <h3>📦 Склад произведённых компонентов (автоматически тратятся при сборке за $0)</h3>
                <div class="stock-list">${stockHtml}</div>
            </div>
        `;

        const upDiscBtn = document.getElementById('upgrade-disc-btn');
        if (upDiscBtn) upDiscBtn.addEventListener('click', () => this.upgradeDiscountFactory());

        const upProdBtn = document.getElementById('upgrade-prod-btn');
        if (upProdBtn) upProdBtn.addEventListener('click', () => this.upgradeProductionFactory());

        const partSelect = document.getElementById('factory-part-select');
        if (partSelect) {
            partSelect.addEventListener('change', (e) => {
                this.selectedPartToProduce = e.target.value;
                this.productionProgress = 0; // Сброс прогресса при перенастройке линии под другую деталь
                this.renderModal();
            });
        }
    }
};
