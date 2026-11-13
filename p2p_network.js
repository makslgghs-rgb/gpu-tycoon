// МОДУЛЬ 7: Децентрализованный P2P-мультиплеер на чистом встроенном WebSocket (0 внешних библиотек)
// Нагрузка распределена между всеми активными игроками в сети.

// МОДУЛЬ 7: Децентрализованный P2P-мультиплеер на нативном WebSocket + MQTT-фрейминге (0 внешних файлов)

const P2PNetwork = {
    BROKERS: [
        'wss://broker.emqx.io:8084/mqtt',
        'wss://test.mosquitto.org:8081/mqtt',
        'wss://://hivemq.com'
    ],
    brokerIndex: 0,
    TOPIC: 'gpu_tycoon_swarm_release_v2',

    ws: null,
    localChannel: null,
    peerId: 'peer_' + Math.random().toString(36).substring(2, 10),
    peers: {},
    isConnected: false,
    heartbeatTimer: null,

    init() {
        // 1. Локальный мост между вкладками на одном ПК
        if (typeof BroadcastChannel !== 'undefined') {
            this.localChannel = new BroadcastChannel('gpu_tycoon_local_swarm');
            this.localChannel.onmessage = (event) => {
                const packet = event.data;
                if (!packet || packet.senderId === this.peerId) return;
                this.routeIncomingPacket(packet);
            };
        }

        // 2. Прямое подключение к глобальному Pub/Sub-брокеру через встроенный WebSocket
        this.connectToBroker();
    },

    // Упаковка строки в UTF-8 с 2-байтовым префиксом длины (стандарт протокола MQTT)
    encodeStr(str) {
        const bytes = new TextEncoder().encode(str);
        const out = new Uint8Array(2 + bytes.length);
        out[0] = (bytes.length >> 8) & 0xff;
        out[1] = bytes.length & 0xff;
        out.set(bytes, 2);
        return out;
    },

    // Кодирование переменной длины пакета
    encodeRemainingLength(len) {
        const res = [];
        do {
            let byte = len % 128;
            len = Math.floor(len / 128);
            if (len > 0) byte |= 128;
            res.push(byte);
        } while (len > 0);
        return new Uint8Array(res);
    },

    buildConnectPacket(clientId) {
        const proto = this.encodeStr('MQTT');
        const flags = new Uint8Array([4, 2, 0, 60]); // v3.1.1, CleanSession, KeepAlive 60s
        const cid = this.encodeStr(clientId);
        const bodyLen = proto.length + flags.length + cid.length;
        const remLen = this.encodeRemainingLength(bodyLen);

        const pkt = new Uint8Array(1 + remLen.length + bodyLen);
        pkt[0] = 0x10; // CONNECT
        pkt.set(remLen, 1);
        pkt.set(proto, 1 + remLen.length);
        pkt.set(flags, 1 + remLen.length + proto.length);
        pkt.set(cid, 1 + remLen.length + proto.length + flags.length);
        return pkt;
    },

    buildSubscribePacket(topic) {
        const topicBytes = this.encodeStr(topic);
        const bodyLen = 2 + topicBytes.length + 1;
        const remLen = this.encodeRemainingLength(bodyLen);

        const pkt = new Uint8Array(1 + remLen.length + bodyLen);
        pkt[0] = 0x82; // SUBSCRIBE
        pkt.set(remLen, 1);
        pkt[1 + remLen.length] = 0x00;
        pkt[2 + remLen.length] = 0x01;
        pkt.set(topicBytes, 3 + remLen.length);
        pkt[3 + remLen.length + topicBytes.length] = 0x00; // QoS 0
        return pkt;
    },

    buildPublishPacket(topic, jsonStr) {
        const topicBytes = this.encodeStr(topic);
        const payloadBytes = new TextEncoder().encode(jsonStr);
        const bodyLen = topicBytes.length + payloadBytes.length;
        const remLen = this.encodeRemainingLength(bodyLen);

        const pkt = new Uint8Array(1 + remLen.length + bodyLen);
        pkt[0] = 0x30; // PUBLISH QoS 0
        pkt.set(remLen, 1);
        pkt.set(topicBytes, 1 + remLen.length);
        pkt.set(payloadBytes, 1 + remLen.length + topicBytes.length);
        return pkt;
    },

    connectToBroker() {
        if (this.ws) {
            try { this.ws.close(); } catch (e) {}
        }

        const url = this.BROKERS[this.brokerIndex % this.BROKERS.length];
        this.updateStatusBadge(`Подключение (${(this.brokerIndex % this.BROKERS.length) + 1}/${this.BROKERS.length})...`);

        try {
            this.ws = new WebSocket(url, 'mqtt');
            this.ws.binaryType = 'arraybuffer';
        } catch (e) {
            this.fallbackToLocalOnly();
            return;
        }

        const timeout = setTimeout(() => {
            if (!this.isConnected) {
                try { this.ws.close(); } catch (e) {}
                this.nextBroker();
            }
        }, 4500);

        this.ws.onopen = () => {
            this.ws.send(this.buildConnectPacket('gpu_' + this.peerId));
        };

        this.ws.onmessage = (event) => {
            const buf = new Uint8Array(event.data);
            if (!buf || buf.length < 2) return;
            const packetType = buf[0] >> 4;

            // CONNACK (тип 2) — сервер подтвердил подключение!
            if (packetType === 2 && buf[3] === 0) {
                clearTimeout(timeout);
                this.isConnected = true;
                this.ws.send(this.buildSubscribePacket(this.TOPIC));
                this.broadcastState('hello');
                this.startSwarmLoop();
                this.updateStatusBadge("Онлайн (1)");
                addLog("🌐 Подключено к глобальной сети <b>GPU Tycoon Swarm</b>!");
                return;
            }

            // PUBLISH (тип 3) — пришло сообщение от другого игрока в мире!
            if (packetType === 3) {
                try {
                    let pos = 1;
                    while (buf[pos] & 128) pos++;
                    pos++;
                    const topicLen = (buf[pos] << 8) | buf[pos + 1];
                    pos += 2 + topicLen;
                    const text = new TextDecoder().decode(buf.slice(pos));
                    const packet = JSON.parse(text);
                    if (packet && packet.senderId !== this.peerId) {
                        this.routeIncomingPacket(packet);
                    }
                } catch (e) {}
            }
        };

        this.ws.onerror = () => clearTimeout(timeout);
        this.ws.onclose = () => {
            clearTimeout(timeout);
            if (this.isConnected) {
                this.isConnected = false;
                setTimeout(() => this.connectToBroker(), 2000);
            } else {
                this.nextBroker();
            }
        };
    },

    nextBroker() {
        this.brokerIndex++;
        if (this.brokerIndex < this.BROKERS.length * 2) {
            setTimeout(() => this.connectToBroker(), 800);
        } else {
            this.fallbackToLocalOnly();
        }
    },

    fallbackToLocalOnly() {
        this.isConnected = true;
        this.broadcastState('hello');
        this.startSwarmLoop();
        this.updateStatusBadge("Локальная сеть (1)");
    },

    routeIncomingPacket(packet) {
        if (packet.channel === 'world') this.handleWorldMessage(packet);
        else if (packet.channel === 'trade') this.handleTradeMessage(packet);
    },

    startSwarmLoop() {
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

        this.heartbeatTimer = setInterval(() => {
            this.cleanupDeadPeers();

            // Пинг для поддержания соединения с брокером
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(new Uint8Array([0xC0, 0x00])); // PINGREQ
            }

            const activeCount = Object.keys(this.peers).length + 1;
            const sendChance = 1 / Math.min(activeCount, 10);
            if (Math.random() <= sendChance) {
                this.broadcastState('sync');
            }
        }, 4000);
    },

    getMyProfileInfo() {
        if (typeof ProfileSystem !== 'undefined' && ProfileSystem.user) {
            return {
                nickname: ProfileSystem.user.nickname,
                avatar: ProfileSystem.user.avatar
            };
        }
        return {
            nickname: "Игрок_" + this.peerId.slice(-4).toUpperCase(),
            avatar: "🧑‍💻"
        };
    },

    getMyFlagshipInfo() {
        const player = MarketSystem.competitors.find(c => c.id === 'player');
        return {
            power: player ? player.power : 0,
            flagship: player ? player.flagship : "Нет релизов"
        };
    },

    broadcastState(eventType = 'sync', extraText = '') {
        const prof = this.getMyProfileInfo();
        const ship = this.getMyFlagshipInfo();

        if (typeof ProfileSystem !== 'undefined') {
            ProfileSystem.syncMyProgressToRegistry();
        }

        const packet = {
            channel: 'world',
            type: eventType,
            senderId: this.peerId,
            nickname: prof.nickname,
            avatar: prof.avatar,
            year: year,
            money: money,
            power: ship.power,
            flagship: ship.flagship,
            news: extraText,
            registry: (typeof ProfileSystem !== 'undefined') ? ProfileSystem.accountsRegistry : {},
            ts: Date.now()
        };

        if (this.localChannel) {
            this.localChannel.postMessage(packet);
        }
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(this.buildPublishPacket(this.TOPIC, JSON.stringify(packet)));
        }
    },
    // Обработка данных от других игроков в сети
    handleWorldMessage(msg) {
        const isNewPeer = !this.peers[msg.senderId];

        // Объединяем реестр аккаунтов с данными из сети (защита от одинаковых ников + вход по паролю)
        if (msg.registry && typeof ProfileSystem !== 'undefined') {
            ProfileSystem.mergeRegistry(msg.registry);
        }

        this.peers[msg.senderId] = {
            peerId: msg.senderId,
            nickname: msg.nickname,
            avatar: msg.avatar || "🧑‍💻",
            power: msg.power || 0,
            flagship: msg.flagship || "Нет релизов",
            money: msg.money || 4000,
            lastSeen: Date.now()
        };

        // Синхронизация единого года (берём максимальный актуальный год из роя)
        if (msg.year && msg.year > year) {
            year = msg.year;
            if (yearEl) yearEl.textContent = year;
        }

        // Если зашёл новичок — делимся с ним текущим состоянием мира и реестром аккаунтов
        if (msg.type === 'hello' && isNewPeer) {
            setTimeout(() => this.broadcastState('sync'), 300 + Math.random() * 700);
        }

        // Если кто-то выпустил новую видеокарту — показываем в новостях
        if (msg.type === 'release' && msg.news) {
            MarketSystem.lastNews = msg.news;
            addLog(`📡 <b>[Сеть]</b> ${msg.news}`);
        }

        this.recalculateGlobalMarket();
        const modeLabel = (this.ws && this.ws.readyState === WebSocket.OPEN) ? "Онлайн" : "Локальная сеть";
        this.updateStatusBadge(`${modeLabel} (${Object.keys(this.peers).length + 1})`);

        // Если окно рынка сейчас открыто — обновляем его в реальном времени
        if (marketModal && !marketModal.classList.contains('hidden')) {
            renderMarketModal();
        }
    },

    cleanupDeadPeers() {
        const now = Date.now();
        let changed = false;
        for (const [id, peer] of Object.entries(this.peers)) {
            if (now - peer.lastSeen > 18000) {
                delete this.peers[id];
                changed = true;
            }
        }
        if (changed) {
            this.recalculateGlobalMarket();
            const modeLabel = (this.ws && this.ws.readyState === WebSocket.OPEN) ? "Онлайн" : "Локальная сеть";
            this.updateStatusBadge(`${modeLabel} (${Object.keys(this.peers).length + 1})`);
        }
    },

    // Распределённый пересчёт долей рынка между ИИ-ботами и всеми живыми игроками
    recalculateGlobalMarket() {
        const peerList = Object.values(this.peers);
        const me = MarketSystem.competitors.find(c => c.id === 'player');
        if (!me) return;

        // Удаляем старые записи живых игроков перед обновлением списка
        MarketSystem.competitors = MarketSystem.competitors.filter(c => !c.isRemotePlayer);

        // Если в сети нет других игроков — работает стандартный одиночный баланс
        if (peerList.length === 0) return;

        const nv = MarketSystem.competitors.find(c => c.id === 'nvidia');
        const amd = MarketSystem.competitors.find(c => c.id === 'amd');
        const intel = MarketSystem.competitors.find(c => c.id === 'intel');

        // После 2020 года ИИ-корпорации держат ровно 15% (7% + 5% + 3%), а 85% делят игроки
        let botsShare = 15;
        if (year <= 2020) {
            botsShare = Math.max(25, 80 - peerList.length * 8);
            if (nv) nv.share = Math.round(botsShare * 0.50);
            if (amd) amd.share = Math.round(botsShare * 0.35);
            if (intel) intel.share = Math.max(1, botsShare - nv.share - amd.share);
        } else {
            if (nv) nv.share = 7;
            if (amd) amd.share = 5;
            if (intel) intel.share = 3;
        }

        const playersPoolShare = 100 - ((nv?.share || 0) + (amd?.share || 0) + (intel?.share || 0));

        // Считаем общую мощность видеокарт всех игроков в сети (минимум 100 для базовой доли)
        const myEffectivePower = Math.max(100, me.power || 0);
        let totalPlayersPower = myEffectivePower;
        peerList.forEach(p => {
            totalPlayersPower += Math.max(100, p.power || 0);
        });

        // Вычисляем долю текущего игрока
        me.share = Math.max(1, Math.round((myEffectivePower / totalPlayersPower) * playersPoolShare));
        let distributed = me.share;

        // Вычисляем долю каждого онлайн-соперника
        peerList.forEach((p, idx) => {
            const pPower = Math.max(100, p.power || 0);
            let share = Math.max(1, Math.round((pPower / totalPlayersPower) * playersPoolShare));

            if (idx === peerList.length - 1) {
                share = Math.max(1, playersPoolShare - distributed);
            }
            distributed += share;

            MarketSystem.competitors.push({
                id: p.peerId,
                peerId: p.peerId,
                isRemotePlayer: true,
                name: `${p.avatar} ${p.nickname} (Игрок)`,
                color: "#38bdf8",
                share: share,
                flagship: p.flagship || "Нет релизов",
                power: p.power || 0
            });
        });

        if (myShareBadge) {
            myShareBadge.textContent = `${me.share}%`;
        }
    },

    // Отправка предложения/поставки компонентов другому живому игроку
    sendTradeToPlayer(targetPeerId, partKey, amount, unitPrice) {
        const spec = PART_CATALOG[partKey];
        const prof = this.getMyProfileInfo();

        const tradePacket = {
            room: this.ROOM_SIGNATURE,
            channel: 'trade',
            type: 'direct_sale',
            senderId: this.peerId,
            senderName: `${prof.avatar} ${prof.nickname}`,
            targetId: targetPeerId,
            partKey: partKey,
            partSpec: {
                name: spec.name,
                category: spec.category || 'Деталь',
                icon: spec.icon,
                role: spec.role,
                cost: spec.cost,
                power: spec.power,
                heat: spec.heat,
                coolRadius: spec.coolRadius || 0,
                noWireNeeded: spec.noWireNeeded || false,
                color: spec.color,
                pins: spec.pins || []
            },
            amount: amount,
            unitPrice: unitPrice,
            ts: Date.now()
        };

        if (this.localChannel) {
            this.localChannel.postMessage(tradePacket);
        }
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(tradePacket));
        }
    },

    // Получение компонентов от другого игрока по сети
    handleTradeMessage(msg) {
        if (msg.targetId !== this.peerId) return;

        if (msg.type === 'direct_sale') {
            // Если продавец прислал свой уникальный чип из Chip Fab — регистрируем его в каталоге получателя!
            if (!PART_CATALOG[msg.partKey] && msg.partSpec) {
                PART_CATALOG[msg.partKey] = Object.assign({ researchCost: 0 }, msg.partSpec);
                unlockedParts.add(msg.partKey);
                buildToolbar();
            }

            if (typeof FactorySystem !== 'undefined') {
                FactorySystem.inventory[msg.partKey] = (FactorySystem.inventory[msg.partKey] || 0) + msg.amount;
                FactorySystem.updateBadge();
            }

            addLog(
                `📦 <b>[P2P-Поставка]</b> Игрок <strong>${msg.senderName}</strong> передал на ваш склад <strong>${msg.partSpec.icon} ${msg.partSpec.name} (${msg.amount} шт.)</strong>!`
            );
        }
    },

    updateStatusBadge(text) {
        const el = document.getElementById('p2p-status-badge');
        if (el) {
            el.textContent = text;
        }
    }
};

window.addEventListener('DOMContentLoaded', () => {
    P2PNetwork.init();
});
