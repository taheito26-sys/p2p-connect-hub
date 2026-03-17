/* ═══════════════════════════════════════════════════════════════
   i18n — Arabic / English translation system for Tracker
   ═══════════════════════════════════════════════════════════════ */

import { useTheme } from './theme-context';
import { useMemo } from 'react';

export type Lang = 'en' | 'ar';

const translations = {
  // ── TopBar ──
  search: { en: 'Search...', ar: 'بحث...' },
  synced: { en: '● Synced', ar: '● متزامن' },
  signOut: { en: 'Sign out', ar: 'تسجيل خروج' },
  diagnostics: { en: 'Diagnostics', ar: 'التشخيص' },
  dateRange: { en: 'Date range', ar: 'نطاق التاريخ' },
  currency: { en: 'Currency', ar: 'العملة' },
  language: { en: 'Language', ar: 'اللغة' },
  arabic: { en: 'Arabic', ar: 'عربي' },
  english: { en: 'English', ar: 'إنجليزي' },
  clientId: { en: 'Client ID', ar: 'رقم العميل' },
  user: { en: 'User', ar: 'مستخدم' },

  // ── Sidebar ──
  tracker: { en: 'TRACKER', ar: 'المتتبع' },
  trading: { en: 'Trading', ar: 'التداول' },
  network: { en: 'Network', ar: 'الشبكة' },
  dashboard: { en: 'Dashboard', ar: 'لوحة التحكم' },
  orders: { en: 'Orders', ar: 'الطلبات' },
  stock: { en: 'Stock', ar: 'المخزون' },
  calendar: { en: 'Calendar', ar: 'التقويم' },
  p2pTracker: { en: 'P2P Market', ar: 'سوق P2P' },
  
  portfolio: { en: 'Portfolio', ar: 'المحفظة' },
  trades: { en: 'Trades', ar: 'الصفقات' },
  crm: { en: 'CRM', ar: 'إدارة العملاء' },
  messages: { en: 'Messages', ar: 'الرسائل' },
  deals: { en: 'Deals', ar: 'الصفقات التجارية' },
  analytics: { en: 'Analytics', ar: 'التحليلات' },
  vault: { en: 'Vault', ar: 'الخزنة' },
  audit: { en: 'Audit', ar: 'السجل' },
  settings: { en: 'Settings', ar: 'الإعدادات' },
  notifications: { en: 'Notifications', ar: 'الإشعارات' },
  logout: { en: 'Logout', ar: 'تسجيل خروج' },

  // ── Dashboard ──
  tradingVolume: { en: '📦 TRADING VOLUME', ar: '📦 حجم التداول' },
  netProfit: { en: '📈 NET PROFIT', ar: '📈 صافي الربح' },
  oneDay: { en: '1 DAY', ar: 'يوم واحد' },
  sevenDays: { en: '7 DAYS', ar: '7 أيام' },
  fees: { en: 'Fees', ar: 'الرسوم' },
  netProfitLabel: { en: 'NET PROFIT', ar: 'صافي الربح' },
  avgMargin: { en: 'AVG MARGIN', ar: 'متوسط الهامش' },
  availableUsdt: { en: 'AVAILABLE USDT', ar: 'USDT المتاح' },
  liquidUsdt: { en: 'Liquid USDT ready for deployment', ar: 'USDT سائل جاهز للاستخدام' },
  avPriceSpread: { en: 'Av Price + SPREAD', ar: 'متوسط السعر + الفارق' },
  noStock: { en: 'No stock', ar: 'لا مخزون' },
  sellAboveAvPrice: { en: 'Sell above Av Price to profit', ar: 'بع فوق متوسط السعر للربح' },
  cashAvailable: { en: 'CASH AVAILABLE', ar: 'النقد المتاح' },
  manageCash: { en: '💰 Manage Cash', ar: '💰 إدارة النقد' },
  owner: { en: 'Owner', ar: 'المالك' },
  buyingPower: { en: 'BUYING POWER', ar: 'القوة الشرائية' },
  setCash: { en: 'Set cash →', ar: 'حدد النقد →' },
  addBatchesFirst: { en: 'Add batches first', ar: 'أضف دفعات أولاً' },
  netPosition: { en: 'NET POSITION', ar: 'الموقف الصافي' },
  stockCostEst: { en: 'STOCK COST EST.', ar: 'تقدير تكلفة المخزون' },
  profitRevenueTrend: { en: 'Profit & Revenue Trend', ar: 'اتجاه الربح والإيرادات' },
  last14Trades: { en: 'Last 14 trades', ar: 'آخر 14 صفقة' },
  chartRendersLive: { en: 'Chart renders with live trade data', ar: 'الرسم البياني يعمل مع بيانات حية' },
  periodStats: { en: 'Period Stats', ar: 'إحصائيات الفترة' },
  volume: { en: 'Volume', ar: 'الحجم' },
  cost: { en: 'Cost', ar: 'التكلفة' },
  netProfitPerTrade: { en: '📊 Net Profit Per Trade', ar: '📊 صافي الربح لكل صفقة' },
  allTime: { en: 'All time', ar: 'كل الأوقات' },
  dailyVolumeProfit: { en: '📈 Daily Volume & Profit', ar: '📈 الحجم والربح اليومي' },
  byDay: { en: 'By day', ar: 'حسب اليوم' },
  low: { en: '⚠ Low', ar: '⚠ منخفض' },
  ok: { en: 'OK', ar: 'حسناً' },
  avPrice: { en: 'Av Price', ar: 'متوسط السعر' },
  cash: { en: 'Cash', ar: 'نقد' },
  net: { en: 'Net', ar: 'صافي' },

  // ── Orders ──
  newSale: { en: '+ New Sale', ar: '+ بيع جديد' },
  tradeLedger: { en: 'Trade Ledger', ar: 'سجل التداول' },
  date: { en: 'Date', ar: 'التاريخ' },
  qty: { en: 'Qty', ar: 'الكمية' },
  avgBuy: { en: 'Avg Buy', ar: 'متوسط الشراء' },
  sell: { en: 'Sell', ar: 'البيع' },
  margin: { en: 'Margin', ar: 'الهامش' },
  buyer: { en: 'Buyer', ar: 'المشتري' },
  actions: { en: 'Actions', ar: 'الإجراءات' },
  details: { en: '▶ Details', ar: '▶ التفاصيل' },
  edit: { en: 'Edit', ar: 'تعديل' },
  delete: { en: 'Delete', ar: 'حذف' },
  save: { en: 'Save', ar: 'حفظ' },
  cancel: { en: 'Cancel', ar: 'إلغاء' },
  exportCsv: { en: 'CSV', ar: 'CSV' },
  amountUsdt: { en: 'Amount (USDT)', ar: 'المبلغ (USDT)' },
  sellPrice: { en: 'Sell Price (QAR)', ar: 'سعر البيع (ر.ق)' },
  useStockFifo: { en: 'Use stock (FIFO)', ar: 'استخدام المخزون (FIFO)' },
  addBuyer: { en: '+ Add buyer', ar: '+ إضافة مشتري' },
  recordSale: { en: 'Record Sale', ar: 'تسجيل البيع' },
  name: { en: 'Name', ar: 'الاسم' },
  phone: { en: 'Phone', ar: 'الهاتف' },
  tier: { en: 'Tier', ar: 'الفئة' },
  add: { en: 'Add', ar: 'إضافة' },
  noTradesRecorded: { en: 'No trades recorded yet', ar: 'لم يتم تسجيل صفقات بعد' },
  addFirstSale: { en: 'Add your first sale above', ar: 'أضف أول عملية بيع أعلاه' },
  fifoSlices: { en: 'FIFO Slices', ar: 'شرائح FIFO' },
  cycleTime: { en: 'Cycle Time', ar: 'وقت الدورة' },
  batch: { en: 'Batch', ar: 'دفعة' },
  costBasis: { en: 'Cost Basis', ar: 'أساس التكلفة' },
  gross: { en: 'Gross', ar: 'الإجمالي' },
  fee: { en: 'Fee', ar: 'الرسوم' },
  totalCost: { en: 'Total Cost', ar: 'إجمالي التكلفة' },
  totalNet: { en: 'Total Net', ar: 'صافي الإجمالي' },
  editTrade: { en: 'Edit Trade', ar: 'تعديل الصفقة' },
  void: { en: 'VOID', ar: 'ملغاة' },

  // ── Stock ──
  addBatch: { en: '+ Add Batch', ar: '+ إضافة دفعة' },
  stockBatches: { en: 'Stock Batches', ar: 'دفعات المخزون' },
  fifoProgress: { en: 'FIFO layers · progress = remaining', ar: 'طبقات FIFO · التقدم = المتبقي' },
  source: { en: 'Source', ar: 'المصدر' },
  price: { en: 'Price', ar: 'السعر' },
  remaining: { en: 'Remaining', ar: 'المتبقي' },
  age: { en: 'Age', ar: 'العمر' },
  note: { en: 'Note', ar: 'ملاحظة' },
  supplier: { en: 'Supplier', ar: 'المورد' },
  addSupplier: { en: '+ Add supplier', ar: '+ إضافة مورد' },
  totalUsdt: { en: 'Total USDT', ar: 'إجمالي USDT' },
  avgPrice: { en: 'Avg Price', ar: 'متوسط السعر' },
  noBatches: { en: 'No batches in stock', ar: 'لا توجد دفعات في المخزون' },
  addFirstBatch: { en: 'Add your first batch above', ar: 'أضف أول دفعة أعلاه' },
  editBatch: { en: 'Edit Batch', ar: 'تعديل الدفعة' },
  suppliers: { en: 'Suppliers', ar: 'الموردون' },

  // ── Calendar ──
  monthlyProfit: { en: 'Monthly Profit', ar: 'الربح الشهري' },
  totalTrades: { en: 'Total Trades', ar: 'إجمالي الصفقات' },
  tradingDays: { en: 'Trading Days', ar: 'أيام التداول' },
  monthlyVolume: { en: 'Monthly Volume', ar: 'حجم الشهر' },
  winRate: { en: 'Win Rate', ar: 'معدل الفوز' },
  best: { en: 'Best', ar: 'أفضل' },
  worst: { en: 'Worst', ar: 'أسوأ' },
  prev: { en: '← Prev', ar: '→ السابق' },
  today: { en: 'Today', ar: 'اليوم' },
  next: { en: 'Next →', ar: 'التالي ←' },
  time: { en: 'Time', ar: 'الوقت' },
  noTradesOnDay: { en: 'No trades on', ar: 'لا صفقات في' },
  logATrade: { en: 'Log a trade', ar: 'سجل صفقة' },
  sun: { en: 'Sun', ar: 'أحد' },
  mon: { en: 'Mon', ar: 'إثنين' },
  tue: { en: 'Tue', ar: 'ثلاثاء' },
  wed: { en: 'Wed', ar: 'أربعاء' },
  thu: { en: 'Thu', ar: 'خميس' },
  fri: { en: 'Fri', ar: 'جمعة' },
  sat: { en: 'Sat', ar: 'سبت' },
  january: { en: 'January', ar: 'يناير' },
  february: { en: 'February', ar: 'فبراير' },
  march: { en: 'March', ar: 'مارس' },
  april: { en: 'April', ar: 'أبريل' },
  may: { en: 'May', ar: 'مايو' },
  june: { en: 'June', ar: 'يونيو' },
  july: { en: 'July', ar: 'يوليو' },
  august: { en: 'August', ar: 'أغسطس' },
  september: { en: 'September', ar: 'سبتمبر' },
  october: { en: 'October', ar: 'أكتوبر' },
  november: { en: 'November', ar: 'نوفمبر' },
  december: { en: 'December', ar: 'ديسمبر' },

  // ── CRM ──
  customers: { en: 'Customers', ar: 'العملاء' },
  buyerManagement: { en: 'Buyer management · trade history', ar: 'إدارة المشترين · سجل التداول' },
  addCustomer: { en: '+ Add Customer', ar: '+ إضافة عميل' },
  noCustomersFound: { en: 'No customers found', ar: 'لم يتم العثور على عملاء' },
  addFirstBuyer: { en: 'Add your first buyer to track trades', ar: 'أضف أول مشتري لتتبع الصفقات' },
  dailyLimit: { en: 'Daily Limit', ar: 'الحد اليومي' },
  notes: { en: 'Notes', ar: 'ملاحظات' },
  history: { en: 'History', ar: 'السجل' },
  searchCustomers: { en: 'Search customers...', ar: 'بحث عملاء...' },
  searchSuppliers: { en: 'Search suppliers...', ar: 'بحث موردين...' },
  autoTrackedFromBatches: { en: 'Auto-tracked from batches · purchase history', ar: 'تتبع تلقائي من الدفعات · سجل المشتريات' },
  noSuppliersFound: { en: 'No suppliers found', ar: 'لم يتم العثور على موردين' },
  addBatchesToTrack: { en: 'Add batches with a source to track suppliers', ar: 'أضف دفعات مع مصدر لتتبع الموردين' },
  batches: { en: 'Batches', ar: 'الدفعات' },
  lastPurchase: { en: 'Last Purchase', ar: 'آخر شراء' },
  viewBatches: { en: 'View Batches', ar: 'عرض الدفعات' },
  totalQar: { en: 'Total QAR', ar: 'إجمالي ر.ق' },

  // ── Settings ──
  layoutTemplates: { en: '🎨 Layout Templates', ar: '🎨 قوالب التخطيط' },
  colorThemes: { en: 'Color Themes for', ar: 'ألوان السمة لـ' },
  tradingConfig: { en: '⚡ Trading Config', ar: '⚡ إعدادات التداول' },
  lowStockThreshold: { en: 'Low stock threshold (USDT)', ar: 'حد المخزون المنخفض (USDT)' },
  priceAlertThreshold: { en: 'Price alert threshold (%)', ar: 'حد تنبيه السعر (%)' },
  allowInvalidTrades: { en: 'Allow invalid trades (no stock)', ar: 'السماح بصفقات بدون مخزون' },
  allowInvalidTradesDesc: { en: 'When enabled, unmatched trades are still stored and shown with "!" but excluded from profit KPIs.', ar: 'عند التفعيل، يتم تخزين الصفقات غير المطابقة وعرضها بـ "!" لكن تُستبعد من مؤشرات الربح.' },
  fontsAccessibility: { en: '🔤 Fonts & Accessibility', ar: '🔤 الخطوط وإمكانية الوصول' },
  ledgerFont: { en: 'Ledger Font', ar: 'خط السجل' },
  fontSize: { en: 'Font Size', ar: 'حجم الخط' },
  accessibilityProfile: { en: 'Accessibility Profile', ar: 'ملف إمكانية الوصول' },
  autoAdjustFont: { en: 'Auto-adjust font for screen size', ar: 'ضبط الخط تلقائياً لحجم الشاشة' },
  autoSize: { en: 'Auto size', ar: 'حجم تلقائي' },
  logs: { en: '📋 Logs', ar: '📋 السجلات' },
  enableLogs: { en: 'Enable logs', ar: 'تفعيل السجلات' },
  level: { en: 'Level', ar: 'المستوى' },
  download: { en: 'Download', ar: 'تحميل' },
  clear: { en: 'Clear', ar: 'مسح' },
  logsCleared: { en: 'Logs cleared', ar: 'تم مسح السجلات' },
  clientSideLogs: { en: 'Client-side logs stored in this browser. Max 500 entries.', ar: 'سجلات محلية مخزنة في هذا المتصفح. الحد الأقصى 500 إدخال.' },
  discardBtn: { en: 'Discard', ar: 'تراجع' },
  saveSettings: { en: 'Save Settings', ar: 'حفظ الإعدادات' },
  settingsSaved: { en: 'Settings saved', ar: 'تم حفظ الإعدادات' },
  discardedChanges: { en: 'Discarded pending changes', ar: 'تم التراجع عن التغييرات' },
  layoutThemesData: { en: 'Layout templates · themes · data', ar: 'قوالب التخطيط · السمات · البيانات' },

  // ── TopBar titles ──
  dashboardTitle: { en: 'Dashboard', ar: 'لوحة التحكم' },
  dashboardSub: { en: 'KPIs · trend', ar: 'مؤشرات الأداء · الاتجاه' },
  tradesTitle: { en: 'Trades', ar: 'الصفقات' },
  tradesSub: { en: 'FIFO cost basis · margin bar', ar: 'أساس تكلفة FIFO · شريط الهامش' },
  stockTitle: { en: 'Stock Batches', ar: 'دفعات المخزون' },
  stockSub: { en: 'FIFO layers · progress = remaining', ar: 'طبقات FIFO · التقدم = المتبقي' },
  calendarTitle: { en: 'Calendar', ar: 'التقويم' },
  calendarSub: { en: 'Visual daily trading activity view', ar: 'عرض مرئي لنشاط التداول اليومي' },
  crmTitle: { en: 'CRM', ar: 'إدارة العملاء' },
  crmSub: { en: 'Directory · Customers + Suppliers · History', ar: 'الدليل · العملاء + الموردون · السجل' },
  vaultTitle: { en: 'Vault', ar: 'الخزنة' },
  vaultSub: { en: 'Backup & cloud', ar: 'النسخ الاحتياطي والسحابة' },
  settingsTitle: { en: 'Settings', ar: 'الإعدادات' },
  settingsSub: { en: 'Layout · themes', ar: 'التخطيط · السمات' },
  trackerTitle: { en: 'Tracker', ar: 'المتتبع' },
  trackerSub: { en: 'FIFO · trading workspace', ar: 'FIFO · مساحة التداول' },
} as const;

export type TranslationKey = keyof typeof translations;

/** Get a translation function for the current language */
export function useT() {
  const { settings } = useTheme();
  const lang = settings.language;

  return useMemo(() => {
    const t = (key: TranslationKey): string => {
      const entry = translations[key];
      return entry ? entry[lang] || entry.en : key;
    };
    t.lang = lang;
    t.isRTL = lang === 'ar';
    return t;
  }, [lang]);
}

/** Standalone t function (non-hook, for use outside components) */
export function getT(lang: Lang) {
  return (key: TranslationKey): string => {
    const entry = translations[key];
    return entry ? entry[lang] || entry.en : key;
  };
}
