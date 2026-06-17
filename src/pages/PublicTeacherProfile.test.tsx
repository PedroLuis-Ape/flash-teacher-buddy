import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  buildPublicTurmaPath,
  PublicTeacherTurmasSection,
  PUBLIC_TEACHER_STATS_GRID_CLASS,
  type PublicTeacherTurmaRow,
} from '@/features/publicTeacher/components/PublicTeacherTurmasSection';
import { shouldUsePreviewFallback } from '@/features/publicTeacher/lib/publicTeacherProfile';

const turma: PublicTeacherTurmaRow = {
  id: 'turma-123',
  nome: 'English for Work',
  descricao: 'Atividades públicas.',
  created_at: '2026-06-17T12:00:00.000Z',
  assignment_count: 1,
  card_count: 12,
};

function renderSection(props: { turmas?: PublicTeacherTurmaRow[]; loading?: boolean; error?: boolean } = {}) {
  return renderToStaticMarkup(
    <PublicTeacherTurmasSection
      profileName="Professor Pedro"
      turmas={props.turmas ?? []}
      isLoading={props.loading ?? false}
      isError={props.error ?? false}
      onRetry={() => undefined}
      onOpenTurma={() => undefined}
    />,
  );
}

describe('public teacher classrooms', () => {
  it('renders loading, error with retry, and empty states', () => {
    expect(renderSection({ loading: true })).toContain('Carregando turmas públicas...');
    expect(renderSection({ error: true })).toContain('Tentar novamente');
    expect(renderSection()).toContain('Nenhuma turma pública disponível');
  });

  it('renders classroom data with pluralization and responsive cards', () => {
    const html = renderSection({ turmas: [turma, { ...turma, id: 'turma-456', assignment_count: 3, card_count: 1 }] });
    expect(html).toContain('Turma pública');
    expect(html).toContain('1 atividade');
    expect(html).toContain('3 atividades');
    expect(html).toContain('12 cards');
    expect(html).toContain('1 card');
    expect(html).toContain('md:grid-cols-2');
  });

  it('uses the anonymous route without publicPreview', () => {
    expect(buildPublicTurmaPath('turma-123')).toBe('/turmas/turma-123');
    expect(buildPublicTurmaPath('turma-123')).not.toContain('publicPreview');
  });

  it('uses a two-by-four responsive counter grid', () => {
    expect(PUBLIC_TEACHER_STATS_GRID_CLASS).toContain('grid-cols-2');
    expect(PUBLIC_TEACHER_STATS_GRID_CLASS).toContain('sm:grid-cols-4');
  });
});

describe('preview fallback', () => {
  const error = { code: 'PGRST202', message: 'get_public_teacher_profile missing' };

  it('is enabled only in development for the configured preview slug', () => {
    const base = { error, slug: 'pedro', previewSlug: 'pedro' };
    expect(shouldUsePreviewFallback({ ...base, isDevelopment: true })).toBe(true);
    expect(shouldUsePreviewFallback({ ...base, isDevelopment: false })).toBe(false);
    expect(shouldUsePreviewFallback({ ...base, slug: 'other', isDevelopment: true })).toBe(false);
  });
});
