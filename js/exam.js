/**
 * محرك الاختبار التفاعلي (Interactive Exam Engine)
 * يتولى إدارة الجلسة، المؤقت التنازلي، تتبع الإجابات، وقارئات الشاشة
 * يدعم خلط الأسئلة والخيارات عشوائياً عند كل محاولة (Anti-cheating Randomization)
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
  }

  // خوارزمية خلط فيشر-ياتس (Fisher-Yates Shuffle) العشوائية
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

    // التحقق من تسجيل الدخول
    await window.authManager.init();
    if (!window.authManager.isAuthenticated()) {
      window.a11y.announce('يرجى تسجيل الدخول أولاً لتتمكن من خوض الاختبار', 'assertive');
      window.location.href = `auth.html?redirect=exam.html?id=${this.examId}`;
      return;
    }

    window.db.init();

    try {
      const data = await window.db.getExamForStudent(this.examId);
      this.examData = data.exam;
      
      // خلط الأسئلة والخيارات عشوائياً لكل طالب في كل جلسة
      const rawQuestions = data.questions || [];
      this.questions = this.shuffleArray(rawQuestions).map(q => ({
        ...q,
        choices: this.shuffleArray(q.choices || [])
      }));

      if (!this.questions || this.questions.length === 0) {
        document.getElementById('exam-app').innerHTML = `
          <div class="card" style="text-align: center;">
            <h2>لا توجد أسئلة متاحة في هذا الاختبار حالياً</h2>
            <p style="margin: 1rem 0;">يرجى مراجعة المسؤول لإضافة الأسئلة.</p>
            <a href="index.html" class="btn btn-primary">العودة للرئيسية</a>
          </div>
        `;
        return;
      }

      this.setupUI();
      this.startTimer();
      this.renderQuestion(0);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء تحميل الاختبار: ' + err.message);
    }
  }

  setupUI() {
    document.getElementById('exam-title').textContent = this.examData.title;
    document.getElementById('total-questions-count').textContent = this.questions.length;

    // تهيئة مؤقت الوقت
    const duration = parseInt(this.examData.duration_minutes, 10) || 0;
    if (duration > 0) {
      this.secondsRemaining = duration * 60;
      this.updateTimerDisplay();
    } else {
      document.getElementById('timer-box').innerHTML = '<span>الوقت: مفتوح</span>';
    }

    // أزرار التنقل
    document.getElementById('btn-prev').addEventListener('click', () => this.prevQuestion());
    document.getElementById('btn-next').addEventListener('click', () => this.nextQuestion());
    document.getElementById('btn-submit-exam').addEventListener('click', () => this.confirmSubmit());
  }

  startTimer() {
    if (this.secondsRemaining <= 0) return;

    this.timerInterval = setInterval(() => {
      this.secondsRemaining--;
      this.updateTimerDisplay();

      if (this.secondsRemaining === 300) { // 5 دقائق متبقية
        window.a11y.announce('تنبيه: متبقي خمس دقائق على انتهاء وقت الاختبار', 'assertive');
      } else if (this.secondsRemaining === 60) { // دقيقة واحدة
        window.a11y.announce('تنبيه هام: متبقي دقيقة واحدة فقط على انتهاء وقت الاختبار', 'assertive');
        document.getElementById('timer-box')?.classList.add('urgent');
      }

      if (this.secondsRemaining <= 0) {
        clearInterval(this.timerInterval);
        window.a11y.announce('انتهى الوقت المخصص للاختبار! سيتم تسليم الإجابات تلقائياً الآن.', 'assertive');
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
    const formatted = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    box.textContent = formatted;
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

    // توليد خيارات الإجابة
    const choicesHtml = q.choices.map((c, cIdx) => {
      const isChecked = this.answers[q.id] === c.id;
      const inputId = `choice_${q.id}_${c.id}`;

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
            <span>${this.escapeHtml(c.choice_text)}</span>
          </label>
        </li>
      `;
    }).join('');

    container.innerHTML = `
      <div class="question-card" role="region" aria-labelledby="q-legend-${q.id}">
        <fieldset class="question-fieldset">
          <legend id="q-legend-${q.id}" class="question-legend">
            <span class="badge badge-primary" style="margin-left: 0.5rem;">السؤال ${index + 1} من ${this.questions.length}</span>
            ${this.escapeHtml(q.question_text)}
          </legend>
          <ul class="choices-list" role="radiogroup" aria-labelledby="q-legend-${q.id}">
            ${choicesHtml}
          </ul>
        </fieldset>
      </div>
    `;

    // ربط أحداث الاختيار
    container.querySelectorAll('.choice-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const qid = e.target.getAttribute('data-qid');
        const cid = e.target.getAttribute('data-cid');
        this.answers[qid] = cid;
        window.a11y.announce('تم تحديد الإجابة');
        this.updateButtonsState();
      });
    });

    this.updateButtonsState();

    // إشعار قارئ الشاشة برقم السؤال ونص السؤال
    window.a11y.announce(`السؤال رقم ${index + 1} من ${this.questions.length}: ${q.question_text}`);
    window.a11y.focusElement(`#q-legend-${q.id}`);
  }

  updateButtonsState() {
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const btnSubmit = document.getElementById('btn-submit-exam');

    btnPrev.disabled = this.currentIndex === 0;

    if (this.currentIndex === this.questions.length - 1) {
      btnNext.style.display = 'none';
      btnSubmit.style.display = 'inline-flex';
    } else {
      btnNext.style.display = 'inline-flex';
      btnSubmit.style.display = 'none';
    }
  }

  prevQuestion() {
    if (this.currentIndex > 0) {
      this.renderQuestion(this.currentIndex - 1);
    }
  }

  nextQuestion() {
    if (this.currentIndex < this.questions.length - 1) {
      this.renderQuestion(this.currentIndex + 1);
    }
  }

  confirmSubmit() {
    const answeredCount = Object.keys(this.answers).length;
    const total = this.questions.length;
    const unanswered = total - answeredCount;

    let msg = `هل أنت متأكد من رغبتك في إنهاء وتسليم الاختبار؟\n\n`;
    msg += `• عدد الأسئلة المجابة: ${answeredCount} من ${total}\n`;
    if (unanswered > 0) {
      msg += `• تنبيه: يوجد ${unanswered} سؤال لم تقم بالإجابة عليها بعد!\n`;
    }

    if (confirm(msg)) {
      this.submitFinal();
    }
  }

  async submitFinal() {
    clearInterval(this.timerInterval);

    // تجهيز الإجابات بتنسيق [{ question_id, choice_id }]
    const payload = this.questions.map(q => ({
      question_id: q.id,
      choice_id: this.answers[q.id] || null
    }));

    const btnSubmit = document.getElementById('btn-submit-exam');
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'جاري التصحيح والتقييم...';
    }

    window.a11y.announce('جاري تسليم وتصحيح الاختبار سحابياً، يرجى الانتظار...', 'assertive');

    try {
      const result = await window.db.submitExam(this.examId, payload);
      const submissionId = result.submission_id || result.id;
      
      // الانتقال المباشر لصفحة النتيجة والتغذية الراجعة
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
