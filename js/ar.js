/* ============================================
   AR 小惊喜模块
   扫描物品触发虚拟留言
   ============================================ */

const ARModule = (() => {
    let videoStream = null;
    let facingMode = 'environment'; // 后置摄像头
    let surprises = [];              // AR 惊喜消息列表
    let scanActive = false;

    // 默认示例惊喜消息
    const DEFAULT_SURPRISES = [
        { id: 1, trigger: '午餐', emoji: '🍱', message: '宝贝记得好好吃饭哦～每顿都要营养均衡！', from: '小川' },
        { id: 2, trigger: '水果', emoji: '🍎', message: '吃水果啦！补充维生素C，皮肤会越来越好哦～', from: '小川' },
        { id: 3, trigger: '水杯', emoji: '💧', message: '多喝水！一天8杯水，健康又美丽～爱你！', from: '小川' },
        { id: 4, trigger: '书本', emoji: '📚', message: '学习辛苦了！休息一下眼睛，看看远处吧～', from: '小川' },
        { id: 5, trigger: '花', emoji: '🌸', message: '看到花就想到你了，你比花还美～', from: '小川' },
    ];

    function init() {
        surprises = StorageModule.get('ar_surprises', DEFAULT_SURPRISES);
        bindEvents();
        renderSurprisesList();
        renderSettingsList();
    }

    function bindEvents() {
        document.getElementById('btn-ar-scan').addEventListener('click', triggerScan);
        document.getElementById('btn-ar-toggle-camera').addEventListener('click', toggleCamera);
        document.getElementById('btn-add-surprise').addEventListener('click', addSurprise);

        // 页面切换时控制摄像头
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                if (item.dataset.page !== 'ar') {
                    stopCamera();
                }
            });
        });
    }

    // 摄像头操作
    async function startCamera() {
        if (videoStream) return; // 已经启动

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
                audio: false,
            });
            videoStream = stream;
            const video = document.getElementById('ar-video');
            video.srcObject = stream;
            video.play();
            document.getElementById('ar-overlay').style.display = 'flex';
        } catch (e) {
            console.error('摄像头启动失败:', e);
            if (e.name === 'NotAllowedError') {
                showToast('请允许摄像头权限以使用AR功能 📷');
            } else if (e.name === 'NotFoundError') {
                showToast('未找到摄像头设备');
            } else {
                showToast('摄像头启动失败，请检查权限设置');
            }
        }
    }

    function stopCamera() {
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
            videoStream = null;
            document.getElementById('ar-video').srcObject = null;
        }
        scanActive = false;
    }

    async function toggleCamera() {
        facingMode = facingMode === 'environment' ? 'user' : 'environment';
        stopCamera();
        await startCamera();
        showToast(facingMode === 'environment' ? '已切换为后置摄像头' : '已切换为前置摄像头');
    }

    // 扫描触发
    function triggerScan() {
        if (!videoStream) {
            startCamera().then(() => doScan());
            return;
        }
        doScan();
    }

    function doScan() {
        if (scanActive) return;
        scanActive = true;

        const btn = document.getElementById('btn-ar-scan');
        btn.textContent = '🔍 扫描中...';
        btn.style.opacity = '0.7';

        // 模拟扫描动画
        showToast('正在扫描身边的物品... 🔍');

        setTimeout(() => {
            // 随机选取一个惊喜消息（模拟触发）
            // 后续可接入真实图像识别
            if (surprises.length > 0) {
                const surprise = surprises[Math.floor(Math.random() * surprises.length)];
                showARMessage(surprise);
            } else {
                showToast('还没有设置惊喜消息，去设置页面添加吧～');
            }

            btn.textContent = '🔍 扫描物品';
            btn.style.opacity = '1';
            scanActive = false;
        }, 1500 + Math.random() * 1000);
    }

    function showARMessage(surprise) {
        const popup = document.getElementById('ar-message-popup');
        document.getElementById('ar-message-emoji').textContent = surprise.emoji || '💌';
        document.getElementById('ar-message-text').textContent = surprise.message;
        document.getElementById('ar-message-from').textContent = `—— ${surprise.from} 留 💌`;

        popup.classList.remove('hidden');

        // 5秒后自动隐藏
        clearTimeout(popup._hideTimeout);
        popup._hideTimeout = setTimeout(() => {
            popup.classList.add('hidden');
        }, 5000);

        // 点击关闭
        popup.onclick = () => {
            popup.classList.add('hidden');
            clearTimeout(popup._hideTimeout);
        };
    }

    // 惊喜消息管理
    function addSurprise() {
        const trigger = prompt('触发物品名称（如：午餐、水杯、水果等）：');
        if (!trigger || !trigger.trim()) return;

        const emoji = prompt('对应的图标（emoji）：', '💌');
        if (!emoji) return;

        const message = prompt('悄悄话内容：');
        if (!message || !message.trim()) return;

        const from = AppModule.getCurrentUser() === 'xiaochuan' ? '小川' : '小鱼';

        surprises.push({
            id: Date.now(),
            trigger: trigger.trim(),
            emoji: emoji.trim() || '💌',
            message: message.trim(),
            from: from,
        });

        StorageModule.set('ar_surprises', surprises);
        renderSurprisesList();
        renderSettingsList();
        showToast('惊喜消息已添加 ✅');
    }

    function deleteSurprise(id) {
        surprises = surprises.filter(s => s.id !== id);
        StorageModule.set('ar_surprises', surprises);
        renderSurprisesList();
        renderSettingsList();
        showToast('惊喜消息已删除');
    }

    function renderSurprisesList() {
        const list = document.getElementById('surprises-list');
        if (!list) return;

        if (surprises.length === 0) {
            list.innerHTML = '<p class="surprises-empty">还没有设置惊喜消息～<br>去设置页面添加吧！</p>';
            return;
        }

        list.innerHTML = surprises.map(s => `
            <div class="surprise-item">
                <span class="surprise-item-icon">${s.emoji}</span>
                <div class="surprise-item-info">
                    <div class="surprise-item-name">${s.trigger}</div>
                    <div class="surprise-item-msg">${s.message}</div>
                </div>
            </div>
        `).join('');
    }

    function renderSettingsList() {
        const list = document.getElementById('ar-settings-list');
        if (!list) return;

        if (surprises.length === 0) {
            list.innerHTML = '<p style="color:var(--text-light);font-size:13px;">还没有惊喜消息，点击下方按钮添加</p>';
            return;
        }

        list.innerHTML = surprises.map(s => `
            <div class="ar-setting-item">
                <span>${s.emoji}</span>
                <span>${s.trigger}</span>
                <span style="color:var(--text-light);font-size:11px;flex:1;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 8px;">${s.message}</span>
                <button class="surprise-delete" data-id="${s.id}">🗑️</button>
            </div>
        `).join('');

        // 绑定删除按钮
        list.querySelectorAll('.surprise-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm('确定删除这条惊喜消息吗？')) {
                    deleteSurprise(parseInt(btn.dataset.id));
                }
            });
        });
    }

    // 页面激活时启动摄像头
    function onPageActive() {
        startCamera();
    }

    function onPageInactive() {
        stopCamera();
    }

    return {
        init,
        onPageActive,
        onPageInactive,
        startCamera,
        stopCamera,
    };
})();
