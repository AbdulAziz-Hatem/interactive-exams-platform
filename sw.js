/**
 * عامل الخدمة المتقدم لتشغيل منصة مدارج دون اتصال (Offline Service Worker)
 * معتمد لقسم القرآن الكريم وعلومه — كلية التربية، جامعة صنعاء
 * يوفر استجابة فورية 0ms للواجهات، وحفظاً محلياً للاختبارات عند انقطاع الإنترنت
 */

const CACHE_NAME = 'madarej-cache-v1.0.1';

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
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable.png'
];

// تثبيت عامل الخدمة وتخزين الأصول الأساسية
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] جاري تخزين أصول منصة مدارج للاستخدام دون اتصال...');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// تفعيل عامل الخدمة وتنظيف الإصدارات القديمة
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

// معالجة طلبات الشبكة (Stale-While-Revalidate للأصول الثابتة و Network-First للبيانات)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. تجاهل طلبات غير الـ GET
  if (event.request.method !== 'GET') {
    return;
  }

  // 2. إذا كان الطلب إلى السحابة (Supabase API)
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
        .catch(() => {
          // استرجاع أحدث نسخة محفوظة سحابياً عند انقطاع الإنترنت
          return caches.match(event.request);
        })
    );
    return;
  }

  // 3. لبقية ملفات الموقع (HTML, CSS, JS, Icons): Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // عند الفشل التام في جلب صفحة HTML جديدة، استرجع الصفحة الرئيسية
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('./index.html');
          }
        });

      return cachedResponse || fetchPromise;
    })
  );
});
