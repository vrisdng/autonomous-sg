import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

const gallery = [
  require('../../public/discover/noodles.jpg'), require('../../public/discover/supper.jpg'), require('../../public/discover/pizza.jpg'),
  require('../../public/discover/bowls.jpg'), require('../../public/discover/grill.jpg'), require('../../public/discover/rice.jpg'),
  require('../../public/discover/interior.jpg'), require('../../public/discover/spread.jpg'), require('../../public/discover/pancakes.jpg'),
];

export function CreatePostScreen({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'post' | 'text'>('post');
  const [selected, setSelected] = useState<number>();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [preview, setPreview] = useState(false);
  const [notice, setNotice] = useState('');
  const resetMode = (next: 'post' | 'text') => { setMode(next); setEditing(false); setPreview(false); setNotice(''); };
  return <View style={[styles.page, mode === 'text' && styles.textPage]}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close create post" onPress={onClose} style={styles.close}><Text style={[styles.closeText, mode === 'text' && styles.darkText]}>×</Text></Pressable>
      <Text style={[styles.heading, mode === 'text' && styles.darkText]}>{mode === 'text' ? 'Create text post' : editing ? 'New post' : 'Create post'}</Text>
      {mode === 'post' && selected !== undefined && !editing ? <Pressable accessibilityRole="button" onPress={() => setEditing(true)} style={styles.next}><Text style={styles.nextText}>Next</Text></Pressable> : <View style={styles.headerSpace} />}
    </View>
    {mode === 'post' && !editing ? <>
      <View style={styles.actions}><Pressable accessibilityRole="button" onPress={() => setNotice('Choose a demo photo below to preview a post template.')} style={styles.action}><Text style={styles.actionText}>▣  Templates</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setNotice('Camera is not connected in this web demo. Choose a photo below.')} style={styles.action}><Text style={styles.actionText}>▣  Camera</Text></Pressable></View>
      <View style={styles.galleryTabs}><Text style={styles.galleryActive}>Recents⌄</Text><Text style={styles.galleryActive}>All</Text><Text style={styles.galleryMuted}>Photos</Text><Text style={styles.galleryMuted}>Videos</Text></View>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <ScrollView contentContainerStyle={styles.gallery}>
        {gallery.map((source, index) => <Pressable key={index} accessibilityRole="button" accessibilityLabel={`Select demo photo ${index + 1}`} onPress={() => setSelected(index)} style={styles.tile}><Image source={source} style={styles.tilePhoto} /><View style={[styles.check, selected === index && styles.checked]}><Text style={styles.checkText}>{selected === index ? '✓' : ''}</Text></View></Pressable>)}
      </ScrollView>
      <Text style={styles.demoNote}>Demo photo gallery · no upload or publishing</Text>
    </> : null}
    {mode === 'text' || editing ? <ScrollView contentContainerStyle={styles.editor}>
      {mode === 'post' && selected !== undefined ? <Image source={gallery[selected]} style={styles.editorPhoto} /> : <View style={styles.textCanvas}><Text style={styles.canvasText}>{title || 'Your story starts here'}</Text></View>}
      <TextInput accessibilityLabel="Post title" placeholder="Add a title" value={title} onChangeText={setTitle} style={styles.input} />
      <TextInput accessibilityLabel="Post caption" placeholder="Write a caption..." value={caption} onChangeText={setCaption} multiline style={[styles.input, styles.caption]} />
      <Pressable accessibilityRole="button" onPress={() => setPreview(true)} style={styles.previewButton}><Text style={styles.previewText}>Preview</Text></Pressable>
      {preview ? <View style={styles.previewCard}><Text style={styles.previewTitle}>{title || 'Untitled post'}</Text><Text style={styles.previewCaption}>{caption || 'No caption yet.'}</Text><Text style={styles.previewMeta}>Local preview only · not published</Text></View> : null}
    </ScrollView> : null}
    {!editing ? <View style={[styles.switcher, mode === 'text' && styles.textSwitcher]}><Pressable accessibilityRole="button" accessibilityState={{ selected: mode === 'post' }} onPress={() => resetMode('post')} style={styles.switchItem}><Text style={[styles.switchText, mode === 'post' && styles.switchActive]}>Post</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{ selected: mode === 'text' }} onPress={() => resetMode('text')} style={styles.switchItem}><Text style={[styles.switchText, mode === 'text' && styles.switchActive]}>Text</Text></Pressable></View> : null}
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#050505' }, textPage: { backgroundColor: '#FFFFFF' },
  header: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  close: { width: 45, height: 45, justifyContent: 'center' }, closeText: { color: '#FFFFFF', fontSize: 31 }, darkText: { color: '#171717' },
  heading: { color: '#FFFFFF', fontSize: 19, fontWeight: '800' }, headerSpace: { width: 45 },
  next: { width: 50, alignItems: 'center' }, nextText: { color: '#FFE900', fontSize: 14, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 18, paddingVertical: 12 }, action: { flex: 1, backgroundColor: '#202020', borderRadius: 8, height: 58, alignItems: 'center', justifyContent: 'center' }, actionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  galleryTabs: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 15 }, galleryActive: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' }, galleryMuted: { color: '#898989', fontSize: 14 },
  notice: { color: '#FFE900', fontSize: 12, paddingHorizontal: 18, paddingVertical: 8 },
  gallery: { flexDirection: 'row', flexWrap: 'wrap' }, tile: { width: '33.333%', aspectRatio: 1, padding: 1 }, tilePhoto: { width: '100%', height: '100%' }, check: { position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#FFFFFF', backgroundColor: '#00000055', alignItems: 'center', justifyContent: 'center' }, checked: { backgroundColor: '#FFE900', borderColor: '#FFE900' }, checkText: { color: '#111111', fontSize: 13, fontWeight: '900' },
  demoNote: { color: '#999999', fontSize: 10, textAlign: 'center', padding: 8 },
  switcher: { flexDirection: 'row', alignSelf: 'center', backgroundColor: '#191919', borderRadius: 28, padding: 5, marginBottom: 20 }, textSwitcher: { backgroundColor: '#EEEEEE' }, switchItem: { minWidth: 82, alignItems: 'center', paddingVertical: 8 }, switchText: { color: '#777777', fontSize: 16 }, switchActive: { color: '#FFE900', fontWeight: '800' },
  editor: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 18, gap: 14 }, editorPhoto: { width: '100%', height: 280, borderRadius: 14 }, textCanvas: { minHeight: 260, backgroundColor: '#F6F3EA', borderRadius: 16, padding: 26, justifyContent: 'center' }, canvasText: { color: '#161616', fontSize: 29, fontWeight: '800' },
  input: { minHeight: 50, backgroundColor: '#F4F4F4', borderRadius: 10, padding: 14, fontSize: 15, color: '#161616' }, caption: { minHeight: 120, textAlignVertical: 'top' },
  previewButton: { backgroundColor: '#FFE900', borderRadius: 10, padding: 14, alignItems: 'center' }, previewText: { color: '#111111', fontSize: 16, fontWeight: '800' },
  previewCard: { backgroundColor: '#F5F5F5', borderRadius: 12, padding: 16, gap: 8 }, previewTitle: { color: '#161616', fontSize: 18, fontWeight: '800' }, previewCaption: { color: '#444444', fontSize: 14 }, previewMeta: { color: '#888888', fontSize: 11 },
});
