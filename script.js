// РЕЖИМ ПЕСОЧНИЦЫ: поставь true, чтобы сразу получить $100,000,000 на старте
const SANDBOX_MODE = false;

let money = SANDBOX_MODE ? 100000000 : 4000;
let reputation = 10;
let year = 2010;

let nodes = [];
let nextUid = 1;
let draggedNode = null;
let dragOffset = { x: 0, y: 0 };

// Множество открытых (изученных) деталей
const unlockedParts = new Set();
for (const [key, spec] of Object.entries(PART_CATALOG)) {
    if (!spec.researchCost || spec.researchCost === 0) {
        unlockedParts.add(key);
    }
}

// Элементы интерфейса
const toolbarEl = document.getElementById('parts-toolbar');
const canvasEl = document.getElementById('pcb-canvas');
const nodesLayer = document.getElementById('nodes-layer');
const wiresLayer = document.getElementById('wires-layer');

const moneyEl = document.getElementById('money');
const repEl = document.getElementById('reputation');
const yearEl = document.getElementById('year');
const devCostEl = document.getElementById('dev-cost');
const statusEl = document.getElementById('circuit-status');
const estPowerEl = document.getElementById('est-power');
const estTempEl = document.getElementById('est-temp');
const nameInput = document.getElementById('gpu-name');
const logContainer = document.getElementById('log-container');

const releaseBtn = document.getElementById('release-btn');
const clearBtn = document.getElementById('clear-btn');

// Элементы окна доли рынка
const marketBtn = document.getElementById('market-btn');
const myShareBadge = document.getElementById('my-share-badge');
const marketModal = document.getElementById('market-modal');
const closeMarketBtn = document.getElementById('close-market-btn');
const modalYearEl = document.getElementById('modal-year');
const marketBarsEl = document.getElementById('market-bars');
const marketNewsEl = document.getElementById('market-news');

// Элементы окна исследований (R&D)
const researchBtn = document.getElementById('research-btn');
const unlockedCountEl = document.getElementById('unlocked-count');
const researchModal = document.getElementById('research-modal');
const closeResearchBtn = document.getElementById('close-research-btn');
const researchListEl = document.getElementById('research-list');

// Элементы окна выбора сегмента рынка
const segmentModal = document.getElementById('segment-modal');
const closeSegmentBtn = document.getElementById('close-segment-btn');
const segmentCardsEl = document.getElementById('segment-cards');

// Элементы окна заводов
const factoriesBtn = document.getElementById('factories-btn');
const factoriesModal = document.getElementById('factories-modal');
const closeFactoriesBtn = document.getElementById('close-factories-btn');

// Элементы B2B-сделок с конкурентами
const dealModal = document.getElementById('deal-modal');
const closeDealBtn = document.getElementById('close-deal-btn');
const dealModalTitle = document.getElementById('deal-modal-title');
const dealModalDesc = document.getElementById('deal-modal-desc');
const dealBody = document.getElementById('deal-body');

// Генерация панели только из изученных деталей
function buildToolbar() {
    if (!toolbarEl || typeof PART_CATALOG === 'undefined') return;
    toolbarEl.innerHTML = '';

    for (const [typeKey, spec] of Object.entries(PART_CATALOG)) {
        if (!unlockedParts.has(typeKey)) continue;

        const btn = document.createElement('button');
        btn.className = 'add-part-btn';
        btn.innerHTML = `${spec.icon} ${spec.name} ($${spec.cost})`;
        btn.addEventListener('click', () => addNode(typeKey));
        toolbarEl.appendChild(btn);
    }

    const totalParts = Object.keys(PART_CATALOG).length;
    if (unlockedCountEl) {
        unlockedCountEl.textContent = `${unlockedParts.size}/${totalParts}`;
    }
}

