/**
 * وحدة إدارة الحسابات والمصادقة والقائمة الجانبية الموحدة
 * (Authentication & Responsive Navigation Controller)
 * مخصصة حصرياً لقسم القرآن الكريم وعلومه — كلية التربية، جامعة صنعاء
 *
 * تنبيه: الإشراف الأكاديمي محصور حصرياً بمالك المنصة: عبد العزيز أمين راجح حاتم
 */

class AuthManager {
 constructor {
 this.currentUser = null;
 this.client = null;
 this.isSidebarOpen = false;

 // الحساب الرسمي والوحيد لمالك ومسؤول المنصة العام
 this.OWNER_EMAIL = 'abdualaziz.yemen@gmail.com';
 this.MASTER_PASSWORD = 'Madarej@Admin2026';

 // أسماء المستخدمين المعتمدة حصرياً لمالك الموقع والمشرف الأكاديمي العام
 this.ADMIN_ALIASES = {
 'admin': this.OWNER_EMAIL,
 'abdulaziz': this.OWNER_EMAIL,
 'abdeh': this.OWNER_EMAIL,
 'owner': this.OWNER_EMAIL,
 'aziz': this.OWNER_EMAIL,
 'hatem': this.OWNER_EMAIL
 };
 }

 async init {
 this.initSidebar;
 this.updateNavUI;

 // استرجاع جلسة المشرف المحفوظة مسبقاً محلياً
 const saved = localStorage.getItem('edutest_current_user');
 if (saved) {
 try {
 const parsed = JSON.parse(saved);
 if (parsed && parsed.email === this.OWNER_EMAIL) {
 parsed.role = 'admin'; // تثبيت صلاحية المشرف حصرياً
 this.currentUser = parsed;
 this.updateNavUI;
 } else if (parsed) {
 this.currentUser = parsed;
 this.updateNavUI;
 }
 } catch (e) {
 this.currentUser = null;
 }
 }

 // محاولة جلب الجلسة من Supabase
 if (window.CONFIG && window.CONFIG.isSupabaseConfigured && window.supabase && typeof window.supabase.createClient === 'function') {
 try {
 this.client = window.supabase.createClient(
 window.CONFIG.SUPABASE_URL,
 window.CONFIG.SUPABASE_ANON_KEY
 );

 const sessionPromise = this.client.auth.getSession;
 const timeoutPromise = new Promise(resolve => setTimeout( => resolve({ data: { session: null } }), 2500));
 const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);

 if (session?.user) {
 await this.syncUserData(session.user, session.access_token);
 this.updateNavUI;
 }

 this.client.auth.onAuthStateChange(async (event, currentSession) => {
 if (event === 'SIGNED_IN' && currentSession?.user) {
 await this.syncUserData(currentSession.user, currentSession.access_token);
 this.updateNavUI;
 } else if (event === 'SIGNED_OUT') {
 this.currentUser = null;
 localStorage.removeItem('edutest_current_user');
 this.updateNavUI;
 }
 });
 } catch (e) {
 console.warn('تعذر استرداد جلسة Supabase:', e);
 }
 }

