import { Pressable, Text, TextInput, View } from 'react-native';
import { AdjustmentKind, BillAdjustment, formatCents, parseSignedCents } from '../features/split/calculateBill';
import { colors } from '../theme';
import { SoftCross } from './Ui';

const kinds: AdjustmentKind[] = ['service', 'tax', 'discount', 'rounding', 'other'];
const kindLabel: Record<AdjustmentKind, string> = {
  service: 'Service',
  tax: 'GST',
  discount: 'Discount',
  rounding: 'Rounding',
  other: 'Other',
};

export function BillAdjustments({ itemCents, adjustments, charged, referenceCents, readOnly, showCharged = true, onChange, onCharged }: {
  itemCents: number;
  adjustments: BillAdjustment[];
  charged: string;
  referenceCents: number | null;
  readOnly?: boolean;
  showCharged?: boolean;
  onChange: (rows: BillAdjustment[]) => void;
  onCharged: (value: string) => void;
}) {
  const adjustmentCents = adjustments.reduce((sum, row) => sum + (parseSignedCents(row.amount) ?? 0), 0);
  const computedCents = itemCents + adjustmentCents;
  const delta = referenceCents === null ? null : computedCents - referenceCents;
  const updateRow = (id: string, changes: Partial<BillAdjustment>) => onChange(adjustments.map((row) => row.id === id ? { ...row, ...changes } : row));
  return (
    <View style={{ gap: 8, marginTop: 8 }}>
      {adjustments.map((row, index) => (
        <View key={row.id} style={{ gap: 6, paddingVertical: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput accessibilityLabel={`Adjustment ${index + 1} label`} editable={!readOnly} value={row.label} onChangeText={(label) => updateRow(row.id, { label })} placeholder="Service, GST, discount…" placeholderTextColor={colors.muted} style={{ flex: 1, color: colors.ink, fontWeight: '700', paddingVertical: 7 }} />
            <TextInput accessibilityLabel={`Adjustment ${index + 1} amount`} editable={!readOnly} value={row.amount} onChangeText={(amount) => updateRow(row.id, { amount })} placeholder="-0.00" placeholderTextColor={colors.muted} style={{ width: 76, color: colors.ink, fontWeight: '900', textAlign: 'right', paddingVertical: 7 }} />
            {!readOnly ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove adjustment ${index + 1}`} onPress={() => onChange(adjustments.filter((item) => item.id !== row.id))} style={{ width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><SoftCross /></Pressable> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Adjustment ${index + 1} kind`} disabled={readOnly} onPress={readOnly ? undefined : () => updateRow(row.id, { kind: kinds[(kinds.indexOf(row.kind) + 1) % kinds.length] ?? 'other' })} style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 10, minHeight: 36, justifyContent: 'center' }}>
              <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 12 }}>{kindLabel[row.kind]}</Text>
            </Pressable>
            <TextInput accessibilityLabel={`Adjustment ${index + 1} percent`} editable={!readOnly} value={row.percent ?? ''} onChangeText={(percent) => updateRow(row.id, { percent })} keyboardType="decimal-pad" placeholder="%" placeholderTextColor={colors.muted} style={{ width: 64, color: colors.ink, fontWeight: '700', paddingVertical: 6 }} />
          </View>
        </View>
      ))}
      {!readOnly ? <Pressable accessibilityRole="button" accessibilityLabel="Add adjustment" onPress={() => onChange([...adjustments, { id: `a${Date.now()}`, label: '', kind: 'other', amount: '' }])} style={{ paddingVertical: 12, alignItems: 'center' }}><Text style={{ color: colors.ink, fontWeight: '900', fontSize: 12 }}>+ Add adjustment</Text></Pressable> : null}
      {showCharged ? <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '800' }}>Amount charged</Text> : null}
      {showCharged ? <TextInput accessibilityLabel="Amount charged" editable={!readOnly} value={charged} onChangeText={onCharged} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.muted} style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.paper, color: colors.ink, fontWeight: '900', fontSize: 20, paddingHorizontal: 12, paddingVertical: 10 }} /> : null}
      {showCharged && delta !== null ? delta === 0 ? <Text accessibilityLiveRegion="polite" style={{ color: colors.green, fontWeight: '800' }}>Total matches receipt ${formatCents(referenceCents ?? 0)}</Text> : <View style={{ backgroundColor: colors.coralSoft, borderRadius: 12, padding: 10, gap: 4 }}><Text accessibilityLiveRegion="polite" style={{ color: colors.reject, fontWeight: '800' }}>Off by ${formatCents(Math.abs(delta))}</Text><Text style={{ color: colors.ink, fontSize: 12, lineHeight: 18 }}>Check each item and adjustment, or type the amount on the card slip.</Text></View> : null}
    </View>
  );
}
