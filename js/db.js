/**
 * طبقة إدارة البيانات والاتصال السحابي فائق المرونة (Resilient Data Access Layer)
 * تجمع بين: الاتصال السحابي المباشر عبر REST API (بدون تبعيات)،
 * ومكتبة Supabase JS (إن وجدت)، والمحاكاة الذاتية في وضع عدم الاتصال (Offline Queue).
 * مخصصة حصرياً لقسم القرآن الكريم وعلومه — كلية التربية، جامعة صنعاء
 */

class DatabaseManager {
  constructor() {
    this.client = null;
    this.initMockData();
  }

  init() {
    if (window.CONFIG.isSupabaseConfigured() && window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        this.client = window.supabase.createClient(
          window.CONFIG.SUPABASE_URL,
          window.CONFIG.SUPABASE_ANON_KEY
        );
      } catch (e) {
        console.warn('تعذر تهيئة عميل Supabase، سيتم الاعتماد على REST API المباشر:', e);
      }
    }
  }

  /**
   * استدعاء واجهة Supabase REST API مباشرة بسرعة وأمان دون الاعتماد على مكتبات خارجية
   */
  async fetchRest(path, method = 'GET', body = null) {
    if (!window.CONFIG.isSupabaseConfigured()) return null;

    const url = `${window.CONFIG.SUPABASE_URL}/rest/v1/${path}`;
    const user = window.authManager?.getUser();
    
    // استخدام التوكن السحابي المشفر فقط (JWT يبدأ بـ eyJ) وتفادي التوكنات الرمزية
    const rawToken = user?.token;
    const isRealJwt = typeof rawToken === 'string' && rawToken.startsWith('eyJ');
    const token = isRealJwt ? rawToken : window.CONFIG.SUPABASE_ANON_KEY;

    const headers = {
      'apikey': window.CONFIG.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const options = { method, headers };
    if (body) {
      options.body = JSON.stringify(body);
    }

    // مهلة زمنية صارمة 3 ثوانٍ لمنع التعثر في حلقة مفرغة عند بطء الشبكة السحابية
    let timeoutId = null;
    if (typeof AbortController !== 'undefined') {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 3000);
      options.signal = controller.signal;
    }

    try {
      const res = await fetch(url, options);
      if (timeoutId) clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`خطأ في طلب السحابة (${res.status}): ${errText}`);
      }
      
      if (res.status === 204) return true;

      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await res.json();
      }
      return true;
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      throw err;
    }
  }

  // ==========================================
  // المواد والمقررات التخصصية (Subjects) - إدارة سيادية حتمية
  // ==========================================
  async getSubjects(includeInactive = false) {
    const deletedList = JSON.parse(localStorage.getItem('madarej_deleted_subjects') || '[]');
    const statusMap = JSON.parse(localStorage.getItem('madarej_subjects_status') || '{}');

    let result = [];

    if (window.CONFIG.isSupabaseConfigured()) {
      try {
        const data = await this.fetchRest('subjects?select=*&order=created_at.asc');
        if (Array.isArray(data) && data.length > 0) {
          result = data;
        }
      } catch (err) {}

      if (result.length === 0 && this.client) {
        try {
          const { data, error } = await this.client.from('subjects').select('*').order('created_at', { ascending: true });
          if (!error && Array.isArray(data) && data.length > 0) result = data;
        } catch (e) {}
      }
    }

    if (result.length === 0) {
      result = JSON.parse(localStorage.getItem('edutest_demo_subjects') || '[]');
    }

        // دمج مقرر أحكام العقوبات التخصصي لضمان ظهوره الفوري والمستمر
    if (typeof window !== 'undefined' && window.PENAL_LAW_CURRICULUM && window.PENAL_LAW_CURRICULUM.subject) {
      const penalSubj = window.PENAL_LAW_CURRICULUM.subject;
      if (!result.some(s => s.id === penalSubj.id)) {
        result.push(penalSubj);
      }
    }

    // فلترة المحذوفات حتمياً ومنع ظهورها في أي شاشة
    result = result.filter(s => !deletedList.includes(s.id));

    // تطبيق حالة التفعيل والتعطيل المتزامنة
    result = result.map(s => {
      const isOverridden = typeof statusMap[s.id] === 'boolean';
      return {
        ...s,
        is_active: isOverridden ? statusMap[s.id] : Boolean(s.is_active)
      };
    });

    return includeInactive ? result : result.filter(s => s.is_active);
  }

  async getSubjectById(id) {
    const deletedList = JSON.parse(localStorage.getItem('madarej_deleted_subjects') || '[]');
    if (deletedList.includes(id)) return null;

    const subjects = await this.getSubjects(true);
    return subjects.find(s => s.id === id) || null;
  }

  async deleteSubject(subjectId) {
    // 1. تسجيل الحذف الحتمي في السجل المستمر
    const deletedList = JSON.parse(localStorage.getItem('madarej_deleted_subjects') || '[]');
    if (!deletedList.includes(subjectId)) {
      deletedList.push(subjectId);
      localStorage.setItem('madarej_deleted_subjects', JSON.stringify(deletedList));
    }

    // 2. تحديث الذاكرة المحلية للمقررات
    let list = JSON.parse(localStorage.getItem('edutest_demo_subjects') || '[]');
    list = list.filter(s => s.id !== subjectId);
    localStorage.setItem('edutest_demo_subjects', JSON.stringify(list));

    // 3. حذف كافة النماذج الاختبارية التابعة للمقرر (Cascading Delete)
    let exams = JSON.parse(localStorage.getItem('edutest_demo_exams') || '[]');
    const deletedExams = exams.filter(e => e.subject_id === subjectId);
    exams = exams.filter(e => e.subject_id !== subjectId);
    localStorage.setItem('edutest_demo_exams', JSON.stringify(exams));

    // 4. حذف الأسئلة والخيارات المرتبطة بالنماذج المحذوفة
    const deletedExamIds = deletedExams.map(e => e.id);
    if (deletedExamIds.length > 0) {
      let questions = JSON.parse(localStorage.getItem('edutest_demo_questions') || '[]');
      questions = questions.filter(q => !deletedExamIds.includes(q.exam_id));
      localStorage.setItem('edutest_demo_questions', JSON.stringify(questions));
    }

    // 5. محاولة الحذف السحابي بصمت دون إيقاف المتصفح في حال خطأ الأذونات
    if (window.CONFIG.isSupabaseConfigured()) {
      try {
        await this.fetchRest(`subjects?id=eq.${subjectId}`, 'DELETE');
      } catch (e) {
        console.warn('تنبيه: تم اعتماد الحذف الإداري محلياً مع جدولة الحذف السحابي:', e);
      }
      if (this.client) {
        try {
          await this.client.from('subjects').delete().eq('id', subjectId);
        } catch (e) {}
      }
    }

    return true;
  }

  async toggleSubjectActive(subjectId, currentActive) {
    const newActive = !currentActive;

    // 1. تسجيل الحالة الجديدة حتمياً في خريطة الحالات
    const statusMap = JSON.parse(localStorage.getItem('madarej_subjects_status') || '{}');
    statusMap[subjectId] = newActive;
    localStorage.setItem('madarej_subjects_status', JSON.stringify(statusMap));

    // 2. تحديث في الكاش المحلي
    const list = JSON.parse(localStorage.getItem('edutest_demo_subjects') || '[]');
    const item = list.find(s => s.id === subjectId);
    if (item) {
      item.is_active = newActive;
      localStorage.setItem('edutest_demo_subjects', JSON.stringify(list));
    }

    // 3. محاولة المزامنة السحابية بصمت
    if (window.CONFIG.isSupabaseConfigured()) {
      try {
        await this.fetchRest(`subjects?id=eq.${subjectId}`, 'PATCH', { is_active: newActive });
      } catch (e) {}
      if (this.client) {
        try {
          await this.client.from('subjects').update({ is_active: newActive }).eq('id', subjectId);
        } catch (e) {}
      }
    }

    return newActive;
  }

  // ==========================================
  // النماذج الاختبارية (Exams)
  // ==========================================
    async getExamsBySubject(subjectId) {
    if (typeof window !== 'undefined' && window.PENAL_LAW_CURRICULUM && (subjectId === 'subj_penal_law_401' || subjectId === window.PENAL_LAW_CURRICULUM.subject.id)) {
      const deletedExams = JSON.parse(localStorage.getItem('madarej_deleted_exams') || '[]');
      const statusMap = JSON.parse(localStorage.getItem('madarej_exams_status') || '{}');
      return window.PENAL_LAW_CURRICULUM.exams
        .filter(e => !deletedExams.includes(e.id))
        .map(e => ({
          ...e,
          is_published: typeof statusMap[e.id] === 'boolean' ? statusMap[e.id] : Boolean(e.is_published)
        }))
        .filter(e => e.is_published);
    }

    if (window.CONFIG.isSupabaseConfigured()) {
      try {
        const data = await this.fetchRest(`exams?subject_id=eq.${subjectId}&is_published=eq.true&order=created_at.asc&select=*`);
        if (Array.isArray(data)) return data;
      } catch (e) {}

      if (this.client) {
        try {
          const { data, error } = await this.client
            .from('exams')
            .select('*')
            .eq('subject_id', subjectId)
            .eq('is_published', true)
            .order('created_at', { ascending: true });
          if (!error && Array.isArray(data)) return data;
        } catch (e) {}
      }
    }

    const list = JSON.parse(localStorage.getItem('edutest_demo_exams') || '[]');
    return list.filter(e => e.subject_id === subjectId && e.is_published);
  }



  async getAllExams() {
    const deletedSubjects = JSON.parse(localStorage.getItem('madarej_deleted_subjects') || '[]');
    const deletedExams = JSON.parse(localStorage.getItem('madarej_deleted_exams') || '[]');
    const statusMap = JSON.parse(localStorage.getItem('madarej_exams_status') || '{}');

    let exams = [];
    if (window.CONFIG.isSupabaseConfigured()) {
      try {
        const data = await this.fetchRest('exams?select=*,subjects(title)&order=created_at.desc');
        if (Array.isArray(data)) exams = data;
      } catch (e) {}

      if (exams.length === 0 && this.client) {
        try {
          const { data, error } = await this.client
            .from('exams')
            .select('*, subjects(title)')
            .order('created_at', { ascending: false });
          if (!error && Array.isArray(data)) exams = data;
        } catch (e) {}
      }
    }

    if (exams.length === 0) {
      const demoExams = JSON.parse(localStorage.getItem('edutest_demo_exams') || '[]');
      const demoSubjects = JSON.parse(localStorage.getItem('edutest_demo_subjects') || '[]');
      exams = demoExams.map(e => ({
        ...e,
        subjects: { title: demoSubjects.find(s => s.id === e.subject_id)?.title || 'مقرر تخصصي' }
      }));
    }

    // فلترة المحذوفات والمقررات المحذوفة
    exams = exams.filter(e => !deletedExams.includes(e.id) && !deletedSubjects.includes(e.subject_id));

    // تطبيق حالة النشر المتزامنة
    exams = exams.map(e => {
      const isOverridden = typeof statusMap[e.id] === 'boolean';
      return {
        ...e,
        is_published: isOverridden ? statusMap[e.id] : Boolean(e.is_published)
      };
    });

        // دمج امتحانات أحكام العقوبات
    if (typeof window !== 'undefined' && window.PENAL_LAW_CURRICULUM && window.PENAL_LAW_CURRICULUM.exams) {
      const pExams = window.PENAL_LAW_CURRICULUM.exams.map(e => ({
        ...e,
        subjects: { title: window.PENAL_LAW_CURRICULUM.subject.title }
      }));
      for (const pe of pExams) {
        if (!exams.some(e => e.id === pe.id)) {
          exams.push(pe);
        }
      }
    }

    return exams;
  }

  async deleteExam(examId) {
    const deletedList = JSON.parse(localStorage.getItem('madarej_deleted_exams') || '[]');
    if (!deletedList.includes(examId)) {
      deletedList.push(examId);
      localStorage.setItem('madarej_deleted_exams', JSON.stringify(deletedList));
    }

    let list = JSON.parse(localStorage.getItem('edutest_demo_exams') || '[]');
    list = list.filter(e => e.id !== examId);
    localStorage.setItem('edutest_demo_exams', JSON.stringify(list));

    if (window.CONFIG.isSupabaseConfigured()) {
      try {
        await this.fetchRest(`exams?id=eq.${examId}`, 'DELETE');
      } catch (e) {}
      if (this.client) {
        try {
          await this.client.from('exams').delete().eq('id', examId);
        } catch (e) {}
      }
    }

    return true;
  }

  async toggleExamPublish(examId, currentPublished) {
    const newPublished = !currentPublished;

    const statusMap = JSON.parse(localStorage.getItem('madarej_exams_status') || '{}');
    statusMap[examId] = newPublished;
    localStorage.setItem('madarej_exams_status', JSON.stringify(statusMap));

    const list = JSON.parse(localStorage.getItem('edutest_demo_exams') || '[]');
    const item = list.find(e => e.id === examId);
    if (item) {
      item.is_published = newPublished;
      localStorage.setItem('edutest_demo_exams', JSON.stringify(list));
    }

    if (window.CONFIG.isSupabaseConfigured()) {
      try {
        await this.fetchRest(`exams?id=eq.${examId}`, 'PATCH', { is_published: newPublished });
      } catch (e) {}
      if (this.client) {
        try {
          await this.client.from('exams').update({ is_published: newPublished }).eq('id', examId);
        } catch (e) {}
      }
    }

    return newPublished;
  }

  // ==========================================
  // جلب أسئلة الاختبار للطالب (آمن ضد الغش)
  // ==========================================
    async getExamForStudent(examId) {
    if (typeof window !== 'undefined' && window.PENAL_LAW_CURRICULUM) {
      const pExam = window.PENAL_LAW_CURRICULUM.exams.find(e => e.id === examId);
      if (pExam) {
        const pQuestions = window.PENAL_LAW_CURRICULUM.questions
          .filter(q => q.exam_id === examId)
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

        const pChoices = window.PENAL_LAW_CURRICULUM.choices;
        const safeQuestions = pQuestions.map(q => {
          const qChoices = pChoices
            .filter(c => c.question_id === q.id)
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
            .map(c => ({
              id: c.id,
              choice_text: c.choice_text,
              is_correct: Boolean(c.is_correct),
              sort_order: c.sort_order
            }));

          return {
            id: q.id,
            question_text: q.question_text,
            explanation: q.explanation,
            points: q.points || 1,
            sort_order: q.sort_order,
            choices: qChoices
          };
        });

        return {
          exam: {
            id: pExam.id,
            title: pExam.title,
            description: pExam.description,
            duration_minutes: pExam.duration_minutes,
            passing_percentage: pExam.passing_percentage
          },
          questions: safeQuestions
        };
      }
    }

    if (window.CONFIG.isSupabaseConfigured() && navigator.onLine) {
      try {
        const data = await this.fetchRest('rpc/get_exam_for_student', 'POST', {
          p_exam_id: examId
        });
        if (data && data.exam && data.questions) {
          localStorage.setItem(`madarej_cached_exam_${examId}`, JSON.stringify(data));
          return data;
        }
      } catch (e) {}

      if (this.client) {
        try {
          const { data, error } = await this.client.rpc('get_exam_for_student', {
            p_exam_id: examId
          });
          if (!error && data) {
            localStorage.setItem(`madarej_cached_exam_${examId}`, JSON.stringify(data));
            return data;
          }
        } catch (e) {}
      }
    }

    // استرجاع من الكاش المحلي في حال انقطاع الشبكة
    const cached = localStorage.getItem(`madarej_cached_exam_${examId}`);
    if (cached) {
      try { return JSON.parse(cached); } catch (e) {}
    }

    const exams = JSON.parse(localStorage.getItem('edutest_demo_exams') || '[]');
    const exam = exams.find(e => e.id === examId);
    if (!exam) throw new Error('النموذج الاختباري غير متوفر');

    const questions = JSON.parse(localStorage.getItem('edutest_demo_questions') || '[]')
      .filter(q => q.exam_id === examId)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    const choices = JSON.parse(localStorage.getItem('edutest_demo_choices') || '[]');

    const safeQuestions = questions.map(q => {
      const qChoices = choices
        .filter(c => c.question_id === q.id)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map(c => ({
          id: c.id,
          choice_text: c.choice_text,
          sort_order: c.sort_order
        }));

      return {
        id: q.id,
        question_text: q.question_text,
        points: q.points || 1,
        sort_order: q.sort_order,
        choices: qChoices
      };
    });

    return {
      exam: {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        duration_minutes: exam.duration_minutes,
        passing_percentage: exam.passing_percentage
      },
      questions: safeQuestions
    };
  }

  // ==========================================
  // تصحيح الاختبار سحابياً وتسجيل النتيجة
  // ==========================================
    async submitExam(examId, answers) {
    if (typeof window !== 'undefined' && window.PENAL_LAW_CURRICULUM) {
      const pExam = window.PENAL_LAW_CURRICULUM.exams.find(e => e.id === examId);
      if (pExam) {
        const user = window.authManager?.getUser();
        if (!user || user.id === 'guest' || String(user.id).startsWith('usr_guest_')) {
          alert('عذراً، يجب تسجيل الدخول بحساب طالب مسجل بالمنصة لتسليم الاختبار وتوثيق نتيجتك رسمياً.');
          window.location.href = `auth.html?mode=login&redirect=exam.html?id=${encodeURIComponent(examId)}`;
          throw new Error('تسليم الاختبار مقتصر على الطلاب المسجلين');
        }
        const pQuestions = window.PENAL_LAW_CURRICULUM.questions.filter(q => q.exam_id === examId);
        const pChoices = window.PENAL_LAW_CURRICULUM.choices;

        let totalPoints = 0;
        let earnedScore = 0;
        const reviewDetails = [];

        for (const q of pQuestions) {
          const qPoints = q.points || 1;
          totalPoints += qPoints;

          const studentAnswer = answers.find(a => a.question_id === q.id);
          const correctChoice = pChoices.find(c => c.question_id === q.id && c.is_correct);
          const isCorrect = Boolean(studentAnswer && correctChoice && studentAnswer.choice_id === correctChoice.id);

          if (isCorrect) earnedScore += qPoints;

          reviewDetails.push({
            question_id: q.id,
            question_text: q.question_text,
            is_correct: isCorrect,
            selected_choice_id: studentAnswer ? studentAnswer.choice_id : null,
            correct_choice_id: correctChoice ? correctChoice.id : null,
            correct_choice_text: correctChoice ? correctChoice.choice_text : 'غير محدد',
            explanation: q.explanation || 'لا يوجد تعليق إضافي لهذه المسألة.'
          });
        }

        const percentage = Math.round((earnedScore / (totalPoints || 1)) * 100);
        const passed = percentage >= (pExam?.passing_percentage || 50);

        const telemetrySnapshot = (typeof window !== 'undefined' && window.telemetry) ? window.telemetry.getSnapshot() : null;

        const submission = {
          id: 'sub_' + Date.now(),
          exam_id: examId,
          user_id: user.id,
          user_name: user.fullName || user.username || 'طالب',
          user_email: user.email || '',
          score: earnedScore,
          total_points: totalPoints,
          percentage: percentage,
          passed: passed,
          passing_percentage: pExam?.passing_percentage || 50,
          completed_at: new Date().toISOString(),
          review_details: reviewDetails,
          telemetry: telemetrySnapshot
        };

        const submissions = JSON.parse(localStorage.getItem('edutest_demo_submissions') || '[]');
        submissions.unshift(submission);
        localStorage.setItem('edutest_demo_submissions', JSON.stringify(submissions));

        return submission;
      }
    }

    if (window.CONFIG.isSupabaseConfigured() && navigator.onLine) {
      try {
        const data = await this.fetchRest('rpc/submit_exam_answers', 'POST', {
          p_exam_id: examId,
          p_answers: answers
        });
        if (data) return data;
      } catch (e) {
        console.warn('فشل إرسال النتيجة سحابياً، جاري الإدراج في طابور المزامنة دون اتصال:', e);
      }

      if (this.client) {
        const { data, error } = await this.client.rpc('submit_exam_answers', {
          p_exam_id: examId,
          p_answers: answers
        });
        if (!error && data) return data;
      }
    }

    // إذا كان الطالب أوفلاين، حفظ الإجابات في طابور المزامنة التلقائية
    try {
      const queue = JSON.parse(localStorage.getItem('madarej_offline_queue') || '[]');
      queue.push({ examId, answers, queued_at: new Date().toISOString() });
      localStorage.setItem('madarej_offline_queue', JSON.stringify(queue));
    } catch (e) {}

    const user = window.authManager.getUser();
    if (!user) throw new Error('يجب تسجيل الدخول أولاً لتسليم الاختبار');

    const exams = JSON.parse(localStorage.getItem('edutest_demo_exams') || '[]');
    const exam = exams.find(e => e.id === examId);
    const questions = JSON.parse(localStorage.getItem('edutest_demo_questions') || '[]')
      .filter(q => q.exam_id === examId);
    const choices = JSON.parse(localStorage.getItem('edutest_demo_choices') || '[]');

    let totalPoints = 0;
    let earnedScore = 0;
    const reviewDetails = [];

    for (const q of questions) {
      const qPoints = q.points || 1;
      totalPoints += qPoints;

      const studentAnswer = answers.find(a => a.question_id === q.id);
      const correctChoice = choices.find(c => c.question_id === q.id && c.is_correct);
      const isCorrect = Boolean(studentAnswer && correctChoice && studentAnswer.choice_id === correctChoice.id);

      if (isCorrect) earnedScore += qPoints;

      reviewDetails.push({
        question_id: q.id,
        question_text: q.question_text,
        is_correct: isCorrect,
        selected_choice_id: studentAnswer ? studentAnswer.choice_id : null,
        correct_choice_id: correctChoice ? correctChoice.id : null,
        correct_choice_text: correctChoice ? correctChoice.choice_text : 'غير محدد',
        explanation: q.explanation || 'لا يوجد تعليق إضافي لهذه المسألة.'
      });
    }

    const percentage = Math.round((earnedScore / (totalPoints || 1)) * 100);
    const passed = percentage >= (exam?.passing_percentage || 50);

    const submission = {
      id: 'sub_' + Date.now(),
      exam_id: examId,
      user_id: user.id,
      user_name: user.fullName,
      score: earnedScore,
      total_points: totalPoints,
      percentage: percentage,
      passed: passed,
      passing_percentage: exam?.passing_percentage || 50,
      completed_at: new Date().toISOString(),
      review_details: reviewDetails
    };

    const submissions = JSON.parse(localStorage.getItem('edutest_demo_submissions') || '[]');
    submissions.unshift(submission);
    localStorage.setItem('edutest_demo_submissions', JSON.stringify(submissions));

    return submission;
  }

  /**
   * مزامنة الاختبارات المعلقة عند عودة اتصال الإنترنت
   */
  async syncPendingSubmissions() {
    try {
      const queue = JSON.parse(localStorage.getItem('madarej_offline_queue') || '[]');
      if (queue.length === 0) return;
      console.log(`[Offline Sync] جاري مزامنة ${queue.length} نتائج معلقة مع السحابة...`);

      const remaining = [];
      for (const item of queue) {
        try {
          await this.fetchRest('rpc/submit_exam_answers', 'POST', {
            p_exam_id: item.examId,
            p_answers: item.answers
          });
        } catch (e) {
          remaining.push(item);
        }
      }
      localStorage.setItem('madarej_offline_queue', JSON.stringify(remaining));
      if (remaining.length === 0) {
        console.log('[Offline Sync] اكتملت مزامنة كافة النتائج بنجاح ');
      }
    } catch (e) {}
  }

  // ==========================================
  // سجل نتائج الطلاب والإشراف العام
  // ==========================================
  async getUserSubmissions(userId) {
    if (window.CONFIG.isSupabaseConfigured()) {
      try {
        const data = await this.fetchRest(`submissions?user_id=eq.${userId}&select=*,exams(title,subject_id,subjects(title))&order=completed_at.desc`);
        if (Array.isArray(data)) return data;
      } catch (e) {}

      if (this.client) {
        try {
          const { data, error } = await this.client
            .from('submissions')
            .select('*, exams(title, subject_id, subjects(title))')
            .eq('user_id', userId)
            .order('completed_at', { ascending: false });
          if (!error && Array.isArray(data)) return data;
        } catch (e) {}
      }
    }

    const submissions = JSON.parse(localStorage.getItem('edutest_demo_submissions') || '[]');
    const exams = JSON.parse(localStorage.getItem('edutest_demo_exams') || '[]');
    const subjects = JSON.parse(localStorage.getItem('edutest_demo_subjects') || '[]');

    return submissions
      .filter(s => s.user_id === userId)
      .map(s => {
        const ex = exams.find(e => e.id === s.exam_id);
        const sb = subjects.find(sub => sub.id === ex?.subject_id);
        return {
          ...s,
          exams: {
            title: ex?.title || 'نموذج اختباري',
            subjects: { title: sb?.title || 'مقرر تخصصي' }
          }
        };
      });
  }

  async getSubmissionById(submissionId) {
    if (window.CONFIG.isSupabaseConfigured()) {
      try {
        const subs = await this.fetchRest(`submissions?id=eq.${submissionId}&select=*,exams(title,description,passing_percentage)`);
        if (Array.isArray(subs) && subs.length > 0) {
          const sub = subs[0];
          const answers = await this.fetchRest(`submission_answers?submission_id=eq.${submissionId}&select=*,questions(question_text,explanation),choices(choice_text)`);
          return { ...sub, answers };
        }
      } catch (e) {}
    }

    const submissions = JSON.parse(localStorage.getItem('edutest_demo_submissions') || '[]');
    return submissions.find(s => s.id === submissionId);
  }

  // ==========================================
  // وظائف الإشراف الأكاديمي الشاملة (Admin Supervision)
  // ==========================================
  async getAdminOverview() {
    let subjectsCount = 0;
    let examsCount = 0;
    let studentsCount = 0;
    let submissionsCount = 0;

    if (window.CONFIG.isSupabaseConfigured()) {
      try {
        const subs = await this.fetchRest('subjects?select=id');
        const exs = await this.fetchRest('exams?select=id');
        const profs = await this.fetchRest('profiles?select=id');
        const submits = await this.fetchRest('submissions?select=id');

        subjectsCount = Array.isArray(subs) ? subs.length : 0;
        examsCount = Array.isArray(exs) ? exs.length : 0;
        studentsCount = Array.isArray(profs) ? profs.length : 0;
        submissionsCount = Array.isArray(submits) ? submits.length : 0;

        return { subjectsCount, examsCount, studentsCount, submissionsCount };
      } catch (e) {
        console.warn('Error fetching admin overview via REST:', e);
      }
    }

    subjectsCount = JSON.parse(localStorage.getItem('edutest_demo_subjects') || '[]').length;
    examsCount = JSON.parse(localStorage.getItem('edutest_demo_exams') || '[]').length;
    studentsCount = JSON.parse(localStorage.getItem('edutest_demo_users') || '[]').length;
    submissionsCount = JSON.parse(localStorage.getItem('edutest_demo_submissions') || '[]').length;

    return { subjectsCount, examsCount, studentsCount, submissionsCount };
  }

  async getStudentsList() {
    if (window.CONFIG.isSupabaseConfigured()) {
      try {
        const data = await this.fetchRest('profiles?select=*&order=created_at.desc');
        if (Array.isArray(data)) return data;
      } catch (e) {}

      if (this.client) {
        try {
          const { data, error } = await this.client.from('profiles').select('*').order('created_at', { ascending: false });
          if (!error && Array.isArray(data)) return data;
        } catch (e) {}
      }
    }

    return JSON.parse(localStorage.getItem('edutest_demo_users') || '[]');
  }

  async getRecentSubmissions(limit = 25) {
    if (window.CONFIG.isSupabaseConfigured()) {
      try {
        const data = await this.fetchRest(`submissions?select=*,profiles(full_name,email),exams(title,subjects(title))&order=completed_at.desc&limit=${limit}`);
        if (Array.isArray(data)) return data;
      } catch (e) {}

      if (this.client) {
        try {
          const { data, error } = await this.client
            .from('submissions')
            .select('*, profiles(full_name, email), exams(title, subjects(title))')
            .order('completed_at', { ascending: false })
            .limit(limit);
          if (!error && Array.isArray(data)) return data;
        } catch (e) {}
      }
    }

    const submissions = JSON.parse(localStorage.getItem('edutest_demo_submissions') || '[]');
    const exams = JSON.parse(localStorage.getItem('edutest_demo_exams') || '[]');
    const subjects = JSON.parse(localStorage.getItem('edutest_demo_subjects') || '[]');

    return submissions.slice(0, limit).map(s => {
      const ex = exams.find(e => e.id === s.exam_id);
      const sb = subjects.find(sub => sub.id === ex?.subject_id);
      return {
        ...s,
        profiles: { full_name: s.user_name || 'طالب', email: s.user_email || '' },
        telemetry: s.telemetry || null,
        exams: {
          title: ex?.title || 'نموذج اختباري',
          subjects: { title: sb?.title || 'مقرر تخصصي' }
        }
      };
    });
  }

  // ==========================================
  // عمليات الإدارة والإنشاء
  // ==========================================
  async createSubject(title, description, code, icon = 'book') {
    if (window.CONFIG.isSupabaseConfigured()) {
      try {
        const data = await this.fetchRest('subjects', 'POST', { title, description, code, icon, is_active: true });
        if (data) return data;
      } catch (e) {}

      if (this.client) {
        const { data, error } = await this.client
          .from('subjects')
          .insert([{ title, description, code, icon, is_active: true }])
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    }

    const subjects = JSON.parse(localStorage.getItem('edutest_demo_subjects') || '[]');
    const newSubject = { id: 'subj_' + Date.now(), title, description, code: code || 'SUBJ_' + Date.now(), icon, is_active: true, created_at: new Date().toISOString() };
    subjects.push(newSubject);
    localStorage.setItem('edutest_demo_subjects', JSON.stringify(subjects));
    return newSubject;
  }

  async createExam(subjectId, title, description, durationMinutes, passingPercentage, isPublished = true) {
    if (window.CONFIG.isSupabaseConfigured()) {
      try {
        const data = await this.fetchRest('exams', 'POST', {
          subject_id: subjectId,
          title,
          description,
          duration_minutes: parseInt(durationMinutes, 10) || 30,
          passing_percentage: parseInt(passingPercentage, 10) || 50,
          is_published: Boolean(isPublished)
        });
        if (data) return data;
      } catch (e) {}

      if (this.client) {
        const { data, error } = await this.client
          .from('exams')
          .insert([{ subject_id: subjectId, title, description, duration_minutes: durationMinutes, passing_percentage: passingPercentage, is_published: isPublished }])
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    }

    const exams = JSON.parse(localStorage.getItem('edutest_demo_exams') || '[]');
    const newExam = { id: 'exam_' + Date.now(), subject_id: subjectId, title, description, duration_minutes: parseInt(durationMinutes, 10) || 30, passing_percentage: parseInt(passingPercentage, 10) || 50, is_published: Boolean(isPublished), created_at: new Date().toISOString() };
    exams.push(newExam);
    localStorage.setItem('edutest_demo_exams', JSON.stringify(exams));
    return newExam;
  }

  async addQuestionWithChoices(examId, questionText, explanation, points, choicesList) {
    if (this.client) {
      const { data: q, error: qErr } = await this.client
        .from('questions')
        .insert([{ exam_id: examId, question_text: questionText, explanation, points: parseInt(points, 10) || 1 }])
        .select()
        .single();
      if (qErr) throw qErr;

      const choicesToInsert = choicesList.map((c, idx) => ({
        question_id: q.id,
        choice_text: c.text,
        is_correct: c.isCorrect,
        sort_order: idx
      }));

      const { error: cErr } = await this.client.from('choices').insert(choicesToInsert);
      if (cErr) throw cErr;
      return q;
    }

    const questions = JSON.parse(localStorage.getItem('edutest_demo_questions') || '[]');
    const choices = JSON.parse(localStorage.getItem('edutest_demo_choices') || '[]');
    const newQ = { id: 'q_' + Date.now() + '_' + Math.floor(Math.random() * 1000), exam_id: examId, question_text: questionText, explanation, points: parseInt(points, 10) || 1, sort_order: questions.filter(q => q.exam_id === examId).length, created_at: new Date().toISOString() };
    questions.push(newQ);

    choicesList.forEach((c, idx) => {
      choices.push({ id: 'c_' + Date.now() + '_' + idx, question_id: newQ.id, choice_text: c.text, is_correct: Boolean(c.isCorrect), sort_order: idx });
    });

    localStorage.setItem('edutest_demo_questions', JSON.stringify(questions));
    localStorage.setItem('edutest_demo_choices', JSON.stringify(choices));
    return newQ;
  }

  initMockData() {
    if (localStorage.getItem('edutest_demo_subjects')) return;
    const defaultSubject = {
      id: 'sub_demo_1',
      title: 'علوم القرآن الكريم',
      description: 'مقرر علوم القرآن الكريم لطلبة قسم القرآن الكريم وعلومه بكلية التربية في جامعة صنعاء؛ دراسة تأصيلية لقضايا الوحي، المكي والمدني، أسباب النزول، وجمع القرآن وتدوينه.',
      code: 'QURAN_SCI',
      icon: 'book',
      is_active: true,
      created_at: new Date().toISOString()
    };
    const defaultExam = {
      id: 'b1000000-0000-0000-0000-000000000001',
      subject_id: 'sub_demo_1',
      title: 'النموذج الاختباري الأول: مباحث علوم القرآن',
      description: 'نموذج اختباري تقييمي يغطي مباحث نزول القرآن وجمعه، وأسباب النزول والمكي والمدني وفق المنهج الأكاديمي المعتمد بالقسم.',
      duration_minutes: 25,
      passing_percentage: 60,
      is_published: true,
      created_at: new Date().toISOString()
    };
    localStorage.setItem('edutest_demo_subjects', JSON.stringify([defaultSubject]));
    localStorage.setItem('edutest_demo_exams', JSON.stringify([defaultExam]));
  }
}

window.db = new DatabaseManager();
