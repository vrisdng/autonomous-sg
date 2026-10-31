/**
 * Mix B. Latte foam page, milk cards, warmer tiles.
 * Peach is the wordmark mark, selected nav, primary actions, and the Last Call leave-by card.
 * Blush is the Home Bao card and selected chips.
 * Mint is bao leaves and tiny success ticks only.
 */
export const colors = {
  /** Dark roast for text and dark banners. */
  ink: '#2B211C',
  /** Warm taupe derived from ink. Readable on foam, milk, and tile. */
  muted: '#5C463C',
  /** Latte foam page. */
  paper: '#F3EBE3',
  /** Milk cards and surfaces. */
  card: '#FAF4ED',
  /** Peach. Wordmark, selected nav, primary actions, and the leave-by card. */
  coral: '#FF9D84',
  /** Light oat wash for messages. Not a chip. */
  coralSoft: '#E8D9C8',
  /** Warmer tile. Quiet chips and unselected fills. */
  lime: '#D4B79A',
  /** Deeper edge on tile fills. */
  limeLine: '#CDB89F',
  /** Warmer tile for home tiles, photo placeholders, and secondary chips. */
  bambooSoft: '#D4B79A',
  /** Blush. Home Bao card and selected chips only. */
  blush: '#F7D6DC',
  /** Mint. Bao leaves and tiny success ticks only. */
  mint: '#9FCFC0',
  /** Warm hairline. */
  line: '#E4D6C8',
  /** Dark roast emphasis. Same family as ink, not a second accent. */
  green: '#3A2C26',
  /** Dark clay for remove / pass / close. Ink family, not a rose. */
  reject: '#5C3D36',
  rejectSoft: '#E8D9C8',
  rejectLine: '#D2C0AC',
  rejectPressed: '#DDD0C2',
} as const;

export const shadow = {
  shadowColor: '#2B211C',
  shadowOffset: { width: 0, height: 5 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
};
