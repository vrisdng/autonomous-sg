import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyPlainText } from './clipboard';

vi.mock('expo-clipboard', () => ({ setStringAsync: vi.fn(async () => true) }));

function installDocument(exec: () => boolean) {
  const area = {
    value: '',
    style: {} as CSSStyleDeclaration,
    setAttribute() {},
    focus() {},
    select() {},
    setSelectionRange() {},
  };
  vi.stubGlobal('document', {
    body: { appendChild() {}, removeChild() {} },
    createElement: () => area,
    getSelection: () => null,
    execCommand: exec,
  });
  return area;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('copyPlainText', () => {
  it('copies on Apple browsers before asking the async clipboard', async () => {
    const exec = vi.fn(() => true);
    const area = installDocument(exec);
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { vendor: 'Apple Computer, Inc.', clipboard: { writeText } });
    const message = 'Apple67 · Join our supper party: https://bojio.pages.dev/plan/ABC234\nCode: ABC234';
    await expect(copyPlainText(message)).resolves.toBe(true);
    expect(area.value).toBe(message);
    expect(exec).toHaveBeenCalledWith('copy');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('uses the clipboard API and does not require a share sheet', async () => {
    installDocument(() => false);
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { vendor: 'Google Inc.', clipboard: { writeText } });
    const message = 'Apple67 · Join our supper party: https://bojio.pages.dev/plan/ABC234\nCode: ABC234';
    await expect(copyPlainText(message)).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith(message);
  });

  it('uses the native clipboard when the browser cannot copy', async () => {
    vi.stubGlobal('document', undefined);
    vi.stubGlobal('navigator', { vendor: '' });
    const clipboard = await import('expo-clipboard');
    await expect(copyPlainText('Bojio?')).resolves.toBe(true);
    expect(clipboard.setStringAsync).toHaveBeenCalledWith('Bojio?');
  });
});