// Отрисовка древа исследований R&D
function renderResearchModal() {
    researchListEl.innerHTML = '';

    for (const [typeKey, spec] of Object.entries(PART_CATALOG)) {
        const isUnlocked = unlockedParts.has(typeKey);
        const card = document.createElement('div');
        card.className = 'tech-card' + (isUnlocked ? ' unlocked' : '');

        let statsText = `Цена на плате: $${spec.cost}<br>`;
        if (spec.power > 0) statsText += `Мощность: +${spec.power} баллов<br>`;
        if (spec.role === 'cooler') {
            statsText += `Охлаждение: ${spec.heat} °C (радиус ${spec.coolRadius}px)`;
        } else {
            statsText += `Нагрев: +${spec.heat} °C`;
        }

        let actionHtml = '';
        if (isUnlocked) {
            actionHtml = `<div class="tech-owned-badge">✔ Изучено</div>`;
        } else {
            const canAfford = money >= spec.researchCost;
            actionHtml = `<button class="buy-tech-btn" data-key="${typeKey}" ${canAfford ? '' : 'disabled'}>
                Изучить за $${spec.researchCost.toLocaleString()}
            </button>`;
        }

        card.innerHTML = `
            <div>
                <div class="tech-category">${spec.category || 'Деталь'}</div>
                <div class="tech-title">${spec.icon} ${spec.name}</div>
            </div>
            <div class="tech-stats">${statsText}</div>
            ${actionHtml}
        `;

        const buyBtn = card.querySelector('.buy-tech-btn');
        if (buyBtn) {
            buyBtn.addEventListener('click', () => {
                if (money >= spec.researchCost) {
                    money -= spec.researchCost;
                    unlockedParts.add(typeKey);
                    moneyEl.textContent = `$${money.toLocaleString()}`;
                    buildToolbar();
                    renderResearchModal();
                    addLog(`🔬 Исследована новая технология: <strong>${spec.icon} ${spec.name}</strong>! Деталь добавлена на панель сборки.`);
                    if (typeof SaveSystem !== 'undefined') SaveSystem.saveGame();
                }
            });
        }

        researchListEl.appendChild(card);
    }
}
function addNode(typeKey) {
    const spec = PART_CATALOG[typeKey];
    if (!spec || !unlockedParts.has(typeKey)) return;

    if (spec.maxCount) {
        const count = nodes.filter(n => n.type === typeKey).length;
        if (count >= spec.maxCount) {
            addLog(`Максимум ${spec.maxCount} шт. "${spec.name}" на плате.`, true);
            return;
        }
    }

    // Адаптивный спавн внутри видимых границ платы (подходит и для ПК, и для узких экранов телефонов)
    const boardW = canvasEl.clientWidth || 300;
    const boardH = canvasEl.clientHeight || 350;
    const nodeW = spec.isCompact ? 36 : 115;
    const nodeH = spec.isCompact ? 36 : 60;

    const minX = 16;
    const maxX = Math.max(minX + 10, boardW - nodeW - 16);
    const minY = 16;
    const maxY = Math.max(minY + 10, boardH - nodeH - 16);

    nodes.push({
        uid: 'node_' + nextUid++,
        type: typeKey,
        x: Math.floor(minX + Math.random() * (maxX - minX)),
        y: Math.floor(minY + Math.random() * (maxY - minY))
    });
    renderBoard();
}


function renderBoard() {
    nodesLayer.innerHTML = '';

    nodes.forEach(node => {
        const spec = PART_CATALOG[node.type];
        const el = document.createElement('div');
        el.className = 'pcb-node' + (spec.isCompact ? ' compact' : '');
        el.dataset.uid = node.uid;
        el.style.left = node.x + 'px';
        el.style.top = node.y + 'px';
        el.style.borderColor = spec.color;

        el.innerHTML = spec.isCompact
            ? `<span style="font-size:16px">${spec.icon}</span>`
            : `<div class="node-title">${spec.icon} ${spec.name}</div><div class="node-sub">$${spec.cost}</div>`;

        el.addEventListener('mousedown', (e) => {
            if (e.button !== 0 || e.target.classList.contains('pin')) return;
            draggedNode = node;
            const rect = el.getBoundingClientRect();
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;
        });

        el.addEventListener('mouseup', (e) => {
            if (WireSystem.wiringStart && WireSystem.wiringStart.nodeUid !== node.uid) {
                e.stopPropagation();
                const canvasRect = canvasEl.getBoundingClientRect();
                WireSystem.finishWiring(node.uid, null, e.clientX - canvasRect.left, e.clientY - canvasRect.top);
            }
        });

        el.addEventListener('contextmenu', (e) => {
            if (e.target.classList.contains('pin')) return;
            e.preventDefault();
            e.stopPropagation();
            nodes = nodes.filter(n => n.uid !== node.uid);
            WireSystem.removeWiresForNode(node.uid);
            renderBoard();
        });

        spec.pins.forEach(pin => {
            const pinEl = document.createElement('div');
            pinEl.className = 'pin';
            pinEl.style.left = pin.x + '%';
            pinEl.style.top = pin.y + '%';
            pinEl.dataset.pinId = pin.id;

            pinEl.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                if (WireSystem.wiringStart) {
                    if (WireSystem.wiringStart.nodeUid !== node.uid) {
                        WireSystem.finishWiring(node.uid, pin.id);
                    } else {
                        WireSystem.cancelWiring();
                    }
                } else {
                    WireSystem.startWiring(node.uid, pin.id);
                }
            });

            pinEl.addEventListener('mouseup', (e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                if (WireSystem.wiringStart && WireSystem.wiringStart.nodeUid !== node.uid) {
                    WireSystem.finishWiring(node.uid, pin.id);
                }
            });

            pinEl.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                WireSystem.disconnectPin(node.uid, pin.id);
            });

            el.appendChild(pinEl);
        });

        nodesLayer.appendChild(el);
    });

    WireSystem.render();
    onCircuitChanged();
}

