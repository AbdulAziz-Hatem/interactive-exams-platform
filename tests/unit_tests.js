/**
 * مجموعة اختبارات الوحدة لمنصة مدارج (Madarej Unit Tests Suite)
 * تفحص: إمكانية الوصول، المصادقة، التكوين، محرك الاختبار، وخلط الأسئلة العشوائي
 */

const assert = require('assert');

// -------------------------------------------------------------\n// محاكاة بيئة المتصفح الأساسية (Mock Browser Globals for Node.js)\n// -------------------------------------------------------------
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
  localStorage: mockLocalStorage
};

// -------------------------------------------------------------\n// 1. اختبارات وحدة التكوين والتهيئة (CONFIG Suite)\n// -------------------------------------------------------------
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

  // 1.1 فحص الاتصال التلقائي بالقيم الافتراضية
  assert.strictEqual(CONFIG.isSupabaseConfigured(), true, 'يجب أن يكون الاتصال الافتراضي مفعلاً');

  // 1.2 فحص الحفظ والتحديث
  const saved = CONFIG.saveCredentials('https://custom.supabase.co', 'new-anon-key');
  assert.strictEqual(saved, true, 'يجب أن تنجح عملية حفظ المفاتيح');
  assert.strictEqual(CONFIG.SUPABASE_URL, 'https://custom.supabase.co');
  assert.strictEqual(mockLocalStorage.getItem('EDUTEST_SUPABASE_URL'), 'https://custom.supabase.co');

  // 1.3 فحص الحذف
  CONFIG.clearCredentials();
  assert.strictEqual(CONFIG.isSupabaseConfigured(), false, 'يجب أن يتعطل الاتصال بعد مسح المفاتيح');
  assert.strictEqual(mockLocalStorage.getItem('EDUTEST_SUPABASE_URL'), null);

  console.log('  ✔ نجحت جميع اختبارات وحدة CONFIG');
}

// -------------------------------------------------------------\n// 2. اختبارات وحدة إمكانية الوصول والتنبيهات الصوتية (A11y Suite)\n// -------------------------------------------------------------
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

  // 2.1 اختبار الإعلان العادي (Polite)
  a11y.announce('تم اختيار السؤال الأول', 'polite');
  assert.strictEqual(liveRegion.textContent, 'تم اختيار السؤال الأول');

  // 2.2 اختبار الإعلان العاجل (Assertive)
  a11y.announce('انتهى وقت الاختبار!', 'assertive');
  assert.strictEqual(assertiveRegion.textContent, 'انتهى وقت الاختبار!');

  // 2.3 اختبار تبديل المظهر
  assert.strictEqual(a11y.toggleTheme('light'), 'dark');
  assert.strictEqual(a11y.toggleTheme('dark'), 'light');

  console.log('  ✔ نجحت جميع اختبارات محرك A11y');
}

// -------------------------------------------------------------\n// 3. اختبارات أمان الحسابات وتطهير النصوص (Auth & Sanitization)\n// -------------------------------------------------------------
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

  // 3.1 اختبار منع هجمات XSS
  const maliciousInput = '<script>alert("hacked")</script>';
  const escaped = escapeHtml(maliciousInput);
  assert.strictEqual(escaped, '&lt;script&gt;alert(&quot;hacked&quot;)&lt;/script&gt;');
  assert.strictEqual(escaped.includes('<'), false);
  assert.strictEqual(escaped.includes('>'), false);

  // 3.2 فحص تطهير أسماء الطلاب ذوي الرموز
  const studentName = 'عبد العزيز & شركاؤه "طالب"';
  assert.strictEqual(escapeHtml(studentName), 'عبد العزيز &amp; شركاؤه &quot;طالب&quot;');

  console.log('  ✔ نجحت جميع اختبارات تطهير XSS والأمان');
}

