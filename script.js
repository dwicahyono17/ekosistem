// =====================================================
// SANDBOX EKOSISTEM SAWAH KEDIRI - VERSI 7 (PATCHED)
// =====================================================

const INITIAL_STATE = { padi: 10000, tikus: 1000, ular: 60, tyto: 40 };
const INITIAL_SERIES = [
    INITIAL_STATE.padi,
    INITIAL_STATE.tikus,
    INITIAL_STATE.ular,
    INITIAL_STATE.tyto
];
const MAX_POINTS = 20; // Batas titik pada grafik

let currentState = JSON.parse(JSON.stringify(INITIAL_STATE));
let selectedScenario = null;
let simulationStep = 0;

// State untuk Kepunahan Permanen, Animasi, dan Timer
const isExtinct = { padi: false, tikus: false, ular: false, tyto: false };
const activeAnimations = new Map();
let inlineTimer = null;

// =====================================================
// INISIALISASI
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    initChart();
    setupEventListeners();
    updateDisplay();
    updateSawahVisual();
});

function setupEventListeners() {
    document.querySelectorAll('.scenario-btn').forEach(btn => {
        btn.setAttribute('aria-pressed', 'false');
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.scenario-btn').forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            e.currentTarget.classList.add('active');
            e.currentTarget.setAttribute('aria-pressed', 'true');
            selectedScenario = e.currentTarget.dataset.scenario;
            hideInlineMessage();
        });
    });
    document.getElementById('btn-simulate').addEventListener('click', runSimulation);
    document.getElementById('btn-reset').addEventListener('click', resetEcosystem);
}

// =====================================================
// LOGIKA SIMULASI INTI
// =====================================================
function runSimulation() {
    if (!selectedScenario) {
        showInlineMessage('⚠️ Pilih skenario terlebih dahulu di panel kanan!', 'warning');
        return;
    }

    let logMessage = '';
    let logType = 'normal';
    simulationStep++;

    switch (selectedScenario) {
        case 'normal':
            currentState.padi = recover(currentState.padi, 10000);
            if (!isExtinct.tikus) currentState.tikus = recover(currentState.tikus, 1000);
            if (!isExtinct.ular)  currentState.ular  = recover(currentState.ular, 60);
            if (!isExtinct.tyto)  currentState.tyto  = recover(currentState.tyto, 40);
            logMessage = '🌿 Kondisi normal: Ekosistem perlahan pulih menuju keseimbangan alaminya.';
            break;

        case 'basmi-ular':
            if (currentState.ular === 0) {
                currentState.tikus = Math.round(currentState.tikus * 1.3);
                currentState.padi  = Math.round(currentState.padi * 0.7);
                if (!isExtinct.tyto) currentState.tyto = Math.round(currentState.tyto * 1.2);
                logMessage = '⚠️ Ular sudah punah! Tanpa predator, tikus terus berkembang dan sawah makin rusak.';
                logType = 'danger';
            } else {
                currentState.ular = 0;
                currentState.tikus = Math.round(currentState.tikus * 3.5);
                currentState.padi = Math.round(currentState.padi * 0.3);
                if (!isExtinct.tyto) currentState.tyto = Math.round(currentState.tyto * 1.5);
                logMessage = '🚨 BENCANA EKOLOGIS: Ular punah! Tikus meledak (3.5x), padi hancur 70%.';
                logType = 'danger';
            }
            break;

        case 'basmi-tikus':
            currentState.tikus = Math.round(currentState.tikus * 0.1);
            currentState.ular = Math.round(currentState.ular * 0.3);
            currentState.tyto = Math.round(currentState.tyto * 0.2);
            currentState.padi = Math.round(currentState.padi * 1.3);
            logMessage = '☠️ Racun digunakan! Tikus mati, tapi racun terakumulasi (biomagnifikasi) dan membunuh predator.';
            logType = 'danger';
            break;

        case 'kekeringan':
            currentState.padi = Math.round(currentState.padi * 0.4);
            currentState.tikus = Math.round(currentState.tikus * 0.5);
            currentState.ular = Math.round(currentState.ular * 0.3);
            currentState.tyto = Math.round(currentState.tyto * 0.3);
            logMessage = '☀️ Kekeringan ekstrem! Padi gagal tumbuh, efek berantai membuat seluruh rantai makanan kelaparan.';
            logType = 'warning';
            break;

        case 'rubuha':
            currentState.tyto = Math.round(currentState.tyto * 2.5);
            currentState.tikus = Math.round(currentState.tikus * 0.6);
            currentState.ular = Math.round(currentState.ular * 0.8);
            currentState.padi = Math.round(currentState.padi * 1.15);
            logMessage = '🏠 Solusi Bijak: Rubuha dipasang! Tyto Alba meningkat, mengendalikan tikus, padi lebih aman.';
            break;
    }

    // 1. Clamp ke nilai minimum 0
    currentState.padi  = Math.max(0, currentState.padi);
    currentState.tikus = Math.max(0, currentState.tikus);
    currentState.ular  = Math.max(0, currentState.ular);
    currentState.tyto  = Math.max(0, currentState.tyto);

    // 2. Cascade kelaparan: predator mati jika mangsa habis (semua skenario)
    const cascade = applyStarvationCascade();

    // 3. Enforce pyramid (Hukum 10% untuk semua skenario)
    if (enforcePyramid()) {
        logMessage += ' ⚖️ Alam mengoreksi: populasi melebihi daya dukung (Hukum 10%).';
    }

    // 4. Mark extinctions (setelah semua koreksi)
    const newlyExtinct = markExtinctions();
    const semuaPunah = [...new Set([...cascade, ...newlyExtinct])];
    if (semuaPunah.length > 0) {
        logMessage += ` ‼️ ${semuaPunah.join(', ')} PUNAH dan tidak akan pulih tanpa reset.`;
        logType = 'danger';
    }

    // 5. Update UI
    updateDisplay();
    updateChart();
    updateSawahVisual();
    addLog(`Langkah ${simulationStep}: ${logMessage}`, logType);
}

