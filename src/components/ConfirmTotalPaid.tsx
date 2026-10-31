import { Text, TextInput, View } from 'react-native';
import { BillChargeBreakdown, formatCents } from '../features/split/calculateBill';
import { colors } from '../theme';
import { Button } from './Ui';

function money(cents: number) {
  const sign = cents < 0 ? '−' : '';
  return `${sign}S$${formatCents(Math.abs(cents))}`;
}

export function ConfirmTotalPaid({ paymentLabel, amount, displayAmount, confirmed, breakdown, gapCents, busy, onAmount, onConfirm, onReopen, onAddRounding, onRescan }: {
  paymentLabel: string;
  amount: string;
  displayAmount: string;
  confirmed: boolean;
  breakdown: BillChargeBreakdown;
  gapCents: number | null;
  busy: boolean;
  onAmount: (value: string) => void;
  onConfirm?: () => void;
  onReopen?: () => void;
  onAddRounding?: () => void;
  onRescan?: () => void;
}) {
  const lines: [string, number][] = [
    ['Subtotal', breakdown.subtotalCents],
    ['Discounts', breakdown.discountCents],
    ['Service', breakdown.serviceCents],
    ['GST', breakdown.gstCents],
    ['Rounding', breakdown.roundingCents],
    ...(breakdown.otherCents ? [['Other', breakdown.otherCents] as [string, number]] : []),
  ];
  return (
    <View style={{ gap: 8, backgroundColor: colors.card, borderRadius: 24, padding: 20 }}>
      <Text style={{ color: colors.green, fontWeight: '900', fontSize: 11, letterSpacing: 1.1 }}>CONFIRM TOTAL PAID</Text>
      <Text accessibilityLabel="Scanned amount paid" style={{ color: colors.ink, fontSize: 22, fontWeight: '900' }}>{paymentLabel ? `${paymentLabel} ` : ''}S${displayAmount || '0.00'}</Text>
      <TextInput accessibilityLabel="Confirm total paid" editable={!confirmed && !busy} value={amount} onChangeText={onAmount} keyboardType="decimal-pad" placeholder={displayAmount || '0.00'} placeholderTextColor={colors.muted} style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.paper, color: colors.ink, fontWeight: '900', fontSize: 20, paddingHorizontal: 12, paddingVertical: 10 }} />
      {lines.map(([label, cents]) => <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.muted, fontWeight: '700' }}>{label}</Text><Text style={{ color: colors.ink, fontWeight: '800' }}>{money(cents)}</Text></View>)}
      {gapCents ? <View style={{ backgroundColor: colors.coralSoft, borderRadius: 12, padding: 10, gap: 8 }}><Text accessibilityLiveRegion="polite" style={{ color: colors.reject, fontWeight: '800' }}>Off by ${formatCents(Math.abs(gapCents))}</Text><Text style={{ color: colors.ink, fontSize: 12, lineHeight: 18 }}>Items and adjustments differ from this total. Add a rounding adjustment, or scan the receipt again.</Text>{onAddRounding ? <Button secondary label="Add rounding adjustment" onPress={busy ? undefined : onAddRounding} /> : null}{onRescan ? <Button secondary label="Scan receipt again" onPress={busy ? undefined : onRescan} /> : null}</View> : null}
      {confirmed ? <Button label={busy ? 'Updating the total…' : 'Change the total'} onPress={busy ? undefined : onReopen} /> : <Button label={busy ? 'Confirming total…' : 'Confirm total paid'} onPress={busy ? undefined : onConfirm} />}
    </View>
  );
}