// -------------------------------------------------------------\n// 4. اختبارات محرك الاختبار والخلط العشوائي (Exam Engine & Shuffle)\n// -------------------------------------------------------------
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

  // 4.1 التحقق من أن الخلط يحافظ على جميع العناصر دون تكرار أو حذف
  const shuffled = shuffleArray(originalQuestions);
  assert.strictEqual(shuffled.length, originalQuestions.length, 'يجب أن يتطابق عدد الأسئلة بعد الخلط');

  const originalIds = originalQuestions.map(q => q.id).sort();
  const shuffledIds = shuffled.map(q => q.id).sort();
  assert.deepStrictEqual(shuffledIds, originalIds, 'يجب أن تتطابق جميع المعرفات بعد الخلط');

  // 4.2 التحقق الإحصائي من العشوائية (تكرار الخلط 50 مرة والتحقق من اختلاف الترتيب)
  let changedOrderCount = 0;
  for (let i = 0; i < 50; i++) {
    const testShuffle = shuffleArray(originalQuestions);
    if (testShuffle[0].id !== originalQuestions[0].id) {
      changedOrderCount++;
    }
  }
  assert.ok(changedOrderCount > 0, 'الترتيب يجب أن يتغير في التجارب المتكررة');

  // 4.3 اختبار تنسيق إجابات التسليم للـ RPC السحابي
  const answersMap = { 'q1': 'c1', 'q2': 'c4', 'q3': null };
  const payload = Object.keys(answersMap).map(qid => ({
    question_id: qid,
    choice_id: answersMap[qid] || null
  }));

  assert.strictEqual(payload.length, 3);
  assert.deepStrictEqual(payload[0], { question_id: 'q1', choice_id: 'c1' });
  assert.deepStrictEqual(payload[2], { question_id: 'q3', choice_id: null });

  console.log('  ✔ نجحت جميع اختبارات محرك الاختبار والخلط العشوائي');
}

// -------------------------------------------------------------\n// 5. اختبارات نموذج حساب الدرجات والنسب (Grading Logic Suite)\n// -------------------------------------------------------------
function testGradingLogic() {
  console.log('▶ جاري اختبار منطق حساب الدرجات والنسب المئوية والاجتياز...');

  function calculateResult(earnedScore, totalPoints, passingPercentage = 60) {
    const total = totalPoints > 0 ? totalPoints : 1;
    const percentage = Math.round((earnedScore / total) * 100);
    const passed = percentage >= passingPercentage;
    return { percentage, passed };
  }

  // 5.1 طالب حقق 8 من 10 ونسبة النجاح 60%
  const res1 = calculateResult(8, 10, 60);
  assert.strictEqual(res1.percentage, 80);
  assert.strictEqual(res1.passed, true);

  // 5.2 طالب حقق 5 من 10 ونسبة النجاح 60%
  const res2 = calculateResult(5, 10, 60);
  assert.strictEqual(res2.percentage, 50);
  assert.strictEqual(res2.passed, false);

  // 5.3 طالب حقق الدرجة الكاملة 10 من 10
  const res3 = calculateResult(10, 10, 60);
  assert.strictEqual(res3.percentage, 100);
  assert.strictEqual(res3.passed, true);

  console.log('  ✔ نجحت جميع اختبارات منطق التصحيح والتقييم');
}

// -------------------------------------------------------------\n// تشغيل الاختبارات بالكامل\n// -------------------------------------------------------------
try {
  console.log('====================================================');
  console.log('  بدء تنفيذ اختبارات الوحدة لمنصة مدارج للاختبارات  ');
  console.log('====================================================');
  testConfigModule();
  testA11yModule();
  testAuthSecurity();
  testExamEngine();
  testGradingLogic();
  console.log('====================================================');
  console.log('🎉 تهانينا! جميع اختبارات الوحدة (5 من 5) مرت بنجاح تام 100%');
  console.log('====================================================');
} catch (err) {
  console.error('❌ فشل في اختبارات الوحدة:', err.message);
  process.exit(1);
}
