// Arsa Coffee — menü, masadan sipariş, garson çağır, Arsa Kart, hava, dil.
// Demo: sipariş ve garson istekleri hiçbir yere gönderilmez; sepet ve damgalar tarayıcıda (localStorage) durur.
document.documentElement.classList.add('js');

const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('arsa:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('arsa:' + k, JSON.stringify(v)); } catch {} },
};
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MENU = window.ARSA_MENU || [];
const ITEMS = MENU.flatMap(g => g.items.map(([ad, fiyat, tr, en]) => ({ id: g.id + ':' + ad, ad, fiyat, tr, en, group: g })));

// ---------- Dil ----------
let lang = store.get('lang', (navigator.language || 'tr').startsWith('tr') ? 'tr' : 'en');
const T = {
  tr: {
    all: 'Hepsi', add: 'Sepete ekle', noResult: 'Bunu bulamadık. Kasaya sor, belki vardır.',
    open: d => `Şu an açık · kapanışa ${d}`, closed: t => `Şu an kapalı · ${t}'da açılıyor`, h: 'sa', m: 'dk',
    cart: n => `Sepet · ${n}`, table: n => `Masa ${n}`, empty: 'Sepetin boş. Menüde bir şeyin yanındaki + işaretine dokun.',
    toTable: 'Masaya', pickup: 'Gel-al', tableNo: 'Masa no', choose: 'Seç', note: 'Not', notePh: 'Ör. yulaf sütü, az buz',
    send: 'Siparişi gönder', priceNote: 'Ödeme kasada ya da masada.', demo: 'Bu sayfa bir önizlemedir; sipariş kafeye iletilmez.',
    st1: 'Sipariş alındı', st2: 'Barista hazırlıyor', st3t: 'Masana geliyor', st3p: 'Teslime hazır', now: 'şimdi', min5: '~5 dk',
    newOrder: 'Yeni sipariş', added: ad => `${ad} sepette`, sent: w => `Siparişin bara düştü · ${w}`,
    w: [['garson', 'Garson çağır', 'Masana gelsin', 'Garson masana geliyor'], ['hesap', 'Hesap iste', 'Nakit ya da kart', 'Hesabın hazırlanıyor'],
        ['su', 'Su ve peçete', 'Hemen getirelim', 'Su ve peçete yolda'], ['temiz', 'Masa temizliği', 'Masayı toparlayalım', 'Masan birazdan toparlanacak']],
    needTable: 'Önce masa numaranı seç', stamps: n => n >= 8 ? 'Sekizinci kahve bizden. Kasada kartını göster.' : n ? `${8 - n} kahve daha, sonrası bizden.` : 'İlk damgan için bir kahve sipariş et.',
    wx: (t, d, s) => `Bahçede şu an ${t}° · ${d} · gün batımı ${s}`,
    codes: { 0: 'açık', 1: 'az bulutlu', 2: 'parçalı bulutlu', 3: 'kapalı', 45: 'sisli', 51: 'çiseliyor', 61: 'yağmurlu', 71: 'karlı', 80: 'sağanak', 95: 'fırtınalı' },
  },
  en: {
    all: 'All', add: 'Add to order', noResult: "Couldn't find that. Ask at the bar, we might have it.",
    open: d => `Open now · closes in ${d}`, closed: t => `Closed now · opens at ${t}`, h: 'h', m: 'min',
    cart: n => `Order · ${n}`, table: n => `Table ${n}`, empty: 'Your order is empty. Tap + next to anything on the menu.',
    toTable: 'To my table', pickup: 'Pick up', tableNo: 'Table', choose: 'Choose', note: 'Note', notePh: 'e.g. oat milk, less ice',
    send: 'Send order', priceNote: 'Pay at the bar or at your table.', demo: 'This page is a preview; orders are not sent to the café.',
    st1: 'Order received', st2: 'Barista is on it', st3t: 'On its way to you', st3p: 'Ready to pick up', now: 'now', min5: '~5 min',
    newOrder: 'New order', added: ad => `${ad} added`, sent: w => `Your order is at the bar · ${w}`,
    w: [['garson', 'Call a waiter', 'Someone comes over', 'A waiter is on the way'], ['hesap', 'The bill', 'Cash or card', 'Your bill is coming'],
        ['su', 'Water & napkins', "We'll bring them", 'Water and napkins on the way'], ['temiz', 'Clean the table', "We'll tidy up", 'Your table will be cleared shortly']],
    needTable: 'Choose your table first', stamps: n => n >= 8 ? 'Your eighth coffee is on us. Show your card at the bar.' : n ? `${8 - n} more coffees and the next one is on us.` : 'Order a coffee to earn your first stamp.',
    wx: (t, d, s) => `In the garden now: ${t}° · ${d} · sunset ${s}`,
    codes: { 0: 'clear', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'foggy', 51: 'drizzle', 61: 'rain', 71: 'snow', 80: 'showers', 95: 'storms' },
  },
};
const t = k => T[lang][k];

