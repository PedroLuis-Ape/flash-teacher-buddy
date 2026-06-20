import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), 'utf8');

const migration = read('../../../supabase/migrations/20260620210000_classroom_isolated_content.sql');
const toolbar = read('./components/ClassroomContentToolbar.tsx');
const hook = read('./hooks/useClassFolders.ts');
const route = read('../../pages/TurmaDetailWithContent.tsx');

describe('isolated classroom content', () => {
  it('repairs and enforces class context for lists inside class folders', () => {
    expect(migration).toContain('UPDATE public.lists AS l');
    expect(migration).toContain('inherit_list_class_context_trigger');
    expect(migration).toContain("NEW.visibility := 'class'");
    expect(migration).toContain('NEW.class_id := parent_class_id');
  });

  it('creates the folder and assignment atomically for the class owner', () => {
    expect(migration).toContain('create_class_folder_with_assignment');
    expect(migration).toContain('Only the classroom owner can create folders');
    expect(migration).toContain("'pasta'::public.atribuicao_fonte_tipo");
    expect(hook).toContain('create_class_folder_with_assignment');
  });

  it('uses the assignment as the public visibility source of truth', () => {
    const publicListsFunction = migration.split('CREATE OR REPLACE FUNCTION public.public_turma_lists_rows()')[1];
    expect(publicListsFunction).toBeTruthy();
    expect(publicListsFunction).not.toContain('l.class_id = t.id');
    expect(publicListsFunction).not.toContain("l.visibility = 'class'");
    expect(migration).toContain("a.fonte_tipo::text = 'pasta'");
    expect(migration).toContain('a.fonte_id = f.id');
  });

  it('offers direct class creation and isolated personal-library import', () => {
    expect(toolbar).toContain('Nova pasta da turma');
    expect(toolbar).toContain('Importar da biblioteca');
    expect(toolbar).toContain(".is('class_id', null)");
    expect(toolbar).toContain('Cópia isolada adicionada à turma');
    expect(route).toContain('ClassroomContentToolbar');
  });
});
