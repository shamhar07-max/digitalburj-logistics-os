import { useSession } from '../store/session';

/** Minimal i18n: shell + common actions translated; page content stays English (labelled as such in docs). */
const ar: Record<string, string> = {
  'nav.overview': 'نظرة عامة', 'nav.operations': 'العمليات', 'nav.finance': 'المالية', 'nav.people': 'الموظفون', 'nav.intelligence': 'الذكاء', 'nav.comms': 'التواصل', 'nav.growth': 'النمو', 'nav.system': 'النظام',
  'dashboard': 'لوحة التحكم', 'shipments': 'الشحنات', 'pipeline': 'المبيعات', 'quotes': 'عروض الأسعار', 'customers': 'العملاء', 'customs': 'التخليص الجمركي', 'drivers': 'السائقون والأسطول', 'dispatch': 'الإرسال',
  'warehouse': 'المستودع', 'rates': 'الأسعار', 'procurement': 'المشتريات', 'accounting': 'المحاسبة', 'invoices': 'الفواتير', 'jobcosting': 'تكلفة الشحنات', 'vat': 'ضريبة القيمة المضافة', 'approvals': 'الموافقات',
  'hrms': 'الموارد البشرية', 'payroll': 'الرواتب', 'projects': 'المشاريع', 'ai': 'وكلاء الذكاء', 'docintel': 'قراءة المستندات', 'documents': 'المستندات', 'automation': 'الأتمتة', 'reports': 'التقارير',
  'inbox': 'صندوق الوارد', 'whatsapp': 'واتساب', 'growth': 'النمو', 'academy': 'الأكاديمية', 'talent': 'الكفاءات', 'portal': 'بوابة العملاء', 'permissions': 'الصلاحيات', 'settings': 'الإعدادات',
  'search': 'بحث', 'signout': 'تسجيل الخروج', 'new': 'جديد', 'save': 'حفظ', 'cancel': 'إلغاء', 'loading': 'جارٍ التحميل…', 'welcome': 'مرحباً', 'signin': 'تسجيل الدخول', 'email': 'البريد الإلكتروني', 'password': 'كلمة المرور',
};

export function t(key: string, fallback?: string): string {
  const loc = useSession.getState().locale;
  return loc === 'ar' ? ar[key] ?? fallback ?? key : fallback ?? key;
}
/** Hook variant so components re-render on language change. */
export function useT() {
  const loc = useSession((s) => s.locale);
  return (key: string, fallback?: string) => (loc === 'ar' ? ar[key] ?? fallback ?? key : fallback ?? key);
}

export function applyLocale(loc: 'en' | 'ar') {
  document.documentElement.lang = loc;
  document.documentElement.dir = loc === 'ar' ? 'rtl' : 'ltr';
}
export function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.dataset.theme = theme;
  const m = document.querySelector('meta[name="theme-color"]');
  m?.setAttribute('content', theme === 'dark' ? '#0b1516' : '#0A2A2B');
}
