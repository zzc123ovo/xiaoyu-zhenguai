/* ============================================
   小鱼真乖 · 玲娜贝儿
   主控制器 - 单账号登录 + 云端同步
   ============================================ */

// --- 存储工具 ---
const StorageModule = {
    get(key, defaultValue = null) {
        try {
            const raw = localStorage.getItem('lina_' + key);
            if (raw === null) return defaultValue;
            return JSON.parse(raw);
        } catch (e) { return defaultValue; }
    },
    set(key, value) {
        try { localStorage.setItem('lina_' + key, JSON.stringify(value)); }
        catch (e) { console.error('存储失败:', e); }
        // 同步到云端
        if (typeof CloudStore !== 'undefined') CloudStore.cloudSet(key, value);
    },
    remove(key) { try { localStorage.removeItem('lina_' + key); } catch (e) {} },
};

// --- Toast ---
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    void toast.offsetWidth;
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 350);
    }, 2000);
}

// ========================================
//  当前用户（全局单例）
// ========================================
let currentUser = 'xiaoyu';

function getCurrentUser() { return currentUser; }
function getOtherUser() { return currentUser === 'xiaochuan' ? 'xiaoyu' : 'xiaochuan'; }

function updateUserBadge() {
    const badge = document.getElementById('current-user-badge');
    if (badge) {
        badge.textContent = currentUser === 'xiaochuan' ? '🦊 小川' : '🐟 小鱼';
    }
}

function getUserName(user) {
    return user === 'xiaochuan' ? '小川' : '小鱼';
}

// ========================================
//  登录系统
// ========================================
const LoginModule = (() => {
    const PASSWORDS = { xiaoyu: '1004', xiaochuan: '0531' };
    let selectedUser = null;
    let passwordInput = '';

    function init() {
        const saved = StorageModule.get('logged_in_user');
        if (saved) {
            currentUser = saved;
            skipLogin();
            return;
        }

        document.getElementById('login-screen').classList.remove('hidden');

        document.querySelectorAll('.login-card').forEach(card => {
            card.addEventListener('click', () => selectUser(card.dataset.user));
        });

        document.querySelectorAll('.num-key').forEach(btn => {
            btn.addEventListener('click', () => {
                const n = btn.dataset.n;
                if (n === 'del') {
                    passwordInput = passwordInput.slice(0, -1);
                } else if (passwordInput.length < 4) {
                    passwordInput += n;
                }
                updateDots();
                if (passwordInput.length === 4) {
                    setTimeout(() => verifyPassword(), 260);
                }
            });
        });

        document.addEventListener('keydown', onKeyDown);
    }

    function onKeyDown(e) {
        if (!selectedUser || document.getElementById('login-screen').classList.contains('hidden')) return;
        if (e.key >= '0' && e.key <= '9' && passwordInput.length < 4) {
            passwordInput += e.key;
            updateDots();
            if (passwordInput.length === 4) setTimeout(() => verifyPassword(), 260);
        } else if (e.key === 'Backspace') {
            passwordInput = passwordInput.slice(0, -1);
            updateDots();
        }
    }

    function selectUser(user) {
        selectedUser = user;
        passwordInput = '';
        document.querySelectorAll('.login-card').forEach(c => {
            c.classList.toggle('selected', c.dataset.user === user);
        });
        document.getElementById('login-pw-box').style.display = 'block';
        document.getElementById('login-pw-label').textContent = `输入 ${getUserName(user)} 的密码`;
        document.getElementById('login-error').textContent = '';
        updateDots();
    }

    function updateDots() {
        for (let i = 0; i < 4; i++) {
            document.getElementById('dot' + i).classList.toggle('filled', i < passwordInput.length);
        }
        document.getElementById('login-error').textContent = '';
    }

    function verifyPassword() {
        if (!selectedUser) return;
        if (PASSWORDS[selectedUser] === passwordInput) {
            currentUser = selectedUser;
            StorageModule.set('logged_in_user', currentUser);
            const loginScreen = document.getElementById('login-screen');
            const app = document.getElementById('app');
            loginScreen.classList.add('fade-out');
            app.classList.remove('hidden');
            setTimeout(() => {
                loginScreen.classList.add('hidden');
                loginScreen.classList.remove('fade-out');
            }, 500);
            initApp();
        } else {
            passwordInput = '';
            updateDots();
            document.getElementById('login-error').textContent = '密码不对哦，再试一次～';
            document.querySelectorAll('.login-dot').forEach(d => {
                d.classList.add('shake');
                setTimeout(() => d.classList.remove('shake'), 500);
            });
        }
    }

    function skipLogin() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        initApp();
    }

    // 退出登录
    function logout() {
        StorageModule.remove('logged_in_user');
        currentUser = 'xiaoyu';
        selectedUser = null;
        passwordInput = '';

        document.getElementById('app').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('login-screen').classList.remove('fade-out');
        document.getElementById('login-pw-box').style.display = 'none';
        document.querySelectorAll('.login-card').forEach(c => c.classList.remove('selected'));
        document.getElementById('login-error').textContent = '';
        updateDots();
    }

    return { init, logout };
})();