function onCircuitChanged() {
    const sim = CircuitEngine.simulate(nodes, WireSystem.wires, year, reputation);

    devCostEl.textContent = `$${sim.totalCost.toLocaleString()}`;
    estPowerEl.textContent = sim.power;
    estTempEl.textContent = sim.temp;

    if (sim.temp >= 96) {
        estTempEl.style.color = '#ef4444';
    } else if (sim.temp > 82) {
        estTempEl.style.color = '#f59e0b';
    } else {
        estTempEl.style.color = '#4ade80';
    }

    if (sim.valid) {
        statusEl.textContent = sim.statusText;
        statusEl.style.color = (sim.powerThrottled || sim.temp > 90) ? '#f59e0b' : '#4ade80';
    } else {
        statusEl.textContent = sim.reason;
        statusEl.style.color = '#f87171';
    }

    nodes.forEach(n => {
        const spec = PART_CATALOG[n.type];
        const el = nodesLayer.querySelector(`.pcb-node[data-uid="${n.uid}"]`);
        if (!el) return;

        el.classList.remove('connected', 'disconnected');
        if (spec.noWireNeeded || sim.connectedUids.has(n.uid)) {
            el.classList.add('connected');
        } else {
            el.classList.add('disconnected');
        }

        if (!spec.isCompact && !spec.noWireNeeded) {
            const titleEl = el.querySelector('.node-title');
            if (titleEl) {
                const isCooled = sim.cooledUids && sim.cooledUids.has(n.uid);
                titleEl.textContent = `${spec.icon} ${spec.name}${isCooled ? ' ❄️' : ''}`;
            }
        }
    });

    return sim;
}

window.addEventListener('mousemove', (e) => {
    const canvasRect = canvasEl.getBoundingClientRect();
    const mouseX = e.clientX - canvasRect.left;
    const mouseY = e.clientY - canvasRect.top;

    if (draggedNode) {
        draggedNode.x = Math.max(5, Math.min(canvasRect.width - 105, mouseX - dragOffset.x));
        draggedNode.y = Math.max(5, Math.min(canvasRect.height - 55, mouseY - dragOffset.y));

        const el = nodesLayer.querySelector(`.pcb-node[data-uid="${draggedNode.uid}"]`);
        if (el) {
            el.style.left = draggedNode.x + 'px';
            el.style.top = draggedNode.y + 'px';
        }
        WireSystem.render();
        onCircuitChanged();
    } else if (WireSystem.wiringStart) {
        WireSystem.updateTempWire(mouseX, mouseY);
    } else {
        WireSystem.updateHover(mouseX, mouseY);
    }
});

window.addEventListener('mouseup', () => {
    draggedNode = null;
    if (WireSystem.wiringStart && WireSystem.snapTarget) {
        WireSystem.finishWiring();
    }
});

canvasEl.addEventListener('mousedown', (e) => {
    if (e.target === canvasEl || e.target === wiresLayer || e.target === nodesLayer) {
        WireSystem.cancelWiring();
    }
});

canvasEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (WireSystem.wiringStart) {
        WireSystem.cancelWiring();
        return;
    }
    WireSystem.removeHoveredWire();
});

