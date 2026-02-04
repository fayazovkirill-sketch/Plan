import { SectionId, SectionConfig } from './types';

export const SECTIONS: SectionConfig[] = [
  { id: SectionId.TODAY, title: 'Сегодня', limit: 3 },
  { id: SectionId.TOMORROW, title: 'Завтра', limit: 3 },
  { id: SectionId.THIS_WEEK, title: 'На этой неделе', limit: 10 },
  { id: SectionId.NEXT_WEEK, title: 'На следующей неделе', limit: 10 },
  { id: SectionId.MONTH, title: 'Цели месяца', limit: 20 },
  { id: SectionId.DONE, title: 'Сделано', limit: Infinity },
];

export const TRADING_TAGS = ['#trading', '#трейдинг'];

export const TRADING_CHECKLIST = [
  '1. Считать R (Риск)',
  '2. Правило одного косяка',
  '3. Чек-лист вместо чуйки',
  '4. Работа-инвестор',
  '5. Полюбить скуку'
];

export const STAGNATION_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

// --- SETTINGS ---
// TEST MODE: 1 minute (60 * 1000)
// PRODUCTION: 72 hours (72 * 60 * 60 * 1000)
export const FOCUS_EDIT_LOCK_MS = 60 * 1000;

export const WEEK_MS = 168 * 60 * 60 * 1000; // 7 days