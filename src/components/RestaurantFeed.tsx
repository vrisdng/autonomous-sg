import { useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Place } from '../types';
import { Choice } from '../features/meet/swipes';
import { hoursAt } from '../features/meet/googlePlace';
import { colors } from '../theme';
import { RestaurantDetails, RestaurantPhoto, VenueRating } from './RestaurantMedia';
import { CloseButton } from './Ui';

type FeedProps = {
  visible: boolean;
  places: Place[];
  choices: Record<string, Choice>;
  startId?: string;
  meetupAt?: string;
  busy: boolean;
  disabled: boolean;
  onClose: () => void;
  onVote: (place: Place, choice: Choice) => Promise<boolean>;
  onTopThree: () => void;
};

export function RestaurantFeed({ visible, places, choices, startId, meetupAt, busy, disabled, onClose, onVote, onTopThree }: FeedProps) {
  const list = useRef<FlatList<Place>>(null);
  const [pageHeight, setPageHeight] = useState(0);
  const [details, setDetails] = useState<Place>();
  const startIndex = Math.max(0, places.findIndex(place => place.id === startId));
  useEffect(() => {
    if (!visible || !pageHeight || !places.length) return;
    const frame = requestAnimationFrame(() => list.current?.scrollToIndex({ index: startIndex, animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [visible, pageHeight, startId, places.length]);
  const vote = async (place: Place, choice: Choice, index: number) => {
    if (busy || disabled) return;
    if (await onVote(place, choice) && index + 1 < places.length) {
      list.current?.scrollToIndex({ index: index + 1, animated: true });
    }
  };
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <Pressable accessibilityRole="button" accessibilityLabel="Close restaurant popup" onPress={onClose} style={{ ...StyleSheet.absoluteFillObject, backgroundColor: '#00000099' }} />
    <View style={{ width: '96%', height: '94%', maxWidth: 720, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.paper, paddingTop: 24 }}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View><Text style={{ fontSize: 22, fontWeight: '900', color: colors.ink }}>Explore places</Text><Text style={{ color: colors.muted, fontSize: 12 }}>Swipe up to browse · tap a photo for details</Text></View>
        <CloseButton label="Close restaurant feed" onPress={onClose} />
      </View>
      <View style={{ flex: 1 }} onLayout={event => setPageHeight(event.nativeEvent.layout.height)}>
        {pageHeight > 0 ? <FlatList
          ref={list}
          data={places}
          keyExtractor={place => place.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          getItemLayout={(_, index) => ({ length: pageHeight, offset: pageHeight * index, index })}
          onScrollToIndexFailed={info => list.current?.scrollToOffset({ offset: info.index * pageHeight, animated: false })}
          renderItem={({ item: place, index }) => {
            const choice = choices[place.id];
            return <View style={{ height: pageHeight, paddingHorizontal: 16, paddingBottom: 12 }}>
              <View style={{ flex: 1, backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1, borderRadius: 24, padding: 12, gap: 8 }}>
                <Pressable accessibilityRole="button" accessibilityLabel={`View photos and reviews for ${place.name}`} onPress={() => setDetails(place)} style={{ flex: 1, minHeight: 190 }}>
                  <RestaurantPhoto place={place} fill />
                </Pressable>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>{index + 1} / {places.length} · {place.area}</Text>
                <Text numberOfLines={2} style={{ color: colors.ink, fontSize: 24, fontWeight: '900' }}>{place.name}</Text>
                <VenueRating place={place} style={{ color: colors.ink, fontSize: 14, fontWeight: '700' }} />
                <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>{place.address}</Text>
                <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 12 }}>{hoursAt(place, meetupAt).label}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  {([['pass', 'Pass', '✕'], ['neutral', 'Okay', '↑'], ['like', 'Like', '♥']] as const).map(([value, label, icon]) => <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityLabel={`${label} ${place.name}`}
                    accessibilityState={{ selected: choice === value, disabled: busy || disabled }}
                    disabled={busy || disabled}
                    onPress={() => void vote(place, value, index)}
                    style={({ pressed }) => ({ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 15, borderWidth: 1, borderColor: choice === value ? colors.ink : colors.line, backgroundColor: choice === value ? colors.blush : colors.paper, opacity: pressed ? 0.7 : busy || disabled ? 0.45 : 1 })}>
                    <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 15 }}>{icon} {label}</Text>
                  </Pressable>)}
                </View>
                <Text style={{ color: colors.muted, fontSize: 11, textAlign: 'center' }}>{choice ? `Your choice: ${choice}` : 'Choose one, or swipe up to keep browsing'}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => { onClose(); onTopThree(); }} style={{ alignSelf: 'center', padding: 12 }}><Text style={{ color: colors.ink, fontWeight: '800' }}>See group Top 3 ↗</Text></Pressable>
            </View>;
          }}
        /> : null}
      </View>
      <RestaurantDetails place={details} onClose={() => setDetails(undefined)} />
    </View>
    </View>
  </Modal>;
}
