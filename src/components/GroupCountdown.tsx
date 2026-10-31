import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { clock } from '../features/travel/types';
import { secondsCountdown } from '../features/train/countdown';
import { colors } from '../theme';

export function GroupCountdown({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  // Absolute time avoids drift after the phone sleeps. A past leave-by stays on screen as time overdue.
  if (!Number.isFinite(deadline)) return null;
  const overdue = deadline <= now;
  // Peach marks the shared leave-by. Ink on #FF9D84 stays readable; other tiles stay the warmer tile.
  return <View style={{ backgroundColor: colors.coral, borderColor: colors.ink, borderWidth: 2, borderRadius: 18, padding: 18, gap: 5 }}>
    <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 16 }}>TOGETHER · LEAVE BY</Text>
    <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 20 }}>{clock(new Date(deadline).toISOString())}</Text>
    <Text accessibilityLabel={overdue ? 'Group leave-by overdue' : 'Group leave-by countdown'} accessibilityLiveRegion="none" style={{ color: colors.ink, fontSize: 42, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: 1 }}>{secondsCountdown(deadline - now)}</Text>
    <Text style={{ color: colors.ink, fontSize: 12 }}>{overdue ? 'hours : minutes : seconds overdue' : 'hours : minutes : seconds left to leave'}</Text>
  </View>;
}
