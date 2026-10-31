import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BaoFace } from '../components/BaoFeatureMenu';
import { FeedView } from '../components/DiscoveryNav';

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

type FeedPage = Exclude<FeedView, 'compose'>;
export type Post = (typeof posts)[number];

export function DiscoveryScreen({ view, selected, onSelect, onJio, onTripHome }: {
  view: FeedPage;
  selected?: Post;
  onSelect: (post?: Post) => void;
  onJio: (post: Post) => void;
  onTripHome: (post: Post) => void;
}) {
  const [topic, setTopic] = useState<Topic>('All');
  const [query, setQuery] = useState('');
  const [liked, setLiked] = useState<Set<string>>(() => new Set());
  const toggleLike = (title: string) => setLiked(previous => { const next = new Set(previous); if (next.has(title)) next.delete(title); else next.add(title); return next; });
  const visible = posts.filter(post => (topic === 'All' || post.topic === topic) && (view !== 'search' || `${post.title} ${post.note}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())));
  const likedPosts = posts.filter(post => liked.has(post.title));

  return <View style={styles.page}>
    {view === 'home' || view === 'search' ? <>
      {view === 'search' ? <TextInput accessibilityLabel="Search discovery posts" placeholder="Search food, places, ideas" value={query} onChangeText={setQuery} style={styles.searchInput} /> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topics} accessibilityLabel="Discovery topics">
        {topics.map(item => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: topic === item }} onPress={() => setTopic(item)} style={styles.topicButton}><Text style={[styles.topicText, topic === item && styles.topicActive]}>{item}</Text></Pressable>)}
      </ScrollView>
      <View style={styles.feedHeading}><Text style={styles.feedTitle}>{view === 'search' ? 'Explore' : topic === 'All' ? 'For You' : topic}</Text></View>
      {visible.length ? <View style={styles.grid}>
        {[visible.filter((_, index) => index % 2 === 0), visible.filter((_, index) => index % 2 === 1)].map((column, index) => <View key={index} style={styles.column}>
          {column.map(post => <Pressable key={post.title} accessibilityRole="button" accessibilityLabel={`Open post: ${post.title}`} onPress={() => onSelect(post)} style={({ pressed }) => [styles.post, pressed && styles.pressed]}>
            <Image source={post.image} accessibilityLabel="Illustrative food photo" resizeMode="cover" style={[styles.photo, { height: post.height }]} />
            <Text style={styles.postTitle}>{post.title}</Text>
            <Text numberOfLines={2} style={styles.postNote}>{post.note}</Text>
            <View style={styles.postFoot}><View style={styles.avatar}><Text style={styles.avatarLetter}>{post.author[0]}</Text></View><Text numberOfLines={1} style={styles.author}>{post.author}</Text><Text style={styles.likes}>{liked.has(post.title) ? '♥' : '♡'} {post.likes}</Text></View>
          </Pressable>)}
        </View>)}
      </View> : <Text style={styles.empty}>No posts match that search.</Text>}
      <Text style={styles.disclaimer}>Illustrative posts and photos for the demo. Photos: Unsplash.</Text>
    </> : null}
    {view === 'activity' ? <View style={styles.simplePage}><Text style={styles.simpleTitle}>Activity</Text><Text style={styles.simpleCopy}>Your liked posts in this demo</Text>{likedPosts.length ? likedPosts.map(post => <Pressable key={post.title} onPress={() => onSelect(post)} style={styles.listRow}><Text style={styles.listTitle}>{post.title}</Text><Text style={styles.listArrow}>›</Text></Pressable>) : <Text style={styles.empty}>No activity yet. Explore the feed and tap a heart.</Text>}</View> : null}
    {view === 'profile' ? <View style={styles.simplePage}><View style={styles.profileAvatar}><Text style={styles.profileLetter}>A</Text></View><Text style={styles.simpleTitle}>My profile</Text><Text style={styles.simpleCopy}>A local demo profile for exploring the feed.</Text><View style={styles.profileStats}><Text style={styles.stat}>{liked.size} liked posts</Text><Text style={styles.stat}>0 published</Text></View><Text style={styles.sectionTitle}>Liked posts</Text>{likedPosts.length ? likedPosts.map(post => <Pressable key={post.title} onPress={() => onSelect(post)} style={styles.listRow}><Text style={styles.listTitle}>{post.title}</Text><Text style={styles.listArrow}>›</Text></Pressable>) : <Text style={styles.empty}>Posts you like will appear here.</Text>}</View> : null}
    <Modal visible={!!selected} animationType="slide" onRequestClose={() => onSelect(undefined)}>
      <ScrollView style={styles.detail} contentContainerStyle={styles.detailContent}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close post" onPress={() => onSelect(undefined)} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>
        {selected ? <><Image source={selected.image} resizeMode="cover" style={styles.detailPhoto} /><Text style={styles.detailTitle}>{selected.title}</Text><Text style={styles.detailNote}>{selected.note}</Text><View style={styles.detailFoot}><Text style={styles.detailAuthor}>{selected.author}</Text><Pressable accessibilityRole="button" accessibilityLabel={liked.has(selected.title) ? 'Unlike post' : 'Like post'} onPress={() => toggleLike(selected.title)} style={styles.likeButton}><Text style={styles.likeText}>{liked.has(selected.title) ? '♥ Liked' : '♡ Like'}</Text></Pressable></View><Pressable accessibilityRole="button" accessibilityLabel="Jio friends with Bao" onPress={() => onJio(selected)} style={({ pressed }) => [styles.jio, pressed && styles.pressed]}><BaoFace size={38} /><View style={styles.jioCopy}><Text style={styles.jioTitle}>Jio friends with Bao</Text><Text style={styles.jioDetail}>Share this post, then swipe the restaurant shortlist together</Text></View><Text style={styles.jioArrow}>›</Text></Pressable>{selected.topic === 'Getting home' ? <Pressable accessibilityRole="button" accessibilityLabel="Check the trip home" onPress={() => onTripHome(selected)} style={({ pressed }) => [styles.tripHome, pressed && styles.pressed]}><Text style={styles.tripHomeText}>Check the trip home ›</Text></Pressable> : null}<Text style={styles.disclaimer}>Illustrative post for the Apple67 demo.</Text></> : null}
      </ScrollView>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#FFFFFF', gap: 15, paddingBottom: 28, minHeight: 400 },
  topics: { alignItems: 'center', gap: 22, paddingVertical: 4, paddingRight: 18 },
  topicButton: { paddingVertical: 7 }, topicText: { color: '#888888', fontSize: 14, fontWeight: '500' }, topicActive: { color: '#181818', fontWeight: '800' },
  searchInput: { marginTop: 10, marginHorizontal: 2, paddingHorizontal: 15, height: 45, borderRadius: 22, backgroundColor: '#F4F4F4', fontSize: 14 },
  feedHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 2, marginTop: 2 },
  feedTitle: { color: '#111111', fontSize: 20, fontWeight: '900' },
  grid: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, column: { flex: 1, gap: 19 },
  post: { gap: 6 }, photo: { width: '100%', borderRadius: 12, backgroundColor: '#EEEEEE' },
  postTitle: { color: '#161616', fontSize: 15, lineHeight: 20, fontWeight: '800', paddingHorizontal: 4 },
  postNote: { color: '#555555', fontSize: 11, lineHeight: 16, paddingHorizontal: 4 },
  postFoot: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, marginTop: 2 },
  avatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFE900', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 10, fontWeight: '900', color: '#111111' },
  author: { color: '#666666', fontSize: 10, flex: 1 }, likes: { color: '#666666', fontSize: 11 },
  pressed: { opacity: 0.65 },
  disclaimer: { color: '#888888', fontSize: 10, lineHeight: 16, paddingHorizontal: 2, marginTop: 8 },
  simplePage: { paddingHorizontal: 8, paddingTop: 26, gap: 10 },
  simpleTitle: { fontSize: 27, fontWeight: '900', color: '#181818' },
  simpleCopy: { fontSize: 14, color: '#666666' },
  empty: { paddingVertical: 36, color: '#777777', fontSize: 14, textAlign: 'center' },
  listRow: { minHeight: 54, borderBottomWidth: 1, borderBottomColor: '#EEEEEE', flexDirection: 'row', alignItems: 'center' },
  listTitle: { color: '#222222', fontSize: 14, fontWeight: '700', flex: 1 }, listArrow: { color: '#888888', fontSize: 24 },
  profileAvatar: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#FFE900', alignItems: 'center', justifyContent: 'center' },
  profileLetter: { color: '#111111', fontSize: 29, fontWeight: '900' },
  profileStats: { flexDirection: 'row', gap: 16, paddingVertical: 16 }, stat: { color: '#333333', fontSize: 13, fontWeight: '700' },
  sectionTitle: { color: '#222222', fontSize: 17, fontWeight: '800', marginTop: 20 },
  detail: { flex: 1, backgroundColor: '#FFFFFF' }, detailContent: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, gap: 14 },
  close: { alignSelf: 'flex-start', width: 40, height: 36, justifyContent: 'center' }, closeText: { fontSize: 30, color: '#222222' },
  detailPhoto: { width: '100%', height: 380, borderRadius: 14, backgroundColor: '#EEEEEE' },
  detailTitle: { color: '#161616', fontSize: 25, fontWeight: '900' }, detailNote: { color: '#444444', fontSize: 16, lineHeight: 24 },
  detailFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, detailAuthor: { color: '#555555', fontSize: 13, fontWeight: '700' },
  likeButton: { backgroundColor: '#FFE900', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 }, likeText: { color: '#111111', fontWeight: '800' },
  jio: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF9C2', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  jioCopy: { flex: 1 }, jioTitle: { color: '#111111', fontSize: 16, fontWeight: '900' }, jioDetail: { color: '#555555', fontSize: 12, lineHeight: 17, marginTop: 2 }, jioArrow: { color: '#555555', fontSize: 25 },
  tripHome: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }, tripHomeText: { color: '#333333', fontSize: 14, fontWeight: '800' },
});
