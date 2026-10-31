import AsyncStorage from '@react-native-async-storage/async-storage';
let queue: Promise<unknown> = Promise.resolve();
export async function loadRideFares(key: string): Promise<Record<string,string>> {
  await queue;
  const raw=await AsyncStorage.getItem(key);
  if(!raw)return {};
  const value=JSON.parse(raw);
  if(!value || typeof value!=='object' || Array.isArray(value) || Object.values(value).some((fare)=>typeof fare!=='string'))throw new Error('Saved fares could not be read. They have not been replaced.');
  return value;
}
export function saveRideFares(key: string, fares: Record<string,string>) {
  const value=JSON.stringify(fares);
  queue=queue.catch(()=>undefined).then(()=>AsyncStorage.setItem(key,value));
  return queue;
}
