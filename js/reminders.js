/* ============================================
   日常提醒模块 - 喝水、健康习惯、伙伴提醒
   ============================================ */

const RemindersModule = (() => {
    const WATER_GOAL = 8;

    // 每个用户独立的日常数据
    let usersData = {};  // { 'xiaoyu': {...}, 'xiaochuan': {...} }

    // 伙伴提醒
    let partnerReminders = [];

    let eventsBound = false;

    function init() {
        loadData();
        if (!eventsBound) {
            bindEvents();
            eventsBound = true;
        }
        renderAll();
    }

    function loadData() {
        usersData = StorageModule.get('users_daily_data', {
            xiaoyu: makeFreshData(),
            xiaochuan: makeFreshData(),
        });

        // 确保两个用户都有数据
        ['xiaoyu', 'xiaochuan'].forEach(user => {
            if (!usersData[user]) usersData[user] = makeFreshData();
            if (usersData[user].date !== getTodayKey()) {
                usersData[user] = makeFreshData();
            }
        });

        saveData();

        partnerReminders = StorageModule.get('partner_reminders', []);
    }

    function makeFreshData() {
        return {
            date: getTodayKey(),
            waterCount: 0,
            wellness: { stretch: false, skincare: false, walk: false, mood_journal: false },
        };
    }

    function saveData() {
        StorageModule.set('users_daily_data', usersData);
    }

    function saveReminders() {
        StorageModule.set('partner_reminders', partnerReminders);
    }

    function getCurrentData() {
        const user = AppModule.getCurrentUser();
        if (!usersData[user]) usersData[user] = makeFreshData();
        return usersData[user];
    }

    function getTodayKey() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    function bindEvents() {
        document.getElementById('btn-add-water').addEventListener('click', addWater);
        document.getElementById('btn-add-reminder').addEventListener('click', addPartnerReminder);

        // 健康习惯按钮
        document.querySelectorAll('.wellness-item').forEach(item => {
            item.querySelector('.wellness-check').addEventListener('click', () => {
                const id = item.dataset.id;
                toggleWellness(id);
            });
        });
    }

    function addWater() {
        const data = getCurrentData();
        if (data.waterCount < WATER_GOAL) {
            data.waterCount++;
            saveData();
            renderWater();
            showToast(`已喝 ${data.waterCount} 杯水 💧`);

            if (data.waterCount === WATER_GOAL) {
                showToast('🎉 太棒了！今天的水量达标了！');
            }
        } else {
            showToast('今日饮水目标已达成！🎉');
        }
    }

    function toggleWellness(id) {
        const data = getCurrentData();
        data.wellness[id] = !data.wellness[id];
        saveData();
        renderWellness();
        const label = data.wellness[id] ? '完成 ✅' : '取消';
        showToast(label);
    }

    // === 伙伴提醒 ===
    function addPartnerReminder() {
        const text = prompt('添加给对方的提醒：');
        if (!text || !text.trim()) return;

        const currentUser = AppModule.getCurrentUser();
        const otherUser = AppModule.getOtherUser();

        partnerReminders.push({
            id: Date.now(),
            from: currentUser,
            fromName: currentUser === 'xiaochuan' ? '小川' : '小鱼',
            to: otherUser,
            text: text.trim(),
            time: new Date().toISOString(),
            done: false,
        });

        saveReminders();
        renderPartnerReminders();
        showToast('提醒已添加 ✅');
    }

    function toggleReminderDone(id) {
        const reminder = partnerReminders.find(r => r.id === id);
        if (reminder) {
            reminder.done = !reminder.done;
            saveReminders();
            renderPartnerReminders();
            showToast(reminder.done ? '已完成 ✅' : '已取消完成');
        }
    }

    function deleteReminder(id) {
        partnerReminders = partnerReminders.filter(r => r.id !== id);
        saveReminders();
        renderPartnerReminders();
        showToast('提醒已删除');
    }

    function renderPartnerReminders() {
        const list = document.getElementById('partner-reminders');
        const badge = document.getElementById('reminder-count');
        const otherUser = AppModule.getOtherUser();

        // 只显示发给当前用户的提醒
        const currentUser = AppModule.getCurrentUser();
        const relevant = partnerReminders.filter(r => r.to === currentUser);

        if (badge) badge.textContent = relevant.length;

        if (relevant.length === 0) {
            list.innerHTML = '<p class="reminder-empty">暂无提醒～</p>';
        } else {
            list.innerHTML = relevant.map(r => `
                <div class="reminder-item${r.done ? ' done' : ''}">
                    <button class="reminder-checkbox" data-id="${r.id}">${r.done ? '✓' : ''}</button>
                    <span class="reminder-text">${r.text}</span>
                    <span class="reminder-who">${r.fromName === '小川' ? '🦊' : '🐟'} ${r.fromName}</span>
                </div>
            `).join('');

            // 绑定完成按钮
            list.querySelectorAll('.reminder-checkbox').forEach(btn => {
                btn.addEventListener('click', () => {
                    toggleReminderDone(parseInt(btn.dataset.id));
                });
            });
        }
    }

    function renderWater() {
        const data = getCurrentData();
        const glassesDiv = document.getElementById('water-glasses');
        let html = '';
        for (let i = 0; i < WATER_GOAL; i++) {
            html += `<span class="water-glass${i < data.waterCount ? ' filled' : ''}">💧</span>`;
        }
        glassesDiv.innerHTML = html;

        const progress = (data.waterCount / WATER_GOAL) * 100;
        document.getElementById('water-progress-bar').style.width = progress + '%';
        document.getElementById('water-count-text').textContent = `${data.waterCount} / ${WATER_GOAL} 杯`;
        document.getElementById('stat-water-count').textContent = `${data.waterCount}/${WATER_GOAL}`;
    }

    function renderWellness() {
        const data = getCurrentData();
        document.querySelectorAll('.wellness-item').forEach(item => {
            const id = item.dataset.id;
            const check = item.querySelector('.wellness-check');
            if (data.wellness[id]) {
                check.textContent = '✓';
                check.classList.add('done');
            } else {
                check.textContent = '○';
                check.classList.remove('done');
            }
        });
    }

    function renderAll() {
        renderWater();
        renderWellness();
        renderPartnerReminders();
    }

    function render() {
        renderPartnerReminders();
    }

    // 获取提醒内容（供通知模块使用）
    function getReminders() {
        const reminders = [];
        const data = getCurrentData();
        const now = new Date();
        const hour = now.getHours();

        if (data.waterCount < WATER_GOAL && hour >= 9 && hour <= 21) {
            reminders.push({
                id: 'water',
                text: `💧 今天喝了 ${data.waterCount}/${WATER_GOAL} 杯水，记得多喝水哦～`,
            });
        }

        return reminders;
    }

    return {
        init,
        getReminders,
        renderAll,
        render,
    };
})();
