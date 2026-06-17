import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../../supabase/migrations/20260617190000_public_teacher_turmas.sql', import.meta.url),
  'utf8',
);

describe('get_public_teacher_turmas migration', () => {
  it('applies every required visibility filter', () => {
    for (const rule of [
      'p.is_teacher',
      'p.public_access_enabled',
      'p.public_profile_searchable',
      't.public = true',
      't.ativo = true',
    ]) {
      expect(migration).toContain(rule);
    }
  });

  it('derives counts from anonymous public views', () => {
    expect(migration).toContain('public.public_turma_atribuicoes');
    expect(migration).toContain('public.public_turma_flashcards');
  });

  it('uses a hardened anonymous read-only contract', () => {
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('SET search_path = public');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.get_public_teacher_turmas(text) FROM PUBLIC');
    expect(migration).toContain('TO anon, authenticated');
  });
});
