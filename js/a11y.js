/**
 * محرك إمكانية الوصول والتوافقية مع قارئات الشاشة (A11y Engine)
 * متوافق تماماً مع معايير WCAG 2.1 AA وقارئات الشاشة (TalkBack, NVDA, Jaws, VoiceOver)
 */

class A11yEngine {
  constructor() {
    this.liveRegion = null;
    this.assertiveRegion = null;
    this.initLiveRegions();
    this.initTheme();
  }

  initLiveRegions() {
    // منطقة الإعلانات العادية (Polite)
    this.liveRegion = document.createElement('div');
    this.liveRegion.id = 'a11y-live-polite';
    this.liveRegion.className = 'sr-only';
    this.liveRegion.setAttribute('role', 'status');
    this.liveRegion.setAttribute('aria-live', 'polite');
    this.liveRegion.setAttribute('aria-atomic', 'true');
    document.body.appendChild(this.liveRegion);

    // منطقة الإعلانات العاجلة (Assertive)
    this.assertiveRegion = document.createElement('div');
    this.assertiveRegion.id = 'a11y-live-assertive';
    this.assertiveRegion.className = 'sr-only';
    this.assertiveRegion.setAttribute('role', 'alert');
    this.assertiveRegion.setAttribute('aria-live', 'assertive');
    this.assertiveRegion.setAttribute('aria-atomic', 'true');
    document.body.appendChild(this.assertiveRegion);
  }

  /**
   * إرسال إشعار صوتي فوري لقارئ الشاشة
   * @param {string} message نص الإشعار
   * @param {'polite'|'assertive'} priority مستوى الأولوية
   */
  announce(message, priority = 'polite') {
    const target = priority === 'assertive' ? this.assertiveRegion : this.liveRegion;
    if (!target) return;

    // مسح المحتوى السابق لضمان نطق النص الجديد حتى لو تطابق
    target.textContent = '';
    setTimeout(() => {
      target.textContent = message;
    }, 50);
  }

  /**
   * نقل تركيز قارئ الشاشة إلى عنصر معين بسلاسة
   * @param {HTMLElement|string} elementOrSelector
   */
  focusElement(elementOrSelector) {
    const el = typeof elementOrSelector === 'string' 
      ? document.querySelector(elementOrSelector) 
      : elementOrSelector;

    if (!el) return;
    if (!el.hasAttribute('tabindex')) {
      el.setAttribute('tabindex', '-1');
    }
    el.focus();
  }

  initTheme() {
    const savedTheme = localStorage.getItem('edutest_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('edutest_theme', next);
    this.announce(next === 'dark' ? 'تم تفعيل الوضع الليلي' : 'تم تفعيل الوضع النهاري');
  }
}

window.a11y = new A11yEngine();
