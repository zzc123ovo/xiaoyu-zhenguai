/* ============================================
   智能推送通知模块
   ============================================ */

const NotificationsModule = (() => {
    let notificationSettings = {
        masterEnabled: false,
        waterReminder: true,
        periodReminder: true,
        lastWaterReminder: 0,
        lastPeriodReminder: 0,
    };

    let reminderInterval = null;

    function init() {
        notificationSettings = StorageModule.get('notification_settings', notificationSettings);
        bindEvents();
        loadUI();

        if (notificationSettings.masterEnabled) {
            requestPermissionAndStart();
        }
    }

    function bindEvents() {
        document.getElementById('toggle-notifications').addEventListener('change', (e) => {
            notificationSettings.masterEnabled = e.target.checked;
            save();
            if (e.target.checked) {
                requestPermissionAndStart();
            } else {
                stopReminders();
            }
        });

        document.getElementById('toggle-water-reminder').addEventListener('change', (e) => {
            notificationSettings.waterReminder = e.target.checked;
            save();
        });

        document.getElementById('toggle-period-reminder').addEventListener('change', (e) => {
            notificationSettings.periodReminder = e.target.checked;
            save();
        });
    }

    function loadUI() {
        document.getElementById('toggle-notifications').checked = notificationSettings.masterEnabled;
        document.getElementById('toggle-water-reminder').checked = notificationSettings.waterReminder;
        document.getElementById('toggle-period-reminder').checked = notificationSettings.periodReminder;
    }

    function save() {
        StorageModule.set('notification_settings', notificationSettings);
    }

    async function requestPermissionAndStart() {
        if (!('Notification' in window)) {
            showToast('此浏览器不支持通知功能');
            notificationSettings.masterEnabled = false;
            document.getElementById('toggle-notifications').checked = false;
            save();
            return;
        }

        if (Notification.permission === 'granted') {
            startReminders();
            return;
        }

        if (Notification.permission === 'denied') {
            showToast('通知权限已被拒绝，请在浏览器设置中开启 🔔');
            notificationSettings.masterEnabled = false;
            document.getElementById('toggle-notifications').checked = false;
            save();
            return;
        }

        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                startReminders();
                showToast('智能推送已开启 🔔');
                sendNotification('🦊 小鱼真乖', '智能推送已开启！玲娜贝儿会按时提醒你哦～');
            } else {
                showToast('需要允许通知权限才能使用智能推送');
                notificationSettings.masterEnabled = false;
                document.getElementById('toggle-notifications').checked = false;
                save();
            }
        } catch (e) {
            console.error('请求通知权限失败:', e);
        }
    }

    function startReminders() {
        stopReminders();
        reminderInterval = setInterval(checkAndRemind, 15 * 60 * 1000);
        setTimeout(checkAndRemind, 5000);
    }

    function stopReminders() {
        if (reminderInterval) {
            clearInterval(reminderInterval);
            reminderInterval = null;
        }
    }

    function checkAndRemind() {
        if (!notificationSettings.masterEnabled) return;

        const now = Date.now();
        const hour = new Date().getHours();
        const oneHour = 60 * 60 * 1000;

        // 喝水提醒 - 每小时一次（9:00-21:00）
        if (notificationSettings.waterReminder && hour >= 9 && hour <= 21) {
            if (now - notificationSettings.lastWaterReminder > oneHour) {
                const waterReminders = RemindersModule.getReminders().filter(r => r.id === 'water');
                if (waterReminders.length > 0) {
                    sendNotification('💧 喝水时间到', waterReminders[0].text);
                    notificationSettings.lastWaterReminder = now;
                }
            }
        }

        // 经期提醒 - 每天一次（上午9点）
        if (notificationSettings.periodReminder && hour === 9) {
            if (now - notificationSettings.lastPeriodReminder > 23 * oneHour) {
                const periodMsg = PeriodModule.getPeriodReminder();
                if (periodMsg) {
                    sendNotification('🌸 经期提醒', periodMsg);
                    notificationSettings.lastPeriodReminder = now;
                }
            }
        }

        save();
    }

    function sendNotification(title, body) {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        try {
            const notif = new Notification(title, {
                body,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🦊</text></svg>',
                tag: 'lina-bell-care',
                requireInteraction: false,
                silent: false,
            });

            notif.onclick = () => {
                window.focus();
                notif.close();
            };

            setTimeout(() => notif.close(), 5000);
        } catch (e) {
            console.error('发送通知失败:', e);
        }
    }

    function sendTest() {
        sendNotification('🦊 小鱼真乖', '这是一条测试通知～玲娜贝儿在关心你哦！');
    }

    return {
        init,
        sendNotification,
        sendTest,
        checkAndRemind,
    };
})();
