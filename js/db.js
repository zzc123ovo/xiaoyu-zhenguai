/* ============================================
   云端同步模块 - Supabase REST API
   不依赖外部 SDK，直接用 fetch()
   两台手机共享数据，定时轮询 + 实时写入
   ============================================ */

const CloudStore = (() => {
    const SUPABASE_URL = 'https://xsecjawvrqelkxdhwfix.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_uKPRFS3_Ltp0bxdDNuPkow_bhxz-CIA';
    const API = SUPABASE_URL + '/rest/v1/app_data';

    const SYNC_KEYS = [
        'period_settings',
        'moods',
        'meals',
        'calendar_events',
        'users_daily_data',
        'partner_reminders',
        'ar_surprises',
    ];

    let ready = false;
    let updateCallbacks = [];
    let pollTimer = null;
    let lastPollTime = 0;

    // 防抖写入队列
    let syncQueue = {};
    let syncTimer = null;

    // ====== HTTP 工具 ======
    function headers() {
        return {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
        };
    }

    // ====== 初始化 ======
    async function init() {
        if (ready) return;

        console.log('☁️ 正在从云端拉取数据...');

        // 1. 先从云端拉取全量数据
        await pullAllFromCloud();

        ready = true;
        console.log('☁️ 云端同步已就绪');

        // 2. 启动轮询（每5秒检查对方是否更新）
        startPolling();
    }

    // ====== 从云端拉取全量数据 ======
    async function pullAllFromCloud() {
        try {
            // 构建带时间戳的 URL 避免缓存
            const url = API + '?select=key,value,updated_at&order=updated_at.desc&limit=50&_=' + Date.now();

            const resp = await fetch(url, {
                method: 'GET',
                headers: headers(),
            });

            if (!resp.ok) {
                const text = await resp.text();
                console.error('☁️ 拉取失败 HTTP', resp.status, text.substring(0, 200));
                return;
            }

            const data = await resp.json();
            if (!data || data.length === 0) {
                console.log('☁️ 云端暂无数据');
                return;
            }

            let pulled = 0;
            data.forEach(row => {
                const key = row.key;
                const value = row.value;
                if (!key || !value) return;

                const cloudTime = row.updated_at ? new Date(row.updated_at).getTime() : 0;
                const localRaw = localStorage.getItem('lina_' + key);

                let localTime = 0;
                if (localRaw) {
                    try {
                        const d = JSON.parse(localRaw);
                        localTime = d._cloud_updated || 0;
                    } catch (e) {}
                }

                // 云端更新的才覆盖本地
                if (cloudTime > localTime || !localRaw) {
                    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
                    parsed._cloud_updated = cloudTime;
                    localStorage.setItem('lina_' + key, JSON.stringify(parsed));
                    pulled++;
                }
            });

            lastPollTime = Date.now();
            console.log('☁️ 拉取完成，更新', pulled, '条（共', data.length, '条）');
            return pulled;
        } catch (e) {
            console.error('☁️ 拉取异常:', e.message);
        }
    }

    // ====== 定时轮询（检测对方改动） ======
    function startPolling() {
        if (pollTimer) return;

        // 每 5 秒检查一次
        pollTimer = setInterval(async () => {
            try {
                // 只查比自己最后写入时间更新的记录
                const url = API + '?select=key,value,updated_at&updated_at=gt.' +
                    new Date(lastPollTime).toISOString() +
                    '&order=updated_at.desc&limit=20&_=' + Date.now();

                const resp = await fetch(url, { method: 'GET', headers: headers() });
                if (!resp.ok) return;

                const data = await resp.json();
                if (!data || data.length === 0) return;

                let changed = false;
                data.forEach(row => {
                    const key = row.key;
                    const value = row.value;
                    if (!key || !value) return;
                    // 跳过自己队列中待发送的 key
                    if (syncQueue[key] !== undefined) return;

                    const cloudTime = row.updated_at ? new Date(row.updated_at).getTime() : Date.now();
                    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
                    parsed._cloud_updated = cloudTime;
                    localStorage.setItem('lina_' + key, JSON.stringify(parsed));
                    changed = true;
                    triggerUpdate(key);
                });

                if (changed) {
                    lastPollTime = Date.now();
                }
            } catch (e) {
                // 静默忽略轮询错误
            }
        }, 5000);

        console.log('🔗 轮询已启动（每5秒）');
    }

    // ====== 通知 UI 刷新 ======
    function triggerUpdate(key) {
        updateCallbacks.forEach(cb => {
            try { cb(key); } catch (e) {}
        });
    }

    // ====== 写入云端 ======
    function cloudSet(key, value) {
        // 打时间戳
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            value._cloud_updated = Date.now();
        }

        // 更新本地（含时间戳）
        try {
            localStorage.setItem('lina_' + key, JSON.stringify(value));
        } catch (e) {}

        if (!ready || !SYNC_KEYS.includes(key)) return;

        // 防抖：同一 key 多次写合并
        syncQueue[key] = value;
        if (syncTimer) clearTimeout(syncTimer);
        syncTimer = setTimeout(() => flushQueue(), 300);
    }

    async function flushQueue() {
        const items = { ...syncQueue };
        syncQueue = {};

        for (const [key, value] of Object.entries(items)) {
            try {
                const jsonStr = JSON.stringify(value);
                // 使用 upsert：如果 key 存在则更新，否则插入
                const resp = await fetch(API + '?key=eq.' + encodeURIComponent(key), {
                    method: 'POST',
                    headers: { ...headers(), 'Prefer': 'resolution=merge-duplicates' },
                    body: JSON.stringify({
                        key: key,
                        value: jsonStr,
                        updated_at: new Date().toISOString(),
                    }),
                });

                if (!resp.ok && resp.status !== 201 && resp.status !== 409) {
                    console.error('☁️ 写入失败 (' + key + ') HTTP', resp.status);
                }
            } catch (e) {
                console.error('☁️ 写入异常 (' + key + '):', e.message);
            }
        }

        lastPollTime = Date.now();
    }

    function onUpdate(callback) {
        updateCallbacks.push(callback);
    }

    async function refresh() {
        await pullAllFromCloud();
        SYNC_KEYS.forEach(key => triggerUpdate(key));
    }

    return {
        init,
        cloudSet,
        onUpdate,
        refresh,
        isReady: () => ready,
    };
})();