// =====================================================
// FUNGSI BANTU PEDAGOGIS & TEKNIS
// =====================================================
function recover(value, target, rate = 0.2) {
    const diff = target - value;
    if (diff === 0) return value;
    const step = Math.sign(diff) * Math.max(1, Math.round(Math.abs(diff) * rate));
    return value + step;
}

/**
 * Cascade kelaparan: jika mangsa habis, predator di atasnya mati.
 * Mengembalikan daftar nama spesies yang mati karena kelaparan.
 */
function applyStarvationCascade() {
    const mati = [];

    // Padi habis → tikus kelaparan
    if (currentState.padi === 0 && currentState.tikus > 0) {
        currentState.tikus = 0;
        mati.push('🐀 Tikus');
    }
    // Tikus habis → ular & tyto kelaparan
    if (currentState.tikus === 0) {
        if (currentState.ular > 0) { currentState.ular = 0; mati.push('🐍 Ular'); }
        if (currentState.tyto > 0) { currentState.tyto = 0; mati.push('🦉 Tyto Alba'); }
    }
    return mati;
}

/**
 * Hukum 10% Energi dua tingkat:
 *   - tikus ≤ 10% padi
 *   - (ular + tyto) ≤ 10% tikus
 * Mengembalikan true jika ada koreksi.
 */
function enforcePyramid() {
    let dikoreksi = false;

    // Tingkat 1: tikus ≤ 10% padi
    const maxTikus = Math.floor(currentState.padi / 10);
    if (currentState.tikus > maxTikus) {
        currentState.tikus = maxTikus;
        dikoreksi = true;
    }

    // Tingkat 2: predator ≤ 10% tikus
    const maxPredator = Math.floor(currentState.tikus / 10);
    const total = currentState.ular + currentState.tyto;
    if (total > maxPredator) {
        const scale = total > 0 ? maxPredator / total : 0;
        currentState.ular = Math.floor(currentState.ular * scale);
        currentState.tyto = Math.floor(currentState.tyto * scale);
        dikoreksi = true;
    }

    return dikoreksi;
}

function markExtinctions() {
    const baru = [];
    if (currentState.tikus === 0 && !isExtinct.tikus) { isExtinct.tikus = true; baru.push('🐀 Tikus'); }
    if (currentState.ular === 0  && !isExtinct.ular)  { isExtinct.ular  = true; baru.push('🐍 Ular'); }
    if (currentState.tyto === 0  && !isExtinct.tyto)  { isExtinct.tyto  = true; baru.push('🦉 Tyto Alba'); }
    // Padi jarang punah permanen (masih bisa ditanam ulang), tapi kita tandai juga
    if (currentState.padi === 0 && !isExtinct.padi) { isExtinct.padi = true; baru.push('🌾 Padi'); }
    return baru;
}

