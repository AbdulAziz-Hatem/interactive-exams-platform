/**
 * محرك الاختبار التفاعلي (Interactive Exam Engine)
 * يدعم: المؤقت التنازلي، تتبع الإجابات، حفظ المسائل، الاستجابة الحسية (Haptics)،
 * واختصارات لوحة المفاتيح السريعة (Keyboard Shortcuts)
 * مخصص لقسم القرآن الكريم وعلومه — كلية التربية، جامعة صنعاء
 */

class ExamEngine {
  constructor() {
    this.examId = null;
    this.examData = null;
    this.questions = [];
    this.currentIndex = 0;
    this.answers = {}; // { [question_id]: choice_id }
    this.timerInterval = null;
    this.secondsRemaining = 0;
    this.hasSetupKeyboard = false;
  }

  shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  async init() {
    const params = new URLSearchParams(window.location.search);
    this.examId = params.get('id');

    if (!this.examId) {
      alert('لم يتم تحديد معرف الاختبار!');
      window.location.href = 'index.html';
      return;
    }

    await window.authManager.init();
    if (!window.authManager.isAuthenticated()) {
      window.a11y?.announce('يرجى تسجيل الدخول أولاً لتتمكن من خوض الاختبار', 'assertive');
      window.location.href = `auth.html?redirect=exam.html?id=${this.examId}`;
      return;
    }

    window.db.init();

    try {
      const data = await window.db.getExamForStudent(this.examId);
      this.examData = data.exam;
      
      const rawQuestions = data.questions || [];
      this.questions = this.shuffleArray(rawQuestions).map(q => ({
        ...q,
        choices: this.shuffleArray(q.choices || [])
      }));

      if (!this.questions || this.questions.length === 0) {
        document.getElementById('exam-app').innerHTML = `
          <div class="card" style="text-align: center; padding: 3rem;">
            <h2>لا توجد أسئلة متاحة في هذا النموذج حالياً</h2>
            <p style="margin: 1rem 0; color: var(--text-muted);">يرجى مراجعة إدارة القسم أو المشرف الأكاديمي.</p>
            <a href="index.html" class="btn btn-primary">العودة لمقررات القسم</a>
          </div>
        `;
        return;
      }

      this.setupUI();
      this.setupKeyboardShortcuts();
      this.startTimer();
      this.renderQuestion(0);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء تحميل الاختبار: ' + err.message);
    }
  }

  /**
   * تفعيل اختصارات لوحة المفاتيح السريعة (Keyboard Shortcuts for Blind & Power Users)
   */
  setupKeyboardShortcuts() {
    if (this.hasSetupKeyboard) return;
    this.hasSetupKeyboard = true;

    document.addEventListener('keydown', (e) => {
      // عدم التفعيل إذا كان المستخدم داخل حقل إدخال نصي
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      const key = e.key;

      // الأرقام 1, 2, 3, 4 لاختيار الإجابة
      if (['1', '2', '3', '4'].includes(key)) {
        const choiceIdx = parseInt(key, 10) - 1;
        this.selectChoiceByIndex(choiceIdx);
      } else if (['أ', 'ب', 'ج', 'د'].includes(key)) {
        const map = { 'أ': 0, 'ب': 1, 'ج': 2, 'د': 3 };
        this.selectChoiceByIndex(map[key]);
      } else if (key === 'ArrowLeft' || key.toLowerCase() === 'n') {
        // في النمط العربي اليمين لليسار، السهم الأيسر يتقدم للأمام
        this.nextQuestion();
      } else if (key === 'ArrowRight' || key.toLowerCase() === 'p') {
        this.prevQuestion();
      } else if (key.toLowerCase() === 'b' || key.toLowerCase() === 's') {
        // حرف B أو S لتبديل حفظ المسألة
        document.getElementById('btn-toggle-bookmark')?.click();
      }
    });
  }

  selectChoiceByIndex(idx) {
    const q = this.questions[this.currentIndex];
    if (q && q.choices && q.choices[idx]) {
      const targetChoice = q.choices[idx];
      this.answers[q.id] = targetChoice.id;
      
      const radio = document.getElementById(`choice_${q.id}_${targetChoice.id}`);
      if (radio) radio.checked = true;

      // استجابة حسية (Haptic Tick)
      this.triggerHaptic(25);
      window.a11y?.announce(`تم اختيار: ${targetChoice.choice_text}`);
      this.updateButtonsState();
    }
  }

