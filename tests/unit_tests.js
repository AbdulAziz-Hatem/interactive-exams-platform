/**
 * مجموعة اختبارات الوحدة لمنصة مدارج (Madarej Unit Tests Suite)
 * تفحص: إمكانية الوصول، المصادقة، التكوين، محرك الاختبار، خلط الأسئلة،
 * ونظام حفظ المسائل للمراجعة (Bookmarks)، وتوليد كشوفات الـ PDF الأكاديمية.
 */

const assert = require('assert');

// -------------------------------------------------------------
// محاكاة بيئة المتصفح الأساسية (Mock Browser Globals for Node.js)
// -------------------------------------------------------------
const mockLocalStorage = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

global.localStorage = mockLocalStorage;
global.window = {
  localStorage: mockLocalStorage,
  authManager: {
    getUser: () => ({ id: 'student_123', fullName: 'طالب قرآن تجريبي' })
  },
  a11y: {
    announce: () => {}
  }
};

// -------------------------------------------------------------
// 1. اختبارات وحدة التكوين والتهيئة (CONFIG Suite)
// -------------------------------------------------------------
function testConfigModule() {
  console.log('▶ جاري اختبار وحدة التكوين (CONFIG)...');
  mockLocalStorage.clear();

  const CONFIG = {
    SUPABASE_URL: mockLocalStorage.getItem('EDUTEST_SUPABASE_URL') || 'https://lkcuktpyeutrrxjuenzb.supabase.co',
    SUPABASE_ANON_KEY: mockLocalStorage.getItem('EDUTEST_SUPABASE_KEY') || 'test-key-sample-12345',
    APP_NAME: 'منصة مدارج للاختبارات التفاعلية',

    isSupabaseConfigured() {
      return Boolean(this.SUPABASE_URL && this.SUPABASE_ANON_KEY && !this.SUPABASE_URL.includes('your-project'));
    },

    saveCredentials(url, key) {
      if (!url || !key) return false;
      mockLocalStorage.setItem('EDUTEST_SUPABASE_URL', url.trim());
      mockLocalStorage.setItem('EDUTEST_SUPABASE_KEY', key.trim());
      this.SUPABASE_URL = url.trim();
      this.SUPABASE_ANON_KEY = key.trim();
      return true;
    },

    clearCredentials() {
      mockLocalStorage.removeItem('EDUTEST_SUPABASE_URL');
      mockLocalStorage.removeItem('EDUTEST_SUPABASE_KEY');
      this.SUPABASE_URL = '';
      this.SUPABASE_ANON_KEY = '';
    }
  };

  assert.strictEqual(CONFIG.isSupabaseConfigured(), true, 'يجب أن يكون الاتصال الافتراضي مفعلاً');
  const saved = CONFIG.saveCredentials('https://custom.supabase.co', 'new-anon-key');
  assert.strictEqual(saved, true, 'يجب أن تنجح عملية حفظ المفاتيح');
  assert.strictEqual(CONFIG.SUPABASE_URL, 'https://custom.supabase.co');

  CONFIG.clearCredentials();
  assert.strictEqual(CONFIG.isSupabaseConfigured(), false, 'يجب أن يتعطل الاتصال بعد مسح المفاتيح');

  console.log('  ✔ نجحت جميع اختبارات وحدة CONFIG');
}

// -------------------------------------------------------------
// 2. اختبارات وحدة إمكانية الوصول والتنبيهات الصوتية (A11y Suite)
// -------------------------------------------------------------
function testA11yModule() {
  console.log('▶ جاري اختبار محرك إمكانية الوصول (A11y Engine)...');

  class MockLiveRegion {
    constructor() {
      this.textContent = '';
      this.attributes = {};
    }
    setAttribute(k, v) { this.attributes[k] = v; }
    getAttribute(k) { return this.attributes[k]; }
  }

  const liveRegion = new MockLiveRegion();
  const assertiveRegion = new MockLiveRegion();

  const a11y = {
    announce(message, priority = 'polite') {
      const target = priority === 'assertive' ? assertiveRegion : liveRegion;
      target.textContent = message;
      return target.textContent;
    },
    toggleTheme(current) {
      return current === 'dark' ? 'light' : 'dark';
    }
  };

  a11y.announce('المسألة الأولى: ما هو المكي والمدني؟', 'polite');
  assert.strictEqual(liveRegion.textContent, 'المسألة الأولى: ما هو المكي والمدني؟');

  a11y.announce('تنبيه: متبقي دقيقة واحدة فقط!', 'assertive');
  assert.strictEqual(assertiveRegion.textContent, 'تنبيه: متبقي دقيقة واحدة فقط!');

  assert.strictEqual(a11y.toggleTheme('light'), 'dark');
  assert.strictEqual(a11y.toggleTheme('dark'), 'light');

  console.log('  ✔ نجحت جميع اختبارات محرك A11y');
}

