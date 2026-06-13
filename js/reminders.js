/* ============================================
   日常提醒模块 - 喝水、健康习惯、伙伴提醒
   共享数据：两人看到完全一样的内容
   ============================================ */

const RemindersModule = (() => {
    const WATER_GOAL = 8;

    // 共享日常数据
    let dailyData = {};
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
        let raw = StorageModule.get('users_daily_data', null);

        // 迁移旧格式 {xiaoyu:{...}, xiaochuan:{...}} → 新格式 {date, waterCount, wellness}
        if (raw && raw.xiaoyu && !raw.date) {
            console.log('🔄 迁移旧数据格式...');
            raw = makeFreshData();
        }

        dailyData = raw || makeFreshData();
        if (!dailyData.date || dailyData.date !== getTodayKey()) {
            dailyData = makeFreshData();
        }
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
        StorageModule.set('users_daily_data', dailyData);
    }

    function saveReminders() {
        StorageModule.set('partner_reminders', partnerReminders);
    }

    function getTodayKey() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    function bindEvents() {
        document.getElementById('btn-add-water').addEventListener('click', addWater);
        document.getElementById('btn-add-reminder').addEventListener('click', addPartnerReminder);

        document.querySelectorAll('.wellness-item').forEach(item => {
            item.querySelector('.wellness-check').addEventListener('click', () => {
                toggleWellness(item.dataset.id);
            });
        });
    }

    function addWater() {
        if (dailyData.waterCount < WATER_GOAL) {
            dailyData.waterCount++;
            saveData();
            renderWater();
            showToast(`已喝 ${dailyData.waterCount} 杯水 💧`);
            if (dailyData.waterCount === WATER_GOAL) {
                showToast('🎉 太棒了！今天的水量达标了！');
            }
        } else {
            showToast('今日饮水目标已达成！🎉');
        }
    }

    function toggleWellness(id) {
        dailyData.wellness[id] = !dailyData.wellness[id];
        saveData();
        renderWellness();
        showToast(dailyData.wellness[id] ? '完成 ✅' : '取消');
    }

    // === 伙伴提醒 ===
    function addPartnerReminder() {
        const text = prompt('添加给对方的提醒：');
        if (!text || !text.trim()) return;
        const user = getCurrentUser();
        const other = getOtherUser();
        partnerReminders.push({
            id: Date.now(),
            from: user,
            fromName: getUserName(user),
            to: other,
            text: text.trim(),
            time: new Date().toISOString(),
            done: false,
        });
        saveReminders();
        renderPartnerReminders();
        showToast('提醒已添加 ✅');
    }

    function toggleReminderDone(id) {
        const r = partnerReminders.find(r => r.id === id);
        if (r) {
            r.done = !r.done;
            saveReminders();
            renderPartnerReminders();
            showToast(r.done ? '已完成 ✅' : '已取消完成');
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
        if (badge) badge.textContent = partnerReminders.length;

        if (partnerReminders.length === 0) {
            list.innerHTML = '<p class="reminder-empty">暂无提醒～</p>';
        } else {
            list.innerHTML = partnerReminders.map(r => `
                <div class="reminder-item${r.done ? ' done' : ''}">
                    <button class="reminder-checkbox" data-id="${r.id}">${r.done ? '✓' : ''}</button>
                    <span class="reminder-text">${r.text}</span>
                    <span class="reminder-who">${r.fromName === '小川' ? '🦊' : '🐟'} ${r.fromName}</span>
                </div>
            `).join('');
            list.querySelectorAll('.reminder-checkbox').forEach(btn => {
                btn.addEventListener('click', () => {
                    toggleReminderDone(parseInt(btn.dataset.id));
                });
            });
        }
    }

    function renderWater() {
        const glassesDiv = document.getElementById('water-glasses');
        let html = '';
        for (let i = 0; i < WATER_GOAL; i++) {
            html += `<span class="water-glass${i < dailyData.waterCount ? ' filled' : ''}">💧</span>`;
        }
        glassesDiv.innerHTML = html;
        const progress = (dailyData.waterCount / WATER_GOAL) * 100;
        document.getElementById('water-progress-bar').style.width = progress + '%';
        document.getElementById('water-count-text').textContent = `${dailyData.waterCount} / ${WATER_GOAL} 杯`;
        document.getElementById('stat-water-count').textContent = `${dailyData.waterCount}/${WATER_GOAL}`;
    }

    function renderWellness() {
        document.querySelectorAll('.wellness-item').forEach(item => {
            const id = item.dataset.id;
            const check = item.querySelector('.wellness-check');
            if (dailyData.wellness[id]) {
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

    function getReminders() {
        const reminders = [];
        const now = new Date();
        const hour = now.getHours();
        if (dailyData.waterCount < WATER_GOAL && hour >= 9 && hour <= 21) {
            reminders.push({
                id: 'water',
                text: `💧 今天喝了 ${dailyData.waterCount}/${WATER_GOAL} 杯水，记得多喝水哦～`,
            });
        }
        return reminders;
    }

    return { init, getReminders, renderAll, render };
})();
