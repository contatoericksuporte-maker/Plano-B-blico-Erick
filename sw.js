/* ══════════════════════════════════════════
   Palavra Viva — Service Worker
   Versão: 2.0
   Responsável por: cache offline + notificações confiáveis
══════════════════════════════════════════ */

const CACHE_NAME = 'pviva-v2';
const ASSETS = ['/', '/index.html'];

/* ── Instalação: faz cache dos arquivos principais ── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

/* ── Ativação: limpa caches antigos ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ── Fetch: responde do cache quando offline ── */
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

/* ══════════════════════════════════════════
   ALARME DE LEMBRETE
   O app envia uma mensagem com a config do lembrete.
   O SW agenda um alarme e dispara a notificação no horário certo,
   mesmo com o app fechado (enquanto o SW estiver vivo).
══════════════════════════════════════════ */

let _alarmInterval = null;
let _reminderConfig = null;
let _lastFiredKey = null;

/* Recebe mensagens do app principal */
self.addEventListener('message', e => {
  if(e.data && e.data.type === 'SET_REMINDER') {
    _reminderConfig = e.data.config; // { time: "11:40", days: [0,1,2,3,4,5,6] }
    _lastFiredKey = null;
    startAlarm();
  }
  if(e.data && e.data.type === 'CLEAR_REMINDER') {
    _reminderConfig = null;
    if(_alarmInterval) clearInterval(_alarmInterval);
    _alarmInterval = null;
  }
});

function startAlarm() {
  if(_alarmInterval) clearInterval(_alarmInterval);
  // Verifica a cada 30 segundos
  _alarmInterval = setInterval(checkAlarm, 30000);
  checkAlarm(); // verifica imediatamente
}

function checkAlarm() {
  if(!_reminderConfig) return;
  const { time, days } = _reminderConfig;
  if(!time || !days || !days.length) return;

  const now = new Date();
  const [h, m] = time.split(':').map(Number);
  const fireKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${h}-${m}`;

  if(
    now.getHours() === h &&
    now.getMinutes() === m &&
    days.includes(now.getDay()) &&
    _lastFiredKey !== fireKey
  ) {
    _lastFiredKey = fireKey;
    fireNotification();
  }
}

function fireNotification() {
  const options = {
    body: 'Hora da sua leitura diária! Toque para abrir o plano.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'palavra-viva-lembrete',
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: { url: '/' }
  };

  self.registration.showNotification('📖 Palavra Viva', options);
}

/* Ao clicar na notificação, abre/foca o app */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for(const client of list) {
        if(client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow('/');
    })
  );
});
