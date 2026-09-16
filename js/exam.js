/**
 * محرك الاختبار التفاعلي الذكي (Interactive Exam Engine v1.0.4)
 * مستلهم من أفضل تطبيقات التعلم الذاتي (Duolingo / Brilliant / Quizlet)
 * يدعم:
 * 1. نمط التعلم الذاتي التفاعلي مع التحقق الفوري والتعليلات التأصيلية
 * 2. نظام التحفيز والاحتواء المعرفي عند الخطأ لضمان الاستمرارية والشغف
 * 3. خريطة الأسئلة التفاعلية (Question Jump Palette)
 * 4. أزرار التنقل الذكية المنسجمة مع اتجاه الكتابة العربي
 * 5. المؤثرات الصوتية التخليقية المتاحة (Web Audio API)
 * 6. الاستجابة الحسية والاهتزاز اللمسي (Haptic Feedback)
 * 7. اختصارات لوحة المفاتيح السريعة لذوي الإعاقة ومستخدمي الحواسيب
 */

class ExamEngine {
  constructor() {
    this.examId = null;
    this.examData = null;
    this.questions = [];
    this.currentIndex = 0;
    this.answers = {}; // { [question_id]: choice_id }
    this.checkedQuestions = {}; // { [question_id]: { isCorrect, selectedChoiceId, correctChoiceId, explanation } }
    this.timerInterval = null;
    this.secondsRemaining = 0;
    this.hasSetupKeyboard = false;

    // إعدادات التفاعل والتعلم
    this.isLearningMode = localStorage.getItem('madarej_learning_mode') !== 'false'; // مفعل افتراضياً
    this.soundEnabled = localStorage.getItem('madarej_sound_enabled') !== 'false';   // مفعل افتراضياً
    this.streakCount = 0;

    // بنك المعرفة والتعليلات التأصيلية الموثقة للمقررات
    this.KNOWLEDGE_BANK = {
      // علوم القرآن الكريم - المسألة 1: المكي والمدني
      'c1000000-0000-0000-0000-000000000001': {
        correctChoiceId: 'aba0bf2f-bee0-4b3f-8fbb-04ce0b889911',
        correctChoiceText: 'ما نزل قبل الهجرة النبوية وإن كان بغير مكة',
        explanation: 'الضابط الزماني هو المعتمد والمحقق عند جماهير العلماء والمفسرين (ابن كثير، السيوطي، والزركشي)؛ فما نزل قبل الهجرة مكي وما نزل بعدها مدني، وهو أضبط من ضابط المكان أو المخاطب.'
      },
      // علوم القرآن الكريم - المسألة 2: جمع القرآن في عهد الصديق
      'c2000000-0000-0000-0000-000000000001': {
        correctChoiceId: 'bdd4b4b7-c6f0-49db-a3e1-3deb2bfc30ad',
        correctChoiceText: 'زيد بن ثابت رضي الله عنه',
        explanation: 'ندب الخليفة أبو بكر الصديق زيد بن ثابت لخصائص اجتمعت فيه: شبابه ونشاطه، وفطنته وورعه، وكونه كاتب الوحي لرسول الله ﷺ، وشهوده العرضة الأخيرة للقرآن.'
      },
      // علوم القرآن الكريم - المسألة 3: العبرة بعموم اللفظ
      'c3000000-0000-0000-0000-000000000001': {
        correctChoiceId: '948ba2f1-6440-4730-bdae-2e43ab93fbb8',
        correctChoiceText: 'بقاء حكم الآية عاماً لكل ما تناوله اللفظ وإن نزل على واقعة معينة',
        explanation: 'القاعدة الأصولية والتفسيرية المقررة عند المحققين تفيد أن خصوص السبب لا يقصر عموم اللفظ القرآني، بل يتعدى الحكم لجميع الوقائع والأشخاص المماثلين.'
      }
    };

    // عبارات التحفيز والاحتواء المعرفي عند الخطأ (Growth Mindset Empathy)
    this.GROWTH_MINDSET_QUOTES = [
      'لا بأس عليك! الخطأ في مسار التعلّم هو أول مدارج الرسوخ المعرفي وتثبيت المسائل. 💡',
      'محاولة طيبة وتفكير مقدّر! بقراءة التعليل التأصيلي أدناه ستكتشف سر المسألة ووجه الصواب فيها. 🌱',
      'فرصة ممتازة للتصويب! العلم إنما يُنال بالتأمل وتدارك ما فات؛ استمر بعزيمة وهمّة عالية. 🎯',
      'أحسنت المحاولة! طالب العلم الحقيقي هو من يستثمر العثرة ليصعد بها درجة جديدة في مدارج الإتقان. 🧗',
      'كل خطوة محاولة هي كسب معرفي جديد؛ راجع وجه الصواب واصل تقدمك بثقة واطمئنان. 💫',
      'عثرة يسيرة تورث بصيرة! اقرأ التوجيه العلمي بالأسفل لترسخ القاعدة في ذاكرتك للأبد. 📖'
    ];

    // عبارات الاحتفاء بالإجابة الصحيحة
    this.PRAISE_QUOTES = [
      'أحسنت وأجدت! إجابة سديدة واستنباط علمي متقن 🌟',
      'ممتاز جداً! استحضار موفق ومبارك للقواعد والمسائل 🎯',
      'رائع! إتقان متميز يدعو للفخر والاعتزاز 🚀',
      'إجابة نموذجية صحيحة! زادك الله فهماً وعلماً ورسوخاً 💫',
      'تبارك الله! خطوة متقدمة وثابتة نحو الامتياز الأكاديمي 🏆'
    ];
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
            <p style="margin: 1rem 0; color: var(--text-muted);">يرجى مراجعة إدارة المنصة أو المشرف الأكاديمي.</p>
            <a href="index.html" class="btn btn-primary">العودة لمقررات المنصة</a>
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

  setupUI() {
    document.getElementById('exam-title').textContent = this.examData.title;
    document.getElementById('total-questions-count').textContent = this.questions.length;
    document.getElementById('nav-total-count').textContent = this.questions.length;

    const duration = parseInt(this.examData.duration_minutes, 10) || 0;
    if (duration > 0) {
      this.secondsRemaining = duration * 60;
      this.updateTimerDisplay();
    } else {
      document.getElementById('timer-box').innerHTML = '<span>الوقت: مفتوح</span>';
    }

    // زر تبديل نمط التعلم التفاعلي
    const btnMode = document.getElementById('btn-mode-toggle');
    if (btnMode) {
      btnMode.className = this.isLearningMode ? 'mode-toggle-btn active' : 'mode-toggle-btn';
      btnMode.setAttribute('aria-pressed', String(this.isLearningMode));
      btnMode.textContent = this.isLearningMode ? '⚡ نمط التعلم الذاتي' : '⏱️ نمط الاختبار الرسمي';
      btnMode.addEventListener('click', () => this.toggleLearningMode());
    }

    // زر تبديل الصوت التفاعلي
    const btnSound = document.getElementById('btn-sound-toggle');
    if (btnSound) {
      btnSound.className = this.soundEnabled ? 'mode-toggle-btn active' : 'mode-toggle-btn';
      btnSound.textContent = this.soundEnabled ? '🔊 الصوت: مفعل' : '🔇 الصوت: صامت';
      btnSound.addEventListener('click', () => this.toggleSound());
    }

    // أزرار التنقل
    document.getElementById('btn-prev')?.addEventListener('click', () => this.prevQuestion());
    document.getElementById('btn-next')?.addEventListener('click', () => this.nextQuestion());
    document.getElementById('btn-check-answer')?.addEventListener('click', () => this.checkCurrentAnswer());
    document.getElementById('btn-submit-exam')?.addEventListener('click', () => this.confirmSubmit());

    this.renderQuestionPalette();
  }

  toggleLearningMode() {
    this.isLearningMode = !this.isLearningMode;
    localStorage.setItem('madarej_learning_mode', String(this.isLearningMode));

    const btn = document.getElementById('btn-mode-toggle');
    if (btn) {
      btn.className = this.isLearningMode ? 'mode-toggle-btn active' : 'mode-toggle-btn';
      btn.setAttribute('aria-pressed', String(this.isLearningMode));
      btn.textContent = this.isLearningMode ? '⚡ نمط التعلم الذاتي' : '⏱️ نمط الاختبار الرسمي';
    }

    const msg = this.isLearningMode 
      ? 'تم تفعيل نمط التعلم الذاتي: ستحصل على تغذية راجعة فورية وتعليلات علمية بعد كل مسألة' 
      : 'تم تفعيل نمط الاختبار الرسمي: إخفاء التغذية الراجعة الفورية للمحاكاة الامتحانية';
    window.a11y?.announce(msg);
    this.triggerHaptic(25);
    this.renderQuestion(this.currentIndex);
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    localStorage.setItem('madarej_sound_enabled', String(this.soundEnabled));

    const btn = document.getElementById('btn-sound-toggle');
    if (btn) {
      btn.className = this.soundEnabled ? 'mode-toggle-btn active' : 'mode-toggle-btn';
      btn.textContent = this.soundEnabled ? '🔊 الصوت: مفعل' : '🔇 الصوت: صامت';
    }

    window.a11y?.announce(this.soundEnabled ? 'تم تفعيل المؤثرات الصوتية' : 'تم كتم الصوت');
    this.triggerHaptic(20);
  }

  /**
   * توليد نغمات صوتية تخليقية عبر Web Audio API (صفر باندويث، تعمل دون اتصال 100%)
   */
  playAudioFeedback(isCorrect) {
    if (!this.soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (isCorrect) {
        // نغمة نجاح صاعدة ومبهجة (C5 -> E5 -> G5)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08); // E5
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16); // G5
        gain.gain.setValueAtTime(0.14, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
        osc.start();
        osc.stop(ctx.currentTime + 0.38);
      } else {
        // نغمة احتواء هادئة ولطيفة تشبه الماريمبا (غير قاسية إطلاقاً)
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(329.63, ctx.currentTime); // E4
        osc.frequency.setValueAtTime(293.66, ctx.currentTime + 0.12); // D4
        gain.gain.setValueAtTime(0.11, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
        osc.start();
        osc.stop(ctx.currentTime + 0.32);
      }
    } catch (e) {}
  }

  /**
   * خريطة الأسئلة التفاعلية (Question Jump Palette)
   */
  renderQuestionPalette() {
    const grid = document.getElementById('palette-buttons-grid');
    if (!grid) return;

    grid.innerHTML = this.questions.map((q, idx) => {
      const isCurrent = idx === this.currentIndex;
      const isAnswered = Boolean(this.answers[q.id]);
      const isBookmarked = window.bookmarksManager?.isBookmarked(q.id);

      let classes = ['palette-item-btn'];
      if (isCurrent) classes.push('current');
      if (isAnswered) classes.push('answered');
      if (isBookmarked) classes.push('bookmarked');

      const ariaStatus = isCurrent ? 'المسألة الحالية' : (isAnswered ? 'تمت الإجابة' : 'شاغرة');

      return `
        <button 
          type="button" 
          class="${classes.join(' ')}" 
          data-idx="${idx}"
          aria-label="المسألة ${idx + 1}: ${ariaStatus}"
          title="المسألة ${idx + 1}"
        >
          ${idx + 1}
        </button>
      `;
    }).join('');

    grid.querySelectorAll('.palette-item-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetIdx = parseInt(btn.getAttribute('data-idx'), 10);
        this.jumpToQuestion(targetIdx);
      });
    });
  }

  jumpToQuestion(index) {
    if (index === this.currentIndex) return;
    this.triggerHaptic(15);
    this.renderQuestion(index);
  }

  setupKeyboardShortcuts() {
    if (this.hasSetupKeyboard) return;
    this.hasSetupKeyboard = true;

    document.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      const key = e.key;

      if (['1', '2', '3', '4'].includes(key)) {
        const choiceIdx = parseInt(key, 10) - 1;
        this.selectChoiceByIndex(choiceIdx);
      } else if (['أ', 'ب', 'ج', 'د'].includes(key)) {
        const map = { 'أ': 0, 'ب': 1, 'ج': 2, 'د': 3 };
        this.selectChoiceByIndex(map[key]);
      } else if (key === 'ArrowLeft' || key.toLowerCase() === 'n') {
        this.nextQuestion();
      } else if (key === 'ArrowRight' || key.toLowerCase() === 'p') {
        this.prevQuestion();
      } else if (key.toLowerCase() === 'b' || key.toLowerCase() === 's') {
        document.getElementById('btn-toggle-bookmark')?.click();
      } else if (key === 'Enter') {
        if (this.isLearningMode && !this.checkedQuestions[this.questions[this.currentIndex]?.id]) {
          this.checkCurrentAnswer();
        } else {
          this.nextQuestion();
        }
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

      this.triggerHaptic(25);
      window.a11y?.announce(`تم اختيار: ${targetChoice.choice_text}`);
      this.updateButtonsState();
      this.renderQuestionPalette();
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
    const feedbackArea = document.getElementById('feedback-render-area');

    // تحديث شريط التقدم
    const progressPct = Math.round(((index + 1) / this.questions.length) * 100);
    const progressBar = document.getElementById('exam-progress-bar');
    if (progressBar) {
      progressBar.style.width = progressPct + '%';
      progressBar.setAttribute('aria-valuenow', progressPct);
    }

    document.getElementById('current-question-num').textContent = index + 1;
    document.getElementById('nav-curr-idx').textContent = index + 1;

    // حالة الحفظ
    const isSaved = window.bookmarksManager?.isBookmarked(q.id);
    const bookmarkBtnText = isSaved ? 'محفوظة للمراجعة ★' : 'حفظ للمراجعة ☆';
    const bookmarkBtnClass = isSaved ? 'btn-bookmark bookmarked' : 'btn-bookmark';

    const checkedState = this.checkedQuestions[q.id];

    const letters = ['أ', 'ب', 'ج', 'د'];
    const choicesHtml = q.choices.map((c, cIdx) => {
      const isChecked = this.answers[q.id] === c.id;
      const inputId = `choice_${q.id}_${c.id}`;
      const prefixLetter = letters[cIdx] || (cIdx + 1);

      let labelClasses = ['choice-label'];
      if (checkedState) {
        if (c.id === checkedState.correctChoiceId) {
          labelClasses.push('revealed-correct');
        } else if (isChecked && !checkedState.isCorrect) {
          labelClasses.push('revealed-wrong');
        }
      }

      return `
        <li class="choice-item">
          <input 
            type="radio" 
            name="question_${q.id}" 
            id="${inputId}" 
            value="${c.id}" 
            class="choice-input" 
            ${isChecked ? 'checked' : ''}
            ${checkedState ? 'disabled' : ''}
            data-qid="${q.id}"
            data-cid="${c.id}"
          />
          <label for="${inputId}" class="${labelClasses.join(' ')}">
            <span class="choice-custom-radio" aria-hidden="true"></span>
            <span style="font-weight: 800; color: var(--primary); margin-left: 0.5rem;">(${prefixLetter})</span>
            <span style="flex: 1;">${this.escapeHtml(c.choice_text)}</span>
            ${checkedState && c.id === checkedState.correctChoiceId ? '<span style="font-weight: 900; margin-right: 0.5rem;">✓</span>' : ''}
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
          <span>💡 [1-4] لاختيار الإجابة | [Enter] للتحقق أو التقدم</span>
          <span>[← / →] للتنقل بين الأسئلة | [B] لحفظ المسألة</span>
        </div>
      </div>
    `;

    // عرض التغذية الراجعة إذا كانت مفحوصة مسبقاً
    if (checkedState && this.isLearningMode) {
      this.renderFeedbackCard(checkedState);
    } else if (feedbackArea) {
      feedbackArea.innerHTML = '';
    }

    // ربط زر الحفظ
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
      this.renderQuestionPalette();
    });

    // ربط الخيارات
    container.querySelectorAll('.choice-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const qid = e.target.getAttribute('data-qid');
        const cid = e.target.getAttribute('data-cid');
        this.answers[qid] = cid;
        this.triggerHaptic(25);
        window.a11y?.announce('تم تحديد الخيار');
        this.updateButtonsState();
        this.renderQuestionPalette();
      });
    });

    this.updateButtonsState();
    this.renderQuestionPalette();

    window.a11y?.announce(`المسألة رقم ${index + 1} من ${this.questions.length}: ${q.question_text}`);
    window.a11y?.focusElement(`#q-legend-${q.id}`);
  }

  /**
   * فحص الإجابة في نمط التعلم الذاتي التفاعلي
   */
  checkCurrentAnswer() {
    const q = this.questions[this.currentIndex];
    const selectedCid = this.answers[q.id];

    if (!selectedCid) {
      alert('يرجى اختيار إحدى الإجابات أولاً للتحقق.');
      return;
    }

    // مطابقة الإجابة مع بنك المعرفة المعتمد أو مع بيانات السؤال
    let correctCid = null;
    let correctText = '';
    let explanation = q.explanation || '';

    // 1. فحص بنك المعرفة التأصيلي الموثق
    if (this.KNOWLEDGE_BANK[q.id]) {
      correctCid = this.KNOWLEDGE_BANK[q.id].correctChoiceId;
      correctText = this.KNOWLEDGE_BANK[q.id].correctChoiceText;
      explanation = this.KNOWLEDGE_BANK[q.id].explanation;
    } else {
      // 2. فحص الخيارات المضمنة إن وجدت
      const correctChoice = q.choices?.find(c => c.is_correct);
      if (correctChoice) {
        correctCid = correctChoice.id;
        correctText = correctChoice.choice_text;
      }
    }

    // في حال عدم وجود مفتاح قطعي، نعتمد افتراضياً أول خيار أو نطابق
    if (!correctCid && q.choices?.length > 0) {
      correctCid = q.choices[0].id;
      correctText = q.choices[0].choice_text;
    }

    const isCorrect = (selectedCid === correctCid);

    if (isCorrect) {
      this.streakCount++;
      this.playAudioFeedback(true);
      this.triggerHaptic([30, 30, 60]);
    } else {
      this.streakCount = 0;
      this.playAudioFeedback(false);
      this.triggerHaptic([80, 40, 80]);
    }

    this.updateStreakDisplay();

    const checkedState = {
      isCorrect,
      selectedChoiceId: selectedCid,
      correctChoiceId: correctCid,
      correctChoiceText: correctText,
      explanation: explanation || 'لا يتوفر تعليل إضافي لهذه المسألة.'
    };

    this.checkedQuestions[q.id] = checkedState;
    this.renderQuestion(this.currentIndex);
  }

  renderFeedbackCard(checkedState) {
    const feedbackArea = document.getElementById('feedback-render-area');
    if (!feedbackArea) return;

    if (checkedState.isCorrect) {
      const praise = this.PRAISE_QUOTES[Math.floor(Math.random() * this.PRAISE_QUOTES.length)];
      feedbackArea.innerHTML = `
        <div class="interactive-feedback-card correct" role="status">
          <div class="feedback-header">
            <span class="feedback-icon" aria-hidden="true">🌟</span>
            <h3 class="feedback-title">${praise}</h3>
          </div>
          <div class="feedback-message">
            إجابة صحيحة نموذجية مطابقة للأصول المعتمدة في المنهج الأكاديمي.
          </div>
          ${checkedState.explanation ? `
            <div class="explanation-box" style="margin-top: 0.5rem; background: rgba(255,255,255,0.7);">
              <strong>💡 التعليل العلمي وتأصيل المسألة:</strong> ${this.escapeHtml(checkedState.explanation)}
            </div>
          ` : ''}
          <div class="feedback-actions">
            <button type="button" id="btn-feedback-next" class="btn btn-success btn-sm">
              [←] متابعة إلى المسألة التالية
            </button>
          </div>
        </div>
      `;

      document.getElementById('btn-feedback-next')?.addEventListener('click', () => {
        this.nextQuestion();
      });

      window.a11y?.announce(`إجابة صحيحة! ${praise}`);
    } else {
      // نظام التحفيز والاحتواء المعرفي عند الخطأ
      const quote = this.GROWTH_MINDSET_QUOTES[Math.floor(Math.random() * this.GROWTH_MINDSET_QUOTES.length)];
      feedbackArea.innerHTML = `
        <div class="interactive-feedback-card wrong" role="alert">
          <div class="feedback-header">
            <span class="feedback-icon" aria-hidden="true">💡</span>
            <h3 class="feedback-title" style="color: #9a3412;">محاولة مقدّرة! كل عثرة هي درجة في مدارج الفهم</h3>
          </div>
          <div class="feedback-message">
            ${quote}
          </div>
          <div class="feedback-correct-answer">
            <strong style="color: var(--success);">✓ الصواب المعتمد:</strong> 
            <span>${this.escapeHtml(checkedState.correctChoiceText)}</span>
          </div>
          ${checkedState.explanation ? `
            <div class="explanation-box" style="margin-top: 0.5rem; background: rgba(255,255,255,0.85); border-right-color: #d97706;">
              <strong>📖 التوجيه الأكاديمي وتأصيل المسألة:</strong> ${this.escapeHtml(checkedState.explanation)}
            </div>
          ` : ''}
          <div class="feedback-actions">
            <button type="button" id="btn-feedback-retry" class="btn btn-secondary btn-sm" style="border-color: #d97706; color: #9a3412;">
              ↺ حاول مرة أخرى
            </button>
            <button type="button" id="btn-feedback-continue" class="btn btn-primary btn-sm">
              [←] واصل المسيرة للمسألة التالية
            </button>
          </div>
        </div>
      `;

      document.getElementById('btn-feedback-retry')?.addEventListener('click', () => {
        delete this.checkedQuestions[this.questions[this.currentIndex].id];
        delete this.answers[this.questions[this.currentIndex].id];
        this.renderQuestion(this.currentIndex);
        window.a11y?.announce('تم فتح المسألة لإعادة المحاولة');
      });

      document.getElementById('btn-feedback-continue')?.addEventListener('click', () => {
        this.nextQuestion();
      });

      window.a11y?.announce(`محاولة مقدرة! الصواب المعتمد هو: ${checkedState.correctChoiceText}`);
    }
  }

  updateStreakDisplay() {
    const badge = document.getElementById('streak-badge');
    const text = document.getElementById('streak-text');
    if (!badge || !text) return;

    text.textContent = `${this.streakCount} متتالي`;
    if (this.streakCount > 1) {
      badge.classList.remove('pulse');
      void badge.offsetWidth; // trigger reflow
      badge.classList.add('pulse');
    }
  }

  updateButtonsState() {
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const btnCheck = document.getElementById('btn-check-answer');
    const btnSubmit = document.getElementById('btn-submit-exam');

    const q = this.questions[this.currentIndex];
    const isAnswered = Boolean(this.answers[q?.id]);
    const isChecked = Boolean(this.checkedQuestions[q?.id]);
    const isLast = (this.currentIndex === this.questions.length - 1);

    if (btnPrev) {
      btnPrev.disabled = (this.currentIndex === 0);
    }

    if (this.isLearningMode) {
      // في نمط التعلم الذاتي
      if (!isChecked) {
        if (btnCheck) btnCheck.style.display = isAnswered ? 'inline-flex' : 'none';
        if (btnNext) btnNext.style.display = isAnswered ? 'none' : (isLast ? 'none' : 'inline-flex');
        if (btnSubmit) btnSubmit.style.display = isLast && isAnswered ? 'none' : 'none';
      } else {
        if (btnCheck) btnCheck.style.display = 'none';
        if (btnNext) btnNext.style.display = isLast ? 'none' : 'inline-flex';
        if (btnSubmit) btnSubmit.style.display = isLast ? 'inline-flex' : 'none';
      }
    } else {
      // في نمط الاختبار الرسمي
      if (btnCheck) btnCheck.style.display = 'none';
      if (btnNext) btnNext.style.display = isLast ? 'none' : 'inline-flex';
      if (btnSubmit) btnSubmit.style.display = isLast ? 'inline-flex' : 'none';
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
    } else {
      // إذا وصل للنهاية
      this.confirmSubmit();
    }
  }

  confirmSubmit() {
    const answeredCount = Object.keys(this.answers).length;
    const total = this.questions.length;
    const unanswered = total - answeredCount;

    let msg = `تنبيه أكاديمي: هل أنت مستعد لتسليم هذا الاختبار الآن؟\n\n`;
    msg += `• عدد المسائل المجابة: ${answeredCount} من أصل ${total}\n`;
    if (unanswered > 0) {
      msg += `• تنبيه: يوجد ${unanswered} مسائل لم تقم بالإجابة عليها بعد!\n`;
    }

    if (confirm(msg)) {
      this.submitFinal();
    }
  }

  async submitFinal() {
    clearInterval(this.timerInterval);
    this.triggerHaptic([40, 40, 80]);

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
    return str ? str.replace(/[&<>'\"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)) : '';
  }
}

window.examEngine = new ExamEngine();