// =====================================================
// UPDATE UI & ANIMASI (Race-condition free)
// =====================================================
function animateValue(elementId, newValue) {
    const el = document.getElementById(elementId);
    if (!el) return;

    if (activeAnimations.has(elementId)) {
        cancelAnimationFrame(activeAnimations.get(elementId));
    }

    const start = parseInt(el.textContent.replace(/\./g, '')) || 0;
    const duration = 700;
    const startTime = performance.now();

    function step(currentTime) {
        const progress = Math.min((currentTime - startTime) / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(start + (newValue - start) * easeOut).toLocaleString('id-ID');

        if (progress < 1) {
            activeAnimations.set(elementId, requestAnimationFrame(step));
        } else {
            activeAnimations.delete(elementId);
        }
    }
    activeAnimations.set(elementId, requestAnimationFrame(step));
}

function updateDisplay() {
    animateValue('pop-padi', currentState.padi);
    animateValue('pop-tikus', currentState.tikus);
    animateValue('pop-ular', currentState.ular);
    animateValue('pop-tyto', currentState.tyto);
}

function updateSawahVisual() {
    const sawah = document.getElementById('sawah-canvas');
    const status = document.getElementById('sawah-status');
    const padiPercent = (currentState.padi / INITIAL_STATE.padi) * 100;

    sawah.classList.remove('healthy', 'stressed', 'critical', 'dead');

    if (padiPercent > 80)       { sawah.classList.add('healthy');  status.textContent = '✅ SAWAH SEHAT'; }
    else if (padiPercent > 50)  { sawah.classList.add('stressed'); status.textContent = '⚠️ SAWAH TERTEKAN'; }
    else if (padiPercent > 20)  { sawah.classList.add('critical'); status.textContent = '🚨 SAWAH KRITIS'; }
    else                        { sawah.classList.add('dead');     status.textContent = '💀 GAGAL PANEN'; }
}

// =====================================================
// CHART.JS (Logarithmic + Zero-handling + Windowed)
// =====================================================
let popChart;
const toChartVal = (v) => Math.max(v, 1); // Mencegah log(0) error

// Mapping dataset ke kunci state (untuk tooltip & reset)
const DATASET_KEYS = ['padi', 'tikus', 'ular', 'tyto'];

function initChart() {
    const ctx = document.getElementById('popChart').getContext('2d');
    popChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Awal'],
            datasets: [
                { label: '🌾 Padi',       data: [INITIAL_SERIES[0]], borderColor: '#4caf50', backgroundColor: 'rgba(76, 175, 80, 0.1)',  tension: 0.3 },
                { label: '🐀 Tikus',      data: [INITIAL_SERIES[1]], borderColor: '#ffc107', backgroundColor: 'rgba(255, 193, 7, 0.1)',  tension: 0.3 },
                { label: '🐍 Ular',       data: [INITIAL_SERIES[2]], borderColor: '#ff5722', backgroundColor: 'rgba(255, 87, 34, 0.1)',  tension: 0.3 },
                { label: '🦉 Tyto Alba',  data: [INITIAL_SERIES[3]], borderColor: '#9c27b0', backgroundColor: 'rgba(156, 39, 176, 0.1)', tension: 0.3 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const idx = context.datasetIndex;
                            const key = DATASET_KEYS[idx];
                            const val = context.parsed.y;
                            if (isExtinct[key]) {
                                return `${context.dataset.label}: 0 (Punah)`;
                            }
                            return `${context.dataset.label}: ${val.toLocaleString('id-ID')} unit`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'logarithmic',
                    title: { display: true, text: 'Unit Energi (Skala Log, 1 ≈ Punah)' },
                    ticks: {
                        callback: function(value) {
                            if ([1, 10, 100, 1000, 10000].includes(value)) return value.toLocaleString('id-ID');
                            return null;
                        }
                    }
                },
                x: { title: { display: true, text: 'Langkah Simulasi' } }
            }
        }
    });
}

function updateChart() {
    popChart.data.labels.push(`Langkah ${simulationStep}`);
    popChart.data.datasets[0].data.push(toChartVal(currentState.padi));
    popChart.data.datasets[1].data.push(toChartVal(currentState.tikus));
    popChart.data.datasets[2].data.push(toChartVal(currentState.ular));
    popChart.data.datasets[3].data.push(toChartVal(currentState.tyto));

    // Batasi jumlah titik agar sumbu X tetap terbaca
    if (popChart.data.labels.length > MAX_POINTS) {
        popChart.data.labels.shift();
        popChart.data.datasets.forEach(ds => ds.data.shift());
    }

    popChart.update();
}

// =====================================================
// LOG & INLINE MESSAGE
// =====================================================
function addLog(message, type = 'normal') {
    const logContent = document.getElementById('log-content');
    const emptyMsg = logContent.querySelector('.log-empty');
    if (emptyMsg) emptyMsg.remove();

    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `<strong>${message}</strong>`;
    logContent.insertBefore(entry, logContent.firstChild);

    const entries = logContent.querySelectorAll('.log-entry');
    if (entries.length > 8) entries[entries.length - 1].remove();
}

function showInlineMessage(msg, type) {
    const el = document.getElementById('inline-message');
    el.textContent = msg;
    el.className = `inline-message ${type}`;
    el.style.display = 'block';
    if (inlineTimer) clearTimeout(inlineTimer);
    inlineTimer = setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function hideInlineMessage() {
    if (inlineTimer) clearTimeout(inlineTimer);
    document.getElementById('inline-message').style.display = 'none';
}

function resetEcosystem() {
    currentState = JSON.parse(JSON.stringify(INITIAL_STATE));
    selectedScenario = null;
    simulationStep = 0;

    // Reset flag kepunahan (termasuk padi)
    Object.keys(isExtinct).forEach(k => isExtinct[k] = false);

    document.querySelectorAll('.scenario-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
    });

    document.getElementById('log-content').innerHTML =
        '<p class="log-empty">Belum ada simulasi dijalankan. Silakan pilih skenario.</p>';
    hideInlineMessage();

    // Reset grafik dengan aman (menggunakan INITIAL_SERIES, bukan ds.data[0])
    popChart.data.labels = ['Awal'];
    popChart.data.datasets.forEach((ds, i) => {
        ds.data = [INITIAL_SERIES[i]];
    });
    popChart.update();

    updateDisplay();
    updateSawahVisual();
    addLog('Sistem direset ke kondisi awal. Semua spesies dipulihkan.', 'normal');
}