// ========================================
//  问候语
// ========================================
function updateGreeting() {
    const hour = new Date().getHours();
    const name = getUserName(currentUser);
    let text, sub;
    if (hour < 6)       { text = '夜深了，早点休息～'; sub = '玲娜贝儿陪你进入梦乡 🌙'; }
    else if (hour < 9)  { text = `早安，${name}～`;   sub = '新的一天，元气满满！☀️'; }
    else if (hour < 12) { text = `上午好呀，${name}～`; sub = '今天也是美好的一天 💖'; }
    else if (hour < 14) { text = `中午好，${name}～`; sub = '记得按时吃午饭哦 🍱'; }
    else if (hour < 17) { text = `下午好，${name}～`; sub = '喝杯水休息一下吧 💧'; }
    else if (hour < 19) { text = `傍晚好，${name}～`; sub = '晚餐要好好吃哦 🍲'; }
    else if (hour < 22) { text = `晚上好，${name}～`; sub = '放松一下，泡个热水澡吧 🛀'; }
    else                { text = '夜深了，早点休息～'; sub = '玲娜贝儿陪你进入梦乡 🌙'; }
    document.getElementById('greeting-text').textContent = text;
    document.getElementById('greeting-sub').textContent = sub;
}

// ========================================
//  导航
// ========================================
function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchPage(item.dataset.page));
    });
}

function switchPage(pageName) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.page === pageName));
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + pageName));
    document.querySelector('.main-content').scrollTop = 0;
    if (pageName === 'ar') ARModule.onPageActive();
    else ARModule.onPageInactive();
    if (pageName === 'calendar') CalendarModule.render();
    if (pageName === 'period') PeriodModule.updateAllUI();
    if (pageName === 'daily') { RemindersModule.renderAll(); MealsModule.render(); }
    if (pageName === 'settings') ARModule.init();
}

// ========================================
//  日期 & 工具
// ========================================
function updateHeaderDate() {
    const el = document.getElementById('header-date');
    if (!el) return;
    const now = new Date();
    const w = ['日','一','二','三','四','五','六'];
    el.textContent = `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 周${w[now.getDay()]}`;
}

function getTodayStr() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

function updateReminderCardTitle() {
    const other = getOtherUser();
    document.getElementById('reminder-card-title').textContent = getUserName(other) + '的提醒';
}

function checkDayReset() {
    const today = getTodayStr();
    if (StorageModule.get('last_check_date') !== today) {
        StorageModule.set('last_check_date', today);
        RemindersModule.init();
        MealsModule.resetDaily();
        CalendarModule.render();
        PeriodModule.updateAllUI();
    }
}

function initLocationButton() {
    const btn = document.getElementById('btn-location');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        btn.textContent = '⏳ 定位中...';
        btn.disabled = true;
        const ok = await WeatherModule.refreshLocation();
        btn.textContent = ok ? '📍 已定位' : '📍 重试';
        btn.disabled = false;
        if (ok) setTimeout(() => { btn.textContent = '📍 定位'; }, 2000);
    });
}

function initLogoutButton() {
    const btn = document.getElementById('btn-logout');
    if (!btn) return;
    btn.addEventListener('click', () => {
        if (confirm('确定要退出登录吗？')) {
            LoginModule.logout();
        }
    });
}

function initSyncButton() {
    const btn = document.getElementById('btn-sync');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        btn.textContent = '⏳ 同步中...';
        btn.disabled = true;
        await CloudStore._forcePull();
        refreshAllUI();
        btn.textContent = '☁️ 手动同步数据';
        btn.disabled = false;
        showToast('✅ 数据已同步');
    });
}

// ========================================
//  刷新全部 UI（云端数据变化后回调）
// ========================================
function refreshAllUI() {
    PeriodModule.updateAllUI();
    CalendarModule.render();
    RemindersModule.renderAll();
    MoodModule.render();
    MealsModule.render();
    MealsModule.updateHomeStat();
    updateReminderCardTitle();
}

// ========================================
//  初始化 App
// ========================================
async function initApp() {
    // ★ 先拉取云端数据
    if (typeof CloudStore !== 'undefined') {
        console.log('☁️ 正在同步云端数据...');
        await CloudStore.init();
    }

    updateUserBadge();
    updateHeaderDate();
    updateGreeting();
    initNavigation();
    initLocationButton();
    initLogoutButton();
    initSyncButton();

    // 模块初始化（此时 localStorage 已有云端数据）
    PeriodModule.init();
    CalendarModule.init();
    RemindersModule.init();
    MoodModule.init();
    MealsModule.init();
    ARModule.init();
    NotificationsModule.init();

    checkDayReset();
    WeatherModule.loadWeather();
    MealsModule.updateHomeStat();
    updateReminderCardTitle();

    setInterval(() => {
        updateHeaderDate();
        updateGreeting();
        checkDayReset();
    }, 60000);

    // 云端数据变化时自动刷新 UI
    if (typeof CloudStore !== 'undefined') {
        CloudStore.onChange(() => {
            console.log('📡 对方更新了数据，刷新 UI');
            refreshAllUI();
        });
    }

    console.log('🦊 小鱼真乖 · 玲娜贝儿 已就绪！(' + getUserName(currentUser) + ')');
}

// ========================================
//  启动
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    const splash = document.getElementById('splash-screen');
    setTimeout(() => {
        splash.classList.add('fade-out');
        setTimeout(() => { if (splash.parentNode) splash.remove(); }, 600);
    }, 1800);

    LoginModule.init();

    document.addEventListener('dblclick', e => {
        if (e.target.tagName === 'BUTTON') e.preventDefault();
    }, { passive: false });
});
