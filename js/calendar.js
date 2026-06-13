/* ============================================
   日历模块
   ============================================ */

const CalendarModule = (() => {
    let currentYear, currentMonth;
    let events = {}; // { 'YYYY-MM-DD': ['event text', ...] }

    function init() {
        const now = new Date();
        currentYear = now.getFullYear();
        currentMonth = now.getMonth();
        events = StorageModule.get('calendar_events', {});

        document.getElementById('cal-prev').addEventListener('click', () => navigate(-1));
        document.getElementById('cal-next').addEventListener('click', () => navigate(1));

        render();
    }

    function navigate(delta) {
        currentMonth += delta;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        } else if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        render();
    }

    function getDaysInMonth(year, month) {
        return new Date(year, month + 1, 0).getDate();
    }

    function getFirstDayOfMonth(year, month) {
        return new Date(year, month, 1).getDay();
    }

    function formatDateKey(year, month, day) {
        const m = String(month + 1).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        return `${year}-${m}-${d}`;
    }

    function getDateClasses(day, monthOffset) {
        const classes = ['calendar-day'];
        if (monthOffset !== 0) classes.push('other-month');

        const dateKey = formatDateKey(currentYear, currentMonth + monthOffset, day);
        const todayKey = formatDateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

        if (dateKey === todayKey) classes.push('today');

        // 经期标记
        const periodDays = PeriodModule.getPeriodDays();
        if (periodDays.actual && periodDays.actual.has(dateKey)) {
            classes.push('period');
        }
        if (periodDays.predicted && periodDays.predicted.has(dateKey)) {
            classes.push('predicted-period');
        }

        // 事件标记
        if (events[dateKey] && events[dateKey].length > 0) {
            classes.push('has-event');
        }

        return classes.join(' ');
    }

    function render() {
        // 更新月份标题
        const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
        document.getElementById('cal-month-year').textContent = `${currentYear}年 ${monthNames[currentMonth]}`;

        const grid = document.getElementById('calendar-grid');
        grid.innerHTML = '';

        const daysInMonth = getDaysInMonth(currentYear, currentMonth);
        const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
        const daysInPrevMonth = getDaysInMonth(currentYear, currentMonth - 1 < 0 ? 11 : currentMonth - 1);

        // 填充上个月的天
        for (let i = firstDay - 1; i >= 0; i--) {
            const day = daysInPrevMonth - i;
            const btn = document.createElement('button');
            btn.className = getDateClasses(day, -1);
            btn.textContent = day;
            btn.addEventListener('click', () => onDateClick(currentYear, currentMonth - 1, day));
            grid.appendChild(btn);
        }

        // 当前月的天
        for (let day = 1; day <= daysInMonth; day++) {
            const btn = document.createElement('button');
            btn.className = getDateClasses(day, 0);
            btn.textContent = day;

            // 今日特殊样式
            const dateKey = formatDateKey(currentYear, currentMonth, day);
            const todayKey = formatDateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
            if (dateKey === todayKey) {
                btn.innerHTML = `${day}<span style="font-size:8px;position:absolute;bottom:2px;">今</span>`;
            }

            btn.addEventListener('click', () => onDateClick(currentYear, currentMonth, day));
            grid.appendChild(btn);
        }

        // 填充下个月的天
        const totalCells = firstDay + daysInMonth;
        const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
        for (let day = 1; day <= remainingCells; day++) {
            const btn = document.createElement('button');
            btn.className = getDateClasses(day, 1);
            btn.textContent = day;
            btn.addEventListener('click', () => onDateClick(currentYear, currentMonth + 1, day));
            grid.appendChild(btn);
        }

        updateEventsList();
    }

    function onDateClick(year, month, day) {
        // 标准化月份
        let m = month;
        let y = year;
        if (m < 0) { m = 11; y--; }
        if (m > 11) { m = 0; y++; }

        const dateKey = formatDateKey(y, m, day);
        showDateModal(dateKey);
    }

    function showDateModal(dateKey) {
        // 只移除日历弹窗，不影响其他弹窗
        const old = document.getElementById('calendar-date-modal');
        if (old) old.remove();

        const dateEvents = events[dateKey] || [];

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'calendar-date-modal';
        overlay.innerHTML = `
            <div class="modal-content">
                <h4>📅 ${dateKey}</h4>
                <div style="margin-bottom:12px;max-height:120px;overflow-y:auto;">
                    ${dateEvents.length === 0
                        ? '<p style="color:var(--text-light);font-size:13px;text-align:center;">暂无事件</p>'
                        : dateEvents.map((e, i) => `
                            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;font-size:13px;">
                                <span>• ${e}</span>
                                <button class="event-delete" data-index="${i}">🗑️</button>
                            </div>
                        `).join('')
                    }
                </div>
                <input class="modal-input" type="text" placeholder="添加事件..." id="modal-event-input" maxlength="50">
                <div class="modal-actions">
                    <button class="btn-cancel" id="modal-close">关闭</button>
                    <button class="btn-confirm" id="modal-add">添加事件</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const closeModal = () => overlay.remove();

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        document.getElementById('modal-close').addEventListener('click', closeModal);

        document.getElementById('modal-add').addEventListener('click', () => {
            const input = document.getElementById('modal-event-input');
            const text = input.value.trim();
            if (text) {
                if (!events[dateKey]) events[dateKey] = [];
                events[dateKey].push(text);
                StorageModule.set('calendar_events', events);
                closeModal();
                render();
                showToast(`已添加事件：${text}`);
            }
        });

        // 删除事件
        overlay.querySelectorAll('.event-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.index);
                events[dateKey].splice(idx, 1);
                if (events[dateKey].length === 0) delete events[dateKey];
                StorageModule.set('calendar_events', events);
                closeModal();
                render();
                showToast('事件已删除');
            });
        });

        // 聚焦输入框
        setTimeout(() => document.getElementById('modal-event-input')?.focus(), 100);
    }

    function updateEventsList() {
        const list = document.getElementById('events-list');
        const today = new Date();
        const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());

        // 收集今天及未来事件
        const upcoming = [];
        Object.keys(events).forEach(key => {
            if (key >= todayKey && events[key].length > 0) {
                events[key].forEach(text => {
                    upcoming.push({ date: key, text });
                });
            }
        });

        upcoming.sort((a, b) => a.date.localeCompare(b.date));
        const recent = upcoming.slice(0, 5);

        if (recent.length === 0) {
            list.innerHTML = '<p class="events-empty">点击日历中的日期来添加事件～</p>';
        } else {
            list.innerHTML = recent.map(e => `
                <div class="event-item">
                    <span class="event-text">${e.text}</span>
                    <span class="event-date">${e.date}</span>
                </div>
            `).join('');
        }
    }

    function renderMonth() {
        render();
    }

    return {
        init,
        render: renderMonth,
    };
})();
