import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

const app = read('../../App.tsx');
const detail = read('../../pages/TurmaDetailWithContent.tsx');
const launchCard = read('./components/ClassroomSuperImportLaunchCard.tsx');
const screen = read('../global-import/SuperGlobalImportScreenV2.tsx');
const service = read('../global-import/mappedService.ts');
const catalog = read('../global-import/destinationCatalog.ts');
const migration = read('../../../supabase/migrations/20260620233000_classroom_super_import_v1.sql');

describe('classroom super importer integration', () => {
  it('is reachable only from the private class owner interface', () => {
    expect(app).toContain('/turmas/:turmaId/import/super');
    expect(detail).toContain('<ClassroomSuperImportLaunchCard turmaId={turmaId} />');
    expect(launchCard).toContain('Super importar lote');
    expect(launchCard).toContain('/import/super');
  });

  it('loads only destinations from the selected classroom', () => {
    expect(catalog).toContain('.eq("class_id", turmaId)');
    expect(catalog).toContain('.eq("owner_teacher_id", user.id)');
    expect(catalog).toContain('.is("class_id", null)');
  });

  it('routes classroom execution and undo through dedicated transactional RPCs', () => {
    expect(service).toContain('import_app_piteco_super_package_to_class_v1');
    expect(service).toContain('undo_classroom_global_import_v1');
    expect(service).toContain('turmaId: options.turmaId ?? null');
    expect(screen).toContain('turmaId: turmaId ?? null');
    expect(screen).toContain('Lote importado e atribuído à turma.');
  });

  it('creates isolated class entities and tracks assignments for undo', () => {
    expect(migration).toContain("'target_scope', 'classroom'");
    expect(migration).toContain("'assignment', v_assignment_id, 'created'");
    expect(migration).toContain("'class',\n        _turma_id");
    expect(migration).toContain('PERFORM public.undo_global_import_v1(_batch_id)');
  });
});