function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-en]').forEach(n => {
    if (n.dataset.tr == null) n.dataset.tr = n.textContent;
    n.textContent = lang === 'en' ? n.dataset.en : n.dataset.tr;
  });
  document.querySelectorAll('[data-en-html]').forEach(n => {
    if (n.dataset.trHtml == null) n.dataset.trHtml = n.innerHTML;
    n.innerHTML = lang === 'en' ? n.dataset.enHtml : n.dataset.trHtml;
  });
  document.querySelectorAll('[data-en-ph]').forEach(n => {
    if (n.dataset.trPh == null) n.dataset.trPh = n.placeholder;
    n.placeholder = lang === 'en' ? n.dataset.enPh : n.dataset.trPh;
  });
  $('lang').textContent = lang === 'en' ? 'TR' : 'EN';
  $('lang').setAttribute('aria-label', lang === 'en' ? 'Türkçeye geç' : 'Switch to English');
  renderTabs(); renderMenu(); tickStatus(); renderWeather(); renderKart(); renderDock();
}
$('lang').addEventListener('click', () => { lang = lang === 'en' ? 'tr' : 'en'; store.set('lang', lang); applyLang(); });

// ---------- Sepet durumu ----------
let cart = store.get('cart', {});
let table = new URLSearchParams(location.search).get('masa') || store.get('table', '');
if (new URLSearchParams(location.search).get('masa')) store.set('table', table);
const count = () => Object.values(cart).reduce((a, b) => a + b, 0);
function saveCart() { store.set('cart', cart); renderDock(); markRows(); }
function add(id) {
  cart[id] = (cart[id] || 0) + 1; saveCart();
  const it = ITEMS.find(i => i.id === id); toast(t('added')(it.ad));
  const c = $('dockCart'); c.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'cubic-bezier(.16,1,.3,1)' });
}

// ---------- Menü ----------
const fmt = n => n == null ? '' : n.toLocaleString('tr-TR') + ' ₺';
let filter = 'hepsi', query = '';
function renderTabs() {
  const tabs = $('tabs');
  tabs.innerHTML = '';
  [{ id: 'hepsi', title: t('all'), titleEn: t('all') }, ...MENU].forEach(g => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = lang === 'en' ? g.titleEn : g.title; b.dataset.id = g.id;
    b.setAttribute('aria-pressed', g.id === filter);
    b.addEventListener('click', () => { filter = g.id; [...tabs.children].forEach(x => x.setAttribute('aria-pressed', x === b)); renderMenu(true); });
    tabs.appendChild(b);
  });
}
function renderMenu(animate) {
  const list = $('menu-list');
  const q = query.trim().toLocaleLowerCase('tr');
  const groups = MENU.filter(g => filter === 'hepsi' || g.id === filter).map(g => ({
    g, items: g.items.filter(([ad, , tr, en]) => !q || (ad + ' ' + tr + ' ' + en).toLocaleLowerCase('tr').includes(q)),
  })).filter(x => x.items.length);
  list.innerHTML = groups.length ? groups.map(({ g, items }) => `<div class="group"><h3>${lang === 'en' ? g.titleEn : g.title}</h3>${
    items.map(([ad, fiyat, tr, en]) => {
      const id = g.id + ':' + ad, desc = lang === 'en' ? en : tr;
      return `<div class="row" data-id="${id}"><b>${ad}</b>${fiyat != null ? `<em>${fmt(fiyat)}</em>` : ''}${desc ? `<span>${desc}</span>` : ''}<button type="button" class="add" aria-label="${ad}: ${t('add')}"><span>+</span></button></div>`;
    }).join('')}</div>`).join('') : `<p class="soft">${t('noResult')}</p>`;
  markRows();
  if (animate && !reduced) list.querySelectorAll('.row').forEach((r, i) => r.animate?.(
    [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
    { duration: 500, delay: Math.min(i, 12) * 35, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
}
function markRows() {
  document.querySelectorAll('#menu-list .row').forEach(r => {
    const n = cart[r.dataset.id] || 0, s = r.querySelector('.add span');
    r.classList.toggle('in-cart', n > 0); s.textContent = n ? n : '+';
  });
}
$('menu-list').addEventListener('click', e => { const b = e.target.closest('.add'); if (b) add(b.closest('.row').dataset.id); });
$('q').addEventListener('input', e => { query = e.target.value; renderMenu(); });

// ---------- Açık mı? ----------
function nowIst() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date()).map(x => [x.type, x.value]));
  return { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday), min: +p.hour * 60 + +p.minute };
}
function tickStatus() {
  const el = $('status'), { day, min } = nowIst();
  const opensAt = day === 0 ? 18 * 60 : 9 * 60, open = min >= opensAt;
  const left = open ? 24 * 60 - min : opensAt - min, h = Math.floor(left / 60), m = left % 60;
  el.classList.toggle('open', open);
  el.lastElementChild.textContent = open ? t('open')((h ? `${h} ${t('h')} ` : '') + `${m} ${t('m')}`) : t('closed')(day === 0 ? '18.00' : '09.00');
  document.querySelectorAll('#hours [data-days]').forEach(n => n.classList.toggle('today', n.dataset.days.split(',').includes(String(day))));
}
setInterval(tickStatus, 30000);

