import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const galaxyMobileCss = readFileSync(
  new URL('./space-galaxy-home-mobile-hotfix.css', import.meta.url),
  'utf8',
);

const emojiCss = readFileSync(
  new URL('./space-ui-button-emojis.css', import.meta.url),
  'utf8',
);

describe('Galaxy critical controls visibility', () => {
  it('never removes pseudo-elements from every button', () => {
    expect(galaxyMobileCss).not.toContain('.space-ui main button::before');
    expect(galaxyMobileCss).not.toContain('.space-ui main button::after');
  });

  it('keeps a native SVG fallback when :has is unavailable', () => {
    expect(emojiCss).toContain('@supports selector(:has(*))');
    expect(emojiCss).toContain('display:inline-flex');
    expect(emojiCss.indexOf('display:inline-flex')).toBeLessThan(
      emojiCss.indexOf('@supports selector(:has(*))'),
    );
  });

  it('defines visible identities for layout and card-status controls', () => {
    expect(emojiCss).toContain('content:"⚙️"');
    expect(emojiCss).toContain('content:"⭐"');
    expect(emojiCss).toContain('content:"🔥"');
    expect(emojiCss).toContain('content:"💎"');
  });
});
