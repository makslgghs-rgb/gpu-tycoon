// МОДУЛЬ 4: Лаборатория проектирования индивидуальных компонентов (Chip Fab)

const ChipFab = {
    SIZES: {
        small:  { label: "Маленькая (16 яч., ×0.5)", cols: 4, rows: 4, cellH: 56, priceMult: 0.5 },
        medium: { label: "Средняя (32 яч., ×1)",     cols: 8, rows: 4, cellH: 48, priceMult: 1.0 },
        large:  { label: "Большая (64 яч., ×3)",     cols: 8, rows: 8, cellH: 36, priceMult: 3.0 }
    },

    currentSize: 'medium',
    waferGrid: [],
    selectedMicroPart: 'copper',
    customCounter: 1,

    BASE_MICRO_PARTS: {
        copper: {
            shortName: "Шина",
            name: "Медная шина",
            desc: "Внутренняя разводка чипа. Охлаждает соседей (-2 °C) и даёт +40 бонуса за каждую связь.",
            icon: "🟧",
            power: 150,
            heat: -2,
            cost: 150,
            color: "#fb923c"
        },
        micro_cool: {
            shortName: "Охлад",
            name: "Микро-каналы",
            desc: "Жидкостные капилляры в кремнии. Снимают -10 °C с чипа и гасят жар соседних блоков.",
            icon: "❄️",
            power: 0,
            heat: -10,
            cost: 250,
            color: "#22d3ee"
        }
    },

    UNIQUE_MICRO_PARTS: {
        core: {
            core_2nm: {
                shortName: "2.5нм",
                name: "Ядро 2.5нм",
                desc: "Уникально для GPU: сверхплотный вычислительный блок (+650 мощности, +8 °C).",
                icon: "💠",
                power: 650,
                heat: 8,
                cost: 400,
                color: "#38bdf8",
                isUnique: true
            },
            rt_unit: {
                shortName: "RT-блок",
                name: "Трассировщик RT",
                desc: "Уникально для GPU: аппаратные лучи. Даёт +480 мощности и усиливает соседние Ядра 2.5нм на +90!",
                icon: "🔦",
                power: 480,
                heat: 5,
                cost: 340,
                color: "#60a5fa",
                isUnique: true
            }
        },
        memory: {
            hbm_stack: {
                shortName: "HBM3e",
                name: "Стек HBM3e",
                desc: "Уникально для VRAM: многослойная память (+600 мощности, +5 °C).",
                icon: "🧬",
                power: 600,
                heat: 5,
                cost: 360,
                color: "#e879f9",
                isUnique: true
            },
            mem_ctrl: {
                shortName: "512-бит",
                name: "Контроллер шины",
                desc: "Уникально для VRAM: расширяет пропускную способность (+350 мощности, усиливает соседние стеки HBM).",
                icon: "🎛️",
                power: 350,
                heat: 3,
                cost: 280,
                color: "#c084fc",
                isUnique: true
            }
        },
        power: {
            gan_stage: {
                shortName: "GaN 90A",
                name: "Каскад GaN",
                desc: "Уникально для VRM: нитрид-галлиевый ключ (+320 мощности, почти не греется +2 °C).",
                icon: "⚡",
                power: 320,
                heat: 2,
                cost: 220,
                color: "#facc15",
                isUnique: true
            },
            choke_coil: {
                shortName: "Дроссель",
                name: "Ферритовый дроссель",
                desc: "Уникально для VRM: сглаживает пульсации тока (+180 мощности, снижает нагрев на -3 °C).",
                icon: "🧲",
                power: 180,
                heat: -3,
                cost: 160,
                color: "#fde047",
                isUnique: true
            }
        },
        booster: {
            tensor_matrix: {
                shortName: "AI-Матрица",
                name: "Тензор-матрица",
                desc: "Уникально для Ускорителя: блок нейросетей (+720 мощности, +7 °C).",
                icon: "🧠",
                power: 720,
                heat: 7,
                cost: 420,
                color: "#34d399",
                isUnique: true
            },
            l3_cache: {
                shortName: "Кэш L3",
                name: "Кэш-память L3",
                desc: "Уникально для Ускорителя: сверхбыстрый буфер (+450 мощности, +3 °C).",
                icon: "📦",
                power: 450,
                heat: 3,
                cost: 300,
                color: "#10b981",
                isUnique: true
            }
        },
        cooler: {
            vapor_chamber: {
                shortName: "Испар.кам",
                name: "Испарительная камера",
                desc: "Уникально для СВО: мгновенно отводит тепло (-18 °C за каждый блок!).",
                icon: "💨",
                power: 0,
                heat: -18,
                cost: 320,
                color: "#67e8f9",
                isUnique: true
            },
            liquid_metal: {
                shortName: "Жидк.мет",
                name: "Жидкий металл",
                desc: "Уникально для СВО: сверхтеплопроводный интерфейс (-14 °C и усиливает соседние камеры).",
                icon: "💧",
                power: 0,
                heat: -14,
                cost: 240,
                color: "#a5f3fc",
                isUnique: true
            }
        }
    },

    getAvailableMicroParts() {
        const roleSelect = document.getElementById('fab-role-select');
        const role = roleSelect ? roleSelect.value : 'core';
        const uniques = this.UNIQUE_MICRO_PARTS[role] || {};
        return Object.assign({}, uniques, this.BASE_MICRO_PARTS);
    },

    init() {
        this.setSize('medium');
        this.bindEvents();
    },

    setSize(sizeKey) {
        if (!this.SIZES[sizeKey]) return;
        this.currentSize = sizeKey;
        const cfg = this.SIZES[sizeKey];

        document.querySelectorAll('.size-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.size === sizeKey);
        });

        this.waferGrid = [];
        for (let r = 0; r < cfg.rows; r++) {
            this.waferGrid.push(new Array(cfg.cols).fill(null));
        }
        this.renderWafer();
    },

    resetWafer() {
        this.setSize(this.currentSize);
    },
    bindEvents() {
        const openBtn = document.getElementById('open-fab-btn');
        const closeBtn = document.getElementById('close-fab-btn');
        const modal = document.getElementById('fab-modal');
        const clearBtn = document.getElementById('fab-clear-btn');
        const craftBtn = document.getElementById('fab-craft-btn');
        const roleSelect = document.getElementById('fab-role-select');

        if (openBtn) {
            openBtn.addEventListener('click', () => {
                const totalTechs = Object.keys(PART_CATALOG).length;
                if (unlockedParts.size < totalTechs && money < 25000) {
                    addLog(`🔒 Изучите все технологии в отделе R&D (или накопите $25,000), чтобы открыть Chip Fab!`, true);
                    return;
                }
                this.onRoleChanged();
                this.renderWafer();
                modal.classList.remove('hidden');
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.add('hidden');
            });
        }

        document.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setSize(btn.dataset.size);
            });
        });

        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.resetWafer());
        }

        if (roleSelect) {
            roleSelect.addEventListener('change', () => {
                this.onRoleChanged();
                this.resetWafer();
            });
        }

        if (craftBtn) {
            craftBtn.addEventListener('click', () => this.createCustomComponent());
        }
    },

    onRoleChanged() {
        const available = this.getAvailableMicroParts();
        const keys = Object.keys(available);
        if (!available[this.selectedMicroPart] && keys.length > 0) {
            this.selectedMicroPart = keys.at(0);
        }
        this.renderMicroToolbar();
    },

    renderMicroToolbar() {
        const bar = document.getElementById('fab-micro-toolbar');
        if (!bar) return;
        bar.innerHTML = '';

        const available = this.getAvailableMicroParts();

        for (const [key, m] of Object.entries(available)) {
            const btn = document.createElement('button');
            btn.className = 'micro-btn' + (this.selectedMicroPart === key ? ' active' : '') + (m.isUnique ? ' unique-part' : '');
            btn.innerHTML = `${m.icon} ${m.name}`;
            btn.addEventListener('click', () => {
                this.selectedMicroPart = key;
                this.renderMicroToolbar();
            });
            bar.appendChild(btn);
        }

        let infoBox = document.getElementById('fab-tool-info');
        if (!infoBox) {
            infoBox = document.createElement('div');
            infoBox.id = 'fab-tool-info';
            infoBox.className = 'fab-tool-info';
            bar.insertAdjacentElement('afterend', infoBox);
        }

        const activePart = available[this.selectedMicroPart] || Object.values(available).at(0);
        infoBox.style.borderLeftColor = activePart.color;
        infoBox.innerHTML = `<strong>${activePart.icon} ${activePart.name}</strong>: ${activePart.desc}`;
    },

    renderWafer() {
        const gridEl = document.getElementById('silicon-wafer');
        if (!gridEl) return;

        const cfg = this.SIZES[this.currentSize];
        const available = this.getAvailableMicroParts();

        gridEl.style.gridTemplateColumns = `repeat(${cfg.cols}, 1fr)`;
        gridEl.style.gridTemplateRows = `repeat(${cfg.rows}, ${cfg.cellH}px)`;
        gridEl.innerHTML = '';

        for (let r = 0; r < cfg.rows; r++) {
            for (let c = 0; c < cfg.cols; c++) {
                const cell = document.createElement('div');
                const rowArr = this.waferGrid.at(r);
                const partKey = rowArr ? rowArr.at(c) : null;
                const m = partKey ? available[partKey] : null;

                cell.className = 'wafer-cell' + (m ? ' filled' : '');

                if (m) {
                    cell.style.borderColor = m.color;
                    cell.title = `${m.name}: ${m.desc}`;
                    cell.innerHTML = `
                        <span class="wafer-icon">${m.icon}</span>
                        <span class="wafer-label" style="color:${m.color}">${m.shortName}</span>
                    `;
                }

                cell.addEventListener('click', () => {
                    this.waferGrid.at(r).splice(c, 1, this.selectedMicroPart);
                    this.renderWafer();
                });

                cell.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    this.waferGrid.at(r).splice(c, 1, null);
                    this.renderWafer();
                });

                gridEl.appendChild(cell);
            }
        }
        this.updateStats();
    },

    getNeighbors(r, c, rows, cols) {
        const res = [];
        if (r > 0 && this.waferGrid.at(r - 1).at(c)) res.push(this.waferGrid.at(r - 1).at(c));
        if (r < rows - 1 && this.waferGrid.at(r + 1).at(c)) res.push(this.waferGrid.at(r + 1).at(c));
        if (c > 0 && this.waferGrid.at(r).at(c - 1)) res.push(this.waferGrid.at(r).at(c - 1));
        if (c < cols - 1 && this.waferGrid.at(r).at(c + 1)) res.push(this.waferGrid.at(r).at(c + 1));
        return res;
    },

    updateStats() {
        const cfg = this.SIZES[this.currentSize];
        const available = this.getAvailableMicroParts();
        const totalCells = cfg.rows * cfg.cols;

        let filledCount = 0;
        let totalPower = 0;
        let totalHeat = 10;
        let baseUnitCost = 400;
        let synergyBonus = 0;

        for (let r = 0; r < cfg.rows; r++) {
            for (let c = 0; c < cfg.cols; c++) {
                const key = this.waferGrid.at(r).at(c);
                if (!key || !available[key]) continue;

                const m = available[key];
                const neighbors = this.getNeighbors(r, c, cfg.rows, cfg.cols);

                filledCount++;
                totalPower += m.power;
                totalHeat += m.heat;
                baseUnitCost += m.cost;

                if (key === 'core_2nm') {
                    const rtNeighbors = neighbors.filter(n => n === 'rt_unit').length;
                    synergyBonus += rtNeighbors * 90;
                }
                if (key === 'hbm_stack') {
                    const ctrlNeighbors = neighbors.filter(n => n === 'mem_ctrl').length;
                    synergyBonus += ctrlNeighbors * 80;
                }
                if (key === 'copper' && neighbors.length >= 2) {
                    synergyBonus += neighbors.length * 40;
                }
                if (key === 'liquid_metal') {
                    const camNeighbors = neighbors.filter(n => n === 'vapor_chamber').length;
                    totalHeat -= camNeighbors * 4;
                }
            }
        }

        totalPower += synergyBonus;

        const finalUnitCost = Math.round(baseUnitCost * cfg.priceMult);
        const finalFabCost = Math.round((5000 + filledCount * 500) * cfg.priceMult);

        const roleSelect = document.getElementById('fab-role-select');
        const role = roleSelect ? roleSelect.value : 'core';
        let displayHeat = Math.max(4, totalHeat);
        if (role === 'cooler') {
            displayHeat = -Math.max(25, Math.abs(totalHeat) + filledCount * 3);
            totalPower = 0;
        }

        document.getElementById('fab-size-label').textContent = cfg.label;
        document.getElementById('fab-cells-count').textContent = `${filledCount}/${totalCells}`;
        document.getElementById('fab-est-power').textContent = `${totalPower} (бонус: +${synergyBonus})`;
        document.getElementById('fab-est-heat').textContent = `${displayHeat > 0 ? '+' : ''}${displayHeat} °C`;
        document.getElementById('fab-unit-cost').textContent = `$${finalUnitCost.toLocaleString()}`;
        document.getElementById('fab-dev-cost').textContent = `$${finalFabCost.toLocaleString()}`;

        return { filledCount, totalPower, displayHeat, finalUnitCost, finalFabCost, role };
    },

        createCustomComponent() {
        const stats = this.updateStats();
        const nameInput = document.getElementById('fab-part-name');
        const customName = nameInput.value.trim() || `Custom-X${this.customCounter}`;

        if (stats.filledCount < 3) {
            addLog(`⚠️ Разместите минимум 3 микро-блока на кремниевой пластине!`, true);
            return;
        }

        if (money < stats.finalFabCost) {
            addLog(`⚠️ Недостаточно средств для литографии чипа! Нужно $${stats.finalFabCost.toLocaleString()}.`, true);
            return;
        }

        money -= stats.finalFabCost;
        moneyEl.textContent = `$${money.toLocaleString()}`;

        const newKey = `custom_part_${Date.now()}_${this.customCounter++}`;

        const roleConfigs = {
            core:    { icon: "🔮", cat: "Кастом GPU", color: "#38bdf8", maxCount: 1, pins: [{ id: "p1", x: 0, y: 50 }, { id: "p2", x: 100, y: 50 }, { id: "p3", x: 50, y: 100 }] },
            memory:  { icon: "🧬", cat: "Кастом VRAM", color: "#e879f9", pins: [{ id: "p1", x: 0, y: 50 }, { id: "p2", x: 100, y: 50 }] },
            power:   { icon: "⚡", cat: "Кастом VRM", color: "#fde047", pins: [{ id: "p1", x: 50, y: 0 }, { id: "p2", x: 50, y: 100 }] },
            booster: { icon: "🚀", cat: "Кастом Ядро", color: "#34d399", pins: [{ id: "p1", x: 0, y: 50 }, { id: "p2", x: 100, y: 50 }] },
            cooler:  { icon: "❄️", cat: "Кастом СВО", color: "#67e8f9", noWireNeeded: true, coolRadius: 340, pins: [] }
        };

        const cfg = roleConfigs[stats.role];

        PART_CATALOG[newKey] = {
            name: customName,
            category: cfg.cat,
            icon: cfg.icon,
            role: stats.role,
            researchCost: 0,
            cost: stats.finalUnitCost,
            power: stats.totalPower,
            heat: stats.displayHeat,
            coolRadius: cfg.coolRadius || 0,
            noWireNeeded: cfg.noWireNeeded || false,
            maxCount: cfg.maxCount || undefined,
            color: cfg.color,
            pins: cfg.pins
        };

        unlockedParts.add(newKey);
        buildToolbar();

        document.getElementById('fab-modal').classList.add('hidden');
        addLog(`🔮 Создан компонент <strong>${cfg.icon} ${customName}</strong> (Цена: $${stats.finalUnitCost.toLocaleString()}, Мощность: +${stats.totalPower}, Нагрев: ${stats.displayHeat}°C)!`);
        nameInput.value = `Apex ${this.customCounter}.5nm`;
    }
};

window.addEventListener('DOMContentLoaded', () => {
    ChipFab.init();
});