// Отрисовка окна доли рынка и взаимодействия с компаниями
// Отрисовка окна доли рынка: показываем только Топ-10 лидеров рынка
function renderMarketModal() {
    modalYearEl.textContent = year;
    marketBarsEl.innerHTML = '';

    // Сортируем по доле рынка, а при равной доле — по мощности видеокарты
    const sorted = [...MarketSystem.competitors].sort((a, b) => {
        if (b.share !== a.share) return b.share - a.share;
        return (b.power || 0) - (a.power || 0);
    });

    const top10 = sorted.slice(0, 10);
    const playerRank = sorted.findIndex(c => c.id === 'player') + 1;
    const isPlayerInTop10 = top10.some(c => c.id === 'player');

    const renderCompanyCard = (comp, rank) => {
        const isCompetitor = comp.id !== 'player';
        const row = document.createElement('div');
        row.className = 'company-row' + (isCompetitor ? ' clickable' : '');

        row.innerHTML = `
            <div class="company-info">
                <span style="color: ${comp.color}"><strong>#${rank}</strong> ${comp.name}</span>
                <span>${comp.share}% рынка</span>
            </div>
            <div class="company-flagship">Флагман: ${comp.flagship}</div>
            <div class="bar-bg">
                <div class="bar-fill" style="width: ${comp.share}%; background-color: ${comp.color};"></div>
            </div>
            ${isCompetitor ? `
                <div class="company-actions">
                    <button class="deal-trigger-btn">🤝 Предложить сделку</button>
                </div>
            ` : ''}
        `;

        if (isCompetitor) {
            row.addEventListener('click', () => {
                openDealModal(comp);
            });
        }

        marketBarsEl.appendChild(row);
    };

    // Выводим Топ-10 лидеров
    top10.forEach((comp, index) => {
        renderCompanyCard(comp, index + 1);
    });

    // Если игрок пока ниже 10-го места — показываем его позицию отдельно внизу
    if (!isPlayerInTop10 && playerRank > 0) {
        const divider = document.createElement('div');
        divider.style.cssText = 'text-align:center; font-size:12px; color:#94a3b8; margin: 6px 0;';
        divider.textContent = '• • • Ваша позиция вне Топ-10 • • •';
        marketBarsEl.appendChild(divider);

        const playerComp = sorted[playerRank - 1];
        renderCompanyCard(playerComp, playerRank);
    }

    marketNewsEl.textContent = MarketSystem.lastNews;
    myShareBadge.textContent = `${MarketSystem.getPlayerShare()}%`;
}


// Открытие/закрытие модальных окон
marketBtn.addEventListener('click', () => {
    renderMarketModal();
    marketModal.classList.remove('hidden');
});
closeMarketBtn.addEventListener('click', () => marketModal.classList.add('hidden'));
marketModal.addEventListener('click', (e) => { if (e.target === marketModal) marketModal.classList.add('hidden'); });

researchBtn.addEventListener('click', () => {
    renderResearchModal();
    researchModal.classList.remove('hidden');
});
closeResearchBtn.addEventListener('click', () => researchModal.classList.add('hidden'));
researchModal.addEventListener('click', (e) => { if (e.target === researchModal) researchModal.classList.add('hidden'); });

if (factoriesBtn) {
    factoriesBtn.addEventListener('click', () => {
        FactorySystem.renderModal();
        factoriesModal.classList.remove('hidden');
    });
}
if (closeFactoriesBtn) closeFactoriesBtn.addEventListener('click', () => factoriesModal.classList.add('hidden'));
if (factoriesModal) factoriesModal.addEventListener('click', (e) => { if (e.target === factoriesModal) factoriesModal.classList.add('hidden'); });

if (closeSegmentBtn) closeSegmentBtn.addEventListener('click', () => segmentModal.classList.add('hidden'));
if (segmentModal) segmentModal.addEventListener('click', (e) => { if (e.target === segmentModal) segmentModal.classList.add('hidden'); });
// Нажатие на кнопку "Выпустить на рынок!"
releaseBtn.addEventListener('click', () => {
    const sim = onCircuitChanged();

    if (!sim.valid) {
        addLog(`Ошибка схемы: ${sim.reason}`, true);
        return;
    }
    if (money < sim.totalCost) {
        addLog(`Недостаточно денег! Нужно $${sim.totalCost.toLocaleString()}.`, true);
        return;
    }

    openSegmentSelector(sim);
});

