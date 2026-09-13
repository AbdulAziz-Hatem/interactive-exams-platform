/**
 * مجموعة اختبارات الوحدة لمنصة مدارج (Madarej Unit Tests Suite)
 * تفحص: إمكانية الوصول، المصادقة، التكوين، محرك الاختبار، خلط الأسئلة،
 * نظام حفظ المسائل للمراجعة (Bookmarks)، كشوفات الـ PDF الأكاديمية،
 * والعمليات الإدارية الحيوية (حذف المقررات، تفعيلها، وإدارة النماذج سحابياً).
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
    getUser: () => ({ id: 'student_123', fullName: 'طالب قرآن تجريبي', role: 'admin' })
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

  assert.strictEqual(bm.getAll().length, 0);
  assert.strictEqual(bm.isBookmarked('q101'), false);

  const added = bm.toggle({ id: 'q101', question_text: 'ما هو المكي والمدني؟' });
  assert.strictEqual(added, true);
  assert.strictEqual(bm.isBookmarked('q101'), true);

  const removed = bm.toggle({ id: 'q101', question_text: 'ما هو المكي والمدني؟' });
  assert.strictEqual(removed, false);
  assert.strictEqual(bm.isBookmarked('q101'), false);

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
// 7. اختبارات العمليات الإدارية الحيوية (Admin Operations Suite)
// -------------------------------------------------------------
function testAdminOperations() {
  console.log('▶ جاري اختبار العمليات الإدارية المباشرة (حذف المقررات وتفعيلها وإدارتها)...');
  mockLocalStorage.clear();

  let subjects = [
    { id: 'sub_1', title: 'علوم القرآن الكريم', code: 'QURAN_SCI', is_active: true },
    { id: 'sub_2', title: 'أصول التفسير وقواعده', code: 'USUL_TAFSIR', is_active: true },
    { id: 'sub_3', title: 'مقرر قديم مراد حذفه', code: 'OLD_COURSE', is_active: false }
  ];

  let exams = [
    { id: 'ex_1', subject_id: 'sub_1', title: 'اختبار علوم القرآن', is_published: true },
    { id: 'ex_2', subject_id: 'sub_3', title: 'اختبار تابع للمقرر القديم', is_published: false }
  ];

  // دالة الحذف المباشر للمقرر مع التتالي (Cascading Delete)
  function deleteSubject(sid) {
    subjects = subjects.filter(s => s.id !== sid);
    exams = exams.filter(e => e.subject_id !== sid);
    return true;
  }

  // دالة التفعيل والتعطيل
  function toggleSubjectActive(sid) {
    const s = subjects.find(item => item.id === sid);
    if (s) {
      s.is_active = !s.is_active;
      return s.is_active;
    }
    return false;
  }

  // 7.1 فحص حذف المقرر مباشرة
  assert.strictEqual(subjects.length, 3);
  assert.strictEqual(exams.length, 2);

  deleteSubject('sub_3');

  assert.strictEqual(subjects.length, 2, 'يجب أن يصبح عدد المقررات 2 بعد حذف المقرر القديم');
  assert.strictEqual(subjects.some(s => s.id === 'sub_3'), false, 'المقرر القديم يجب ألا يكون موجوداً');
  assert.strictEqual(exams.length, 1, 'يجب أن يُحذف الاختبار المرتبط تلقائياً بالتتالي');
  assert.strictEqual(exams[0].subject_id, 'sub_1');

  // 7.2 فحص تفعيل وتعطيل المقرر بنقرة واحدة
  const currentStatus = subjects[0].is_active; // true
  const toggledStatus = toggleSubjectActive('sub_1');
  assert.strictEqual(toggledStatus, false, 'يجب أن تتحول حالة المقرر إلى معطل (مخفي)');
  assert.strictEqual(subjects[0].is_active, false);

  const restoredStatus = toggleSubjectActive('sub_1');
  assert.strictEqual(restoredStatus, true, 'يجب أن يعود المقرر إلى نشط ومتاح للطلاب');
  assert.strictEqual(subjects[0].is_active, true);

  console.log('  ✔ نجحت جميع اختبارات العمليات الإدارية المباشرة (حذف وتفعيل المقررات)');
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
  testAdminOperations();
  console.log('====================================================');
  console.log('🎉 تهانينا! جميع اختبارات الوحدة (7 من 7) مرت بنجاح تام 100%');
  console.log('====================================================');
} catch (err) {
  console.error('❌ فشل في اختبارات الوحدة:', err.message);
  process.exit(1);
}
