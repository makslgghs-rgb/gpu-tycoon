// МОДУЛЬ 3: Модельная система симуляции, баланса и конкуренции на рынке
// Целевые сегменты рынка при выпуске видеокарты
const MARKET_SEGMENTS = {
    budget: {
        id: "budget",
        name: "💸 Массовый гейминг",
        desc: "Обычные игроки. Ищут лучшее соотношение цены и FPS, не покупают слишком дорогие карты.",
        maxIdealCost: 4500,   // Базовый лимит цены (растет с годами)
        minMemory: 1,
        maxTemp: 85,
        profitMult: 1.35      // Высокий тираж продаж при попадании в цену
    },
    enthusiast: {
        id: "enthusiast",
        name: "🎮 Топ-гейминг (Флагманы)",
        desc: "Хардкорные геймеры. Нужен максимум FPS, хорошая память и тихое охлаждение, но сверхдорогие серверные платы не берут.",
        maxIdealCost: 16000,
        minMemory: 2,
        maxTemp: 82,
        profitMult: 1.55
    },
    workstation: {
        id: "workstation",
        name: "🎨 Рабочие станции (3D / Рендер)",
        desc: "Студии графики и монтажа. Требуют много видеопамяти (VRAM) и стабильное питание VRM.",
        maxIdealCost: 45000,
        minMemory: 3,
        maxTemp: 88,
        profitMult: 1.75
    },
    server: {
        id: "server",
        name: "🏢 Сервера и ИИ (Дата-центры)",
        desc: "Корпорации. Покупают сверхдорогие монструозные платы без ограничений по цене — главное гигантская мощность и память.",
        maxIdealCost: 9999999,
        minMemory: 4,
        maxTemp: 94,
        profitMult: 1.95
    }
};

