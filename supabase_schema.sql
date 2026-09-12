-- ====================================================================
-- منصة الاختبارات التفاعلية (EduTest Platform)
-- مخطط قاعدة البيانات الكامل (Supabase / PostgreSQL Schema)
-- يدعم: المصادقة، الصلاحيات، الحماية ضد الغش، التقييم السحابي، وقارئات الشاشة
-- ====================================================================

-- 1. تفعيل الامتدادات الضرورية
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. جدول ملفات المستخدمين (Profiles)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  email text,
  role text check (role in ('student', 'admin')) default 'student',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. دالة تفعيل الحساب التلقائي عند التسجيل عبر Supabase Auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'طالب جديد'),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'student')
  );
  return new;
end;
$$ language plpgsql security definer;

-- محفز (Trigger) لربط التسجيل الجديد بجدول Profiles
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. جدول المواد والمقررات الدراسية (Subjects)
create table if not exists public.subjects (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  code text unique,
  icon text default 'book',
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. جدول الاختبارات (Exams)
create table if not exists public.exams (
  id uuid default gen_random_uuid() primary key,
  subject_id uuid references public.subjects on delete cascade not null,
  title text not null,
  description text,
  duration_minutes integer default 30, -- 0 تعني بدون وقت محدد
  passing_percentage integer default 50,
  is_published boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. جدول الأسئلة (Questions)
create table if not exists public.questions (
  id uuid default gen_random_uuid() primary key,
  exam_id uuid references public.exams on delete cascade not null,
  question_text text not null,
  explanation text, -- تعليل أو شرح يظهر للطالب بعد إنهاء الاختبار
  points integer default 1,
  sort_order integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. جدول خيارات الإجابة (Choices)
create table if not exists public.choices (
  id uuid default gen_random_uuid() primary key,
  question_id uuid references public.questions on delete cascade not null,
  choice_text text not null,
  is_correct boolean not null default false,
  sort_order integer default 0
);

-- 8. جدول محاولات ونتائج الاختبارات (Submissions)
create table if not exists public.submissions (
  id uuid default gen_random_uuid() primary key,
  exam_id uuid references public.exams on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  score numeric not null default 0,
  total_points numeric not null default 0,
  percentage numeric not null default 0,
  passed boolean not null default false,
  completed_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. تفاصيل إجابات الطالب في كل محاولة (Submission Answers)
create table if not exists public.submission_answers (
  id uuid default gen_random_uuid() primary key,
  submission_id uuid references public.submissions on delete cascade not null,
  question_id uuid references public.questions on delete cascade not null,
  selected_choice_id uuid references public.choices on delete set null,
  is_correct boolean not null default false
);

-- ====================================================================
-- إعدادات الأمان وسياسات الوصول (Row Level Security - RLS)
-- ====================================================================

alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.exams enable row level security;
alter table public.questions enable row level security;
alter table public.choices enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_answers enable row level security;

-- دالة مساعدة لمعرفة هل المستخدم الحالي مسؤول (Admin)
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$ language plpgsql security definer;

-- سياسات جدول Profiles
create policy "الملفات الشخصية متاحة للقراءة للمستخدمين المسجلين"
  on public.profiles for select
  to authenticated
  using (true);

create policy "المستخدم يمكنه تعديل ملفه الخاص فقط"
  on public.profiles for update
  to authenticated
  using (id = auth.uid());

-- سياسات جدول Subjects
create policy "المواد النشطة متاحة للجميع"
  on public.subjects for select
  to authenticated
  using (is_active = true or public.is_admin());

create policy "المسؤول فقط يمكنه إدارة المواد"
  on public.subjects for all
  to authenticated
  using (public.is_admin());

-- سياسات جدول Exams
create policy "الاختبارات المنشورة متاحة للطلاب"
  on public.exams for select
  to authenticated
  using (is_published = true or public.is_admin());

create policy "المسؤول فقط يمكنه إدارة الاختبارات"
  on public.exams for all
  to authenticated
  using (public.is_admin());

-- سياسات جدول Questions & Choices
create policy "المسؤول يملك التحكم الكامل بالأسئلة"
  on public.questions for all
  to authenticated
  using (public.is_admin());

create policy "المسؤول يملك التحكم الكامل بالخيارات"
  on public.choices for all
  to authenticated
  using (public.is_admin());

-- سياسات جدول Submissions
create policy "الطالب يرى نتائجه السابقة فقط، والمسؤول يرى كل النتائج"
  on public.submissions for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "الطالب يسجل نتيجته فقط"
  on public.submissions for insert
  to authenticated
  with check (user_id = auth.uid());

-- سياسات تفاصيل الإجابات
create policy "الطالب يرى تفاصيل إجاباته فقط"
  on public.submission_answers for select
  to authenticated
  using (
    exists (
      select 1 from public.submissions
      where submissions.id = submission_answers.submission_id
      and (submissions.user_id = auth.uid() or public.is_admin())
    )
  );

-- ====================================================================
-- دوال مكافحة الغش والتقييم السحابي الآمن (RPC Secure Functions)
-- ====================================================================

-- دالة جلب أسئلة الاختبار للطالب بدون كشف الإجابات الصحيحة في المتصفح!
create or replace function public.get_exam_for_student(p_exam_id uuid)
returns jsonb as $$
declare
  v_exam record;
  v_questions jsonb;
begin
  -- التأكد من وجود الاختبار وأنه منشور أو أن الطالب مسؤول
  select * into v_exam from public.exams
  where id = p_exam_id and (is_published = true or public.is_admin());

  if not found then
    raise exception 'الاختبار غير موجود أو غير متاح حالياً';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'question_text', q.question_text,
      'points', q.points,
      'sort_order', q.sort_order,
      'choices', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', c.id,
            'choice_text', c.choice_text,
            'sort_order', c.sort_order
          ) order by c.sort_order, c.id
        ), '[]'::jsonb)
        from public.choices c
        where c.question_id = q.id
      )
    ) order by q.sort_order, q.id
  ), '[]'::jsonb) into v_questions
  from public.questions q
  where q.exam_id = p_exam_id;

  return jsonb_build_object(
    'exam', jsonb_build_object(
      'id', v_exam.id,
      'title', v_exam.title,
      'description', v_exam.description,
      'duration_minutes', v_exam.duration_minutes,
      'passing_percentage', v_exam.passing_percentage
    ),
    'questions', v_questions
  );
