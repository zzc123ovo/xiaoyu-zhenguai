/* ============================================
   经期追踪模块
   ============================================ */

const PeriodModule = (() => {
    // 默认设置
    let settings = {
        lastPeriodStart: null,  // 'YYYY-MM-DD'
        cycleLength: 28,
        periodLength: 5,
    };

    // 阶段信息
    const PHASES = {
        MENSTRUAL: {
            name: '经期',
            icon: '🌸',
            desc: '生理期，需要特别照顾自己',
            tips: {
                diet: '多喝温水，吃温热食物，避免生冷辛辣。推荐：红糖姜茶、红枣枸杞茶、温牛奶',
                exercise: '适当休息，可做轻柔拉伸和散步，避免剧烈运动',
                rest: '保证充足睡眠，可用暖水袋敷肚子缓解不适。早点休息，给自己更多时间放松',
            },
        },
        FOLLICULAR: {
            name: '卵泡期',
            icon: '🌱',
            desc: '经期后恢复期，精力充沛',
            tips: {
                diet: '补充铁质和蛋白质，多吃绿叶蔬菜、瘦肉、豆制品',
                exercise: '精力旺盛期，适合进行有氧运动和力量训练',
                rest: '保持规律作息，是护肤的好时机',
            },
        },
        OVULATORY: {
            name: '排卵期',
            icon: '✨',
            desc: '身体状态最佳时期',
            tips: {
                diet: '多吃富含纤维的食物，保持水分摄入，新鲜水果和蔬菜',
                exercise: '运动表现最佳时期，可以尝试高强度训练',
                rest: '注意保持良好睡眠，可能会有轻微腹胀属正常现象',
            },
        },
        LUTEAL: {
            name: '黄体期',
            icon: '🌙',
            desc: '经前准备期，可能会有情绪波动',
            tips: {
                diet: '减少盐分摄入防止水肿，多吃含镁食物（坚果、香蕉），避免咖啡因',
                exercise: '适合温和运动如瑜伽、快走，帮助缓解经前不适',
                rest: '可能会有疲劳感，听从身体的声音，多休息。可泡热水澡放松',
            },
        },
    };

    function init() {
        settings = StorageModule.get('period_settings', settings);
        bindEvents();
        updateAllUI();
    }

    function bindEvents() {
        document.getElementById('save-period-settings').addEventListener('click', saveSettings);

        // 加载已保存的值
        const startDate = document.getElementById('period-start-date');
        const cycleLength = document.getElementById('cycle-length');
        const periodLength = document.getElementById('period-length');

        if (settings.lastPeriodStart) {
            startDate.value = settings.lastPeriodStart;
        }
        cycleLength.value = settings.cycleLength;
        periodLength.value = settings.periodLength;
    }

    function saveSettings() {
        const startDate = document.getElementById('period-start-date').value;
        const cycleLength = parseInt(document.getElementById('cycle-length').value);
        const periodLength = parseInt(document.getElementById('period-length').value);

        if (!startDate) {
            showToast('请选择上次经期开始日期');
            return;
        }
        if (cycleLength < 20 || cycleLength > 45) {
            showToast('周期长度应在20-45天之间');
            return;
        }
        if (periodLength < 2 || periodLength > 10) {
            showToast('经期持续天数应在2-10天之间');
            return;
        }

        settings = { lastPeriodStart: startDate, cycleLength, periodLength };
        StorageModule.set('period_settings', settings);
        updateAllUI();
        CalendarModule.render();
        showToast('经期设置已保存 ✅');
    }

    function getPeriodDays() {
        if (!settings.lastPeriodStart) return { actual: new Set(), predicted: new Set() };

        const actual = new Set();
        const predicted = new Set();
        const start = new Date(settings.lastPeriodStart + 'T00:00:00');

        // 计算最近6个周期的实际经期天
        for (let c = 0; c < 6; c++) {
            const cycleStart = new Date(start);
            cycleStart.setDate(cycleStart.getDate() + c * settings.cycleLength);
            for (let d = 0; d < settings.periodLength; d++) {
                const day = new Date(cycleStart);
                day.setDate(day.getDate() + d);
                const key = formatDate(day);
                if (cycleStart <= new Date()) {
                    actual.add(key);
                } else {
                    predicted.add(key);
                }
            }
        }

        return { actual, predicted };
    }

    function getCurrentCycleInfo() {
        if (!settings.lastPeriodStart) return null;

        const start = new Date(settings.lastPeriodStart + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 找到当前周期
        let cycleStart = new Date(start);
        while (true) {
            const nextStart = new Date(cycleStart);
            nextStart.setDate(nextStart.getDate() + settings.cycleLength);
            if (nextStart > today) break;
            cycleStart = nextStart;
        }

        const cycleDay = Math.floor((today - cycleStart) / (1000 * 60 * 60 * 24)) + 1;
        const daysUntilNext = settings.cycleLength - cycleDay;

        // 判断阶段
        let phase;
        if (cycleDay <= settings.periodLength) {
            phase = PHASES.MENSTRUAL;
        } else if (cycleDay <= 12) {
            phase = PHASES.FOLLICULAR;
        } else if (cycleDay <= 16) {
            phase = PHASES.OVULATORY;
        } else {
            phase = PHASES.LUTEAL;
        }

        // 下一个经期预测
        const nextPeriod = new Date(cycleStart);
        nextPeriod.setDate(nextPeriod.getDate() + settings.cycleLength);

        return {
            cycleDay,
            daysUntilNext,
            phase,
            nextPeriod: formatDate(nextPeriod),
            cycleStart: formatDate(cycleStart),
        };
    }

    function updateAllUI() {
        const info = getCurrentCycleInfo();

        // 如果没有设置经期信息，使用默认显示
        if (!info) {
            document.getElementById('phase-icon').textContent = '🌸';
            document.getElementById('phase-name').textContent = '请先设置经期信息';
            document.getElementById('phase-desc').textContent = '设置后才能获取个性化护理建议';
            document.getElementById('phase-progress').style.width = '0%';
            document.getElementById('phase-days').textContent = '';
            document.getElementById('stat-cycle-day').textContent = '--';
            document.getElementById('period-cycle-info').innerHTML = '<span>设置你的经期信息以获取个性化护理建议</span>';
            document.getElementById('care-tips').innerHTML = `
                <div class="care-tip">
                    <span class="care-tip-icon">🍵</span>
                    <div class="care-tip-content">
                        <strong>饮食建议</strong>
                        <p>请先设置经期信息</p>
                    </div>
                </div>
                <div class="care-tip">
                    <span class="care-tip-icon">🧘</span>
                    <div class="care-tip-content">
                        <strong>运动建议</strong>
                        <p>请先设置经期信息</p>
                    </div>
                </div>
                <div class="care-tip">
                    <span class="care-tip-icon">💤</span>
                    <div class="care-tip-content">
                        <strong>休息建议</strong>
                        <p>请先设置经期信息</p>
                    </div>
                </div>
            `;
            if (document.getElementById('daily-tip')) {
                document.getElementById('tip-content').textContent = '记得多喝水，保持好心情～';
            }
            return;
        }

        // 更新经期页标题信息
        document.getElementById('period-cycle-info').innerHTML = `
            <span>当前是周期第 <strong>${info.cycleDay}</strong> 天</span><br>
            <span>预计下次经期：<strong>${info.nextPeriod}</strong>（还有 ${info.daysUntilNext} 天）</span>
        `;

        // 更新阶段卡片
        document.getElementById('phase-icon').textContent = info.phase.icon;
        document.getElementById('phase-name').textContent = info.phase.name + ' · ' + info.phase.desc;
        document.getElementById('phase-desc').textContent = `周期第 ${info.cycleDay} 天 / 共 ${settings.cycleLength} 天`;
        document.getElementById('phase-days').textContent = `距下次经期还有 ${info.daysUntilNext} 天`;

        // 更新进度条
        const progress = (info.cycleDay / settings.cycleLength) * 100;
        document.getElementById('phase-progress').style.width = progress + '%';

        // 更新护理建议
        document.getElementById('care-tips').innerHTML = `
            <div class="care-tip">
                <span class="care-tip-icon">🍵</span>
                <div class="care-tip-content">
                    <strong>饮食建议</strong>
                    <p>${info.phase.tips.diet}</p>
                </div>
            </div>
            <div class="care-tip">
                <span class="care-tip-icon">🧘</span>
                <div class="care-tip-content">
                    <strong>运动建议</strong>
                    <p>${info.phase.tips.exercise}</p>
                </div>
            </div>
            <div class="care-tip">
                <span class="care-tip-icon">💤</span>
                <div class="care-tip-content">
                    <strong>休息建议</strong>
                    <p>${info.phase.tips.rest}</p>
                </div>
            </div>
        `;

        // 更新首页统计
        document.getElementById('stat-cycle-day').textContent = `第${info.cycleDay}天`;

        // 更新首页小贴士
        const phaseTips = {
            MENSTRUAL: '经期要多喝温水，用暖水袋敷肚子会舒服很多哦～',
            FOLLICULAR: '精力恢复中！多吃绿叶蔬菜和蛋白质补充营养～',
            OVULATORY: '状态最佳时期！适合运动和社交～',
            LUTEAL: '经前可能会有情绪波动，听听音乐放松一下吧～',
        };
        if (document.getElementById('daily-tip')) {
            document.getElementById('tip-content').textContent = phaseTips[Object.keys(PHASES).find(k => PHASES[k] === info.phase)] || '记得多喝水，保持好心情～';
        }
    }

    function formatDate(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // 获取经期提醒信息（供通知模块使用）
    function getPeriodReminder() {
        const info = getCurrentCycleInfo();
        if (!info) return null;

        // 经期前3天提醒
        if (info.daysUntilNext === 3) {
            return '🌸 预计3天后经期开始，记得准备好卫生用品哦～';
        }
        if (info.daysUntilNext === 1) {
            return '🌸 预计明天经期开始，今天记得早点休息～';
        }
        if (info.daysUntilNext === 0) {
            return '🌸 今天可能是经期第一天，注意保暖，多喝热水～';
        }
        // 经期中提醒
        if (info.cycleDay <= settings.periodLength) {
            return '💆 经期第' + info.cycleDay + '天，记得多喝温水，好好休息～';
        }

        return null;
    }

    return {
        init,
        getPeriodDays,
        getCurrentCycleInfo,
        getPeriodReminder,
        updateAllUI,
    };
})();
