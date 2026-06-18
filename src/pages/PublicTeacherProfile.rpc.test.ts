import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../../supabase/migrations/20260617190000_public_teacher_turmas.sql', import.meta.url),
  'utf8',
);

const page = readFileSync(
  new URL('./PublicTeacherProfile.tsx', import.meta.url),
  'utf8',
);

describe('public teacher classroom reuse', () => {
  it('queries the existing public_turmas view from the profile', () => {
    expect(migration).toContain('CREATE OR REPLACE VIEW public.public_turmas');
    expect(page).toContain(".from('public_turmas')");
    expect(page).toContain(".eq('teacher_public_slug', normalizedSlug)");
  });

  it('keeps teacher visibility filters and public classroom counts', () => {
    expect(migration).toContain('p.public_access_enabled');
    expect(migration).toContain('p.public_profile_searchable');
    expect(migration).toContain('public.public_turma_atribuicoes');
    expect(migration).toContain('public.public_turma_flashcards');
  });
});