 return this.currentUser;
 }

 async syncUserData(authUser, token) {
 let profile = null;
 try {
 const { data } = await this.client
.from('profiles')
.select('*')
.eq('id', authUser.id)
.single;
 profile = data;
 } catch (e) {}

 // حصر رتبة المشرف العام حصرياً ببريد المالك
 const isOwner = authUser.email.toLowerCase === this.OWNER_EMAIL.toLowerCase;
 const finalRole = isOwner ? 'admin': 'student';

 this.currentUser = {
 id: authUser.id,
 email: authUser.email,
 username: isOwner ? 'admin': (authUser.user_metadata?.username || profile?.username || authUser.email.split('@')[0]),
 fullName: isOwner ? 'عبد العزيز أمين راجح حاتم (المشرف العام)': (profile?.full_name || authUser.user_metadata?.full_name || 'طالب بقسم القرآن الكريم وعلومه'),
 role: finalRole,
 token: token
 };

 localStorage.setItem('edutest_current_user', JSON.stringify(this.currentUser));
 }

 isAuthenticated {
 return Boolean(this.currentUser);
 }

 isAdmin {
 return this.currentUser?.role === 'admin' && this.currentUser?.email?.toLowerCase === this.OWNER_EMAIL.toLowerCase;
 }

 getUser {
 return this.currentUser;
 }

 /**
 * مطابقة اسم المستخدم وتحويله إلى البريد الإلكتروني
 */
 resolveIdentifier(identifier) {
 if (!identifier) return '';
 const clean = identifier.trim.toLowerCase;

 if (clean.includes('@')) {
 return clean;
 }

 // مطابقة أسماء المستخدمين الخاصة بالمشرف العام حصرياً
 if (this.ADMIN_ALIASES[clean]) {
 return this.ADMIN_ALIASES[clean];
 }

 // مطابقة سجل أسماء المستخدمين المحلي للطلاب
 const localEmail = localStorage.getItem('madarej_user_' + clean);
 if (localEmail) {
 return localEmail;
 }

 const registry = JSON.parse(localStorage.getItem('madarej_usernames_registry') || '{}');
 if (registry[clean]) {
 return registry[clean];
 }

 return clean;
 }

 /**
 * تسجيل حساب طالب جديد في قسم القرآن الكريم
 */
 async signUp(fullName, username, email, password) {
 const cleanEmail = email.trim.toLowerCase;
 const cleanUsername = (username || '').trim.toLowerCase;

 // منع أي شخص من تسجيل حساب بصفة مشرف أو انتحال اسم المشرف
 if (cleanEmail === this.OWNER_EMAIL.toLowerCase || this.ADMIN_ALIASES[cleanUsername]) {
 throw new Error('هذا المعرف مخصص حصرياً للمشرف العام على المنصة.');
 }

 if (cleanUsername) {
 localStorage.setItem('madarej_user_' + cleanUsername, cleanEmail);
 const registry = JSON.parse(localStorage.getItem('madarej_usernames_registry') || '{}');
 registry[cleanUsername] = cleanEmail;
 localStorage.setItem('madarej_usernames_registry', JSON.stringify(registry));
 }

 if (window.CONFIG.isSupabaseConfigured && this.client) {
 const { data, error } = await this.client.auth.signUp({
 email: cleanEmail,
 password: password,
 options: {
 data: {
 full_name: fullName.trim,
 username: cleanUsername,
 role: 'student'
 }
 }
 });

 if (error) throw error;

 if (data.session?.user) {
 await this.syncUserData(data.session.user, data.session.access_token);
 this.updateNavUI;
 }
 return { success: true, user: data.user, requiresEmailConfirmation:!data.session };
 } else {
 const users = JSON.parse(localStorage.getItem('edutest_demo_users') || '[]');
 if (users.some(u => u.email.toLowerCase === cleanEmail)) {
 throw new Error('البريد الإلكتروني مسجل مسبقاً في النظام.');
 }

 const newUser = {
 id: 'user_' + Date.now,
 email: cleanEmail,
 username: cleanUsername,
 password: password,
 fullName: fullName.trim,
 role: 'student',
 createdAt: new Date.toISOString
 };

 users.push(newUser);
 localStorage.setItem('edutest_demo_users', JSON.stringify(users));

 this.currentUser = {
 id: newUser.id,
 email: newUser.email,
 username: newUser.username,
 fullName: newUser.fullName,
 role: 'student'
 };
 localStorage.setItem('edutest_current_user', JSON.stringify(this.currentUser));
 this.updateNavUI;
 return { success: true, user: this.currentUser, requiresEmailConfirmation: false };
 }
 }

 /**
 * تسجيل الدخول بواسطة (اسم المستخدم أو البريد الإلكتروني) وكلمة المرور
 * مع تمكين المشرف العام من الدخول المباشر بكامل الصلاحيات السيادية
 */
 async signIn(identifier, password) {
 const cleanId = (identifier || '').trim.toLowerCase;
 const resolvedEmail = this.resolveIdentifier(identifier);

 const isOwnerLogin = resolvedEmail === this.OWNER_EMAIL.toLowerCase ||
 cleanId === this.OWNER_EMAIL.toLowerCase ||
 Boolean(this.ADMIN_ALIASES[cleanId]);

 // 1. مسار تسجيل الدخول السيادي للمشرف العام (Master Admin Access)
 if (isOwnerLogin && password === this.MASTER_PASSWORD) {
 this.currentUser = {
 id: 'sovereign-admin-abdulaziz',
 email: this.OWNER_EMAIL,
 username: 'admin',
 fullName: 'عبد العزيز أمين راجح حاتم (المشرف الأكاديمي العام)',
 role: 'admin',
 token: 'sovereign_admin_master_token'
 };
 localStorage.setItem('edutest_current_user', JSON.stringify(this.currentUser));
 this.updateNavUI;

 // محاولة المزامنة الخلفية مع Supabase إذا تطابقت كلمة المرور سحابياً
 if (this.client) {
 this.client.auth.signInWithPassword({
 email: this.OWNER_EMAIL,
 password: password
 }).then(({ data }) => {
 if (data?.session) {
 this.currentUser.id = data.user.id;
 this.currentUser.token = data.session.access_token;
 localStorage.setItem('edutest_current_user', JSON.stringify(this.currentUser));
 }
 }).catch( => {});
 }

 return { success: true, user: this.currentUser };
 }

 if (!resolvedEmail.includes('@')) {
 throw new Error('تعذر التعرف على اسم المستخدم. يرجى إدخال البريد الإلكتروني المسجل بالكامل.');
 }

 // 2. مسار تسجيل الدخول عبر Supabase
 if (window.CONFIG.isSupabaseConfigured && this.client) {
 const { data, error } = await this.client.auth.signInWithPassword({
 email: resolvedEmail,
 password: password
 });

 if (error) {
 if (error.message.includes('Invalid login credentials')) {
 throw new Error('بيانات الدخول غير صحيحة. يرجى التأكد من اسم المستخدم/البريد وكلمة المرور.');
 }
 throw error;
 }

 await this.syncUserData(data.user, data.session?.access_token);
 this.updateNavUI;
 return { success: true, user: this.currentUser };
 } else {
 const users = JSON.parse(localStorage.getItem('edutest_demo_users') || '[]');
 const user = users.find(u => (u.email.toLowerCase === resolvedEmail || u.username === cleanId) && u.password === password);

 if (!user) {
 throw new Error('بيانات الدخول غير صحيحة. يرجى التأكد من البريد أو اسم المستخدم وكلمة المرور.');
 }

 this.currentUser = {
 id: user.id,
 email: user.email,
 username: user.username,
 fullName: user.fullName,
 role: (user.email.toLowerCase === this.OWNER_EMAIL.toLowerCase) ? 'admin': 'student'
 };
 localStorage.setItem('edutest_current_user', JSON.stringify(this.currentUser));
 this.updateNavUI;
 return { success: true, user: this.currentUser };
 }
 }

 /**
 * إرسال رابط استعادة كلمة المرور إلى البريد الإلكتروني
 */
 async sendPasswordReset(identifier) {
 const resolvedEmail = this.resolveIdentifier(identifier);

 if (!resolvedEmail ||!resolvedEmail.includes('@')) {
 throw new Error('يرجى إدخال بريد إلكتروني صالح مسجل في النظام لإرسال رابط الاستعادة.');
 }

 if (window.CONFIG.isSupabaseConfigured && this.client) {
 const redirectUrl = window.location.origin + window.location.pathname + '?mode=update-password';

 const { error } = await this.client.auth.resetPasswordForEmail(resolvedEmail, {
 redirectTo: redirectUrl
 });

 if (error) throw error;
 return { success: true, email: resolvedEmail };
 } else {
 return { success: true, email: resolvedEmail, demo: true };
 }
 }

 /**
 * تعيين وحفظ كلمة المرور الجديدة للحساب
 */
 async updateUserPassword(newPassword) {
 if (!newPassword || newPassword.length < 6) {
 throw new Error('يجب ألا تقل كلمة المرور الجديدة عن 6 أحرف.');
 }

 if (window.CONFIG.isSupabaseConfigured && this.client) {
 const { data, error } = await this.client.auth.updateUser({
 password: newPassword
 });

 if (error) throw error;

 if (data.user) {
 await this.syncUserData(data.user, null);
 this.updateNavUI;
 }
 return { success: true };
 } else {
 if (this.currentUser) {
 const users = JSON.parse(localStorage.getItem('edutest_demo_users') || '[]');
 const idx = users.findIndex(u => u.email === this.currentUser.email);
 if (idx!== -1) {
 users[idx].password = newPassword;
 localStorage.setItem('edutest_demo_users', JSON.stringify(users));
 }
 }
 return { success: true };
 }
 }

 async signOut {
 if (window.CONFIG.isSupabaseConfigured && this.client) {
 try {
 await this.client.auth.signOut;
 } catch (e) {}
 }
 this.currentUser = null;
 localStorage.removeItem('edutest_current_user');
 this.updateNavUI;
 window.location.href = 'index.html';
 }

 // ====================================================================
 // إدارة القائمة الجانبية السلسة
 // ====================================================================
 initSidebar {
 const hamburgerBtn = document.getElementById('hamburger-btn');
 const sidebar = document.getElementById('mobile-sidebar');
 const overlay = document.getElementById('sidebar-overlay');
 const closeBtn = document.getElementById('sidebar-close-btn');

 if (!hamburgerBtn ||!sidebar ||!overlay) return;

 if (hamburgerBtn._hasInit) return;
 hamburgerBtn._hasInit = true;

 sidebar.setAttribute('aria-hidden', 'true');
 overlay.setAttribute('aria-hidden', 'true');
 hamburgerBtn.setAttribute('aria-expanded', 'false');

 const openDrawer =  => {
 this.isSidebarOpen = true;
 sidebar.classList.add('active');
 overlay.classList.add('active');
 sidebar.setAttribute('aria-hidden', 'false');
 overlay.setAttribute('aria-hidden', 'false');
 hamburgerBtn.setAttribute('aria-expanded', 'true');
 document.body.style.overflow = 'hidden';
 window.a11y?.announce('تم فتح القائمة الجانبية');
 setTimeout( => closeBtn?.focus, 60);
 };

 const closeDrawer =  => {
 this.isSidebarOpen = false;
 sidebar.classList.remove('active');
 overlay.classList.remove('active');
 sidebar.setAttribute('aria-hidden', 'true');
 overlay.setAttribute('aria-hidden', 'true');
 hamburgerBtn.setAttribute('aria-expanded', 'false');
 document.body.style.overflow = '';
 window.a11y?.announce('تم إغلاق القائمة الجانبية');
 hamburgerBtn.focus;
 };

 hamburgerBtn.addEventListener('click', (e) => {
 e.stopPropagation;
 if (this.isSidebarOpen) closeDrawer;
 else openDrawer;
 });

 closeBtn?.addEventListener('click', (e) => {
 e.stopPropagation;
 closeDrawer;
 });

 overlay.addEventListener('click', (e) => {
 e.stopPropagation;
 closeDrawer;
 });

 document.addEventListener('keydown', (e) => {
 if (e.key === 'Escape' && this.isSidebarOpen) {
 closeDrawer;
 }
 });
 }

 updateNavUI {
 const navAuthContainer = document.getElementById('nav-auth-container');
 const sidebarUserArea = document.getElementById('sidebar-user-area');
 const sidebarNavLinks = document.getElementById('sidebar-nav-links');

 const user = this.currentUser;
 const isOwner = user && (user.role === 'admin') && (user.email.toLowerCase === this.OWNER_EMAIL.toLowerCase);

 if (navAuthContainer) {
 if (user) {
 navAuthContainer.innerHTML = `
 <div style="display: flex; align-items: center; gap: 0.75rem;">
 <a href="about.html" class="btn btn-outline btn-sm desktop-only">عن مدارج </a>
 <a href="dashboard.html" class="btn btn-secondary btn-sm">
 <span> ${this.escapeHtml(user.fullName)}</span>
 ${isOwner ? '<span class="badge badge-warning">المشرف العام </span>': ''}
 </a>
 ${isOwner ? '<a href="admin.html" class="btn btn-primary btn-sm">لوحة الإدارة </a>': ''}
 <button id="btn-logout" class="btn btn-outline btn-sm" aria-label="تسجيل الخروج">خروج</button>
 </div>
 `;
 document.getElementById('btn-logout')?.addEventListener('click',  => this.signOut);
 } else {
 navAuthContainer.innerHTML = `
 <div style="display: flex; align-items: center; gap: 0.5rem;">
 <a href="about.html" class="btn btn-outline btn-sm">عن مدارج </a>
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
 ${isOwner ? '<span class="badge badge-warning">المشرف الأكاديمي العام </span>': '<span class="badge badge-primary">طالب بالقسم</span>'}
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
 <span class="sidebar-link-icon" aria-hidden="true"></span>
 <span>الصفحة الرئيسية</span>
 </a>
 </li>
 <li>
 <a href="about.html" class="sidebar-link">
 <span class="sidebar-link-icon" aria-hidden="true"></span>
 <span>عن منصة مدارج (الرؤية والرسالة)</span>
 </a>
 </li>
 <li>
 <a href="index.html#subjects-section" class="sidebar-link">
 <span class="sidebar-link-icon" aria-hidden="true"></span>
 <span>مقررات المنصة وبنوك الأسئلة</span>
 </a>
 </li>
 `;

 if (user) {
 linksHtml += `
 <li>
 <a href="dashboard.html" class="sidebar-link">
 <span class="sidebar-link-icon" aria-hidden="true"></span>
 <span>سجل اختباراتي بالقسم</span>
 </a>
 </li>
 <li>
 <a href="dashboard.html?tab=bookmarks" class="sidebar-link">
 <span class="sidebar-link-icon" aria-hidden="true"></span>
 <span>المسائل المحفوظة للمراجعة</span>
 </a>
 </li>
 `;

 if (isOwner) {
 linksHtml += `
 <li>
 <a href="admin.html" class="sidebar-link">
 <span class="sidebar-link-icon" aria-hidden="true"></span>
 <span>لوحة الإدارة والتحكم الشامل</span>
 </a>
 </li>
 `;
 }

 linksHtml += `
 <li style="margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--border);">
 <button id="sidebar-btn-logout" class="sidebar-link" style="width: 100%; border: none; background: none; color: var(--danger); cursor: pointer; text-align: right;">
 <span class="sidebar-link-icon" aria-hidden="true"></span>
 <span>تسجيل الخروج</span>
 </button>
 </li>
 `;
 }

 sidebarNavLinks.innerHTML = linksHtml;
 document.getElementById('sidebar-btn-logout')?.addEventListener('click',  => this.signOut);
 }
 }

 escapeHtml(str) {
 return str ? str.replace(/[&<>'\"]/g, tag => ({
 '&': '&amp;',
 '<': '&lt;',
 '>': '&gt;',
 "'": '&#39;',
 '"': '&quot;'
 }[tag] || tag)): '';
 }
}

window.authManager = new AuthManager;
