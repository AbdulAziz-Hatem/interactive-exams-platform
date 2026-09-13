/**
 * وحدة إدارة المسائل المحفوظة للمراجعة (Bookmarks Manager)
 * منصة مدارج — قسم القرآن الكريم وعلومه، كلية التربية، جامعة صنعاء
 * تتيح للطالب حفظ المسائل الصعبة أو المهمة للرجوع إليها ومذاكرتها لاحقاً
 */

class BookmarksManager {
  constructor() {
    this.storageKey = 'madarej_saved_questions';
  }

  /**
   * جلب مفتاح التخزين المرتبط بالمستخدم الحالي لضمان خصوصية السجلات
   */
  getUserKey() {
    const user = window.authManager?.getUser();
    return user?.id ? `${this.storageKey}_${user.id}` : `${this.storageKey}_guest`;
  }

  /**
   * جلب كافة المسائل المحفوظة
   */
  getAll() {
    try {
      const data = localStorage.getItem(this.getUserKey());
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('تعذر قراءة المسائل المحفوظة:', e);
      return [];
    }
  }

  /**
   * التحقق مما إذا كانت المسألة محفوظة مسبقاً
   */
  isBookmarked(questionId) {
    if (!questionId) return false;
    const items = this.getAll();
    return items.some(item => String(item.id) === String(questionId));
  }

  /**
   * تبديل حالة حفظ المسألة (حفظ / إزالة)
   * @param {Object} question - كائن المسألة شاملاً النص، الخيارات، والتعليل
   * @returns {boolean} - true إذا تم الحفظ، false إذا تمت الإزالة
   */
  toggle(question) {
    if (!question || !question.id) return false;

    let items = this.getAll();
    const existsIndex = items.findIndex(item => String(item.id) === String(question.id));

    if (existsIndex !== -1) {
      // إزالة من المفضلة
      items.splice(existsIndex, 1);
      this.save(items);
      window.a11y?.announce('تمت إزالة المسألة من قائمة المراجعة');
      return false;
    } else {
      // إضافة إلى المفضلة
      const itemToSave = {
        id: String(question.id),
        exam_id: question.exam_id || null,
        exam_title: question.exam_title || 'مقررات قسم القرآن الكريم وعلومه',
        question_text: question.question_text || '',
        choices: question.choices || [],
        correct_choice_text: question.correct_choice_text || null,
        explanation: question.explanation || '',
        saved_at: new Date().toISOString()
      };

      items.unshift(itemToSave);
      this.save(items);
      window.a11y?.announce('تمت إضافة المسألة بنجاح إلى قائمة المراجعة');
      return true;
    }
  }

  /**
   * إزالة مسألة معينة بالمعرف
   */
  remove(questionId) {
    let items = this.getAll();
    items = items.filter(item => String(item.id) !== String(questionId));
    this.save(items);
    window.a11y?.announce('تم حذف المسألة من المحفوظات');
    return true;
  }

  /**
   * تفريغ كافة المسائل المحفوظة
   */
  clearAll() {
    localStorage.removeItem(this.getUserKey());
    window.a11y?.announce('تم إفراغ قائمة المسائل المحفوظة');
  }

  /**
   * حفظ المصفوفة في التخزين المحلي
   */
  save(items) {
    try {
      localStorage.setItem(this.getUserKey(), JSON.stringify(items));
    } catch (e) {
      console.error('تعذر حفظ المسائل في الذاكرة:', e);
    }
  }
}

window.bookmarksManager = new BookmarksManager();