function openSegmentSelector(sim) {
    segmentCardsEl.innerHTML = '';
    const effectiveYears = Math.min(year - 2010, 10);
    const inflationMult = 1 + (effectiveYears * 0.12);

    for (const seg of Object.values(MARKET_SEGMENTS)) {
        const maxPrice = seg.maxIdealCost > 1000000
            ? "Без лимита"
            : `до $${Math.round(seg.maxIdealCost * inflationMult).toLocaleString()}`;

        let fitClass = 'good';
        let fitText = '✔ Идеально подходит';

        if (sim.totalCost > seg.maxIdealCost * inflationMult) {
            fitClass = 'bad';
            fitText = '✖ Слишком дорого для этой ниши!';
        } else if (sim.counts.memory < seg.minMemory || sim.temp > seg.maxTemp) {
            fitClass = 'warn';
            fitText = '⚠ Не дотягивает по памяти/температуре';
        }

        const card = document.createElement('div');
        card.className = 'segment-card';
        card.innerHTML = `
            <div>
                <div class="segment-title">${seg.name}</div>
                <div class="segment-desc">${seg.desc}</div>
            </div>
            <div class="segment-reqs">
                • Бюджет клиентов: <strong>${maxPrice}</strong><br>
                • Мин. чипов VRAM: <strong>${seg.minMemory} шт.</strong><br>
                • Макс. температура: <strong>${seg.maxTemp} °C</strong>
            </div>
            <div class="segment-fit ${fitClass}">${fitText}</div>
            <button class="select-segment-btn">Выпустить в этот сегмент</button>
        `;

        card.querySelector('.select-segment-btn').addEventListener('click', () => {
            segmentModal.classList.add('hidden');
            executeRelease(sim, seg.id);
        });

        segmentCardsEl.appendChild(card);
    }

    segmentModal.classList.remove('hidden');
}

function executeRelease(sim, segmentId) {
    const gpuName = nameInput.value.trim() || "Node GPU";
    money -= sim.totalCost;

    // Списываем со склада бесплатные детали, которые использовались в этой видеокарте
    if (typeof FactorySystem !== 'undefined' && sim.usedStockMap) {
        FactorySystem.consumeUsedStock(sim.usedStockMap);
    }

    const result = CircuitEngine.evaluateRelease(sim, year, reputation, gpuName, segmentId);

    money += result.revenue;
    reputation = Math.max(1, reputation + result.repChange);
    year++;

    // Завод штампует новую партию деталей (или накапливает прогресс) за прошедший год
    let prodReport = '';
    if (typeof FactorySystem !== 'undefined') {
        const produced = FactorySystem.produceYearlyBatch();
        if (produced) {
            if (produced.isFinished) {
                prodReport = `<br>🏭 Завод выпустил на склад: <strong>${produced.icon} ${produced.partName} (${produced.count} шт.)</strong>`;
            } else {
                prodReport = `<br>⚙️ Завод собирает: <strong>${produced.icon} ${produced.partName}</strong> (готово <strong>${produced.percent}%</strong>)`;
            }
        }
    }

    moneyEl.textContent = `$${money.toLocaleString()}`;
    repEl.textContent = reputation;
    yearEl.textContent = year;
    myShareBadge.textContent = `${result.marketUpdate.playerShare}%`;

    // Синхронизация релиза, нового года и доли рынка с другими игроками в P2P-сети
    if (typeof P2PNetwork !== 'undefined') {
        const prof = P2PNetwork.getMyProfileInfo();
        P2PNetwork.recalculateGlobalMarket();
        P2PNetwork.broadcastState(
            'release',
            `${prof.avatar} ${prof.nickname} выпустил видеокарту ${gpuName} (${sim.power} баллов, оценка ${result.score}/10)!`
        );
    }

    const shareSign = result.marketUpdate.shareDelta >= 0 ? '+' : '';
    addLog(
        `<strong>${gpuName} (${year - 1} г.)</strong> [${result.segmentName}] — Оценка: <strong>${result.score}/10</strong><br>
        ${result.notes.join(' ')}<br>
        Доля рынка: <strong>${result.marketUpdate.playerShare}%</strong> (${shareSign}${result.marketUpdate.shareDelta}%)<br>
        Выручка: $${result.revenue.toLocaleString()} (Прибыль: ${result.profit >= 0 ? '+' : ''}$${result.profit.toLocaleString()})${prodReport}`,
        result.isFail || result.profit < 0
    );

    // Проверка на банкротство (текущий год при сбросе остаётся общим)
    const hasStock = (typeof FactorySystem !== 'undefined' && FactorySystem.getTotalStock() > 0);
    const priceMult = (typeof FactorySystem !== 'undefined') ? FactorySystem.getPriceMultiplier() : 1.0;
    const minBoardCost = Math.round(1780 * priceMult);

    if (money < minBoardCost && !hasStock) {
        triggerBankruptcyReset();
        return;
    }

    if (typeof SaveSystem !== 'undefined') SaveSystem.saveGame();
    nameInput.value = `GTX ${Math.floor(Math.random() * 800 + 200)}`;
    onCircuitChanged();
}


