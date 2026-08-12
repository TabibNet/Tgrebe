import { supabase } from './supabase.js';

const ADMIN_PASSWORD = "Alicon2006@";
const IMGBB_API_KEY = "8a92929a2c1c90634ffc7ba88f2d481d"; 
const daysOfWeek = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

let currentAnnouncement = null;
let allAnnouncements = [];
let currentFilter = 'all';
let searchQuery = '';
let allData = [];
let bookings = []; 
let activeFollowupUnsub = null;
let currentFollowupBookingId = null;
let tempBooking = {}; 
let scrollLockCount = 0;
let unsubscribeMedRequests = null; 
let bloodRequests = []; 
let medicineDonations = [];
let burnState = { cause: null, degree: null, area: null };
let healthTips = [];
let tipInterval = null;
let currentHealthFileId = localStorage.getItem('healthFileId') || null;
let allQuestions = [];
let unsubscribeQuestions = null;
let currentRadarTab = 'summer';
let radarSettings = { defaultSeason: 'summer', lastReset: 0 };
let unsubscribeRadar = null;
let unsubscribeRadarSettings = null;
let latestRadarReports = [];
let activeAds = [];
let currentAdIndex = 0;
let adInterval = null;
let allHomeAds = [];

function generateUniqueId() { return Math.random().toString(36).substring(2, 8).toUpperCase(); }
function lockScroll() { scrollLockCount++; document.body.style.overflow = 'hidden'; }
function unlockScroll() { scrollLockCount = Math.max(0, scrollLockCount - 1); if (scrollLockCount === 0) { document.body.style.overflow = ''; } }

const localFallbackTips = [
    "احرص على شرب 8 أكواب من الماء يومياً للحفاظ على ترطيب الجسم ووظائف الكلى.",
    "تجنب شرب الشاي أو القهوة بعد الوجبات مباشرة لمنع تقليل امتصاص الحديد من الطعام.",
    "المشي لمدة 30 دقيقة يومياً يقلل من خطر الإصابة بأمراض القلب والسكري.",
    "لا تأخذ المضادات الحيوية دون وصفة طبية، فالاستهلاك الخاطئ يؤدي لمناعة البكتيريا.",
    "النوم لمدة 7-8 ساعات يومياً يعزز مناعة الجسم ويحسن المزاج العام.",
    "احرص على تناول وجبة الفطور، فهي أهم وجبة تمنحك الطاقة لبدء يومك.",
    "غسل اليدين بالماء والصابون لمدة 20 ثانية هو أفضل طريقة لمنع انتشار العدوى.",
    "الإكثار من تناول الخضروات والفواكه الطازجة يمد الجسم بالفيتامينات ومضادات الأكسدة."
];

function updateTipDisplay() {
    const tipEl = document.getElementById('dailyTipText');
    if (!tipEl) return;
    const tip = localFallbackTips[Math.floor(Math.random() * localFallbackTips.length)];
    tipEl.style.opacity = '0';
    setTimeout(() => {
        tipEl.innerText = tip;
        tipEl.style.opacity = '1';
    }, 300);
}

window.setupOneSignal = async () => {
    if (!window.OneSignalDeferred) { 
        showToast("نظام الإشعارات لم يكتمل تحميله بعد، يرجى المحاولة بعد ثوانٍ"); 
        return; 
    }
    OneSignalDeferred.push(async function(OneSignal) {
        try {
            if (OneSignal.Notifications.permission === 'denied') {
                showToast("الإشعارات محظورة من إعدادات المتصفح! يرجى السماح لها يدوياً.");
                return;
            }
            if (OneSignal.Notifications.permission !== 'granted') {
                const granted = await OneSignal.Notifications.requestPermission();
                if (!granted) { showToast("تم رفض الإشعارات."); return; }
            }
            if (!OneSignal.User.PushSubscription.optedIn) {
                await OneSignal.User.PushSubscription.optIn();
            }
            OneSignal.User.PushSubscription.addEventListener('change', async (event) => {
                const playerId = event.current.id;
                if (playerId) {
                    try {
                        await supabase.from('onesignal_users').upsert({ id: playerId, created_at: new Date().toISOString() });
                        localStorage.setItem('onesignal_player_id', playerId);
                        showToast('تم تفعيل إشعارات الخلفية بنجاح! 🔔');
                    } catch (e) { 
                        console.error("DB Save Error:", e);
                        showToast('تم التفعيل ولكن حدث خطأ في حفظ الجهاز'); 
                    }
                }
            });
            if (OneSignal.User.PushSubscription.optedIn) {
                const id = OneSignal.User.PushSubscription.id;
                if (id) {
                   await supabase.from('onesignal_users').upsert({ id: id, created_at: new Date().toISOString() });
                   localStorage.setItem('onesignal_player_id', id);
                   showToast('الإشعارات مفعلة مسبقاً ✅');
                }
            }
        } catch (err) {
            console.error("OneSignal Error:", err);
            showToast("حدث خطأ غير متوقع في تفعيل الإشعارات");
        }
    });
};

window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const splash = document.getElementById('appSplashScreen');
        if (splash) {
            splash.classList.add('hidden');
            setTimeout(() => { splash.style.display = 'none'; }, 1000);
        }
    }, 1200);

    const langToggle = document.getElementById('langToggle');
    let isEnglish = document.cookie.includes('googtrans=/ar/en');
    function applyLangLayout() {
        if (!langToggle) return;
        if (isEnglish) {
            langToggle.innerText = 'ع';
            document.documentElement.lang = 'en';
            document.documentElement.dir = 'LTR';
        } else {
            langToggle.innerText = 'EN';
            document.documentElement.lang = 'ar';
            document.documentElement.dir = 'rtl';
        }
    }
    if (langToggle) {
        applyLangLayout();
        langToggle.addEventListener('click', (e) => {
            e.preventDefault();
            if (isEnglish) {
                document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                isEnglish = false;
            } else {
                document.cookie = 'googtrans=/ar/en; path=/';
                isEnglish = true;
            }
            location.reload();
        });
    }

    if (tipInterval) clearInterval(tipInterval);
    updateTipDisplay();
    tipInterval = setInterval(updateTipDisplay, 12000);
    
    const cachedData = localStorage.getItem('cached_listings');
    const forceUpdate = localStorage.getItem('force_listings_update') === 'true';
    if (cachedData) {
        allData = JSON.parse(cachedData);
        if (!forceUpdate) { renderData(); updateStats(); }
    }

    // جلب المنشآت من Supabase
    fetchListings();

    // جلب الحجوزات من Supabase (محاكاة لـ onSnapshot عبر جلب دوري أو لايف)
    fetchBookings();

    // جلب استغاثات الدم
    fetchBloodRequests();

    // جلب الأدوية الفائضة
    fetchMedicineDonations();

    document.getElementById('lightbox').addEventListener('click', () => { document.getElementById('lightbox').classList.remove('active'); unlockScroll(); });
    document.getElementById('darkModeToggle').addEventListener('click', () => { document.documentElement.classList.toggle('dark'); localStorage.setItem('darkMode', document.documentElement.classList.contains('dark')); });
    if (localStorage.getItem('darkMode') === 'true') document.documentElement.classList.add('dark');
    
    const heroLogo = document.querySelector('.hero-medical-logo');
    if (heroLogo) {
        heroLogo.style.opacity = '0';
        heroLogo.style.transform = 'translateY(20px)';
        setTimeout(() => {
            heroLogo.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
            heroLogo.style.opacity = '1';
            heroLogo.style.transform = 'translateY(0)';
        }, 300);
    }

    trackAndDisplayVisitors();
});

// === دوال جلب البيانات الأساسية من Supabase ===
async function fetchListings() {
    const { data: freshData, error } = await supabase.from('listings').select('*');
    if (error) { console.error("Error fetching listings:", error); return; }
    
    const forceUpdate = localStorage.getItem('force_listings_update') === 'true';
    if (JSON.stringify(freshData) !== JSON.stringify(allData) || forceUpdate) {
        allData = freshData || [];
        renderData(); 
        updateStats();
        try {
            localStorage.setItem('cached_listings', JSON.stringify(allData));
            localStorage.removeItem('force_listings_update');
        } catch (e) {}
    }
}

async function fetchBookings() {
    const { data, error } = await supabase.from('bookings').select('*');
    if (error) { console.error("Error fetching bookings:", error); return; }
    bookings = data || [];
    if (currentFollowupBookingId) renderFollowupChat(currentFollowupBookingId);
}

async function fetchBloodRequests() {
    const twentyHoursAgo = new Date(Date.now() - (20 * 60 * 60 * 1000)).toISOString();
    const { data, error } = await supabase.from('blood_requests').select('*').gt('created_at', twentyHoursAgo).neq('status', 'resolved');
    if (error) { console.error("Error fetching blood requests:", error); return; }
    bloodRequests = data || [];
    renderHomeBloodAlerts();
}

async function fetchMedicineDonations() {
    const { data, error } = await supabase.from('medicine_donations').select('*').eq('status', 'active');
    if (error) { console.error("Error fetching medicine donations:", error); return; }
    medicineDonations = data || [];
    renderHomeMedicines();
}

function renderHomeBloodAlerts() {
    const section = document.getElementById('homeBloodAlertsSection');
    const container = document.getElementById('homeBloodAlerts');
    if (!section || !container) return;
    if (bloodRequests.length === 0) {
        section.classList.add('hidden');
        container.innerHTML = '';
    } else {
        section.classList.remove('hidden');
        container.innerHTML = bloodRequests.map(req => {
            let statusBox = '';
            let cardBorder = 'border-red-50';
            if (req.responses_count > 0) {
                cardBorder = 'border-green-200 bg-green-50/30';
                statusBox = `<div class="bg-green-100 text-green-800 text-[10px] font-bold p-1.5 rounded-lg flex items-center justify-center gap-1 mb-1.5"><i class="fas fa-heart"></i> المبادرون (${req.responses_count})</div>`;
            }
            return `<div class="bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm flex flex-col gap-1.5 border ${cardBorder} dark:border-red-900/50">
                ${statusBox}
                <div class="flex items-center gap-2">
                    <div class="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0 border border-red-100 dark:border-red-800">
                        <span class="text-sm font-black text-red-600 dark:text-red-400">${req.blood_type}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="font-bold text-gray-800 dark:text-white text-[11px] break-words">${req.patient_name}</div>
                        <div class="text-[9px] text-gray-500 dark:text-gray-400 break-words"><i class="fas fa-hospital text-red-400"></i> ${req.hospital}</div>
                    </div>
                </div>
                ${req.notes ? `<div class="text-[9px] text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-900/20 p-1 rounded break-words text-center"><i class="fas fa-notes-medical"></i> ${req.notes}</div>` : ''}
                <div class="flex gap-1.5 mt-1">
                    <a href="tel:${req.phone}" class="flex-1 h-7 rounded-lg bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold hover:bg-blue-600 transition-colors">اتصال</a>
                    <button onclick="respondToBloodRequest(this, '${req.id}', '${req.patient_name}', '${req.phone}')" class="flex-1 h-7 rounded-lg bg-green-500 text-white flex items-center justify-center text-[10px] font-bold hover:bg-green-600 transition-colors">قادم للتبرع</button>
                </div>
            </div>`;
        }).join('');
    }
    checkAlertsWrapperVisibility();
}

function renderHomeMedicines() {
    const section = document.getElementById('homeMedicinesSection');
    const container = document.getElementById('homeMedicinesList');
    if (!section || !container) return;
    if (medicineDonations.length === 0) {
        section.classList.add('hidden');
        container.innerHTML = '';
    } else {
        section.classList.remove('hidden');
        container.innerHTML = medicineDonations.map(m => `
            <div class="bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm flex flex-col gap-1.5 border border-green-50 dark:border-green-900/50">
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 border border-green-100 dark:border-green-800"><i class="fas fa-pills text-green-600 dark:text-green-400 text-xs"></i></div>
                    <div class="font-bold text-[11px] text-gray-800 dark:text-white break-words">${m.medicine_name}</div>
                </div>
                <div class="text-[9px] text-gray-500 dark:text-gray-400 flex flex-col gap-0.5">
                    <span><i class="fas fa-box"></i> ${m.quantity}</span>
                    <span class="text-red-500 dark:text-red-400 font-bold"><i class="fas fa-calendar-times"></i> ${m.expiry_date}</span>
                </div>
                <a href="tel:${m.phone}" class="mt-0.5 block text-center bg-green-500 text-white py-1 rounded-lg text-[9px] font-bold w-full">تواصل</a>
            </div>
        `).join('');
    }
    checkAlertsWrapperVisibility();
}

function checkAlertsWrapperVisibility() {
    const wrapper = document.getElementById('homeAlertsWrapper');
    const bloodSection = document.getElementById('homeBloodAlertsSection');
    const medSection = document.getElementById('homeMedicinesSection');
    if (!wrapper || !bloodSection || !medSection) return;
    if (bloodSection.classList.contains('hidden') && medSection.classList.contains('hidden')) {
        wrapper.classList.add('hidden');
        wrapper.classList.remove('flex');
    } else {
        wrapper.classList.remove('hidden');
        wrapper.classList.add('flex');
    }
}

function updateStats() {
    document.getElementById('stat-hospital').textContent = allData.filter(d => d.type === 'hospital').length;
    document.getElementById('stat-clinic').textContent = allData.filter(d => d.type === 'clinic').length;
    document.getElementById('stat-center').textContent = allData.filter(d => d.type === 'center').length;
    document.getElementById('stat-lab').textContent = allData.filter(d => d.type === 'lab').length;
    document.getElementById('stat-doctor').textContent = allData.filter(d => d.type === 'doctor').length;
    document.getElementById('stat-pharmacy').textContent = allData.filter(d => d.type === 'pharmacy').length;
}

// تنتهي هنا الجزء الأول...
// === الجزء الثاني: دوال العرض والبحث والنوافذ ===
function createCard(item) {
    const typeMap = { 
        hospital: { cardClass: 'hospital-card', badgeClass: 'badge-hospital', iconClass: 'cat-icon-hospital', icon: 'fa-hospital-symbol', label: 'مشفى', color: 'var(--hospital)' }, 
        clinic: { cardClass: 'clinic-card', badgeClass: 'badge-clinic', iconClass: 'cat-icon-clinic', icon: 'fa-hospital', label: 'عيادة', color: 'var(--clinic)' }, 
        center: { cardClass: 'center-card', badgeClass: 'badge-center', iconClass: 'cat-icon-center', icon: 'fa-clinic-medical', label: 'مركز طبي', color: 'var(--center)' }, 
        lab: { cardClass: 'lab-card', badgeClass: 'badge-lab', iconClass: 'cat-icon-lab', icon: 'fa-flask', label: 'مخبر', color: 'var(--lab)' }, 
        doctor: { cardClass: 'doctor-card', badgeClass: 'badge-doctor', iconClass: 'cat-icon-doctor', icon: 'fa-user-md', label: 'طبيب', color: 'var(--doctor)' }, 
        pharmacy: { cardClass: 'pharmacy-card', badgeClass: 'badge-pharmacy', iconClass: 'cat-icon-pharmacy', icon: 'fa-pills', label: 'صيدلية', color: 'var(--pharmacy)' } 
    };
    const t = typeMap[item.type] || typeMap.clinic;
    const fullStars = Math.floor(item.rating || 0); const halfStar = (item.rating || 0) % 1 >= 0.5; let starsHTML = '';
    for (let i = 0; i < fullStars; i++) starsHTML += '<i class="fas fa-star"></i>';
    if (halfStar) starsHTML += '<i class="fas fa-star-half-alt"></i>';
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
    for (let i = 0; i < emptyStars; i++) starsHTML += '<i class="far fa-star"></i>';
    let detailsHTML = '';
    if (item.type === 'hospital') detailsHTML = `<div class="detail-row"><i class="fas fa-map-marker-alt"></i><span>${item.address || ''}</span></div><div class="detail-row"><i class="fas fa-clock"></i><span>${item.hours || '24/7 طوارئ'}</span></div>${item.emergencyphone ? '<div class="detail-row"><i class="fas fa-ambulance" style="color: var(--danger)"></i><span style="color: var(--danger); font-weight: 700">طوارئ: ' + item.emergencyphone + '</span></div>' : ''}`;
    else if (item.type === 'doctor') detailsHTML = `<div class="detail-row"><i class="fas fa-graduation-cap"></i><span>${item.specialty || ''}</span></div><div class="detail-row"><i class="fas fa-map-marker-alt"></i><span>${item.clinic || ''}</span></div><div class="detail-row"><i class="fas fa-clock"></i><span>${item.consulthours || item.hours || ''}</span></div>`;
    else if (item.type === 'clinic') detailsHTML = `<div class="detail-row"><i class="fas fa-stethoscope"></i><span>${item.specialty || ''}</span></div><div class="detail-row"><i class="fas fa-map-marker-alt"></i><span>${item.address || ''}</span></div><div class="detail-row"><i class="fas fa-clock"></i><span>${item.hours || ''}</span></div>`;
    else if (item.type === 'center') detailsHTML = `<div class="detail-row"><i class="fas fa-star-of-life"></i><span>${item.services || item.specialty || ''}</span></div><div class="detail-row"><i class="fas fa-map-marker-alt"></i><span>${item.address || ''}</span></div><div class="detail-row"><i class="fas fa-clock"></i><span>${item.hours || ''}</span></div>`;
    else if (item.type === 'lab') detailsHTML = `<div class="detail-row"><i class="fas fa-vials"></i><span>${item.tests || item.specialty || ''}</span></div><div class="detail-row"><i class="fas fa-map-marker-alt"></i><span>${item.address || ''}</span></div>${item.homesample && item.homesample !== 'لا' ? '<div class="detail-row"><i class="fas fa-house-user" style="color: var(--accent)"></i><span style="color: var(--accent); font-weight: 600">يتوفر سحب منزلي</span></div>' : ''}`;
    else detailsHTML = `<div class="detail-row"><i class="fas fa-map-marker-alt"></i><span>${item.address || ''}</span></div><div class="detail-row"><i class="fas fa-clock"></i><span>${item.hours || ''}</span></div>${item.night ? '<div class="detail-row"><i class="fas fa-moon" style="color: var(--gold)"></i><span style="color: var(--gold); font-weight: 600">صيدلية مناوبة</span></div>' : ''}`;
    const canBook = item.type === 'doctor' || item.type === 'clinic';
    const bookingBtn = canBook ? `<button onclick="event.stopPropagation(); openBookingModal('${item.id}')" class="w-10 h-10 rounded-xl border flex items-center justify-center transition-all hover:bg-gray-50" style="border-color: var(--border); color: var(--accent);" aria-label="حجز"><i class="fas fa-calendar-plus"></i></button>` : '';
    return `<div class="card ${t.cardClass} cursor-pointer" onclick="openModal('${item.id}')" data-type="${item.type}"><div class="relative h-40 overflow-hidden rounded-t-2xl"><img src="${item.image || 'https://picsum.photos/seed/default/400/250'}" alt="${item.name}" class="w-full h-full object-cover transition-transform duration-500 hover:scale-110 cursor-zoom-in" loading="lazy" onclick="event.stopPropagation(); openLightbox(this.src)"><div class="absolute top-3 right-3"><span class="badge ${t.badgeClass}">${t.label}</span></div><div class="absolute top-3 left-3 flex flex-col gap-1 items-start">
    ${['doctor', 'clinic', 'pharmacy'].includes(item.type) && item.isopen === true ? '<span class="badge" style="background:#10B981;color:white"><i class="fas fa-door-open ml-1"></i>مفتوح</span>' : ''}
    ${['doctor', 'clinic', 'pharmacy'].includes(item.type) && item.isopen === false ? '<span class="badge" style="background:#EF4444;color:white"><i class="fas fa-door-closed ml-1"></i>مغلق</span>' : ''}
    ${item.night ? '<span class="badge" style="background:rgba(196,150,44,0.9);color:white"><i class="fas fa-moon ml-1"></i>ليلي</span>' : ''}
</div></div><div class="p-5"><div class="flex items-start gap-3 mb-3"><div class="cat-icon ${t.iconClass}"><i class="fas ${t.icon}"></i></div><div class="flex-1 min-w-0"><h3 class="font-bold text-sm mb-1 leading-tight" style="font-family: 'Noto Kufi Arabic'; color: var(--fg);">${item.name}</h3><div class="flex items-center gap-1 text-[11px]" style="color: ${t.color};">${starsHTML}<span class="mr-1 font-semibold">${item.rating || 0}</span></div></div></div><div class="flex flex-col gap-1.5 mb-4">${detailsHTML}</div><div class="flex items-center gap-2"> ${item.phone ? `<a href="tel:${item.phone}" onclick="event.stopPropagation()" class="call-btn flex-1 py-2.5 rounded-xl text-white text-xs font-semibold text-center flex items-center justify-center gap-2" style="background: ${t.color}"><i class="fas fa-phone-alt"></i><span dir="ltr">${item.phone}</span></a>` : `<div class="flex-1 py-2.5 rounded-xl text-gray-400 text-xs font-semibold text-center flex items-center justify-center gap-2 bg-gray-100 cursor-not-allowed"><i class="fas fa-phone-slash"></i><span>لا يوجد رقم</span></div>`}${bookingBtn}<button onclick="event.stopPropagation(); openModal('${item.id}')" class="w-10 h-10 rounded-xl border flex items-center justify-center transition-all hover:bg-gray-50" style="border-color: var(--border); color: var(--muted);" aria-label="تفاصيل"><i class="fas fa-info-circle"></i></button></div></div></div>`;
}

function renderData() {
    const grids = { 
        hospital: { el: document.getElementById('hospitalsGrid'), section: document.getElementById('hospitals'), data: allData.filter(d => d.type === 'hospital') }, 
        clinic: { el: document.getElementById('clinicsGrid'), section: document.getElementById('clinics'), data: allData.filter(d => d.type === 'clinic') }, 
        center: { el: document.getElementById('centersGrid'), section: document.getElementById('centers'), data: allData.filter(d => d.type === 'center') }, 
        lab: { el: document.getElementById('labsGrid'), section: document.getElementById('labs'), data: allData.filter(d => d.type === 'lab') }, 
        doctor: { el: document.getElementById('doctorsGrid'), section: document.getElementById('doctors'), data: allData.filter(d => d.type === 'doctor') }, 
        pharmacy: { el: document.getElementById('pharmaciesGrid'), section: document.getElementById('pharmacies'), data: allData.filter(d => d.type === 'pharmacy').sort((a,b) => (b.night === true) - (a.night === true)) } 
    };
    let total = 0;
    for (const [type, g] of Object.entries(grids)) { const filtered = g.data.filter(matchItem); const show = filtered.length > 0 && (currentFilter === 'all' || currentFilter === type); g.el.innerHTML = filtered.map(createCard).join(''); g.section.style.display = show ? '' : 'none'; total += filtered.length; }
    document.getElementById('noResults').style.display = total === 0 ? '' : 'none';
}

function matchItem(item) { 
    if (currentFilter !== 'all' && item.type !== currentFilter) return false; 
    if (!searchQuery) return true; 
    const q = searchQuery.toLowerCase(); 
    return ['name', 'specialty', 'address', 'clinic', 'description', 'services', 'tests', 'departments', 'floors', 'homesample', 'nightdetails', 'consulthours', 'bookingnotes'].some(key => (item[key] || '').toLowerCase().includes(q)); 
}

window.setFilter = (filter, btn) => { 
    currentFilter = filter; 
    document.querySelectorAll('.filter-btn').forEach(b => { b.classList.remove('active'); b.style.background = ''; b.style.color = ''; b.style.borderColor = ''; }); 
    btn.classList.add('active'); 
    const colors = { all: 'var(--accent)', hospital: 'var(--hospital)', clinic: 'var(--clinic)', center: 'var(--center)', lab: 'var(--lab)', doctor: 'var(--doctor)', pharmacy: 'var(--pharmacy)' }; 
    btn.style.background = colors[filter]; btn.style.color = 'white'; btn.style.borderColor = colors[filter]; 
    renderData(); 
}
window.handleSearch = (value) => { searchQuery = value.trim(); const heroSearch = document.getElementById('heroSearch'); if(heroSearch) heroSearch.value = value; renderData(); }
window.resetSearch = () => { searchQuery = ''; currentFilter = 'all'; const heroSearch = document.getElementById('heroSearch'); if(heroSearch) heroSearch.value = ''; document.querySelectorAll('.filter-btn').forEach(b => { b.classList.remove('active'); b.style.background = ''; b.style.color = ''; b.style.borderColor = ''; }); const allBtn = document.querySelector('[data-filter="all"]'); allBtn.classList.add('active'); allBtn.style.background = 'var(--accent)'; allBtn.style.color = 'white'; allBtn.style.borderColor = 'var(--accent)'; renderData(); }

window.openModal = (id) => { 
    const item = allData.find(d => d.id === id); 
    if (!item) return; 
    const typeMap = { 
        hospital: { label: 'مشفى', badgeClass: 'badge-hospital', color: 'var(--hospital)', icon: 'fa-hospital-symbol' }, 
        clinic: { label: 'عيادة', badgeClass: 'badge-clinic', color: 'var(--clinic)', icon: 'fa-hospital' }, 
        center: { label: 'مركز طبي', badgeClass: 'badge-center', color: 'var(--center)', icon: 'fa-clinic-medical' }, 
        lab: { label: 'مخبر', badgeClass: 'badge-lab', color: 'var(--lab)', icon: 'fa-flask' }, 
        doctor: { label: 'طبيب', badgeClass: 'badge-doctor', color: 'var(--doctor)', icon: 'fa-user-md' }, 
        pharmacy: { label: 'صيدلية', badgeClass: 'badge-pharmacy', color: 'var(--pharmacy)', icon: 'fa-pills' } 
    }; 
    const t = typeMap[item.type] || typeMap.clinic; 
    const fullStars = Math.floor(item.rating || 0); 
    const halfStar = (item.rating || 0) % 1 >= 0.5; 
    let starsHTML = ''; 
    for (let i = 0; i < fullStars; i++) starsHTML += '<i class="fas fa-star"></i>'; 
    if (halfStar) starsHTML += '<i class="fas fa-star-half-alt"></i>'; 
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0); 
    for (let i = 0; i < emptyStars; i++) starsHTML += '<i class="far fa-star"></i>'; 
    let extraHTML = ''; 
    
    if (item.type === 'hospital') {
        extraHTML = `
            ${item.departments ? `<div class="flex items-center gap-3 p-3 rounded-xl" style="background: #CCFBF1"><i class="fas fa-list-check" style="color: var(--hospital)"></i><div><div class="text-xs" style="color: var(--muted)">الأقسام والعيادات</div><div class="text-sm font-bold" style="color: var(--hospital)">${item.departments}</div></div></div>` : ''}
            ${item.floors ? `<div class="flex items-center gap-3 p-3 rounded-xl" style="background: var(--bg)"><i class="fas fa-building" style="color: var(--hospital)"></i><div><div class="text-xs" style="color: var(--muted)">الطوابق</div><div class="text-sm font-bold">${item.floors}</div></div></div>` : ''}
            ${item.emergencyphone ? `<div class="flex items-center gap-3 p-3 rounded-xl" style="background: #FEE2E2"><i class="fas fa-ambulance" style="color: var(--danger)"></i><div><div class="text-xs" style="color: var(--muted)">رقم الطوارئ (مهم جداً)</div><div class="text-lg font-bold" style="color: var(--danger)" dir="ltr">${item.emergencyphone}</div></div></div>` : ''}
        `;
    } else if (item.type === 'doctor') { 
        extraHTML = `
            ${item.bookingnotes ? `<div class="flex items-center gap-3 p-3 rounded-xl" style="background: var(--bg)"><i class="fas fa-info-circle" style="color: var(--doctor)"></i><div><div class="text-xs" style="color: var(--muted)">تفاصيل إضافية</div><div class="text-sm font-bold">${item.bookingnotes}</div></div></div>` : ''}
        `;
    } else if (item.type === 'center') {
        extraHTML = `
            ${item.services ? `<div class="flex items-center gap-3 p-3 rounded-xl" style="background: #F3E8FF"><i class="fas fa-list-check" style="color: var(--center)"></i><div><div class="text-xs" style="color: var(--muted)">التخصصات والخدمات</div><div class="text-sm font-bold" style="color: var(--center)">${item.services}</div></div></div>` : ''}
            ${item.floors ? `<div class="flex items-center gap-3 p-3 rounded-xl" style="background: var(--bg)"><i class="fas fa-building" style="color: var(--center)"></i><div><div class="text-xs" style="color: var(--muted)">الطوابق</div><div class="text-sm font-bold">${item.floors}</div></div></div>` : ''}
        `;
    } else if (item.type === 'lab') {
        extraHTML = `
            ${item.tests ? `<div class="flex items-center gap-3 p-3 rounded-xl" style="background: #FEE2E2"><i class="fas fa-vials" style="color: var(--lab)"></i><div><div class="text-xs" style="color: var(--muted)">نوع التحاليل والخدمات</div><div class="text-sm font-bold" style="color: var(--lab)">${item.tests}</div></div></div>` : ''}
            ${item.homesample && item.homesample !== 'لا' ? `<div class="flex items-center gap-3 p-3 rounded-xl" style="background: #D1FAE5"><i class="fas fa-house-user" style="color: #059669"></i><div><div class="text-xs" style="color: var(--muted)">خدمة سحب العينات من المنزل</div><div class="text-sm font-bold" style="color: #059669">متوفرة</div></div></div>` : ''}
        `;
    } else if (item.type === 'pharmacy') {
        extraHTML = `
            ${item.night ? `<div class="flex items-center gap-3 p-3 rounded-xl" style="background: var(--gold-light)"><i class="fas fa-moon" style="color: var(--gold)"></i><div><div class="text-xs" style="color: var(--muted)">المناوبة</div><div class="text-sm font-bold" style="color: var(--gold)">${item.nightdetails || 'صيدلية مناوبة ليلية'}</div></div></div>` : ''}
        `;
    }

    const canBook = item.type === 'doctor' || item.type === 'clinic'; 
    const bookingBtnModal = canBook ? `<button onclick="openBookingModal('${item.id}')" class="flex-1 py-3.5 rounded-xl text-white text-sm font-bold text-center flex items-center justify-center gap-2" style="background: var(--accent)"><i class="fas fa-calendar-check"></i> طلب موعد</button>` : ''; 
    const mapQuery = item.latlng || ((item.address || item.clinic) + ' الرحيبة سوريا');
    const mapEmbed = (mapQuery) ? `
    <div class="mt-5 rounded-2xl overflow-hidden border-2" style="border-color: var(--border)">
        <div class="bg-gray-50 px-4 py-3 flex items-center justify-between border-b" style="border-color: var(--border)">
            <div class="flex items-center gap-2 text-sm font-bold text-gray-700">
                <i class="fas fa-map-marked-alt" style="color: ${t.color}"></i>
                الموقع على الخريطة
            </div>
            <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}" target="_blank" class="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg font-semibold hover:bg-blue-100 transition-colors flex items-center gap-1">
                <i class="fas fa-directions"></i> الاتجاهات
            </a>
        </div>
        <iframe width="100%" height="220" frameborder="0" style="border:0; display: block;" src="https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=16&output=embed" allowfullscreen loading="lazy"></iframe>
    </div>` : '';
    document.getElementById('modalContent').innerHTML = `<div class="relative h-48 overflow-hidden rounded-t-2xl"><img src="${item.image}" alt="${item.name}" class="w-full h-full object-cover cursor-zoom-in" onclick="openLightbox(this.src)"><div class="absolute inset-0" style="background: linear-gradient(to top, rgba(0,0,0,0.6), transparent)"></div><button onclick="closeModal()" class="absolute top-4 left-4 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/50 transition-all"><i class="fas fa-times text-sm"></i></button><div class="absolute bottom-4 right-5 left-5"><span class="badge ${t.badgeClass} mb-2 inline-block">${t.label}</span><h3 class="text-white font-bold text-lg" style="font-family: 'Noto Kufi Arabic'">${item.name}</h3></div></div><div class="p-6"><div class="flex items-center gap-2 mb-4"><div class="flex items-center gap-0.5 text-sm" style="color: ${t.color}">${starsHTML}</div><span class="text-sm font-bold">${item.rating || 0}</span><span class="text-xs" style="color: var(--muted)">/ 5</span></div><p class="text-sm leading-relaxed mb-5" style="color: var(--fg-light)">${item.description || ''}</p><div class="flex flex-col gap-2 mb-5"><div class="flex items-center gap-3 p-3 rounded-xl" style="background: var(--bg)"><i class="fas ${t.icon}" style="color: ${t.color}"></i><div><div class="text-xs" style="color: var(--muted)">${item.type === 'doctor' ? 'التخصص' : (item.type === 'clinic' || item.type === 'center' ? 'التخصص الأساسي' : 'النوع')}</div><div class="text-sm font-bold">${item.specialty || 'غير محدد'}</div></div></div> ${(item.address || item.clinic) ? `<div class="flex items-center gap-3 p-3 rounded-xl" style="background: var(--bg)"><i class="fas fa-map-marker-alt" style="color: ${t.color}"></i><div><div class="text-xs" style="color: var(--muted)">العنوان / الموقع</div><div class="text-sm font-bold">${item.address || item.clinic}</div></div></div>` : ''}<div class="flex items-center gap-3 p-3 rounded-xl" style="background: var(--bg)"><i class="fas fa-clock" style="color: ${t.color}"></i><div class="flex-1"><div class="text-xs" style="color: var(--muted)">${item.type === 'doctor' ? 'أوقات المعاينة' : 'أوقات العمل'}</div><div class="text-sm font-bold">${item.consulthours || item.hours || ''}</div></div>${['doctor', 'clinic', 'pharmacy'].includes(item.type) && item.isopen === true ? '<span class="text-xs px-2 py-1 rounded bg-green-100 text-green-700 font-bold">مفتوح الآن</span>' : ''}${['doctor', 'clinic', 'pharmacy'].includes(item.type) && item.isopen === false ? '<span class="text-xs px-2 py-1 rounded bg-red-100 text-red-700 font-bold">مغلق حالياً</span>' : ''}</div>${extraHTML}</div>${mapEmbed}<div class="flex items-center gap-3 mt-4"> ${item.phone ? `<a href="tel:${item.phone}" class="call-btn flex-1 py-3.5 rounded-xl text-white text-sm font-bold text-center flex items-center justify-center gap-2" style="background: ${t.color}"><i class="fas fa-phone-alt"></i> اتصال ${item.phone}</a>` : `<div class="flex-1 py-3.5 rounded-xl text-gray-400 text-sm font-bold text-center flex items-center justify-center gap-2 bg-gray-100 cursor-not-allowed"><i class="fas fa-phone-slash"></i> لا يوجد رقم هاتف</div>`}<button onclick="copyNumber('${item.phone}')" class="w-12 h-12 rounded-xl border flex items-center justify-center transition-all hover:bg-gray-50 flex-shrink-0" style="border-color: var(--border)"><i class="fas fa-copy" style="color: var(--muted)"></i></button></div>${canBook ? `<div class="mt-3">${bookingBtnModal}</div>` : ''}</div>`;  
    document.getElementById('modalOverlay').classList.add('active'); 
    lockScroll(); 
}

