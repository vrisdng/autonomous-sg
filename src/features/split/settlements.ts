import { PaymentSettlement } from '../../data/billDraft';

export function effectivePaymentStatus(settlement: PaymentSettlement | undefined, currentAmountCents: number) {
  return settlement?.amountCents === currentAmountCents ? settlement.status : 'unpaid' as const;
}
