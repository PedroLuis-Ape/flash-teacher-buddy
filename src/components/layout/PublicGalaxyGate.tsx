import { lazy, Suspense, useEffect, useState } from 'react';
import { usePalette } from '@/hooks/usePalette';

const SpaceTwinkleLayer = lazy(() =>
  import('@/components/layout/SpaceTwinkleLayer').then((module) => ({
    default: module.SpaceTwinkleLayer,
  })),
);

export function PublicGalaxyGate() {
  const { palette } = usePalette();
  const [useStaticBackdrop, setUseStaticBackdrop] = useState(true);

  useEffect(() => {
    const media = window.matchMedia(
      '(max-width: 767px), (update: slow), (prefers-reduced-motion: reduce)',
    );
    const sync = () => setUseStaticBackdrop(media.matches);

    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);

  if (palette !== 'galaxy') return null;

  if (useStaticBackdrop) {
    return (
      <div aria-hidden="true" className="space-galaxy-effects">
        <span className="space-galaxy-arm" />
      </div>
    );
  }

  return (
    <Suspense fallback={null}>
      <SpaceTwinkleLayer />
    </Suspense>
  );
}
