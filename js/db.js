/**
 * طبقة إدارة البيانات والاتصال بقاعدة البيانات (Data Access Layer)
 * تدعم Supabase برمجياً مع التقييم السحابي، وتوفر محاكاة متكاملة في وضع التجربة
 */

class DatabaseManager {
  constructor() {
    this.client = null;
    this.initMockData();
  }

  init() {
    if (window.CONFIG.isSupabaseConfigured() && window.supabase) {
      this.client = window.supabase.createClient(
        window.CONFIG.SUPABASE_URL,
        window.CONFIG.SUPABASE_ANON_KEY
      );
    }
  }

  // ==========================================
  // المواد الدراسية (Subjects)
  // ==========================================
  async getSubjects() {
    if (this.client) {
      const { data, error } = await this.client
        .from('subjects')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    } else {
      return JSON.parse(localStorage.getItem('edutest_demo_subjects') || '[]');
    }
  }

  async getSubjectById(id) {
    if (this.client) {
      const { data, error } = await this.client
        .from('subjects')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    } else {
      const list = JSON.parse(localStorage.getItem('edutest_demo_subjects') || '[]');
      return list.find(s => s.id === id);
    }
  }

  // ==========================================
  // الاختبارات (Exams)
  // ==========================================
  async getExamsBySubject(subjectId) {
    if (this.client) {
      const { data, error } = await this.client
        .from('exams')
        .select('*')
        .eq('subject_id', subjectId)
        .eq('is_published', true)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    } else {
      const list = JSON.parse(localStorage.getItem('edutest_demo_exams') || '[]');
      return list.filter(e => e.subject_id === subjectId && e.is_published);
    }
  }

