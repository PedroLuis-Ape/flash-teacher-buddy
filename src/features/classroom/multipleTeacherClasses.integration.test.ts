import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

const shortcut = read('../../components/TurmaShortcut.tsx');
const overview = read('../../pages/Turmas.tsx');
const manager = read('../../pages/TurmasProfessor.tsx');
const detail = read('../../pages/TurmaDetailWithContent.tsx');
const hooks = read('./hooks/useTurmas.ts');
const createFunction = read('../../../supabase/functions/turmas-create/index.ts');
const mineFunction = read('../../../supabase/functions/turmas-mine/index.ts');
const baseMigration = read('../../../supabase/migrations/20251112133153_a8d645c2-0432-4de3-941b-d941495d61d4.sql');

describe('multiple teacher classes', () => {
  it('always exposes class management and creation on the teacher dashboard', () => {
    expect(shortcut).toContain('/turmas/professor?create=1');
    expect(shortcut).toContain('/turmas/professor');
    expect(shortcut).not.toContain('/turmas-professor');
    expect(shortcut).toContain('if (!isTeacher && turmas.length === 0) return null');
    expect(shortcut).toContain('Nova turma');
    expect(shortcut).toContain('Criar sua primeira turma');
  });

  it('opens the creation form directly from every teacher entry point', () => {
    expect(overview).toContain("navigate('/turmas/professor?create=1')");
    expect(manager).toContain("searchParams.get('create') === '1'");
    expect(manager).toContain('Você pode criar quantas turmas precisar');
    expect(detail).toContain('<TeacherClassNavigation />');
  });

  it('keeps creation independent from any existing class', () => {
    expect(createFunction).toContain(".from('turmas')");
    expect(createFunction).toContain('.insert({');
    expect(createFunction).toContain('owner_teacher_id: user.id');
    expect(createFunction).not.toContain('.limit(1)');
    expect(baseMigration).toContain('owner_teacher_id UUID NOT NULL');
    expect(baseMigration).not.toContain('UNIQUE(owner_teacher_id)');
  });

  it('loads all active classes owned by the teacher and refreshes after creation', () => {
    expect(mineFunction).toContain('.eq("owner_teacher_id", user.id)');
    expect(mineFunction).toContain('.eq("ativo", true)');
    expect(mineFunction).not.toContain('.single()');
    expect(hooks).toContain("invalidateQueries({ queryKey: ['turmas', 'mine'] })");
    expect(hooks).toContain('readTurmaCreateFunctionError');
  });
});
