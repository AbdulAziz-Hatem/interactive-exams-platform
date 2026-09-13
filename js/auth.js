/**
 * وحدة إدارة الحسابات والمصادقة والقائمة الجانبية الموحدة
 * (Authentication & Responsive Navigation Controller)
 * مخصصة حصرياً لقسم القرآن الكريم وعلومه — كلية التربية، جامعة صنعاء
 */

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.client = null;
    this.isSidebarOpen = false;
  }

  async init() {
    // 1. تهيئة القائمة الجانبية وتحديث الواجهة فوراً دون انتظار أي شبكة
    this.initSidebar();
    this.updateNavUI();

    // 2. محاولة جلب الجلسة من Supabase مع مهلة زمنية صارمة (Timeout)
    if (window.CONFIG.isSupabaseConfigured() && window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        this.client = window.supabase.createClient(
          window.CONFIG.SUPABASE_URL,
          window.CONFIG.SUPABASE_ANON_KEY
        );

        const sessionPromise = this.client.auth.getSession();
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ data: { session: null } }), 2000));
        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);

        if (session?.user) {
          const { data: profile } = await this.client
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          this.currentUser = {
            id: session.user.id,
            email: session.user.email,
            fullName: profile?.full_name || session.user.user_metadata?.full_name || 'طالب بقسم القرآن الكريم وعلومه',
            role: profile?.role || 'student',
            token: session.access_token
          };
          this.updateNavUI();
        }
      } catch (e) {
        console.warn('تعذر استرداد جلسة Supabase، سيتم الاستمرار كزائر:', e);
      }
    } else {
      const saved = localStorage.getItem('edutest_current_user');
      if (saved) {
        try {
          this.currentUser = JSON.parse(saved);
          this.updateNavUI();
        } catch (e) {
          this.currentUser = null;
        }
      }
    }

    return this.currentUser;
  }

  isAuthenticated() {
    return Boolean(this.currentUser);
  }

  isAdmin() {
    return this.currentUser?.role === 'admin';
  }

  getUser() {
    return this.currentUser;
  }

  async signUp(fullName, email, password) {
    if (window.CONFIG.isSupabaseConfigured() && this.client) {
      const { data, error } = await this.client.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: 'student'
          }
        }
      });

      if (error) throw error;
      
      if (data.session?.user) {
        this.currentUser = {
          id: data.user.id,
          email: data.user.email,
          fullName: fullName,
          role: 'student',
          token: data.session.access_token
        };
        this.updateNavUI();
      }
      return { success: true, user: data.user, requiresEmailConfirmation: !data.session };
    } else {
      const users = JSON.parse(localStorage.getItem('edutest_demo_users') || '[]');
      if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        throw new Error('البريد الإلكتروني مسجل مسبقاً في النظام.');
      }

      const newUser = {
        id: 'user_' + Date.now(),
        email: email.trim(),
        password: password,
        fullName: fullName.trim(),
        role: users.length === 0 ? 'admin' : 'student',
        createdAt: new Date().toISOString()
      };

      users.push(newUser);
      localStorage.setItem('edutest_demo_users', JSON.stringify(users));

      this.currentUser = {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role
      };
      localStorage.setItem('edutest_current_user', JSON.stringify(this.currentUser));
      this.updateNavUI();
      return { success: true, user: this.currentUser, requiresEmailConfirmation: false };
    }
  }

  async signIn(email, password) {
    if (window.CONFIG.isSupabaseConfigured() && this.client) {
      const { data, error } = await this.client.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      const { data: profile } = await this.client
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      this.currentUser = {
        id: data.user.id,
        email: data.user.email,
        fullName: profile?.full_name || data.user.user_metadata?.full_name || 'طالب بقسم القرآن الكريم وعلومه',
        role: profile?.role || 'student',
        token: data.session?.access_token
      };

      this.updateNavUI();
      return { success: true, user: this.currentUser };
    } else {
      const users = JSON.parse(localStorage.getItem('edutest_demo_users') || '[]');
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);

      if (!user) {
        throw new Error('بيانات الدخول غير صحيحة. يرجى التأكد من البريد وكلمة المرور.');
      }

      this.currentUser = {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      };
      localStorage.setItem('edutest_current_user', JSON.stringify(this.currentUser));
      this.updateNavUI();
      return { success: true, user: this.currentUser };
    }
  }

  async signOut() {
    if (window.CONFIG.isSupabaseConfigured() && this.client) {
      try {
        await this.client.auth.signOut();
      } catch (e) {}
    }
    this.currentUser = null;
    localStorage.removeItem('edutest_current_user');
    this.updateNavUI();
    window.location.href = 'index.html';
  }

  // ====================================================================
  // إدارة القائمة الجانبية السلسة والمحمية بالكامل
  // معالجة مشكلة الفتح التلقائي ومنع قفزات قارئات الشاشة عند الإغلاق
  // ====================================================================
  initSidebar() {
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const sidebar = document.getElementById('mobile-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const closeBtn = document.getElementById('sidebar-close-btn');

    if (!hamburgerBtn || !sidebar || !overlay) return;

    // حماية ضد تكرار ربط الأحداث
    if (hamburgerBtn._hasInit) return;
    hamburgerBtn._hasInit = true;

    // التأكد من إخفاء القائمة عن شجرة الوصول عند بدء التشغيل
    sidebar.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('aria-hidden', 'true');
    hamburgerBtn.setAttribute('aria-expanded', 'false');

    const openDrawer = () => {
      this.isSidebarOpen = true;
      sidebar.classList.add('active');
      overlay.classList.add('active');
      sidebar.setAttribute('aria-hidden', 'false');
      overlay.setAttribute('aria-hidden', 'false');
      hamburgerBtn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      window.a11y?.announce('تم فتح القائمة الجانبية');
      setTimeout(() => closeBtn?.focus(), 60);
    };

    const closeDrawer = () => {
      this.isSidebarOpen = false;
      sidebar.classList.remove('active');
      overlay.classList.remove('active');
      sidebar.setAttribute('aria-hidden', 'true');
      overlay.setAttribute('aria-hidden', 'true');
      hamburgerBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      window.a11y?.announce('تم إغلاق القائمة الجانبية');
      hamburgerBtn.focus();
    };

    hamburgerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.isSidebarOpen) closeDrawer();
      else openDrawer();
    });

    closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDrawer();
    });

    overlay.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDrawer();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isSidebarOpen) {
        closeDrawer();
      }
    });
  }

  updateNavUI() {
    const navAuthContainer = document.getElementById('nav-auth-container');
    const sidebarUserArea = document.getElementById('sidebar-user-area');
    const sidebarNavLinks = document.getElementById('sidebar-nav-links');

    const user = this.currentUser;

    if (navAuthContainer) {
      if (user) {
        navAuthContainer.innerHTML = `
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <a href="dashboard.html" class="btn btn-secondary btn-sm">
              <span>👤 ${this.escapeHtml(user.fullName)}</span>
              ${user.role === 'admin' ? '<span class="badge badge-warning">إدارة القسم</span>' : ''}
            </a>
            ${user.role === 'admin' ? '<a href="admin.html" class="btn btn-primary btn-sm">لوحة الإدارة</a>' : ''}
            <button id="btn-logout" class="btn btn-outline btn-sm" aria-label="تسجيل الخروج">خروج</button>
          </div>
        `;
        document.getElementById('btn-logout')?.addEventListener('click', () => this.signOut());
      } else {
        navAuthContainer.innerHTML = `
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <a href="auth.html?mode=login" class="btn btn-secondary btn-sm">دخول الطالب</a>
            <a href="auth.html?mode=signup" class="btn btn-primary btn-sm">حساب جديد</a>
          </div>
        `;
      }
    }

    if (sidebarUserArea) {
      if (user) {
        sidebarUserArea.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 0.35rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <strong style="font-size: 1.1rem;">${this.escapeHtml(user.fullName)}</strong>
              ${user.role === 'admin' ? '<span class="badge badge-warning">مشرف أكاديمي</span>' : '<span class="badge badge-primary">طالب بالقسم</span>'}
            </div>
            <span style="font-size: 0.85rem; color: var(--text-muted); word-break: break-all;">${user.email}</span>
          </div>
        `;
      } else {
        sidebarUserArea.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <p style="font-size: 0.9rem; color: var(--text-muted);">مرحباً بك! سجل دخولك لحفظ درجاتك ومتابعة مستواك الأكاديمي.</p>
            <div style="display: flex; gap: 0.5rem;">
              <a href="auth.html?mode=login" class="btn btn-secondary btn-sm" style="flex: 1;">دخول الطالب</a>
              <a href="auth.html?mode=signup" class="btn btn-primary btn-sm" style="flex: 1;">حساب جديد</a>
            </div>
          </div>
        `;
      }
    }

    if (sidebarNavLinks) {
      let linksHtml = `
        <li>
          <a href="index.html" class="sidebar-link">
            <span class="sidebar-link-icon" aria-hidden="true">🏠</span>
            <span>الصفحة الرئيسية</span>
          </a>
        </li>
        <li>
          <a href="index.html#subjects-section" class="sidebar-link">
            <span class="sidebar-link-icon" aria-hidden="true">📚</span>
            <span>مقررات القسم واختباراتها</span>
          </a>
        </li>
      `;

      if (user) {
        linksHtml += `
          <li>
            <a href="dashboard.html" class="sidebar-link">
              <span class="sidebar-link-icon" aria-hidden="true">📊</span>
              <span>سجل اختباراتي بالقسم</span>
            </a>
          </li>
        `;

        if (user.role === 'admin') {
          linksHtml += `
            <li>
              <a href="admin.html" class="sidebar-link">
                <span class="sidebar-link-icon" aria-hidden="true">🛠️</span>
                <span>إدارة بنوك الأسئلة</span>
              </a>
            </li>
          `;
        }

        linksHtml += `
          <li style="margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--border);">
            <button id="sidebar-btn-logout" class="sidebar-link" style="width: 100%; border: none; background: none; color: var(--danger); cursor: pointer; text-align: right;">
              <span class="sidebar-link-icon" aria-hidden="true">🚪</span>
              <span>تسجيل الخروج</span>
            </button>
          </li>
        `;
      }

      sidebarNavLinks.innerHTML = linksHtml;
      document.getElementById('sidebar-btn-logout')?.addEventListener('click', () => this.signOut());
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

window.authManager = new AuthManager();
