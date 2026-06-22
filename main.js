/* ── 테마 ── */
const THEME_KEY = 'restaurant-theme';
const root = document.documentElement;
const themeToggle = document.querySelector('.theme-toggle');
const themeIcon = document.querySelector('.theme-icon');
const themeLabel = document.querySelector('.theme-label');

const applyTheme = (theme) => {
    const isDark = theme === 'dark';
    root.dataset.theme = theme;
    themeToggle.setAttribute('aria-pressed', String(isDark));
    themeToggle.setAttribute('aria-label', isDark ? '화이트 모드로 전환' : '다크 모드로 전환');
    themeIcon.textContent = isDark ? '☀️' : '🌙';
    themeLabel.textContent = isDark ? '화이트 모드' : '다크 모드';
};

const getInitialTheme = () => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

applyTheme(getInitialTheme());
themeToggle.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
});

/* ── 거리 계산 (Haversine) ── */
const haversineM = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const formatDistance = (m) => m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${m}m`;

/* ── 카카오 API ── */
const KAKAO_KEY = '803fc99d6c59c84dd43e09d5815dcf8b';

const kakaoSearch = async (lat, lon) => {
    const params = new URLSearchParams({
        category_group_code: 'FD6',
        y: lat, x: lon, radius: 600, size: 5, sort: 'distance'
    });
    const res = await fetch(
        `https://dapi.kakao.com/v2/local/search/category.json?${params}`,
        { headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` } }
    );
    if (!res.ok) throw new Error(`Kakao ${res.status}`);
    const data = await res.json();
    return (data.documents || []).slice(0, 3).map(r => ({
        name: r.place_name,
        category: r.category_name.split(' > ').pop(),
        lat: parseFloat(r.y),
        lon: parseFloat(r.x),
        distance: parseInt(r.distance, 10),
        address: r.road_address_name || r.address_name || '',
        phone: r.phone || '',
        url: r.place_url || ''
    }));
};

/* ── Overpass 백업 ── */
const overpassSearch = async (lat, lon) => {
    const query = `[out:json][timeout:10];(node["amenity"~"^(restaurant|fast_food|cafe)$"](around:600,${lat},${lon}););out tags 5;`;
    const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST', body: query
    });
    if (!res.ok) throw new Error('Overpass API 오류');
    const data = await res.json();
    const AMENITY_KO = { restaurant: '음식점', fast_food: '패스트푸드', cafe: '카페' };
    return (data.elements || []).slice(0, 3).map(r => ({
        name: r.tags.name || r.tags['name:ko'] || '이름 없음',
        category: AMENITY_KO[r.tags.amenity] || '음식점',
        lat: r.lat,
        lon: r.lon,
        distance: haversineM(lat, lon, r.lat, r.lon),
        address: r.tags['addr:full'] || r.tags['addr:street'] || '',
        phone: r.tags.phone || r.tags['contact:phone'] || '',
        url: ''
    }));
};

/* ── 음식점 검색 (카카오 → Overpass 순) ── */
const fetchNearbyRestaurants = async (lat, lon) => {
    try {
        const results = await kakaoSearch(lat, lon);
        if (results.length > 0) return results;
        console.warn('카카오: 결과 없음, Overpass 시도');
    } catch (e) {
        console.warn('카카오 API 실패:', e.message, '→ Overpass 시도');
    }
    return overpassSearch(lat, lon);
};

/* ── 위치명 ── */
const fetchLocationName = async (lat, lon) => {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ko`
        );
        const data = await res.json();
        const a = data.address || {};
        return [a.quarter || a.neighbourhood || a.suburb || a.village || a.town, a.city || a.county]
            .filter(Boolean).join(' ') || '현재 위치';
    } catch {
        return '현재 위치';
    }
};

/* ── 지도 ── */
let map = null;
const MARKER_COLORS = ['#e8473f', '#f0953a', '#4ca47b'];

const createNumberedIcon = (num, color) => L.divIcon({
    html: `<div style="width:32px;height:32px;border-radius:50% 50% 50% 0;background:${color};border:2px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.3)"><span style="transform:rotate(45deg)">${num}</span></div>`,
    className: '', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -34]
});

const createUserIcon = () => L.divIcon({
    html: `<div style="width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid #fff;box-shadow:0 0 0 3px rgba(59,130,246,0.35),0 2px 6px rgba(0,0,0,0.3)"></div>`,
    className: '', iconSize: [16, 16], iconAnchor: [8, 8]
});