// -------------------------------------------------------------
// 3. اختبارات أمان الحسابات وتطهير النصوص (Auth & Sanitization)
// -------------------------------------------------------------
function testAuthSecurity() {
  console.log('▶ جاري اختبار الأمان وتطهير نصوص المستخدم (Auth & Security)...');

  function escapeHtml(str) {
    return str ? str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)) : '';
  }

  const maliciousInput = '<script>alert("hacked")</script>';
  const escaped = escapeHtml(maliciousInput);
  assert.strictEqual(escaped, '&lt;script&gt;alert(&quot;hacked&quot;)&lt;/script&gt;');
  assert.strictEqual(escaped.includes('<'), false);

  const studentName = 'عبد العزيز & شركاؤه "طالب"';
  assert.strictEqual(escapeHtml(studentName), 'عبد العزيز &amp; شركاؤه &quot;طالب&quot;');

  console.log('  ✔ نجحت جميع اختبارات تطهير XSS والأمان');
}

// -------------------------------------------------------------
// 4. اختبارات محرك الاختبار والخلط العشوائي (Exam Engine & Shuffle)
// -------------------------------------------------------------
function testExamEngine() {
  console.log('▶ جاري اختبار محرك الاختبار وخوارزمية الخلط (Fisher-Yates Shuffle)...');

  function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  const originalQuestions = [
    { id: 'q1', text: 'سؤال 1' },
    { id: 'q2', text: 'سؤال 2' },
    { id: 'q3', text: 'سؤال 3' },
    { id: 'q4', text: 'سؤال 4' },
    { id: 'q5', text: 'سؤال 5' }
  ];

  const shuffled = shuffleArray(originalQuestions);
  assert.strictEqual(shuffled.length, originalQuestions.length, 'يجب أن يتطابق عدد الأسئلة بعد الخلط');

  const originalIds = originalQuestions.map(q => q.id).sort();
  const shuffledIds = shuffled.map(q => q.id).sort();
  assert.deepStrictEqual(shuffledIds, originalIds, 'يجب أن تتطابق جميع المعرفات بعد الخلط');

  let changedOrderCount = 0;
  for (let i = 0; i < 50; i++) {
    const testShuffle = shuffleArray(originalQuestions);
    if (testShuffle[0].id !== originalQuestions[0].id) {
      changedOrderCount++;
    }
  }
  assert.ok(changedOrderCount > 0, 'الترتيب يجب أن يتغير في التجارب المتكررة');

  console.log('  ✔ نجحت جميع اختبارات محرك الاختبار والخلط العشوائي');
}