end;
$$ language plpgsql security definer;

-- دالة تصحيح الاختبار وتخزين النتيجة في السيرفر دون إمكانية التلاعب
create or replace function public.submit_exam_answers(
  p_exam_id uuid,
  p_answers jsonb -- مصفوفة من: [{"question_id": "...", "choice_id": "..."}]
)
returns jsonb as $$
declare
  v_user_id uuid;
  v_exam record;
  v_total_points numeric := 0;
  v_earned_score numeric := 0;
  v_percentage numeric := 0;
  v_passed boolean := false;
  v_submission_id uuid;
  v_item jsonb;
  v_qid uuid;
  v_cid uuid;
  v_q_points numeric;
  v_is_correct boolean;
  v_review_details jsonb := '[]'::jsonb;
  v_correct_choice record;
  v_explanation text;
  v_q_text text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'يجب تسجيل الدخول أولاً لتسليم الاختبار';
  end if;

  select * into v_exam from public.exams where id = p_exam_id;
  if not found then
    raise exception 'الاختبار غير صالح';
  end if;

  -- إنشاء سجل المحاولة أولاً
  insert into public.submissions (exam_id, user_id, score, total_points, percentage, passed)
  values (p_exam_id, v_user_id, 0, 0, 0, false)
  returning id into v_submission_id;

  -- حساب مجموع النقاط الكلي للاختبار
  select coalesce(sum(points), 0) into v_total_points
  from public.questions where exam_id = p_exam_id;

  if v_total_points = 0 then
    v_total_points := 1;
  end if;

  -- فحص إجابة كل سؤال
  for v_item in select * from jsonb_array_elements(p_answers)
  loop
    v_qid := (v_item->>'question_id')::uuid;
    v_cid := nullif(v_item->>'choice_id', '')::uuid;

    select question_text, points, explanation into v_q_text, v_q_points, v_explanation
    from public.questions where id = v_qid and exam_id = p_exam_id;

    if found then
      -- التحقق مما إذا كان الخيار المختار هو الخيار الصحيح
      v_is_correct := false;
      if v_cid is not null then
        select is_correct into v_is_correct
        from public.choices where id = v_cid and question_id = v_qid;
        v_is_correct := coalesce(v_is_correct, false);
      end if;

      if v_is_correct then
        v_earned_score := v_earned_score + coalesce(v_q_points, 1);
      end if;

      -- حفظ تفاصيل الإجابة في جدول تفاصيل المحاولة
      insert into public.submission_answers (submission_id, question_id, selected_choice_id, is_correct)
      values (v_submission_id, v_qid, v_cid, v_is_correct);

      -- جلب الخيار الصحيح للمراجعة
      select id, choice_text into v_correct_choice
      from public.choices where question_id = v_qid and is_correct = true limit 1;

      -- إضافة السؤال والتفاصيل إلى مصفوفة المراجعة للنتيجة
      v_review_details := v_review_details || jsonb_build_object(
        'question_id', v_qid,
        'question_text', v_q_text,
        'is_correct', v_is_correct,
        'selected_choice_id', v_cid,
        'correct_choice_id', v_correct_choice.id,
        'correct_choice_text', v_correct_choice.choice_text,
        'explanation', v_explanation
      );
    end if;
  end loop;

  -- حساب النسبة المئوية وحالة الاجتياز
  v_percentage := round((v_earned_score / v_total_points) * 100, 2);
  v_passed := v_percentage >= coalesce(v_exam.passing_percentage, 50);

  -- تحديث السجل النهائي
  update public.submissions
  set score = v_earned_score,
      total_points = v_total_points,
      percentage = v_percentage,
      passed = v_passed,
      completed_at = timezone('utc'::text, now())
  where id = v_submission_id;

  return jsonb_build_object(
    'submission_id', v_submission_id,
    'score', v_earned_score,
    'total_points', v_total_points,
    'percentage', v_percentage,
    'passed', v_passed,
    'passing_percentage', v_exam.passing_percentage,
    'review_details', v_review_details
  );
end;
$$ language plpgsql security definer;