// ---------- Hava (Open-Meteo, anahtarsız) ----------
let wx = null;
function renderWeather() {
  if (!wx) return;
  const keys = Object.keys(T.tr.codes).map(Number).filter(k => k <= wx.code);
  const desc = t('codes')[keys.length ? Math.max(...keys) : 0];
  const line = t('wx')(Math.round(wx.temp), desc, wx.sunset);
  ['weather', 'weather2'].forEach(id => { const n = $(id); n.textContent = line; n.hidden = false; });
}
fetch('https://api.open-meteo.com/v1/forecast?latitude=36.6476&longitude=29.1285&current=temperature_2m,weather_code&daily=sunset&timezone=Europe%2FIstanbul&forecast_days=1')
  .then(r => r.ok ? r.json() : Promise.reject())
  .then(d => { wx = { temp: d.current.temperature_2m, code: d.current.weather_code, sunset: d.daily.sunset[0].slice(11).replace(':', '.') }; renderWeather(); })
  .catch(() => {});

// ---------- Dock ve sayfalar ----------
function renderDock() {
  const n = count();
  $('dock').hidden = !(n || table);
  $('dockCart').textContent = t('cart')(n);
  $('dockCart').hidden = !n;
  $('dockTable').hidden = !table;
  $('dockTable').textContent = table ? t('table')(table) : '';
}
function openSheet(id) {
  if (id === 'cart') renderCart();
  if (id === 'waiter') renderWaiter();
  const d = $(id); if (!d.open) d.showModal();
}
document.addEventListener('click', e => {
  const o = e.target.closest('[data-open]'); if (o) { e.preventDefault(); openSheet(o.dataset.open); }
  const c = e.target.closest('[data-close]'); if (c) c.closest('dialog').close();
});
document.querySelectorAll('dialog.sheet').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

