/**
 * مدير تطبيق الويب التقدمي والمزامنة دون اتصال (PWA & Offline Controller)
 * منصة مدارج — قسم القرآن الكريم وعلومه، كلية التربية، جامعة صنعاء
 */

class PWAManager {
  constructor() {
    this.deferredPrompt = null;
    this.isOnline = navigator.onLine;
  }

  init() {
    // 1. تسجيل عامل الخدمة (Service Worker)
    this.registerServiceWorker();

    // 2. مراقبة حالة الاتصال بالإنترنت
    this.setupNetworkWatchers();

    // 3. التقاط حدث التثبيت على الهاتف (Install Prompt)
    this.setupInstallPrompt();
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(reg => {
            console.log('[PWA] تم تسجيل عامل الخدمة بنجاح لنطاق:', reg.scope);
            
            // التحقق من وجود تحديثات
            reg.onupdatefound = () => {
              const installingWorker = reg.installing;
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[PWA] تم تحديث نسخة التطبيق في الذاكرة المؤقتة');
                }
              };
            };
          })
          .catch(err => {
            console.warn('[PWA] تعذر تسجيل عامل الخدمة:', err);
          });
      });
    }
  }

  setupNetworkWatchers() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.showNetworkBanner(true);
      window.a11y?.announce('تمت استعادة الاتصال بالإنترنت. جاري مزامنة البيانات سحابياً.', 'polite');
      
      // مزامنة أي اختبارات معلقة تم إنجازها أثناء انقطاع النت
      if (window.db && typeof window.db.syncPendingSubmissions === 'function') {
        window.db.syncPendingSubmissions();
      }
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.showNetworkBanner(false);
      window.a11y?.announce('أنت الآن في وضع عدم الاتصال. تم تفعيل التخزين المحلي، ويمكنك مواصلة حل الاختبارات.', 'assertive');
    });

    // فحص أولي عند الفتح
    if (!this.isOnline) {
      setTimeout(() => this.showNetworkBanner(false), 1000);
    }
  }

  showNetworkBanner(isOnline) {
    let banner = document.getElementById('pwa-network-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'pwa-network-banner';
      banner.style.position = 'fixed';
      banner.style.bottom = '15px';
      banner.style.left = '50%';
      banner.style.transform = 'translateX(-50%)';
      banner.style.zIndex = '999';
      banner.style.padding = '0.65rem 1.25rem';
      banner.style.borderRadius = 'var(--radius-full, 9999px)';
      banner.style.fontSize = '0.9rem';
      banner.style.fontWeight = '700';
      banner.style.boxShadow = 'var(--shadow-md)';
      banner.style.display = 'flex';
      banner.style.alignItems = 'center';
      banner.style.gap = '0.5rem';
      banner.style.transition = 'all 0.3s ease';
      document.body.appendChild(banner);
    }

    if (isOnline) {
      banner.style.background = 'var(--success-light, #f0fdf4)';
      banner.style.color = 'var(--success, #166534)';
      banner.style.border = '1px solid #bbf7d0';
      banner.innerHTML = '<span> متصل بالإنترنت — تم حفظ البيانات سحابياً</span>';
      setTimeout(() => {
        banner.style.opacity = '0';
        setTimeout(() => banner.remove(), 400);
      }, 3500);
    } else {
      banner.style.background = 'var(--warning-light, #fff7ed)';
      banner.style.color = 'var(--warning, #9a3412)';
      banner.style.border = '1px solid #fed7aa';
      banner.style.opacity = '1';
      banner.innerHTML = '<span> وضع عدم الاتصال — يمكنك خوض الاختبارات ومذاكرة المسائل محلياً</span>';
    }
  }

  setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      // منع ظهور النافذة التلقائية الافتراضية
      e.preventDefault();
      this.deferredPrompt = e;

      // إظهار زر التثبيت الأنيق في القائمة الجانبية
      this.renderInstallButton();
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      console.log('[PWA] تم تثبيت تطبيق مدارج بنجاح على الجهاز');
      window.a11y?.announce('تم تثبيت تطبيق مدارج بنجاح على هاتفك');
      
      const btn = document.getElementById('pwa-install-btn');
      if (btn) btn.style.display = 'none';
    });
  }

  renderInstallButton() {
    const sidebarFooter = document.querySelector('.sidebar-footer');
    if (!sidebarFooter || document.getElementById('pwa-install-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'pwa-install-btn';
    btn.className = 'btn btn-primary btn-sm btn-block';
    btn.style.marginBottom = '0.5rem';
    btn.innerHTML = '<span> تثبيت التطبيق على الهاتف</span>';
    btn.setAttribute('aria-label', 'تثبيت منصة مدارج كتطبيق مستقل على شاشة هاتفك الرئيسية');

    btn.addEventListener('click', async () => {
      if (!this.deferredPrompt) return;

      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      console.log('[PWA] اختيار المستخدم لتثبيت التطبيق:', outcome);
      
      if (outcome === 'accepted') {
        window.a11y?.announce('جاري تثبيت التطبيق على جهازك...');
      }
      this.deferredPrompt = null;
      btn.style.display = 'none';
    });

    sidebarFooter.insertBefore(btn, sidebarFooter.firstChild);
  }
}

window.pwaManager = new PWAManager();
window.pwaManager.init();
