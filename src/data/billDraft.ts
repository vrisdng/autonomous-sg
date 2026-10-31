import AsyncStorage from '@react-native-async-storage/async-storage';
import { BillAdjustment, SplitItem, SplitPerson } from '../features/split/calculateBill';

export type BillDraft = {
  // Device-local display choice; never grants guest/host capabilities.
  currentPersonId?: string;
  people: SplitPerson[];
  items: SplitItem[];
  adjustments: BillAdjustment[];
  finalTotal: string;
  receiptTotal: string;
  confirmedTotal: string;
  confirmedAt: string;
  totalRevisedAt: string;
  requiresTotalConfirmation: boolean;
  paymentLabel: string;
  servicePercent: string;
  gstPercent: string;
  settlements: Record<string, PaymentSettlement>;
  revision?: number;
  pendingSync?: boolean;
};

export type PaymentSettlement = { status: 'unpaid' | 'sent' | 'received'; amountCents: number; updatedAt?: string };

const BILL_STORAGE_KEY = 'bojio.bill-draft.v2';
let pendingSave: Promise<unknown> = Promise.resolve();

export const starterBillDraft: BillDraft = {
  people: [],
  items: [],
  adjustments: [],
  finalTotal: '',
  receiptTotal: '',
  confirmedTotal: '',
  confirmedAt: '',
  totalRevisedAt: '',
  requiresTotalConfirmation: true,
  paymentLabel: '',
  servicePercent: '0',
  gstPercent: '0',
  settlements: {},
};

export async function loadBillDraft(planCode?: string) {
  await pendingSave;
  const stored = await AsyncStorage.getItem(planCode ? `${BILL_STORAGE_KEY}:${planCode}` : BILL_STORAGE_KEY);
  if (!stored) return starterBillDraft;
  try {
    const draft = JSON.parse(stored) as BillDraft;
    if(!draft || !Array.isArray(draft.people) || !Array.isArray(draft.items))throw new Error('Invalid saved bill');
    return { ...starterBillDraft, ...draft, adjustments: Array.isArray(draft.adjustments) ? draft.adjustments : [], finalTotal: typeof draft.finalTotal === 'string' ? draft.finalTotal : '', receiptTotal: typeof draft.receiptTotal === 'string' ? draft.receiptTotal : '', confirmedTotal: typeof draft.confirmedTotal === 'string' ? draft.confirmedTotal : '', confirmedAt: typeof draft.confirmedAt === 'string' ? draft.confirmedAt : '', totalRevisedAt: typeof draft.totalRevisedAt === 'string' ? draft.totalRevisedAt : '', requiresTotalConfirmation: draft.requiresTotalConfirmation === true, paymentLabel: typeof draft.paymentLabel === 'string' ? draft.paymentLabel : '', settlements: draft.settlements ?? {} };
  } catch {
    throw new Error('Could not read the saved bill. Your stored data has not been replaced.');
  }
}

export function saveBillDraft(draft: BillDraft, planCode?: string) {
  const value = JSON.stringify(draft);
  const key = planCode ? `${BILL_STORAGE_KEY}:${planCode}` : BILL_STORAGE_KEY;
  pendingSave = pendingSave.catch(() => undefined).then(() => AsyncStorage.setItem(key, value));
  return pendingSave;
}
