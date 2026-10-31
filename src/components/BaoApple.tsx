import { Ellipse, Path } from 'react-native-svg';
import { BAO_INK } from './baoArt';

/** Shared apple silhouette; callers keep their animated eyes and expressions. */
export function BaoApple() {
  return <>
    <Path d="M60 28 Q60 17 68 12" fill="none" stroke={BAO_INK} strokeWidth={5} strokeLinecap="round" />
    <Path d="M65 17 C61 5 75 2 80 5 C83 14 74 20 65 17 Z" fill="#278C32" stroke={BAO_INK} strokeWidth={4.5} strokeLinejoin="round" />
    <Path d="M20 69 C5 64 4 85 13 91 L25 90 M95 69 C111 63 118 82 107 92 L94 90" fill="#FFF0B3" stroke={BAO_INK} strokeWidth={5} strokeLinejoin="round" />
    <Path d="M60 28 C40 16 21 27 16 48 C7 76 15 103 34 113 C44 119 53 113 60 114 C72 120 87 114 96 102 C108 85 108 55 98 38 C89 22 75 21 60 28 Z" fill="#D91C23" stroke={BAO_INK} strokeWidth={5} strokeLinejoin="round" />
    <Ellipse cx={39} cy={43} rx={14} ry={10} fill="#EC494D" transform="rotate(-25 39 43)" />
    <Path d="M31 108 C38 103 51 105 55 114 C61 129 48 134 38 129 C29 126 25 115 31 108 Z M67 109 C76 104 89 108 91 117 C94 130 81 134 72 129 C64 125 61 114 67 109 Z" fill="#FFF0B3" stroke={BAO_INK} strokeWidth={5} strokeLinejoin="round" />
  </>;
}