window.openLightbox = (src) => { const lightbox = document.getElementById('lightbox'); lightbox.querySelector('img').src = src.includes('picsum.photos') ? src.replace('/400/250', '/1200/800') : src; lightbox.classList.add('active'); lockScroll(); }
window.closeModal = (event) => { if (event && event.target !== document.getElementById('modalOverlay')) return; document.getElementById('modalOverlay').classList.remove('active'); unlockScroll(); }
window.copyNumber = (phone) => { navigator.clipboard.writeText(phone).then(() => showToast('تم نسخ رقم الهاتف بنجاح')).catch(() => showToast('تعذر النسخ')); }
window.copyText = (text) => { navigator.clipboard.writeText(text).then(() => showToast('تم نسخ الكود بنجاح')).catch(() => showToast('تعذر النسخ')); }

function showToast(message) { const toast = document.getElementById('toast'); toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 4000); }
window.showToast = showToast;

window.toggleMobileMenu = () => { const menu = document.getElementById('mobileMenu'); const overlay = document.getElementById('menuOverlay'); const icon = document.getElementById('menuIcon'); const isOpen = menu.classList.contains('open'); if (isOpen) { menu.classList.remove('open'); overlay.classList.add('hidden'); icon.className = 'fas fa-bars'; unlockScroll(); } else { menu.classList.add('open'); overlay.classList.remove('hidden'); icon.className = 'fas fa-times'; lockScroll(); } }
window.togglePlatformInfo = () => {
    const infoDiv = document.getElementById('platformInfo');
    const icon = document.getElementById('platformInfoIcon');
    if (infoDiv.classList.contains('hidden')) { infoDiv.classList.remove('hidden'); icon.style.transform = 'rotate(180deg)'; } 
    else { infoDiv.classList.add('hidden'); icon.style.transform = 'rotate(0deg)'; }
}
window.toggleFooterBox = (contentId, iconId) => {
    const content = document.getElementById(contentId);
    const icon = document.getElementById(iconId);
    if (content.classList.contains('hidden')) { content.classList.remove('hidden'); icon.style.transform = 'rotate(180deg)'; } 
    else { content.classList.add('hidden'); icon.style.transform = 'rotate(0deg)'; }
}

window.handleContactSubmit = (e) => { 
    e.preventDefault(); const phoneInput = document.getElementById('contactPhone'); const phone = phoneInput.value.trim(); 
    if (!/^09\d{8}$/.test(phone)) { phoneInput.classList.add('input-invalid'); showToast('رقم هاتف غير صحيح'); return; } phoneInput.classList.remove('input-invalid'); 
    const name = document.getElementById('contactName').value; const type = document.getElementById('contactType').value; const message = document.getElementById('contactMessage').value; 
    const text = `*رسالة جديدة من منصة دليل الطبي*%0A*الاسم:* ${name}%0A*الهاتف:* ${phone}%0A*النوع:* ${type}%0A*الرسالة:* ${message}`; 
    const adminWhatsAppNumber = "963980390813"; window.open(`https://wa.me/${adminWhatsAppNumber}?text=${text}`, '_blank'); showToast('جاري تحويلك إلى واتساب لإرسال الرسالة...'); e.target.reset(); 
}

window.addEventListener('scroll', () => { document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 80); document.getElementById('backToTop').classList.toggle('visible', window.scrollY > 500); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (document.getElementById('lightbox').classList.contains('active')) { document.getElementById('lightbox').classList.remove('active'); unlockScroll(); } if (document.getElementById('modalOverlay').classList.contains('active')) closeModal(); if (document.getElementById('ctrlOverlay').classList.contains('active')) closeCtrlPanel(); if (document.getElementById('mobileMenu').classList.contains('open')) toggleMobileMenu(); } });

const allBtn = document.querySelector('[data-filter="all"]'); 
if(allBtn) { allBtn.style.background = 'var(--accent)'; allBtn.style.color = 'white'; allBtn.style.borderColor = 'var(--accent)'; }

window.openCtrlPanel = (title, contentHtml, headerColor = '#073D2E') => { 
    document.getElementById('ctrlTitle').textContent = title; 
    document.getElementById('ctrlContent').innerHTML = contentHtml; 
    const overlay = document.getElementById('ctrlOverlay');
    if (!overlay.classList.contains('active')) {
        overlay.classList.add('active'); 
        document.querySelector('#ctrlOverlay .p-5').style.background = headerColor; 
        lockScroll(); 
    }
}
window.closeCtrlPanel = (event) => { 
    if (event && event.target.id !== 'ctrlOverlay') return; 
    document.getElementById('ctrlOverlay').classList.remove('active'); 
    unlockScroll(); 
    if (unsubscribeMedRequests) { 
        clearInterval(unsubscribeMedRequests); 
        unsubscribeMedRequests = null; 
    } 
    if (activeFollowupUnsub) { 
        clearInterval(activeFollowupUnsub); 
        activeFollowupUnsub = null; 
    } 
    currentFollowupBookingId = null;
}

// تنتهي هنا الجزء الثاني...
// === الجزء الثالث: الحجوزات، الصيدلية، الطبيب، الدم، الأدوية ===

window.openBookingModal = (id) => { 
    closeModal(); 
    const item = allData.find(d => d.id === id); 
    if (!item) return; 
    tempBooking = { itemid: id, itemname: item.name, itemphone: (item.phone || '').replace(/[^0-9]/g, '') }; 
    let daysHTML = ''; let validDaysCount = 0; 
    for (let i = 1; i <= 14; i++) { 
        const date = new Date(); date.setDate(date.getDate() + i); 
        const dayName = date.toLocaleDateString('ar-EG', { weekday: 'long' }); 
        if (item.workingdays && item.workingdays.includes(dayName) && validDaysCount < 5) { 
            validDaysCount++; 
            const dayShort = date.toLocaleDateString('ar-EG', { weekday: 'short' }); 
            const dayNum = date.toLocaleDateString('ar-EG', { day: 'numeric' }); 
            const iso = date.toISOString(); 
            daysHTML += `<button onclick="selectDay('${iso}', this)" class="day-btn flex-shrink-0 w-16 h-20 rounded-xl flex flex-col items-center justify-center gap-1 bg-white"><span class="text-xs font-bold">${dayShort}</span><span class="text-2xl font-black">${dayNum}</span></button>`; 
        } 
    } 
    if (validDaysCount === 0) { daysHTML = '<p class="text-sm text-center w-full" style="color: var(--muted)">لا توجد أيام متاحة للحجز.</p>'; } 
    document.getElementById('modalContent').innerHTML = `<div class="p-6"><div class="flex justify-between items-center mb-6"><h3 class="font-bold text-lg"><i class="fas fa-calendar-plus ml-2" style="color: var(--accent)"></i> طلب موعد</h3><button onclick="closeModal()" class="text-2xl hover:text-gray-400 leading-none">&times;</button></div><div class="mb-4 p-3 rounded-xl flex items-center gap-3" style="background: var(--accent-light)"><i class="fas fa-hospital text-xl" style="color: var(--accent)"></i><div><div class="text-xs" style="color: var(--accent-dark)">سيتم طلب الموعد في:</div><div class="font-bold text-sm" style="color: var(--accent-dark)">${item.name}</div></div></div><div id="step1" class="booking-step active"><h4 class="text-sm font-bold mb-3">1. اختر اليوم المناسب:</h4><div class="flex gap-2 overflow-x-auto pb-2 mb-6">${daysHTML}</div><button onclick="goToStep(2)" id="step1Next" disabled class="w-full py-3 rounded-xl text-white font-bold text-sm transition-all opacity-50 cursor-not-allowed" style="background: var(--accent)">التالي</button></div><div id="step2" class="booking-step"><h4 class="text-sm font-bold mb-3">2. أدخل بياناتك:</h4><div class="flex flex-col gap-3 mb-6"><input type="text" id="patientName" class="ctrl-input" placeholder="الاسم الكامل" required><input type="tel" id="patientPhone" class="ctrl-input" placeholder="09XXXXXXXX" required><textarea id="patientNotes" class="ctrl-input" rows="2" placeholder="ملاحظات (اختياري)"></textarea></div><div class="flex gap-2"><button onclick="goToStep(1)" class="w-1/3 py-3 rounded-xl border font-bold text-sm" style="border-color: var(--border)"><i class="fas fa-arrow-right ml-2"></i> رجوع</button><button onclick="confirmBooking()" class="w-2/3 py-3 rounded-xl text-white font-bold text-sm" style="background: var(--accent)">تأكيد</button></div></div></div>`; 
    document.getElementById('modalOverlay').classList.add('active'); lockScroll(); 
}

window.selectDay = (iso, btn) => { 
    tempBooking.day = new Date(iso); 
    tempBooking.daystr = tempBooking.day.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }); 
    document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active')); 
    btn.classList.add('active'); 
    document.getElementById('step1Next').disabled = false; 
    document.getElementById('step1Next').classList.remove('opacity-50', 'cursor-not-allowed'); 
}
window.goToStep = (step) => { document.querySelectorAll('.booking-step').forEach(s => s.classList.remove('active')); document.getElementById(`step${step}`).classList.add('active'); }

window.confirmBooking = async () => { 
    const name = document.getElementById('patientName').value.trim(); 
    const phoneInput = document.getElementById('patientPhone'); 
    const phone = phoneInput.value.trim(); 
    const notes = document.getElementById('patientNotes').value.trim(); 
    if (!name || !phone) { showToast('الرجاء إدخال الاسم والهاتف'); return; } 
    if (!/^09\d{8}$/.test(phone)) { phoneInput.classList.add('input-invalid'); showToast('رقم هاتف غير صحيح'); return; } 
    phoneInput.classList.remove('input-invalid'); 
    const ref = `R-${Math.floor(Math.random() * 900) + 100}`; 
    tempBooking.ref = ref; 
    tempBooking.player_id = localStorage.getItem('onesignal_player_id') || null;
    tempBooking.name = name; 
    tempBooking.phone = phone; 
    tempBooking.notes = notes; 
    tempBooking.status = 'pending'; 
    tempBooking.time = "بانتظار التحديد"; 
    tempBooking.chat = []; 
    
    try { 
        const { data, error } = await supabase.from('bookings').insert([tempBooking]).select(); 
        if (error) throw error;
        const newId = data[0].id;
        document.getElementById('step2').innerHTML = `
        <div class="text-center py-6 flex flex-col items-center">
            <div class="w-16 h-16 rounded-full flex items-center justify-center mb-4" style="background: var(--accent-light)"><i class="fas fa-check text-3xl" style="color: var(--accent)"></i></div>
            <h4 class="text-lg font-bold mb-2">تم إرسال طلبك!</h4>
            <p class="text-sm mb-2" style="color: var(--muted)">رقم المرجع: <span class="font-bold text-yellow-600">#${ref}</span></p>
            <button onclick="copyText('${ref}')" class="w-full py-3 rounded-xl text-white font-bold text-sm mb-2" style="background: var(--accent)"><i class="fas fa-copy ml-2"></i> نسخ الكود</button>
            <button onclick="closeModal(); openBookingFollowup('${newId}')" class="w-full py-3 rounded-xl text-white font-bold text-sm mb-2" style="background: var(--doctor)">متابعة الحجز والدردشة</button>
            <button onclick="closeModal()" class="w-full py-2 rounded-xl border font-bold text-sm" style="border-color: var(--border)">إغلاق</button>
        </div>`; 
    } catch (e) { showToast('خطأ في الحفظ'); } 
}

window.openBookingFollowup = (bookingId) => {
    currentFollowupBookingId = bookingId;
    openCtrlPanel('متابعة الحجز والدردشة', `<div id="followupContent" class="flex flex-col gap-4"><p class="text-center py-8 text-gray-400">جاري تحميل بيانات الحجز...</p></div>`, '#0E7C5F');
    
    // محاكاة الاستماع الحي (تحديث كل 5 ثوانٍ)
    if (activeFollowupUnsub) clearInterval(activeFollowupUnsub);
    fetchFollowupChat(bookingId);
    activeFollowupUnsub = setInterval(() => fetchFollowupChat(bookingId), 5000);
}

async function fetchFollowupChat(bookingId) {
    const { data: docSnap, error } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
    if (error) { showToast("لم يتم العثور على الحجز."); closeCtrlPanel(); return; }
    
    const index = bookings.findIndex(b => b.id === bookingId);
    if (index !== -1) bookings[index] = docSnap;
    else bookings.push(docSnap);
    
    renderFollowupChat(bookingId);
}

window.renderFollowupChat = (bookingId) => {
    const booking = bookings.find(b => b.id === bookingId); 
    const contentEl = document.getElementById('followupContent'); if (!contentEl) return;
    if (!booking) { contentEl.innerHTML = '<p class="text-center py-8 text-red-500">لم يتم العثور على الحجز.</p>'; return; }
    const b = booking;
    let statusBadge = '';
    if (b.status === 'accepted') statusBadge = `<span class="px-3 py-1 rounded text-sm" style="background: #D1FAE5; color: #065F46">🟢 تم التأكيد - ${b.time}</span>`;
    else if (b.status === 'canceled') statusBadge = `<span class="px-3 py-1 rounded text-sm" style="background: #FEE2E2; color: #991B1B">تم الإلغاء</span>`;
    else statusBadge = `<span class="px-3 py-1 rounded text-sm" style="background: #FEF3C7; color: #92400E">🟡 الحجز قيد المراجعة من العيادة</span>`;
    let chatHtml = '';
    if (b.chat && b.chat.length > 0) { chatHtml = b.chat.map(msg => `<div class="flex ${msg.sender === 'patient' ? 'justify-start' : 'justify-end'}"><div class="max-w-[75%] p-3 rounded-xl text-sm ${msg.sender === 'patient' ? 'bg-gray-100 text-gray-800' : 'bg-blue-500 text-white'}">${msg.text}</div></div>`).join(''); } 
    else { chatHtml = '<p class="text-center text-xs text-gray-400 my-4">لا توجد رسائل بعد. انتظر رد العيادة.</p>'; }
    
    contentEl.innerHTML = `<div class="bg-white p-4 rounded-xl border" style="border-color: var(--border)"><div class="flex justify-between items-center mb-2"><div><div class="font-bold text-sm">${b.itemname}</div><div class="text-xs text-gray-500">${b.daystr}</div></div><div>${statusBadge}</div></div><div class="text-xs text-yellow-600 font-bold mt-2">رقم المرجع: #${b.ref}</div></div><div class="bg-white p-4 rounded-xl border flex flex-col h-96" style="border-color: var(--border)"><div class="flex-1 overflow-y-auto flex flex-col gap-2 mb-3 pr-1" id="chatBox">${chatHtml}</div><div class="flex gap-2 border-t pt-3" style="border-color: var(--border)"><input type="text" id="chatInput" class="ctrl-input text-sm" placeholder="اكتب رسالتك للطبيب..." onkeydown="if(event.key==='Enter') sendChatMessage('${bookingId}')"><button onclick="sendChatMessage('${bookingId}')" class="px-4 rounded-xl text-white" style="background: var(--accent)"><i class="fas fa-paper-plane"></i></button></div></div>`;
    const chatBox = document.getElementById('chatBox'); if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
}

window.sendChatMessage = async (bookingId) => {
    const input = document.getElementById('chatInput'); const text = input.value.trim(); if (!text) return; input.value = '';
    const { data: docSnap, error } = await supabase.from('bookings').select('chat').eq('id', bookingId).single();
    if (error) return;
    const currentChat = docSnap.chat || []; currentChat.push({ sender: 'patient', text: text, timestamp: new Date().toISOString() });
    await supabase.from('bookings').update({ chat: currentChat }).eq('id', bookingId);
}

window.openPharmacyLogin = () => { openCtrlPanel('لوحة الصيدليات', `<div class="max-w-sm mx-auto py-8"><div class="text-center mb-6"><div class="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-3" style="background: var(--accent-light)"><i class="fas fa-prescription-bottle-medical text-2xl" style="color: var(--accent)"></i></div><h3 class="font-bold text-lg">دخول الصيدليات</h3></div><form onsubmit="handlePharmacyLogin(event)" class="flex flex-col gap-4"><input type="text" id="pharmName" class="ctrl-input text-center" placeholder="اسم الصيدلية" required><input type="text" id="pharmPass" class="ctrl-input text-center font-mono" placeholder="كلمة المرور" required><button type="submit" class="w-full py-3 rounded-xl text-white font-bold text-sm" style="background: var(--accent)">دخول</button></form></div>`, '#0E7C5F'); }
window.handlePharmacyLogin = (e) => { e.preventDefault(); const name = document.getElementById('pharmName').value.trim(); const pass = document.getElementById('pharmPass').value.trim().toUpperCase(); const pharmData = allData.find(d => d.name === name && d.type === 'pharmacy' && d.pharmacypass === pass); if (pharmData) { renderPharmacyDashboard(pharmData); } else { showToast('بيانات الدخول غير صحيحة!'); } }

window.renderPharmacyDashboard = (pharm) => { 
    openCtrlPanel(`لوحة تحكم: ${pharm.name}`, `<div class="flex flex-col gap-5"><div class="bg-white p-5 rounded-xl border flex items-center justify-between flex-col sm:flex-row gap-4" style="border-color: var(--border)"><div class="flex items-center gap-4"><img src="${pharm.image}" class="w-20 h-20 rounded-2xl object-cover"><div><h3 class="font-bold text-lg">${pharm.name}</h3><p class="text-sm" style="color: var(--pharmacy)">صيدلية</p></div></div><div class="bg-white p-3 rounded-xl border flex items-center justify-between gap-2 mb-3" style="border-color: var(--border);"><span class="text-sm font-bold text-gray-700">حالة العمل:</span><div class="flex gap-1 bg-gray-50 p-1 rounded-lg"><button onclick="setStatus('${pharm.id}', true)" class="px-4 py-1.5 rounded-md text-xs font-bold transition-all ${pharm.isopen === true ? 'bg-green-500 text-white shadow' : 'text-gray-500 hover:bg-gray-100'}">مفتوح</button><button onclick="setStatus('${pharm.id}', false)" class="px-4 py-1.5 rounded-md text-xs font-bold transition-all ${pharm.isopen === false ? 'bg-red-500 text-white shadow' : 'text-gray-500 hover:bg-gray-100'}">مغلق</button><button onclick="setStatus('${pharm.id}', null)" class="px-4 py-1.5 rounded-md text-xs font-bold transition-all ${pharm.isopen == null ? 'bg-gray-700 text-white shadow' : 'text-gray-500 hover:bg-gray-100'}">لا شيء</button></div></div><button onclick="toggleNightShift('${pharm.id}', ${!pharm.night})" class="w-full px-4 py-2 rounded-xl font-bold text-sm ${pharm.night ? 'bg-yellow-500 text-white' : 'bg-gray-200'}">${pharm.night ? 'إيقاف المناوبة الليلية' : 'تفعيل المناوبة الليلية'}</button></div><div class="bg-white p-5 rounded-xl border" style="border-color: var(--border)"><h4 class="font-bold mb-4 text-sm">طلبات الأدوية الواردة</h4><div id="requestsContainer" class="flex flex-col gap-3"><p class="text-center py-10" style="color: var(--muted)">جاري تحميل الطلبات...</p></div></div></div>`, '#0E7C5F'); 
    
    if (unsubscribeMedRequests) clearInterval(unsubscribeMedRequests); 
    fetchMedRequests(pharm.name);
    unsubscribeMedRequests = setInterval(() => fetchMedRequests(pharm.name), 7000);
}

async function fetchMedRequests(pharmName) {
    const container = document.getElementById('requestsContainer'); 
    if (!container) return; 
    container.innerHTML = '<p class="text-center py-10" style="color: var(--muted)">جاري تحديث الطلبات...</p>';
    
    const { data: snapshot, error } = await supabase.from('medicine_requests').select('*').in('status', ['active', 'searching', 'available', 'unavailable']); 
    if (error) { container.innerHTML = '<p class="text-center py-10 text-red-500">حدث خطأ.</p>'; return; }
    if (snapshot.length === 0) { container.innerHTML = '<p class="text-center py-10" style="color: var(--muted)">لا توجد طلبات أدوية حالياً.</p>'; return; } 
    
    let html = ''; 
    snapshot.forEach(req => { 
        const date = new Date(req.created_at).toLocaleString('ar-EG', { date: 'short', time: 'short' }); 
        const phone = req.patient_phone; 
        
        let requestStatus = ''; 
        if (req.status === 'available') requestStatus = `<span class="text-xs px-2 py-1 rounded bg-green-100 text-green-700 inline-block mb-2">تم التوفير</span>`; 
        else if (req.status === 'unavailable') requestStatus = `<span class="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 inline-block mb-2">غير متوفر</span>`; 
        else requestStatus = `<span class="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-700 inline-block mb-2">قيد البحث</span>`;

        let interactionArea = '';
        if (req.status === 'available') {
            if (req.available_pharmacy === pharmName) {
                interactionArea = `<div class="bg-green-50 text-green-700 text-sm font-bold p-3 rounded-lg text-center mb-2">أنت من وفر هذا الدواء للمريض</div><a href="tel:${phone}" class="flex-1 bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"><i class="fas fa-phone"></i> اتصال للمريض</a><button onclick="updateMedStatus('${req.id}', 'searching')" class="w-full mt-2 bg-gray-200 text-gray-600 px-3 py-2 rounded-lg text-xs">تراجع عن التوفير</button>`;
            } else {
                interactionArea = `<div class="bg-gray-100 text-gray-500 text-sm font-bold p-3 rounded-lg text-center">تم إغلاق هذا الطلب (تم التوفير من صيدلية أخرى)</div>`;
            }
        } else if (req.status === 'unavailable') {
            interactionArea = `<div class="bg-gray-100 text-gray-400 text-sm font-bold p-3 rounded-lg text-center">قمت بإغلاق هذا الطلب</div><button onclick="updateMedStatus('${req.id}', 'searching')" class="w-full mt-2 bg-gray-200 text-gray-600 px-3 py-2 rounded-lg text-xs">إعادة فتح الطلب</button>`;
        } else {
            interactionArea = `<input type="text" id="medNotes_${req.id}" placeholder="ملاحظة للمواطن" value="${req.notes || ''}" onblur="updateMedNotes('${req.id}', this.value)" class="ctrl-input text-sm py-1"><div class="flex gap-2 mt-2"><button onclick="setMedAvailable('${req.id}', '${pharmName}')" class="flex-1 bg-green-500 text-white px-3 py-2 rounded-lg text-sm font-semibold">توفّر الدواء</button><button onclick="updateMedStatus('${req.id}', 'unavailable')" class="flex-1 bg-gray-500 text-white px-3 py-2 rounded-lg text-sm font-semibold">غير متوفر</button></div><div class="flex gap-2 mt-2"><a href="tel:${phone}" class="flex-1 bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"><i class="fas fa-phone"></i> اتصال</a></div>`;
        }

        html += `<div class="bg-white border rounded-xl p-4 flex flex-col gap-3" style="border-color: var(--border)"><div class="flex flex-col sm:flex-row gap-3 items-center">${req.image_url ? `<img src="${req.image_url}" class="w-full sm:w-24 h-24 object-cover rounded-lg cursor-zoom-in" onclick="openLightbox('${req.image_url}')">` : ''}<div class="flex-1 text-center sm:text-right"><h4 class="font-bold">${req.patient_name} <span class="text-xs text-yellow-600 font-mono">#${req.med_ref || ''}</span></h4><p class="text-sm text-gray-700 font-semibold">${req.med_list || ''}</p><p class="text-xs mt-1 text-red-500">الإلحاح: ${req.urgency || 'عادي'}</p><p class="text-xs" style="color: var(--muted)"><i class="fas fa-clock"></i> ${date}</p>${requestStatus}</div></div><div class="flex flex-col gap-2 mt-2 border-t pt-3" style="border-color: var(--border)">${interactionArea}</div></div>`; 
    }); 
    container.innerHTML = html; 
}

window.toggleNightShift = async (id, currentStatus) => { try { await supabase.from('listings').update({ night: currentStatus }).eq('id', id); showToast(currentStatus ? 'تم تفعيل المناوبة!' : 'تم إيقاف المناوبة.'); localStorage.setItem('force_listings_update', 'true'); } catch (e) { showToast('خطأ في التحديث'); } }
window.setMedAvailable = async (id, pharmName) => { try { await supabase.from('medicine_requests').update({ status: 'available', notes: `الدواء متوفر لدى ${pharmName}. يرجى الحضور لاستلامه.`, available_pharmacy: pharmName }).eq('id', id); showToast('تم إعلام المريض بتوفر الدواء'); } catch (e) { showToast('خطأ في التحديث'); } }
window.updateMedStatus = async (id, status) => { try { await supabase.from('medicine_requests').update({ status: status }).eq('id', id); showToast('تم تحديث حالة الدواء'); } catch (e) { showToast('خطأ في التحديث'); } }
window.updateMedNotes = async (id, notes) => { try { await supabase.from('medicine_requests').update({ notes: notes }).eq('id', id); showToast('تم حفظ الملاحظة'); } catch (e) { showToast('خطأ في الحفظ'); } }

