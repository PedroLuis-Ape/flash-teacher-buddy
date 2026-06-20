import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./PublicTeacherProfile.tsx', import.meta.url), 'utf8');

describe('public teacher profile', () => {
  it('uses production classroom data without preview fallback', () => {
    expect(source).toContain('get_public_teacher_turmas');
    expect(source).toContain('Turmas públicas');
    expect(source).not.toContain('PREVIEW_PROFILE');
    expect(source).not.toContain('previewMode');
  });
});
