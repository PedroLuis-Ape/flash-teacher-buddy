import { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usePalette } from '@/hooks/usePalette';
import '@/styles/space-galaxy-premium.css';

const SpaceTwinkleLayer = lazy(() =>
  import('@/components/layout/SpaceTwinkleLayer').then((module) => ({
    default: module.SpaceTwinkleLayer,
  })),
);

export function PublicGalaxyGate() {
  const location = useLocation();
  const { palette } = usePalette();
  const [useStaticBackdrop, setUseStaticBackdrop] = useState(true);
  const isLanding = location.pathname === '/';

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
    const classes = [
      'space-galaxy-effects',
      'space-galaxy-effects--static-fallback',
      isLanding ? 'space-galaxy-effects--landing' : '',
    ].filter(Boolean).join(' ');

    return (
      <div aria-hidden="true" className={classes}>
        <span className="space-galaxy-arm" />
        <span className="space-galaxy-readability-field" />
      </div>
    );
  }

  return (
    <Suspense fallback={null}>
      <SpaceTwinkleLayer />
    </Suspense>
  );
}
