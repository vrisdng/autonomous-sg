import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BaoFace } from '../components/BaoFeatureMenu';
import { FeedView } from '../components/DiscoveryNav';
import { Post, posts, Topic, topics } from '../data/feedPosts';

export type { Post };
type FeedPage = Exclude<FeedView, 'compose'>;

const toggled = (set: Set<string>, value: string) => { const next = new Set(set); if (next.has(value)) next.delete(value); else next.add(value); return next; };
const count = (value: number) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
const avatarTints = ['#FFE900', '#FFD9CF', '#CFEFD9', '#CFE3FF', '#E6D8FF'];
const avatarTint = (name: string) => avatarTints[name.length % avatarTints.length];

function Avatar({ name, size }: { name: string; size: number }) {
  return <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: avatarTint(name) }]}><Text style={[styles.avatarLetter, { fontSize: size * 0.5 }]}>{name[0]}</Text></View>;
}

function Cover({ post, height, large }: { post: Post; height: number; large?: boolean }) {
  if (post.image) return <Image source={post.image} accessibilityLabel="Illustrative food photo" resizeMode="cover" style={[styles.photo, { height }]} />;
  return <View style={[styles.textCover, { height, backgroundColor: post.tint }]}><Text numberOfLines={large ? undefined : 5} style={[styles.textCoverTitle, large && styles.textCoverLarge]}>{post.title}</Text></View>;
}

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
  const [saved, setSaved] = useState<Set<string>>(() => new Set());
  const [following, setFollowing] = useState<Set<string>>(() => new Set());
  const words = query.toLocaleLowerCase();
  const visible = posts.filter(post => (topic === 'All' || post.topic === topic) && (view !== 'search' || `${post.title} ${post.note} ${post.author} ${post.tags.join(' ')}`.toLocaleLowerCase().includes(words)));
  const likedPosts = posts.filter(post => liked.has(post.title));
  const savedPosts = posts.filter(post => saved.has(post.title));
  const likes = (post: Post) => post.likes + (liked.has(post.title) ? 1 : 0);
  const saves = (post: Post) => post.saves + (saved.has(post.title) ? 1 : 0);
  const moreLikeThis = selected ? posts.filter(post => post.topic === selected.topic && post.title !== selected.title).slice(0, 4) : [];
  const rows = (list: Post[]) => list.map(post => <Pressable key={post.title} accessibilityRole="button" onPress={() => onSelect(post)} style={styles.listRow}><Text style={styles.listTitle}>{post.title}</Text><Text style={styles.listArrow}>›</Text></Pressable>);

  return <View style={styles.page}>
    {view === 'home' || view === 'search' ? <>
      {view === 'search' ? <TextInput accessibilityLabel="Search discovery posts" placeholder="Search food, places, #tags" value={query} onChangeText={setQuery} style={styles.searchInput} /> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topics} accessibilityLabel="Discovery topics">
        {topics.map(item => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: topic === item }} onPress={() => setTopic(item)} style={styles.topicButton}><Text style={[styles.topicText, topic === item && styles.topicActive]}>{item}</Text></Pressable>)}
      </ScrollView>
      {visible.length ? <View style={styles.grid}>
        {[visible.filter((_, index) => index % 2 === 0), visible.filter((_, index) => index % 2 === 1)].map((column, index) => <View key={index} style={styles.column}>
          {column.map(post => <View key={post.title} style={styles.post}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Open post: ${post.title}`} onPress={() => onSelect(post)} style={({ pressed }) => [styles.postLink, pressed && styles.pressed]}>
              <Cover post={post} height={post.height} />
              {post.image ? <Text numberOfLines={2} style={styles.postTitle}>{post.title}</Text> : null}
            </Pressable>
            <View style={styles.postFoot}>
              <Avatar name={post.author} size={20} />
              <Text numberOfLines={1} style={styles.author}>{post.author}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`${liked.has(post.title) ? 'Unlike' : 'Like'} ${post.title}`} onPress={() => setLiked(previous => toggled(previous, post.title))} hitSlop={8}><Text style={[styles.likes, liked.has(post.title) && styles.likesOn]}>{liked.has(post.title) ? '♥' : '♡'} {count(likes(post))}</Text></Pressable>
            </View>
          </View>)}
        </View>)}
      </View> : <Text style={styles.empty}>No posts match that. Try a food, a place or a #tag.</Text>}
      <Text style={styles.disclaimer}>Illustrative posts and photos for the demo. Photos: Unsplash.</Text>
    </> : null}
    {view === 'activity' ? <View style={styles.simplePage}><Text style={styles.simpleTitle}>Activity</Text><Text style={styles.simpleCopy}>Your liked posts in this demo</Text>{likedPosts.length ? rows(likedPosts) : <Text style={styles.empty}>No activity yet. Explore the feed and tap a heart.</Text>}</View> : null}
    {view === 'profile' ? <View style={styles.simplePage}><View style={styles.profileAvatar}><Text style={styles.profileLetter}>A</Text></View><Text style={styles.simpleTitle}>My profile</Text><Text style={styles.simpleCopy}>A local demo profile for exploring the feed.</Text><View style={styles.profileStats}><Text style={styles.stat}>{following.size} following</Text><Text style={styles.stat}>{liked.size} liked</Text><Text style={styles.stat}>{saved.size} saved</Text></View><Text style={styles.sectionTitle}>Saved posts</Text>{savedPosts.length ? rows(savedPosts) : <Text style={styles.empty}>Posts you save will appear here.</Text>}<Text style={styles.sectionTitle}>Liked posts</Text>{likedPosts.length ? rows(likedPosts) : <Text style={styles.empty}>Posts you like will appear here.</Text>}</View> : null}
    <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => onSelect(undefined)}>
      <View style={styles.modal}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close post popup" onPress={() => onSelect(undefined)} style={styles.scrim} />
        <View style={styles.sheet}>
          {selected ? <>
            <View style={styles.sheetHeader}>
              <Avatar name={selected.author} size={36} />
              <View style={styles.sheetAuthor}><Text numberOfLines={1} style={styles.detailAuthor}>{selected.author}</Text><Text style={styles.detailAgo}>{selected.ago} ago</Text></View>
              <Pressable accessibilityRole="button" accessibilityState={{ selected: following.has(selected.author) }} onPress={() => setFollowing(previous => toggled(previous, selected.author))} style={[styles.follow, following.has(selected.author) && styles.followOn]}><Text style={styles.followText}>{following.has(selected.author) ? 'Following' : 'Follow'}</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Close post" onPress={() => onSelect(undefined)} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>
            </View>
            <ScrollView key={selected.title} style={styles.sheetScroll} contentContainerStyle={styles.detailContent}>
              <Cover post={selected} height={selected.image ? 360 : 260} large />
              {selected.image ? <Text style={styles.detailTitle}>{selected.title}</Text> : null}
              <Text style={styles.detailNote}>{selected.body}</Text>
              <View style={styles.tags}>{selected.tags.map(tag => <Text key={tag} style={styles.tag}>#{tag}</Text>)}</View>
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" accessibilityLabel={liked.has(selected.title) ? 'Unlike post' : 'Like post'} onPress={() => setLiked(previous => toggled(previous, selected.title))} style={[styles.action, liked.has(selected.title) && styles.actionOn]}><Text style={styles.actionText}>{liked.has(selected.title) ? '♥' : '♡'} {count(likes(selected))}</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={saved.has(selected.title) ? 'Unsave post' : 'Save post'} onPress={() => setSaved(previous => toggled(previous, selected.title))} style={[styles.action, saved.has(selected.title) && styles.actionOn]}><Text style={styles.actionText}>{saved.has(selected.title) ? '★' : '☆'} {count(saves(selected))}</Text></Pressable>
                <View style={styles.action}><Text style={styles.actionText}>💬 {selected.comments.length}</Text></View>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Jio friends with Bao" onPress={() => onJio(selected)} style={({ pressed }) => [styles.jio, pressed && styles.pressed]}><BaoFace size={38} /><View style={styles.jioCopy}><Text style={styles.jioTitle}>Jio friends with Bao</Text><Text style={styles.jioDetail}>Share this post, then swipe the restaurant shortlist together</Text></View><Text style={styles.jioArrow}>›</Text></Pressable>
              {selected.topic === 'Getting home' ? <Pressable accessibilityRole="button" accessibilityLabel="Check the trip home" onPress={() => onTripHome(selected)} style={({ pressed }) => [styles.tripHome, pressed && styles.pressed]}><Text style={styles.tripHomeText}>Check the trip home ›</Text></Pressable> : null}
              <Text style={styles.sectionTitle}>Comments</Text>
              {selected.comments.map(([who, text]) => <View key={who + text} style={styles.comment}><Avatar name={who} size={28} /><View style={styles.commentCopy}><Text style={styles.commentName}>{who}</Text><Text style={styles.commentText}>{text}</Text></View></View>)}
              <Text style={styles.sectionTitle}>More like this</Text>
              <View style={styles.more}>{moreLikeThis.map(post => <Pressable key={post.title} accessibilityRole="button" accessibilityLabel={`Open post: ${post.title}`} onPress={() => onSelect(post)} style={({ pressed }) => [styles.moreItem, pressed && styles.pressed]}><Cover post={post} height={130} /><Text numberOfLines={2} style={styles.moreTitle}>{post.title}</Text></Pressable>)}</View>
              <Text style={styles.disclaimer}>Illustrative post for the Apple67 demo.</Text>
            </ScrollView>
          </> : null}
        </View>
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#FFFFFF', gap: 12, paddingBottom: 28, minHeight: 400 },
  topics: { alignItems: 'center', gap: 22, paddingVertical: 4, paddingRight: 18 },
  topicButton: { paddingVertical: 7 }, topicText: { color: '#888888', fontSize: 14, fontWeight: '500' }, topicActive: { color: '#181818', fontWeight: '800' },
  searchInput: { marginTop: 10, marginHorizontal: 2, paddingHorizontal: 15, height: 45, borderRadius: 22, backgroundColor: '#F4F4F4', fontSize: 14 },
  grid: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, column: { flex: 1, gap: 18 },
  post: { gap: 6 }, postLink: { gap: 6 }, photo: { width: '100%', borderRadius: 12, backgroundColor: '#EEEEEE' },
  textCover: { width: '100%', borderRadius: 12, padding: 16, justifyContent: 'center' },
  textCoverTitle: { color: '#161616', fontSize: 19, lineHeight: 24, fontWeight: '900' }, textCoverLarge: { fontSize: 30, lineHeight: 36 },
  postTitle: { color: '#161616', fontSize: 15, lineHeight: 20, fontWeight: '800', paddingHorizontal: 4 },
  postFoot: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontWeight: '900', color: '#111111', textTransform: 'uppercase' },
  author: { color: '#666666', fontSize: 11, flex: 1 }, likes: { color: '#666666', fontSize: 12 }, likesOn: { color: '#111111', fontWeight: '800' },
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
  sectionTitle: { color: '#222222', fontSize: 17, fontWeight: '800', marginTop: 14 },
  modal: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000099' },
  sheet: { width: '96%', height: '94%', maxWidth: 720, borderRadius: 22, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  sheetHeader: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 8, borderBottomWidth: 1, borderBottomColor: '#EFEFEF' },
  sheetAuthor: { flex: 1 }, detailAuthor: { color: '#161616', fontSize: 14, fontWeight: '800' }, detailAgo: { color: '#888888', fontSize: 11, marginTop: 1 },
  follow: { backgroundColor: '#FFE900', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 }, followOn: { backgroundColor: '#F1F1F1' }, followText: { color: '#111111', fontSize: 13, fontWeight: '800' },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, closeText: { fontSize: 28, color: '#222222' },
  sheetScroll: { flex: 1 }, detailContent: { padding: 16, gap: 12 },
  detailTitle: { color: '#161616', fontSize: 24, lineHeight: 30, fontWeight: '900' }, detailNote: { color: '#333333', fontSize: 16, lineHeight: 24 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, tag: { color: '#76680A', fontSize: 14, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8 }, action: { flex: 1, minHeight: 44, borderRadius: 14, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' }, actionOn: { backgroundColor: '#FFE900' }, actionText: { color: '#111111', fontSize: 14, fontWeight: '800' },
  jio: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF9C2', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  jioCopy: { flex: 1 }, jioTitle: { color: '#111111', fontSize: 16, fontWeight: '900' }, jioDetail: { color: '#555555', fontSize: 12, lineHeight: 17, marginTop: 2 }, jioArrow: { color: '#555555', fontSize: 25 },
  tripHome: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }, tripHomeText: { color: '#333333', fontSize: 14, fontWeight: '800' },
  comment: { flexDirection: 'row', gap: 10 }, commentCopy: { flex: 1 }, commentName: { color: '#555555', fontSize: 12, fontWeight: '700' }, commentText: { color: '#222222', fontSize: 14, lineHeight: 20, marginTop: 1 },
  more: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, moreItem: { width: '48.5%', gap: 5 }, moreTitle: { color: '#161616', fontSize: 13, lineHeight: 18, fontWeight: '800' },
});
