import { lazy, Suspense } from 'react';
import { usePalette } from '@/hooks/usePalette';

const SpaceTwinkleLayer = lazy(() =>
  import('@/components/layout/SpaceTwinkleLayer').then((module) => ({
    default: module.SpaceTwinkleLayer,
  })),
);

/**
 * Keeps the standard public theme lightweight. The animated galaxy bundle is
 * downloaded only after the visitor explicitly selects the galaxy palette.
 */
export function PublicGalaxyGate() {
  const { palette } = usePalette();
  if (palette !== 'galaxy') return null;

  return (
    <Suspense fallback={null}>
      <SpaceTwinkleLayer />
    </Suspense>
  );
}
