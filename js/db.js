/* ============================================
   云端同步模块 - Supabase
   两台手机共享数据，实时同步
   ============================================ */

const CloudStore = (() => {
    const SUPABASE_URL = 'https://xsecjawvrqelkxdhwfix.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_uKPRFS3_Ltp0bxdDNuPkow_bhxz-CIA';

    const SYNC_KEYS = [
        'period_settings',
        'moods',
        'meals',
        'calendar_events',
        'users_daily_data',
        'partner_reminders',
        'ar_surprises',
    ];

    let client = null;
    let channel = null;
    let ready = false;
    let updateCallbacks = [];

    // 防抖队列
    let syncQueue = {};
    let syncTimer = null;

    // ====== 初始化：先跑云端拉取，再返回 ======
    async function init() {
        if (ready) return;

        if (typeof supabase === 'undefined') {
            console.warn('⚠️ Supabase SDK 未加载');
            return;
        }

        // 立即创建客户端（同步操作）
        client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            realtime: { params: { eventsPerSecond: 10 } },
        });
        console.log('☁️ Supabase 客户端已创建');

        // 先从云端拉取数据覆盖本地（await 确保完成）
        await pullAllFromCloud();

        // 启动实时监听
        setupRealtime();

        ready = true;
        console.log('☁️ 云端同步已就绪');
    }

    // ====== 拉取全量数据 ======
    async function pullAllFromCloud() {
        if (!client) return;
        try {
            const { data, error } = await client
                .from('app_data')
                .select('key, value, updated_at');

            if (error) {
                if (error.code === '42P01') {
                    console.warn('☁️ 数据表未创建');
                } else {
                    console.error('☁️ 拉取失败:', error.message);
                }
                return;
            }

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

                // 云端更新才覆盖
                if (cloudTime > localTime || !localRaw) {
                    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
                    parsed._cloud_updated = cloudTime;
                    localStorage.setItem('lina_' + key, JSON.stringify(parsed));
                    pulled++;
                }
            });

            console.log('☁️ 拉取完成，更新', pulled, '条，共', data.length, '条');
        } catch (e) {
            console.error('☁️ 拉取异常:', e.message);
        }
    }

    // ====== 实时监听 ======
    function setupRealtime() {
        if (!client) return;
        try {
            channel = client
                .channel('app_data_changes')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'app_data' },
                    (payload) => {
                        if (!payload.new) return;
                        const row = payload.new;
                        const key = row.key;
                        const value = row.value;
                        if (!key || !value) return;

                        // 跳过自己刚发的（防抖队列中的）
                        if (syncQueue[key] !== undefined) return;

                        const cloudTime = row.updated_at
                            ? new Date(row.updated_at).getTime()
                            : Date.now();
                        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
                        parsed._cloud_updated = cloudTime;
                        localStorage.setItem('lina_' + key, JSON.stringify(parsed));

                        console.log('📡 实时收到:', key);
                        triggerUpdate(key);
                    }
                )
                .subscribe((status, err) => {
                    if (status === 'SUBSCRIBED') {
                        console.log('🔗 Realtime 已连接');
                    } else if (status === 'CHANNEL_ERROR') {
                        console.warn('🔗 Realtime 错误:', err);
                    }
                });
        } catch (e) {
            console.warn('🔗 Realtime 启动失败:', e.message);
        }
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

        // 更新本地（加上时间戳）
        try {
            localStorage.setItem('lina_' + key, JSON.stringify(value));
        } catch (e) {}

        if (!ready || !client || !SYNC_KEYS.includes(key)) return;

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
                const { error } = await client
                    .from('app_data')
                    .upsert(
                        { key, value: jsonStr, updated_at: new Date().toISOString() },
                        { onConflict: 'key' }
                    );

                if (error) {
                    console.error('☁️ 写入失败 (' + key + '):', error.message);
                }
            } catch (e) {
                console.error('☁️ 写入异常 (' + key + '):', e.message);
            }
        }
    }

    function onUpdate(callback) {
        updateCallbacks.push(callback);
    }

    async function refresh() {
        if (!client) return;
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
