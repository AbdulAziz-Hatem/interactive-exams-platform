/**
 * إعدادات منصة الاختبارات التفاعلية
 * تدعم الربط المباشر مع Supabase أو العمل التلقائي في وضع المحاكاة والتجربة (Demo Mode)
 */

const CONFIG = {
  // مفاتيح مشروع Supabase الخاص بك (يمكن وضعها هنا أو إدخالها من لوحة الإعدادات في المتصفح)
  SUPABASE_URL: localStorage.getItem('EDUTEST_SUPABASE_URL') || '',
  SUPABASE_ANON_KEY: localStorage.getItem('EDUTEST_SUPABASE_KEY') || '',
  
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

  // مسح الإعدادات والعودة لوضع التجربة
  clearCredentials() {
    localStorage.removeItem('EDUTEST_SUPABASE_URL');
    localStorage.removeItem('EDUTEST_SUPABASE_KEY');
    this.SUPABASE_URL = '';
    this.SUPABASE_ANON_KEY = '';
  }
};

window.CONFIG = CONFIG;
