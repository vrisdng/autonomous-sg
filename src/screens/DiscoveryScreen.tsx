import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Tab } from '../types';

type Topic = 'All' | 'Supper' | 'With friends' | 'Getting home';
const topics: Topic[] = ['All', 'Supper', 'With friends', 'Getting home'];
const posts = [
  { title: 'A bowl worth staying out for 🍜', note: 'Late-night noodles and the best kind of unhurried conversation.', author: 'Apple67 eats', likes: '128', topic: 'Supper', image: require('../../public/discover/noodles.jpg'), height: 254 },
  { title: 'The group chat said “anything”', note: 'A few good options make the decision so much easier.', author: 'Supper club', likes: '86', topic: 'With friends', image: require('../../public/discover/supper.jpg'), height: 214 },
  { title: 'One more plate before we go', note: 'Find the food, then make sure everyone can get home.', author: 'Apple67 eats', likes: '73', topic: 'Getting home', image: require('../../public/discover/rice.jpg'), height: 228 },
  { title: 'When nobody can pick a place', note: 'Let everyone swipe and see what the group actually likes.', author: 'The supper edit', likes: '214', topic: 'With friends', image: require('../../public/discover/bowls.jpg'), height: 268 },
  { title: 'The table is waiting', note: 'A cozy room, a free evening, and one invite for the whole group.', author: 'After hours', likes: '91', topic: 'With friends', image: require('../../public/discover/interior.jpg'), height: 206 },
  { title: 'Pizza plans, sorted 🍕', note: 'Share a shortlist and let your friends pick their favourite.', author: 'Supper club', likes: '176', topic: 'Supper', image: require('../../public/discover/pizza.jpg'), height: 252 },
  { title: 'The “just one more” order', note: 'Grilled bites for the friends who are never ready to call it a night.', author: 'Apple67 eats', likes: '142', topic: 'Supper', image: require('../../public/discover/grill.jpg'), height: 280 },
  { title: 'Everyone gets a favourite', note: 'Three plates, three opinions. Vote together before heading out.', author: 'The supper edit', likes: '65', topic: 'With friends', image: require('../../public/discover/spread.jpg'), height: 195 },
  { title: 'One slice before the ride', note: 'Finish dinner, then check how everyone is getting home.', author: 'After hours', likes: '118', topic: 'Getting home', image: require('../../public/discover/slice.jpg'), height: 270 },
  { title: 'The morning-after plan', note: 'Breakfast together is still a group decision.', author: 'Apple67 eats', likes: '82', topic: 'Getting home', image: require('../../public/discover/breakfast.jpg'), height: 236 },
  { title: 'Brunch is worth the trip', note: 'A stack to start the day. See the journey before you go.', author: 'Supper club', likes: '199', topic: 'Getting home', image: require('../../public/discover/pancakes.jpg'), height: 274 },
  { title: 'For the late dinner crew', note: 'A warm plate and a plan everyone can agree on.', author: 'The supper edit', likes: '109', topic: 'Supper', image: require('../../public/discover/plated.jpg'), height: 218 },
] as const;

export function DiscoveryScreen({ go, onParty }: { go: (tab: Tab) => void; onParty: () => void }) {
  const [topic, setTopic] = useState<Topic>('All');
  const visible = posts.filter(post => topic === 'All' || post.topic === topic);
  return <View style={styles.page}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topics} accessibilityLabel="Discovery topics">
      {topics.map(item => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: topic === item }} onPress={() => setTopic(item)} style={styles.topicButton}><Text style={[styles.topicText, topic === item && styles.topicActive]}>{item}</Text></Pressable>)}
    </ScrollView>

    <View style={styles.bridge}>
      <View style={styles.bridgeCopy}><Text style={styles.bridgeEyebrow}>INSPIRED TO GO OUT?</Text><Text style={styles.bridgeTitle}>Turn the scroll into a supper plan.</Text></View>
      <View style={styles.bridgeActions}>
        <Pressable accessibilityRole="button" onPress={onParty} style={styles.primaryButton}><Text style={styles.primaryText}>Plan & swipe with friends ↗</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => go('meet')} style={styles.secondaryButton}><Text style={styles.secondaryText}>Browse solo</Text></Pressable>
      </View>
    </View>

    <View style={styles.feedHeading}><Text style={styles.feedTitle}>{topic === 'All' ? 'For You' : topic}</Text><Text style={styles.demoBadge}>DEMO POSTS</Text></View>
    <View style={styles.grid}>
      {[visible.filter((_, index) => index % 2 === 0), visible.filter((_, index) => index % 2 === 1)].map((column, index) => <View key={index} style={styles.column}>
        {column.map(post => <Pressable key={post.title} accessibilityRole="button" accessibilityLabel={`${post.title}. Plan and swipe with friends in Apple67`} onPress={onParty} style={({ pressed }) => [styles.post, pressed && styles.pressed]}>
          <Image source={post.image} accessibilityLabel="Illustrative food photo" resizeMode="cover" style={[styles.photo, { height: post.height }]} />
          <Text style={styles.postTitle}>{post.title}</Text>
          <Text numberOfLines={2} style={styles.postNote}>{post.note}</Text>
          <View style={styles.postFoot}><View style={styles.avatar}><Text style={styles.avatarLetter}>{post.author[0]}</Text></View><Text numberOfLines={1} style={styles.author}>{post.author}</Text><Text style={styles.likes}>♡ {post.likes}</Text></View>
        </Pressable>)}
      </View>)}
    </View>

    <View style={styles.tools}>
      <Text style={styles.toolsEyebrow}>MAKE IT HAPPEN IN APPLE67</Text>
      <Text style={styles.toolsTitle}>Everything after “let's eat”</Text>
      <View style={styles.toolGrid}>
        <Tool icon="◎" title="Group swipe" onPress={onParty} />
        <Tool icon="↗" title="Invite friends" onPress={onParty} />
        <Tool icon="＄" title="Split the bill" onPress={() => go('split')} />
        <Tool icon="◇" title="Share a ride" onPress={() => go('ride')} />
        <Tool icon="⌁" title="Last Call" onPress={() => go('train')} />
      </View>
    </View>
    <Text style={styles.disclaimer}>Illustrative posts and photos for the demo. Restaurant results, votes and invites use Apple67's existing flows. Photos: Unsplash.</Text>
  </View>;
}

