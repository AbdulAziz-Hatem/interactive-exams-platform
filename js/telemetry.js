/**
 * وحدة الرصد التقني والتحليلات ونزاهة الاختبارات (Madarej Telemetry & Integrity Engine v1.0.4)
 * مخصصة حصرياً لمنصة «مَدَارِج» — كلية التربية، جامعة صنعاء
 * 
 * الوظائف:
 * 1. تحليل دقيق لوكيل المستخدم (User-Agent Parsing): نوع المتصفح، وإصداره، ونظام التشغيل، ونوع العتاد.
 * 2. تحديد مصدر الزيارة (Referrer Tracking): الكشف عن الدخول عبر تيليجرام، واتساب، فيسبوك، أو الروابط المباشرة.
 * 3. التقاط مواصفات البيئة والعرض: دقة الشاشة، أبعاد النافذة، المنطقة الزمنية، واللغة.
 * 4. رصد نزاهة الاختبار (Academic Integrity Monitoring): تتبع مغادرة الطالب لنافذة الامتحان (Tab-Switching / Window Blur).
 * 5. توليد وحفظ معرف جلسة فريد (First-Party Visitor/Session ID).
 */

class TelemetryManager {
  constructor() {
    this.sessionStartTime = Date.now();
    this.tabSwitchCount = 0;
    this.outOfFocusDurationMs = 0;
    this.lastBlurTime = null;
    this.isExamActive = false;
    this.visitorId = this.getOrCreateVisitorId();
    this.sessionId = this.generateSessionId();
  }

  // 1. توليد أو استرجاع معرف الزائر الفريد المعتمد للمنصة (First-Party ID)
  getOrCreateVisitorId() {
    try {
      let vid = localStorage.getItem('madarej_visitor_id');
      if (!vid) {
        vid = 'vid_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
        localStorage.setItem('madarej_visitor_id', vid);
      }
      return vid;
    } catch (e) {
      return 'vid_ephemeral';
    }
  }

  generateSessionId() {
    return 'ses_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
  }

  // 2. تحليل وكيل المستخدم بدقة عالية ودون مكتبات خارجية (Pure JS Parser)
  parseUserAgent() {
    const ua = navigator.userAgent || '';
    let browser = 'متصفح غير معروف';
    let browserVersion = '';
    let os = 'نظام غير معروف';
    let deviceType = 'حاسوب مكتبي (Desktop)';

    // تحديد نظام التشغيل
    if (/android/i.test(ua)) {
      deviceType = 'هاتف ذكي (Android Mobile)';
      const match = ua.match(/Android\s+([0-9.]+)/i);
      os = match ? `أندرويد ${match[1]}` : 'أندرويد';
    } else if (/iphone/i.test(ua)) {
      deviceType = 'آيفون (iPhone)';
      const match = ua.match(/OS\s+([0-9_]+)/i);
      os = match ? `iOS ${match[1].replace(/_/g, '.')}` : 'iOS';
    } else if (/ipad/i.test(ua)) {
      deviceType = 'جهاز لوحي (iPad)';
      os = 'iPadOS';
    } else if (/windows nt 10\.0/i.test(ua)) {
      os = 'ويندوز 10/11';
    } else if (/windows nt 6\.3/i.test(ua)) {
      os = 'ويندوز 8.1';
    } else if (/windows nt 6\.1/i.test(ua)) {
      os = 'ويندوز 7';
    } else if (/macintosh|mac os x/i.test(ua)) {
      os = 'ماك (macOS)';
    } else if (/linux/i.test(ua)) {
      os = 'لينكس (Linux)';
    }

    // تحديد نوع المتصفح بدقة
    if (/edg\//i.test(ua)) {
      browser = 'مايكروسوفت إيدج (Edge)';
      const match = ua.match(/Edg\/([0-9.]+)/i);
      if (match) browserVersion = match[1];
    } else if (/samsungbrowser/i.test(ua)) {
      browser = 'متصفح سامسونج (Samsung Internet)';
      const match = ua.match(/SamsungBrowser\/([0-9.]+)/i);
      if (match) browserVersion = match[1];
    } else if (/chrome|crios/i.test(ua) && !/edg\//i.test(ua)) {
      browser = 'جوجل كروم (Chrome)';
      const match = ua.match(/(?:Chrome|CriOS)\/([0-9.]+)/i);
      if (match) browserVersion = match[1];
    } else if (/firefox|fxios/i.test(ua)) {
      browser = 'فايرفوكس (Firefox)';
      const match = ua.match(/(?:Firefox|FxiOS)\/([0-9.]+)/i);
      if (match) browserVersion = match[1];
    } else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) {
      browser = 'سفاري (Safari)';
      const match = ua.match(/Version\/([0-9.]+)/i);
      if (match) browserVersion = match[1];
    }