const initMap = (lat, lon, restaurants) => {
    if (map) { map.remove(); map = null; }
    map = L.map('map').setView([lat, lon], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    L.marker([lat, lon], { icon: createUserIcon() }).addTo(map).bindPopup('<strong>📍 현재 위치</strong>');

    const bounds = [[lat, lon]];
    restaurants.forEach((r, i) => {
        bounds.push([r.lat, r.lon]);
        L.marker([r.lat, r.lon], { icon: createNumberedIcon(i + 1, MARKER_COLORS[i]) })
            .addTo(map)
            .bindPopup(`<strong>${r.name}</strong><br><span style="color:#666;font-size:.85em">${r.category}</span><br><span style="color:#888;font-size:.82em">${formatDistance(r.distance)}</span>`);
    });
    map.fitBounds(bounds, { padding: [40, 40] });
};

/* ── UI ── */
const resultSection = document.getElementById('result-section');
const restaurantList = document.getElementById('restaurant-list');
const locationNameEl = document.getElementById('location-name');
const dateTextEl = document.getElementById('date-text');

const showLoading = () => {
    resultSection.hidden = false;
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    restaurantList.innerHTML = `<div class="restaurant-card skeleton-card"><div class="skeleton sk-rank"></div><div class="skeleton-body"><div class="skeleton sk-title"></div><div class="skeleton sk-text"></div><div class="skeleton sk-text short"></div></div></div>`.repeat(3);
    locationNameEl.textContent = '위치 파악 중…';
    dateTextEl.textContent = '—';
};

const renderRestaurants = (restaurants) => {
    dateTextEl.textContent = new Intl.DateTimeFormat('ko-KR', {
        month: 'long', day: 'numeric', weekday: 'short'
    }).format(new Date());

    restaurantList.innerHTML = restaurants.map((r, i) => `
        <article class="restaurant-card">
            <div class="rest-rank" style="background:${MARKER_COLORS[i]}">${i + 1}</div>
            <div class="rest-body">
                <div class="rest-header">
                    <h3 class="rest-name">${r.name}</h3>
                    <span class="rest-distance">${formatDistance(r.distance)}</span>
                </div>
                <span class="rest-category">${r.category}</span>
                ${r.address ? `<p class="rest-address">📌 ${r.address}</p>` : ''}
                ${r.phone ? `<p class="rest-phone">📞 ${r.phone}</p>` : ''}
                ${r.url ? `<a class="rest-link" href="${r.url}" target="_blank" rel="noopener noreferrer">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    카카오맵에서 평점·리뷰 보기
                </a>` : ''}
            </div>
        </article>`).join('');
};

/* ── 메인 ── */
const run = async () => {
    showLoading();

    let coords;
    try {
        const pos = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true, timeout: 12000
            })
        );
        coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    } catch {
        resultSection.hidden = true;
        alert('위치 권한이 필요합니다. 브라우저 설정에서 위치 접근을 허용해 주세요.');
        return;
    }

    try {
        const [locationName, restaurants] = await Promise.all([
            fetchLocationName(coords.lat, coords.lon),
            fetchNearbyRestaurants(coords.lat, coords.lon)
        ]);

        locationNameEl.textContent = locationName;

        if (!restaurants.length) {
            restaurantList.innerHTML = '<p class="empty-msg">주변 600m 내 등록된 음식점이 없습니다.</p>';
            return;
        }

        initMap(coords.lat, coords.lon, restaurants);
        renderRestaurants(restaurants);

    } catch (e) {
        resultSection.hidden = true;
        alert(e.message || '정보를 불러오는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    }
};

document.getElementById('locate-btn').addEventListener('click', () => {
    if (!navigator.geolocation) { alert('이 브라우저는 위치 기능을 지원하지 않습니다.'); return; }
    run();
});
document.getElementById('retry-btn').addEventListener('click', run);

/* ── 모달 ── */
let disqusLoaded = false;
const loadDisqus = () => {
    if (disqusLoaded) return;
    disqusLoaded = true;
    window.disqus_config = function () {
        this.page.url = window.location.href;
        this.page.identifier = window.location.pathname;
    };
    const s = document.createElement('script');
    s.src = 'https://tradingcode.disqus.com/embed.js';
    s.setAttribute('data-timestamp', +new Date());
    (document.head || document.body).appendChild(s);
};

const openModal = (modal) => {
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    modal.querySelector('.modal-close').focus();
};
const closeModal = (modal) => {
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
};

const contactModal = document.getElementById('contact-modal');
const commentsModal = document.getElementById('comments-modal');

document.getElementById('contact-toggle').addEventListener('click', () => openModal(contactModal));
document.getElementById('comments-toggle').addEventListener('click', () => { loadDisqus(); openModal(commentsModal); });
document.querySelectorAll('.modal-close').forEach(btn =>
    btn.addEventListener('click', () => closeModal(btn.closest('.modal-overlay')))
);
document.querySelectorAll('.modal-overlay').forEach(overlay =>
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay); })
);
document.addEventListener('keydown', e => {
    if (e.key === 'Escape')
        [contactModal, commentsModal].forEach(m => { if (m.classList.contains('is-open')) closeModal(m); });
});
