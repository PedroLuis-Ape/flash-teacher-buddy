import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const hookSource = readFileSync(new URL('./useTurmas.ts', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('../../../pages/TurmasProfessor.tsx', import.meta.url), 'utf8');
const updateStart = hookSource.indexOf('export function useUpdateTurma');
const updateEnd = hookSource.indexOf('export function useReorderPublicTurmas');
const updateSource = hookSource.slice(updateStart, updateEnd);

describe('turma public visibility persistence', () => {
  it('updates through the dedicated server operation', () => {
    expect(updateSource).toContain('turmas-update');
    expect(updateSource).toContain('getSession');
    expect(updateSource).toContain('functions.invoke');
  });

  it('verifies the visibility returned by the server before succeeding', () => {
    expect(updateSource).toContain('updated.public !== isPublic');
    expect(pageSource).toContain('result?.turma?.public !== nextPublic');
  });

  it('updates the cached teacher classroom list with the persisted row', () => {
    expect(updateSource).toContain("queryClient.setQueryData(['turmas', 'mine']");
    expect(updateSource).toContain('item.id === turma.id');
    expect(updateSource).toContain("queryKey: ['public-teacher-turmas']");
  });
});
