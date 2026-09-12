/**
 * إعدادات منصة الاختبارات التفاعلية
 * متصلة مباشرة بقاعدة البيانات السحابية الحقيقية (Supabase Live Backend)
 */

const CONFIG = {
  // مفاتيح مشروع Supabase السحابي الحقيقي المباشر
  SUPABASE_URL: localStorage.getItem('EDUTEST_SUPABASE_URL') || 'https://lkcuktpyeutrrxjuenzb.supabase.co',
  SUPABASE_ANON_KEY: localStorage.getItem('EDUTEST_SUPABASE_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrY3VrdHB5ZXV0cnJ4anVlbnpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMTE0MjgsImV4cCI6MjEwNDc4NzQyOH0.lDEA3HTrD75Yt8Lw9nlUOkCL60cdBl4a9kmn9RfNcFQ',
  
  // اسم المنصة
  APP_NAME: 'منصة مدارج للاختبارات التفاعلية',
  APP_VERSION: '1.0.0',

  // هل مفاتيح Supabase مهيأة؟
  isSupabaseConfigured() {
    return Boolean(this.SUPABASE_URL && this.SUPABASE_ANON_KEY && !this.SUPABASE_URL.includes('your-project'));
  },

  // حفظ مفاتيح Supabase من واجهة الإعدادات
  saveCredentials(url, key) {
    if (!url || !key) return false;
    localStorage.setItem('EDUTEST_SUPABASE_URL', url.trim());
    localStorage.setItem('EDUTEST_SUPABASE_KEY', key.trim());
    this.SUPABASE_URL = url.trim();
    this.SUPABASE_ANON_KEY = key.trim();
    return true;
  },

  // مسح الإعدادات والعودة للافتراضي
  clearCredentials() {
    localStorage.removeItem('EDUTEST_SUPABASE_URL');
    localStorage.removeItem('EDUTEST_SUPABASE_KEY');
    this.SUPABASE_URL = 'https://lkcuktpyeutrrxjuenzb.supabase.co';
    this.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrY3VrdHB5ZXV0cnJ4anVlbnpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMTE0MjgsImV4cCI6MjEwNDc4NzQyOH0.lDEA3HTrD75Yt8Lw9nlUOkCL60cdBl4a9kmn9RfNcFQ';
  }
};

window.CONFIG = CONFIG;
