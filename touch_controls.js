// МОДУЛЬ 8: Адаптация управления под сенсорные экраны (смартфоны и планшеты)

const TouchControls = {
    longPressTimer: null,
    touchStartPos: { x: 0, y: 0 },
    isDraggingOrWiring: false,
    LONG_PRESS_MS: 500,

    init() {
        this.injectTouchStyles();
        this.bindCanvasTouch();
        this.observeNodes();
    },

    // Увеличиваем размер пинов на сенсорных экранах, чтобы в них было легко попадать пальцем
    injectTouchStyles() {
        const style = document.createElement('style');
        style.textContent = `
            @media (pointer: coarse) {
                .pin {
                    width: 18px !important;
                    height: 18px !important;
                }
                .pcb-node {
                    touch-action: none;
                }
            }
            #pcb-canvas {
                touch-action: none;
            }
        `;
        document.head.appendChild(style);
    },

    // Следим за появлением новых деталей на плате и вешаем на них touch-обработчики
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

            // 1. Касание самой детали (перетаскивание + долгое нажатие для удаления)
            el.addEventListener('touchstart', (e) => {
                if (e.target.classList.contains('pin')) return;
                if (e.touches.length !== 1) return;

                e.preventDefault();
                const touch = e.touches[0];
                this.touchStartPos = { x: touch.clientX, y: touch.clientY };
                this.isDraggingOrWiring = false;

                draggedNode = nodeObj;
                const rect = el.getBoundingClientRect();
                dragOffset.x = touch.clientX - rect.left;
                dragOffset.y = touch.clientY - rect.top;

                // Долгое нажатие (0.5 сек) без сдвига — удаляем деталь
                this.clearLongPress();
                this.longPressTimer = setTimeout(() => {
                    if (!this.isDraggingOrWiring) {
                        draggedNode = null;
                        nodes = nodes.filter(n => n.uid !== uid);
                        WireSystem.removeWiresForNode(uid);
                        if (navigator.vibrate) navigator.vibrate(40);
                        renderBoard();
                    }
                }, this.LONG_PRESS_MS);
            }, { passive: false });

            // 2. Касание точек (пинов) детали — тянем провод или отключаем долгим нажатием
            const pinEls = el.querySelectorAll('.pin');
            pinEls.forEach(pinEl => {
                const pinId = pinEl.dataset.pinId;

                pinEl.addEventListener('touchstart', (e) => {
                    if (e.touches.length !== 1) return;
                    e.preventDefault();
                    e.stopPropagation();

                    const touch = e.touches[0];
                    this.touchStartPos = { x: touch.clientX, y: touch.clientY };
                    this.isDraggingOrWiring = false;

                    // Если пин уже занят — долгое нажатие отсоединит провод
                    if (WireSystem.isPinOccupied(uid, pinId, false)) {
                        this.clearLongPress();
                        this.longPressTimer = setTimeout(() => {
                            if (!this.isDraggingOrWiring) {
                                WireSystem.disconnectPin(uid, pinId);
                                if (navigator.vibrate) navigator.vibrate(40);
                            }
                        }, this.LONG_PRESS_MS);
                        return;
                    }

                    // Начинаем тянуть провод от пина
                    WireSystem.startWiring(uid, pinId);
                }, { passive: false });
            });
        });
    },
    bindCanvasTouch() {
        // Движение пальца по экрану (перетаскиваем деталь или тянем провод с магнитом)
        window.addEventListener('touchmove', (e) => {
            if (!draggedNode && !WireSystem.wiringStart) return;
            if (e.touches.length !== 1) return;

            e.preventDefault();
            const touch = e.touches[0];
            const moveDist = Math.hypot(
                touch.clientX - this.touchStartPos.x,
                touch.clientY - this.touchStartPos.y
            );

            if (moveDist > 8) {
                this.isDraggingOrWiring = true;
                this.clearLongPress();
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

        // Отпускание пальца (фиксируем деталь или соединяем провод)
        window.addEventListener('touchend', (e) => {
            this.clearLongPress();
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
            this.clearLongPress();
            draggedNode = null;
            WireSystem.cancelWiring();
        });
    },

    clearLongPress() {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    }
};

window.addEventListener('DOMContentLoaded', () => {
    TouchControls.init();
});