const MarketSystem = {
    competitors: [
        { id: "nvidia", name: "NVIDIA", color: "#22c55e", share: 48, flagship: "GeForce GTX 480", power: 850 },
        { id: "amd",    name: "AMD",    color: "#ef4444", share: 34, flagship: "Radeon HD 5870",  power: 800 },
        { id: "intel",  name: "Intel",  color: "#3b82f6", share: 15, flagship: "Intel GMA HD",    power: 350 },
        { id: "player", name: "Ваша компания", color: "#facc15", share: 3, flagship: "Нет релизов", power: 0 }
    ],
    lastNews: "Рынок поделён между гигантами NVIDIA и AMD. Выпустите конкурентоспособную карту, чтобы забрать их аудиторию!",

    reset() {
        this.competitors = [
            { id: "nvidia", name: "NVIDIA", color: "#22c55e", share: 48, flagship: "GeForce GTX 480", power: 850 },
            { id: "amd",    name: "AMD",    color: "#ef4444", share: 34, flagship: "Radeon HD 5870",  power: 800 },
            { id: "intel",  name: "Intel",  color: "#3b82f6", share: 15, flagship: "Intel GMA HD",    power: 350 },
            { id: "player", name: "Ваша компания", color: "#facc15", share: 3, flagship: "Нет релизов", power: 0 }
        ];
        this.lastNews = "Рынок поделён между гигантами NVIDIA и AMD.";
    },

    getPlayerShare() {
        const p = this.competitors.find(c => c.id === "player");
        return p ? p.share : 3;
    },

        updateAfterRelease(gpuName, playerPower, score, year) {
        // После 2020 года компании замораживают развитие (фиксируем прогресс на отметке 10 лет)
        const effectiveYears = Math.min(year - 2010, 10);

        const nvModels = ["GTX 580", "GTX 680", "GTX 780 Ti", "GTX 980", "GTX 1080", "RTX 2080", "RTX 3080", "RTX 3090", "RTX 3090 Ti", "RTX 3090 Classic", "RTX 3090 Legacy"];
        const amdModels = ["HD 6970", "HD 7970", "R9 290X", "R9 Fury X", "RX 480", "RX 5700 XT", "RX 6800 XT", "RX 6900 XT", "RX 6950 XT", "RX 6950 Classic", "RX 6950 Legacy"];
        const intelModels = ["HD 3000", "HD 4000", "Iris Pro", "UHD 630", "Iris Xe", "Arc A750", "Arc A770", "Arc A770 LE", "Arc A770 SE", "Arc Classic", "Arc Legacy"];

        const idx = Math.min(effectiveYears, nvModels.length - 1);

        const nv = this.competitors.find(c => c.id === "nvidia");
        const amd = this.competitors.find(c => c.id === "amd");
        const intel = this.competitors.find(c => c.id === "intel");
        const player = this.competitors.find(c => c.id === "player");

        nv.power = Math.round(850 + effectiveYears * 380);
        nv.flagship = `GeForce ${nvModels[idx]} (${nv.power} баллов)`;

        amd.power = Math.round(800 + effectiveYears * 360);
        amd.flagship = `Radeon ${amdModels[idx]} (${amd.power} баллов)`;

        intel.power = Math.round(350 + effectiveYears * 260);
        intel.flagship = `Intel ${intelModels[idx]} (${intel.power} баллов)`;

        player.flagship = `${gpuName} (${playerPower} баллов)`;
        player.power = playerPower;

        let shareDelta = 0;
        if (score >= 8.5) shareDelta = 7;
        else if (score >= 7.0) shareDelta = 4;
        else if (score >= 5.5) shareDelta = 2;
        else if (score >= 4.0) shareDelta = -1;
        else shareDelta = -3;

        if (year > 2020) {
            this.lastNews = `Эпоха игроков (${year} г.): NVIDIA, AMD и Intel застряли на старых архитектурах и делят всего 15% рынка! Основная битва идёт между игроками.`;
        } else if (playerPower > nv.power && score >= 6.0) {
            shareDelta += 3;
            this.lastNews = `СЕНСАЦИЯ! ${gpuName} обошла по мощности флагман ${nv.flagship}! Геймеры массово переходят на ваши карты.`;
        } else if (shareDelta > 0) {
            this.lastNews = `Успешный релиз ${gpuName}! Ваша компания отвоевала +${shareDelta}% мирового рынка у конкурентов.`;
        } else {
            this.lastNews = `Слабый релиз ${gpuName}. Конкуренты укрепили свои позиции на рынке.`;
        }

        // Расчет долей рынка
        if (year > 2020) {
            // После 2020 года три ИИ-гиганта всегда держат ровно 15% рынка втроём (7% + 5% + 3%)
            nv.share = 7;
            amd.share = 5;
            intel.share = 3;
            // Оставшиеся 85% принадлежат пулу игроков (в одиночной игре — тебе, в мультиплеере — делятся между игроками)
            player.share = 85;
        } else {
            player.share = Math.max(1, Math.min(85, player.share + shareDelta));
            const remaining = 100 - player.share;

            nv.share = Math.round(remaining * 0.50);
            amd.share = Math.round(remaining * 0.35);
            intel.share = Math.max(1, 100 - player.share - nv.share - amd.share);
        }

        return { shareDelta, playerShare: player.share, news: this.lastNews };
    }
};
const CircuitEngine = {
    getNodeCenter(node) {
        const spec = PART_CATALOG[node.type];
        const w = spec.isCompact ? 44 : 96;
        const h = spec.isCompact ? 44 : 46;
        return { x: node.x + w / 2, y: node.y + h / 2 };
    },

        simulate(nodes, wires, currentYear, reputation) {
        let totalCost = 0;
        let gpuNode = null;
        const coolers = [];

        // Получаем скидку от Завода оптимизации цен и проверяем бесплатные детали на складе
        const priceMult = (typeof FactorySystem !== 'undefined') ? FactorySystem.getPriceMultiplier() : 1.0;
        const tempStock = (typeof FactorySystem !== 'undefined') ? Object.assign({}, FactorySystem.inventory) : {};
        const usedStockMap = {};

        nodes.forEach(n => {
            const spec = PART_CATALOG[n.type];
            if (spec.role === 'core') gpuNode = n;
            if (spec.role === 'cooler') coolers.push(n);

            // Если деталь есть на складе завода — берем её бесплатно ($0)!
            if (tempStock[n.type] && tempStock[n.type] > 0) {
                tempStock[n.type]--;
                usedStockMap[n.type] = (usedStockMap[n.type] || 0) + 1;
            } else {
                // Иначе покупаем со скидкой от Завода оптимизации
                totalCost += Math.round(spec.cost * priceMult);
            }
        });

        let totalWireLength = 0;
        wires.forEach(w => {
            const n1 = nodes.find(n => n.uid === w.fromNode);
            const n2 = nodes.find(n => n.uid === w.toNode);
            if (n1 && n2) {
                const c1 = this.getNodeCenter(n1);
                const c2 = this.getNodeCenter(n2);
                totalWireLength += Math.hypot(c2.x - c1.x, c2.y - c1.y);
            }
        });
        totalCost += Math.round(wires.length * 15 * priceMult);

        if (!gpuNode) {
            return {
                valid: false,
                reason: "Установите GPU Чип!",
                totalCost,
                usedStockMap,
                power: 0,
                temp: 28,
                connectedUids: new Set(),
                cooledUids: new Set()
            };
        }

        const { connectedUids, maxDepth } = this.traceCircuitGraph(gpuNode.uid, wires);

        let rawPower = 0;
        let totalHeat = 28;
        let counts = { memory: 0, power: 0, booster: 0, hub: 0 };
        let unconnectedCount = 0;
        const hotNodes = [];

        nodes.forEach(n => {
            const spec = PART_CATALOG[n.type];
            if (spec.noWireNeeded) return;

            if (connectedUids.has(n.uid)) {
                rawPower += spec.power;
                totalHeat += spec.heat;
                if (counts[spec.role] !== undefined) {
                    counts[spec.role]++;
                }
                if (spec.heat > 5) {
                    hotNodes.push(n);
                }
            } else {
                unconnectedCount++;
                if (spec.role === 'core' && spec.heat > 5) {
                    hotNodes.push(n);
                }
            }
        });

        // 1. Локальное охлаждение от кулеров
        let totalCooling = 0;
        const cooledUids = new Set();

        coolers.forEach(cooler => {
            const cSpec = PART_CATALOG[cooler.type];
            const cPos = this.getNodeCenter(cooler);
            const radius = cSpec.coolRadius || 155;

            const targetsInRange = hotNodes
                .map(hn => ({
                    node: hn,
                    dist: Math.hypot(this.getNodeCenter(hn).x - cPos.x, this.getNodeCenter(hn).y - cPos.y)
                }))
                .filter(item => item.dist <= radius)
                .sort((a, b) => a.dist - b.dist)
                .slice(0, 3);

            targetsInRange.forEach(item => {
                const efficiency = 1 - (item.dist / radius) * 0.5;
                totalCooling += Math.abs(cSpec.heat) * efficiency;
                cooledUids.add(item.node.uid);
            });
        });

        // 2. Сопротивление проводов и длинных цепочек
        const avgWireLen = wires.length > 0 ? totalWireLength / wires.length : 0;
        let wirePenaltyMult = 1.0;
        let wireHeatPenalty = 0;

        if (avgWireLen > 200) {
            wirePenaltyMult -= Math.min(0.22, (avgWireLen - 200) / 850);
            wireHeatPenalty += Math.round((avgWireLen - 200) / 40);
        }
        if (maxDepth > 3) {
            wirePenaltyMult -= (maxDepth - 3) * 0.07;
            wireHeatPenalty += (maxDepth - 3) * 3;
        }

        // 3. Баланс питания VRM
        const requiredVrm = Math.ceil(counts.memory / 2);
        const powerDeficit = Math.max(0, requiredVrm - counts.power);
        let powerThrottled = false;

        if (powerDeficit > 0) {
            powerThrottled = true;
            wirePenaltyMult *= Math.pow(0.75, powerDeficit);
            wireHeatPenalty += powerDeficit * 12;
        }

        // 4. Бонус от конденсаторов
        if (counts.booster > 0 && counts.memory > 0 && counts.power > 0) {
            const effectiveCaps = Math.min(counts.booster, counts.memory + 1);
            rawPower += Math.round(rawPower * (effectiveCaps * 0.09));
        }

        const finalPower = Math.max(0, Math.round(rawPower * Math.max(0.35, wirePenaltyMult)));
        const finalTemp = Math.max(28, Math.round(totalHeat + wireHeatPenalty - totalCooling));

        if (counts.memory === 0) {
            return {
                valid: false,
                reason: "Подключите VRAM к GPU!",
                totalCost,
                power: 0,
                temp: finalTemp,
                connectedUids,
                cooledUids
            };
        }

        if (counts.power === 0) {
            return {
                valid: false,
                reason: "Подключите питание VRM!",
                totalCost,
                power: 0,
                temp: finalTemp,
                connectedUids,
                cooledUids
            };
        }

        let statusText = `Готово (VRAM: ${counts.memory * 2}ГБ, VRM: ${counts.power}/${requiredVrm})`;
        if (powerThrottled) {
            statusText = `Троттлинг! Мало VRM (${counts.power}/${requiredVrm})`;
        } else if (finalTemp > 90) {
            statusText = `Опасный нагрев (${finalTemp}°C)! Поставьте кулер ближе`;
        }

        return {
            valid: true,
            statusText,
            powerThrottled,
            avgWireLen: Math.round(avgWireLen),
            maxDepth,
            totalCost,
            power: finalPower,
            temp: finalTemp,
            counts,
            unconnectedCount,
            connectedUids,
            cooledUids
        };
    },

    traceCircuitGraph(startUid, wires) {
        const connectedUids = new Set([startUid]);
        const queue = [{ uid: startUid, depth: 0 }];
        let maxDepth = 0;

        while (queue.length > 0) {
            const { uid, depth } = queue.shift();
            if (depth > maxDepth) maxDepth = depth;

            wires.forEach(w => {
                let next = null;
                if (w.fromNode === uid) next = w.toNode;
                if (w.toNode === uid) next = w.fromNode;

                if (next && !connectedUids.has(next)) {
                    connectedUids.add(next);
                    queue.push({ uid: next, depth: depth + 1 });
                }
            });
        }
        return { connectedUids, maxDepth };
    },

        evaluateRelease(simResult, year, reputation, gpuName, segmentId = 'enthusiast') {
        const segment = MARKET_SEGMENTS[segmentId] || MARKET_SEGMENTS.enthusiast;

        if (simResult.temp >= 96) {
            const marketUpdate = MarketSystem.updateAfterRelease(gpuName, 0, 1.0, year);
            return {
                score: 1.0,
                notes: ["КАТАСТРОФА: Видеокарта сгорела на тестах (96+ °C)! Партия отозвана."],
                isFail: true,
                revenue: 0,
                profit: -simResult.totalCost,
                repChange: -4,
                marketUpdate,
                segmentName: segment.name
            };
        }

        const effectiveYears = Math.min(year - 2010, 10);
        const inflationMult = 1 + (effectiveYears * 0.12);
        const expectedPower = 620 + (effectiveYears * 360) + Math.pow(effectiveYears, 1.2) * 50;


        let score = (simResult.power / expectedPower) * 7.6;
        let notes = [];
        let isFail = false;

        // 1. Проверка цены под выбранный сегмент
        const maxPriceForSegment = Math.round(segment.maxIdealCost * inflationMult);
        if (simResult.totalCost > maxPriceForSegment) {
            const overpriceRatio = simResult.totalCost / maxPriceForSegment;
            const pricePenalty = Math.min(6.5, (overpriceRatio - 1) * 4.5);
            score -= pricePenalty;
            notes.push(`Провал в нише «${segment.name}»: цена $${simResult.totalCost.toLocaleString()} слишком высока для этой аудитории (лимит ~$${maxPriceForSegment.toLocaleString()})!`);
            isFail = true;
        } else {
            notes.push(`Отличное попадание в бюджет сегмента «${segment.name}».`);
        }

        // 2. Проверка объема памяти и ускорителей под нишу
        if (simResult.counts.memory < segment.minMemory) {
            score -= (segment.minMemory - simResult.counts.memory) * 1.4;
            notes.push(`Мало чипов памяти (VRAM) для задач «${segment.name}».`);
        }

        if (segment.id === 'server' && simResult.counts.booster === 0) {
            score -= 1.5;
            notes.push("Дата-центрам не хватает AI-ускорителей / Тензор-ядер.");
        }

        if (segment.id === 'workstation' && simResult.powerThrottled) {
            score -= 1.5;
            notes.push("Студии жалуются на нестабильность питания VRM при рендере.");
        }

        // 3. Технические штрафы платы
        if (simResult.powerThrottled) {
            score -= 2.0;
            notes.push("Нехватка фаз VRM вызвала просадки.");
            isFail = true;
        }

        if (simResult.maxDepth > 3) {
            score -= 0.7;
            notes.push("Длинная цепочка соединений — используйте Узел-шину.");
        }

        if (simResult.unconnectedCount > 0) {
            score -= 1.0;
            notes.push("На плате остались неподключенные детали.");
        }

        if (simResult.temp > segment.maxTemp) {
            score -= 1.8;
            notes.push(`Слишком горячая (${simResult.temp}°C) для сегмента «${segment.name}».`);
            isFail = true;
        } else if (simResult.temp <= 65) {
            score += 0.5;
            notes.push("Холодная и тихая работа.");
        }

        score = Number(Math.max(1, Math.min(10, score)).toFixed(1));

        const marketUpdate = MarketSystem.updateAfterRelease(gpuName, simResult.power, score, year);
        const shareBonus = 1 + (marketUpdate.playerShare / 55);

        const scoreFactor = Math.pow(score / 5.2, 1.3);
        const repBonus = 1 + (reputation / 60);
        const marketNoise = 0.95 + Math.random() * 0.2;

        const revenue = Math.round(simResult.totalCost * scoreFactor * repBonus * shareBonus * segment.profitMult * marketNoise);
        const profit = revenue - simResult.totalCost;

        let repChange = 0;
        if (score >= 8.0) repChange = 4;
        else if (score >= 6.2) repChange = 2;
        else if (score >= 4.8) repChange = 0;
        else repChange = -2;

        if (profit < 0) isFail = true;

        return { score, notes, isFail, revenue, profit, repChange, marketUpdate, segmentName: segment.name };
    }
};