  async getAllExams() {
    if (this.client) {
      const { data, error } = await this.client
        .from('exams')
        .select('*, subjects(title)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    } else {
      const exams = JSON.parse(localStorage.getItem('edutest_demo_exams') || '[]');
      const subjects = JSON.parse(localStorage.getItem('edutest_demo_subjects') || '[]');
      return exams.map(e => ({
        ...e,
        subjects: { title: subjects.find(s => s.id === e.subject_id)?.title || 'مادة عامة' }
      }));
    }
  }

  // ==========================================
  // جلب الاختبار للطالب (آمن ضد الغش)
  // ==========================================
  async getExamForStudent(examId) {
    if (this.client) {
      // استدعاء دالة RPC الآمنة التي تعيد الأسئلة دون كشف الإجابات الصحيحة
      const { data, error } = await this.client.rpc('get_exam_for_student', {
        p_exam_id: examId
      });
      if (error) throw error;
      return data;
    } else {
      const exams = JSON.parse(localStorage.getItem('edutest_demo_exams') || '[]');
      const exam = exams.find(e => e.id === examId);
      if (!exam) throw new Error('الاختبار غير موجود');

      const questions = JSON.parse(localStorage.getItem('edutest_demo_questions') || '[]')
        .filter(q => q.exam_id === examId)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

      const choices = JSON.parse(localStorage.getItem('edutest_demo_choices') || '[]');

      // تجريد الإجابات الصحيحة من البيانات المرسلة للواجهة (لمنع الغش عبر فحص الصفحة)
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
  }

  // ==========================================
  // تصحيح الاختبار وتسجيل النتيجة
  // ==========================================
  async submitExam(examId, answers) {
    // answers = [{ question_id: '...', choice_id: '...' }]\n    if (this.client) {
      const { data, error } = await this.client.rpc('submit_exam_answers', {
        p_exam_id: examId,
        p_answers: answers
      });
      if (error) throw error;
      return data;
    } else {
      const user = window.authManager.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول أولاً');

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

        if (isCorrect) {
          earnedScore += qPoints;
        }

        reviewDetails.push({
          question_id: q.id,
          question_text: q.question_text,
          is_correct: isCorrect,
          selected_choice_id: studentAnswer ? studentAnswer.choice_id : null,
          correct_choice_id: correctChoice ? correctChoice.id : null,
          correct_choice_text: correctChoice ? correctChoice.choice_text : 'غير محدد',
          explanation: q.explanation || 'لا يوجد تعليق إضافي لهذا السؤال.'
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
  }

  // ==========================================
  // سجل نتائج الطالب
  // ==========================================
  async getUserSubmissions(userId) {
    if (this.client) {
      const { data, error } = await this.client
        .from('submissions')
        .select('*, exams(title, subject_id, subjects(title))')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false });
      if (error) throw error;
      return data;
    } else {
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
              title: ex?.title || 'اختبار غير معروف',
              subjects: { title: sb?.title || 'عام' }
            }
          };
        });
    }
  }

  async getSubmissionById(submissionId) {
    if (this.client) {
      const { data, error } = await this.client
        .from('submissions')
        .select('*, exams(title, description, passing_percentage)')
        .eq('id', submissionId)
        .single();
      if (error) throw error;

      // جلب تفاصيل الإجابات
      const { data: answers } = await this.client
        .from('submission_answers')
        .select('*, questions(question_text, explanation), choices(choice_text)')
        .eq('submission_id', submissionId);

      return {
        ...data,
        answers
      };
    } else {
      const submissions = JSON.parse(localStorage.getItem('edutest_demo_submissions') || '[]');
      return submissions.find(s => s.id === submissionId);
    }
  }

  // ==========================================
  // عمليات الإدارة (Admin Operations)
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
    } else {
      const subjects = JSON.parse(localStorage.getItem('edutest_demo_subjects') || '[]');
      const newSubject = {
        id: 'subj_' + Date.now(),
        title,
        description,
        code: code || 'SUBJ_' + Date.now(),
        icon,
        is_active: true,
        created_at: new Date().toISOString()
      };
      subjects.push(newSubject);
      localStorage.setItem('edutest_demo_subjects', JSON.stringify(subjects));
      return newSubject;
    }
  }

  async createExam(subjectId, title, description, durationMinutes, passingPercentage, isPublished = true) {
    if (this.client) {
      const { data, error } = await this.client
        .from('exams')
        .insert([{
          subject_id: subjectId,
          title,
          description,
          duration_minutes: durationMinutes,
          passing_percentage: passingPercentage,
          is_published: isPublished
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const exams = JSON.parse(localStorage.getItem('edutest_demo_exams') || '[]');
      const newExam = {
        id: 'exam_' + Date.now(),
        subject_id: subjectId,
        title,
        description,
        duration_minutes: parseInt(durationMinutes, 10) || 30,
        passing_percentage: parseInt(passingPercentage, 10) || 50,
        is_published: Boolean(isPublished),
        created_at: new Date().toISOString()
      };
      exams.push(newExam);
      localStorage.setItem('edutest_demo_exams', JSON.stringify(exams));
      return newExam;
    }
  }

  async addQuestionWithChoices(examId, questionText, explanation, points, choicesList) {
    // choicesList = [{ text: '...', isCorrect: true|false }]
    if (this.client) {
      const { data: q, error: qErr } = await this.client
        .from('questions')
        .insert([{
          exam_id: examId,
          question_text: questionText,
          explanation,
          points: parseInt(points, 10) || 1
        }])
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
    } else {
      const questions = JSON.parse(localStorage.getItem('edutest_demo_questions') || '[]');
      const choices = JSON.parse(localStorage.getItem('edutest_demo_choices') || '[]');

      const newQ = {
        id: 'q_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        exam_id: examId,
        question_text: questionText,
        explanation,
        points: parseInt(points, 10) || 1,
        sort_order: questions.filter(q => q.exam_id === examId).length,
        created_at: new Date().toISOString()
      };
      questions.push(newQ);

      choicesList.forEach((c, idx) => {
        choices.push({
          id: 'c_' + Date.now() + '_' + idx,
          question_id: newQ.id,
          choice_text: c.text,
          is_correct: Boolean(c.isCorrect),
          sort_order: idx
        });
      });

      localStorage.setItem('edutest_demo_questions', JSON.stringify(questions));
      localStorage.setItem('edutest_demo_choices', JSON.stringify(choices));
      return newQ;
    }
  }

  // ==========================================
  // بيانات المحاكاة الافتراضية (Seeding)
  // ==========================================
  initMockData() {
    if (localStorage.getItem('edutest_demo_subjects')) return;

    // تهيئة مادة افتراضية مع اختبار وأسئلة واقعية للتجربة المباشرة
    const defaultSubject = {
      id: 'sub_demo_1',
      title: 'مادة تجريبية: مدخل إلى مناهج المفسرين وعلوم القرآن',
      description: 'نموذج لاختبار البنية التحتية التفاعلية وقارئات الشاشة وحساب النتائج الفورية.',
      code: 'DEMO_QURAN_01',
      icon: 'book',
      is_active: true,
      created_at: new Date().toISOString()
    };

    const defaultExam = {
      id: 'exam_demo_1',
      subject_id: 'sub_demo_1',
      title: 'الاختبار التجريبي الشامل (فحص البنية)',
      description: 'اختبار مصمم لفحص تدفق الأسئلة، المؤقت التنازلي، التقييم، وتوافقية الوصول.',
      duration_minutes: 15,
      passing_percentage: 60,
      is_published: true,
      created_at: new Date().toISOString()
    };

    const q1Id = 'q_demo_1';
    const q2Id = 'q_demo_2';
    const q3Id = 'q_demo_3';

    const defaultQuestions = [
      {
        id: q1Id,
        exam_id: 'exam_demo_1',
        question_text: 'ما هو المصدر الأول والأعلى رتبة في تفسير القرآن الكريم وفق المنهجية المعتمدة؟',
        explanation: 'تفسير القرآن بالقرآن هو أعلى مراتب التفسير وأولاها، حيث يُجمل في موضع ويُفصل في موضع آخر.',
        points: 1,
        sort_order: 0,
        created_at: new Date().toISOString()
      },
      {
        id: q2Id,
        exam_id: 'exam_demo_1',
        question_text: 'أيٌّ من التفاسير الآتية يُعد من أبرز أمهات التفسير بالمأثور؟',
        explanation: 'جامع البيان عن تأويل آي القرآن للإمام ابن جرير الطبري هو إمام وأصل كتب التفسير بالمأثور.',
        points: 1,
        sort_order: 1,
        created_at: new Date().toISOString()
      },
      {
        id: q3Id,
        exam_id: 'exam_demo_1',
        question_text: 'هل يُعتمد التفسير بالرأي المحمود إذا انضبط بضوابط لغة العرب وقواعد الشريعة؟',
        explanation: 'نعم، التفسير بالرأي ينقسم إلى محمود ومذموم، فما وافق قواعد الشريعة وأصول لسان العرب فهو مقبول.',
        points: 1,
        sort_order: 2,
        created_at: new Date().toISOString()
      }
    ];

    const defaultChoices = [
      // Q1
      { id: 'c_1_1', question_id: q1Id, choice_text: 'تفسير القرآن بالقرآن', is_correct: true, sort_order: 0 },
      { id: 'c_1_2', question_id: q1Id, choice_text: 'أقوال التابعين', is_correct: false, sort_order: 1 },
      { id: 'c_1_3', question_id: q1Id, choice_text: 'الاجتهاد اللغوي المجرد', is_correct: false, sort_order: 2 },
      { id: 'c_1_4', question_id: q1Id, choice_text: 'الإسرائيليات', is_correct: false, sort_order: 3 },
      // Q2
      { id: 'c_2_1', question_id: q2Id, choice_text: 'تفسير الطبري (جامع البيان)', is_correct: true, sort_order: 0 },
      { id: 'c_2_2', question_id: q2Id, choice_text: 'الكشاف للزمخشري', is_correct: false, sort_order: 1 },
      { id: 'c_2_3', question_id: q2Id, choice_text: 'مفاتيح الغيب للرازي', is_correct: false, sort_order: 2 },
      { id: 'c_2_4', question_id: q2Id, choice_text: 'أنوار التنزيل للبيضاوي', is_correct: false, sort_order: 3 },
      // Q3
      { id: 'c_3_1', question_id: q3Id, choice_text: 'صواب', is_correct: true, sort_order: 0 },
      { id: 'c_3_2', question_id: q3Id, choice_text: 'خطأ', is_correct: false, sort_order: 1 }
    ];

    localStorage.setItem('edutest_demo_subjects', JSON.stringify([defaultSubject]));
    localStorage.setItem('edutest_demo_exams', JSON.stringify([defaultExam]));
    localStorage.setItem('edutest_demo_questions', JSON.stringify(defaultQuestions));
    localStorage.setItem('edutest_demo_choices', JSON.stringify(defaultChoices));
  }
}

window.db = new DatabaseManager();
