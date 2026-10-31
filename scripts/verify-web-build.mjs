import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const localEnv = await readFile('.env.local', 'utf8').catch(() => '');
const localValue = (name) => localEnv.split(/\r?\n/).find(line => line.startsWith(`${name}=`))?.slice(name.length + 1).trim();
const url = process.env.EXPO_PUBLIC_SUPABASE_URL || localValue('EXPO_PUBLIC_SUPABASE_URL');
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || localValue('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY') || localValue('EXPO_PUBLIC_SUPABASE_ANON_KEY');
assert.ok(url && key, 'Production builds require public Supabase settings');
const directory = 'dist/_expo/static/js/web';
const files = (await readdir(directory)).filter(file => file.endsWith('.js'));
const bundle = (await Promise.all(files.map(file => readFile(`${directory}/${file}`, 'utf8')))).join('\n');
assert.ok(bundle.includes(url) && bundle.includes(key), 'Export omitted public settings. Clear the Metro cache and rebuild.');
assert.ok(!bundle.includes('127.0.0.1:8788'), 'Local travel gateway must never be in production');
assert.ok(!bundle.includes('ONEMAP_PASSWORD'), 'OneMap credentials must remain server-side');
assert.equal((await readFile('dist/_redirects','utf8')).trim(), '/* /index.html 200');
console.log('PASS: production Supabase configuration and invitation fallback are included.');
