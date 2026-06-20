import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./PublicTeacherProfile.tsx', import.meta.url), 'utf8');

describe('public teacher profile production data', () => {
  it('loads real public classrooms through the dedicated RPC', () => {
    expect(source).toContain("'get_public_teacher_turmas'");
    expect(source).toContain("queryKey: ['public-teacher-turmas', slug]");
    expect(source).toContain('Turmas públicas');
    expect(source).toContain('assignment_count');
  });

  it('does not ship the old demonstration profile fallback', () => {
    expect(source).not.toContain('PREVIEW_PROFILE');
    expect(source).not.toContain('dados demonstrativos');
    expect(source).not.toContain('previewMode');
  });

  it('navigates public classroom cards to their read-only route', () => {
    expect(source).toContain('navigate(`/turmas/${turma.id}`)');
  });
});