  triggerHaptic(durationMs = 25) {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(durationMs);
      } catch (e) {}
    }
  }

  startTimer() {
    if (this.secondsRemaining <= 0) return;

    this.timerInterval = setInterval(() => {
      this.secondsRemaining--;
      this.updateTimerDisplay();

      if (this.secondsRemaining === 300) {
        window.a11y?.announce('تنبيه: متبقي خمس دقائق على انتهاء وقت الاختبار', 'assertive');
        this.triggerHaptic([50, 50, 50]);
      } else if (this.secondsRemaining === 60) {
        window.a11y?.announce('تنبيه هام: متبقي دقيقة واحدة فقط على انتهاء وقت الاختبار', 'assertive');
        document.getElementById('timer-box')?.classList.add('urgent');
        this.triggerHaptic([100, 50, 100]);
      }

      if (this.secondsRemaining <= 0) {
        clearInterval(this.timerInterval);
        window.a11y?.announce('انتهى الوقت المخصص للاختبار! سيتم تسليم الإجابات تلقائياً الآن.', 'assertive');
        alert('انتهى الوقت المحدد للاختبار! سيتم حفظ وتسليم إجاباتك تلقائياً.');
        this.submitFinal();
      }
    }, 1000);
  }

  updateTimerDisplay() {
    const box = document.getElementById('timer-time');
    if (!box) return;

    const m = Math.floor(this.secondsRemaining / 60);
    const s = this.secondsRemaining % 60;
    box.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  renderQuestion(index) {
    if (index < 0 || index >= this.questions.length) return;
    this.currentIndex = index;

    const q = this.questions[index];
    const container = document.getElementById('question-render-area');

    const progressPct = Math.round(((index + 1) / this.questions.length) * 100);
    const progressBar = document.getElementById('exam-progress-bar');
    if (progressBar) {
      progressBar.style.width = progressPct + '%';
      progressBar.setAttribute('aria-valuenow', progressPct);
    }

    document.getElementById('current-question-num').textContent = index + 1;

    // فحص حالة حفظ المسألة
    const isSaved = window.bookmarksManager?.isBookmarked(q.id);
    const bookmarkBtnText = isSaved ? 'محفوظة للمراجعة ★' : 'حفظ للمراجعة ☆';
    const bookmarkBtnClass = isSaved ? 'btn-bookmark bookmarked' : 'btn-bookmark';

    const letters = ['أ', 'ب', 'ج', 'د'];
    const choicesHtml = q.choices.map((c, cIdx) => {
      const isChecked = this.answers[q.id] === c.id;
      const inputId = `choice_${q.id}_${c.id}`;
      const prefixLetter = letters[cIdx] || (cIdx + 1);

      return `
        <li class="choice-item">
          <input 
            type="radio" 
            name="question_${q.id}" 
            id="${inputId}" 
            value="${c.id}" 
            class="choice-input" 
            ${isChecked ? 'checked' : ''}
            data-qid="${q.id}"
            data-cid="${c.id}"
          />
          <label for="${inputId}" class="choice-label">
            <span class="choice-custom-radio" aria-hidden="true"></span>
            <span style="font-weight: 800; color: var(--primary); margin-left: 0.5rem;">(${prefixLetter})</span>
            <span>${this.escapeHtml(c.choice_text)}</span>
          </label>
        </li>
      `;
    }).join('');

    container.innerHTML = `
      <div class="question-card" role="region" aria-labelledby="q-legend-${q.id}">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; gap: 0.5rem; flex-wrap: wrap;">
          <span class="badge badge-primary">المسألة ${index + 1} من ${this.questions.length} (${q.points || 1} درجات)</span>
          <button type="button" class="${bookmarkBtnClass}" id="btn-toggle-bookmark" aria-pressed="${isSaved}" aria-label="${isSaved ? 'إزالة المسألة من قائمة المراجعة' : 'حفظ المسألة في قائمة المراجعة للمذاكرة لاحقاً'}">
            <span>${bookmarkBtnText}</span>
          </button>
        </div>

        <fieldset class="question-fieldset">
          <legend id="q-legend-${q.id}" class="question-legend">
            ${this.escapeHtml(q.question_text)}
          </legend>
          <ul class="choices-list" role="radiogroup" aria-labelledby="q-legend-${q.id}">
            ${choicesHtml}
          </ul>
        </fieldset>

        <div style="margin-top: 1.25rem; padding-top: 0.75rem; border-top: 1px solid var(--border-light); font-size: 0.8rem; color: var(--text-muted); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
          <span>💡 اختصارات لوحة المفاتيح: [1-4] لاختيار الإجابة</span>
          <span>[الأسهم] للتنقل بين الأسئلة | [B] لحفظ المسألة</span>
        </div>
      </div>
    `;

    // ربط حدث زر حفظ المسألة
    document.getElementById('btn-toggle-bookmark')?.addEventListener('click', () => {
      this.triggerHaptic([30, 30, 30]);
      window.bookmarksManager?.toggle({
        id: q.id,
        exam_id: this.examId,
        exam_title: this.examData?.title || 'اختبار تخصصي',
        question_text: q.question_text,
        choices: q.choices,
        explanation: q.explanation || ''
      });
      this.renderQuestion(this.currentIndex);
    });

    // ربط أحداث الاختيار
    container.querySelectorAll('.choice-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const qid = e.target.getAttribute('data-qid');
        const cid = e.target.getAttribute('data-cid');
        this.answers[qid] = cid;
        this.triggerHaptic(25);
        window.a11y?.announce('تم تحديد الإجابة');
        this.updateButtonsState();
      });
    });

    this.updateButtonsState();
    window.a11y?.announce(`المسألة رقم ${index + 1} من ${this.questions.length}: ${q.question_text}`);
    window.a11y?.focusElement(`#q-legend-${q.id}`);
  }

  updateButtonsState() {
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const btnSubmit = document.getElementById('btn-submit-exam');

    if (btnPrev) btnPrev.disabled = this.currentIndex === 0;

    if (this.currentIndex === this.questions.length - 1) {
      if (btnNext) btnNext.style.display = 'none';
      if (btnSubmit) btnSubmit.style.display = 'inline-flex';
    } else {
      if (btnNext) btnNext.style.display = 'inline-flex';
      if (btnSubmit) btnSubmit.style.display = 'none';
    }
  }

  prevQuestion() {
    if (this.currentIndex > 0) {
      this.triggerHaptic(15);
      this.renderQuestion(this.currentIndex - 1);
    }
  }

  nextQuestion() {
    if (this.currentIndex < this.questions.length - 1) {
      this.triggerHaptic(15);
      this.renderQuestion(this.currentIndex + 1);
    }
  }

  confirmSubmit() {
    const answeredCount = Object.keys(this.answers).length;
    const total = this.questions.length;
    const unanswered = total - answeredCount;

    let msg = `تنبيه: هل أنت متأكد من رغبتك في تسليم الاختبار الآن؟\n\n`;
    msg += `• عدد المسائل المجابة: ${answeredCount} من ${total}\n`;
    if (unanswered > 0) {
      msg += `• تنبيه هام: يوجد ${unanswered} مسائل لم تُجب عليها بعد!\n`;
    }

    if (confirm(msg)) {
      this.submitFinal();
    }
  }

  async submitFinal() {
    clearInterval(this.timerInterval);
    this.triggerHaptic(50);

    const payload = this.questions.map(q => ({
      question_id: q.id,
      choice_id: this.answers[q.id] || null
    }));

    const btnSubmit = document.getElementById('btn-submit-exam');
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'جاري التصحيح والتقييم السحابي...';
    }

    window.a11y?.announce('جاري تسليم وتصحيح الاختبار سحابياً، يرجى الانتظار...', 'assertive');

    try {
      const result = await window.db.submitExam(this.examId, payload);
      const submissionId = result.submission_id || result.id;
      window.location.href = `result.html?submission_id=${submissionId}`;
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء حفظ النتيجة: ' + err.message);
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'إعادة المحاولة';
      }
    }
  }

  escapeHtml(str) {
    return str ? str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)) : '';
  }
}

window.examEngine = new ExamEngine();