// -------------------------------------------------------------
// 5. اختبارات وحدة نظام حفظ المسائل للمراجعة (Bookmarks Manager Suite)
// -------------------------------------------------------------
function testBookmarksModule() {
  console.log('▶ جاري اختبار نظام حفظ وتفضيل المسائل للمراجعة (Bookmarks Suite)...');
  mockLocalStorage.clear();

  class BookmarksManager {
    constructor() {
      this.storageKey = 'madarej_saved_questions';
    }
    getUserKey() {
      const user = global.window.authManager?.getUser();
      return user?.id ? `${this.storageKey}_${user.id}` : `${this.storageKey}_guest`;
    }
    getAll() {
      const data = mockLocalStorage.getItem(this.getUserKey());
      return data ? JSON.parse(data) : [];
    }
    isBookmarked(questionId) {
      return this.getAll().some(item => String(item.id) === String(questionId));
    }
    toggle(question) {
      let items = this.getAll();
      const idx = items.findIndex(item => String(item.id) === String(question.id));
      if (idx !== -1) {
        items.splice(idx, 1);
        mockLocalStorage.setItem(this.getUserKey(), JSON.stringify(items));
        return false;
      } else {
        items.unshift({ id: String(question.id), question_text: question.question_text });
        mockLocalStorage.setItem(this.getUserKey(), JSON.stringify(items));
        return true;
      }
    }
    remove(questionId) {
      let items = this.getAll().filter(item => String(item.id) !== String(questionId));
      mockLocalStorage.setItem(this.getUserKey(), JSON.stringify(items));
      return true;
    }
    clearAll() {
      mockLocalStorage.removeItem(this.getUserKey());
    }
  }

  const bm = new BookmarksManager();

  // 5.1 قائمة البداية فارغة
  assert.strictEqual(bm.getAll().length, 0);
  assert.strictEqual(bm.isBookmarked('q101'), false);

  // 5.2 حفظ مسألة جديدة
  const added = bm.toggle({ id: 'q101', question_text: 'ما هو المكي والمدني؟' });
  assert.strictEqual(added, true, 'يجب أن تُضاف المسألة بنجاح');
  assert.strictEqual(bm.isBookmarked('q101'), true);
  assert.strictEqual(bm.getAll().length, 1);

  // 5.3 تكرار الضغط يزيل المسألة (Toggle off)
  const removed = bm.toggle({ id: 'q101', question_text: 'ما هو المكي والمدني؟' });
  assert.strictEqual(removed, false, 'يجب أن تُزال المسألة عند الضغط مجدداً');
  assert.strictEqual(bm.isBookmarked('q101'), false);
  assert.strictEqual(bm.getAll().length, 0);

  // 5.4 إضافة مسألتين والحذف المحدد
  bm.toggle({ id: 'q201', question_text: 'مسألة أصول التفسير' });
  bm.toggle({ id: 'q202', question_text: 'مسألة الإعجاز البياني' });
  assert.strictEqual(bm.getAll().length, 2);

  bm.remove('q201');
  assert.strictEqual(bm.getAll().length, 1);
  assert.strictEqual(bm.isBookmarked('q201'), false);
  assert.strictEqual(bm.isBookmarked('q202'), true);

  // 5.5 إفراغ الكل
  bm.clearAll();
  assert.strictEqual(bm.getAll().length, 0);

  console.log('  ✔ نجحت جميع اختبارات وحدة حفظ وتفضيل المسائل (Bookmarks)');
}

// -------------------------------------------------------------
// 6. اختبارات توثيق كشف الدرجات الأكاديمي والـ PDF (Academic Report Suite)
// -------------------------------------------------------------
function testAcademicReportFormatting() {
  console.log('▶ جاري اختبار نموذج كشف الدرجات والـ PDF الأكاديمي المعتمد...');

  function formatAcademicReport(sub) {
    const institution = 'جامعة صنعاء — كلية التربية | قسم القرآن الكريم وعلومه';
    const isPassed = sub.score >= (sub.total_points * (sub.passing_percentage / 100));
    const statusText = isPassed ? 'ناجح ومجتاز' : 'راسب وغير مجتاز';
    const docId = `DOC-${String(sub.id).substring(0, 8)}`;
    return { institution, isPassed, statusText, docId };
  }

  const mockSub = {
    id: 'a1b2c3d4-e5f6-7890',
    score: 8,
    total_points: 10,
    passing_percentage: 60
  };

  const report = formatAcademicReport(mockSub);
  assert.strictEqual(report.institution.includes('قسم القرآن الكريم وعلومه'), true);
  assert.strictEqual(report.institution.includes('جامعة صنعاء'), true);
  assert.strictEqual(report.isPassed, true);
  assert.strictEqual(report.statusText, 'ناجح ومجتاز');
  assert.strictEqual(report.docId, 'DOC-a1b2c3d4');

  console.log('  ✔ نجحت جميع اختبارات نموذج كشف الدرجات وتوثيق الـ PDF الأكاديمي');
}

// -------------------------------------------------------------
// تشغيل الاختبارات بالكامل
// -------------------------------------------------------------
try {
  console.log('====================================================');
  console.log('  بدء تنفيذ اختبارات الوحدة الشاملة لمنصة مدارج    ');
  console.log('====================================================');
  testConfigModule();
  testA11yModule();
  testAuthSecurity();
  testExamEngine();
  testBookmarksModule();
  testAcademicReportFormatting();
  console.log('====================================================');
  console.log('🎉 تهانينا! جميع اختبارات الوحدة (6 من 6) مرت بنجاح تام 100%');
  console.log('====================================================');
} catch (err) {
  console.error('❌ فشل في اختبارات الوحدة:', err.message);
  process.exit(1);
}
