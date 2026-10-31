import { expect, it } from 'vitest';
import { countdownLabel, secondsCountdown } from './countdown';
it('formats hour boundaries without changing the countdown rounding', () => {
  expect([null, 0, 45, 59, 60, 61, 120, 135].map(countdownLabel)).toEqual(['—', '0 min', '45 min', '59 min', '1h', '1h 1m', '2h', '2h 15m']);
  expect(countdownLabel(59.2)).toBe('1h');
});
it('formats seconds and shows how long an overdue countdown has run', () => {
  expect(secondsCountdown(3661000)).toBe('01:01:01');
  expect(secondsCountdown(999)).toBe('00:00:01');
  expect(secondsCountdown(3600000)).toBe('01:00:00');
  expect(secondsCountdown(-1000)).toBe('−00:00:01');
  expect(secondsCountdown(-3661000)).toBe('−01:01:01');
  expect(countdownLabel(-1)).toBe('1 min late');
  expect(countdownLabel(-90)).toBe('1h 30m late');
  expect(countdownLabel(0)).toBe('0 min');
});
