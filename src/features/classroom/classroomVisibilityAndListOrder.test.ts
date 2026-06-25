import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const layoutSource = readFileSync(new URL('../../components/layout/GlobalLayout.tsx', import.meta.url), 'utf8');
const folderWorkspaceSource = readFileSync(
  new URL('../../pages/FolderWorkspace.tsx', import.meta.url),
  'utf8',
);
const assignmentManagerSource = readFileSync(
  new URL('./components/AssignmentOrderManager.tsx', import.meta.url),
  'utf8',
);
const listManagerSource = readFileSync(
  new URL('../../components/ListSequenceDialog.tsx', import.meta.url),
  'utf8',
);
const floatingActionSource = readFileSync(
  new URL('./lib/floatingOrderAction.ts', import.meta.url),
  'utf8',
);
const visibilityRowsSql = readFileSync(
  new URL('../../../supabase/migrations/20260620033100_classroom_visibility_rows.sql', import.meta.url),
  'utf8',
);
const guestCardsSql = readFileSync(
  new URL('../../../supabase/migrations/20260620033200_classroom_guest_cards.sql', import.meta.url),
  'utf8',
);

describe('classroom visibility inheritance and list ordering', () => {
  it('keeps organization controls fixed above the mobile tab bar and iPhone safe area', () => {
    expect(assignmentManagerSource).toContain('floatingOrderActionClass');
    expect(listManagerSource).toContain('floatingOrderActionClass');
    expect(floatingActionSource).toContain('safe-area-inset-bottom');
    expect(floatingActionSource).toContain('bottom-[calc(env(safe-area-inset-bottom)+5.75rem)]');
    expect(floatingActionSource).toContain('md:bottom-6');
    expect(listManagerSource).toContain('Organizar sequência');
    expect(listManagerSource).toContain('triggerClassName');
    expect(folderWorkspaceSource).toContain('<ListSequenceDialog folderId={id} />');
    expect(folderWorkspaceSource).toContain('md:bottom-20');
    expect(layoutSource).not.toContain('<ListSequenceDialog');
  });

  it('persists list positions with one-based indexes', () => {
    expect(listManagerSource).toContain('order_index: index + 1');
    expect(listManagerSource).toContain('assignmentPositionLabel(index)');
  });

  it('does not require class visibility flags for assigned classroom rows', () => {
    expect(visibilityRowsSql).not.toContain("l.visibility = 'class'");
    expect(visibilityRowsSql).not.toContain("f.visibility = 'class'");
    expect(visibilityRowsSql).toContain('l.class_id = t.id');
    expect(visibilityRowsSql).toContain('f.class_id = t.id');
  });

  it('keeps ordinary portal rules while allowing assigned public classroom cards', () => {
    expect(guestCardsSql).toContain("f.visibility = 'class'");
    expect(guestCardsSql).toContain('t.public = true');
    expect(guestCardsSql).toContain("a.fonte_tipo::text = 'pasta'");
    expect(guestCardsSql).not.toContain("AND l.visibility = 'class'");
  });
});
