/* ============================================
   云端同步 - Supabase REST
   最简单可靠的方式：
   1. 开机拉全量覆盖本地
   2. 写操作即时 POST 云端
   3. 每 3 秒拉全量比对 → 变化就刷新 UI
   ============================================ */

const CloudStore = (() => {
    const URL = 'https://xsecjawvrqelkxdhwfix.supabase.co';
    const KEY = 'sb_publishable_uKPRFS3_Ltp0bxdDNuPkow_bhxz-CIA';
    const API = URL + '/rest/v1/app_data';

    const SYNC_KEYS = [
        'period_settings', 'moods', 'meals', 'calendar_events',
        'users_daily_data', 'partner_reminders', 'ar_surprises',
    ];

    let ready = false;
    let pollTimer = null;
    let listeners = [];
    let lastSnapshot = {}; // 上次云端 JSON 快照

    function hdrs() {
        return {
            'apikey': KEY,
            'Authorization': 'Bearer ' + KEY,
            'Content-Type': 'application/json',
        };
    }

    // ====== 拉全量 → 比对 → 覆盖本地 ======
    async function pullAll() {
        try {
            const resp = await fetch(API + '?select=key,value&_=' + Date.now(), {
                headers: hdrs(),
            });
            if (!resp.ok) {
                console.warn('☁️ 拉取失败 HTTP', resp.status);
                return false;
            }
            const rows = await resp.json();
            if (!rows || rows.length === 0) {
                console.log('☁️ 云端暂无数据');
                return false;
            }

            let changed = false;
            for (const row of rows) {
                if (!row.key || row.value === undefined || row.value === null) continue;
                if (!SYNC_KEYS.includes(row.key)) continue;

                const cloudJSON = row.value; // Supabase 存的是 JSON 字符串
                const oldJSON = lastSnapshot[row.key];

                // 比对云端数据是否变化（跟上次快照比，不是跟本地比）
                if (cloudJSON !== oldJSON) {
                    // 覆盖本地 localStorage
                    localStorage.setItem('lina_' + row.key, cloudJSON);
                    lastSnapshot[row.key] = cloudJSON;
                    changed = true;
                    console.log('📡 云端更新:', row.key);
                }
            }
            return changed;
        } catch (e) {
            console.warn('☁️ 拉取异常:', e.message);
            return false;
        }
    }

    // ====== 初始化 ======
    async function init() {
        if (ready) return;
        console.log('☁️ CloudStore 初始化...');

        await pullAll(); // 无条件覆盖本地
        ready = true;
        console.log('☁️ 初始化完成，快照:', Object.keys(lastSnapshot));

        // 每 3 秒检查云端变化
        if (!pollTimer) {
            pollTimer = setInterval(async () => {
                const changed = await pullAll();
                if (changed) {
                    console.log('📡 触发 UI 刷新');
                    listeners.forEach(fn => { try { fn(); } catch (e) {} });
                }
            }, 3000);
            console.log('🔗 轮询启动（3秒）');
        }
    }

    // ====== 写入：本地 + 云端 ======
    function cloudSet(key, value) {
        if (!SYNC_KEYS.includes(key)) return;

        const json = JSON.stringify(value);

        // 写本地
        try { localStorage.setItem('lina_' + key, json); } catch (e) {}

        // 更新快照（避免自己触发刷新）
        lastSnapshot[key] = json;

        if (!ready) return;

        // POST 到 Supabase（upsert by key）
        const ts = new Date().toISOString();
        fetch(API + '?key=eq.' + encodeURIComponent(key), {
            method: 'POST',
            headers: { ...hdrs(), 'Prefer': 'resolution=merge-duplicates' },
            body: JSON.stringify({ key, value: json, updated_at: ts }),
        }).then(r => {
            if (!r.ok && r.status !== 201) {
                console.warn('☁️ 写入失败:', key, r.status);
            }
        }).catch(e => {
            console.warn('☁️ 写入异常:', key, e.message);
        });
    }

    function onChange(fn) { listeners.push(fn); }

    // 强制拉取（手动同步按钮用）
    async function _forcePull() {
        lastSnapshot = {}; // 清空快照强制覆盖
        await pullAll();
    }

    return { init, cloudSet, onChange, _forcePull };
})();
