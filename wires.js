// МОДУЛЬ 2: Система проводов, магнитная привязка и зоны охлаждения

// МОДУЛЬ 2: Система проводов, магнитная привязка, Pro-Шина и зоны охлаждения

const WireSystem = {
    wires: [],
    wiringStart: null,
    mousePos: { x: 0, y: 0 },
    snapTarget: null,
    hoveredWireId: null,
    SNAP_RADIUS: 45,

    reset() {
        this.wires = [];
        this.hoveredWireId = null;
        this.cancelWiring();
        this.render();
    },

    syncCanvasSize() {
        if (!wiresLayer || !canvasEl) return;
        const rect = canvasEl.getBoundingClientRect();
        if (wiresLayer.width !== rect.width || wiresLayer.height !== rect.height) {
            wiresLayer.width = rect.width;
            wiresLayer.height = rect.height;
        }
    },

    // Проверка, является ли деталь Pro-Шиной
    isProHubNode(nodeUid) {
        const node = nodes.find(n => n.uid === nodeUid);
        if (!node) return false;
        const spec = PART_CATALOG[node.type];
        return Boolean(spec && spec.isProHub);
    },

    // Проверка, занята ли точка (с учетом обхода блокировки для Pro-Шины)
    isPinOccupied(nodeUid, pinId, bypassForProHub = false) {
        const node = nodes.find(n => n.uid === nodeUid);
        if (!node) return true;
        const spec = PART_CATALOG[node.type];

        // Обычный хаб и Pro-Шина принимают сколько угодно проводов в свои точки
        if (spec && spec.role === 'hub') return false;

        // Если соединение идет с участием Pro-Шины — игнорируем блокировку чужой точки!
        if (bypassForProHub || (this.wiringStart && this.isProHubNode(this.wiringStart.nodeUid))) {
            return false;
        }

        return this.wires.some(w =>
            (w.fromNode === nodeUid && w.fromPin === pinId) ||
            (w.toNode === nodeUid && w.toPin === pinId)
        );
    },

    findNearestPin(mouseX, mouseY, excludeNodeUid) {
        let bestTarget = null;
        let minDist = this.SNAP_RADIUS;
        const isProSource = this.isProHubNode(excludeNodeUid);

        nodes.forEach(node => {
            if (node.uid === excludeNodeUid) return;
            const spec = PART_CATALOG[node.type];
            if (!spec || spec.noWireNeeded || !spec.pins || spec.pins.length === 0) return;

            const bypass = isProSource || Boolean(spec.isProHub);

            spec.pins.forEach(pin => {
                if (this.isPinOccupied(node.uid, pin.id, bypass)) return;

                const pos = this.getPinCoords(node.uid, pin.id);
                const dist = Math.hypot(pos.x - mouseX, pos.y - mouseY);
                if (dist < minDist) {
                    minDist = dist;
                    bestTarget = { nodeUid: node.uid, pinId: pin.id, x: pos.x, y: pos.y };
                }
            });
        });

        return bestTarget;
    },

    findClosestPinOnNode(nodeUid, mouseX, mouseY) {
        const node = nodes.find(n => n.uid === nodeUid);
        if (!node) return null;
        const spec = PART_CATALOG[node.type];
        if (!spec || !spec.pins || spec.pins.length === 0) return null;

        const isProSource = this.wiringStart ? this.isProHubNode(this.wiringStart.nodeUid) : false;
        const bypass = isProSource || Boolean(spec.isProHub);

        let bestPin = null;
        let minDist = Infinity;

        spec.pins.forEach(pin => {
            if (this.isPinOccupied(nodeUid, pin.id, bypass)) return;

            const pos = this.getPinCoords(nodeUid, pin.id);
            const dist = Math.hypot(pos.x - mouseX, pos.y - mouseY);
            if (dist < minDist) {
                minDist = dist;
                bestPin = pin.id;
            }
        });

        return bestPin;
    },

    startWiring(nodeUid, pinId) {
        if (this.isPinOccupied(nodeUid, pinId, false)) {
            addLog("Эта точка уже занята! Нажмите по ней ПКМ или используйте Pro-Шину 3x.", true);
            return;
        }

        this.cancelWiring();
        const pos = this.getPinCoords(nodeUid, pinId);
        this.wiringStart = { nodeUid, pinId };
        this.mousePos = { x: pos.x, y: pos.y };
        this.render();
    },

    updateTempWire(mouseX, mouseY) {
        if (!this.wiringStart) return;
        this.mousePos = { x: mouseX, y: mouseY };

        const snap = this.findNearestPin(mouseX, mouseY, this.wiringStart.nodeUid);
        this.clearSnapHighlight();

        if (snap) {
            this.snapTarget = snap;
            const pinEl = this.getPinElement(snap.nodeUid, snap.pinId);
            if (pinEl) pinEl.classList.add('pin-snap');
        } else {
            this.snapTarget = null;
        }

        this.render();
    },

    finishWiring(targetNodeUid = null, targetPinId = null, mouseX = 0, mouseY = 0) {
        if (!this.wiringStart) return;

        let finalNode = targetNodeUid;
        let finalPin = targetPinId;

        if (!finalNode && this.snapTarget) {
            finalNode = this.snapTarget.nodeUid;
            finalPin = this.snapTarget.pinId;
        } else if (finalNode && !finalPin) {
            finalPin = this.findClosestPinOnNode(finalNode, mouseX, mouseY);
        }

        if (finalNode && finalPin && finalNode !== this.wiringStart.nodeUid) {
            const bypass = this.isProHubNode(this.wiringStart.nodeUid) || this.isProHubNode(finalNode);
            if (!this.isPinOccupied(finalNode, finalPin, bypass)) {
                this.connect(this.wiringStart.nodeUid, this.wiringStart.pinId, finalNode, finalPin);
            }
        }

        this.cancelWiring();
    },

    connect(fromNode, fromPin, toNode, toPin) {
        // Разрешаем несколько проводов к Pro-Шине, но запрещаем дубли между одними и теми же двумя точками
        const exists = this.wires.some(w =>
            (w.fromNode === fromNode && w.fromPin === fromPin && w.toNode === toNode && w.toPin === toPin) ||
            (w.fromNode === toNode && w.fromPin === toPin && w.toNode === fromNode && w.toPin === fromPin)
        );
        if (exists) return;

        this.wires.push({
            id: 'wire_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
            fromNode,
            fromPin,
            toNode,
            toPin
        });

        this.render();
        onCircuitChanged();
    },


    disconnectPin(nodeUid, pinId) {
        const prevLen = this.wires.length;
        this.wires = this.wires.filter(w =>
            !(w.fromNode === nodeUid && w.fromPin === pinId) &&
            !(w.toNode === nodeUid && w.toPin === pinId)
        );
        if (this.wires.length !== prevLen) {
            this.render();
            onCircuitChanged();
        }
    },

    removeWiresForNode(nodeUid) {
        this.wires = this.wires.filter(w => w.fromNode !== nodeUid && w.toNode !== nodeUid);
        this.render();
    },

    findWireAt(x, y, maxDist = 10) {
        for (let i = this.wires.length - 1; i >= 0; i--) {
            const w = this.wires[i];
            const p1 = this.getPinCoords(w.fromNode, w.fromPin);
            const p2 = this.getPinCoords(w.toNode, w.toPin);
            if (this.distToSegment(x, y, p1.x, p1.y, p2.x, p2.y) <= maxDist) {
                return w;
            }
        }
        return null;
    },

    distToSegment(px, py, x1, y1, x2, y2) {
        const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
        if (l2 === 0) return Math.hypot(px - x1, py - y1);
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
    },

    updateHover(mouseX, mouseY) {
        if (this.wiringStart) return;
        const wire = this.findWireAt(mouseX, mouseY);
        const newHoverId = wire ? wire.id : null;
        if (this.hoveredWireId !== newHoverId) {
            this.hoveredWireId = newHoverId;
            this.render();
        }
    },

    removeHoveredWire() {
        if (!this.hoveredWireId) return false;
        this.wires = this.wires.filter(w => w.id !== this.hoveredWireId);
        this.hoveredWireId = null;
        this.render();
        onCircuitChanged();
        return true;
    },

    cancelWiring() {
        this.clearSnapHighlight();
        this.snapTarget = null;
        this.wiringStart = null;
        this.render();
    },

    clearSnapHighlight() {
        document.querySelectorAll('.pin-snap').forEach(el => el.classList.remove('pin-snap'));
    },

    getPinElement(nodeUid, pinId) {
        const nodeEl = nodesLayer.querySelector(`.pcb-node[data-uid="${nodeUid}"]`);
        return nodeEl ? nodeEl.querySelector(`.pin[data-pin-id="${pinId}"]`) : null;
    },

    getPinCoords(nodeUid, pinId) {
        const pinEl = this.getPinElement(nodeUid, pinId);
        if (!pinEl) return { x: 0, y: 0 };
        const canvasRect = canvasEl.getBoundingClientRect();
        const pinRect = pinEl.getBoundingClientRect();

        return {
            x: (pinRect.left - canvasRect.left) + (pinRect.width / 2),
            y: (pinRect.top - canvasRect.top) + (pinRect.height / 2)
        };
    },

    render() {
        if (!wiresLayer || !wiresLayer.getContext) return;
        this.syncCanvasSize();

        const ctx = wiresLayer.getContext('2d');
        ctx.clearRect(0, 0, wiresLayer.width, wiresLayer.height);

        // 0. Рисуем радиус воздушного потока вокруг каждого кулера
        nodes.forEach(node => {
            const spec = PART_CATALOG[node.type];
            if (spec && spec.role === 'cooler' && spec.coolRadius) {
                const center = CircuitEngine.getNodeCenter(node);

                ctx.save();
                ctx.beginPath();
                ctx.arc(center.x, center.y, spec.coolRadius, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(6, 182, 212, 0.09)';
                ctx.fill();

                ctx.strokeStyle = 'rgba(34, 211, 238, 0.45)';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([6, 6]); // Исправлено: передан массив пунктира!
                ctx.stroke();
                ctx.restore();
            }
        });

        // Обновляем визуальный вид занятых точек
        document.querySelectorAll('.pin').forEach(pinEl => {
            const nodeEl = pinEl.closest('.pcb-node');
            if (nodeEl) {
                const occupied = this.isPinOccupied(nodeEl.dataset.uid, pinEl.dataset.pinId);
                pinEl.classList.toggle('pin-occupied', occupied);
            }
        });

        // 1. Рисуем постоянные провода
        this.wires.forEach(w => {
            const p1 = this.getPinCoords(w.fromNode, w.fromPin);
            const p2 = this.getPinCoords(w.toNode, w.toPin);
            const isHovered = (w.id === this.hoveredWireId);

            const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const baseColor = len > 210 ? '#f97316' : '#fbbf24';

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = isHovered ? '#f87171' : baseColor;
            ctx.lineWidth = isHovered ? 7 : 5;
            ctx.lineCap = 'round';
            ctx.shadowColor = isHovered ? 'rgba(248, 113, 113, 0.8)' : 'rgba(251, 191, 36, 0.5)';
            ctx.shadowBlur = 8;
            ctx.stroke();
            ctx.restore();
        });

// 2. Рисуем тянущийся провод
if (this.wiringStart) {
const startPos = this.getPinCoords(this.wiringStart.nodeUid, this.wiringStart.pinId);
const endPos = this.snapTarget ? { x: this.snapTarget.x, y: this.snapTarget.y } : this.mousePos;
ctx.save();
ctx.beginPath();
ctx.moveTo(startPos.x, startPos.y);
ctx.lineTo(endPos.x, endPos.y);
ctx.strokeStyle = this.snapTarget ? '#4ade80' : '#38bdf8';
ctx.lineWidth = 4;
ctx.setLineDash([6, 4]); // Исправлено: передан массив пунктира!
ctx.lineCap = 'round';
ctx.stroke();
ctx.restore();
}
}
};