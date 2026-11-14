// МОДУЛЬ 7: Децентрализованный P2P-мультиплеер (Онлайн + Офлайн компании + Синхронизация эпохи + Вайп)

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
        // Сразу строим рынок с учётом сохранённых офлайн-компаний из реестра
        this.recalculateGlobalMarket();

        if (typeof BroadcastChannel !== 'undefined') {
            this.localChannel = new BroadcastChannel('gpu_tycoon_local_swarm');
            this.localChannel.onmessage = (event) => {
                const packet = event.data;
                if (!packet || packet.senderId === this.peerId) return;
                this.routeIncomingPacket(packet);
            };
        }

        this.connectToBroker();
    },

    encodeStr(str) {
        const bytes = new TextEncoder().encode(str);
        const out = new Uint8Array(2 + bytes.length);
        out = (bytes.length >> 8) & 0xff;
        out = bytes.length & 0xff;
        out.set(bytes, 2);
        return out;
    },

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
        const flags = new Uint8Array();
        const cid = this.encodeStr(clientId);
        const bodyLen = proto.length + flags.length + cid.length;
        const remLen = this.encodeRemainingLength(bodyLen);

        const pkt = new Uint8Array(1 + remLen.length + bodyLen);
        pkt = 0x10;
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
        pkt = 0x82;
        pkt.set(remLen, 1);
        pkt[1 + remLen.length] = 0x00;
        pkt[2 + remLen.length] = 0x01;
        pkt.set(topicBytes, 3 + remLen.length);
        pkt[3 + remLen.length + topicBytes.length] = 0x00;
        return pkt;
    },

    buildPublishPacket(topic, jsonStr) {
        const topicBytes = this.encodeStr(topic);
        const payloadBytes = new TextEncoder().encode(jsonStr);
        const bodyLen = topicBytes.length + payloadBytes.length;
        const remLen = this.encodeRemainingLength(bodyLen);

        const pkt = new Uint8Array(1 + remLen.length + bodyLen);
        pkt = 0x30;
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
            const packetType = buf >> 4;

            if (packetType === 2 && buf === 0) {
                clearTimeout(timeout);
                this.isConnected = true;
                this.ws.send(this.buildSubscribePacket(this.TOPIC));
                this.broadcastState('hello');
                this.startSwarmLoop();
                this.updateStatusBadge("Онлайн (1)");
                addLog("🌐 Подключено к глобальной сети <b>GPU Tycoon Swarm</b>!");
                return;
            }

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

            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(new Uint8Array([0xC0, 0x00]));
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
            reputation: reputation,
            power: ship.power,
            flagship: ship.flagship,
            news: extraText,
            worldEpoch: (typeof ProfileSystem !== 'undefined') ? ProfileSystem.worldEpoch : 1,
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
    // Обработка данных от других игроков (включая синхронизацию эпохи, вайп и своего аккаунта)
    handleWorldMessage(msg) {
        // 1. Проверяем, не был ли запущен глобальный вайп администратором
        if (typeof ProfileSystem !== 'undefined' && msg.worldEpoch) {
            if (msg.worldEpoch > ProfileSystem.worldEpoch) {
                ProfileSystem.applyGlobalWipe(msg.worldEpoch);
                return;
            } else if (msg.worldEpoch < ProfileSystem.worldEpoch) {
                // Если к нам подключился игрок из старой эпохи — отправляем ему актуальный вайп
                setTimeout(() => this.broadcastState('global_wipe'), 300);
                return;
            }
        }

        // 2. Синхронизация единого года (берём максимальный актуальный год из роя и сохраняем)
        if (msg.year && msg.year > year) {
            year = msg.year;
            if (yearEl) yearEl.textContent = year;
            if (typeof ProfileSystem !== 'undefined') ProfileSystem.saveGameProgress();
        }

        // 3. Если пакет пришёл от нашего же аккаунта с другого устройства (например, с ПК на телефон) — подтягиваем свежий прогресс!
        const myProf = this.getMyProfileInfo();
        if (msg.nickname && myProf.nickname && msg.nickname.toLowerCase() === myProf.nickname.toLowerCase()) {
            const me = MarketSystem.competitors.find(c => c.id === 'player');
            if ((msg.power || 0) > (me?.power || 0) || (msg.year || 0) > year) {
                if (typeof msg.money === 'number') {
                    money = msg.money;
                    if (moneyEl) moneyEl.textContent = `$${money.toLocaleString()}`;
                }
                if (typeof msg.reputation === 'number') {
                    reputation = msg.reputation;
                    if (repEl) repEl.textContent = reputation;
                }
                if (me && msg.flagship) {
                    me.flagship = msg.flagship;
                    me.power = msg.power || 0;
                }
                if (typeof ProfileSystem !== 'undefined') ProfileSystem.saveGameProgress();
                this.recalculateGlobalMarket();
            }
            if (msg.type === 'hello') {
                setTimeout(() => this.broadcastState('sync'), 300);
            }
            return;
        }

        // 4. Удаляем зависшую старую сессию этого игрока, если он перезагрузил страницу
        for (const [oldId, oldPeer] of Object.entries(this.peers)) {
            if (oldId !== msg.senderId && oldPeer.nickname && oldPeer.nickname.toLowerCase() === msg.nickname.toLowerCase()) {
                delete this.peers[oldId];
            }
        }

        const isNewPeer = !this.peers[msg.senderId];

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

        if (msg.type === 'hello' && isNewPeer) {
            setTimeout(() => this.broadcastState('sync'), 300 + Math.random() * 700);
        }

        if (msg.type === 'release' && msg.news) {
            MarketSystem.lastNews = msg.news;
            addLog(`📡 <b>[Сеть]</b> ${msg.news}`);
        }

        this.recalculateGlobalMarket();
        const modeLabel = (this.ws && this.ws.readyState === WebSocket.OPEN) ? "Онлайн" : "Локальная сеть";
        this.updateStatusBadge(`${modeLabel} (${Object.keys(this.peers).length + 1})`);

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

    // Расчёт долей рынка: участвуют и онлайн-игроки, и офлайн-компании из реестра
    recalculateGlobalMarket() {
        const me = MarketSystem.competitors.find(c => c.id === 'player');
        if (!me) return;

        MarketSystem.competitors = MarketSystem.competitors.filter(c => !c.isRemotePlayer);

        const myNickLower = (typeof ProfileSystem !== 'undefined' && ProfileSystem.user)
            ? ProfileSystem.user.nickname.toLowerCase()
            : '';

        // Собираем единую карту всех соперников (сначала из реестра как Офлайн, затем обновляем теми, кто Онлайн)
        const competitorsMap = new Map();

        if (typeof ProfileSystem !== 'undefined' && ProfileSystem.accountsRegistry) {
            for (const [nickKey, acc] of Object.entries(ProfileSystem.accountsRegistry)) {
                if (!acc || !acc.nickname || nickKey === myNickLower) continue;
                competitorsMap.set(nickKey, {
                    id: 'reg_' + nickKey,
                    peerId: null,
                    isOnline: false,
                    nickname: acc.nickname,
                    avatar: acc.avatar || "🧑‍💻",
                    power: acc.power || 0,
                    flagship: acc.flagship || "Нет релизов"
                });
            }
        }

        for (const p of Object.values(this.peers)) {
            const key = (p.nickname || '').toLowerCase();
            if (!key || key === myNickLower) continue;
            competitorsMap.set(key, {
                id: p.peerId,
                peerId: p.peerId,
                isOnline: true,
                nickname: p.nickname,
                avatar: p.avatar || "🧑‍💻",
                power: p.power || 0,
                flagship: p.flagship || "Нет релизов"
            });
        }

        const remotePlayers = Array.from(competitorsMap.values());
        if (remotePlayers.length === 0) return;

        const nv = MarketSystem.competitors.find(c => c.id === 'nvidia');
        const amd = MarketSystem.competitors.find(c => c.id === 'amd');
        const intel = MarketSystem.competitors.find(c => c.id === 'intel');

        const allParticipants = [
            { isMe: true, ref: me, power: me.power || 0 },
            ...remotePlayers.map(p => ({ isMe: false, ref: p, power: p.power || 0 }))
        ];

        const activeBuilders = allParticipants.filter(x => x.power > 0);
        const newbies = allParticipants.filter(x => x.power <= 0);

        if (year <= 2020) {
            const botsShare = Math.max(25, 85 - activeBuilders.length * 10);
            if (nv) nv.share = Math.round(botsShare * 0.50);
            if (amd) amd.share = Math.round(botsShare * 0.35);
            if (intel) intel.share = Math.max(1, botsShare - nv.share - amd.share);
        } else {
            if (nv) nv.share = 7;
            if (amd) amd.share = 5;
            if (intel) intel.share = 3;
        }

        const totalPlayersPool = 100 - ((nv?.share || 0) + (amd?.share || 0) + (intel?.share || 0));
        const newbieShareEach = 1;
        const poolForBuilders = Math.max(activeBuilders.length, totalPlayersPool - newbies.length * newbieShareEach);
        const totalActivePower = activeBuilders.reduce((sum, x) => sum + x.power, 0);

        allParticipants.forEach(item => {
            if (item.power <= 0) {
                item.share = newbieShareEach;
            } else {
                item.share = Math.max(1, Math.round((item.power / totalActivePower) * poolForBuilders));
            }
        });

        const currentSum = allParticipants.reduce((s, x) => s + x.share, 0);
        const diff = totalPlayersPool - currentSum;
        if (activeBuilders.length > 0) {
            activeBuilders[0].share = Math.max(1, activeBuilders[0].share + diff);
        } else if (allParticipants.length > 0) {
            allParticipants[0].share = Math.max(1, allParticipants[0].share + diff);
        }

        me.share = allParticipants.find(x => x.isMe).share;

        allParticipants.filter(x => !x.isMe).forEach(item => {
            const p = item.ref;
            const statusTag = p.isOnline ? '🟢 Онлайн' : '⚪ Офлайн';
            MarketSystem.competitors.push({
                id: p.id,
                peerId: p.peerId,
                isRemotePlayer: true,
                isOnline: p.isOnline,
                name: `${p.avatar} ${p.nickname} (${statusTag})`,
                color: p.isOnline ? "#38bdf8" : "#94a3b8",
                share: item.share,
                flagship: p.flagship || "Нет релизов",
                power: p.power || 0
            });
        });

        if (myShareBadge) {
            myShareBadge.textContent = `${me.share}%`;
        }
    },

        sendTradeToPlayer(targetPeerId, partKey, amount, unitPrice) {
        if (!targetPeerId) {
            addLog("⚠️ Игрок сейчас офлайн — прямая поставка доступна только игрокам в сети!", true);
            return;
        }

        const spec = PART_CATALOG[partKey];
        const prof = this.getMyProfileInfo();

        const tradePacket = {
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
            this.ws.send(this.buildPublishPacket(this.TOPIC, JSON.stringify(tradePacket)));
        }
    },

    handleTradeMessage(msg) {
        if (msg.targetId !== this.peerId) return;

        if (msg.type === 'direct_sale') {
            if (!PART_CATALOG[msg.partKey] && msg.partSpec) {
                PART_CATALOG[msg.partKey] = Object.assign({ researchCost: 0 }, msg.partSpec);
                unlockedParts.add(msg.partKey);
                buildToolbar();
            }

            if (typeof FactorySystem !== 'undefined') {
                FactorySystem.inventory[msg.partKey] = (FactorySystem.inventory[msg.partKey] || 0) + msg.amount;
                FactorySystem.updateBadge();
            }

            if (typeof ProfileSystem !== 'undefined') ProfileSystem.saveGameProgress();

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