    return {
      raw: ua,
      browser: browserVersion ? `${browser} v${browserVersion.split('.')[0]}` : browser,
      fullBrowser: browserVersion ? `${browser} (${browserVersion})` : browser,
      os: os,
      deviceType: deviceType,
      isMobile: /mobile|android|iphone|ipad|phone/i.test(ua)
    };
  }

  // 3. تحليل مصدر الزيارة (Referrer & Traffic Source)
  parseTrafficSource() {
    const ref = document.referrer || '';
    let sourceName = 'دخول مباشر أو رابط محفوظ (Direct)';
    let sourceCategory = 'direct';

    if (ref) {
      if (ref.includes('telegram') || ref.includes('t.me') || ref.includes('org.telegram.messenger')) {
        sourceName = 'تطبيق تيليجرام (Telegram)';
        sourceCategory = 'telegram';
      } else if (ref.includes('whatsapp') || ref.includes('wa.me')) {
        sourceName = 'تطبيق واتساب (WhatsApp)';
        sourceCategory = 'whatsapp';
      } else if (ref.includes('facebook') || ref.includes('fb.com')) {
        sourceName = 'فيسبوك (Facebook)';
        sourceCategory = 'facebook';
      } else if (ref.includes('google.')) {
        sourceName = 'محرك بحث جوجل (Google Search)';
        sourceCategory = 'search';
      } else {
        try {
          const urlObj = new URL(ref);
          sourceName = `موقع خارجي: ${urlObj.hostname}`;
          sourceCategory = 'external';
        } catch (e) {
          sourceName = ref;
        }
      }
    }

    return {
      rawReferrer: ref,
      sourceName: sourceName,
      sourceCategory: sourceCategory
    };
  }

  // 4. استخراج الخصائص الفنية للشاشة والبيئة
  getEnvironmentSpecs() {
    const screenWidth = window.screen?.width || 0;
    const screenHeight = window.screen?.height || 0;
    const viewportWidth = window.innerWidth || 0;
    const viewportHeight = window.innerHeight || 0;
    const pixelRatio = window.devicePixelRatio || 1;
    const language = navigator.language || navigator.userLanguage || 'غير محدد';
    let timezone = 'غير محدد';
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Aden';
    } catch (e) {}

    return {
      resolution: `${screenWidth} × ${screenHeight} بكسل`,
      viewport: `${viewportWidth} × ${viewportHeight} بكسل`,
      pixelRatio: pixelRatio,
      language: language,
      timezone: timezone,
      cores: navigator.hardwareConcurrency || 'غير متاح',
      platform: navigator.platform || 'غير متاح',
      onlineStatus: navigator.onLine ? 'متصل 🟢' : 'غير متصل 🔴'
    };
  }

  // 5. بدء تتبع نزاهة جلسة الاختبار (Academic Integrity Monitoring)
  startExamTracking() {
    this.isExamActive = true;
    this.tabSwitchCount = 0;
    this.outOfFocusDurationMs = 0;
    this.lastBlurTime = null;

    // رصد مغادرة النافذة أو التبديل بين التطبيقات
    window.addEventListener('blur', () => this.handleWindowBlur());
    window.addEventListener('focus', () => this.handleWindowFocus());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.handleWindowBlur();
      } else {
        this.handleWindowFocus();
      }
    });

    console.log('[Telemetry] تم تفعيل رادار النزاهة الأكاديمية لجلسة الاختبار');
  }

  handleWindowBlur() {
    if (!this.isExamActive) return;
    if (!this.lastBlurTime) {
      this.lastBlurTime = Date.now();
      this.tabSwitchCount++;
      console.warn(`[Integrity Alert] الطالب غادر شاشة الاختبار (المرة ${this.tabSwitchCount})`);
    }
  }

  handleWindowFocus() {
    if (!this.isExamActive) return;
    if (this.lastBlurTime) {
      const duration = Date.now() - this.lastBlurTime;
      this.outOfFocusDurationMs += duration;
      this.lastBlurTime = null;
    }
  }

  // 6. تجميع التقرير الفني الشامل للجلسة لتضمينه في نتيجة الاختبار
  getSnapshot() {
    if (this.lastBlurTime) {
      this.outOfFocusDurationMs += (Date.now() - this.lastBlurTime);
      this.lastBlurTime = null;
    }

    const uaData = this.parseUserAgent();
    const trafficData = this.parseTrafficSource();
    const envData = this.getEnvironmentSpecs();

    const outOfFocusSeconds = Math.round(this.outOfFocusDurationMs / 1000);
    let integrityStatus = 'ملتزم بالجلسة بالكامل 🟢';
    let integrityFlag = 'clean';

    if (this.tabSwitchCount > 0) {
      if (this.tabSwitchCount <= 2 && outOfFocusSeconds < 15) {
        integrityStatus = `مغادرة عارضة (${this.tabSwitchCount} مرات - ${outOfFocusSeconds}ث) 🟡`;
        integrityFlag = 'minor';
      } else {
        integrityStatus = `مغادرة متكررة للشاشة (${this.tabSwitchCount} مرات - ${outOfFocusSeconds} ثانية بالخارج) ⚠️`;
        integrityFlag = 'suspicious';
      }
    }

    return {
      visitorId: this.visitorId,
      sessionId: this.sessionId,
      clientTimestamp: new Date().toISOString(),
      userAgent: uaData,
      traffic: trafficData,
      environment: envData,
      integrity: {
        tabSwitchCount: this.tabSwitchCount,
        outOfFocusSeconds: outOfFocusSeconds,
        status: integrityStatus,
        flag: integrityFlag
      }
    };
  }
}

// إتاحة الكائن عالمياً عبر النافذة
window.telemetry = new TelemetryManager();