const tableOptions = sel => `<option value="">${t('choose')}</option>` + Array.from({ length: 24 }, (_, i) => `<option${String(i + 1) === String(table) ? ' selected' : ''} value="${i + 1}">${t('table')(i + 1)}</option>`).join('');
let mode = 'masa';
function renderCart() {
  const body = $('cartBody'), ids = Object.keys(cart).filter(id => cart[id] > 0);
  if (!ids.length) { body.innerHTML = `<p class="soft">${t('empty')}</p>`; return; }
  const total = ids.reduce((s, id) => { const it = ITEMS.find(i => i.id === id); return it && it.fiyat != null ? s + it.fiyat * cart[id] : s; }, 0);
  body.innerHTML = `
    <ul class="lines">${ids.map(id => { const it = ITEMS.find(i => i.id === id); return it ? `<li data-id="${id}"><span>${it.ad}</span>
      <span class="qty"><button type="button" data-q="-1" aria-label="−">−</button><b>${cart[id]}</b><button type="button" data-q="1" aria-label="+">+</button></span></li>` : ''; }).join('')}</ul>
    ${total ? `<p class="total"><span>Toplam</span><b>${fmt(total)}</b></p>` : ''}
    <div class="seg" role="group"><button type="button" data-m="masa" aria-pressed="${mode === 'masa'}">${t('toTable')}</button><button type="button" data-m="gel" aria-pressed="${mode === 'gel'}">${t('pickup')}</button></div>
    <div class="fields">
      <label${mode === 'gel' ? ' hidden' : ''}>${t('tableNo')}<select id="cTable">${tableOptions()}</select></label>
      <label>${t('note')}<input id="cNote" placeholder="${t('notePh')}"></label>
    </div>
    <button type="button" class="btn wide" id="send">${t('send')}</button>
    <p class="fine">${t('priceNote')} ${t('demo')}</p>`;
  body.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => {
    const id = b.closest('li').dataset.id; cart[id] = Math.max(0, (cart[id] || 0) + +b.dataset.q);
    if (!cart[id]) delete cart[id]; saveCart(); renderCart();
  }));
  body.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.m; renderCart(); }));
  $('cTable')?.addEventListener('change', e => { table = e.target.value; store.set('table', table); renderDock(); });
  $('send').addEventListener('click', () => {
    if (mode === 'masa' && !table) { toast(t('needTable')); $('cTable').focus(); return; }
    const coffees = ids.reduce((s, id) => s + (ITEMS.find(i => i.id === id)?.group.kahve ? cart[id] : 0), 0);
    stamp(coffees);
    const where = mode === 'masa' ? t('table')(table) : t('pickup');
    cart = {}; saveCart();
    body.innerHTML = `<ol class="steps"><li class="on"><i></i><span>${t('st1')}</span><small>${t('now')}</small></li><li><i></i><span>${t('st2')}</span><small>${t('min5')}</small></li><li><i></i><span>${mode === 'masa' ? t('st3t') : t('st3p')}</span><small>${where}</small></li></ol>
      <p class="fine">${t('demo')}</p><button type="button" class="btn wide ghost" data-close>${t('newOrder')}</button>`;
    const steps = body.querySelectorAll('.steps li');
    setTimeout(() => steps[1]?.classList.add('on'), 2200);
    setTimeout(() => steps[2]?.classList.add('on'), 5200);
    toast(t('sent')(where));
  });
}
function renderWaiter() {
  const body = $('waiterBody');
  body.innerHTML = `<label class="fields one">${t('tableNo')}<select id="wTable">${tableOptions()}</select></label>
    <div class="asks">${t('w').map(([k, a, b]) => `<button type="button" data-w="${k}"><b>${a}</b><span>${b}</span></button>`).join('')}</div>
    <p class="fine">${t('demo')}</p>`;
  $('wTable').addEventListener('change', e => { table = e.target.value; store.set('table', table); renderDock(); });
  body.querySelectorAll('[data-w]').forEach(b => b.addEventListener('click', () => {
    if (!table) { toast(t('needTable')); $('wTable').focus(); return; }
    const msg = t('w').find(x => x[0] === b.dataset.w)[3];
    $('waiter').close(); toast(`${t('table')(table)} · ${msg}`);
  }));
}

// ---------- Arsa Kart ----------
function stamp(n) { if (!n) return; store.set('stamps', Math.min(8, store.get('stamps', 0) + n)); renderKart(true); }
function renderKart(pop) {
  const n = store.get('stamps', 0), wrap = $('stamps');
  wrap.innerHTML = Array.from({ length: 8 }, (_, i) => `<i class="${i < n ? 'on' : ''}${i === 7 ? ' free' : ''}"></i>`).join('');
  $('kartCount').textContent = `${n} / 8`;
  const msg = $('kartMsg'); msg.removeAttribute('data-en'); msg.textContent = t('stamps')(n);
  if (pop && !reduced) wrap.querySelectorAll('i.on').forEach((s, i) => s.animate?.([{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 500, delay: i * 50, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
}

// ---------- QR ----------
window.addEventListener('load', () => {
  const box = $('qr'), url = location.origin + location.pathname + '?masa=7#menu';
  if (window.QRCode) new QRCode(box, { text: url, width: 152, height: 152, colorDark: '#0f0d0a', colorLight: '#f4f4f2', correctLevel: QRCode.CorrectLevel.M });
  else box.hidden = true;
});

// ---------- Toast ----------
let tt;
function toast(msg) { const el = $('toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('on'), 2600); }

// ---------- Hero foto geçişi, girişler ----------
(function () {
  const imgs = document.querySelectorAll('.hero .big img');
  if (reduced || imgs.length < 2) return;
  let i = 0;
  setInterval(() => { if (document.hidden) return; imgs[i].classList.remove('on'); i = (i + 1) % imgs.length; imgs[i].classList.add('on'); }, 5600);
})();
(function () {
  const items = document.querySelectorAll('[data-in]');
  if (!('IntersectionObserver' in window)) { items.forEach(n => n.classList.add('in')); return; }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  items.forEach(n => io.observe(n));
})();

// ---------- Uygulama gibi (PWA) ----------
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

applyLang();
