/**
 * عامل الخدمة المتقدم لتشغيل منصة مدارج دون اتصال (Offline Service Worker)
 * معتمد لقسم القرآن الكريم وعلومه — كلية التربية، جامعة صنعاء
 * الإصدار: v1.0.3
 * استراتيجية: Network-First للبرمجيات والصفحات و Cache-First للأصول
 */

const CACHE_NAME = 'madarej-cache-v1.0.3';

const STATIC_ASSETS = [
  './',
  './index.html',
  './auth.html',
  './dashboard.html',
  './subject.html',
  './exam.html',
  './result.html',
  './admin.html',
  './css/style.css',
  './js/config.js',
  './js/a11y.js',
  './js/auth.js',
  './js/db.js',
  './js/bookmarks.js',
  './js/exam.js',
  './js/pwa.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable.png'
];

// 1. تثبيت عامل الخدمة وتخزين الأصول الأساسية
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] جاري تثبيت كاش مدارج v1.0.3...');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 2. تفعيل عامل الخدمة وتنظيف الإصدارات القديمة فوراً
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] إزالة الكاش القديم:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. معالجة طلبات الشبكة
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // تجاهل طلبات غير الـ GET
  if (event.request.method !== 'GET') {
    return;
  }

  // أ) طلبات السحابة (Supabase API)
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const respClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, respClone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // ب) ملفات الواجهة والبرمجيات (HTML, JS, CSS): Network-First
  const isCodeOrMarkup = event.request.headers.get('accept')?.includes('text/html') ||
                         url.pathname.endsWith('.js') ||
                         url.pathname.endsWith('.css') ||
                         url.pathname.endsWith('.html') ||
                         url.pathname === '/';

  if (isCodeOrMarkup) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            if (event.request.headers.get('accept')?.includes('text/html')) {
              return caches.match('./index.html');
            }
          });
        })
    );
    return;
  }

  // ج) الأصول الثابتة والصور (Cache-First)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const respClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, respClone));
        }
        return response;
      });
    })
  );
});