// B2B-сделки с конкурентами
const COMPANY_DEAL_RATES = {
    nvidia: { mult: 1.45, note: "NVIDIA платит премиальную цену (+45%) за передовые компоненты." },
    amd:    { mult: 1.35, note: "AMD активно скупает детали для расширения линейки (+35% к цене)." },
    intel:  { mult: 1.25, note: "Intel закупает компоненты для выхода на рынок дискретных GPU (+25% к цене)." }
};

if (closeDealBtn) closeDealBtn.addEventListener('click', () => dealModal.classList.add('hidden'));
if (dealModal) dealModal.addEventListener('click', (e) => { if (e.target === dealModal) dealModal.classList.add('hidden'); });

function openDealModal(comp) {
    const rateInfo = COMPANY_DEAL_RATES[comp.id] || { mult: 1.25, note: "Выгодный B2B-контракт на поставку деталей." };

    dealModalTitle.innerHTML = `🤝 Сделка с <span style="color:${comp.color}">${comp.name}</span>`;
    dealModalDesc.textContent = rateInfo.note;
    dealBody.innerHTML = '';

    const stockEntries = (typeof FactorySystem !== 'undefined') ? Object.entries(FactorySystem.inventory) : [];

    if (stockEntries.length === 0) {
        dealBody.innerHTML = `
            <p class="empty-stock">
                На складе ваших заводов пока нет готовых компонентов.<br>
                Постройте <b>Производственный завод</b>, чтобы выпускать детали для продажи!
            </p>
        `;
        dealModal.classList.remove('hidden');
        return;
    }

    const listEl = document.createElement('div');
    listEl.className = 'deal-list';

    stockEntries.forEach(([partKey, count]) => {
        const spec = PART_CATALOG[partKey];
        if (!spec) return;

        const unitContractPrice = Math.round(spec.cost * rateInfo.mult);
        const totalAllPrice = unitContractPrice * count;

        const item = document.createElement('div');
        item.className = 'deal-item';
        item.innerHTML = `
            <div class="deal-item-info">
                <strong>${spec.icon} ${spec.name}</strong> (на складе: <span style="color:#4ade80">${count} шт.</span>)
                <div class="deal-price-tag">Цена контракта: $${unitContractPrice.toLocaleString()} / шт.</div>
            </div>
            <div class="deal-sell-btns">
                <button class="deal-confirm-btn" data-amount="1">Продать 1 ($${unitContractPrice.toLocaleString()})</button>
                ${count > 1 ? `<button class="deal-confirm-btn all" data-amount="${count}">Продать все ($${totalAllPrice.toLocaleString()})</button>` : ''}
            </div>
        `;

        item.querySelectorAll('.deal-confirm-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const sellAmount = Number(btn.dataset.amount);
                executeB2BDeal(comp, partKey, sellAmount, unitContractPrice);
            });
        });

        listEl.appendChild(item);
    });

    dealBody.appendChild(listEl);
    dealModal.classList.remove('hidden');
}

