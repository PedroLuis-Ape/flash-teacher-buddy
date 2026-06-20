import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const detailSource = readFileSync(new URL('../../pages/TurmaDetail.tsx', import.meta.url), 'utf8');
const publicSource = readFileSync(new URL('../../pages/TurmaPublicPage.tsx', import.meta.url), 'utf8');
const managerSource = readFileSync(
  new URL('./components/AssignmentOrderManager.tsx', import.meta.url),
  'utf8',
);
const hookSource = readFileSync(new URL('./hooks/useAtribuicoes.ts', import.meta.url), 'utf8');

describe('classroom assignment sequence integration', () => {
  it('exposes the sequence manager only to the class owner', () => {
    expect(detailSource).toContain('accessQuery.data?.owner_teacher_id === user.id');
    expect(detailSource).toContain('<AssignmentOrderManager turmaId={turmaId} />');
  });

  it('shows explicit three-digit positions in the public classroom', () => {
    expect(publicSource).toContain('assignmentPositionLabel(index)');
    expect(publicSource).toContain('sortAssignmentsByOrder');
  });

  it('lets the teacher select an exact position and save the full sequence', () => {
    expect(managerSource).toContain('Organizar sequência');
    expect(managerSource).toContain('Salvar sequência');
    expect(managerSource).toContain('moveAssignmentToPosition');
    expect(managerSource).toContain('ordered_ids: orderedIds');
  });

  it('persists sequential indexes and normalizes after creation', () => {
    expect(hookSource).toContain('order_index: index + 1');
    expect(hookSource).toContain('sortAssignmentsByOrder(assignments ?? [])');
    expect(hookSource).toContain('persistAssignmentSequence(payload.turma_id, orderedIds)');
  });
});
