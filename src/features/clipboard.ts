/**
 * Copy plain text without a share sheet.
 * Apple browsers lose the tap gesture if clipboard.writeText is the first await,
 * so those browsers copy synchronously first.
 */
export async function copyPlainText(text: string): Promise<boolean> {
  if (useSyncCopy() && copyWithCommand(text)) return true;
  if (await copyWithClipboardApi(text)) return true;
  if (!useSyncCopy() && copyWithCommand(text)) return true;
  return copyWithExpo(text);
}

function useSyncCopy() {
  return typeof navigator !== 'undefined' && /apple/i.test(navigator.vendor ?? '');
}

function copyWithCommand(text: string) {
  if (typeof document === 'undefined' || !document.body || typeof document.execCommand !== 'function') return false;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', 'true');
  area.setAttribute('aria-hidden', 'true');
  area.style.position = 'fixed';
  area.style.top = '0';
  area.style.left = '0';
  area.style.width = '1px';
  area.style.height = '1px';
  area.style.opacity = '0';
  area.style.fontSize = '16px';
  const selection = document.getSelection?.() ?? null;
  const previous = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  document.body.appendChild(area);
  area.focus();
  area.select();
  try { area.setSelectionRange(0, text.length); } catch { /* selection can be unsupported */ }
  let copied = false;
  try { copied = document.execCommand('copy'); } catch { copied = false; }
  document.body.removeChild(area);
  if (previous && selection) {
    selection.removeAllRanges();
    selection.addRange(previous);
  }
  return copied;
}

async function copyWithClipboardApi(text: string) {
  const write = typeof navigator !== 'undefined' ? navigator.clipboard?.writeText : undefined;
  if (typeof write !== 'function') return false;
  try {
    await write.call(navigator.clipboard, text);
    return true;
  } catch {
    return false;
  }
}

async function copyWithExpo(text: string) {
  try {
    const clipboard = await import('expo-clipboard');
    return await clipboard.setStringAsync(text);
  } catch {
    return false;
  }
}
