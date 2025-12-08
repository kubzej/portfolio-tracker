export type ExchangeCode =
  | ''
  | 'NYSE'
  | 'NASDAQ'
  | 'LSE'
  | 'XETRA'
  | 'SIX'
  | 'TSX'
  | 'ASX'
  | 'JPX'
  | 'SSE'
  | 'HKEX'
  | 'PSE'
  | 'OMX-STO'
  | 'OMX-CPH'
  | 'OMX-HEL'
  | 'OMX-ICE'
  | 'OSE'
  | 'VIE'
  | 'WSE'
  | 'PSE-PRA'
  | 'EURONEXT-PARIS';

interface ExchangeHours {
  name: string;
  timezone: string; // IANA timezone
  open: string; // HH:mm
  close: string; // HH:mm
  preMarket?: string; // HH:mm
  postMarket?: string; // HH:mm
  days: ('Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri')[];
  notes?: string;
}

// Hours are approximate standard session times; pre/post may vary by venue.
export const EXCHANGE_HOURS: Record<ExchangeCode, ExchangeHours> = {
  '': {
    name: 'No exchange',
    timezone: 'UTC',
    open: '00:00',
    close: '00:00',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  },
  NYSE: {
    name: 'NYSE (USA)',
    timezone: 'America/New_York',
    open: '09:30',
    close: '16:00',
    preMarket: '04:00',
    postMarket: '20:00',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  },
  NASDAQ: {
    name: 'Nasdaq (USA)',
    timezone: 'America/New_York',
    open: '09:30',
    close: '16:00',
    preMarket: '04:00',
    postMarket: '20:00',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  },
  LSE: {
    name: 'London Stock Exchange (UK)',
    timezone: 'Europe/London',
    open: '08:00',
    close: '16:30',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  },
  XETRA: {
    name: 'Xetra / Deutsche Börse (DE)',
    timezone: 'Europe/Berlin',
    open: '09:00',
    close: '17:30',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  },
  SIX: {
    name: 'SIX Swiss Exchange (CH)',
    timezone: 'Europe/Zurich',
    open: '09:00',
    close: '17:30',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  },
  TSX: {
    name: 'Toronto Stock Exchange (CA)',
    timezone: 'America/Toronto',
    open: '09:30',
    close: '16:00',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  },
  ASX: {
    name: 'Australian Securities Exchange (AU)',
    timezone: 'Australia/Sydney',
    open: '10:00',
    close: '16:00',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    notes: 'Staggered auctions and intraday breaks may apply.',
  },
  JPX: {
    name: 'Japan Exchange Group (JP)',
    timezone: 'Asia/Tokyo',
    open: '09:00',
    close: '15:00',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    notes: 'Lunch break around 11:30–12:30 local time.',
  },
  SSE: {
    name: 'Shanghai Stock Exchange (CN)',
    timezone: 'Asia/Shanghai',
    open: '09:30',
    close: '15:00',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    notes: 'Lunch break 11:30–13:00 local time.',
  },
  HKEX: {
    name: 'Hong Kong Exchanges (HK)',
    timezone: 'Asia/Hong_Kong',
    open: '09:30',
    close: '16:00',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    notes: 'Lunch break 12:00–13:00 local time.',
  },
  PSE: {
    name: 'Philippine Stock Exchange (PH)',
    timezone: 'Asia/Manila',
    open: '09:30',
    close: '15:30',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  },
  'OMX-STO': {
    name: 'Nasdaq Stockholm (SE)',
    timezone: 'Europe/Stockholm',
    open: '09:00',
    close: '17:30',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  },
  'OMX-CPH': {
    name: 'Nasdaq Copenhagen (DK)',
    timezone: 'Europe/Copenhagen',
    open: '09:00',
    close: '17:00',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  },
  'OMX-HEL': {
    name: 'Nasdaq Helsinki (FI)',
    timezone: 'Europe/Helsinki',
    open: '10:00',
    close: '18:30',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  },
  'OMX-ICE': {
    name: 'Nasdaq Iceland (IS)',
    timezone: 'Atlantic/Reykjavik',
    open: '10:00',
    close: '15:30',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  },
  OSE: {
    name: 'Oslo Børs (NO)',
    timezone: 'Europe/Oslo',
    open: '09:00',
    close: '16:30',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  },
  VIE: {
    name: 'Vienna Stock Exchange (AT)',
    timezone: 'Europe/Vienna',
    open: '09:00',
    close: '17:30',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  },
  WSE: {
    name: 'Warsaw Stock Exchange (PL)',
    timezone: 'Europe/Warsaw',
    open: '09:00',
    close: '17:05',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  },
  'PSE-PRA': {
    name: 'Prague Stock Exchange (CZ)',
    timezone: 'Europe/Prague',
    open: '09:00',
    close: '16:20',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  },
  'EURONEXT-PARIS': {
    name: 'Euronext Paris (FR)',
    timezone: 'Europe/Paris',
    open: '09:00',
    close: '17:30',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  },
};

export function getExchangeHours(
  code: ExchangeCode
): ExchangeHours | undefined {
  return EXCHANGE_HOURS[code];
}

export function formatExchangeHours(code: ExchangeCode): string {
  const h = EXCHANGE_HOURS[code];
  if (!h) return '';
  const base = `${h.open}–${h.close} (${h.timezone})`;
  const ext = [
    h.preMarket ? `Pre ${h.preMarket}` : undefined,
    h.postMarket ? `Post ${h.postMarket}` : undefined,
  ].filter(Boolean);
  return ext.length ? `${base}; ${ext.join(', ')}` : base;
}
