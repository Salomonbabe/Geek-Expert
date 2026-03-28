// ================================================================
// GEEK EXPERT — Service Worker
// Version: 2.0
// ================================================================

const CACHE_NAME = 'geek-expert-v2';
const OFFLINE_URL = '/index.html';

// Assets à mettre en cache lors de l'installation
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  // Fonts Google via CDN (ne peuvent pas être pré-cachées, on les met dans le cache réseau)
];

// ================================================================
// INSTALL
// ================================================================
self.addEventListener('install', event => {
  console.log('[SW] Installing Geek Expert v2...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_ASSETS).catch(err => {
        console.warn('[SW] Pre-cache partial failure:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ================================================================
// ACTIVATE
// ================================================================
self.addEventListener('activate', event => {
  console.log('[SW] Activating Geek Expert v2...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ================================================================
// FETCH — Stratégies de cache
// ================================================================
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ne pas intercepter les requêtes API Anthropic
  if (url.hostname === 'api.anthropic.com') {
    return; // Laisser passer directement
  }

  // Ne pas intercepter les requêtes Google OAuth / Drive
  if (url.hostname.includes('google') || url.hostname.includes('googleapis')) {
    return;
  }

  // Ne pas intercepter les requêtes vers le proxy
  if (request.url.includes('onrender.com') || request.url.includes('vercel.app')) {
    return;
  }

  // Pour les requêtes de navigation (HTML)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Met à jour le cache avec la nouvelle version
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // Hors ligne : servir depuis le cache
          return caches.match(OFFLINE_URL).then(cached => {
            return cached || new Response(offlinePage(), {
              headers: { 'Content-Type': 'text/html' }
            });
          });
        })
    );
    return;
  }

  // Pour les fonts Google (stale-while-revalidate)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(request).then(cached => {
          const networkFetch = fetch(request).then(response => {
            cache.put(request, response.clone());
            return response;
          }).catch(() => cached);
          return cached || networkFetch;
        });
      })
    );
    return;
  }

  // Pour les autres ressources statiques (cache-first)
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => new Response('', { status: 404 }));
      })
    );
    return;
  }
});

// ================================================================
// BACKGROUND SYNC (pour les messages hors-ligne)
// ================================================================
self.addEventListener('sync', event => {
  if (event.tag === 'sync-messages') {
    console.log('[SW] Background sync: syncing messages...');
    // Placeholder pour future implémentation
    event.waitUntil(Promise.resolve());
  }
});

// ================================================================
// PUSH NOTIFICATIONS (placeholder)
// ================================================================
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json().catch(() => ({ title: 'Geek Expert', body: event.data.text() }));
  event.waitUntil(
    data.then(d => self.registration.showNotification(d.title || 'Geek Expert', {
      body: d.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      tag: 'geek-expert-notification',
      renotify: true,
      data: d.url || '/',
    }))
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      const url = event.notification.data || '/';
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ================================================================
// MESSAGE HANDLER (communication avec le client)
// ================================================================
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

// ================================================================
// PAGE HORS-LIGNE de fallback
// ================================================================
function offlinePage() {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Geek Expert – Hors ligne</title>
  <style>
    body {
      font-family: 'Orbitron', monospace, sans-serif;
      background: #050a10;
      color: #00d4ff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      text-align: center;
      padding: 20px;
    }
    h1 { font-size: 24px; margin-bottom: 10px; }
    p { color: #6a8fa3; font-size: 14px; }
    .btn {
      margin-top: 24px;
      padding: 12px 24px;
      background: #00d4ff;
      color: #000;
      border: none;
      border-radius: 10px;
      font-weight: bold;
      cursor: pointer;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div style="font-size:64px;margin-bottom:20px">🤖</div>
  <h1>Geek Expert</h1>
  <h2 style="color:#6a8fa3;font-size:16px;font-weight:400">Pas de connexion Internet</h2>
  <p>L'application nécessite une connexion pour communiquer avec l'IA.<br/>Vérifie ta connexion et réessaie.</p>
  <button class="btn" onclick="window.location.reload()">↻ Réessayer</button>
</body>
</html>`;
}