window.openDoctorLogin = () => { openCtrlPanel('لوحة الطبيب', `<div class="max-w-sm mx-auto py-8"><div class="text-center mb-6"><div class="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-3" style="background: #DBEAFE"><i class="fas fa-user-md text-2xl" style="color: var(--doctor)"></i></div><h3 class="font-bold text-lg">دخول الطبيب</h3></div><form onsubmit="handleDoctorLogin(event)" class="flex flex-col gap-4"><input type="text" id="docName" class="ctrl-input text-center" placeholder="الاسم" required><input type="text" id="docPass" class="ctrl-input text-center font-mono" placeholder="كلمة المرور" required><button type="submit" class="w-full py-3 rounded-xl text-white font-bold text-sm" style="background: var(--doctor)">دخول</button></form></div>`, '#2563EB'); }
window.handleDoctorLogin = (e) => { e.preventDefault(); const name = document.getElementById('docName').value.trim(); const pass = document.getElementById('docPass').value.trim().toUpperCase(); const docData = allData.find(d => d.name === name && d.bookingpass === pass); if (docData) { renderDoctorDashboard(docData); } else { showToast('بيانات غير صحيحة!'); } }

window.renderDoctorDashboard = (doc) => { 
    fetchBookings().then(() => {
        const docBookings = bookings.filter(b => b.itemid === doc.id); 
        const daysCheckboxes = daysOfWeek.map(day => `<label class="flex items-center gap-2"><input type="checkbox" name="docWorkingDays" value="${day}" class="day-checkbox" ${doc.workingdays?.includes(day) ? 'checked' : ''}><span class="text-sm">${day}</span></label>`).join(''); 
        const bookingsListHtml = docBookings.length === 0 ? '<p class="text-sm text-center py-4" style="color: var(--muted)">لا توجد طلبات.</p>' : docBookings.map(b => { 
            let statusBadge = ''; let actionButtons = ''; 
            if (b.status === 'accepted') { statusBadge = `<span class="text-xs px-2 py-1 rounded block mb-1" style="background: #D1FAE5; color: #065F46">مقبول - ${b.time}</span>`; actionButtons = `<button onclick="updateBookingStatus('${b.id}', 'canceled')" class="text-xs text-white px-2 py-1 rounded bg-red-500">إلغاء</button><button onclick="updateBookingStatus('${b.id}', 'deleted')" class="text-xs text-white px-2 py-1 rounded bg-gray-800">حذف</button>`; } 
            else if (b.status === 'canceled') { statusBadge = '<span class="text-xs px-2 py-1 rounded block mb-1" style="background: #F3F4F6; color: #4B5563">ملغي</span>'; actionButtons = `<button onclick="updateBookingStatus('${b.id}', 'pending')" class="text-xs text-white px-2 py-1 rounded bg-gray-500">استعادة</button><button onclick="updateBookingStatus('${b.id}', 'deleted')" class="text-xs text-white px-2 py-1 rounded bg-gray-800">حذف</button>`; } 
            else { statusBadge = '<span class="text-xs px-2 py-1 rounded block mb-1" style="background: #FEF3C7; color: #92400E">طلب جديد</span>'; actionButtons = `<div class="flex flex-col gap-1 w-full"><input type="text" id="time_${b.id}" placeholder="حدد الموعد" class="ctrl-input text-sm py-1"><div class="flex gap-1"><button onclick="acceptBooking('${b.id}')" class="text-xs text-white px-2 py-1 rounded bg-green-600 flex-1">قبول</button><button onclick="updateBookingStatus('${b.id}', 'canceled')" class="text-xs text-white px-2 py-1 rounded bg-red-500">رفض</button></div></div>`; }
            let chatHtml = '';
            if (b.chat && b.chat.length > 0) { chatHtml = b.chat.map(msg => `<div class="text-xs p-2 rounded-lg mb-1 ${msg.sender === 'doctor' ? 'bg-blue-100 text-left' : 'bg-gray-100 text-right'}">${msg.text}</div>`).join(''); }
            return `<div class="flex flex-col p-3 rounded-lg border mb-3" style="border-color: var(--border)"><div class="flex items-center justify-between mb-2"><div><span class="text-sm font-bold">${b.name}</span><br><span class="text-xs" style="color: var(--muted)">${b.daystr}</span></div><div>${statusBadge}<span class="text-[10px] text-gray-400">مرجع: #${b.ref}</span></div></div><div class="flex items-center justify-between border-t pt-2 mb-2" style="border-color: var(--border)"><a href="tel:${b.phone}" class="text-xs text-blue-600">${b.phone}</a><div class="flex gap-1">${actionButtons}</div></div><div class="border-t pt-2" style="border-color: var(--border)"><div class="text-xs font-bold text-gray-600 mb-1">المحادثة:</div><div class="max-h-32 overflow-y-auto mb-2 bg-gray-50 p-2 rounded-lg">${chatHtml || '<span class="text-xs text-gray-400">لا توجد رسائل</span>'}</div><div class="flex gap-1"><input type="text" id="docChat_${b.id}" placeholder="اكتب ردك..." class="ctrl-input text-sm py-1 flex-1"><button onclick="sendDocMessage('${b.id}')" class="text-xs text-white px-3 py-1 rounded bg-blue-500"><i class="fas fa-paper-plane"></i></button></div></div></div>`; 
        }).join('');
        openCtrlPanel(`لوحة: ${doc.name}`, `<div class="flex flex-col gap-5"><div class="bg-white p-5 rounded-xl border flex items-center gap-4" style="border-color: var(--border)"><img src="${doc.image}" class="w-20 h-20 rounded-2xl object-cover"><div><h3 class="font-bold text-lg">${doc.name}</h3><p class="text-sm" style="color: var(--doctor)">${doc.specialty}</p></div></div><div class="bg-white p-3 rounded-xl border flex items-center justify-between gap-2 mb-3" style="border-color: var(--border);"><span class="text-sm font-bold text-gray-700">حالة العمل:</span><div class="flex gap-1 bg-gray-50 p-1 rounded-lg"><button onclick="setStatus('${doc.id}', true)" class="px-4 py-1.5 rounded-md text-xs font-bold ${doc.isopen === true ? 'bg-green-500 text-white shadow' : 'text-gray-500'}">مفتوح</button><button onclick="setStatus('${doc.id}', false)" class="px-4 py-1.5 rounded-md text-xs font-bold ${doc.isopen === false ? 'bg-red-500 text-white shadow' : 'text-gray-500'}">مغلق</button><button onclick="setStatus('${doc.id}', null)" class="px-4 py-1.5 rounded-md text-xs font-bold ${doc.isopen == null ? 'bg-gray-700 text-white shadow' : 'text-gray-500'}">لا شيء</button></div></div><button onclick="openDoctorScanner('${doc.id}')" class="w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 mt-2" style="background: #0D9488"><i class="fas fa-qrcode"></i> قراءة الملف الصحي للمريض</button><div class="bg-white p-5 rounded-xl border" style="border-color: var(--border)"><h4 class="font-bold mb-4 text-sm"><i class="fas fa-calendar-day ml-2" style="color: var(--doctor)"></i> طلبات المواعيد (${docBookings.length})</h4><div class="flex flex-col gap-2">${bookingsListHtml}</div></div><div class="bg-white p-5 rounded-xl border" style="border-color: var(--border)"><h4 class="font-bold mb-4 text-sm"><i class="fas fa-cog ml-2"></i> أيام العمل</h4><div class="mb-4 grid grid-cols-4 sm:grid-cols-7 gap-2">${daysCheckboxes}</div><button onclick="saveDoctorSettings('${doc.id}')" class="w-full py-2.5 rounded-xl text-white font-semibold text-sm" style="background: var(--doctor)">حفظ</button></div></div>`, '#2563EB'); 
    });
}

window.acceptBooking = async (bookingId) => { 
    const timeInput = document.getElementById(`time_${bookingId}`); const time = timeInput.value.trim(); 
    if (!time) { showToast('أدخل وقت الموعد'); return; } const booking = bookings.find(b => b.id === bookingId); if (!booking) return; 
    try { 
        const currentChat = booking.chat || []; 
        currentChat.push({ sender: 'doctor', text: `تم تثبيت موعدك اليوم الساعة ${time}. نرحب بك في العيادة.`, timestamp: new Date().toISOString() }); 
        await supabase.from('bookings').update({ status: 'accepted', time: time, chat: currentChat }).eq('id', bookingId); 
        if (booking.player_id) {
            fetch('https://script.google.com/macros/s/AKfycbwuYCdljTk-nX_bSXEBC5ku_nHKH_RUC3fETlIsunWjGmzVv98KRsbSiJyVyiLynhDhAQ/exec', { method: 'POST', body: JSON.stringify({ playerId: booking.player_id, title: "تم تأكيد موعدك! 🗓️", message: `تم قبول حجزك في ${booking.itemname}. الموعد: ${time}` }) }).catch(err => console.log(err));
        }
        showToast('تم قبول الموعد وإرسال إشعار للمريض'); 
    } catch (e) { showToast('خطأ'); } 
}
window.updateBookingStatus = async (bookingId, newStatus) => { 
    try { 
        if (newStatus === 'deleted') { await supabase.from('bookings').delete().eq('id', bookingId); showToast('تم الحذف'); return; } 
        await supabase.from('bookings').update({ status: newStatus }).eq('id', bookingId); showToast('تم التحديث'); 
    } catch (e) { showToast('خطأ'); } 
}
window.saveDoctorSettings = async (id) => { 
    const workingDays = Array.from(document.querySelectorAll('input[name="docWorkingDays"]:checked')).map(cb => cb.value); 
    try { await supabase.from('listings').update({ workingdays: workingDays }).eq('id', id); showToast('تم الحفظ!'); localStorage.setItem('force_listings_update', 'true'); } catch (e) { showToast('خطأ'); } 
}
window.sendDocMessage = async (bookingId) => {
    const input = document.getElementById(`docChat_${bookingId}`); const text = input.value.trim(); if (!text) return; input.value = '';
    const booking = bookings.find(b => b.id === bookingId); const currentChat = booking.chat || []; currentChat.push({ sender: 'doctor', text: text, timestamp: new Date().toISOString() });
    try { await supabase.from('bookings').update({ chat: currentChat }).eq('id', bookingId); } catch (e) { showToast('خطأ في الإرسال'); }
}

window.openDoctorScanner = (docId) => {
    const docData = allData.find(d => d.id === docId) || {};
    openCtrlPanel('قارئ الملفات الصحية للمريض', `<div class="flex flex-col gap-4"><div class="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-800 text-sm flex items-center gap-3"><i class="fas fa-camera text-xl"></i><span>وجه كاميرا الهاتف نحو رمز QR الخاص بالمريض.</span></div><div id="qr-reader" style="width:100%"></div></div>`, '#2563EB');
    const html5QrCode = new Html5Qrcode("qr-reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => { html5QrCode.stop().then(() => { fetchPatientHealthFile(decodedText, docData); }).catch(err => console.log(err)); },
        (errorMessage) => { }
    ).catch(err => { showToast("تعذر الوصول للكاميرا."); });
}

window.fetchPatientHealthFile = async (userId, doctorData) => {
    try {
        const { data: p, error } = await supabase.from('health_files').select('*').eq('id', userId).single();
        if (error || !p) { showToast("لم يتم العثور على ملف بهذا الرمز."); return; }
        closeCtrlPanel();
        
        let specializedRecordHtml = '';
        if (doctorData && doctorData.specialty) {
            if (doctorData.specialty.includes('أسنان')) {
                specializedRecordHtml = `<div class="p-3 rounded-xl border" style="border-color: #FED7AA; background: #FFF7ED;"><div class="text-xs text-orange-700 mb-1 font-bold"><i class="fas fa-tooth"></i> سجل الأسنان</div><div class="font-semibold text-sm text-gray-700 whitespace-pre-line">${p.dental || 'لا يوجد.'}</div></div>`;
            } else if (doctorData.specialty.includes('عين') || doctorData.specialty.includes('عيون')) {
                specializedRecordHtml = `<div class="p-3 rounded-xl border" style="border-color: #BFDBFE; background: #EFF6FF;"><div class="text-xs text-blue-700 mb-1 font-bold"><i class="fas fa-eye"></i> سجل العيون</div><div class="font-semibold text-sm text-gray-700 whitespace-pre-line">${p.eye || 'لا يوجد.'}</div></div>`;
            }
        }

        document.getElementById('modalContent').innerHTML = `<div class="p-6"><div class="flex justify-between items-center mb-6"><h3 class="font-bold text-lg"><i class="fas fa-file-medical ml-2" style="color: var(--doctor)"></i> الملف الصحي للمريض</h3><button onclick="closeModal()" class="text-2xl">&times;</button><button onclick="openPrescriptionModal('${userId}', '${p.full_name}')" class="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg"><i class="fas fa-file-prescription"></i> إنشاء روشتة</button></div><div class="flex flex-col gap-3"><div class="flex items-center gap-4 p-3 rounded-xl" style="background: #DBEAFE"><i class="fas fa-user-circle text-3xl" style="color: var(--doctor)"></i><div><h4 class="font-bold text-lg">${p.full_name}</h4><p class="text-sm text-gray-600">${p.age || '-'} سنة | ${p.gender || '-'}</p></div></div><div class="grid grid-cols-2 gap-3 text-sm"><div class="p-3 rounded-xl border"><div class="text-xs text-gray-500">فصيلة الدم</div><div class="font-bold text-red-600">${p.blood_type || 'غير محدد'}</div></div><div class="p-3 rounded-xl border"><div class="text-xs text-gray-500">الوزن</div><div class="font-bold">${p.weight || '-'} كغ</div></div></div><div class="p-3 rounded-xl border"><div class="text-xs text-gray-500 mb-1">الأمراض المزمنة</div><div class="font-semibold">${p.diseases || 'لا يوجد'}</div></div><div class="p-3 rounded-xl border"><div class="text-xs text-gray-500 mb-1">الحساسية</div><div class="font-semibold text-red-600">${p.allergies || 'لا يوجد'}</div></div><div class="p-3 rounded-xl border"><div class="text-xs text-gray-500 mb-1">الأدوية الحالية</div><div class="font-semibold">${p.medications || 'لا يوجد'}</div></div>${specializedRecordHtml}<div class="p-3 rounded-xl bg-green-50 border border-green-200"><div class="text-xs text-green-700 mb-1">جهة طوارئ</div><div class="font-semibold">${p.emergency_name || ''} - <span dir="ltr">${p.emergency_phone || ''}</span></div></div></div></div>`;
        document.getElementById('modalOverlay').classList.add('active');
        lockScroll();
    } catch (e) { showToast("خطأ في قراءة الملف."); }
}

window.openPrescriptionModal = (patientId, patientName) => {
    closeModal(); 
    document.getElementById('modalContent').innerHTML = `<div class="p-6"><div class="flex justify-between items-center mb-6"><h3 class="font-bold text-lg"><i class="fas fa-file-prescription ml-2" style="color: var(--doctor)"></i> إنشاء روشتة طبية</h3><button onclick="closeModal()" class="text-2xl">&times;</button></div><div class="bg-blue-50 p-3 rounded-xl mb-4 text-sm text-blue-800">المريض: <b>${patientName}</b></div><form onsubmit="generatePrescription(event, '${patientId}', '${patientName}')"><div id="medListContainer" class="flex flex-col gap-3 mb-4"><div class="bg-gray-50 p-3 rounded-xl border"><div class="grid grid-cols-1 sm:grid-cols-3 gap-2"><input type="text" required class="ctrl-input text-sm" placeholder="اسم الدواء" name="drugName[]"><input type="text" required class="ctrl-input text-sm" placeholder="الجرعة" name="dose[]"><input type="text" required class="ctrl-input text-sm" placeholder="التكرار" name="freq[]"></div></div></div><button type="button" onclick="addPrescriptionRow()" class="w-full py-2 mb-4 rounded-xl border-2 border-dashed text-sm font-semibold" style="border-color: var(--doctor); color: var(--doctor)"><i class="fas fa-plus"></i> إضافة دواء آخر</button><div class="mb-4"><label class="block text-sm font-semibold mb-2">ملاحظات الطبيب</label><textarea class="ctrl-input text-sm" rows="2" placeholder="مثال: يؤخذ بعد الأكل" name="rxNotes"></textarea></div><button type="submit" class="w-full py-3 rounded-xl text-white font-bold text-sm" style="background: var(--doctor)"><i class="fas fa-save"></i> حفظ الروشتة</button></form></div>`;
    document.getElementById('modalOverlay').classList.add('active');
    lockScroll();
}
window.addPrescriptionRow = () => {
    const container = document.getElementById('medListContainer');
    const newRow = document.createElement('div');
    newRow.className = 'bg-gray-50 p-3 rounded-xl border relative';
    newRow.innerHTML = `<button type="button" onclick="this.parentElement.remove()" class="absolute top-2 left-2 text-red-500"><i class="fas fa-times-circle"></i></button><div class="grid grid-cols-1 sm:grid-cols-3 gap-2"><input type="text" required class="ctrl-input text-sm" placeholder="اسم الدواء" name="drugName[]"><input type="text" required class="ctrl-input text-sm" placeholder="الجرعة" name="dose[]"><input type="text" required class="ctrl-input text-sm" placeholder="التكرار" name="freq[]"></div>`;
    container.appendChild(newRow);
}
window.generatePrescription = async (e, patientId, patientName) => {
    e.preventDefault();
    const form = e.target;
    const drugNames = form.elements['drugName[]'];
    const doses = form.elements['dose[]'];
    const freqs = form.elements['freq[]'];
    const notes = form.elements['rxNotes'].value;
    let rxText = `📋 *روشتة طبية إلكترونية*\n_______________________\n`;
    if (drugNames.length === undefined) { rxText += `\n💊 ${drugNames.value}\n   الجرعة: ${doses.value} | ${freqs.value}\n`; } 
    else { for (let i = 0; i < drugNames.length; i++) { rxText += `\n${i + 1}. 💊 ${drugNames[i].value}\n   الجرعة: ${doses[i].value} | ${freqs[i].value}\n`; } }
    if (notes) rxText += `\n📝 *ملاحظات:* ${notes}\n`;
    rxText += `_______________________\nيرجى الالتزام بالجرعات.`;
    const doctorName = document.getElementById('ctrlTitle')?.textContent.replace('لوحة: ', '').trim() || 'طبيب';
    try {
        const { data: docSnap, error } = await supabase.from('health_files').select('prescriptions').eq('id', patientId).single();
        if (error) return;
        const currentRx = docSnap.prescriptions || [];
        currentRx.push({ doctor: doctorName, text: rxText, date: new Date().toISOString() });
        await supabase.from('health_files').update({ prescriptions: currentRx }).eq('id', patientId);
        showToast('تم حفظ الروشتة في ملف المريض بنجاح!');
        closeModal();
        fetchPatientHealthFile(patientId, { specialty: 'general' }); 
    } catch (err) { showToast('خطأ في حفظ الروشتة'); }
}
window.deletePrescription = async (rxDate) => {
    if (!confirm("هل أنت متأكد من حذف هذه الروشتة؟")) return;
    try {
        const { data: docSnap, error } = await supabase.from('health_files').select('*').eq('id', currentHealthFileId).single();
        if (error) return;
        const updatedRx = (docSnap.prescriptions || []).filter(p => p.date !== rxDate);
        await supabase.from('health_files').update({ prescriptions: updatedRx }).eq('id', currentHealthFileId);
        showToast('تم حذف الروشتة بنجاح');
        renderHealthDashboard({ ...docSnap, prescriptions: updatedRx });
    } catch (err) { showToast('حدث خطأ أثناء الحذف'); }
};

window.openMedicineDonation = () => {
    openCtrlPanel('صندوق الأدوية الفائضة', `<div class="flex flex-col gap-5"><div class="bg-red-50 border-2 border-red-400 rounded-xl p-4 text-red-800"><div class="font-black text-lg mb-2"><i class="fas fa-exclamation-triangle"></i> تنبيه أمان</div><ul class="list-disc pr-5 space-y-1 text-sm font-bold"><li>الموقع يعمل كوسيط خيري فقط.</li><li>يُمنع نشر الأدوية النفسية أو المخدرة.</li><li>تأكد من تاريخ الصلاحية قبل الاستخدام.</li></ul></div><div class="bg-white p-5 rounded-xl border"><h4 class="font-bold mb-4 text-sm"><i class="fas fa-hand-holding-medical text-green-600"></i> تبرع بدواء فائض</h4><form onsubmit="submitMedicineDonation(event)" class="grid grid-cols-1 sm:grid-cols-2 gap-3"><input type="text" id="medDonorName" class="ctrl-input text-sm" placeholder="اسم المتبرع" required><input type="text" id="medDonationName" class="ctrl-input text-sm" placeholder="اسم الدواء التجاري" required><select id="medDonationType" class="ctrl-input text-sm"><option>حبوب / أقراص</option><option>شراب</option><option>كريم / مرهم</option><option>قطرات</option></select><input type="text" id="medDonationExpiry" class="ctrl-input text-sm" placeholder="تاريخ الانتهاء (10/2025)" required><input type="text" id="medDonationQty" class="ctrl-input text-sm" placeholder="الكمية" required><input type="tel" id="medDonationPhone" class="ctrl-input text-sm" placeholder="رقم الهاتف 09XX" required><textarea id="medDonationNotes" class="ctrl-input text-sm col-span-1 sm:col-span-2" rows="2" placeholder="ملاحظات"></textarea><button type="submit" class="col-span-1 sm:col-span-2 py-3 rounded-xl text-white font-bold text-sm" style="background: #059669;">نشر الدواء</button></form></div><div class="bg-white p-5 rounded-xl border"><h4 class="font-bold mb-4 text-sm"><i class="fas fa-list-alt text-green-600"></i> الأدوية المتوفرة</h4><div id="medicineDonationsList" class="flex flex-col gap-3"><p class="text-center py-8 text-gray-400 text-sm">جاري تحميل الأدوية...</p></div></div></div>`, '#059669');
    renderMedicineDonationsUI();
}
function renderMedicineDonationsUI() {
    const list = document.getElementById('medicineDonationsList');
    if (!list) return;
    if (medicineDonations.length === 0) { list.innerHTML = '<p class="text-center py-8 text-gray-400 text-sm">لا توجد أدوية متوفرة حالياً.</p>'; return; }
    list.innerHTML = medicineDonations.map(m => `<div class="med-donation-card"><div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"><div class="flex items-center gap-3"><div class="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0"><i class="fas fa-pills text-green-600 text-xl"></i></div><div><div class="font-bold text-gray-800 text-sm">${m.medicine_name}</div><div class="text-xs text-gray-500 mt-1 flex flex-wrap gap-2"><span><i class="fas fa-flask ml-1"></i>${m.medicine_type}</span><span><i class="fas fa-box ml-1"></i>${m.quantity}</span><span class="text-red-500 font-bold"><i class="fas fa-calendar-times ml-1"></i> ينتهي: ${m.expiry_date}</span></div>${m.notes ? `<div class="text-xs text-gray-400 mt-1"><i class="fas fa-info-circle"></i> ${m.notes}</div>` : ''}</div></div><div class="flex gap-2 w-full sm:w-auto"><a href="tel:${m.phone}" class="flex-1 sm:flex-none bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"><i class="fas fa-phone"></i> اتصال</a></div></div></div>`).join('');
}
window.submitMedicineDonation = async (e) => {
    e.preventDefault();
    const donorName = document.getElementById('medDonorName').value.trim();
    const medicineName = document.getElementById('medDonationName').value.trim();
    const medicineType = document.getElementById('medDonationType').value;
    const expiryDate = document.getElementById('medDonationExpiry').value.trim();
    const quantity = document.getElementById('medDonationQty').value.trim();
    const phoneInput = document.getElementById('medDonationPhone');
    const phone = phoneInput.value.trim();
    const notes = document.getElementById('medDonationNotes').value.trim();
    if (!/^09\d{8}$/.test(phone)) { phoneInput.classList.add('input-invalid'); showToast('رقم هاتف غير صحيح'); return; }
    phoneInput.classList.remove('input-invalid');
    try {
        await supabase.from('medicine_donations').insert([{ donor_name: donorName, medicine_name: medicineName, medicine_type: medicineType, expiry_date: expiryDate, quantity: quantity, phone: phone, notes: notes, status: 'active' }]);
        showToast('بارك الله فيك! تم نشر الدواء.');
        document.querySelector('#ctrlContent form').reset();
    } catch (err) { showToast('حدث خطأ أثناء النشر'); }
}
window.resolveMedicineDonation = async (id) => { try { await supabase.from('medicine_donations').update({ status: 'resolved' }).eq('id', id); showToast('تمت الإزالة.'); } catch (err) { showToast('خطأ'); } }

window.openBloodBank = () => {
    const bloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
    openCtrlPanel('بنك التبرع بالدم الرقمي', `<div class="flex flex-col gap-5"><div class="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 text-sm"><i class="fas fa-tint text-xl"></i> نظام رقمي لربط المرضى بالمتبرعين.</div><div class="bg-white p-5 rounded-xl border"><h4 class="font-bold mb-4 text-sm"><i class="fas fa-plus-circle text-red-600"></i> نشر طلب استغاثة</h4><form onsubmit="submitBloodRequest(event)" class="grid grid-cols-1 sm:grid-cols-2 gap-3"><input type="text" id="bloodPatient" class="ctrl-input text-sm" placeholder="اسم المريض" required><select id="bloodType" class="ctrl-input text-sm" required>${bloodTypes.map(t => `<option value="${t}">الفصيلة: ${t}</option>`).join('')}</select><input type="text" id="bloodHospital" class="ctrl-input text-sm" placeholder="المشفى / المدينة" required><input type="tel" id="bloodPhone" class="ctrl-input text-sm" placeholder="رقم التواصل 09XX" required><textarea id="bloodNotes" class="ctrl-input text-sm col-span-1 sm:col-span-2" rows="2" placeholder="ملاحظات"></textarea><button type="submit" class="col-span-1 sm:col-span-2 py-3 rounded-xl text-white font-bold text-sm" style="background: #DC2626;">نشر الاستغاثة</button></form></div><div class="bg-white p-5 rounded-xl border"><h4 class="font-bold mb-4 text-sm"><i class="fas fa-list-alt text-red-600"></i> استغاثات الدم الحالية</h4><div id="bloodRequestsList" class="flex flex-col gap-3"><p class="text-center py-8 text-gray-400 text-sm">جاري تحميل الاستغاثات...</p></div></div></div>`, '#DC2626');
    renderBloodBankUI();
}
function renderBloodBankUI() {
    const list = document.getElementById('bloodRequestsList');
    if (!list) return;
    if (bloodRequests.length === 0) { list.innerHTML = '<p class="text-center py-8 text-gray-400 text-sm">لا توجد استغاثات حالياً.</p>'; return; }
    list.innerHTML = bloodRequests.map(req => `<div class="border rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4"><div class="blood-type-badge">${req.blood_type}</div><div class="flex-1 text-center sm:text-right"><div class="font-bold text-gray-800">${req.patient_name}</div><div class="text-xs text-gray-500 mt-1"><i class="fas fa-hospital ml-1"></i> ${req.hospital} ${req.notes ? `| <i class="fas fa-notes-medical ml-1"></i> ${req.notes}` : ''}</div></div><a href="tel:${req.phone}" class="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"><i class="fas fa-phone"></i> اتصال</a></div>`).join('');
}
window.submitBloodRequest = async (e) => {
    e.preventDefault();
    const patient_name = document.getElementById('bloodPatient').value.trim();
    const blood_type = document.getElementById('bloodType').value;
    const hospital = document.getElementById('bloodHospital').value.trim();
    const phoneInput = document.getElementById('bloodPhone');
    const phone = phoneInput.value.trim();
    const notes = document.getElementById('bloodNotes').value.trim();
    if (!/^09\d{8}$/.test(phone)) { phoneInput.classList.add('input-invalid'); showToast('رقم هاتف غير صحيح'); return; }
    phoneInput.classList.remove('input-invalid');
    try {
        await supabase.from('blood_requests').insert([{ patient_name, blood_type, hospital, phone, notes, status: 'active' }]);
        showToast('تم نشر استغاثتك بنجاح!');
        document.querySelector('#ctrlContent form').reset();
    } catch (err) { showToast('حدث خطأ أثناء النشر'); }
}
window.resolveBloodRequest = async (id) => { try { await supabase.from('blood_requests').update({ status: 'resolved' }).eq('id', id); showToast('تم إنهاء الطلب.'); } catch (err) { showToast('خطأ'); } }

window.respondToBloodRequest = (btnElement, reqId, patientName, phone) => {
    btnElement.disabled = true; btnElement.innerText = 'جاري التسجيل...'; btnElement.classList.add('opacity-50', 'cursor-not-allowed');
    const toast = document.getElementById('toast');
    toast.innerHTML = `<div class="flex flex-col items-center gap-3"><div class="text-sm">سيتم تسجيل استجابتك خلال 6 ثوانٍ...</div><button onclick="undoRespond()" style="background:#ef4444; color:white; padding:6px 16px; border-radius:8px; font-size:12px; border:none; cursor:pointer; font-weight:bold;">تراجع الآن</button></div>`;
    toast.classList.add('show');
    window.bloodUndoTimeout = setTimeout(async () => {
        toast.classList.remove('show');
        try {
            const req = bloodRequests.find(r => r.id === reqId);
            const newCount = (req?.responses_count || 0) + 1;
            await supabase.from('blood_requests').update({ responses_count: newCount }).eq('id', reqId);
            toast.innerHTML = `<div class="flex flex-col items-center gap-3"><div class="text-sm font-bold">بارك الله فيك! 🌹<br>تم تسجيل استجابتك.</div><a href="tel:${phone}" onclick="hideToast()" style="background:#2563EB; color:white; padding:8px 20px; border-radius:8px; font-size:14px; text-decoration:none; font-weight:bold; display:flex; align-items:center; gap:8px;"><i class="fas fa-phone-volume"></i> اتصال بالمريض</a></div>`;
            toast.classList.add('show');
            setTimeout(() => { toast.classList.remove('show'); }, 10000);
        } catch (err) { showToast('حدث خطأ أثناء التسجيل'); btnElement.disabled = false; btnElement.innerText = 'استجبت'; btnElement.classList.remove('opacity-50', 'cursor-not-allowed'); }
    }, 6000);
}
window.undoRespond = () => { if (window.bloodUndoTimeout) clearTimeout(window.bloodUndoTimeout); document.getElementById('toast').classList.remove('show'); setTimeout(() => showToast('تم التراجع.'), 300); }
window.hideToast = () => { document.getElementById('toast').classList.remove('show'); }

