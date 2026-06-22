import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const componentsCss = readFileSync(
  new URL('./space-ui-components.css', import.meta.url),
  'utf8',
);

const turmaShortcut = readFileSync(
  new URL('../components/TurmaShortcut.tsx', import.meta.url),
  'utf8',
);

describe('dashboard decorative mascot guard', () => {
  it('does not inject a Piteco image into welcome banners', () => {
    expect(componentsCss).not.toContain('piteco-logo.png');
    expect(componentsCss).not.toContain('--piteco-heart-hero');
    expect(componentsCss).toContain('.welcome-banner::before');
    expect(componentsCss).toContain('content:none!important');
  });

  it('does not reuse the profile welcome banner for classroom cards', () => {
    expect(turmaShortcut).not.toContain('className="welcome-banner');
    expect(turmaShortcut).toContain('className="card-premium');
  });
});
