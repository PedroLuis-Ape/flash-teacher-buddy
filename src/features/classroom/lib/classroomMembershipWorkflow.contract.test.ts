import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');

describe('classroom membership workflow contract', () => {
  const migration = read('supabase', 'migrations', '20260726120000_classroom_membership_workflow_v1.sql');

  it('is additive and records canonical states without destructive data operations', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS status');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.turma_membership_events');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.transition_turma_membership_v1');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.get_turma_access_v1');
    expect(migration).not.toMatch(/DROP\s+TABLE/i);
    expect(migration).not.toMatch(/DELETE\s+FROM\s+public\.(turmas|turma_membros)/i);
    expect(migration).not.toMatch(/TRUNCATE/i);
  });

  it('keeps writes behind authenticated transactional RPCs', () => {
    expect(migration).toContain('REVOKE INSERT, UPDATE, DELETE ON public.turma_membros FROM anon, authenticated');
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.transition_turma_membership_v1");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.add_students_to_turma_v1");
    expect(read('supabase', 'functions', 'turma-membership-transition', 'index.ts')).toContain('transition_turma_membership_public_v1');
    expect(read('supabase', 'functions', 'professor-students-add-to-class', 'index.ts')).toContain('add_students_to_turma_by_public_id_v1');
  });

  it('keeps search scoped and avoids the legacy global follow list', () => {
    const search = read('src', 'pages', 'Search.tsx');
    const students = read('src', 'features', 'classroom', 'hooks', 'useMeusAlunos.ts');
    const workflowPage = read('src', 'pages', 'TurmaDetailWorkspace.tsx');
    expect(search).toContain('search_turma_people_v1');
    expect(search).toContain('public_id');
    expect(search).not.toContain("from('subscriptions')");
    expect(students).toContain('p_turma_id');
    expect(students).not.toContain("from('subscriptions')");
    expect(workflowPage).toContain('get_turma_access_v1');
    expect(workflowPage).toContain('PendingTurmaMembership');
  });
});
