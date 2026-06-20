import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const turmaPage = readFileSync(new URL('./TurmaPublicPage.tsx', import.meta.url), 'utf8');
const hubPage = readFileSync(new URL('./PublicClassGamesHub.tsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const layoutSource = readFileSync(new URL('../components/layout/GlobalLayout.tsx', import.meta.url), 'utf8');

describe('public classroom student flow', () => {
  it('shows activities, then lists, then the full games hub', () => {
    expect(turmaPage).toContain('Atividades da turma');
    expect(turmaPage).toContain('Listas disponíveis');
    expect(turmaPage).toContain('/games?');
    expect(turmaPage).not.toContain('list.cards.map');
  });

  it('offers all six game modes in the public hub', () => {
    for (const mode of ['flip', 'write', 'multiple', 'unscramble', 'mixed', 'pronunciation']) {
      expect(hubPage).toContain(`mode: '${mode}'`);
    }
  });

  it('preserves the public classroom context into study', () => {
    expect(hubPage).toContain("guest: 'true'");
    expect(hubPage).toContain('turma: turmaId');
    expect(hubPage).toContain('atribuicao: assignmentId');
    expect(appSource).toContain('return <PublicClassGamesHub />');
  });

  it('removes the obsolete floating launcher', () => {
    expect(layoutSource).not.toContain('PublicClassPlayLauncher');
  });
});