window.setStatus = async (id, status) => {
    try {
        await supabase.from('listings').update({ isopen: status }).eq('id', id);
        localStorage.setItem('force_listings_update', 'true');
        let msg = status === true ? 'تم تغيير الحالة إلى: مفتوح' : status === false ? 'تم تغيير الحالة إلى: مغلق' : 'تم تعيين الحالة إلى: لا شيء';
        showToast(msg);
    } catch (e) { showToast('حدث خطأ'); }
}

window.openMedicineFinder = () => { 
    document.getElementById('modalContent').innerHTML = `<div class="p-6"><div class="flex justify-between items-center mb-6"><h3 class="font-bold text-lg"><i class="fas fa-pills ml-2" style="color: var(--gold)"></i> ابحث عن دوائك</h3><button onclick="closeModal()" class="text-2xl">&times;</button></div><div class="mb-4 p-3 rounded-xl text-sm" style="background: var(--accent-light); color: var(--accent-dark)">اكتب الأدوية المطلوبة وسنتولى إرسالها للصيدليات.</div><form onsubmit="submitMedicineRequest(event)"><div class="mb-4"><label class="block text-sm font-semibold mb-2">الأدوية المطلوبة</label><textarea id="medList" class="ctrl-input" rows="3" placeholder="مثال: كونكور 5مغ" required></textarea></div><div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4"><div><label class="block text-sm font-semibold mb-2">اسم المريض</label><input type="text" id="medName" class="ctrl-input" placeholder="اكتب اسمك"></div><div><label class="block text-sm font-semibold mb-2">رقم الهاتف</label><input type="tel" id="medPhone" class="ctrl-input" placeholder="09XXXXXXXX" required></div></div><div class="mb-4"><label class="block text-sm font-semibold mb-2">مستوى الإلحاح</label><select id="medUrgency" class="ctrl-input"><option value="عاجل جداً (طوارئ)">عاجل جداً (طوارئ)</option><option value="عاجل (خلال اليوم)">عاجل (خلال اليوم)</option><option value="عادي" selected>عادي</option></select></div><div class="mb-6"><label class="block text-sm font-semibold mb-2">صورة الوصفة الطبية (اختياري)</label><div class="file-input-wrapper"><label class="file-input-label" for="medImage"><i class="fas fa-camera text-2xl mb-2"></i><span>اضغط لاختيار صورة</span><img id="imagePreview" class="preview-image hidden" src="" alt="معاينة"></label><input type="file" id="medImage" accept="image/*" onchange="previewMedicineImage(event)"></div></div><button type="submit" id="medSubmitBtn" class="w-full py-3.5 rounded-xl text-white font-bold text-sm" style="background: var(--accent)"><i class="fas fa-paper-plane"></i> إرسال للصيدليات</button></form></div>`; 
    document.getElementById('modalOverlay').classList.add('active'); lockScroll(); 
}
window.previewMedicineImage = (event) => { const file = event.target.files[0]; const reader = new FileReader(); reader.onload = (e) => { const img = document.getElementById('imagePreview'); img.src = e.target.result; img.classList.remove('hidden'); }; reader.readAsDataURL(file); }
window.submitMedicineRequest = async (e) => { 
    e.preventDefault(); 
    const medList = document.getElementById('medList').value.trim();
    const name = document.getElementById('medName').value.trim() || 'مريض'; 
    const phoneInput = document.getElementById('medPhone'); 
    const phone = phoneInput.value.trim(); 
    const urgency = document.getElementById('medUrgency').value;
    const fileInput = document.getElementById('medImage'); 
    const file = fileInput.files[0]; 
    
    if (!/^09\d{8}$/.test(phone)) { phoneInput.classList.add('input-invalid'); showToast('رقم هاتف غير صحيح'); return; } 
    phoneInput.classList.remove('input-invalid'); 
    
    const submitBtn = document.getElementById('medSubmitBtn'); 
    submitBtn.disabled = true; 
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري إرسال الطلب...'; 
    try { 
        let imageUrl = '';
        if (file) {
            const formData = new FormData(); 
            formData.append('image', file); 
            const imgbbRes = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData }); 
            const imgbbData = await imgbbRes.json(); 
            if (imgbbData.success) imageUrl = imgbbData.data.url;
        }
        const medRef = `MED-${Math.floor(Math.random() * 900) + 100}`; 
        await supabase.from('medicine_requests').insert([{ 
            med_ref: medRef, med_list: medList, urgency: urgency, patient_name: name, patient_phone: phone, 
            image_url: imageUrl, status: 'searching', notes: '', available_pharmacy: ''
        }]); 
        document.getElementById('modalContent').innerHTML = `<div class="p-8 text-center"><div class="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style="background: var(--accent-light)"><i class="fas fa-check text-4xl" style="color: var(--accent)"></i></div><h3 class="text-xl font-bold mb-2">تم إرسال طلبك بنجاح!</h3><p class="text-sm mb-2">رقم طلبك الدوائي هو:</p><div class="text-2xl font-black text-yellow-600 mb-4">#${medRef}</div><button onclick="copyText('${medRef}')" class="w-full py-3 rounded-xl text-white font-bold text-sm mb-2" style="background: var(--accent)"><i class="fas fa-copy ml-2"></i> نسخ الكود</button><button onclick="closeModal()" class="w-full py-2 rounded-xl border font-bold text-sm" style="border-color: var(--border)">حسناً</button></div>`; 
    } catch (err) { 
        showToast('حدث خطأ أثناء إرسال الطلب'); 
        submitBtn.disabled = false; 
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال للصيدليات'; 
    } 
}

