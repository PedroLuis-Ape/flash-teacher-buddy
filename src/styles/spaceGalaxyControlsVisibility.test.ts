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

const glitterCss = readFileSync(
  new URL('./space-ui-glitter.css', import.meta.url),
  'utf8',
);

describe('Galaxy critical controls visibility', () => {
  it('never removes pseudo-elements from every button', () => {
    expect(galaxyMobileCss).not.toContain('.space-ui main button::before');
    expect(galaxyMobileCss).not.toContain('.space-ui main button::after');
  });

  it('does not use button pseudo-elements for Galaxy glitter', () => {
    expect(glitterCss).not.toContain('button:not([role="switch"])::before');
    expect(glitterCss).not.toContain('study-tools-floating-trigger::before');
  });

  it('keeps real critical SVG controls visible', () => {
    expect(emojiCss).toContain('.lucide-settings');
    expect(emojiCss).toContain('.lucide-star');
    expect(emojiCss).toContain('.lucide-flame');
    expect(emojiCss).toContain('.lucide-gem');
    expect(emojiCss).toContain('display: inline-flex !important');
    expect(emojiCss).toContain('visibility: visible !important');
  });

  it('forbids an extra mascot in the dashboard banner', () => {
    expect(glitterCss).toContain('.welcome-banner::after');
    expect(glitterCss).toContain('content:none!important');
    expect(glitterCss).toContain('background-image:none!important');
  });
});
