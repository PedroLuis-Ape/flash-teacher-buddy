import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const hookSource = readFileSync(new URL('./useTurmas.ts', import.meta.url), 'utf8');
const pageSource = readFileSync(
  new URL('../../../pages/TurmasProfessor.tsx', import.meta.url),
  'utf8',
);

describe('turma public visibility persistence', () => {
  it('updates the turma directly through the existing owner RLS policy', () => {
    expect(hookSource).toContain(".from('turmas')");
    expect(hookSource).toContain('.update(updates)');
    expect(hookSource).not.toContain("supabase.functions.invoke('turmas-update'");
  });

  it('verifies the visibility returned by the database before succeeding', () => {
    expect(hookSource).toContain('updated?.public !== isPublic');
    expect(pageSource).toContain('result?.turma?.public !== nextPublic');
  });

  it('updates the cached teacher classroom list with the persisted row', () => {
    expect(hookSource).toContain("queryClient.setQueryData(['turmas', 'mine']");
    expect(hookSource).toContain('item.id === turma.id');
  });
});
