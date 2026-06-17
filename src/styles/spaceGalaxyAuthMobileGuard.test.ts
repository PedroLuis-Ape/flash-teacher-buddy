import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
  new URL('./space-galaxy-home-mobile-hotfix.css', import.meta.url),
  'utf8',
);

describe('Galaxy auth mobile guard', () => {
  it('does not depend on Auth being a direct child of the public shell', () => {
    expect(css).toContain('.space-ui-main main.min-h-screen.flex.items-center.justify-center');
    expect(css).not.toContain('.space-ui-main > main.min-h-screen.flex.items-center.justify-center');
  });

  it('keeps the install button and auth cards in one vertical column', () => {
    expect(css).toContain('flex-direction: column !important');
    expect(css).toContain('> button.fixed.top-4.right-4');
    expect(css).toContain('position: static !important');
    expect(css).toContain('> div.w-full.max-w-md');
  });

  it('hides the large mascot on narrow authentication screens', () => {
    expect(css).toContain('> img.fixed.bottom-0');
    expect(css).toContain('display: none !important');
  });
});
