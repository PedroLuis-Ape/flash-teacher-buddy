import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const read = (...segments: string[]) => readFileSync(join(ROOT, ...segments), 'utf8');

const app = read('src', 'App.tsx');
const routeWrapper = read('src', 'pages', 'FolderWithExport.tsx');
const exporter = read('src', 'features', 'export', 'folderExport.ts');
const dialog = read('src', 'features', 'export', 'FolderExportDialog.tsx');
const classroomPanel = read('src', 'features', 'classroom', 'components', 'ClassroomFolderExportPanel.tsx');
const classroomPage = read('src', 'pages', 'TurmaDetailWithContent.tsx');

describe('folder export contract', () => {
  it('exposes export on authenticated folders without changing the public portal', () => {
    expect(app).toContain('const FolderWithExport');
    expect(app).toContain('<Route path="/folder/:id" element={<FolderWithExport />} />');
    expect(app).toContain('<Route path="/portal/folder/:id" element={<Folder />} />');
    expect(routeWrapper).toContain('<FolderExportDialog');
    expect(routeWrapper).toContain('user && id');
  });

  it('builds a complete import-compatible package and paginates large folders', () => {
    expect(exporter).toContain("schema: 'app-piteco-super-import'");
    expect(exporter).toContain("version: '2.0'");
    expect(exporter).toContain('withSmartDeclaredTotals');
    expect(exporter).toContain('smartImportPackageSchema.parse');
    expect(exporter).toContain(".from('folders')");
    expect(exporter).toContain(".from('lists')");
    expect(exporter).toContain(".from('flashcards')");
    expect(exporter).toContain(".is('deleted_at', null)");
    expect(exporter).toContain('.range(offset, offset + PAGE_SIZE - 1)');
  });

  it('preserves enriched cards and layered groups', () => {
    expect(exporter).toContain("type: 'layered'");
    expect(exporter).toContain('parent_card_id');
    expect(exporter).toContain('layer_index');
    expect(exporter).toContain('detailed_explanation');
    expect(exporter).toContain('usage_notes');
    expect(exporter).toContain('common_mistakes');
    expect(exporter).toContain('word_hints');
  });

  it('offers copy, TXT and JSON actions', () => {
    expect(dialog).toContain('Texto copiável');
    expect(dialog).toContain('JSON para importar');
    expect(dialog).toContain('Baixar TXT');
    expect(dialog).toContain('Baixar JSON');
    expect(dialog).toContain('navigator.clipboard.writeText');
  });

  it('exports only folder assignments from the owned classroom', () => {
    expect(classroomPanel).toContain("assignment?.fonte_tipo === 'pasta'");
    expect(classroomPanel).toContain('Exportar pastas da turma');
    expect(classroomPage).toContain('<ClassroomFolderExportPanel turmaId={turmaId} />');
    expect(classroomPage).toContain('isOwner && turmaId');
  });
});
