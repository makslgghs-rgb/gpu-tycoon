// МОДУЛЬ 1: Каталог компонентов (16 деталей)
// Параметр researchCost: 0 — открыто сразу; > 0 — изучается за деньги в отделе R&D.

const PART_CATALOG = {
    // ================= 1. ПРОЦЕССОРЫ (GPU ЧИПЫ) =================
    gpu: {
        name: "GPU 40нм (База)",
        category: "Процессор",
        icon: "🔲",
        role: "core",
        researchCost: 0,
        cost: 1000,
        power: 200,
        heat: 48,
        color: "#0284c7",
        maxCount: 1,
        pins: [
            { id: "p1", x: 0,   y: 50 },
            { id: "p2", x: 100, y: 50 },
            { id: "p3", x: 50,  y: 100 }
        ]
    },
    gpu_28nm: {
        name: "GPU 28нм Kepler",
        category: "Процессор",
        icon: "🔷",
        role: "core",
        researchCost: 2500,
        cost: 1600,
        power: 650,
        heat: 52,
        color: "#0ea5e9",
        maxCount: 1,
        pins: [
            { id: "p1", x: 0,   y: 50 },
            { id: "p2", x: 100, y: 50 },
            { id: "p3", x: 50,  y: 100 }
        ]
    },
    gpu_14nm: {
        name: "GPU 14нм Pascal",
        category: "Процессор",
        icon: "💠",
        role: "core",
        researchCost: 6500,
        cost: 2400,
        power: 1400,
        heat: 56,
        color: "#38bdf8",
        maxCount: 1,
        pins: [
            { id: "p1", x: 0,   y: 50 },
            { id: "p2", x: 100, y: 50 },
            { id: "p3", x: 50,  y: 100 }
        ]
    },
    gpu_5nm: {
        name: "GPU 5нм Ada",
        category: "Процессор",
        icon: "👑",
        role: "core",
        researchCost: 16000,
        cost: 3600,
        power: 2800,
        heat: 62,
        color: "#7dd3fc",
        maxCount: 1,
        pins: [
            { id: "p1", x: 0,   y: 50 },
            { id: "p2", x: 100, y: 50 },
            { id: "p3", x: 50,  y: 100 }
        ]
    },

    // ================= 2. ВИДЕОПАМЯТЬ (VRAM) =================
    vram: {
        name: "GDDR3 2ГБ",
        category: "Память",
        icon: "💾",
        role: "memory",
        researchCost: 0,
        cost: 400,
        power: 320,
        heat: 18,
        color: "#8b5cf6",
        pins: [
            { id: "p1", x: 0,   y: 50 },
            { id: "p2", x: 100, y: 50 }
        ]
    },
    vram_gddr5: {
        name: "GDDR5 4ГБ",
        category: "Память",
        icon: "💽",
        role: "memory",
        researchCost: 2000,
        cost: 700,
        power: 680,
        heat: 21,
        color: "#a855f7",
        pins: [
            { id: "p1", x: 0,   y: 50 },
            { id: "p2", x: 100, y: 50 }
        ]
    },
    vram_gddr6: {
        name: "GDDR6 8ГБ",
        category: "Память",
        icon: "📀",
        role: "memory",
        researchCost: 5500,
        cost: 1150,
        power: 1350,
        heat: 24,
        color: "#c084fc",
        pins: [
            { id: "p1", x: 0,   y: 50 },
            { id: "p2", x: 100, y: 50 }
        ]
    },
    vram_gddr7: {
        name: "GDDR7 16ГБ",
        category: "Память",
        icon: "💎",
        role: "memory",
        researchCost: 14000,
        cost: 1800,
        power: 2600,
        heat: 26,
        color: "#e879f9",
        pins: [
            { id: "p1", x: 0,   y: 50 },
            { id: "p2", x: 100, y: 50 }
        ]
    },
    // ================= 3. ПИТАНИЕ (VRM) =================
    vrm: {
        name: "VRM База",
        category: "Питание",
        icon: "⚡",
        role: "power",
        researchCost: 0,
        cost: 350,
        power: 60,
        heat: 16,
        color: "#eab308",
        pins: [
            { id: "p1", x: 50, y: 0 },
            { id: "p2", x: 50, y: 100 }
        ]
    },
    vrm_digital: {
        name: "VRM Digital",
        category: "Питание",
        icon: "🔌",
        role: "power",
        researchCost: 3000,
        cost: 650,
        power: 180,
        heat: 12,
        color: "#facc15",
        pins: [
            { id: "p1", x: 50, y: 0 },
            { id: "p2", x: 50, y: 100 }
        ]
    },
    vrm_gan: {
        name: "VRM GaN Pro",
        category: "Питание",
        icon: "🌩️",
        role: "power",
        researchCost: 8500,
        cost: 1100,
        power: 420,
        heat: 8,
        color: "#fde047",
        pins: [
            { id: "p1", x: 50, y: 0 },
            { id: "p2", x: 50, y: 100 }
        ]
    },

    // ================= 4. ШИНЫ И УСКОРИТЕЛИ =================
    hub: {
        name: "Узел (Шина)",
        category: "Шина",
        icon: "⭕",
        role: "hub",
        researchCost: 0,
        cost: 120,
        power: 0,
        heat: 4,
        color: "#f97316",
        isCompact: true,
        pins: [
            { id: "p1", x: 50, y: 50 }
        ]
    },
        pro_hub: {
        name: "Pro-Шина 3x",
        category: "Шина",
        icon: "⚛️",
        role: "hub",
        isProHub: true,       // Специальное свойство: пробивает занятые точки!
        researchCost: 3500,   // Стоимость изучения в отделе R&D
        cost: 280,
        power: 120,           // Небольшой бонус к скорости передачи данных
        heat: 5,
        color: "#fb923c",
        pins: [
            { id: "p1", x: 0,   y: 50 },
            { id: "p2", x: 50,  y: 0 },
            { id: "p3", x: 100, y: 50 }
        ]
    },

    cap: {
        name: "Конденсатор",
        category: "Бустер",
        icon: "🔋",
        role: "booster",
        researchCost: 0,
        cost: 220,
        power: 80,
        heat: 3,
        color: "#10b981",
        pins: [
            { id: "p1", x: 0,   y: 50 },
            { id: "p2", x: 100, y: 50 }
        ]
    },
    tensor_core: {
        name: "Тензор-ядро AI",
        category: "Бустер",
        icon: "🧠",
        role: "booster",
        researchCost: 7500,
        cost: 1300,
        power: 950,
        heat: 15,
        color: "#34d399",
        pins: [
            { id: "p1", x: 0,   y: 50 },
            { id: "p2", x: 100, y: 50 }
        ]
    },

    // ================= 5. ОХЛАЖДЕНИЕ =================
    fan: {
        name: "Кулер 80мм",
        category: "Охлаждение",
        icon: "❄️",
        role: "cooler",
        researchCost: 0,
        cost: 300,
        power: 0,
        heat: -16,
        coolRadius: 155,
        color: "#06b6d4",
        noWireNeeded: true,
        pins: []
    },
    fan_dual: {
        name: "Турбо-кулер",
        category: "Охлаждение",
        icon: "🌪️",
        role: "cooler",
        researchCost: 4200,
        cost: 650,
        power: 0,
        heat: -28,
        coolRadius: 215,
        color: "#22d3ee",
        noWireNeeded: true,
        pins: []
    },
    water_block: {
        name: "Водоблок СВО",
        category: "Охлаждение",
        icon: "💧",
        role: "cooler",
        researchCost: 11000,
        cost: 1200,
        power: 0,
        heat: -48,
        coolRadius: 290,
        color: "#67e8f9",
        noWireNeeded: true,
        pins: []
    }
};
