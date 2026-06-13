/* ============================================
   云端同步模块 - Supabase
   两台手机共享数据，实时同步
   ============================================ */

const CloudStore = (() => {
    const SUPABASE_URL = 'https://xsecjawvrqelkxdhwfix.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_uKPRFS3_Ltp0bxdDNuPkow_bhxz-CIA';

    // 需要云端同步的数据 key
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
    let initialized = false;
    let updateCallbacks = [];

    // 防抖队列：同一 key 多次写入合并为一次网络请求
    let syncQueue = {};
    let syncTimer = null;

    // ====== 初始化 ======
    async function init() {
        if (initialized) return;

        if (typeof supabase === 'undefined') {
            console.warn('⚠️ Supabase SDK 未加载，使用纯本地存储');
            return;
        }

        try {
            client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

            // 从云端拉取数据合并到本地
            await pullAllFromCloud();
            console.log('☁️ Supabase 云端数据同步完成');

            // 启动实时监听
            setupRealtime();
            console.log('🔗 Supabase 实时同步已启动');
        } catch (e) {
            console.warn('☁️ 云端初始化失败，使用本地数据:', e.message);
        }

        initialized = true;
    }

    // ====== 从云端拉取全量数据 ======
    async function pullAllFromCloud() {
        try {
            const { data, error } = await client
                .from('app_data')
                .select('key, value, updated_at');

            if (error) {
                // 表不存在时的友好提示
                if (error.code === '42P01') {
                    console.warn('☁️ 数据表未创建，请在 Supabase SQL Editor 中运行建表 SQL');
                } else {
                    console.error('☁️ 拉取数据失败:', error.message);
                }
                return;
            }

            if (!data) return;

            data.forEach(row => {
                const key = row.key;
                const value = row.value;
                if (!key || !value) return;

                const localRaw = localStorage.getItem('lina_' + key);
                const cloudTime = row.updated_at ? new Date(row.updated_at).getTime() : 0;

                // 比较时间戳，云端更新则覆盖本地
                let localTime = 0;
                if (localRaw) {
                    try {
                        const localData = JSON.parse(localRaw);
                        localTime = localData._cloud_updated || 0;
                    } catch (e) {}
                }

                if (cloudTime > localTime || !localRaw) {
                    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
                    localStorage.setItem('lina_' + key, JSON.stringify(parsed));
                }
            });

            console.log('☁️ 云端拉取完成，共', data.length, '条');
        } catch (e) {
            console.error('☁️ 拉取数据失败:', e.message);
        }
    }

    // ====== 实时监听（对方改动自动同步） ======
    function setupRealtime() {
        try {
            channel = client
                .channel('app_data_changes')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'app_data' },
                    (payload) => {
                        const row = payload.new || payload.old;
                        if (!row) return;
                        const key = row.key;

                        // 跳过自己刚写入的数据（防抖队列中的）
                        if (syncQueue[key]) return;

                        if (payload.eventType === 'DELETE') {
                            localStorage.removeItem('lina_' + key);
                        } else {
                            // INSERT 或 UPDATE
                            const value = row.value;
                            if (key && value) {
                                const parsed = typeof value === 'string' ? JSON.parse(value) : value;
                                parsed._cloud_updated = row.updated_at
                                    ? new Date(row.updated_at).getTime()
                                    : Date.now();
                                localStorage.setItem('lina_' + key, JSON.stringify(parsed));
                            }
                        }

                        triggerUpdate(key);
                    }
                )
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        console.log('🔗 Supabase Realtime 已连接');
                    } else if (status === 'CHANNEL_ERROR') {
                        console.warn('🔗 实时连接出错（可能是表未加入 realtime）');
                    }
                });
        } catch (e) {
            console.warn('🔗 实时同步启动失败:', e.message);
        }
    }

    // ====== 数据变化通知 UI 刷新 ======
    function triggerUpdate(key) {
        updateCallbacks.forEach(cb => {
            try { cb(key); } catch (e) {}
        });
    }

    // ====== 写入云端（异步，防抖合并） ======
    function cloudSet(key, value) {
        if (!initialized || !client || !SYNC_KEYS.includes(key)) return;

        syncQueue[key] = value;
        if (syncTimer) clearTimeout(syncTimer);
        syncTimer = setTimeout(() => flushQueue(), 500);
    }

    async function flushQueue() {
        const items = { ...syncQueue };
        syncQueue = {};

        for (const [key, value] of Object.entries(items)) {
            try {
                const jsonValue = JSON.stringify(value);
                const { error } = await client
                    .from('app_data')
                    .upsert(
                        { key, value: jsonValue, updated_at: new Date().toISOString() },
                        { onConflict: 'key' }
                    );

                if (error) {
                    console.error('☁️ 同步失败 (' + key + '):', error.message);
                }
            } catch (e) {
                console.error('☁️ 同步失败 (' + key + '):', e.message);
            }
        }
    }

    // ====== 注册回调 ======
    function onUpdate(callback) {
        updateCallbacks.push(callback);
    }

    // ====== 手动刷新 ======
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
        isReady: () => initialized,
    };
})();
