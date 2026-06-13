/* ============================================
   云端同步 - Supabase REST API
   纯 fetch()，无需外部 SDK
   写入 → 立即 POST 到云端
   读取 → 启动时拉取 + 每 5 秒轮询
   ============================================ */

const CloudStore = (() => {
    const URL = 'https://xsecjawvrqelkxdhwfix.supabase.co';
    const KEY = 'sb_publishable_uKPRFS3_Ltp0bxdDNuPkow_bhxz-CIA';
    const API = URL + '/rest/v1/app_data';

    // 需要云端同步的数据
    const SYNC_KEYS = [
        'period_settings', 'moods', 'meals', 'calendar_events',
        'users_daily_data', 'partner_reminders', 'ar_surprises',
    ];

    let ready = false;
    let callbacks = [];
    let pollTimer = null;

    // ====== fetch 封装 ======
    function hdrs() {
        return {
            'apikey': KEY,
            'Authorization': 'Bearer ' + KEY,
            'Content-Type': 'application/json',
        };
    }

    // ====== 初始化：拉云端数据 → 写本地 ======
    async function init() {
        if (ready) return;
        console.log('☁️ CloudStore init - 拉取云端数据...');

        for (const key of SYNC_KEYS) {
            try {
                const resp = await fetch(
                    API + '?select=key,value,updated_at&key=eq.' + key + '&limit=1&_=' + Date.now(),
                    { method: 'GET', headers: hdrs() }
                );
                if (!resp.ok) continue;
                const rows = await resp.json();
                if (!rows || rows.length === 0) continue;

                const row = rows[0];
                const cloudTime = row.updated_at ? new Date(row.updated_at).getTime() : 0;
                const localRaw = localStorage.getItem('lina_' + key);
                let localTime = 0;
                if (localRaw) {
                    try { localTime = JSON.parse(localRaw)._cloud_updated || 0; } catch (e) {}
                }

                // 云端更新 → 覆盖本地
                if (cloudTime > localTime || !localRaw) {
                    const val = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
                    val._cloud_updated = cloudTime;
                    localStorage.setItem('lina_' + key, JSON.stringify(val));
                    console.log('☁️ 拉取:', key, cloudTime > localTime ? '(云端更新)' : '(本地缺失)');
                } else {
                    console.log('☁️ 跳过:', key, '(本地已最新)');
                }
            } catch (e) {
                console.warn('☁️ 拉取失败:', key, e.message);
            }
        }

        ready = true;
        console.log('☁️ 初始化完成');

        // 启动轮询
        startPolling();
    }

    // ====== 轮询：每 5 秒检查对方改动 ======
    function startPolling() {
        if (pollTimer) return;
        let lastCheck = new Date(Date.now() - 10000).toISOString(); // 查最近10秒

        pollTimer = setInterval(async () => {
            try {
                const ts = lastCheck;
                const resp = await fetch(
                    API + '?select=key,value,updated_at&updated_at=gt.' + ts +
                    '&order=updated_at.desc&limit=20&_=' + Date.now(),
                    { method: 'GET', headers: hdrs() }
                );
                lastCheck = new Date().toISOString();

                if (!resp.ok) return;
                const rows = await resp.json();
                if (!rows || rows.length === 0) return;

                let changed = false;
                for (const row of rows) {
                    const key = row.key;
                    if (!key || !row.value) continue;
                    if (!SYNC_KEYS.includes(key)) continue;

                    const cloudTime = row.updated_at ? new Date(row.updated_at).getTime() : Date.now();
                    const localRaw = localStorage.getItem('lina_' + key);
                    let localTime = 0;
                    if (localRaw) {
                        try { localTime = JSON.parse(localRaw)._cloud_updated || 0; } catch (e) {}
                    }

                    // 只覆盖本地比云端旧的
                    if (cloudTime <= localTime) continue;

                    const val = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
                    val._cloud_updated = cloudTime;
                    localStorage.setItem('lina_' + key, JSON.stringify(val));
                    changed = true;
                    console.log('📡 轮询更新:', key);
                }

                if (changed) notifyCallbacks();
            } catch (e) {
                // 静默
            }
        }, 5000);
        console.log('🔗 轮询已启动（5秒）');
    }

    // ====== 写入云端（同步调用，异步发送） ======
    function cloudSet(key, value) {
        if (!SYNC_KEYS.includes(key)) return;

        // 打时间戳
        const ts = Date.now();
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            value._cloud_updated = ts;
        }

        // 更新本地
        try { localStorage.setItem('lina_' + key, JSON.stringify(value)); } catch (e) {}

        // 异步发送到云端
        if (ready) {
            const jsonStr = JSON.stringify(value);
            fetch(API, {
                method: 'POST',
                headers: { ...hdrs(), 'Prefer': 'resolution=merge-duplicates' },
                body: JSON.stringify({ key, value: jsonStr, updated_at: new Date(ts).toISOString() }),
            }).catch(e => console.warn('☁️ 写入失败:', key, e.message));
        }
    }

    // ====== 回调 ======
    function onUpdate(fn) { callbacks.push(fn); }
    function notifyCallbacks() { callbacks.forEach(fn => { try { fn(); } catch (e) {} }); }

    return { init, cloudSet, onUpdate, isReady: () => ready };
})();