function Tool({ icon, title, onPress }: { icon: string; title: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [styles.tool, pressed && styles.pressed]}><Text style={styles.toolIcon}>{icon}</Text><Text style={styles.toolText}>{title}</Text><Text style={styles.toolArrow}>›</Text></Pressable>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#FFFFFF', gap: 15, paddingBottom: 28 },
  topics: { alignItems: 'center', gap: 22, paddingVertical: 4, paddingRight: 18 },
  topicButton: { paddingVertical: 7 }, topicText: { color: '#888888', fontSize: 14, fontWeight: '500' }, topicActive: { color: '#181818', fontWeight: '800' },
  bridge: { backgroundColor: '#FFFBE3', borderRadius: 14, borderWidth: 1, borderColor: '#F3EFCB', padding: 16, gap: 12 },
  bridgeCopy: { gap: 3 }, bridgeEyebrow: { color: '#776B2B', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  bridgeTitle: { color: '#151515', fontSize: 19, fontWeight: '900', letterSpacing: -0.3 },
  bridgeActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primaryButton: { backgroundColor: '#FFE900', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  primaryText: { color: '#141414', fontWeight: '900', fontSize: 12 },
  secondaryButton: { backgroundColor: '#FFFFFF', borderColor: '#E7E3CE', borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  secondaryText: { color: '#272727', fontWeight: '800', fontSize: 12 },
  feedHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 2, marginTop: 2 },
  feedTitle: { color: '#111111', fontSize: 20, fontWeight: '900' },
  demoBadge: { color: '#777777', fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  grid: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, column: { flex: 1, gap: 19 },
  post: { gap: 6 }, photo: { width: '100%', borderRadius: 12, backgroundColor: '#EEEEEE' },
  postTitle: { color: '#161616', fontSize: 15, lineHeight: 20, fontWeight: '800', paddingHorizontal: 4 },
  postNote: { color: '#555555', fontSize: 11, lineHeight: 16, paddingHorizontal: 4 },
  postFoot: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, marginTop: 2 },
  avatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFE900', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 10, fontWeight: '900', color: '#111111' },
  author: { color: '#666666', fontSize: 10, flex: 1 }, likes: { color: '#666666', fontSize: 11 },
  pressed: { opacity: 0.65 },
  tools: { borderTopWidth: 1, borderTopColor: '#EAEAEA', marginTop: 12, paddingTop: 22, gap: 9 },
  toolsEyebrow: { color: '#777777', fontSize: 10, letterSpacing: 1.1, fontWeight: '800' },
  toolsTitle: { color: '#141414', fontSize: 22, fontWeight: '900' },
  toolGrid: { gap: 1, marginTop: 5 },
  tool: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#EEEEEE', gap: 14 },
  toolIcon: { width: 26, textAlign: 'center', color: '#141414', fontSize: 22, fontWeight: '700' },
  toolText: { color: '#222222', fontSize: 14, fontWeight: '700', flex: 1 }, toolArrow: { color: '#888888', fontSize: 23 },
  disclaimer: { color: '#888888', fontSize: 10, lineHeight: 16 },
});
