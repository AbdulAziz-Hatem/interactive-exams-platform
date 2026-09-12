/**
 * وحدة إدارة الحسابات والمصادقة (Authentication Controller)
 * تدعم Supabase Auth مع fallback سلس في وضع التجربة
 */

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.client = null;
  }

  async init() {
    if (window.CONFIG.isSupabaseConfigured() && window.supabase) {
      this.client = window.supabase.createClient(
        window.CONFIG.SUPABASE_URL,
        window.CONFIG.SUPABASE_ANON_KEY
      );

      const { data: { session } } = await this.client.auth.getSession();
      if (session?.user) {
        // جلب بيانات البروفايل من جدول Profiles
        const { data: profile } = await this.client
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        this.currentUser = {
          id: session.user.id,
          email: session.user.email,
          fullName: profile?.full_name || session.user.user_metadata?.full_name || 'طالب',
          role: profile?.role || 'student'
        };
      }
    } else {
      // وضع التجربة المحلي (Local Demo Mode)
      const saved = localStorage.getItem('edutest_current_user');
      if (saved) {
        try {
          this.currentUser = JSON.parse(saved);
        } catch (e) {
          this.currentUser = null;
        }
      }
    }

    this.updateNavUI();
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
      
      // إذا كان تأكيد البريد معطلاً أو تم الدخول مباشرة
      if (data.session?.user) {
        this.currentUser = {
          id: data.user.id,
          email: data.user.email,
          fullName: fullName,
          role: 'student'
        };
      }
      return { success: true, user: data.user, requiresEmailConfirmation: !data.session };
    } else {
      // محاكاة محلية
      const users = JSON.parse(localStorage.getItem('edutest_demo_users') || '[]');
      if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        throw new Error('البريد الإلكتروني مسجل مسبقاً في النظام.');
      }

      const newUser = {
        id: 'user_' + Date.now(),
        email: email.trim(),
        password: password,
        fullName: fullName.trim(),
        role: users.length === 0 ? 'admin' : 'student', // أول مستخدم يكون مديراً للتجربة
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
        fullName: profile?.full_name || data.user.user_metadata?.full_name || 'طالب',
        role: profile?.role || 'student'
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
      await this.client.auth.signOut();
    }
    this.currentUser = null;
    localStorage.removeItem('edutest_current_user');
    this.updateNavUI();
    window.location.href = 'index.html';
  }

  updateNavUI() {
    const navAuthContainer = document.getElementById('nav-auth-container');
    if (!navAuthContainer) return;

    if (this.currentUser) {
      navAuthContainer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 0.95rem; font-weight: 600; color: var(--text-main);">
            مرحباً، ${this.escapeHtml(this.currentUser.fullName)}
            ${this.currentUser.role === 'admin' ? '<span class="badge badge-warning" style="margin-right: 4px;">مدير</span>' : ''}
          </span>
          <a href="dashboard.html" class="btn btn-secondary btn-sm" aria-label="لوحة التحكم الخاصة بك">لوحتي</a>
          ${this.currentUser.role === 'admin' ? '<a href="admin.html" class="btn btn-primary btn-sm">إدارة الاختبارات</a>' : ''}
          <button id="btn-logout" class="btn btn-outline btn-sm" aria-label="تسجيل الخروج من الحساب">خروج</button>
        </div>
      `;

      document.getElementById('btn-logout')?.addEventListener('click', () => this.signOut());
    } else {
      navAuthContainer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <a href="auth.html?mode=login" class="btn btn-secondary btn-sm">تسجيل الدخول</a>
          <a href="auth.html?mode=signup" class="btn btn-primary btn-sm">إنشاء حساب</a>
        </div>
      `;
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
