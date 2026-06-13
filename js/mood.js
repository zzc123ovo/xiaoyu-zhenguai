/* ============================================
   心情追踪模块 - 小川 & 小鱼互相可见
   ============================================ */

const MoodModule = (() => {
    const USERS = {
        xiaoyu:  { name: '小鱼', emoji: '🐟' },
        xiaochuan: { name: '小川', emoji: '🦊' },
    };

    let moods = {
        xiaoyu:    { emoji: '😊', text: '今天心情不错～', time: '' },
        xiaochuan: { emoji: '🥰', text: '想小鱼了～', time: '' },
    };

    let selectedEmoji = '😊';
    let eventsBound = false;

    function init() {
        moods = StorageModule.get('moods', moods);
        render();
        if (!eventsBound) {
            bindEvents();
            eventsBound = true;
        }
    }

    function bindEvents() {
        document.getElementById('btn-set-mood').addEventListener('click', openMoodModal);

        // Emoji picker
        document.querySelectorAll('.mood-emoji-option').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mood-emoji-option').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                selectedEmoji = btn.textContent;
            });
        });

        // 预设选中当前用户的心情emoji
        const currentUser = AppModule.getCurrentUser();
        if (moods[currentUser] && moods[currentUser].emoji) {
            selectedEmoji = moods[currentUser].emoji;
            document.querySelectorAll('.mood-emoji-option').forEach(btn => {
                if (btn.textContent === selectedEmoji) {
                    btn.classList.add('selected');
                }
            });
        }

        // 弹窗操作
        document.getElementById('mood-modal-close').addEventListener('click', closeMoodModal);
        document.getElementById('mood-modal-save').addEventListener('click', saveMood);

        // 点击背景关闭
        document.getElementById('mood-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('mood-modal')) {
                closeMoodModal();
            }
        });
    }

    function openMoodModal() {
        const currentUser = AppModule.getCurrentUser();
        const currentMood = moods[currentUser];

        // 预选当前emoji
        if (currentMood && currentMood.emoji) {
            selectedEmoji = currentMood.emoji;
            document.querySelectorAll('.mood-emoji-option').forEach(btn => {
                btn.classList.toggle('selected', btn.textContent === currentMood.emoji);
            });
        }

        // 预填当前文字
        document.getElementById('mood-text-input').value = currentMood ? currentMood.text : '';
        document.getElementById('mood-modal').classList.remove('hidden');

        setTimeout(() => document.getElementById('mood-text-input').focus(), 100);
    }

    function closeMoodModal() {
        document.getElementById('mood-modal').classList.add('hidden');
    }

    function saveMood() {
        const currentUser = AppModule.getCurrentUser();
        const text = document.getElementById('mood-text-input').value.trim() || '今天心情不错～';
        const now = new Date();

        moods[currentUser] = {
            emoji: selectedEmoji,
            text: text,
            time: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
        };

        StorageModule.set('moods', moods);
        render();
        closeMoodModal();
        showToast(`心情已更新 ${selectedEmoji}`);
    }

    function render() {
        ['xiaoyu', 'xiaochuan'].forEach(user => {
            const mood = moods[user];
            const el = document.getElementById(`mood-emoji-${user}`);
            const textEl = document.getElementById(`mood-text-${user}`);
            const timeEl = document.getElementById(`mood-time-${user}`);

            if (el) el.textContent = mood.emoji || '😊';
            if (textEl) textEl.textContent = mood.text || '';
            if (timeEl) timeEl.textContent = mood.time || '';
        });
    }

    // 获取当前用户的心情消息（用于首页问候等）
    function getCurrentUserMood() {
        const user = AppModule.getCurrentUser();
        return moods[user] || { emoji: '😊', text: '今天心情不错～' };
    }

    return {
        init,
        render,
        getCurrentUserMood,
    };
})();
