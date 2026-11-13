// МОДУЛЬ 8: Сенсорное управление (перетаскивание, провода и удаление по двойному нажатию)

const TouchControls = {
    lastTapTime: 0,
    lastTapTarget: null,
    touchStartPos: { x: 0, y: 0 },
    hasMoved: false,
    DOUBLE_TAP_MS: 350,

    init() {
        this.injectTouchStyles();
        this.bindCanvasTouch();
        this.observeNodes();
    },

    injectTouchStyles() {
        const style = document.createElement('style');
        style.textContent = `
            @media (pointer: coarse) {
                .pin {
                    width: 20px !important;
                    height: 20px !important;
                }
                .pcb-node {
                    touch-action: none;
                    user-select: none;
                    -webkit-user-select: none;
                }
            }
            #pcb-canvas {
                touch-action: none;
            }
        `;
        document.head.appendChild(style);
    },

    observeNodes() {
        if (!nodesLayer) return;

        const observer = new MutationObserver(() => {
            this.attachNodeTouchEvents();
        });

        observer.observe(nodesLayer, { childList: true });
        this.attachNodeTouchEvents();
    },

    attachNodeTouchEvents() {
        const nodeEls = nodesLayer.querySelectorAll('.pcb-node');
        nodeEls.forEach(el => {
            if (el.dataset.touchBound) return;
            el.dataset.touchBound = 'true';

            const uid = el.dataset.uid;
            const nodeObj = nodes.find(n => n.uid === uid);
            if (!nodeObj) return;

            // 1. Касание самой детали (перетаскивание + двойной тап для удаления)
            el.addEventListener('touchstart', (e) => {
                if (e.target.classList.contains('pin')) return;
                if (e.touches.length !== 1) return;

                e.preventDefault();
                const now = Date.now();
                const isDoubleTap = (this.lastTapTarget === uid) && (now - this.lastTapTime < this.DOUBLE_TAP_MS);

                if (isDoubleTap) {
                    // Двойной тап по детали — удаляем её с платы!
                    this.lastTapTime = 0;
                    this.lastTapTarget = null;
                    draggedNode = null;
                    nodes = nodes.filter(n => n.uid !== uid);
                    WireSystem.removeWiresForNode(uid);
                    if (navigator.vibrate) navigator.vibrate(35);
                    renderBoard();
                    return;
                }

                this.lastTapTime = now;
                this.lastTapTarget = uid;

                const touch = e.touches[0];
                this.touchStartPos = { x: touch.clientX, y: touch.clientY };
                this.hasMoved = false;

                draggedNode = nodeObj;
                const rect = el.getBoundingClientRect();
                dragOffset.x = touch.clientX - rect.left;
                dragOffset.y = touch.clientY - rect.top;
            }, { passive: false });

            // 2. Касание точек (пинов) — тянем провод или отсоединяем провод двойным тапом
            const pinEls = el.querySelectorAll('.pin');
            pinEls.forEach(pinEl => {
                const pinId = pinEl.dataset.pinId;
                const pinKey = `${uid}_${pinId}`;

                pinEl.addEventListener('touchstart', (e) => {
                    if (e.touches.length !== 1) return;
                    e.preventDefault();
                    e.stopPropagation();

                    const now = Date.now();
                    const isDoubleTap = (this.lastTapTarget === pinKey) && (now - this.lastTapTime < this.DOUBLE_TAP_MS);

                    if (isDoubleTap) {
                        this.lastTapTime = 0;
                        this.lastTapTarget = null;
                        WireSystem.cancelWiring();
                        WireSystem.disconnectPin(uid, pinId);
                        if (navigator.vibrate) navigator.vibrate(35);
                        return;
                    }

                    this.lastTapTime = now;
                    this.lastTapTarget = pinKey;

                    const touch = e.touches[0];
                    this.touchStartPos = { x: touch.clientX, y: touch.clientY };
                    this.hasMoved = false;

                    WireSystem.startWiring(uid, pinId);
                }, { passive: false });
            });
        });
    },

    bindCanvasTouch() {
        window.addEventListener('touchmove', (e) => {
            if (!draggedNode && !WireSystem.wiringStart) return;
            if (e.touches.length !== 1) return;

            e.preventDefault();
            const touch = e.touches[0];
            const moveDist = Math.hypot(
                touch.clientX - this.touchStartPos.x,
                touch.clientY - this.touchStartPos.y
            );

            if (moveDist > 6) {
                this.hasMoved = true;
                // Если начали перетаскивать — сбрасываем таймер двойного тапа
                this.lastTapTime = 0;
            }

            const canvasRect = canvasEl.getBoundingClientRect();
            const touchX = touch.clientX - canvasRect.left;
            const touchY = touch.clientY - canvasRect.top;

            if (draggedNode) {
                draggedNode.x = Math.max(5, Math.min(canvasRect.width - 105, touchX - dragOffset.x));
                draggedNode.y = Math.max(5, Math.min(canvasRect.height - 55, touchY - dragOffset.y));

                const el = nodesLayer.querySelector(`.pcb-node[data-uid="${draggedNode.uid}"]`);
                if (el) {
                    el.style.left = draggedNode.x + 'px';
                    el.style.top = draggedNode.y + 'px';
                }
                WireSystem.render();
                onCircuitChanged();
            } else if (WireSystem.wiringStart) {
                WireSystem.updateTempWire(touchX, touchY);
            }
        }, { passive: false });

        window.addEventListener('touchend', (e) => {
            draggedNode = null;

            if (WireSystem.wiringStart) {
                if (WireSystem.snapTarget) {
                    WireSystem.finishWiring();
                    if (navigator.vibrate) navigator.vibrate(25);
                } else if (e.changedTouches && e.changedTouches.length > 0) {
                    const touch = e.changedTouches[0];
                    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);

                    if (targetEl && targetEl.classList.contains('pin')) {
                        const parentNode = targetEl.closest('.pcb-node');
                        if (parentNode && parentNode.dataset.uid !== WireSystem.wiringStart.nodeUid) {
                            WireSystem.finishWiring(parentNode.dataset.uid, targetEl.dataset.pinId);
                            if (navigator.vibrate) navigator.vibrate(25);
                            return;
                        }
                    } else if (targetEl && targetEl.closest('.pcb-node')) {
                        const parentNode = targetEl.closest('.pcb-node');
                        if (parentNode.dataset.uid !== WireSystem.wiringStart.nodeUid) {
                            const canvasRect = canvasEl.getBoundingClientRect();
                            WireSystem.finishWiring(
                                parentNode.dataset.uid,
                                null,
                                touch.clientX - canvasRect.left,
                                touch.clientY - canvasRect.top
                            );
                            if (navigator.vibrate) navigator.vibrate(25);
                            return;
                        }
                    }
                    WireSystem.cancelWiring();
                } else {
                    WireSystem.cancelWiring();
                }
            }
        });

        window.addEventListener('touchcancel', () => {
            draggedNode = null;
            WireSystem.cancelWiring();
        });
    }
};

window.addEventListener('DOMContentLoaded', () => {
    TouchControls.init();
});