function executeB2BDeal(comp, partKey, amount, unitPrice) {
    const spec = PART_CATALOG[partKey];
    const currentStock = FactorySystem.getStockCount(partKey);
    const actualAmount = Math.min(currentStock, amount);
    if (actualAmount <= 0) return;

    const totalRevenue = actualAmount * unitPrice;

    FactorySystem.consumeUsedStock({ [partKey]: actualAmount });
    money += totalRevenue;
    moneyEl.textContent = `$${money.toLocaleString()}`;

    if (comp.isRemotePlayer && typeof P2PNetwork !== 'undefined') {
        // Отправляем компоненты напрямую на склад живого игрока по P2P-сети
        P2PNetwork.sendTradeToPlayer(comp.peerId, partKey, actualAmount, unitPrice);
        addLog(
            `🌐 <strong>P2P-Сделка с ${comp.name}:</strong> отправлено <strong>${spec.icon} ${spec.name} (${actualAmount} шт.)</strong> на сумму <strong>+$${totalRevenue.toLocaleString()}</strong>!`
        );
    } else {
        // Стандартная сделка с ИИ-корпорацией
        if (spec.power > 0) {
            comp.power += Math.round(spec.power * 0.15 * actualAmount);
            comp.flagship = `${comp.flagship.split(' (').at(0)} (${comp.power} баллов)`;
        }
        addLog(
            `🤝 <strong>B2B-контракт с ${comp.name}:</strong> продано <strong>${spec.icon} ${spec.name} (${actualAmount} шт.)</strong> за <strong>+$${totalRevenue.toLocaleString()}</strong>!`
        );
    }

    renderMarketModal();
    openDealModal(comp);
}


// Полный сброс компании при банкротстве (текущий год остаётся общим для всех)
// Полный сброс компании при банкротстве (текущий год остаётся общим для всех)
function triggerBankruptcyReset() {
    money = SANDBOX_MODE ? 100000000 : 4000;
    reputation = 10;

    nodes = [];
    nextUid = 1;
    WireSystem.reset();

    unlockedParts.clear();
    for (const key of Object.keys(PART_CATALOG)) {
        if (key.startsWith('custom_part_')) {
            delete PART_CATALOG[key];
        } else if (!PART_CATALOG[key].researchCost || PART_CATALOG[key].researchCost === 0) {
            unlockedParts.add(key);
        }
    }

    if (typeof FactorySystem !== 'undefined') {
        FactorySystem.discountFactoryLevel = 0;
        FactorySystem.productionFactoryLevel = 0;
        FactorySystem.selectedPartToProduce = 'vram';
        FactorySystem.productionProgress = 0;
        FactorySystem.inventory = {};
        FactorySystem.updateBadge();
    }

    const player = MarketSystem.competitors.find(c => c.id === 'player');
    if (player) {
        player.share = 1;
        player.flagship = "Нет релизов";
        player.power = 0;
    }
    MarketSystem.lastNews = `Корпорация обанкротилась и начинает заново в ${year} году!`;

    moneyEl.textContent = `$${money.toLocaleString()}`;
    repEl.textContent = reputation;
    myShareBadge.textContent = `${MarketSystem.getPlayerShare()}%`;
    nameInput.value = "GTX 100";

    buildToolbar();
    renderBoard();

    // Сразу фиксируем сброшенное состояние в автосохранении
    if (typeof SaveSystem !== 'undefined') {
        SaveSystem.saveGame();
    }

    addLog(
        `💥 <strong>БАНКРОТСТВО!</strong> У корпорации закончились средства и детали. Вы основали новый стартап с капиталом <strong>$${money.toLocaleString()}</strong> (текущий год: <strong>${year} г.</strong>)!`,
        true
    );
}


// Очистка платы
clearBtn.addEventListener('click', () => {
    nodes = [];
    WireSystem.reset();
    renderBoard();
});

function addLog(htmlText, isFail = false) {
    const entry = document.createElement('div');
    entry.className = isFail ? 'log-entry fail' : 'log-entry';
    entry.innerHTML = htmlText;
    logContainer.prepend(entry);
}

// Запуск игры
moneyEl.textContent = `$${money.toLocaleString()}`;
myShareBadge.textContent = `${MarketSystem.getPlayerShare()}%`;
if (typeof FactorySystem !== 'undefined') FactorySystem.updateBadge();
buildToolbar();
renderBoard();
// Запуск игры и загрузка автосохранения
moneyEl.textContent = `$${money.toLocaleString()}`;
myShareBadge.textContent = `${MarketSystem.getPlayerShare()}%`;
if (typeof FactorySystem !== 'undefined') FactorySystem.updateBadge();
buildToolbar();
renderBoard();

if (typeof SaveSystem !== 'undefined') {
    SaveSystem.loadGame();
}

