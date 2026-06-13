/* ============================================
   美食分享模块 - 拍照分享每一顿
   ============================================ */

const MealsModule = (() => {
    const MAX_MEALS = 20;           // 最多保存20条记录
    const THUMB_MAX_W = 400;        // 压缩后最大宽度

    let meals = [];

    let mealPhotoData = null;       // 当前待分享的照片 dataURL
    let mealPhotoFile = null;
    let eventsBound = false;

    function init() {
        loadMeals();
        if (!eventsBound) {
            bindEvents();
            eventsBound = true;
        }
        render();
    }

    function loadMeals() {
        const saved = StorageModule.get('meals', []);
        meals = saved;
    }

    function saveMeals() {
        // 限制数量
        if (meals.length > MAX_MEALS) {
            meals = meals.slice(-MAX_MEALS);
        }
        StorageModule.set('meals', meals);
    }

    function bindEvents() {
        document.getElementById('btn-add-meal').addEventListener('click', () => {
            document.getElementById('meal-photo-input').click();
        });

        document.getElementById('meal-photo-input').addEventListener('change', handlePhotoSelected);

        document.getElementById('meal-modal-close').addEventListener('click', closeMealModal);
        document.getElementById('meal-modal-save').addEventListener('click', saveMeal);

        document.getElementById('meal-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('meal-modal')) closeMealModal();
        });
    }

    function handlePhotoSelected(e) {
        const file = e.target.files[0];
        if (!file) return;

        mealPhotoFile = file;

        // 压缩并预览
        compressImage(file, (dataUrl) => {
            mealPhotoData = dataUrl;
            const previewImg = document.getElementById('meal-preview-img');
            const placeholder = document.querySelector('.meal-preview-placeholder');
            previewImg.src = dataUrl;
            previewImg.style.display = 'block';
            if (placeholder) placeholder.style.display = 'none';
            document.getElementById('meal-modal').classList.remove('hidden');
            document.getElementById('meal-caption-input').value = '';
            setTimeout(() => document.getElementById('meal-caption-input').focus(), 100);
        });
    }

    function compressImage(file, callback) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width;
                let h = img.height;
                if (w > THUMB_MAX_W) {
                    h = Math.round(h * (THUMB_MAX_W / w));
                    w = THUMB_MAX_W;
                }
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                callback(canvas.toDataURL('image/jpeg', 0.75));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function saveMeal() {
        if (!mealPhotoData) {
            showToast('请先拍照或选择照片');
            return;
        }

        const caption = document.getElementById('meal-caption-input').value.trim() || '美食分享 🍽️';
        const currentUser = getCurrentUser();

        meals.push({
            id: Date.now(),
            user: currentUser,
            userName: currentUser === 'xiaochuan' ? '小川' : '小鱼',
            photo: mealPhotoData,
            caption: caption,
            time: getTimeStr(),
            date: getTodayKey(),
        });

        saveMeals();
        closeMealModal();
        render();
        updateHomeStat();
        showToast('美食已分享 🍽️');
    }

    function closeMealModal() {
        document.getElementById('meal-modal').classList.add('hidden');
        mealPhotoData = null;
        mealPhotoFile = null;
        // 重置 input
        document.getElementById('meal-photo-input').value = '';
        document.getElementById('meal-preview-img').style.display = 'none';
        const placeholder = document.querySelector('.meal-preview-placeholder');
        if (placeholder) placeholder.style.display = 'block';
    }

    function render() {
        const stream = document.getElementById('meal-stream');
        const today = getTodayKey();
        const todayMeals = meals.filter(m => m.date === today);

        if (todayMeals.length === 0) {
            stream.innerHTML = '<p class="meals-empty">今天还没有分享美食哦～<br>点击下方按钮拍照分享吧！</p>';
        } else {
            stream.innerHTML = todayMeals.map(m => `
                <div class="meal-item">
                    <div class="meal-item-header">
                        <span class="meal-item-who">${m.userName === '小川' ? '🦊' : '🐟'} ${m.userName}的${getMealType(m.time)}</span>
                        <span class="meal-item-time">${m.time}</span>
                    </div>
                    <img class="meal-item-img" src="${m.photo}" alt="${m.caption}" loading="lazy">
                    <div class="meal-item-caption">${m.caption}</div>
                </div>
            `).join('');
        }
    }

    function getMealType(timeStr) {
        const hour = parseInt(timeStr.split(':')[0]);
        if (hour < 10) return '早餐';
        if (hour < 14) return '午餐';
        if (hour < 17) return '下午茶';
        if (hour < 21) return '晚餐';
        return '夜宵';
    }

    function updateHomeStat() {
        const today = getTodayKey();
        const todayMeals = meals.filter(m => m.date === today);
        document.getElementById('stat-meals-count').textContent = todayMeals.length + '顿';
    }

    function getTimeStr() {
        const now = new Date();
        return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    }

    function getTodayKey() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    // 每天重置时清理旧数据
    function resetDaily() {
        const today = getTodayKey();
        // 保留最近3天的数据
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        const cutoff = `${threeDaysAgo.getFullYear()}-${String(threeDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(threeDaysAgo.getDate()).padStart(2, '0')}`;
        meals = meals.filter(m => m.date >= cutoff);
        saveMeals();
        render();
        updateHomeStat();
    }

    return {
        init,
        render,
        updateHomeStat,
        resetDaily,
    };
})();
