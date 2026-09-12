/**
 * طبقة إدارة البيانات والاتصال السحابي فائق المرونة (Resilient Data Access Layer)
 * تجمع بين: الاتصال السحابي المباشر عبر REST API (بدون تبعيات)،
 * ومكتبة Supabase JS (إن وجدت)، والمحاكاة الذاتية في وضع عدم الاتصال.
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
    const token = user?.token || window.CONFIG.SUPABASE_ANON_KEY;

    const headers = {
      'apikey': window.CONFIG.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const options = { method, headers };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`خطأ في طلب السحابة (${res.status}): ${errText}`);
    }
    return await res.json();
  }

  // ==========================================
  // المواد والمقررات التخصصية (Subjects)
  // ==========================================
  async getSubjects() {
    if (window.CONFIG.isSupabaseConfigured()) {
      try {
        const data = await this.fetchRest('subjects?select=*&is_active=eq.true&order=created_at.asc');
        if (Array.isArray(data)) return data;
      } catch (err) {
        console.warn('فشل طلب REST السحابي للمقررات، جاري المحاولة عبر العميل أو التخزين الاحتياطي:', err);
      }

      if (this.client) {
        try {
          const { data, error } = await this.client
            .from('subjects')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: true });
          if (!error && Array.isArray(data)) return data;
        } catch (e) {
          console.warn('فشل عميل Supabase أيضاً:', e);
        }
      }
    }

    return JSON.parse(localStorage.getItem('edutest_demo_subjects') || '[]');
  }

  async getSubjectById(id) {
    if (window.CONFIG.isSupabaseConfigured()) {
      try {
        const data = await this.fetchRest(`subjects?id=eq.${id}&select=*`);
        if (Array.isArray(data) && data.length > 0) return data[0];
      } catch (e) {
        console.warn('REST error for subject:', e);
      }

      if (this.client) {
        try {
          const { data, error } = await this.client
            .from('subjects')
            .select('*')
            .eq('id', id)
            .single();
          if (!error && data) return data;
        } catch (e) {}
      }
    }

    const list = JSON.parse(localStorage.getItem('edutest_demo_subjects') || '[]');
    return list.find(s => s.id === id);
  }

  // ==========================================
  // النماذج الاختبارية (Exams)
  // ==========================================
  async getExamsBySubject(subjectId) {
    if (window.CONFIG.isSupabaseConfigured()) {
      try {
        const data = await this.fetchRest(`exams?subject_id=eq.${subjectId}&is_published=eq.true&order=created_at.asc&select=*`);
        if (Array.isArray(data)) return data;
      } catch (e) {
        console.warn('REST error for exams:', e);
      }

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
    if (window.CONFIG.isSupabaseConfigured()) {
      try {
        const data = await this.fetchRest('exams?select=*,subjects(title)&order=created_at.desc');
        if (Array.isArray(data)) return data;
      } catch (e) {
        console.warn('REST error for all exams:', e);
      }

      if (this.client) {
        try {
          const { data, error } = await this.client
            .from('exams')
            .select('*, subjects(title)')
            .order('created_at', { ascending: false });
          if (!error && Array.isArray(data)) return data;
        } catch (e) {}
      }
    }

    const exams = JSON.parse(localStorage.getItem('edutest_demo_exams') || '[]');
    const subjects = JSON.parse(localStorage.getItem('edutest_demo_subjects') || '[]');
    return exams.map(e => ({
      ...e,
      subjects: { title: subjects.find(s => s.id === e.subject_id)?.title || 'مقرر تخصصي' }
    }));
  }

  // ==========================================
  // جلب أسئلة الاختبار للطالب (آمن ضد الغش)
  // ==========================================
  async getExamForStudent(examId) {
    if (window.CONFIG.isSupabaseConfigured()) {
      try {
        const data = await this.fetchRest('rpc/get_exam_for_student', 'POST', {
          p_exam_id: examId
        });
        if (data && data.exam && data.questions) return data;
      } catch (e) {
        console.warn('RPC fetch failed via REST, attempting client:', e);
      }

      if (this.client) {
        try {
          const { data, error } = await this.client.rpc('get_exam_for_student', {
            p_exam_id: examId
          });
          if (!error && data) return data;
        } catch (e) {}
      }
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
    if (window.CONFIG.isSupabaseConfigured()) {
      try {
        const data = await this.fetchRest('rpc/submit_exam_answers', 'POST', {
          p_exam_id: examId,
          p_answers: answers
        });
        if (data) return data;
      } catch (e) {
        console.warn('RPC submit failed via REST:', e);
      }

      if (this.client) {
        const { data, error } = await this.client.rpc('submit_exam_answers', {
          p_exam_id: examId,
          p_answers: answers
        });
        if (!error && data) return data;
      }
    }

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

  // ==========================================
  // سجل نتائج الطالب
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
  // عمليات الإدارة
  // ==========================================
  async createSubject(title, description, code, icon = 'book') {
    if (this.client) {
      const { data, error } = await this.client
        .from('subjects')
        .insert([{ title, description, code, icon }])
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    const subjects = JSON.parse(localStorage.getItem('edutest_demo_subjects') || '[]');
    const newSubject = { id: 'subj_' + Date.now(), title, description, code: code || 'SUBJ_' + Date.now(), icon, is_active: true, created_at: new Date().toISOString() };
    subjects.push(newSubject);
    localStorage.setItem('edutest_demo_subjects', JSON.stringify(subjects));
    return newSubject;
  }

  async createExam(subjectId, title, description, durationMinutes, passingPercentage, isPublished = true) {
    if (this.client) {
      const { data, error } = await this.client
        .from('exams')
        .insert([{ subject_id: subjectId, title, description, duration_minutes: durationMinutes, passing_percentage: passingPercentage, is_published: isPublished }])
        .select()
        .single();
      if (error) throw error;
      return data;
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
      title: 'مناهج المفسرين (المستوى الرابع)',
      description: 'مقرر مناهج المفسرين لطلبة قسم القرآن الكريم وعلومه بكلية التربية في جامعة صنعاء — المستوى الرابع (سنة التخرج). شامل لأصول التفسير بالمأثور وبالرأي وضوابطهما.',
      code: 'MANAHIJ_4',
      icon: 'book',
      is_active: true,
      created_at: new Date().toISOString()
    };
    const defaultExam = {
      id: 'b0000000-0000-0000-0000-000000000001',
      subject_id: 'sub_demo_1',
      title: 'الاختبار التجريبي الأول لمناهج المفسرين',
      description: 'نموذج اختباري تدريبي معتمد لطلبة قسم القرآن الكريم وعلومه بكلية التربية — جامعة صنعاء، يغطي النطاق المحدد للاختبار النهائي وفق كتاب المقرر.',
      duration_minutes: 20,
      passing_percentage: 60,
      is_published: true,
      created_at: new Date().toISOString()
    };
    localStorage.setItem('edutest_demo_subjects', JSON.stringify([defaultSubject]));
    localStorage.setItem('edutest_demo_exams', JSON.stringify([defaultExam]));
  }
}

window.db = new DatabaseManager();
