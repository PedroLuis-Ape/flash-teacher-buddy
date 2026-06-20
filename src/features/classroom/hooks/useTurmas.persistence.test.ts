import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const hookSource = readFileSync(new URL('./useTurmas.ts', import.meta.url), 'utf8');
const pageSource = readFileSync(
  new URL('../../../pages/TurmasProfessor.tsx', import.meta.url),
  'utf8',
);

describe('turma public visibility persistence', () => {
  it('updates the turma through the authenticated server function', () => {
    expect(hookSource).toContain("supabase.functions.invoke('turmas-update'");
    expect(hookSource).toContain('Authorization: `Bearer ${session.access_token}`');
    expect(hookSource).not.toContain(".from('turmas')");
  });

  it('verifies the visibility returned by the server before succeeding', () => {
    expect(hookSource).toContain('updated.public !== isPublic');
    expect(pageSource).toContain('result?.turma?.public !== nextPublic');
  });

  it('updates the cached teacher classroom list with the persisted row', () => {
    expect(hookSource).toContain("queryClient.setQueryData(['turmas', 'mine']");
    expect(hookSource).toContain('item.id === turma.id');
    expect(hookSource).toContain("queryKey: ['public-teacher-turmas']");
  });
});
