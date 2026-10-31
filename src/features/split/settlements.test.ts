import { describe, expect, it } from 'vitest';
import { effectivePaymentStatus } from './settlements';

describe('payment settlement status', () => {
  it('keeps status only while it matches the current amount', () => {
    expect(effectivePaymentStatus({ status: 'received', amountCents: 1250 }, 1250)).toBe('received');
    expect(effectivePaymentStatus({ status: 'received', amountCents: 1250 }, 1300)).toBe('unpaid');
  });
});
