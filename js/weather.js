/* ============================================
   天气模块 - 使用免费 Open-Meteo API
   ============================================ */

const WeatherModule = (() => {
    // 天气代码映射
    const WEATHER_CODES = {
        0:  { icon: '☀️', desc: '晴天', tip: '阳光明媚，出门记得防晒哦～☀️' },
        1:  { icon: '🌤️', desc: '大部晴朗', tip: '天气不错，适合出去走走～' },
        2:  { icon: '⛅', desc: '多云', tip: '云有点多，但心情要晴朗哦～' },
        3:  { icon: '☁️', desc: '阴天', tip: '阴天也要保持好心情哦～带把伞以防万一' },
        45: { icon: '🌫️', desc: '雾', tip: '有雾，出门注意安全～' },
        48: { icon: '🌫️', desc: '雾凇', tip: '有雾，注意保暖～' },
        51: { icon: '🌦️', desc: '小毛毛雨', tip: '下小雨了，记得带伞～🌂' },
        53: { icon: '🌦️', desc: '毛毛雨', tip: '雨不大，但也要带伞哦～' },
        55: { icon: '🌧️', desc: '大毛毛雨', tip: '雨有点大了，记得带伞～' },
        56: { icon: '🌧️', desc: '冻毛毛雨', tip: '好冷！多穿点衣服～🧣' },
        57: { icon: '🌧️', desc: '冻毛毛雨', tip: '很冷！注意保暖～🧣' },
        61: { icon: '🌧️', desc: '小雨', tip: '下雨了，记得带伞～🌂' },
        63: { icon: '🌧️', desc: '中雨', tip: '雨不小呢，出门要带伞哦～' },
        65: { icon: '🌧️', desc: '大雨', tip: '下大雨了！尽量待在室内吧～' },
        66: { icon: '🌨️', desc: '冻雨', tip: '好冷！注意保暖～🧣' },
        67: { icon: '🌨️', desc: '冻雨', tip: '非常冷！多穿点～🧣' },
        71: { icon: '❄️', desc: '小雪', tip: '下雪了！注意保暖～🧤' },
        73: { icon: '❄️', desc: '中雪', tip: '雪不小呢，注意保暖哦～' },
        75: { icon: '❄️', desc: '大雪', tip: '下大雪了！多穿衣服～🧣' },
        77: { icon: '🌨️', desc: '雪粒', tip: '有雪，注意保暖～' },
        80: { icon: '🌦️', desc: '阵雨', tip: '可能会有阵雨，带把伞吧～' },
        81: { icon: '🌧️', desc: '中阵雨', tip: '阵雨不小呢，带伞哦～' },
        82: { icon: '⛈️', desc: '大阵雨', tip: '大阵雨！注意安全～' },
        85: { icon: '🌨️', desc: '小阵雪', tip: '有阵雪，注意保暖～' },
        86: { icon: '🌨️', desc: '大阵雪', tip: '大雪！注意保暖～' },
        95: { icon: '⛈️', desc: '雷暴', tip: '打雷了！待在室内安全哦～⚡' },
        96: { icon: '⛈️', desc: '雷暴+冰雹', tip: '雷暴冰雹！不要出门～⚡' },
        99: { icon: '⛈️', desc: '强雷暴+冰雹', tip: '强雷暴！一定待在室内！⚡' },
    };

    let currentCoords = null;

    // 获取天气数据
    async function fetchWeather(lat, lon) {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code&timezone=auto`;
        try {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error('API error');
            const data = await resp.json();
            return data.current;
        } catch (e) {
            console.error('获取天气失败:', e);
            return null;
        }
    }

    // 获取用户位置
    function getLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('浏览器不支持定位'));
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    resolve({
                        lat: pos.coords.latitude,
                        lon: pos.coords.longitude,
                    });
                },
                (err) => {
                    reject(err);
                },
                { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
            );
        });
    }

    // 更新天气UI
    function updateWeatherUI(current) {
        const weatherInfo = WEATHER_CODES[current.weather_code] || { icon: '🌤️', desc: '未知', tip: '记得照顾好自己～' };

        document.getElementById('weather-icon').textContent = weatherInfo.icon;
        document.getElementById('temp-value').textContent = Math.round(current.temperature_2m);
        document.getElementById('feels-like').textContent = Math.round(current.apparent_temperature) + '°C';
        document.getElementById('humidity').textContent = current.relative_humidity_2m + '%';
        document.getElementById('weather-desc').textContent = weatherInfo.desc;
        document.getElementById('weather-tip').textContent = weatherInfo.tip;

        document.getElementById('weather-loading').classList.add('hidden');
        document.getElementById('weather-content').classList.remove('hidden');
    }

    // 加载天气
    async function loadWeather() {
        // 先尝试从存储中读取位置
        const saved = StorageModule.get('weather_location');
        if (saved) {
            currentCoords = saved;
        } else {
            try {
                currentCoords = await getLocation();
                StorageModule.set('weather_location', currentCoords);
            } catch (e) {
                document.getElementById('weather-loading').innerHTML = '<span>无法获取位置，请前往设置页手动定位 📍</span>';
                return;
            }
        }

        const current = await fetchWeather(currentCoords.lat, currentCoords.lon);
        if (current) {
            updateWeatherUI(current);
            StorageModule.set('weather_cache', {
                data: current,
                time: Date.now(),
            });
        } else {
            // 使用缓存
            const cache = StorageModule.get('weather_cache');
            if (cache && (Date.now() - cache.time < 3600000)) {
                updateWeatherUI(cache.data);
            } else {
                document.getElementById('weather-loading').innerHTML = '<span>获取天气失败，请检查网络 🌐</span>';
            }
        }
    }

    // 强制刷新位置
    async function refreshLocation() {
        try {
            currentCoords = await getLocation();
            StorageModule.set('weather_location', currentCoords);
            document.getElementById('location-status').textContent = '定位成功 ✅';
            await loadWeather();
            return true;
        } catch (e) {
            document.getElementById('location-status').textContent = '定位失败，请允许位置权限';
            return false;
        }
    }

    return {
        loadWeather,
        refreshLocation,
        getLocation,
    };
})();