window.quickLookup = async () => {
    let val = document.getElementById('quickLookupInput').value.trim().toUpperCase().replace(/#/g, '').replace(/\s/g, '');
    if (!val) { showToast('الرجاء إدخال رقم الاستعلام'); return; }
    if (val.startsWith('R-')) {
        const { data, error } = await supabase.from('bookings').select('*').eq('ref', val);
        if (data && data.length > 0) { openBookingFollowup(data[0].id); } else { showToast('لم يتم العثور على حجز'); }
    } else if (val.startsWith('MED-')) {
        const { data, error } = await supabase.from('medicine_requests').select('*').eq('med_ref', val);
        if (data && data.length > 0) {
            const m = data[0];
            let statusText = '', statusColor = '', statusIcon = '';
            if (m.status === 'searching') { statusText = 'قيد البحث'; statusColor = '#F59E0B'; statusIcon = 'fa-clock'; }
            else if (m.status === 'available') { statusText = 'تم التوفير - جاهز للاستلام'; statusColor = '#10B981'; statusIcon = 'fa-check-circle'; }
            else if (m.status === 'unavailable') { statusText = 'غير متوفر حالياً'; statusColor = '#6B7280'; statusIcon = 'fa-times-circle'; }
            else { statusText = 'تم إنهاء الطلب'; statusColor = '#6B7280'; statusIcon = 'fa-archive'; }
            document.getElementById('modalContent').innerHTML = `<div class="p-6 text-center"><div class="flex justify-between items-center mb-6"><h3 class="font-bold text-lg"><i class="fas fa-pills ml-2" style="color: var(--gold)"></i> حالة طلب الدواء</h3><button onclick="closeModal()" class="text-2xl">&times;</button></div><div class="text-sm text-gray-500 mb-1">رقم الطلب</div><div class="text-xl font-black text-yellow-600 mb-6">#${m.med_ref}</div><div class="p-4 rounded-xl mb-4" style="background: ${statusColor}20; color: ${statusColor};"><i class="fas ${statusIcon} text-3xl mb-2"></i><div class="font-bold text-lg">${statusText}</div></div>${m.notes ? `<div class="bg-gray-50 p-3 rounded-xl text-sm text-gray-700 text-right"><b>ملاحظة الصيدلية:</b><br>${m.notes}</div>` : '<div class="text-xs text-gray-400">لا توجد ملاحظات.</div>'}</div>`;
            document.getElementById('modalOverlay').classList.add('active'); lockScroll();
        } else { showToast('لم يتم العثور على طلب دواء'); }
    } else { showToast('صيغة غير صحيحة. استخدم R-XXX أو MED-XXX'); }
}

// تنتهي هنا الجزء الثالث...
// === الجزء الرابع: الإدارة، الملف الصحي، الإحصائيات، الإعلانات ===

window.openAdminLogin = () => { openCtrlPanel('لوحة الإدارة', `<div class="max-w-sm mx-auto py-8"><div class="text-center mb-6"><div class="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-3" style="background: var(--accent-light)"><i class="fas fa-user-shield text-2xl" style="color: var(--accent)"></i></div><h3 class="font-bold text-lg">دخول الإدارة</h3></div><form onsubmit="handleAdminLogin(event)" class="flex flex-col gap-4"><input type="password" id="adminPass" class="ctrl-input text-center" placeholder="كلمة المرور" required><button type="submit" class="w-full py-3 rounded-xl text-white font-bold text-sm" style="background: var(--accent)">دخول</button></form></div>`, '#073D2E'); }
window.handleAdminLogin = (e) => { e.preventDefault(); if (document.getElementById('adminPass').value === ADMIN_PASSWORD) renderAdminDashboard(); else { showToast('كلمة المرور خاطئة!'); document.getElementById('adminPass').value = ''; } }

window.updateAdminFormFields = (type) => {
    let html = '';
    if (type === 'hospital') html = `<input type="text" id="new_emergency" class="ctrl-input text-sm" placeholder="رقم الطوارئ" required><input type="text" id="new_floors" class="ctrl-input text-sm" placeholder="الطوابق"><input type="text" id="new_extra" class="ctrl-input text-sm col-span-1 sm:col-span-2" placeholder="الأقسام والعيادات">`;
    else if (type === 'doctor') html = `<input type="text" id="new_consult_hours" class="ctrl-input text-sm" placeholder="أوقات المعاينة"><input type="text" id="new_extra" class="ctrl-input text-sm" placeholder="تفاصيل إضافية">`;
    else if (type === 'clinic') html = `<input type="text" id="new_extra" class="ctrl-input text-sm col-span-1 sm:col-span-2" placeholder="وصف مختصر">`;
    else if (type === 'center') html = `<input type="text" id="new_floors" class="ctrl-input text-sm" placeholder="الطوابق"><input type="text" id="new_extra" class="ctrl-input text-sm col-span-1 sm:col-span-2" placeholder="التخصصات والخدمات">`;
    else if (type === 'lab') html = `<input type="text" id="new_extra" class="ctrl-input text-sm col-span-1 sm:col-span-2" placeholder="نوع التحاليل"><select id="new_home_sample" class="ctrl-input text-sm"><option value="لا">لا يوجد سحب منزلي</option><option value="نعم">يوجد سحب منزلي</option></select>`;
    else if (type === 'pharmacy') html = `<input type="text" id="new_night_details" class="ctrl-input text-sm" placeholder="تفاصيل المناوبة"><input type="text" id="new_extra" class="ctrl-input text-sm col-span-1 sm:col-span-2" placeholder="ملاحظات">`;
    html += '<input type="text" id="new_latlng" class="ctrl-input text-sm col-span-1 sm:col-span-2 mt-2" placeholder="إحداثيات الموقع (33.5, 36.3)">';
    document.getElementById('adminExtraFields').innerHTML = html;
}

window.renderAdminDashboard = async () => { 
    const radarAdminHtml = `<div class="bg-white p-5 rounded-xl border" style="border-color: var(--border)"><h4 class="font-bold mb-4 text-sm flex items-center gap-2" style="font-family: 'Noto Kufi Arabic'"><i class="fas fa-satellite-dish text-indigo-600"></i> إدارة رادار الرحيبة الصحي</h4><div class="grid grid-cols-1 sm:grid-cols-2 gap-3"><div class="bg-gray-50 p-3 rounded-xl"><span class="text-xs text-gray-500 block mb-1">الفصل الافتراضي للزوار:</span><select id="adminRadarSeason" onchange="setRadarDefaultSeason()" class="ctrl-input text-sm"><option value="summer">☀️ صيف</option><option value="winter">❄️ شتاء</option></select></div><div class="bg-gray-50 p-3 rounded-xl flex flex-col justify-center"><span class="text-xs text-gray-500 block mb-1">تصفير العدادات الأسبوعي:</span><button onclick="resetRadarVotes()" class="bg-red-500 text-white py-2 rounded-lg text-sm font-bold hover:bg-red-600 transition-all">تصفير العدادات</button></div></div></div>`;
    const homeAdsHtml = `<div class="bg-white p-5 rounded-xl border" style="border-color: var(--border)"><h4 class="font-bold mb-4 text-sm flex items-center gap-2" style="font-family: 'Noto Kufi Arabic'"><i class="fas fa-photo-video text-purple-600"></i> إعلانات الصفحة الرئيسية (صور/فيديو)</h4><form onsubmit="saveHomeAd(event)" class="grid grid-cols-1 gap-3 mb-4"><select id="adType" class="ctrl-input text-sm"><option value="image">صورة (رابط مباشر ينتهي بـ .jpg أو .png)</option><option value="video">فيديو (رابط مباشر ينتهي بـ .mp4 فقط)</option></select><input type="text" id="adContent" class="ctrl-input text-sm" placeholder="الصق الرابط هنا..." required><input type="text" id="adLink" class="ctrl-input text-sm" placeholder="رابط التحويل عند الضغط (اختياري للصور)"><label class="flex items-center gap-2 text-sm"><input type="checkbox" id="adActiveCheck" class="w-5 h-5 accent-purple-600" checked> تفعيل وعرض الإعلان فوراً</label><button type="submit" class="py-2.5 rounded-xl text-white font-semibold text-sm" style="background: #8B5CF6"><i class="fas fa-plus ml-1"></i> إضافة إعلان</button></form><div id="adminHomeAdsList" class="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1"><p class="text-center text-gray-400 text-sm py-2">جاري تحميل الإعلانات...</p></div></div>`;
    const announcementsHtml = `<div class="bg-white p-5 rounded-xl border" style="border-color: var(--border)"><h4 class="font-bold mb-4 text-sm flex items-center gap-2" style="font-family: 'Noto Kufi Arabic'"><i class="fas fa-bullhorn text-blue-600"></i> إدارة الشريط الإعلاني العلوي</h4><form onsubmit="saveAnnouncement(event)" class="grid grid-cols-1 gap-3 mb-4"><textarea id="annText" class="ctrl-input text-sm" rows="2" placeholder="نص الإعلان (مثال: افتتاحية قسم الطوارئ الجديد...)" required></textarea><input type="text" id="annLink" class="ctrl-input text-sm" placeholder="رابط التفاصيل (اتركه فارغاً لإخفاء الزر تماماً)"><input type="text" id="annLinkText" class="ctrl-input text-sm" placeholder="نص الزر (اختياري - افتراضي: اضغط هنا)"><button type="submit" class="py-2.5 rounded-xl text-white font-semibold text-sm" style="background: #2563EB"><i class="fas fa-paper-plane ml-1"></i> نشر الإعلان</button></form><div id="adminAnnouncementList" class="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1"><p class="text-center text-gray-400 text-sm py-2">جاري تحميل الإعلانات...</p></div></div>`;
    
    // تم إعادة كود عرض كلمة المرور للطبيب والصيدلية هنا
    let listHtml = allData.map(item => `<div class="flex items-center justify-between p-3 rounded-xl border bg-white" style="border-color: var(--border)"><div class="flex flex-col gap-1"><div class="flex items-center gap-3"><span class="badge badge-${item.type}">${item.type}</span><span class="font-semibold text-sm">${item.name}</span></div>${item.bookingpass ? `<span class="text-[11px] text-gray-500">رمز الطبيب: <span class="font-mono font-bold text-blue-600">${item.bookingpass}</span></span>` : ''}${item.pharmacypass ? `<span class="text-[11px] text-gray-500">رمز الصيدلية: <span class="font-mono font-bold text-green-600">${item.pharmacypass}</span></span>` : ''}</div><div class="flex gap-2 items-center"> ${['doctor', 'clinic', 'pharmacy'].includes(item.type) ? `<div class="flex gap-1 bg-gray-50 p-1 rounded-lg border" style="border-color: var(--border)"><button onclick="setStatus('${item.id}', true)" class="px-2 py-1 rounded text-[11px] font-bold transition-all ${item.isopen === true ? 'bg-green-500 text-white' : 'text-gray-500 hover:bg-gray-100'}">مفتوح</button><button onclick="setStatus('${item.id}', false)" class="px-2 py-1 rounded text-[11px] font-bold transition-all ${item.isopen === false ? 'bg-red-500 text-white' : 'text-gray-500 hover:bg-gray-100'}">مغلق</button><button onclick="setStatus('${item.id}', null)" class="px-2 py-1 rounded text-[11px] font-bold transition-all ${item.isopen == null ? 'bg-gray-700 text-white' : 'text-gray-500 hover:bg-gray-100'}">لا شيء</button></div>` : ''}<button onclick="editFacility('${item.id}')" class="w-8 h-8 rounded-lg flex items-center justify-center text-blue-600 hover:bg-blue/50"><i class="fas fa-edit"></i></button><button onclick="deleteFacility('${item.id}')" class="w-8 h-8 rounded-lg flex items-center justify-center text-red-600 hover:bg-red-50"><i class="fas fa-trash"></i></button></div></div>`).join(''); 

    const twentyHoursAgo = new Date(Date.now() - (20 * 60 * 60 * 1000)).toISOString();
    const activeBloodRequests = bloodRequests.filter(b => b.created_at > twentyHoursAgo);
    let bloodHtml = activeBloodRequests.length === 0 ? '<p class="text-center py-4 text-gray-400 text-sm">لا توجد استغاثات حالياً.</p>' : activeBloodRequests.map(b => `<div class="flex items-center justify-between p-2 rounded-lg border" style="border-color: var(--border)"><div class="flex items-center gap-3"><span class="blood-type-badge text-sm py-1 px-3">${b.blood_type}</span><div><div class="text-sm font-semibold">${b.patient_name} ${b.responses_count > 0 ? '<span class="text-xs text-green-500">(مستجيب: '+b.responses_count+')</span>' : ''}</div><div class="text-xs text-gray-500">${b.hospital}</div></div></div><button onclick="resolveBloodRequest('${b.id}')" class="text-xs text-white px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 transition-colors">إنهاء الطلب</button></div>`).join('');
    let medDonHtml = medicineDonations.length === 0 ? '<p class="text-center py-4 text-gray-400 text-sm">لا توجد أدوية مُتبرع بها حالياً.</p>' : medicineDonations.map(m => `<div class="flex items-center justify-between p-2 rounded-lg border" style="border-color: var(--border)"><div class="flex items-center gap-3"><i class="fas fa-pills text-green-600"></i><div><div class="text-sm font-semibold">${m.medicine_name} (${m.quantity})</div><div class="text-xs text-gray-500">ينتهي: ${m.expiry_date} | المتبرع: ${m.donor_name}</div></div></div><button onclick="resolveMedicineDonation('${m.id}')" class="text-xs text-white px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 transition-colors">حذف/إنهاء</button></div>`).join('');

    openCtrlPanel('لوحة الإدارة', `<div class="flex flex-col gap-6"> ${announcementsHtml} ${homeAdsHtml} ${radarAdminHtml} <div class="bg-white p-5 rounded-xl border" style="border-color: var(--border)"><h4 class="font-bold mb-4 text-sm flex items-center gap-2" style="font-family: 'Noto Kufi Arabic'"><i class="fas fa-tint text-red-600"></i> إدارة استغاثات الدم (${bloodRequests.length})</h4><div class="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">${bloodHtml}</div></div> <div class="bg-white p-5 rounded-xl border" style="border-color: var(--border)"><h4 class="font-bold mb-4 text-sm flex items-center gap-2" style="font-family: 'Noto Kufi Arabic'"><i class="fas fa-hand-holding-medical text-green-600"></i> إدارة الأدوية الفائضة (${medicineDonations.length})</h4><div class="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">${medDonHtml}</div></div> <div class="bg-white p-5 rounded-xl border" style="border-color: var(--border)"><h4 class="font-bold mb-4 text-sm"><i class="fas fa-plus-circle ml-2" style="color: var(--accent)"></i> <span id="formTitle">إضافة منشأة</span></h4><form onsubmit="saveFacility(event)" class="grid grid-cols-1 sm:grid-cols-2 gap-3"><input type="hidden" id="edit_id"><select id="new_type" class="ctrl-input text-sm" required onchange="updateAdminFormFields(this.value)"><option value="clinic">عيادة</option><option value="hospital">مشفى</option><option value="center">مركز</option><option value="lab">مخبر</option><option value="doctor">طبيب</option><option value="pharmacy">صيدلية</option></select><input type="text" id="new_name" class="ctrl-input text-sm" placeholder="الاسم" required><input type="text" id="new_specialty" class="ctrl-input text-sm" placeholder="التخصص الأساسي" required><input type="text" id="new_address" class="ctrl-input text-sm" placeholder="العنوان / الموقع" required><input type="text" id="new_phone" class="ctrl-input text-sm" placeholder="رقم الهاتف (اختياري)"><input type="text" id="new_hours" class="ctrl-input text-sm" placeholder="أوقات العمل"><input type="text" id="new_image_url" class="ctrl-input text-sm" placeholder="رابط الصورة (URL)"><textarea id="new_desc" class="ctrl-input text-sm col-span-2" placeholder="وصف عام" rows="2" required></textarea><div id="adminExtraFields" class="contents"></div><button type="submit" class="col-span-1 sm:col-span-2 py-2.5 rounded-xl text-white font-semibold text-sm" style="background: var(--accent)"><i class="fas fa-save ml-1"></i> حفظ</button></form></div> <div class="bg-white p-5 rounded-xl border" style="border-color: var(--border)"><h4 class="font-bold mb-4 text-sm"><i class="fas fa-list ml-2"></i> المنشآت (${allData.length})</h4><div class="flex flex-col gap-2 max-h-96 overflow-y-auto">${listHtml}</div></div> <button onclick="seedDatabase()" class="py-2.5 rounded-xl border border-dashed font-semibold text-sm" style="border-color: var(--gold); color: var(--gold)"><i class="fas fa-database ml-2"></i> ترحيل البيانات الافتراضية</button> </div>`, '#073D2E'); 

    fetchAnnouncements();
    fetchHomeAdsForAdmin();
    updateAdminFormFields('clinic');
}

window.saveAnnouncement = async (e) => {
    e.preventDefault(); const text = document.getElementById('annText').value.trim(); const link = document.getElementById('annLink').value.trim(); 
    if (!text) { showToast('الرجاء إدخال نص'); return; }
    try { await supabase.from('announcements').insert([{ text, link, is_active: true }]); showToast('تم النشر!'); e.target.reset(); fetchAnnouncements(); } catch (err) { showToast('خطأ'); }
};
async function fetchAnnouncements() {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
    allAnnouncements = data || [];
    const annList = document.getElementById('adminAnnouncementList'); 
    if (annList) {
        if (allAnnouncements.length === 0) { annList.innerHTML = '<p class="text-center text-gray-400 text-sm">لا توجد إعلانات.</p>'; } 
        else { annList.innerHTML = allAnnouncements.map(ann => `<div class="flex items-center justify-between p-2 rounded-lg border"><div class="text-xs truncate flex-1">${ann.text}</div><div class="flex gap-1 mr-2"><button onclick="toggleAnnouncement('${ann.id}', ${!ann.is_active})" class="px-2 py-1 rounded text-xs ${ann.is_active ? 'bg-green-500 text-white' : 'bg-gray-200'}">${ann.is_active ? 'مفعّل' : 'معطّل'}</button><button onclick="deleteAnnouncement('${ann.id}')" class="px-2 py-1 rounded text-xs bg-red-500 text-white"><i class="fas fa-trash"></i></button></div></div>`).join(''); }
    }
    renderTopAnnouncement();
}
function renderTopAnnouncement() {
    const navbar = document.getElementById('navbar'); const annBar = document.getElementById('topAnnouncementBar'); const homeSection = document.getElementById('home');
    if (annBar && navbar && homeSection) {
        const activeAnns = allAnnouncements.filter(a => a.is_active);
        if (activeAnns.length > 0) {
            const ann = activeAnns[0]; currentAnnouncement = ann;
            const textEl = document.getElementById('announcementText'); textEl.innerText = ann.text;
            const linkEl = document.getElementById('announcementLink');
            if (ann.link) { let url = ann.link; if (!url.match(/^https?:\/\//i)) { url = 'https://' + url; } linkEl.href = url; linkEl.style.display = 'inline'; textEl.classList.add('no-marquee'); } 
            else { linkEl.style.display = 'none'; textEl.classList.remove('no-marquee'); }
            annBar.classList.remove('hidden'); navbar.style.top = '36px'; homeSection.style.paddingTop = '11rem';
        } else { currentAnnouncement = null; annBar.classList.add('hidden'); navbar.style.top = '0px'; homeSection.style.paddingTop = '6rem'; }
    }
}
window.toggleAnnouncement = async (id, status) => { try { await supabase.from('announcements').update({ is_active: status }).eq('id', id); showToast('تم التحديث'); } catch (err) { showToast('خطأ'); } };
window.deleteAnnouncement = async (id) => { try { await supabase.from('announcements').delete().eq('id', id); showToast('تم الحذف'); } catch (err) { showToast('خطأ'); } };

window.editFacility = (id) => { 
    const item = allData.find(d => d.id === id); if (!item) return; 
    document.getElementById('edit_id').value = id; document.getElementById('new_type').value = item.type; 
    updateAdminFormFields(item.type); 
    setTimeout(() => {
        document.getElementById('new_name').value = item.name; document.getElementById('new_specialty').value = item.specialty || ''; document.getElementById('new_address').value = item.address || item.clinic || ''; document.getElementById('new_phone').value = item.phone; document.getElementById('new_hours').value = item.hours; document.getElementById('new_desc').value = item.description; 
        if (item.type === 'hospital') { document.getElementById('new_emergency').value = item.emergencyphone || ''; document.getElementById('new_floors').value = item.floors || ''; document.getElementById('new_extra').value = item.departments || ''; } 
        else if (item.type === 'doctor') { document.getElementById('new_consult_hours').value = item.consulthours || ''; document.getElementById('new_extra').value = item.bookingnotes || ''; } 
        else if (item.type === 'pharmacy') { document.getElementById('new_night_details').value = item.nightdetails || ''; document.getElementById('new_extra').value = item.description || ''; } 
        else if (item.type === 'center') { document.getElementById('new_floors').value = item.floors || ''; document.getElementById('new_extra').value = item.services || ''; } 
        else if (item.type === 'lab') { document.getElementById('new_extra').value = item.tests || ''; document.getElementById('new_home_sample').value = item.homesample || 'لا'; } 
        else if (item.type === 'clinic') { document.getElementById('new_extra').value = item.description || ''; }
        if(document.getElementById('new_latlng')) document.getElementById('new_latlng').value = item.latlng || '';
    }, 100);
    document.getElementById('new_image_url').value = item.image || ''; document.getElementById('formTitle').textContent = `تعديل: ${item.name}`; window.scrollTo({ top: 0, behavior: 'smooth' }); 
}
window.deleteFacility = async (id) => { 
    if (!confirm("متأكد من الحذف؟")) return; 
    try { await supabase.from('listings').delete().eq('id', id); localStorage.setItem('force_listings_update', 'true'); showToast('تم الحذف'); } catch (e) { showToast('خطأ'); } 
}
window.saveFacility = async (e) => { 
    e.preventDefault(); 
    const id = document.getElementById('edit_id').value; const type = document.getElementById('new_type').value; const name = document.getElementById('new_name').value; const specialty = document.getElementById('new_specialty').value; const address = document.getElementById('new_address').value; const phone = document.getElementById('new_phone').value; const hours = document.getElementById('new_hours').value; const desc = document.getElementById('new_desc').value; const imgURL = document.getElementById('new_image_url').value.trim(); 
    let data = { type, name, phone, hours, description: desc, rating: 4.0 }; 
    if(document.getElementById('new_latlng')) data.latlng = document.getElementById('new_latlng').value.trim();
    if (imgURL) data.image = imgURL; 
    if (!id && (type === 'doctor' || type === 'clinic')) { data.bookingpass = generateUniqueId(); } 
    if (!id && type === 'pharmacy') { data.pharmacypass = generateUniqueId(); } 
    
    if (type === 'hospital') { data.specialty = specialty; data.address = address; data.emergencyphone = document.getElementById('new_emergency')?.value || ''; data.floors = document.getElementById('new_floors')?.value || ''; data.departments = document.getElementById('new_extra')?.value || ''; } 
    else if (type === 'doctor') { data.specialty = specialty; data.clinic = address; data.consulthours = document.getElementById('new_consult_hours')?.value || ''; data.bookingnotes = document.getElementById('new_extra')?.value || ''; } 
    else if (type === 'pharmacy') { data.address = address; data.night = false; data.nightdetails = document.getElementById('new_night_details')?.value || ''; data.description = document.getElementById('new_extra')?.value || ''; } 
    else if (type === 'clinic') { data.specialty = specialty; data.address = address; data.description = document.getElementById('new_extra')?.value || ''; } 
    else if (type === 'center') { data.specialty = specialty; data.address = address; data.floors = document.getElementById('new_floors')?.value || ''; data.services = document.getElementById('new_extra')?.value || ''; } 
    else if (type === 'lab') { data.specialty = specialty; data.address = address; data.tests = document.getElementById('new_extra')?.value || ''; data.homesample = document.getElementById('new_home_sample')?.value || 'لا'; } 
    
    try { 
        if (id) { await supabase.from('listings').update(data).eq('id', id); showToast('تم التعديل!'); } 
        else { if (!data.image) data.image = `https://picsum.photos/seed/new${Date.now()}/400/250`; await supabase.from('listings').insert([data]); showToast('تمت الإضافة!'); } 
        localStorage.setItem('force_listings_update', 'true');
        document.querySelector('form').reset(); document.getElementById('edit_id').value = ''; document.getElementById('formTitle').textContent = 'إضافة منشأة'; 
    } catch (err) { showToast('خطأ في الحفظ'); }
};

// === الملف الصحي ===
window.openHealthFile = async () => {
    if (currentHealthFileId) {
        const { data: docSnap } = await supabase.from('health_files').select('*').eq('id', currentHealthFileId).single();
        if (docSnap) { renderHealthDashboard(docSnap); return; }
    }
    openCtrlPanel('الملف الصحي الذكي', `
        <div class="flex flex-col gap-4 max-w-md mx-auto w-full">
            <div class="bg-pink-50 border border-pink-200 rounded-xl p-4 text-pink-800 text-sm flex items-center gap-3">
                <i class="fas fa-shield-heart text-xl"></i>
                <span>ملفك الطبي الخاص، محمي بكلمة مرور. يمكنك توليد رمز QR ليقرأه الطبيب مباشرة دون كلمة مرور في حالات الطوارئ!</span>
            </div>
            <div class="flex gap-2 bg-gray-100 p-1 rounded-xl">
                <button onclick="switchHealthTab('login')" id="tabLoginBtn" class="flex-1 py-2 rounded-lg text-sm font-bold bg-white shadow">تسجيل الدخول</button>
                <button onclick="switchHealthTab('register')" id="tabRegBtn" class="flex-1 py-2 rounded-lg text-sm font-bold text-gray-500">حساب جديد</button>
            </div>
            <form id="loginForm" onsubmit="handleHealthLogin(event)" class="flex flex-col gap-3">
                <input type="text" id="loginUsername" class="ctrl-input" placeholder="اسم المستخدم" required>
                <input type="password" id="loginPassword" class="ctrl-input" placeholder="كلمة المرور" required>
                <button type="submit" class="w-full py-3 rounded-xl text-white font-bold text-sm" style="background: #EC4899">دخول</button>
            </form>
            <form id="registerForm" onsubmit="handleHealthRegister(event)" class="hidden flex-col gap-3">
                <input type="text" id="regFullName" class="ctrl-input" placeholder="الاسم الكامل" required>
                <input type="text" id="regUsername" class="ctrl-input" placeholder="اختر اسم مستخدم" required>
                <input type="password" id="regPassword" class="ctrl-input" placeholder="اختر كلمة مرور" required>
                <button type="submit" class="w-full py-3 rounded-xl text-white font-bold text-sm" style="background: #EC4899">إنشاء الملف</button>
            </form>
        </div>
    `, '#EC4899');
}

window.switchHealthTab = (tab) => {
    const loginForm = document.getElementById('loginForm'); const regForm = document.getElementById('registerForm'); const loginBtn = document.getElementById('tabLoginBtn'); const regBtn = document.getElementById('tabRegBtn');
    if (tab === 'login') { loginForm.classList.remove('hidden'); loginForm.classList.add('flex'); regForm.classList.add('hidden'); regForm.classList.remove('flex'); loginBtn.classList.add('bg-white', 'shadow'); loginBtn.classList.remove('text-gray-500'); regBtn.classList.remove('bg-white', 'shadow'); regBtn.classList.add('text-gray-500'); } 
    else { regForm.classList.remove('hidden'); regForm.classList.add('flex'); loginForm.classList.add('hidden'); loginForm.classList.remove('flex'); regBtn.classList.add('bg-white', 'shadow'); regBtn.classList.remove('text-gray-500'); loginBtn.classList.remove('bg-white', 'shadow'); loginBtn.classList.add('text-gray-500'); }
}
window.handleHealthRegister = async (e) => {
    e.preventDefault();
    const username = document.getElementById('regUsername').value.trim();
    const { data: existing } = await supabase.from('health_files').select('id').eq('username', username);
    if (existing && existing.length > 0) { showToast('اسم المستخدم محجوز'); return; }
    const fullName = document.getElementById('regFullName').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    const { data, error } = await supabase.from('health_files').insert([{ username, password, full_name: fullName }]).select();
    if (error) { showToast('خطأ في الإنشاء'); return; }
    localStorage.setItem('healthFileId', data[0].id);
    currentHealthFileId = data[0].id;
    renderHealthDashboard(data[0]);
}
window.handleHealthLogin = async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const { data: snap } = await supabase.from('health_files').select('*').eq('username', username).eq('password', password);
    if (!snap || snap.length === 0) { showToast('بيانات الدخول غير صحيحة'); return; }
    localStorage.setItem('healthFileId', snap[0].id);
    currentHealthFileId = snap[0].id;
    renderHealthDashboard(snap[0]);
}
window.renderHealthDashboard = (data) => {
    openCtrlPanel(`الملف الصحي: ${data.full_name || data.fullName}`, `
        <div class="flex flex-col gap-5">
            <div class="bg-white p-6 rounded-2xl border-2 flex flex-col items-center" style="border-color: #EC4899;">
                <div class="text-sm font-bold text-pink-500 mb-3">رمز الطوارئ الطبي (QR)</div>
                <div id="qrcode" class="bg-white p-3 rounded-xl border" style="border-color: var(--border)"></div>
                <p class="text-xs text-gray-500 mt-3 text-center">وجه الطبيب لمسح هذا الرمز للوصول لملفك فوراً دون كلمة مرور</p>
            </div>
            <form onsubmit="saveHealthProfile(event)" class="bg-white p-5 rounded-xl border grid grid-cols-1 sm:grid-cols-2 gap-3" style="border-color: var(--border)">
                <div class="col-span-1 sm:col-span-2"><label class="text-xs font-bold text-gray-500">الاسم الكامل</label><input type="text" id="hfFullName" class="ctrl-input" value="${data.full_name || data.fullName || ''}" required></div>
                <div><label class="text-xs font-bold text-gray-500">العمر</label><input type="number" id="hfAge" class="ctrl-input" value="${data.age || ''}"></div>
                <div><label class="text-xs font-bold text-gray-500">الجنس</label><select id="hfGender" class="ctrl-input"><option value="ذكر" ${data.gender === 'ذكر' ? 'selected' : ''}>ذكر</option><option value="أنثى" ${data.gender === 'أنثى' ? 'selected' : ''}>أنثى</option></select></div>
                <div><label class="text-xs font-bold text-gray-500">فصيلة الدم</label><select id="hfBloodType" class="ctrl-input">${["A+","A-","B+","B-","AB+","AB-","O+","O-","غير معروف"].map(t => `<option value="${t}" ${data.blood_type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
                <div><label class="text-xs font-bold text-gray-500">الوزن (كغ)</label><input type="text" id="hfWeight" class="ctrl-input" value="${data.weight || ''}"></div>
                <div class="col-span-1 sm:col-span-2"><label class="text-xs font-bold text-gray-500">الأمراض المزمنة</label><input type="text" id="hfDiseases" class="ctrl-input" value="${data.diseases || ''}" placeholder="مثال: سكري، ضغط"></div>
                <div class="col-span-1 sm:col-span-2"><label class="text-xs font-bold text-gray-500">الحساسية (دوائية/غذائية)</label><input type="text" id="hfAllergies" class="ctrl-input" value="${data.allergies || ''}" placeholder="مثال: بنسلين، مكسرات"></div>
                <div class="col-span-1 sm:col-span-2"><label class="text-xs font-bold text-gray-500">الأدوية الحالية</label><input type="text" id="hfMedications" class="ctrl-input" value="${data.medications || ''}"></div>
                
                <!-- سجل الأسنان -->
                <div class="col-span-1 sm:col-span-2 mt-2 p-3 rounded-xl border" style="border-color: #FED7AA; background: #FFF7ED;">
                    <label class="text-xs font-bold text-orange-700 flex items-center gap-1"><i class="fas fa-tooth"></i> سجل الأسنان (يُقرأ فقط من قبل طبيب الأسنان)</label>
                    <textarea id="hfDental" class="ctrl-input mt-2" rows="2" placeholder="عمليات سابقة، تقويم، حساسية معينة...">${data.dental || ''}</textarea>
                </div>

                <!-- سجل العيون -->
                <div class="col-span-1 sm:col-span-2 p-3 rounded-xl border" style="border-color: #BFDBFE; background: #EFF6FF;">
                    <label class="text-xs font-bold text-blue-700 flex items-center gap-1"><i class="fas fa-eye"></i> سجل العيون (يُقرأ فقط من قبل طبيب العيون)</label>
                    <textarea id="hfEye" class="ctrl-input mt-2" rows="2" placeholder="وصفة النظارة، ضغط العين، عمليات ليزك...">${data.eye || ''}</textarea>
                </div>

                <div><label class="text-xs font-bold text-gray-500">اسم جهة الطوارئ</label><input type="text" id="hfEmergencyName" class="ctrl-input" value="${data.emergency_name || ''}"></div>
                <div><label class="text-xs font-bold text-gray-500">هاتف جهة الطوارئ</label><input type="tel" id="hfEmergencyPhone" class="ctrl-input" value="${data.emergency_phone || ''}"></div>
                <button type="submit" class="col-span-1 sm:col-span-2 py-3 rounded-xl text-white font-bold text-sm" style="background: #EC4899"><i class="fas fa-save ml-2"></i> حفظ التحديثات</button>
            </form>
            <div class="bg-white p-5 rounded-xl border" style="border-color: var(--border)">
                <h4 class="font-bold mb-4 text-sm flex items-center gap-2"><i class="fas fa-file-medical text-blue-600"></i> روشتي الطبية السابقة</h4>
                <div class="flex flex-col gap-4 mt-2">
                    ${data.prescriptions && data.prescriptions.length > 0 ? 
                        data.prescriptions.slice().reverse().map(rx => `
                            <div class="bg-gradient-to-br from-white to-blue-50/40 p-5 rounded-2xl border-2 border-dashed border-blue-300 relative shadow-sm">
                                <button onclick="deletePrescription('${rx.date}')" class="absolute top-3 left-3 w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center shadow-sm" title="حذف الروشتة">
                                    <i class="fas fa-trash-alt text-xs"></i>
                                </button>
                                <div class="flex justify-between items-center mb-4 pb-3 border-b border-blue-200">
                                    <div class="flex items-center gap-2">
                                        <div class="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><i class="fas fa-user-md"></i></div>
                                        <div>
                                            <div class="font-bold text-blue-800 text-sm">د. ${rx.doctor || 'طبيب'}</div>
                                            <div class="text-[10px] text-gray-500">${new Date(rx.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                                        </div>
                                    </div>
                                    <i class="fas fa-prescription-bottle-medical text-2xl text-blue-200"></i>
                                </div>
                                <div class="whitespace-pre-line font-sans text-gray-800 text-sm leading-loose" style="white-space: pre-wrap;">${rx.text}</div>
                                <div class="mt-4 pt-4 border-t-2 border-double border-blue-300 flex justify-between items-end">
    <div class="flex flex-col gap-0.5">
        <span class="font-bold text-sm text-blue-900" style="font-family: 'Noto Kufi Arabic'">${rx.doctor || 'طبيب'}</span>
        <span class="text-[10px] text-gray-500">${rx.specialty || 'طبيب عام'}</span>
        <span class="text-[10px] text-gray-400">${new Date(rx.date).toLocaleString('ar-EG', { date: 'short', time: 'short' })}</span>
    </div>
    <div class="flex flex-col items-end gap-1">
        <span class="bg-green-100 text-green-700 text-[9px] font-bold px-2 py-1 rounded-full flex items-center gap-1 border border-green-200">
            <i class="fas fa-shield-halved"></i> موثقة إلكترونياً
        </span>
        <span class="text-[9px] text-gray-400 font-mono" dir="ltr">VRX: ${rx.verCode || 'N/A'}</span>
    </div>
</div>
     `).join('') 
      : '<div class="text-center py-8 text-gray-400 text-sm flex flex-col items-center gap-2"><i class="fas fa-file-prescription text-4xl text-gray-200 mb-2"></i>لا توجد روشتات طبية محفوظة حالياً.</div>'}
                </div>
            </div>
            <!-- زر تسجيل الخروج -->
            <button onclick="logoutHealthFile()" class="w-full py-3 rounded-xl border font-bold text-sm mt-4" style="border-color: #EC4899; color: #EC4899;">
                <i class="fas fa-sign-out-alt ml-2"></i> تسجيل الخروج من الملف الصحي
            </button>
        </div>
    `, '#EC4899');
    const qrContainer = document.getElementById('qrcode');
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, { text: currentHealthFileId, width: 180, height: 180, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H });
}

window.saveHealthProfile = async (e) => {
    e.preventDefault();
    const data = {
        full_name: document.getElementById('hfFullName').value, age: document.getElementById('hfAge').value,
        gender: document.getElementById('hfGender').value, blood_type: document.getElementById('hfBloodType').value,
        weight: document.getElementById('hfWeight').value, diseases: document.getElementById('hfDiseases').value,
        allergies: document.getElementById('hfAllergies').value, medications: document.getElementById('hfMedications').value,
        dental: document.getElementById('hfDental').value, eye: document.getElementById('hfEye').value,
        emergency_name: document.getElementById('hfEmergencyName').value, emergency_phone: document.getElementById('hfEmergencyPhone').value
    };
    try { await supabase.from('health_files').update(data).eq('id', currentHealthFileId); showToast('تم الحفظ!'); renderHealthDashboard(data); } catch (err) { showToast('خطأ'); }
}
window.logoutHealthFile = () => { localStorage.removeItem('healthFileId'); currentHealthFileId = null; closeCtrlPanel(); showToast('تم الخروج'); }

// === الإحصائيات ===
async function trackAndDisplayVisitors() {
    const cachedVisitors = localStorage.getItem('cached_visitors') || '0';
    const cachedViews = localStorage.getItem('cached_views') || '0';
    const lastFetch = parseInt(localStorage.getItem('stats_last_fetch') || '0');
    const oneHour = 60 * 60 * 1000;
    animateCounter(parseInt(cachedVisitors), 'visitorCount');
    animateCounter(parseInt(cachedViews), 'viewsCount');

    try {
        // Increment views
        const { data: vData } = await supabase.from('site_stats').select('count').eq('id', 'views_metrics').single();
        const newViews = (vData?.count || 0) + 1;
        await supabase.from('site_stats').upsert({ id: 'views_metrics', count: newViews });

        // Increment visitors if new session
        const isNewSession = !sessionStorage.getItem('hasVisitedRaheba');
        if (isNewSession) {
            const { data: visData } = await supabase.from('site_stats').select('count').eq('id', 'visitor_metrics').single();
            const newVisitors = (visData?.count || 0) + 1;
            await supabase.from('site_stats').upsert({ id: 'visitor_metrics', count: newVisitors });
            sessionStorage.setItem('hasVisitedRaheba', 'true');
        }

        if (Date.now() - lastFetch > oneHour) {
            const { data: visSnap } = await supabase.from('site_stats').select('count').eq('id', 'visitor_metrics').single();
            const { data: viewsSnap } = await supabase.from('site_stats').select('count').eq('id', 'views_metrics').single();
            const realVisitors = visSnap?.count || 0;
            const realViews = viewsSnap?.count || 0;
            localStorage.setItem('cached_visitors', realVisitors.toString());
            localStorage.setItem('cached_views', realViews.toString());
            localStorage.setItem('stats_last_fetch', Date.now().toString());
            animateCounter(realVisitors, 'visitorCount');
            animateCounter(realViews, 'viewsCount');
        }
    } catch (error) { console.error("Error tracking visitors:", error); }
}
function animateCounter(target, elementId) {
    const el = document.getElementById(elementId); if (!el) return;
    let current = 0; const duration = 2000; const stepTime = 30; const steps = duration / stepTime; const inc = Math.max(1, Math.floor(target / steps));
    const timer = setInterval(() => { current += inc; if (current >= target) { current = target; clearInterval(timer); } el.innerText = current.toLocaleString('ar-EG'); }, stepTime);
}

// === الإعلانات (Slider) ===
window.renderAdSlide = (index) => {
    const container = document.getElementById('homeAdContainer'); const dotsContainer = document.getElementById('adDots');
    if (!container || activeAds.length === 0) return;
    const ad = activeAds[index]; let mediaHTML = '';
    if (adInterval) { clearTimeout(adInterval); clearInterval(adInterval); adInterval = null; }
    const isSingleAd = activeAds.length === 1;
    if (ad.type === 'image') {
        mediaHTML = `<a href="${ad.link || '#'}" target="_blank" class="block w-full h-full"><img src="${ad.content}" alt="إعلان" class="w-full h-full object-cover"></a>`;
        if (!isSingleAd) adInterval = setTimeout(nextAdSlide, 6000);
    } else if (ad.type === 'video') {
        const loopAttr = isSingleAd ? 'loop' : ''; const endedAttr = isSingleAd ? '' : 'onended="nextAdSlide()"';
        mediaHTML = `<div class="relative w-full h-full bg-black"><video id="homeAdVideo" autoplay muted playsinline ${loopAttr} ${endedAttr} onerror="nextAdSlide()" class="w-full h-full object-cover"><source src="${ad.content}" type="video/mp4"></video></div>`;
        if (!isSingleAd) adInterval = setTimeout(nextAdSlide, 30000);
    }
    container.innerHTML = `<div class="w-full h-full">${mediaHTML}</div>`;
    if (dotsContainer) { if (isSingleAd) dotsContainer.innerHTML = ''; else dotsContainer.innerHTML = activeAds.map((_, i) => `<span class="w-2 h-2 rounded-full bg-white/50 cursor-pointer ${i === index ? 'w-6 bg-white' : ''}" onclick="goToAdSlide(${i})"></span>`).join(''); }
}
window.nextAdSlide = () => { if (activeAds.length === 0) return; currentAdIndex = (currentAdIndex + 1) % activeAds.length; renderAdSlide(currentAdIndex); }
window.prevAdSlide = () => { if (activeAds.length === 0) return; currentAdIndex = (currentAdIndex - 1 + activeAds.length) % activeAds.length; renderAdSlide(currentAdIndex); }
window.goToAdSlide = (index) => { currentAdIndex = index; renderAdSlide(currentAdIndex); }
window.saveHomeAd = async (e) => {
    e.preventDefault(); const type = document.getElementById('adType').value; const content = document.getElementById('adContent').value.trim(); const link = document.getElementById('adLink').value.trim();
    if (!content) { showToast('الرجاء إدخال رابط'); return; }
    try { await supabase.from('homepage_ads').insert([{ type, content, link, is_active: true }]); await supabase.from('app_config').upsert({ id: 'ads_sync', last_update: Date.now() }); showToast('تم الحفظ!'); e.target.reset(); fetchHomeAdsForAdmin(); } catch (err) { showToast('خطأ'); }
};
window.toggleHomeAdStatus = async (id, status) => { try { await supabase.from('homepage_ads').update({ is_active: status }).eq('id', id); await supabase.from('app_config').upsert({ id: 'ads_sync', last_update: Date.now() }); showToast('تم التحديث'); fetchHomeAdsForAdmin(); } catch (err) { showToast('خطأ'); } };
window.deleteHomeAd = async (id) => { try { await supabase.from('homepage_ads').delete().eq('id', id); await supabase.from('app_config').upsert({ id: 'ads_sync', last_update: Date.now() }); showToast('تم الحذف'); fetchHomeAdsForAdmin(); } catch (err) { showToast('خطأ'); } };
async function fetchHomeAdsForAdmin() {
    const { data } = await supabase.from('homepage_ads').select('*');
    allHomeAds = data || [];
    const list = document.getElementById('adminHomeAdsList'); if (!list) return;
    if (allHomeAds.length === 0) { list.innerHTML = '<p class="text-center text-gray-400 text-sm">لا توجد إعلانات.</p>'; return; }
    list.innerHTML = allHomeAds.map(ad => `<div class="flex items-center justify-between p-2 rounded-lg border"><div class="text-xs truncate flex-1 flex items-center gap-2"><i class="fas ${ad.type === 'image' ? 'fa-image text-blue-500' : 'fa-video text-purple-500'}"></i><span class="truncate">${ad.content.substring(0, 30)}...</span></div><div class="flex gap-1 mr-2"><button onclick="toggleHomeAdStatus('${ad.id}', ${!ad.is_active})" class="px-2 py-1 rounded text-xs ${ad.is_active ? 'bg-green-500 text-white' : 'bg-gray-200'}">${ad.is_active ? 'مفعّل' : 'معطّل'}</button><button onclick="deleteHomeAd('${ad.id}')" class="px-2 py-1 rounded text-xs bg-red-500 text-white"><i class="fas fa-trash"></i></button></div></div>`).join('');
}
async function fetchHomeAdsPublic() {
    const cachedAds = localStorage.getItem('cached_home_ads');
    if (cachedAds) {
        activeAds = JSON.parse(cachedAds);
        const section = document.getElementById('homeMediaAdsSection');
        if (activeAds.length === 0) section.classList.add('hidden');
        else { section.classList.remove('hidden'); currentAdIndex = 0; renderAdSlide(currentAdIndex); }
    }
    const { data: configSnap } = await supabase.from('app_config').select('last_update').eq('id', 'ads_sync').single();
    let serverTime = configSnap?.last_update || 0;
    if (serverTime === 0) { await supabase.from('app_config').upsert({ id: 'ads_sync', last_update: Date.now() }); serverTime = Date.now(); }
    const localTime = parseInt(localStorage.getItem('ads_last_fetch') || '0');
    if (serverTime > localTime) {
        const { data: snap } = await supabase.from('homepage_ads').select('*').eq('is_active', true).limit(5);
        activeAds = snap || [];
        const section = document.getElementById('homeMediaAdsSection');
        if (activeAds.length === 0) { section.classList.add('hidden'); if (adInterval) clearInterval(adInterval); } 
        else { section.classList.remove('hidden'); currentAdIndex = 0; renderAdSlide(currentAdIndex); }
        try { localStorage.setItem('cached_home_ads', JSON.stringify(activeAds)); localStorage.setItem('ads_last_fetch', serverTime.toString()); } catch(e) {}
    }
}
// استدعاء جلب الإعلانات عند تحميل الصفحة
fetchHomeAdsPublic();
fetchAnnouncements();

// === Service Worker ===
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(reg => {
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) { newWorker.postMessage({ type: 'SKIP_WAITING' }); }
                });
            });
        }).catch(err => console.error('SW registration failed:', err));
    });
    let refreshing;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (refreshing) return; window.location.reload(); refreshing = true; });
}

// تنتهي هنا الجزء الرابع...
        // === الجزء الخامس: الأدوات الطبية والرادار واسأل طبيب (الجزء الأخير الكامل) ===

window.openBurnCalculator = () => {
    burnState = { cause: null, degree: null, area: null };
    openCtrlPanel('مُسعف الحروق الذكي', `
        <div class="flex flex-col gap-5">
            <div class="bg-orange-50 border border-orange-200 rounded-xl p-4 text-orange-800 text-sm flex items-center gap-3">
                <i class="fas fa-fire-extinguisher text-xl"></i>
                <span>أجب عن الأسئلة التالية بدقة للحصول على إرشادات الإسعاف الأولى الصحيحة لحالة الحرق.</span>
            </div>
            <div id="burnCalcContent" class="bg-white p-6 rounded-2xl border" style="border-color: var(--border)"></div>
        </div>
    `, '#F97316');
    window.renderBurnStep();
}

window.renderBurnStep = () => {
    const content = document.getElementById('burnCalcContent');
    if (!content) return;

    if (!burnState.cause) {
        content.innerHTML = `
            <h4 class="font-bold text-sm mb-4 text-center">ما هو سبب الحرق؟</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div onclick="window.selectBurnOption('cause', 'thermal')" class="burn-option"><i class="fas fa-fire text-2xl mb-2 text-orange-500"></i><br>حرق حراري (نار، سائل ساخن، معدن)</div>
                <div onclick="window.selectBurnOption('cause', 'chemical')" class="burn-option"><i class="fas fa-flask text-2xl mb-2 text-blue-500"></i><br>حرق كيميائي (مواد تنظيف، أحماض)</div>
                <div onclick="window.selectBurnOption('cause', 'electrical')" class="burn-option"><i class="fas fa-bolt text-2xl mb-2 text-yellow-500"></i><br>حرق كهربائي (تيار كهربائي)</div>
                <div onclick="window.selectBurnOption('cause', 'sun')" class="burn-option"><i class="fas fa-sun text-2xl mb-2 text-red-500"></i><br>حروق الشمس</div>
            </div>
        `;
    } else if (!burnState.degree) {
        content.innerHTML = `
            <h4 class="font-bold text-sm mb-4 text-center">ما هو عمق الحرق؟</h4>
            <div class="grid grid-cols-1 gap-3">
                <div onclick="window.selectBurnOption('degree', '1st')" class="burn-option"><i class="fas fa-layer-group text-xl mb-1 text-red-400"></i><br>درجة أولى (ألم واحمرار، لا فقاعات - مثل حرق الشمس الخفيف)</div>
                <div onclick="window.selectBurnOption('degree', '2nd')" class="burn-option"><i class="fas fa-layer-group text-xl mb-1 text-red-500"></i><br>درجة ثانية (ألم شديد، احمرار، وتكون فقاعات مملوءة بسائل)</div>
                <div onclick="window.selectBurnOption('degree', '3rd')" class="burn-option"><i class="fas fa-layer-group text-xl mb-1 text-gray-600"></i><br>درجة ثالثة (جلد متفحم، أبيض أو أسود، قد لا يكون هناك ألم لتلف الأعصاب)</div>
            </div>
        `;
    } else if (!burnState.area) {
        content.innerHTML = `
            <h4 class="font-bold text-sm mb-4 text-center">ما هي مساحة الحرق؟</h4>
            <div class="grid grid-cols-1 gap-3">
                <div onclick="window.selectBurnOption('area', 'small')" class="burn-option"><i class="fas fa-hand-paper text-xl mb-1 text-green-500"></i><br>صغيرة (أصغر من كف اليد المصاب)</div>
                <div onclick="window.selectBurnOption('area', 'large')" class="burn-option"><i class="fas fa-fire text-xl mb-1 text-orange-500"></i><br>كبيرة (أكبر من كف اليد)</div>
                <div onclick="window.selectBurnOption('area', 'sensitive')" class="burn-option"><i class="fas fa-face-dizzy text-xl mb-1 text-red-500"></i><br>في منطقة حساسة (الوجه، العنق، الأعضاء التناسلية، المفاصل)</div>
            </div>
        `;
    } else {
        let advice = ""; let emergency = false;
        if (burnState.cause === 'chemical') {
            advice = "1. ارتدِ قفازات واقية فوراً.\n2. اغسل المنطقة بكميات كبيرة من الماء الفاتر الجاري لمدة 20 دقيقة على الأقل.\n3. اخلع الملابس الملوثة بحذر أثناء الغسل.\n4. لا تحاول معادلة المادة الكيميائية.\n5. غطِ الحرق بقطعة قماش نظيفة جافة.";
            emergency = true;
        } else if (burnState.cause === 'electrical') {
            advice = "1. افصل التيار الكهربائي فوراً قبل لمس المصاب.\n2. لا تلمس المصاب بيديك العاريتين.\n3. تحقق من تنفسه ونبضه، إذا توقف ابدأ الإنعاش القلبي الرئوي (CPR).\n4. عالج الحروق الخارجية بكمادات ماء بارد (ليس ثلج).";
            emergency = true;
        } else {
            if (burnState.area === 'sensitive' || burnState.area === 'large' || burnState.degree === '3rd') {
                advice = "1. ضع المنطقة تحت ماء جارٍ بارد (ليس مثلجاً) لمدة 15-20 دقيقة لتبريد الحرق.\n2. اخلع الملابس أو الإكسسوارات المحيطة بلطف (إن لم تكن ملتصقة بالجلد).\n3. غطِ الحرق بضمادة معقمة أو قطعة قماش نظيفة وجافة.\n4. لا تضع معجون أسنان، زيت، أو ثلج على الحرق.\n5. لا تفتح الفقاعات إن وجدت.";
                emergency = true;
            } else if (burnState.degree === '2nd') {
                advice = "1. ضع المنطقة تحت ماء جارٍ بارد لمدة 15 دقيقة.\n2. غطِ الحرق بضمادة معقمة جافة.\n3. لا تفتح الفقاعات أبداً.\n4. يمكنك إعطاء مسكن للألم (باراسيتامول).";
            } else { 
                advice = "1. ضع المنطقة تحت ماء بارد الجري لمدة 10-15 دقيقة.\n2. لتخفيف الألم، يمكن استخدام كريم مرطب لطيف (مثل الفازلين الطبي) بعد تبريد الحرق.\n3. تجنب تعرض المنطقة للشمس لعدة أيام.\n4. شرب كميات كبيرة من الماء إذا كان الحرق من الشمس وحروق الجسم واسعة.";
            }
        }
        const emergencyBox = emergency ? `
            <div class="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 text-sm flex items-start gap-3 mt-4">
                <i class="fas fa-ambulance text-xl mt-1"></i>
                <div><b>تحذير طبي:</b> هذه الحالة تتطلب مراجعة الطوارئ فوراً بعد الإسعاف الأولي. لا تتأخر في طلب الإسعاف (110) أو التوجه لأقرب مشفى.</div>
            </div>
        ` : "";
        content.innerHTML = `
            <div class="text-center mb-4">
                <div class="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-2"><i class="fas fa-check text-3xl text-green-600"></i></div>
                <h4 class="font-bold text-lg text-gray-800">إرشادات الإسعاف الأولى</h4>
            </div>
            <div class="bg-gray-50 p-4 rounded-xl text-sm text-gray-700 leading-relaxed whitespace-pre-line flex items-start gap-2">
                <i class="fas fa-notes-medical text-orange-500 mt-1"></i>
                <span>${advice}</span>
            </div>
            ${emergencyBox}
            <button onclick="openBurnCalculator()" class="w-full mt-4 py-3 rounded-xl text-white font-bold text-sm" style="background: #F97316;">
                <i class="fas fa-rotate-right ml-2"></i> تقييم حالة أخرى
            </button>
        `;
    }
}
window.selectBurnOption = (key, value) => { burnState[key] = value; window.renderBurnStep(); }

// 3. Seasonal Diseases Guide
const seasonalDiseases = [
    { name: "التهاب الأمعاء الحاد / التسمم الغذائي", season: "الصيف", icon: "fa-temperature-high", color: "#F59E0B", cause: "ينتشر بكثرة بسبب موجات الحر، وتأثر سلامة المياه أحياناً، أو الأطعمة والمقبلات المكشوفة.", tip: "تجنب الأطعمة المكشوفة والتركيز على غسل الأيدي جيداً قبل تحضير الطعام وبعد استخدام المرحاض." },
    { name: "اللاشمانيا (حبة حلب / حبة السنة)", season: "الخريف والشتاء", icon: "fa-bug", color: "#D97706", cause: "تُعد من الأمراض الجلدية المتوطنة والمشهورة في مناطق ريف دمشق والمناطق شبه الصحراوية والقلمون، تنتقل بلدغات ذبابة الرمل في الصيف.", tip: "استخدام شبكات الناموسيات (المنخل) على النوافذ، وتجنب السير ليلاً في الأماكن شبه الصحراوية دون ملابس طويلة." },
    { name: "الإنفلونزا والتهاب البلعوم", season: "الخريف والشتاء", icon: "fa-virus", color: "#3B82F6", cause: "منطقة القلمون والرحيبة معروفة ببردها الجاف والشديد في الشتاء، مما يسبب موجات إنفلونزا حادة تصيب عائلات كاملة.", tip: "الراحة التامة، شرب السوائل الدافئة (المتة، الشاي، زهورات)، وتدفئة الجسم جيداً." },
    { name: "حساسية الربيع والجيوب الأنفية", season: "الربيع", icon: "fa-wind", color: "#10B981", cause: "بسبب طبيعة المنطقة الجغرافية والغبار والرياح الخمسينية، يعاني جزء كبير من السكان من نوبات الربو وحساسية الصدر والعيون.", tip: "إغلاق النوافذ جيداً في الأيام المغبرة وارتداء الكمامة عند الخروج." },
    { name: "جدري الماء (الحميقاء)", season: "أواخر الشتاء وبداية الربيع", icon: "fa-allergies", color: "#8B5CF6", cause: "مرض شديد العدوى وينتشر بسرعة بين طلاب المدارس والأطفال في الأحياء.", tip: "الامتناع التام عن استخدام البروفين والأسبرين للأطفال، تجنب الحك تماماً، وقص الأظافر لتجنب التهاب الجلد." }
];
window.openSeasonalDiseases = () => {
    const cardsHtml = seasonalDiseases.map(d => `
        <div class="disease-card">
            <div class="disease-header" style="background: ${d.color};">
                <i class="fas ${d.icon} text-2xl text-white"></i>
                <div>
                    <h4 class="font-bold text-white text-sm" style="font-family: 'Noto Kufi Arabic'">${d.name}</h4>
                    <div class="text-xs text-white/80">موسم الذروة: ${d.season}</div>
                </div>
            </div>
            <div class="disease-body">
                <div class="disease-section">
                    <div class="text-xs font-bold text-gray-500 mb-1">السبب المحلي:</div>
                    <div class="text-sm text-gray-700 leading-relaxed">${d.cause}</div>
                </div>
                <div class="disease-section">
                    <div class="text-xs font-bold mb-1" style="color: ${d.color};"><i class="fas fa-star ml-1"></i> نصيحة ذهبية:</div>
                    <div class="text-sm text-gray-700 leading-relaxed">${d.tip}</div>
                </div>
            </div>
        </div>
    `).join('');
    openCtrlPanel('دليل أمراض الرحيبة الموسمية', `<div class="flex flex-col gap-5"><div class="bg-purple-50 border border-purple-200 rounded-xl p-4 text-purple-800 text-sm flex items-center gap-3"><i class="fas fa-virus-covid text-xl"></i><span>دليل توعوي بأبرز الأمراض المنتشرة في منطقة الرحيبة والقلمون موسمياً، مع نصائح وقائية محلية.</span></div><div class="grid grid-cols-1 sm:grid-cols-2 gap-4">${cardsHtml}</div></div>`, '#8B5CF6');
}

// 4. Pregnancy Calculator
const pregnancyData = [
    { week: 4, length: "0.4 سم", weight: "< 1 غ", icon: "🌱", dev: "يبدأ القلب والدماغ بالنمو" },
    { week: 8, length: "1.6 سم", weight: "1 غ", icon: "🟢", dev: "بدأت الأطراف بالتشكل" },
    { week: 12, length: "5.4 سم", weight: "14 غ", icon: "👶", dev: "اكتملت الأعضاء الأساسية" },
    { week: 16, length: "11.6 سم", weight: "100 غ", icon: "🧠", dev: "يمكن للجنين السمع" },
    { week: 20, length: "25.6 سم", weight: "300 غ", icon: "🤰", dev: "يبدأ الجنين بالحركة" },
    { week: 24, length: "30 سم", weight: "600 غ", icon: "✨", dev: "تتكون الرئتان" },
    { week: 28, length: "37.6 سم", weight: "1 كغ", icon: "🌙", dev: "يفتح الجنين عينيه" },
    { week: 32, length: "42.4 سم", weight: "1.7 كغ", icon: "🦴", dev: "تتصلب العظام" },
    { week: 36, length: "47.4 سم", weight: "2.6 كغ", icon: "🧸", dev: "يأخذ وضعية الولادة" },
    { week: 40, length: "51.2 سم", weight: "3.5 كغ", icon: "🎉", dev: "موعد الولادة المتوقع" }
];
window.openPregnancyCalc = () => {
    openCtrlPanel('حاسبة موعد الولادة وتطور الجنين', `
        <div class="flex flex-col gap-5">
            <div class="bg-pink-50 border border-pink-200 rounded-xl p-4 text-pink-800 text-sm flex items-center gap-3">
                <i class="fas fa-info-circle text-xl"></i>
                <span>أدخلي تاريخ أول يوم من آخر دورة شهرية لحساب موعد الولادة المتوقع ورؤية تطور الجنين.</span>
            </div>
            <div class="bg-white p-5 rounded-xl border" style="border-color: var(--border)">
                <label class="block text-sm font-semibold mb-2">تاريخ آخر دورة شهرية:</label>
                <input type="date" id="lmpDate" class="ctrl-input" required>
                <button onclick="calcPregnancy()" class="w-full mt-4 py-3 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90" style="background: #EC4899;">
                    <i class="fas fa-calculator ml-2"></i> احسبي الموعد
                </button>
            </div>
            <div id="pregResult" class="hidden flex flex-col gap-4"></div>
        </div>
    `, '#EC4899');
}
window.calcPregnancy = () => {
    const dateVal = document.getElementById('lmpDate').value;
    if (!dateVal) { showToast('الرجاء إدخال التاريخ'); return; }
    const lmpDate = new Date(dateVal);
    const today = new Date();
    const dueDate = new Date(lmpDate);
    dueDate.setDate(dueDate.getDate() + 280);
    const diffTime = Math.abs(today - lmpDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const currentWeek = Math.floor(diffDays / 7);
    if (currentWeek < 0 || currentWeek > 42) { showToast('التاريخ المدخل غير منطقي للحمل'); return; }
    const stage = pregnancyData.slice().reverse().find(p => currentWeek >= p.week) || pregnancyData[0];
    const dueStr = dueDate.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const daysLeft = Math.max(0, Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24)));
    document.getElementById('pregResult').classList.remove('hidden');
    document.getElementById('pregResult').innerHTML = `
        <div class="bg-white p-6 rounded-2xl border-2 text-center" style="border-color: #EC4899;">
            <div class="text-sm font-bold text-pink-500 mb-2">الموعد المتوقع للولادة</div>
            <div class="text-lg font-black text-gray-800 mb-4" style="font-family: 'Noto Kufi Arabic'">${dueStr}</div>
            <div class="grid grid-cols-2 gap-3 text-right">
                <div class="bg-pink-50 p-3 rounded-xl"><div class="text-xs text-pink-400">العمر الحملي الحالي</div><div class="text-xl font-bold text-pink-700">${currentWeek} أسبوع</div></div>
                <div class="bg-pink-50 p-3 rounded-xl"><div class="text-xs text-pink-400">الأيام المتبقية</div><div class="text-xl font-bold text-pink-700">${daysLeft} يوم</div></div>
            </div>
        </div>
        <div class="bg-gradient-to-br from-pink-50 to-purple-50 p-6 rounded-2xl border flex flex-col items-center text-center" style="border-color: var(--border)">
            <div class="w-24 h-24 rounded-full bg-white shadow-md flex items-center justify-center text-5xl mb-3">${stage.icon}</div>
            <div class="inline-block px-3 py-1 bg-pink-200 text-pink-800 rounded-full text-xs font-bold mb-2">الأسبوع ${stage.week}</div>
            <div class="flex justify-center gap-6 mb-4 w-full">
                <div><div class="text-xs text-gray-500">الطول</div><div class="text-lg font-black text-gray-800">${stage.length}</div></div>
                <div class="w-px bg-gray-300"></div>
                <div><div class="text-xs text-gray-500">الوزن التقريبي</div><div class="text-lg font-black text-gray-800">${stage.weight}</div></div>
            </div>
            <div class="bg-white p-3 rounded-xl shadow-sm text-sm text-gray-600 flex items-center gap-2 w-full"><i class="fas fa-heart text-pink-500"></i><span>${stage.dev}</span></div>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2.5"><div class="bg-pink-600 h-2.5 rounded-full" style="width: ${Math.min(100, (currentWeek/40)*100)}%"></div></div>
        <div class="text-center text-xs text-gray-500">${Math.min(100, Math.round((currentWeek/40)*100))}% من رحلة الحمل</div>
    `;
}

// 5. Dose Calculator
window.openDoseCalc = () => {
    openCtrlPanel('حاسبة الجرعات الذكية للأطفال', `
        <div class="flex flex-col gap-5">
            <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-800 text-sm flex items-center gap-3">
                <i class="fas fa-exclamation-triangle text-xl"></i>
                <span><b>تنبيه هام:</b> هذه الحاسبة استرشادية. لا تعطِ طفلك دوائين معاً دون استشارة طبيب. تجنب إعطاء (البروفين) للأطفال أقل من 6 أشهر.</span>
            </div>
            <div class="bg-white p-5 rounded-xl border" style="border-color: var(--border)">
                <div class="mb-4"><label class="block text-sm font-semibold mb-2">وزن الطفل (كيلوغرام):</label><input type="number" id="childWeight" class="ctrl-input" placeholder="مثال: 12 (من 3 إلى 45 كغ)" min="3" max="45" step="0.1"></div>
                <div class="mb-4"><label class="block text-sm font-semibold mb-2">نوع الدواء المتوفر لديك:</label><select id="medType" class="ctrl-input" onchange="toggleConcentration()"><option value="paracetamol">سيتامول (Paracetamol / خافض للحرارة)</option><option value="ibuprofen">بروفين (Ibuprofen / مسكن ومضاد التهاب)</option></select></div>
                <div class="mb-4" id="concDiv"><label class="block text-sm font-semibold mb-2">تركيز الشراب (مكتوب على العبوة):</label><select id="medConc" class="ctrl-input"><option value="120">سيتامول عادي (120 مغ/5 مل)</option><option value="250">سيتامول فورت (250 مغ/5 مل)</option></select></div>
                <button onclick="calcDose()" class="w-full py-3 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90" style="background: #2563EB;"><i class="fas fa-syringe ml-2"></i> احسبي الجرعة الآمنة</button>
            </div>
            <div id="doseResult" class="hidden"></div>
        </div>
    `, '#2563EB');
}
window.toggleConcentration = () => {
    const type = document.getElementById('medType').value;
    const concSelect = document.getElementById('medConc');
    if (type === 'paracetamol') { concSelect.innerHTML = `<option value="120">سيتامول عادي (120 مغ/5 مل)</option><option value="250">سيتامول فورت (250 مغ/5 مل)</option>`; } 
    else { concSelect.innerHTML = `<option value="100">بروفين شراب (100 مغ/5 مل)</option><option value="40">بروفين للأطفال (40 مغ/5 مل)</option>`; }
}
window.calcDose = () => {
    const weight = parseFloat(document.getElementById('childWeight').value);
    const type = document.getElementById('medType').value;
    const conc = parseInt(document.getElementById('medConc').value);
    if (!weight || weight <= 0) { showToast('الرجاء إدخال وزن صحيح'); return; }
    if (weight < 3) { showToast('الوزن أقل من 3 كغ! يجب استشارة الطبيب.'); return; }
    if (weight > 45) { showToast('الوزن أكبر من 45 كغ! يرجى مراجعة الطبيب.'); return; }
    let doseMg = 0, maxDoseMg = 0, frequency = "", medName = "";
    if (type === 'paracetamol') { doseMg = weight * 15; maxDoseMg = 1000; frequency = "كل 6 إلى 8 ساعات (بحد أقصى 4 جرعات في اليوم)"; medName = "سيتامول (Paracetamol)"; } 
    else { if (weight < 6) { showToast('لا يُنصح بالبروفين للأطفال أقل من 6 أشهر (أقل من 6 كغ). استخدم السيتامول واستشر الطبيب.'); return; } doseMg = weight * 10; maxDoseMg = 400; frequency = "كل 6 إلى 8 ساعات (بحد أقصى 3 جرعات في اليوم)"; medName = "بروفين (Ibuprofen)"; }
    if (doseMg > maxDoseMg) doseMg = maxDoseMg;
    const doseMl = (doseMg * 5) / conc;
    document.getElementById('doseResult').classList.remove('hidden');
    document.getElementById('doseResult').innerHTML = `
        <div class="bg-white p-6 rounded-2xl border-2 text-center" style="border-color: #2563EB;">
            <div class="text-sm font-bold text-blue-500 mb-2">تعليمات الجرعة لطفل وزنه ${weight} كغ</div>
            <div class="text-lg font-black text-gray-800 mb-4" style="font-family: 'Noto Kufi Arabic'">${medName}</div>
            <div class="bg-blue-50 p-4 rounded-xl mb-4 flex flex-col items-center justify-center">
                <div class="text-xs text-blue-400 mb-1">الكمية المعطاة في المرة الواحدة</div>
                <div class="text-4xl font-black text-blue-700">${doseMl.toFixed(1)} <span class="text-xl">مل</span></div>
                <div class="text-xs text-gray-500 mt-1">(تقريباً ${Math.round(doseMl * 20)} قطرة)</div>
            </div>
            <div class="bg-gray-50 p-3 rounded-xl text-sm text-gray-700 mb-2 text-right flex items-start gap-2"><i class="fas fa-clock text-blue-500 mt-1"></i><span><b>التكرار:</b> ${frequency}</span></div>
            <div class="bg-gray-50 p-3 rounded-xl text-sm text-gray-700 mb-4 text-right flex items-start gap-2"><i class="fas fa-syringe text-blue-500 mt-1"></i><span><b>طريقة القياس:</b> يُفضل استخدام حقنة الفم المدرجة (السيرنج) لضمان دقة الكمية بدلاً من الملعقة.</span></div>
            <div class="bg-red-50 border border-red-200 p-3 rounded-xl text-xs text-red-700 flex items-start gap-2 text-right"><i class="fas fa-exclamation-circle mt-0.5"></i><span>هذه الجرعة استرشادية. إذا استمرت الحرارة أكثر من 3 أيام أو كانت مرتفعة جداً، توجه للطبيب فوراً. لا تجمع دوائين خافضين للحرارة في نفس الوقت دون استشارة.</span></div>
        </div>
    `;
}

// 6. Comprehensive First Aid Guide
const firstAidData = [
    { icon: "fa-heart-pulse", title: "الإنعاش القلبي الرئوي (CPR) للبالغين", steps: "1. تأكد من وعي الشخص، إذا لم يستجب اطلب الإسعاف (110).\n2. ضع كعب يدك في منتصف صدر الشخص (عظمة القص).\n3. اضغط بقوة وسرعة (100-120 ضغطة في الدقيقة) بعمق 5 سم.\n4. بعد كل 30 ضغطة، أعطِ نفسين إنقاذيين (تقريب الأنف والنفخ في الفم).\n5. استمر حتى وصول الإسعاف أو عودة النبض." },
    { icon: "fa-heart-pulse", title: "الإنعاش القلبي للأطفال والرضع", steps: "1. للأطفال: استخدم كف يد واحدة للضغط بعمق 4 سم.\n2. للرضع (أقل من سنة): استخدم إصبعين للضغط على الصدر بعمق 3 سم.\n3. أعطِ 30 ضغطة يليها نفسان بلطف (لا تنفخ بقوة للرضع).\n4. السرعة 100-120 ضغطة في الدقيقة." },
    { icon: "fa-stroke", title: "السكتة الدماغية", steps: "1. الوجه: هل يسيل اللعاب أو مائل لأحد الجانبين؟\n2. الذراع: هل يستطيع رفع كلتا يديه؟\n3. الكلام: هل كلامه متعثر وغير مفهوم؟\n4. الوقت: إذا توفرت أي علامة، اتصل بالإسعاف فوراً. الدقائق هنا تعني إنقاذ خلايا الدماغ." },
    { icon: "fa-heart-circle-bolt", title: "النوبة القلبية", steps: "1. اتصل بالإسعاف فوراً.\n2. اجلس المريض وأسند ظهره واطلب منه الاسترخاء وعدم الحركة.\n3. فك الملابس الضيقة.\n4. إذا لم يكن مصاباً بالقرحة، أعطه حبة أسبرين (300 مغ) ليبلعها ببطء.\n5. إذا فقد الوعي وتوقف قلبه، ابدأ الإنعاش القلبي الرئوي." },
    { icon: "fa-lungs", title: "الاختناق وبلع الأجسام الغريبة (البالغين)", steps: "1. إذا كان يسعل بقوة، شجعه على الاستمرار ولا تتدخل.\n2. إذا لم يستطع التنفس أو الكلام، قف خلفه وطبق مناورة هيمليك.\n3. ضع قبضة يدك بين السرة وأسفل القفص الصدري.\n4. اضغط للداخل والأعلى 5 مرات متتالية بحركة حادة.\n5. كرر حتى يخرج الجسم أو يفقد الوعي (عندها ابدأ الإنعاش القلبي)." },
    { icon: "fa-baby", title: "اختناق الرضيع", steps: "1. ضع الطفل على ذراعك ووجهه لأسفل (رأسه أقل من صدره).\n2. اضرب بظهره 5 ضربات متتالية بكعب يدك.\n3. إذا لم يخرج الجسم، اقلب الطفل ووجهه لأعلى.\n4. اضغط على صدره 5 مرات بإصبعين (كالإنعاش).\n5. كرر الظهر/الصدر حتى يخرج الجسم." },
    { icon: "fa-fire", title: "الحروق المنزلية (حرارية)", steps: "1. ضع المنطقة المصابة تحت ماء جارٍ بارد (ليس مثلجاً) لمدة 15-20 دقيقة.\n2. خلع الملابس أو الإكسسوارات المحيطة بلطف إن لم تكن ملتصقة.\n3. غط الحرق بضمادة معقمة جافة.\n4. لا تضع معجون أسنان، زيت، أو ثلج على الحرق.\n5. للحروق الكبيرة أو العميقة، اطلب الإسعاف فوراً." },
    { icon: "fa-burn", title: "الحروق الكيميائية", steps: "1. ارتدِ قفازات واقية إن أمكن.\n2. اغسل المنطقة المصابة بكميات كبيرة من الماء الفاتر لمدة 20 دقيقة.\n3. اخلع الملابس الملوثة بالكيمياء بحذر.\n4. لا تحاول معادلة الحمض بالقلوي أو العكس.\n5. انقل المصاب لأقرب مشفى مع إحضار عبوة المادة الكيميائية إن أمكن." },
    { icon: "fa-bone", title: "الكسور", steps: "1. لا تحرك العظمة المكسورة وحاول تثبيتها في وضعها الحالي.\n2. ضع جبيرة (خشبة أو مجلة صلبة) حول العظمة لتثبيتها.\n3. ضع كمادات ثلج ملفوفة بقطعة قماش لتخفيف التورم.\n4. لا تحاول إعادة العظمة لمكانها أبداً.\n5. انقل المصاب للمشفى بحذر شديد." },
    { icon: "fa-bleeding", title: "النزيف الشديد (الجروح)", steps: "1. ضع ضغطاً مباشراً وقوياً على الجرح بقطعة قماش نظيفة.\n2. ارفع العضو المصاب فوق مستوى القلب إن أمكن.\n3. إذا تشربت القماش بالدم، ضع طبقة أخرى فوقها ولا ترفع الأولى أبداً.\n4. إذا كان النزيف في الطرف ولم يتوقف، استخدم حزاماً ضاغطاً ووثق وقت وضعه.\n5. اطلب الإسعاف فوراً." },
    { icon: "fa-droplet", title: "نزيف الأنف (الرعاف)", steps: "1. اجلس المريض وأمِل رأسه للأمام قليلاً (لا تميله للخارج لئلا يبلع الدم).\n2. اضغط برفق على الجزء الطري من الأنف (الأجناف) لمدة 10-15 دقيقة.\n3. تنفس من الفم وضع كمادة باردة على الجبهة أو جسر الأنف.\n4. لا نفث الأنف لمدة ساعة بعد توقف النزيف." },
    { icon: "fa-bolt", title: "الصعق الكهربائي", steps: "1. افصل مصدر الكهربائي فوراً أو اسحب المصاب بعيداً باستخدام عازل (خشبة، بلاستيك).\n2. لا تلمس المصاب بيديك العاريتين قبل فصل التيار.\n3. تحقق من تنفسه ونبضه، إذا توقف ابدأ الإنعاش القلبي الرئوي.\n4. عالج الحروق الناتجة (حروق كهربائية) بكمادات باردة.\n5. انقل للمشفى حتى لو بدا سليماً (لخطر اضطراب نبض القلب)." },
    { icon: "fa-water", title: "الغرق", steps: "1. أخرج المصاب من الماء بأمان دون تعريض نفسك للخطر.\n2. تحقق من التنفس، إذا كان متوقفاً ابدأ الإنعاش القلبي الرئوي فوراً.\n3. إذا كان يتنفس، ضعه في وضعية الأمان (الإفاقة) لتجنب الشفط.\n4. أبعده عن البرد ولفه ببطانية.\n5. انقله للمشفى دائماً حتى لو بدا معافى (لخطر الغرق الثانوي)." },
    { icon: "fa-temperature-high", title: "ضربة الشمس", steps: "1. انقل المصاب لمكان بارد وظليل فوراً.\n2. اخلع ملابسه الفضفاضة وغير الضرورية.\n3. برّد جسمه برشه ماء بارد، أو وضع كمادات ثلج على الإبطين والرقبة والفخذين.\n4. إذا كان واعياً، أعطه ماء بارد ليشربه رشفاً (لا يشرب دفعة واحدة).\n5. اطلب الإسعاف، ضربة الشمس حالة طارئة مميتة." },
    { icon: "fa-skull-crossbones", title: "التسمم (بلع مواد سامة)", steps: "1. لا تجعله يتقيأ أبداً إلا إذا طلب ذلك مركز السموم.\n2. احفظ العبوة واقرأ الإسعافات الأولية المكتوبة عليها.\n3. إذا كان فاقداً للوعي، ضعه في وضعية الأمان.\n4. إذا كان المسم مادة كاوية (كلور/حمض)، أعطه كوب حليب أو ماء ليشربه لتخفيف المادة.\n5. انقل للمشفى فوراً مع عبوة السم." },
    { icon: "fa-spider", title: "لدغات العقارب والأفاعي", steps: "1. حاول إبقاء المريض هادئاً وثابتاً لمنع انتشار السم.\n2. ثبت الطرف الملدوغ في وضع منخفض عن مستوى القلب.\n3. اغسل مكان اللدغة بالماء والصابون بلطف.\n4. لا تحاول شفط السم، أو كي الجرح، أو وضع ثلج.\n5. انقل المريض للمشفى فوراً حتى لو لم تظهر أعراض خطيرة." },
    { icon: "fa-head-side-cough", title: "التشنجات (الصرع)", steps: "1. لا تحرك الشخص أو تقيده أبداً.\n2. أبعد عنه الأشياء الحادة أو الصلبة لتجنب إصابته.\n3. ضع شيئاً طرياً (مثل وسادة) تحت رأسه.\n4. لا تضع أي شيء في فمه أبداً (لا ماء، لا ملعقة).\n5. بعد انتهاء التشنج، ضعه في وضعية الأمان (على جنبه) ليفيق بهدوء." }
];
window.openFirstAid = () => {
    const accordionHtml = firstAidData.map((item, index) => `
        <div class="accordion-item ${index === 0 ? 'active' : ''}">
            <div class="accordion-header" onclick="toggleAccordion(this)">
                <div class="flex items-center gap-3"><i class="fas ${item.icon} text-red-600 text-lg w-8"></i><span>${item.title}</span></div>
                <i class="fas fa-chevron-down transition-transform"></i>
            </div>
            <div class="accordion-body"><div class="accordion-body-inner whitespace-pre-line">${item.steps}</div></div>
        </div>
    `).join('');
    openCtrlPanel('دليل الإسعافات الأولية الشامل', `<div class="flex flex-col gap-4"><div class="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 text-sm flex items-center gap-3"><i class="fas fa-ambulance text-xl"></i><span>هذه الإرشادات أولية ولا تغني عن الاتصال بالإسعاف (110) فوراً في الحالات الخطيرة.</span></div><div>${accordionHtml}</div></div>`, '#DC2626');
}
window.toggleAccordion = (el) => { const item = el.parentElement; const isActive = item.classList.contains('active'); document.querySelectorAll('.accordion-item').forEach(i => i.classList.remove('active')); if (!isActive) item.classList.add('active'); }

// 7. Medical Symbols Guide
const medSymbolsData = [
    { symbol: "CBC", name: "صورة دم كاملة", desc: "تحليل يقيس مكونات الدم (كريات حمر، بيض، صفائح) للكشف عن فقر الدم أو الالتهابات." },
    { symbol: "Hb / Hgb", name: "الخضاب (الهيموغلوبين)", desc: "بروتين كريات الدم الحمراء الذي يحمل الأوكسجين. انخفاضه يدل على فقر الدم." },
    { symbol: "FBS", name: "السكر الصيامي", desc: "قياس مستوى السكر في الدم بعد صيام 8-12 ساعة لتشخيص السكري." },
    { symbol: "HbA1c", name: "السكر التراكمي", desc: "يقاس متوسط السكر في الدم خلال آخر 3 أشهر لمتابعة مرضى السكري." },
    { symbol: "WBC", name: "الكريات البيضاء", desc: "ارتفاعها يدل على وجود التهاب أو عدوى بكتيرية في الجسم." },
    { symbol: "RBC", name: "الكريات الحمراء", desc: "خلايا تنقل الأوكسجين. انخفاضها يعني فقر الدم (الأنيميا)." },
    { symbol: "BID / BD", name: "مرتين يومياً", desc: "توصف لتناول الدواء صباحاً ومساءً (كل 12 ساعة)." },
    { symbol: "TID / TDS", name: "ثلاث مرات يومياً", desc: "توصف لتناول الدواء ثلاث مرات (تقريباً كل 8 ساعات)." },
    { symbol: "QID", name: "أربع مرات يومياً", desc: "توصف لتناول الدواء أربع مرات (تقريباً كل 6 ساعات)." },
    { symbol: "PRN", name: "عند اللزوم", desc: "تؤخذ فقط عند الحاجة (مثل مسكنات الألم أو خافضات الحرارة)." },
    { symbol: "STAT", name: "فوراً", desc: "توصف للحالات الإسعافية، يجب إعطاء الدواء مباشرة وبدون تأخير." },
    { symbol: "PO", name: "عن طريق الفم", desc: "تعني تناول الدواء بلعاً عبر الفم." }
];
window.openMedSymbols = () => {
    openCtrlPanel('دليل رموز التحاليل والروشتات الطبية', `<div class="flex flex-col gap-4"><div class="bg-teal-50 border border-teal-200 rounded-xl p-4 text-teal-800 text-sm flex items-center gap-3"><i class="fas fa-balance-scale text-xl"></i><span><b>إخلاء مسؤولية:</b> هذا الدليل للثقافة العامة فقط ولا يهدف للتشخيص. راجع طبيبك لتفسير النتائج.</span></div><div class="relative"><input type="text" id="symbolSearch" class="ctrl-input pr-10" placeholder="ابحث عن رمز أو اسم التحليل..." oninput="filterMedSymbols()"><i class="fas fa-search absolute top-4 left-4 text-gray-400"></i></div><div id="symbolsGrid" class="grid grid-cols-1 sm:grid-cols-2 gap-3"></div></div>`, '#0D9488');
    renderMedSymbols(medSymbolsData);
}
function renderMedSymbols(data) {
    const grid = document.getElementById('symbolsGrid');
    if (!grid) return;
    if (data.length === 0) { grid.innerHTML = `<div class="col-span-2 text-center py-8 text-gray-400">لا توجد نتائج مطابقة</div>`; return; }
    grid.innerHTML = data.map(item => `<div class="med-symbol-card"><div class="med-symbol-badge">${item.symbol}</div><div class="font-bold text-sm mb-1" style="font-family: 'Noto Kufi Arabic'; color: var(--fg)">${item.name}</div><div class="text-xs leading-relaxed" style="color: var(--muted)">${item.desc}</div></div>`).join('');
}
window.filterMedSymbols = () => {
    const q = document.getElementById('symbolSearch').value.toLowerCase();
    const filtered = medSymbolsData.filter(item => item.symbol.toLowerCase().includes(q) || item.name.toLowerCase().includes(q));
    renderMedSymbols(filtered);
}

// 8. Smart Health Calculator
window.openHealthCalc = () => {
    openCtrlPanel('حاسبة الصحة (الوزن والسعرات)', `
        <div class="flex flex-col gap-5">
            <div class="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-indigo-800 text-sm flex items-center gap-3">
                <i class="fas fa-weight-scale text-xl"></i>
                <span>أدخل بياناتك لحساب مؤشر كتلة الجسم (BMI)، الوزن المثالي، واحتياجك اليومي من السعرات الحرارية.</span>
            </div>
            <div class="bg-white p-5 rounded-xl border grid grid-cols-1 sm:grid-cols-2 gap-3" style="border-color: var(--border)">
                <div><label class="block text-sm font-semibold mb-2">الجنس:</label><select id="healthGender" class="ctrl-input"><option value="male">ذكر</option><option value="female">أنثى</option></select></div>
                <div><label class="block text-sm font-semibold mb-2">العمر (سنة):</label><input type="number" id="healthAge" class="ctrl-input" placeholder="مثال: 25" min="15"></div>
                <div><label class="block text-sm font-semibold mb-2">الوزن (كغ):</label><input type="number" id="healthWeight" class="ctrl-input" placeholder="مثال: 70" step="0.1"></div>
                <div><label class="block text-sm font-semibold mb-2">الطول (سم):</label><input type="number" id="healthHeight" class="ctrl-input" placeholder="مثال: 170" step="0.1"></div>
                <div class="col-span-1 sm:col-span-2"><label class="block text-sm font-semibold mb-2">مستوى النشاط البدني:</label><select id="healthActivity" class="ctrl-input"><option value="1.2">خامل (بدون رياضة)</option><option value="1.375">نشاط خفيف (1-3 أيام أسبوعياً)</option><option value="1.55">نشاط متوسط (3-5 أيام أسبوعياً)</option><option value="1.725">نشاط عالي (6-7 أيام أسبوعياً)</option></select></div>
                <button onclick="calcHealth()" class="col-span-1 sm:col-span-2 py-3 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90" style="background: #4F46E5;"><i class="fas fa-calculator ml-2"></i> احسب النتائج</button>
            </div>
            <div id="healthResult" class="hidden"></div>
        </div>
    `, '#4F46E5');
}
window.calcHealth = () => {
    const gender = document.getElementById('healthGender').value;
    const age = parseFloat(document.getElementById('healthAge').value);
    const weight = parseFloat(document.getElementById('healthWeight').value);
    const height = parseFloat(document.getElementById('healthHeight').value);
    const activity = parseFloat(document.getElementById('healthActivity').value);
    if (!age || !weight || !height) { showToast('الرجاء إدخال جميع البيانات بشكل صحيح'); return; }
    const heightM = height / 100;
    const bmi = weight / (heightM * heightM);
    let bmiCategory = "", bmiColor = "", bmiIcon = "";
    if (bmi < 18.5) { bmiCategory = "نحافة"; bmiColor = "#F59E0B"; bmiIcon = "fa-arrow-down"; }
    else if (bmi < 25) { bmiCategory = "وزن مثالي"; bmiColor = "#10B981"; bmiIcon = "fa-check"; }
    else if (bmi < 30) { bmiCategory = "زيادة وزن"; bmiColor = "#F59E0B"; bmiIcon = "fa-arrow-up"; }
    else { bmiCategory = "سمنة"; bmiColor = "#EF4444"; bmiIcon = "fa-exclamation"; }
    let idealWeight = 0;
    if (gender === 'male') { idealWeight = 50 + 0.91 * (height - 152.4); } else { idealWeight = 45.5 + 0.91 * (height - 152.4); }
    let bmr = 0;
    if (gender === 'male') { bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5; } else { bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161; }
    const calories = bmr * activity;
    document.getElementById('healthResult').classList.remove('hidden');
    document.getElementById('healthResult').innerHTML = `
        <div class="flex flex-col gap-4">
            <div class="bg-white p-6 rounded-2xl border-2 text-center" style="border-color: #4F46E5;">
                <div class="text-sm font-bold text-indigo-500 mb-2">مؤشر كتلة الجسم (BMI)</div>
                <div class="text-5xl font-black text-gray-800 mb-2">${bmi.toFixed(1)}</div>
                <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold" style="background: ${bmiColor}20; color: ${bmiColor};"><i class="fas ${bmiIcon}"></i> ${bmiCategory}</div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="bg-white p-5 rounded-2xl border text-center" style="border-color: var(--border);"><div class="w-12 h-12 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-2"><i class="fas fa-bullseye text-green-600"></i></div><div class="text-xs text-gray-500 mb-1">الوزن المثالي التقريبي</div><div class="text-2xl font-black text-gray-800">${idealWeight.toFixed(1)} كغ</div></div>
                <div class="bg-white p-5 rounded-2xl border text-center" style="border-color: var(--border);"><div class="w-12 h-12 mx-auto rounded-full bg-orange-100 flex items-center justify-center mb-2"><i class="fas fa-fire text-orange-500"></i></div><div class="text-xs text-gray-500 mb-1">السعرات اليومية للحفاظ</div><div class="text-2xl font-black text-gray-800">${Math.round(calories)} سعرة</div></div>
            </div>
            <div class="bg-indigo-50 p-4 rounded-xl text-sm text-indigo-800 flex items-start gap-2"><i class="fas fa-lightbulb mt-1"></i><span>لخسارة الوزن: قلل 500 سعرة من احتياجك اليومي. لزيادة الوزن: أضف 500 سعرة. احرص دائماً على استشارة أخصائي التغذية قبل اتباع أي حمية.</span></div>
        </div>
    `;
}

// 9. Daily Water Intake Calculator
window.openWaterCalc = () => {
    openCtrlPanel('حاسبة كمية الماء اليومية', `
        <div class="flex flex-col gap-5">
            <div class="bg-cyan-50 border border-cyan-200 rounded-xl p-4 text-cyan-800 text-sm flex items-center gap-3">
                <i class="fas fa-glass-water text-xl"></i>
                <span>احسب احتياجك اليومي من الماء بناءً على وزنك ونشاطك لتجنب الجفاف.</span>
            </div>
            <div class="bg-white p-5 rounded-xl border grid grid-cols-1 gap-4" style="border-color: var(--border)">
                <div><label class="block text-sm font-semibold mb-2">وزن الجسم (كغ):</label><input type="number" id="waterWeight" class="ctrl-input" placeholder="مثال: 70" step="0.1" min="10"></div>
                <div class="flex flex-col gap-2">
                    <label class="flex items-center gap-3 cursor-pointer p-3 rounded-xl border hover:bg-gray-50" style="border-color: var(--border)"><input type="checkbox" id="waterActivity" class="w-5 h-5 accent-cyan-600"><span class="text-sm font-semibold">أمارس الرياضة أو نشاط بدني مجهد</span></label>
                    <label class="flex items-center gap-3 cursor-pointer p-3 rounded-xl border hover:bg-gray-50" style="border-color: var(--border)"><input type="checkbox" id="waterWeather" class="w-5 h-5 accent-cyan-600"><span class="text-sm font-semibold">الطقس حار جداً (أعلى من 30 درجة)</span></label>
                </div>
                <button onclick="calcWater()" class="w-full py-3 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90" style="background: #0891B2;"><i class="fas fa-droplet ml-2"></i> احسب احتياجي من الماء</button>
            </div>
            <div id="waterResult" class="hidden"></div>
        </div>
    `, '#0891B2');
}
window.calcWater = () => {
    const weight = parseFloat(document.getElementById('waterWeight').value);
    const activity = document.getElementById('waterActivity').checked;
    const weather = document.getElementById('waterWeather').checked;
    if (!weight || weight <= 0) { showToast('الرجاء إدخال وزن صحيح'); return; }
    let waterMl = weight * 35;
    if (activity) waterMl += 500;
    if (weather) waterMl += 500;
    const waterLiters = (waterMl / 1000).toFixed(2);
    const waterCups = Math.round(waterMl / 250);
    document.getElementById('waterResult').classList.remove('hidden');
    document.getElementById('waterResult').innerHTML = `
        <div class="bg-white p-6 rounded-2xl border-2 text-center" style="border-color: #0891B2;">
            <div class="w-20 h-20 mx-auto rounded-full bg-cyan-100 flex items-center justify-center mb-4"><i class="fas fa-droplet text-4xl text-cyan-500"></i></div>
            <div class="text-sm font-bold text-cyan-600 mb-2">احتياجك اليومي التقريبي من الماء</div>
            <div class="text-5xl font-black text-gray-800 mb-4">${waterLiters} <span class="text-xl">لتر</span></div>
            <div class="flex justify-center gap-6 mb-4"><div><div class="text-xs text-gray-500">عدد الأكواب (250 مل)</div><div class="text-2xl font-black text-gray-800">${waterCups} كوب</div></div></div>
            <div class="bg-cyan-50 p-3 rounded-xl text-sm text-cyan-800 flex items-start gap-2 text-right"><i class="fas fa-info-circle mt-1"></i><span>وزع هذا المقدار على ساعات اليوم. ابدأ بكوب صباحاً، واحرص على الشرب قبل الشعور بالعطش. تجنب شرب كميات كبيرة دفعة واحدة.</span></div>
        </div>
    `;
}

// === 1. Chronic Diseases Nutrition Guide ===
const chronicNutritionData = [
    { disease: "السكري (Diabetes)", color: "#3B82F6", icon: "fa-syringe", advice: "التركيز على الألياف (الخضار الورقية، الشوفان، البقوليات). تجنب السكريات المضافة والعصائر المحلاة والمشروبات الغازية. تقسيم الوجبات لثلاث رئيسية وثلاث خفيفة للحفاظ على مستوى السكر." },
    { disease: "ارتفاع ضغط الدم (Hypertension)", color: "#EF4444", icon: "fa-heart-pulse", advice: "تقليل ملح الطعام (الصوديوم) إلى أقل من 5 غرام يومياً. تجنب المعلبات، اللحوم المصنعة، والمخللات. الإكثار من البوتاسيوم الموجود في الموز، البطاطا، والطماطم." },
    { disease: "الكوليسترول والدهون (Cholesterol)", color: "#F59E0B", icon: "fa-droplet", advice: "الابتعاد عن الدهون المشبعة (السمنة الحيوانية، الزبدة، المقليات). الاعتماد على الدهون الصحية (زيت الزيتون، الأفوكادو، المكسرات). تناول الأسماك الدهنية مرتين أسبوعياً." },
    { disease: "القولون العصبي (IBS)", color: "#8B5CF6", icon: "fa-pills", advice: "تجنب الأطعمة المحفزة (المنبهات، البقوليات، الكرنب، البصل). تناول وجبات صغيرة ومضغ الطعام جيداً. شرب كميات كافية من الماء وتجنب الإمساك." },
    { disease: "النقرس (Gout)", color: "#06B6D4", icon: "fa-bone", advice: "تجنب الأطعمة الغنية بالبيورينات (اللحوم الحمراء، المشروبات الغازية، المأكولات البحرية). الإكثار من شرب الماء (أكثر من 2 لتر يومياً) وتناول الكرز الذي يساعد في خفض حمض اليوريك." }
];
window.openChronicNutrition = () => {
    const cardsHtml = chronicNutritionData.map(d => `
        <div class="disease-card">
            <div class="disease-header" style="background: ${d.color};"><i class="fas ${d.icon} text-2xl text-white"></i><div><h4 class="font-bold text-white text-sm" style="font-family: 'Noto Kufi Arabic'">${d.disease}</h4></div></div>
            <div class="disease-body"><div class="text-xs font-bold text-gray-500 mb-1">النصائح الغذائية:</div><div class="text-sm text-gray-700 leading-relaxed">${d.advice}</div></div>
        </div>`).join('');
    openCtrlPanel('قسم التغذية للأمراض المزمنة', `<div class="flex flex-col gap-4"><div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-800 text-sm flex items-center gap-3"><i class="fas fa-bowl-food text-xl"></i><span>دليل غذائي مبسط لأمراض مزمنة شائعة. هذه الإرشادات استرشادية ويجب الالتزام بخطة الطبيب المعالج.</span></div><div class="grid grid-cols-1 sm:grid-cols-2 gap-4">${cardsHtml}</div></div>`, '#10B981');
}

// === 2. Pre-Visit Guide ===
window.openPreVisitGuide = () => {
    openCtrlPanel('دليل الإرشادات قبل زيارة الطبيب أو المخبر', `
        <div class="flex flex-col gap-5">
            <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-800 text-sm flex items-center gap-3"><i class="fas fa-clipboard-list text-xl"></i><span>تحضير نفسك قبل الزيارة الطبية يوفر الوقت ويساعد الطبيب على التشخيص الدقيق.</span></div>
            <div class="bg-white p-5 rounded-xl border" style="border-color: var(--border)">
                <h4 class="font-bold mb-4 text-sm flex items-center gap-2"><i class="fas fa-user-md text-blue-600"></i> قبل زيارة الطبيب</h4>
                <ul class="list-disc pr-5 space-y-2 text-sm text-gray-700">
                    <li><b>اكتب الأعراض:</b> سجل متى بدأ الألم، نوعه، وشدته.</li>
                    <li><b>الأدوية الحالية:</b> أحضر قائمة بكل الأدوية والفيتامينات التي تتناولها (أو علوبها).</li>
                    <li><b>التاريخ الطبي:</b> جهز معلومات عن العمليات السابقة والأمراض الوراثية في العائلة.</li>
                    <li><b>الأسئلة:</b> اكتب أي استفسار تود طرحه على الطبيب لكي لا تنساه.</li>
                    <li><b>الصيام:</b> اسأل العيادة إن كنت بحاجة للصيام قبل الزيارة (خاصة لتحاليل السكر أو الكوليسترول).</li>
                </ul>
            </div>
            <div class="bg-white p-5 rounded-xl border" style="border-color: var(--border)">
                <h4 class="font-bold mb-4 text-sm flex items-center gap-2"><i class="fas fa-flask text-red-600"></i> قبل زيارة المخبر للتحاليل</h4>
                <ul class="list-disc pr-5 space-y-2 text-sm text-gray-700">
                    <li><b>الصيام:</b> معظم تحاليل الدم (السكر، الدهون، الكلى، الكبد) تتطلب صياماً من 8 إلى 12 ساعة. الماء مسموح به.</li>
                    <li><b>الأدوية:</b> اسأل طبيبك إن كنت يجب أن تتوقف عن أخذ دوائك صباح التحليل (خاصة أدوية السكر والضغط).</li>
                    <li><b>الترطيب:</b> شرب كوبين من الماء قبل سحب الدم يسهل العثور على الأوردة.</li>
                    <li><b>الملابس:</b> ارتدِ ملابس بأكمام واسعة لتسهيل رفعها أثناء سحب الدم.</li>
                    <li><b>النشاط البدني:</b> تجنب الرياضة المجهدة قبل التحليل مباشرة لأنها قد تؤثر على بعض النتائج.</li>
                </ul>
            </div>
        </div>
    `, '#3B82F6');
}

// === 3. Food Interactions Table ===
const foodInteractionsData = [
    { med: "أدوية الضغط (ACE Inhibitors)", food: "الموز، الأفوكادو، بدائل الملح", effect: "ارتفاع خطير في نسبة البوتاسيوم في الدم" },
    { med: "الوارفارين (مسيلات الدم)", food: "الخضار الورقية الداكنة (السبانخ، البقدونس)", effect: "تقلل فاعلية الدواء وتزيد سيولة الدم" },
    { med: "أدوية السكري (Metformin)", food: "الكحول", effect: "خطر حدوث حموضة لاكتكية شديدة" },
    { med: "المضادات الحيوية (Tetracycline)", food: "منتجات الألبان (الحليب، الجبن)", effect: "تمنع امتصاص الدواء وتراكيزه في الجسم" },
    { med: "أدوية الكوليسترول (Statins)", food: "عصير الجريب فروت", effect: "تراكم الدواء في الدم مما يسبب آلاماً عضلية" },
    { med: "مسكنات الألم (NSAIDs)", food: "الكحول، التوابل الحارة", effect: "زيادة خطر نزيف المعدة والقرحة" }
];
window.openFoodInteractions = () => {
    const tableRows = foodInteractionsData.map(item => `<tr class="border-b" style="border-color: var(--border)"><td class="p-3 text-sm font-bold text-gray-800">${item.med}</td><td class="p-3 text-sm text-red-600">${item.food}</td><td class="p-3 text-sm text-gray-600">${item.effect}</td></tr>`).join('');
    openCtrlPanel('جدول تعارضات الأدوية مع الطعام', `<div class="flex flex-col gap-4"><div class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm flex items-center gap-3"><i class="fas fa-utensils text-xl"></i><span>جدول إرشادي لأهم التداخلات بين الأدوية الشائعة والأطعمة. استشر الصيدلاني دائماً.</span></div><div class="bg-white rounded-xl border overflow-hidden" style="border-color: var(--border)"><table class="w-full text-right"><thead class="bg-gray-50"><tr class="border-b" style="border-color: var(--border)"><th class="p-3 text-xs font-bold text-gray-500">الدواء</th><th class="p-3 text-xs font-bold text-gray-500">الطعام الممنوع/المحظور</th><th class="p-3 text-xs font-bold text-gray-500">التأثير الجانبي</th></tr></thead><tbody>${tableRows}</tbody></table></div></div>`, '#D97706');
}

// === 4. Patient Self-Reminder Book (Local Storage) ===
let patientReminders = JSON.parse(localStorage.getItem('patientReminders')) || [];
window.openPatientReminder = () => {
    patientReminders = JSON.parse(localStorage.getItem('patientReminders')) || [];
    openCtrlPanel('دفتر التذكير الذاتي للمريض', `
        <div class="flex flex-col gap-5">
            <div class="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-indigo-800 text-sm flex items-center gap-3"><i class="fas fa-bell text-xl"></i><span>سجل أدويتك ومواعيدك هنا. يتم حفظها على جهازك لتذكيرك ذاتياً دون الحاجة للإنترنت.</span></div>
            <div class="bg-white p-5 rounded-xl border" style="border-color: var(--border)">
                <h4 class="font-bold mb-4 text-sm flex items-center gap-2"><i class="fas fa-plus-circle text-indigo-600"></i> إضافة تذكير جديد</h4>
                <form onsubmit="saveReminder(event)" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input type="text" id="reminderTitle" class="ctrl-input text-sm" placeholder="عنوان التذكير (مثال: دواء الضغط)" required>
                    <input type="datetime-local" id="reminderDate" class="ctrl-input text-sm" required>
                    <textarea id="reminderNotes" class="ctrl-input text-sm col-span-1 sm:col-span-2" rows="2" placeholder="ملاحظات (مثال: بعد الأكل)"></textarea>
                    <button type="submit" class="col-span-1 sm:col-span-2 py-3 rounded-xl text-white font-bold text-sm" style="background: #6366F1;"><i class="fas fa-save ml-2"></i> حفظ التذكير</button>
                </form>
            </div>
            <div class="bg-white p-5 rounded-xl border" style="border-color: var(--border)">
                <h4 class="font-bold mb-4 text-sm flex items-center gap-2"><i class="fas fa-list text-indigo-600"></i> تذكيراتي المحفوظة</h4>
                <div id="remindersList" class="flex flex-col gap-3"><p class="text-center py-8 text-gray-400 text-sm">لا توجد تذكيرات بعد.</p></div>
            </div>
        </div>
    `, '#6366F1');
    renderRemindersList();
}
window.saveReminder = (e) => {
    e.preventDefault(); const title = document.getElementById('reminderTitle').value.trim(); const date = document.getElementById('reminderDate').value; const notes = document.getElementById('reminderNotes').value.trim();
    if(!title || !date) { showToast('يرجى إدخال العنوان والتاريخ'); return; }
    patientReminders.push({ id: Date.now(), title, date, notes }); localStorage.setItem('patientReminders', JSON.stringify(patientReminders)); document.querySelector('#ctrlContent form').reset(); renderRemindersList(); showToast('تم حفظ التذكير بنجاح!');
}
window.deleteReminder = (id) => { patientReminders = patientReminders.filter(r => r.id !== id); localStorage.setItem('patientReminders', JSON.stringify(patientReminders)); renderRemindersList(); showToast('تم حذف التذكير'); }
function renderRemindersList() {
    const list = document.getElementById('remindersList'); if (!list) return;
    if (patientReminders.length === 0) { list.innerHTML = '<p class="text-center py-8 text-gray-400 text-sm">لا توجد تذكيرات بعد.</p>'; return; }
    list.innerHTML = patientReminders.map(r => { const dateObj = new Date(r.date); const formattedDate = dateObj.toLocaleString('ar-EG', { date: 'short', time: 'short', weekday: 'long' }); return `<div class="border rounded-xl p-4 flex items-center justify-between gap-3" style="border-color: var(--border)"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0"><i class="fas fa-clock text-indigo-600"></i></div><div><div class="font-bold text-sm text-gray-800">${r.title}</div><div class="text-xs text-gray-500 mt-1">${formattedDate}</div>${r.notes ? `<div class="text-xs text-gray-400 mt-1">${r.notes}</div>` : ''}</div></div><button onclick="deleteReminder(${r.id})" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button></div>`; }).join('');
}

// === 5. Medicine Renewal Calculator ===
window.openMedRenewalCalc = () => {
    openCtrlPanel('حاسبة موعد تجديد الدواء', `
        <div class="flex flex-col gap-5">
            <div class="bg-cyan-50 border border-cyan-200 rounded-xl p-4 text-cyan-800 text-sm flex items-center gap-3"><i class="fas fa-calendar-check text-xl"></i><span>احسب متى سينفد دوائك لتقوم بتجديده من الصيدلية في الوقت المناسب.</span></div>
            <div class="bg-white p-5 rounded-xl border grid grid-cols-1 sm:grid-cols-2 gap-3" style="border-color: var(--border)">
                <div class="col-span-1 sm:col-span-2"><label class="block text-sm font-semibold mb-2">عدد حبات الدواء المتوفرة حالياً:</label><input type="number" id="medPillsCount" class="ctrl-input" placeholder="مثال: 30 حبة" min="1"></div>
                <div><label class="block text-sm font-semibold mb-2">عدد الحبات في اليوم:</label><input type="number" id="medPillsPerDay" class="ctrl-input" placeholder="مثال: 2 حبة" min="0.5" step="0.5"></div>
                <div><label class="block text-sm font-semibold mb-2">تاريخ بدء تناول الدواء:</label><input type="date" id="medStartDate" class="ctrl-input"></div>
                <button onclick="calcRenewal()" class="col-span-1 sm:col-span-2 py-3 rounded-xl text-white font-bold text-sm" style="background: #06B6D4;"><i class="fas fa-calculator ml-2"></i> احسب موعد التجديد</button>
            </div>
            <div id="renewalResult" class="hidden"></div>
        </div>
    `, '#06B6D4');
}
window.calcRenewal = () => {
    const pills = parseFloat(document.getElementById('medPillsCount').value); const perDay = parseFloat(document.getElementById('medPillsPerDay').value); const startDateStr = document.getElementById('medStartDate').value;
    if(!pills || !perDay || !startDateStr) { showToast('الرجاء إدخال جميع الحقول'); return; }
    if(perDay <= 0) { showToast('يجب إدخال جرعة يومية صحيحة'); return; }
    const daysSupply = Math.floor(pills / perDay); const startDate = new Date(startDateStr); const renewDate = new Date(startDate); renewDate.setDate(renewDate.getDate() + daysSupply);
    const today = new Date(); const diffTime = renewDate - today; const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    let statusText = "", statusColor = "";
    if (diffDays < 0) { statusText = "لقد نفد الدواء! يرجى تجديده فوراً."; statusColor = "#EF4444"; }
    else if (diffDays === 0) { statusText = "الدواء سينفد اليوم! جدده اليوم."; statusColor = "#F59E0B"; }
    else if (diffDays <= 3) { statusText = `متبقى ${diffDays} أيام فقط! استعد لتجديد الدواء.`; statusColor = "#F59E0B"; }
    else { statusText = `متبقى ${diffDays} يوماً على نفاد الدواء.`; statusColor = "#10B981"; }
    const formattedDate = renewDate.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('renewalResult').classList.remove('hidden');
    document.getElementById('renewalResult').innerHTML = `<div class="bg-white p-6 rounded-2xl border-2 text-center" style="border-color: #06B6D4;"><div class="w-16 h-16 mx-auto rounded-full bg-cyan-100 flex items-center justify-center mb-4"><i class="fas fa-pills text-3xl text-cyan-500"></i></div><div class="text-sm font-bold text-cyan-600 mb-2">موعد نفاد الدواء المتوقع</div><div class="text-lg font-black text-gray-800 mb-4" style="font-family: 'Noto Kufi Arabic'">${formattedDate}</div><div class="bg-cyan-50 p-3 rounded-xl text-sm font-bold" style="color: ${statusColor};"><i class="fas fa-info-circle ml-1"></i> ${statusText}</div><div class="text-xs text-gray-500 mt-4">مدة كفاية الدواء الحالي: ${daysSupply} يوم</div></div>`;
}

// === Tool 1: Pre-Test & Scan Instructions (Professional Edition) ===
const prelabData = [
    { id:1, name:'فحص السكر الصائم (FBS)', cat:'blood', fasting:'8-12 ساعة', fastingClass:'fasting-8', icon:'fa-droplet', color:'#DC2626', instructions:['صيام 8-12 ساعة عن الطعام','يُسمح بشرب الماء بكميات قليلة','تجنب الأطعمة الدسمة مساء اليوم السابق','أخذ العينة صباحاً بشكل مفضل'], notes:'السكر الطبيعي الصائم: 70-100 ملغ/دل' },
    { id:2, name:'فحص الشحوم والدهون (Lipid Profile)', cat:'blood', fasting:'12-14 ساعة', fastingClass:'fasting-12', icon:'fa-vial', color:'#F59E0B', instructions:['صيام تام 12-14 ساعة','لا يُسمح بشرب الماء خلال فترة الصيام','تجنب الكحوليات 48 ساعة قبل الفحص','الامتناع عن الأطعمة الدسمة يومين قبل'], notes:'يشمل: الكولسترول الكلي، HDL، LDL، الدهون الثلاثية' },
    { id:3, name:'تحليل CBC (صورة دم كاملة)', cat:'blood', fasting:'لا يُطلب صيام', fastingClass:'fasting-none', icon:'fa-flask', color:'#059669', instructions:['لا يتطلب صيام','يمكن أخذه في أي وقت من اليوم','أخبر الفني إذا كنت تتناول أدوية'], notes:'يشمل: كريات حمراء، بيضاء، صفائح دموية، هيموغلوبين' },
    { id:4, name:'وظائف الكبد (LFT)', cat:'blood', fasting:'8-10 ساعات', fastingClass:'fasting-10', icon:'fa-liver', color:'#8B5CF6', instructions:['صيام 8-10 ساعات يُفضل','تجنب الأدوية المسكنة قبل الفحص بيوم','إذا كنت تتناول أدوية كبدية، أبلغ الفني'], notes:'يشمل: ALT, AST, ALP, البيليروبين، الألبومين' },
    { id:5, name:'إيكو / سونار البطن (Abdominal US)', cat:'imaging', fasting:'6-8 ساعات', fastingClass:'fasting-special', icon:'fa-wave-square', color:'#7C3AED', instructions:['صيام 6-8 ساعات لتصوير البطن العلوي','شرب 4-6 أكواب ماء قبل الفحص بساعة (مثانة ممتلئة)','لا تتبول قبل الفحص','تجنب الأطعمة الغازية يوم قبل'], notes:'المثانة الممتلئة ضرورية لتصوير الحوض' },
    { id:6, name:'أشعة الصدر (Chest X-Ray)', cat:'imaging', fasting:'لا يُطلب صيام', fastingClass:'fasting-none', icon:'fa-lungs', color:'#0EA5E9', instructions:['لا يتطلب صيام أو تحضير خاص','إزالة المجوهرات المعدنية من منطقة الصدر','إزالة الأزرار والأحزمة المعدنية','إخبار الفني في حال وجود حمل'], notes:'مدة الفحص: دقائق معدودة' },
    { id:7, name:'رنين مغناطيسي (MRI)', cat:'imaging', fasting:'حسب المنطقة', fastingClass:'fasting-special', icon:'fa-magnet', color:'#A855F7', instructions:['إزالة جميع المعادن: ساعات، أقراط، أسنان صناعية','لا يدخل معك أي إلكترونيات','أبلغ الفني إذا كان لديك: دعامة، منظم نبض','لـ MRI البطن: صيام 4-6 ساعات'], notes:'مدة الفحص: 30-60 دقيقة حسب المنطقة' },
    { id:8, name:'تحليل بول عام (Urinalysis)', cat:'urine', fasting:'لا يُطلب صيام', fastingClass:'fasting-none', icon:'fa-flask-vial', color:'#14B8A6', instructions:['العينة الأولى في الصباح هي الأفضل','جمع منتصف التبول (تجاهل الجزء الأول والأخير)','استخدم العبوة المعقمة المخصصة','تسليم العينة للمخبر خلال ساعتين'], notes:'لا تجمع العينة أثناء الدورة الشهرية' },
    { id:9, name:'فحص الحمل (Beta HCG - دم)', cat:'special', fasting:'لا يُطلب صيام', fastingClass:'fasting-none', icon:'fa-baby', color:'#EC4899', instructions:['لا يتطلب صيام','يمكن أخذ العينة في أي وقت','أخبر الفني بتاريخ آخر دورة'], notes:'يظهر الحمل في الدم بعد 7-10 أيام من الإخصاب' },
    { id:10, name:'تحليل غازات الدم (ABG)', cat:'special', fasting:'لا يُطلب صيام', fastingClass:'fasting-none', icon:'fa-wind', color:'#EF4444', instructions:['يُؤخذ من الشريان (مؤلم أكثر من الوريد)','لا يتطلب صيام','أبلغ الفني إذا كنت تتناول أكسجين','الراحة لمدة 20 دقيقة قبل الفحص'], notes:'يجب وضع ضغط على مكان الوخز لمدة 5 دقائق' }
];
window.openPreTestGuide = () => {
    const initialHtml = `
        <div class="flex flex-col gap-5">
            <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-800 text-sm flex items-center gap-3"><i class="fas fa-clipboard-list text-xl"></i><span>دليل أرشيفي سريع يجيب على تساؤلاتك قبل الذهاب للمختبر أو الأشعة. اتبعها لضمان دقة النتائج.</span></div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="bg-white rounded-2xl p-5 border border-red-100 shadow-sm hover:shadow-md transition-all glow-border"><div class="flex items-center gap-3 mb-3"><div class="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500"><i class="fas fa-clock"></i></div><h4 class="font-bold text-sm">كم ساعة صيام لفحص السكر؟</h4></div><div class="flex items-center gap-3"><span class="fasting-badge fasting-8"><i class="fas fa-moon"></i> 8 - 12 ساعة</span><span class="text-xs" style="color:var(--muted)">يُسمح بشرب الماء</span></div></div>
                <div class="bg-white rounded-2xl p-5 border border-purple-100 shadow-sm hover:shadow-md transition-all glow-border"><div class="flex items-center gap-3 mb-3"><div class="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500"><i class="fas fa-wave-square"></i></div><h4 class="font-bold text-sm">تعليمات إيكو / سونار البطن؟</h4></div><div class="flex items-center gap-3"><span class="fasting-badge fasting-special"><i class="fas fa-moon"></i> 6 - 8 ساعات</span><span class="text-xs" style="color:var(--muted)">معدة فارغة + مثانة ممتلئة</span></div></div>
            </div>
            <div class="bg-white rounded-2xl border overflow-hidden shadow-sm" style="border-color:var(--border)"><div class="p-4 border-b flex flex-wrap gap-2" style="border-color:var(--border);background:var(--bg-deep)"><button class="tab-btn active" onclick="filterPrelab('all',this)">الكل</button><button class="tab-btn" onclick="filterPrelab('blood',this)"><i class="fas fa-tint ml-1"></i>تحاليل دم</button><button class="tab-btn" onclick="filterPrelab('imaging',this)"><i class="fas fa-x-ray ml-1"></i>أشعة وتصوير</button><button class="tab-btn" onclick="filterPrelab('urine',this)"><i class="fas fa-flask ml-1"></i>تحاليل بول</button><button class="tab-btn" onclick="filterPrelab('special',this)"><i class="fas fa-star ml-1"></i>فحوصات خاصة</button></div><div id="prelabList"></div></div>
        </div>`;
    openCtrlPanel('التعليمات قبل التحاليل والفحوصات', initialHtml, '#3B82F6');
    renderPrelab('all');
};
function renderPrelab(filter='all') {
    const container = document.getElementById('prelabList'); if(!container) return;
    const items = filter === 'all' ? prelabData : prelabData.filter(d => d.cat === filter);
    container.innerHTML = items.map(item => `
        <div class="prelab-accordion-item border-b" style="border-color:var(--border)">
            <div class="prelab-toggle flex items-center justify-between p-4" onclick="togglePrelab(this)">
                <div class="flex items-center gap-3"><div class="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0" style="background:${item.color}"><i class="fas ${item.icon}"></i></div><div><div class="font-bold text-sm">${item.name}</div><span class="fasting-badge ${item.fastingClass} text-[0.7rem] mt-1"><i class="fas ${item.fastingClass==='fasting-none'?'fa-sun':'fa-moon'}"></i> ${item.fasting}</span></div></div>
                <i class="fas fa-chevron-down text-xs transition-transform" style="color:var(--muted)"></i>
            </div>
            <div class="prelab-accordion"><div class="px-4 pb-4 pr-[68px]"><div class="bg-gray-50 rounded-xl p-4 mb-3" style="background:var(--bg-deep)"><div class="text-xs font-bold mb-2" style="color:var(--accent)"><i class="fas fa-list-check ml-1"></i> التعليمات:</div><ul class="space-y-2">${item.instructions.map(i => `<li class="flex items-start gap-2 text-xs" style="color:var(--fg-light)"><i class="fas fa-check-circle mt-0.5 flex-shrink-0" style="color:var(--accent)"></i><span>${i}</span></li>`).join('')}</ul></div>${item.notes ? `<div class="flex items-start gap-2 text-xs p-3 rounded-lg" style="background:#FEF9C3;color:#92400E"><i class="fas fa-lightbulb mt-0.5 flex-shrink-0"></i><span>${item.notes}</span></div>` : ''}</div></div>
        </div>`).join('');
}
window.filterPrelab = (cat, btn) => { document.querySelectorAll('#ctrlContent .tab-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderPrelab(cat); }
window.togglePrelab = (el) => { const accordion = el.nextElementSibling; const icon = el.querySelector('.fa-chevron-down'); const isOpen = accordion.classList.contains('open'); document.querySelectorAll('#ctrlContent .prelab-accordion.open').forEach(a => { a.classList.remove('open'); a.previousElementSibling.querySelector('.fa-chevron-down').style.transform = ''; }); if (!isOpen) { accordion.classList.add('open'); icon.style.transform = 'rotate(180deg)'; } };

// === Tool 2: Events & Gatherings First Aid ===
window.openEventsFirstAid = () => {
    const data = [
        { icon: "fa-users-slash", title: "الإغماء وسط الازدحام", steps: "1. افسح المجال للهواء النقي حول المصاب فوراً.\n2. اجعل المصاب مستلقياً على ظهره وارفع قدميه 30 سم لتحسين تدفق الدم للدماغ.\n3. فك الملابس الضيقة (ربطة العنق، الياقة، الحزام).\n4. إذا لم يفق خلال دقيقة واحدة، اطلب الإسعاف فوراً وابدأ بفحص تنفسه." },
        { icon: "fa-hand-holding-medical", title: "الجروح والنزيف الطفيف", steps: "1. اغسل يديك جيداً قبل التعامل مع الجرح.\n2. اضغط بقطعة شاش نظيفة أو قطن على الجرح لإيقاف النزيف.\n3. قم بتطهير الجرح بمادة مطهرة (مثل البيتادين أو الكحول حول الجرح وليس داخله).\n4. غط الجرح بضمادة معقمة. إذا كان النزيف غزيراً ولا يتوقف، ارفع العضو المصاب واطلب الإسعاف." },
        { icon: "fa-mug-hot", title: "الحروق البسيطة (شاي، قهوة، أراكيل)", steps: "1. ضع مكان الحرق تحت ماء جارٍ بارد (ليس مثلجاً) لمدة 10 إلى 15 دقيقة.\n2. لا تضع معجون أسنان، ليمون، صابون، أو زيوت على الحرق أبداً.\n3. غط الحرق بقطعة قماش نظيفة وجافة.\n4. لا تفقع الفقاعات إن ظهرت للحفاظ على الجلد من التلوث." },
        { icon: "fa-burger", title: "التسمم الغذائي المفاجئ", steps: "1. أكثر من شرب السوائل (ماء، مفرزات، شوربة) لتجنب الجفاف.\n2. لا تأخذ دواء لإيقاف الإسهال أو القيء فوراً، دع الجسم يطرد السموم.\n3. تناول وجبات خفيفة وسوائل دافئة عند تحسن الحالة.\n4. إذا استمر القيء أكثر من 24 ساعة، أو ظهر دم في البراز، أو ارتفعت الحرارة بشدة، توجه للطوارئ فوراً." },
        { icon: "fa-sun", title: "ضربة الشمس (المناسبات المكشوفة)", steps: "1. انقل المصاب لمكان بارد ومظلل فوراً.\n2. اخلع الملابس الثقيلة وضعه على بطانية باردة.\n3. رش جسمه بالماء وضع كمادات ثلج على الإبطين، الرقبة، والفخذين.\n4. إذا كان واعياً، أعطه ماء بارد ليشربه رشفاً. إذا فقد الوعي، اطلب الإسعاف ولا تعطه ماء عن الفم." },
        { icon: "fa-lungs", title: "الاختناق أثناء تناول الطعام", steps: "1. إذا كان المصاب يسعل بقوة، شجعه على الاستمرار ولا تتدخل.\n2. إذا لم يستطع التنفس أو الكلام، قف خلفه ولف ذراعيك حول خصره.\n3. اضغط بقوة للداخل والأعلى (مناورة هيمليك) 5 مرات متتالية.\n4. كرر الضغط حتى يخرج الطعام أو يفقد الوعي (عندها ابدأ الإنعاش القلبي واطلب الإسعاف)." },
        { icon: "fa-bone", title: "السقوط والاشتباه بكسور", steps: "1. لا تحرك العضو المصاب وحاول تثبيته في وضعه الحالي.\n2. ضع جبيرة (خشبة، أو مجلة صلبة) حول العظمة لتثبيتها.\n3. ضع كمادات ثلج ملفوفة بقطعة قماش على مكان الإصابة لتخفيف التورم.\n4. لا تحرك إعادة العظمة لمكانها أبداً، وانقل المصاب للمشفى بحذر أو اطلب الإسعاف." },
        { icon: "fa-pills", title: "هبوط السكر المفاجئ (لمرضى السكري)", steps: "1. إذا شعر شخص بعرق شديد، رجفة، أو تشوش بالوعي، اعطه فوراً عصيراً محلى، أو قطعة سكر، أو ملعقة عسل.\n2. لا تعطه شيئاً عن الفم إذا كان فاقداً للوعي تماماً لتجنب اختناقه.\n3. انتظر 15 دقيقة، إذا لم يتحسن، أعطه جرعة أخرى من السكر واطلب الإسعاف.\n4. بعد أن يستعيد وعيه وتتحسن حالته، أعطه وجبة خفيفة تحتوي على نشويات (شطيرة) لضمان استقرار السكر." }
    ];
    const html = data.map(d => `<div class="accordion-item"><div class="accordion-header" onclick="toggleAccordion(this)"><div class="flex items-center gap-3"><i class="fas ${d.icon} text-red-600 text-lg w-8"></i><span>${d.title}</span></div><i class="fas fa-chevron-down transition-transform"></i></div><div class="accordion-body"><div class="accordion-body-inner whitespace-pre-line">${d.steps}</div></div></div>`).join('');
    openCtrlPanel('إسعافات المناسبات والتجمعات', `<div class="flex flex-col gap-4"><div class="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 text-sm flex items-center gap-3"><i class="fas fa-kit-medical text-xl"></i><span>دليل سريع للتعامل مع أكثر الحوادث شيوعاً في الأفراح، المهرجانات، والتجمعات العائلية.</span></div><div>${html}</div></div>`, '#DC2626');
};

// === Interactive Medical Map ===
window.openMedicalMap = () => {
    openCtrlPanel('الخريطة الطبية ', `
        <div class="flex flex-col sm:flex-row gap-4 h-[70vh]">
            <div class="w-full sm:w-1/3 flex flex-col gap-2 overflow-y-auto pr-1" id="mapListContainer">
                <p class="text-center text-gray-400 text-sm py-10">جاري تحميل المنشآت...</p>
            </div>
            <div class="w-full sm:w-2/3 rounded-xl overflow-hidden border" style="border-color: var(--border)">
                <iframe id="mapFrame" width="100%" height="100%" frameborder="0" style="border:0; min-height: 400px;" src="https://maps.google.com/maps?q=الرحيبة%20سوريا&output=embed" allowfullscreen></iframe>
            </div>
        </div>
    `, '#10B981');
    renderMapList();
}
function renderMapList() {
    const container = document.getElementById('mapListContainer');
    if (!container) return;
    if (allData.length === 0) { container.innerHTML = '<p class="text-center text-gray-400 text-sm py-10">لا توجد منشآت.</p>'; return; }
    const typeColors = { hospital: 'var(--hospital)', clinic: 'var(--clinic)', center: 'var(--center)', lab: 'var(--lab)', doctor: 'var(--doctor)', pharmacy: 'var(--pharmacy)' };
    container.innerHTML = allData.map(item => {
        const color = typeColors[item.type] || 'var(--accent)';
        const locationQuery = encodeURIComponent((item.address || item.clinic || item.name) + ' الرحيبة سوريا');
        return `<div onclick="updateMapFrame('${locationQuery}')" class="p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition-all" style="border-color: var(--border)"><div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full" style="background: ${color}"></span><span class="font-bold text-sm text-gray-800 truncate">${item.name}</span></div><div class="text-xs text-gray-500 mt-1 truncate">${item.address || item.clinic || 'الرحيبة'}</div></div>`;
    }).join('');
}
window.updateMapFrame = (query) => { const frame = document.getElementById('mapFrame'); if (frame) frame.src = `https://maps.google.com/maps?q=${query}&output=embed`; };

// === Raheba Health Radar ===
const radarDiseasesData = {
    summer: [
        { id: 'poisoning', name: 'تسمم ونزلة معوية', icon: 'fa-temperature-high', color: '#F59E0B', symptoms: 'ألم بطن، إسهال، استفراغ، أو مغص حاد', advice: 'لوحظ تسجيل حالات تسمم مؤخراً، يرجى التأكد من غسل الخضار جيداً وعدم ترك الأطعمة خارج الثلاجة.' },
        { id: 'summer_cold', name: 'رشح صيفي ووجع الحلق', icon: 'fa-virus', color: '#DC2626', symptoms: 'وجع حلق، احتقان، بحة صوت، وتكسير عظام', advice: 'الرشح الصيفي شائع بسبب المكيفات، اضبط حرارتها معتدلة وتجنب التعرض المباشر للهواء البارد.' },
        { id: 'sunstroke', name: 'ضربة شمس وصداع', icon: 'fa-sun', color: '#3B82F6', symptoms: 'وجع رأس، دوخة، لعيان نفس من الحر', advice: 'اشرب كميات وفيرة من الماء، تجنب الخروج في أوقات الذروة، واستخدم واقي الشمس.' },
        { id: 'skin_allergy', name: 'حساسية وطفح جلدي', icon: 'fa-allergies', color: '#10B981', symptoms: 'حكة بالجلد، احمرار من الحر، وقرص حشرات', advice: 'لتجنب حساسية الصيف، استخدم كريمات مرطبة وتجنب التعرض المباشر لأشعة الشمس الحارقة.' }
    ],
    winter: [
        { id: 'flu', name: 'إنفلونزا ونزلة صدرية', icon: 'fa-virus-covid', color: '#DC2626', symptoms: 'سعال قحّة، حرارة، وسيلان أنف', advice: 'للوقاية من الإنفلونزا، غسل اليدين ضروري، وتجنب الزحام، وخذ قسطاً من الراحة إذا شعرت بالتعب.' },
        { id: 'throat_ear', name: 'التهاب حلق وأذن', icon: 'fa-ear-listen', color: '#F59E0B', symptoms: 'ألم بالبلع، وجع أذن، والتهاب لوز', advice: 'التهاب الحلق والأذن يزداد في البرد، اشرب سوائل دافئة واغلق النوافذ ليلاً.' },
        { id: 'joints', name: 'آلام مفاصل وروماتيزم', icon: 'fa-bone', color: '#3B82F6', symptoms: 'وجع ظهر، وتيبّس ركب ومفاصل مع البرد', advice: 'لتحسين آلام المفاصل في الشتاء، حافظ على دفء جسمك وتجنب التيارات الهوائية الباردة.' },
        { id: 'asthma', name: 'ضيق تنفس وحساسية', icon: 'fa-lungs', color: '#10B981', symptoms: 'ألم بالصدر وضيق في التنفس', advice: 'مرضى الربو يجب عليهم حمل البخاخ الوقائي وتجنب الغبار والدخان.' }
    ]
};
window.openRahebaRadar = () => {
    openCtrlPanel('رادار الرحيبة الصحي (التفاعلي) 📡', `
        <div class="flex flex-col gap-6">
            <div class="flex justify-center gap-3 bg-white p-2 rounded-2xl shadow-sm max-w-md mx-auto w-full">
                <button id="tabSummer" onclick="switchRadarTab('summer')" class="tab-btn active flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2">☀️ <span>حالات الصيف</span></button>
                <button id="tabWinter" onclick="switchRadarTab('winter')" class="tab-btn flex-1 py-3 rounded-xl font-bold text-sm text-gray-500 flex items-center justify-center gap-2">❄️ <span>حالات الشتاء</span></button>
            </div>
            <div id="radarCardsContainer" class="grid grid-cols-1 sm:grid-cols-2 gap-4"></div>
            <div class="text-center mt-4 p-6 bg-white rounded-2xl shadow-sm border" style="border-color: var(--border)">
                <p class="text-sm text-gray-600 mb-4">إذا كنت تعاني من أحد هذه الأعراض، ساعد مجتمعك بتسجيل حالتك لمتابعة انتشار الأمراض.</p>
                <button onclick="openRadarRegisterModal()" class="pulse-register bg-red-500 text-white px-10 py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-red-600 transition-all w-full sm:w-auto">➕ سَجّل حالتك الصحية الآن</button>
            </div>
        </div>
    `, '#4F46E5');
    supabase.from('radar_settings').select('*').eq('id', 'config').single().then(({ data }) => {
        if (data) { radarSettings = data; currentRadarTab = data.default_season || 'summer'; switchRadarTab(currentRadarTab); } 
        else { supabase.from('radar_settings').upsert({ id: 'config', default_season: 'summer', last_reset: 0 }); switchRadarTab('summer'); }
    });
    fetchRadarReports();
}
async function fetchRadarReports() {
    const { data } = await supabase.from('disease_reports').select('*');
    latestRadarReports = data || [];
    renderRadarCards();
}
window.switchRadarTab = (season) => {
    currentRadarTab = season;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active', 'text-gray-500'));
    const tabS = document.getElementById('tabSummer'); const tabW = document.getElementById('tabWinter');
    if (tabS && tabW) { if (season === 'summer') { tabS.classList.add('active'); tabW.classList.add('text-gray-500'); } else { tabW.classList.add('active'); tabS.classList.add('text-gray-500'); } }
    renderRadarCards();
}
function renderRadarCards() {
    const container = document.getElementById('radarCardsContainer'); if (!container) return;
    const diseases = radarDiseasesData[currentRadarTab];
    const validReports = latestRadarReports.filter(r => new Date(r.timestamp).getTime() > (radarSettings.last_reset || 0));
    const seasonReports = validReports.filter(r => r.season === currentRadarTab);
    let counts = {}, newTodayCounts = {}, ongoingCounts = {};
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0); const todayTime = startOfToday.getTime();
    seasonReports.forEach(r => {
        const time = new Date(r.timestamp).getTime();
        counts[r.disease_id] = (counts[r.disease_id] || 0) + 1;
        if (time >= todayTime) { newTodayCounts[r.disease_id] = (newTodayCounts[r.disease_id] || 0) + 1; } 
        else { ongoingCounts[r.disease_id] = (ongoingCounts[r.disease_id] || 0) + 1; }
    });
    container.innerHTML = diseases.map(d => {
        const count = counts[d.id] || 0; const newToday = newTodayCounts[d.id] || 0; const ongoing = ongoingCounts[d.id] || 0;
        let badgeText = "وضع طبيعي 🟢", badgeColor = "#10B981", badgeBg = "#D1FAE5", barColor = "#10B981";
        if (count >= 21 && count <= 50) { badgeText = "انتشار متوسط 🟡"; badgeColor = "#F59E0B"; badgeBg = "#FEF3C7"; barColor = "#F59E0B"; } 
        else if (count > 50) { badgeText = "تنبيه انتشار 🔴"; badgeColor = "#DC2626"; badgeBg = "#FEE2E2"; barColor = "#DC2626"; }
        let barWidth = Math.min(100, (count / 50) * 100); 
        return `<div class="p-5 rounded-2xl border transition-all duration-300 hover:shadow-lg cursor-pointer" style="background: var(--card); border-color: var(--border);" onclick="toggleRadarTip('${d.id}')"><div class="flex items-center justify-between mb-4"><div class="flex items-center gap-3"><div class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style="background: ${d.color}20; color: ${d.color};"><i class="fas ${d.icon}"></i></div><div><h4 class="font-bold text-base" style="color: var(--fg);">${d.name}</h4><p class="text-[11px]" style="color: var(--muted);">${d.symptoms}</p></div></div><span class="text-[10px] font-black px-2 py-1 rounded-lg" style="color: ${badgeColor}; background: ${badgeBg};">${badgeText}</span></div><div class="flex justify-between items-center text-xs mb-2"><span class="font-bold" style="color: var(--fg-light);">${count} حالة مسجلة</span></div><div class="flex justify-between text-[11px] mb-3 font-semibold" style="color: var(--muted);"><span>⚡ حالة جديدة اليوم: ${newToday}</span><span>⏳ حالات سابقة: ${ongoing}</span></div><div class="w-full rounded-full h-2.5" style="background: var(--bg-deep);"><div class="h-2.5 rounded-full transition-all duration-700" style="width: ${barWidth}%; background: ${barColor};"></div></div><div id="radarTip_${d.id}" class="hidden mt-4 p-3 rounded-xl text-xs flex items-start gap-2" style="background: rgba(37, 99, 235, 0.1); color: var(--fg-light); border: 1px solid rgba(37, 99, 235, 0.2);"><i class="fas fa-lightbulb mt-0.5" style="color: #2563EB;"></i><div><b style="color: #2563EB;">نصيحة الرادار:</b> ${d.advice}</div></div></div>`;
    }).join('');
}
window.toggleRadarTip = (id) => { const tipDiv = document.getElementById(`radarTip_${id}`); if (tipDiv) tipDiv.classList.toggle('hidden'); };
window.openRadarRegisterModal = () => {
    let lastVoteTime = 0;
    try { lastVoteTime = parseInt(localStorage.getItem('lastRadarVoteTime') || '0'); } catch(e) {}
    if (lastVoteTime > 0) {
        let diff = Date.now() - lastVoteTime; let cooldown = 3 * 24 * 60 * 60 * 1000;
        if (diff < cooldown) { let daysLeft = Math.ceil((cooldown - diff) / (24 * 60 * 60 * 1000)); showToast(`شُكراً لك! يمكنك تسجيل حالة جديدة بعد ${daysLeft} أيام لمراقبة تطور الحالة.`); return; }
    }
    const diseases = radarDiseasesData[currentRadarTab];
    const optionsHtml = diseases.map((d, index) => `
        <label class="flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer hover:bg-gray-50 transition-all" style="border-color: ${index === 0 ? d.color : '#e5e7eb'}" onclick="selectRadarOption(this, '${d.id}')">
            <input type="radio" name="radarDisease" class="hidden" ${index === 0 ? 'checked' : ''}>
            <i class="fas ${d.icon} text-xl" style="color: ${d.color};"></i>
            <div><div class="font-bold text-sm">${d.name}</div><div class="text-[10px] text-gray-500">${d.symptoms}</div></div>
        </label>
    `).join('');
    document.getElementById('modalContent').innerHTML = `
        <div class="p-6">
            <div class="flex justify-between items-center mb-6"><h3 class="font-bold text-xl">تسجيل حالة صحية</h3><button onclick="closeModal()" class="text-2xl hover:text-gray-400">&times;</button></div>
            <p class="text-sm text-gray-500 mb-4">اختر الفئة التي تعاني منها:</p>
            <div id="radarModalOptions" class="flex flex-col gap-3 mb-6">${optionsHtml}</div>
            <div class="mb-6"><label class="block text-sm font-semibold mb-2">منذ متى تعاني من هذه الأعراض؟</label><select id="radarDuration" class="ctrl-input text-sm"><option value="يوم واحد">يوم واحد</option><option value="2-3 أيام">2-3 أيام</option><option value="أكثر من أسبوع">أكثر من أسبوع</option></select></div>
            <button onclick="submitRadarVote()" class="w-full bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600 transition-all">تأكيد التسجيل</button>
        </div>`;
    document.getElementById('modalOverlay').classList.add('active'); lockScroll();
    window.selectedRadarDisease = diseases[0].id;
}
window.selectRadarOption = (element, id) => { document.querySelectorAll('#radarModalOptions label').forEach(l => l.style.borderColor = '#e5e7eb'); element.style.borderColor = '#0E7C5F'; window.selectedRadarDisease = id; }
window.submitRadarVote = async () => {
    if (!window.selectedRadarDisease) return;
    const duration = document.getElementById('radarDuration').value;
    try {
        await supabase.from('disease_reports').insert([{ disease_id: window.selectedRadarDisease, season: currentRadarTab, duration: duration, timestamp: new Date().toISOString() }]);
        localStorage.setItem('lastRadarVoteTime', Date.now().toString());
        closeModal(); showToast('تم تسجيل حالتك بنجاح!');
        fetchRadarReports();
        setTimeout(() => {
            document.getElementById('modalContent').innerHTML = `<div class="p-8 text-center"><div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><i class="fas fa-heart text-4xl text-red-500"></i></div><h3 class="font-bold text-xl mb-2 text-gray-800">نتمنى لك الشفاء العاجل!</h3><p class="text-sm text-gray-500 mb-6">تم إضافتك لرادار الرحيبة الصحي. ساهم تسجيلك في حماية المجتمع.</p><button onclick="redirectToDoctorsSearch()" class="w-full bg-blue-500 text-white py-4 rounded-xl font-bold mb-2 hover:bg-blue-600 transition-all">👨‍⚕️ تواصل مع الأطباء المتاحين الآن</button><button onclick="closeModal()" class="text-gray-400 py-2 text-sm hover:text-gray-600">إغلاق</button></div>`;
            document.getElementById('modalOverlay').classList.add('active');
        }, 300);
    } catch (err) { showToast('حدث خطأ'); }
}
window.redirectToDoctorsSearch = () => {
    closeModal(); closeCtrlPanel();
    const doctorsSection = document.getElementById('doctors');
    if (doctorsSection) doctorsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => {
        const searchInput = document.getElementById('inlineSearch') || document.getElementById('heroSearch');
        if (searchInput) {
            searchInput.focus();
            searchInput.style.transition = 'box-shadow 0.4s ease';
            searchInput.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.5)';
            setTimeout(() => { searchInput.style.boxShadow = ''; }, 3000);
        }
    }, 1000); 
};
window.setRadarDefaultSeason = async () => { try { await supabase.from('radar_settings').upsert({ id: 'config', default_season: document.getElementById('adminRadarSeason').value, last_reset: radarSettings.last_reset || 0 }); showToast("تم تحديث الفصل الافتراضي"); } catch (e) {} };
window.resetRadarVotes = async () => { try { await supabase.from('radar_settings').upsert({ id: 'config', default_season: radarSettings.default_season, last_reset: Date.now() }); showToast("تم تصفير العدادات بنجاح"); } catch (e) {} };

// === 11. Smart Vaccine Scheduler ===
const vaccineSchedule = [
    { age: 'عند الولادة', months: 0, name: 'لقاح السل (BCG) وشلل الأطفال (OPV-0)', notes: 'يُعطى في المشفى خلال الأيام الأولى من الولادة.' },
    { age: 'الشهر الثاني', months: 2, name: 'الخماسي (Pentavalent) + شلل الأطفال (OPV-1) + شلل الأطفال الحقن (IPV)', notes: 'يُعطى في المركز الصحي.' },
    { age: 'الشهر الرابع', months: 4, name: 'الخماسي (Pentavalent) + شلل الأطفال (OPV-2)', notes: 'جرعة ثانية.' },
    { age: 'الشهر السادس', months: 6, name: 'الخماسي (Pentavalent) + شلل الأطفال (OPV-3) + شلل الأطفال الحقن (IPV)', notes: 'جرعة ثالثة وأخيرة للخماسي.' },
    { age: 'الشهر التاسع', months: 9, name: 'لقاح الحصبة (MR)', notes: 'جرعة أولى للحصبة والحصبة الألمانية.' },
    { age: 'الشهر الخامس عشر', months: 15, name: 'جرعة منشطة للحصبة (MR)', notes: 'جرعة ثانية منشطة.' },
    { age: 'سنة ونصف (18 شهر)', months: 18, name: 'المنشطة الأولى للخماسي وشلل الأطفال', notes: 'جرعة منشطة (DTP+OPV).' },
    { age: '4 إلى 6 سنوات', months: 54, name: 'المنشطة الثانية للخماسي وشلل الأطفال', notes: 'يُعطى قبل دخول المدرسة.' }
];
window.openVaccineScheduler = () => {
    openCtrlPanel('حاسبة جدول لقاحات الطفل', `
        <div class="flex flex-col gap-5">
            <div class="bg-orange-50 border border-orange-200 rounded-xl p-4 text-orange-800 text-sm flex items-center gap-3"><i class="fas fa-syringe text-xl"></i><span>أدخل تاريخ ميلاد طفلك لحساب مواعيد اللقاحات بدقة ومعرفة اللقاح المستحق حالياً.</span></div>
            <div class="bg-white p-5 rounded-xl border" style="border-color: var(--border)">
                <label class="block text-sm font-semibold mb-2">تاريخ ميلاد الطفل:</label>
                <input type="date" id="vaccBirthDate" class="ctrl-input" required>
                <button onclick="calcVaccines()" class="w-full mt-4 py-3 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90" style="background: #F97316;"><i class="fas fa-calculator ml-2"></i> احسب جدول اللقاحات</button>
            </div>
            <div id="vaccResult" class="hidden flex flex-col gap-3"></div>
        </div>
    `, '#F97316');
}
window.calcVaccines = () => {
    const dateVal = document.getElementById('vaccBirthDate').value;
    if (!dateVal) { showToast('الرجاء إدخال تاريخ الميلاد'); return; }
    const birthDate = new Date(dateVal);
    const today = new Date();
    const diffTime = today - birthDate;
    const diffMonths = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30.44));
    if (diffMonths < 0 || diffMonths > 72) { showToast('تاريخ الميلاد غير منطقي'); return; }
    const resultContainer = document.getElementById('vaccResult');
    resultContainer.classList.remove('hidden');
    let html = `<div class="bg-white p-4 rounded-xl border text-center mb-2" style="border-color: var(--border)"><div class="text-sm text-gray-500">عمر الطفل الحالي</div><div class="text-2xl font-black text-orange-600">${diffMonths} شهر</div></div>`;
    html += vaccineSchedule.map(v => {
        const vaccDate = new Date(birthDate); vaccDate.setMonth(vaccDate.getMonth() + v.months);
        const isPast = diffMonths > v.months + 1; const isDue = diffMonths >= v.months && diffMonths <= v.months + 1;
        let statusBadge = '', cardClass = 'border-gray-200 bg-gray-50', textColor = 'text-gray-500';
        if (isPast) { statusBadge = `<span class="text-xs px-2 py-1 rounded bg-green-100 text-green-700 inline-block mb-2"><i class="fas fa-check-circle"></i> تم تنفيذه</span>`; } 
        else if (isDue) { cardClass = 'border-orange-400 bg-orange-50 shadow-md'; textColor = 'text-orange-800'; statusBadge = `<span class="text-xs px-2 py-1 rounded bg-orange-200 text-orange-900 inline-block mb-2 animate-pulse font-bold"><i class="fas fa-exclamation-circle"></i> مستحق الآن</span>`; } 
        else { statusBadge = `<span class="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 inline-block mb-2"><i class="fas fa-clock"></i> قادم قريباً</span>`; }
        const formattedDate = vaccDate.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
        return `<div class="p-4 rounded-xl border ${cardClass} transition-all">${statusBadge}<div class="font-bold ${textColor} text-sm">${v.name}</div><div class="text-xs text-gray-400 mt-1">عمر الطفل وقتها: ${v.age}</div><div class="text-xs font-semibold text-gray-600 mt-1">الموعد المقترح: ${formattedDate}</div>${v.notes ? `<div class="text-xs mt-2 pt-2 border-t border-dashed" style="border-color:var(--border); color: var(--muted)"><i class="fas fa-info-circle"></i> ${v.notes}</div>` : ''}</div>`;
    }).join('');
    resultContainer.innerHTML = html;
}

// نهاية ملف app.js
