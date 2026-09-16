type LandingGalaxyBackdropProps = {
  animated: boolean;
};

const GALAXY_FRAMES = [
  "/assets/landing/galaxy/galaxy-frame-01.webp",
  "/assets/landing/galaxy/galaxy-frame-02.webp",
  "/assets/landing/galaxy/galaxy-frame-03.webp",
] as const;

const TWINKLE_FRAMES = [
  "/assets/landing/galaxy/twinkle-01.webp",
  "/assets/landing/galaxy/twinkle-02.webp",
  "/assets/landing/galaxy/twinkle-03.webp",
] as const;

function FrameStack({ className, frames }: { className: string; frames: readonly string[] }) {
  return (
    <span className={className}>
      {frames.map((src, index) => (
        <img
          key={src}
          src={src}
          alt=""
          decoding="async"
          loading="lazy"
          draggable={false}
          className={`landing-galaxy-frame landing-galaxy-frame-${index + 1}`}
        />
      ))}
    </span>
  );
}

/**
 * Official art-driven Galaxy system for the public landing page.
 *
 * Layer order:
 * 1. breakpoint-specific authored background
 * 2. contrast/readability masks
 * 3. the existing procedural depth canvas (owned by GalaxyVisualLayer)
 * 4. sparse authored galaxy/twinkle frame stacks
 * 5. landing content
 *
 * Only the selected <picture> source is fetched as the hero background. The
 * decorative frame stacks are lazy and can be frozen by reduced-motion.
 */
export function LandingGalaxyBackdrop({ animated }: LandingGalaxyBackdropProps) {
  return (
    <div
      className="landing-galaxy-system"
      data-galaxy-official="true"
      data-animated={animated ? "true" : "false"}
      aria-hidden="true"
    >
      <picture className="landing-galaxy-base">
        <source
          media="(min-width: 1600px) and (min-aspect-ratio: 2/1)"
          srcSet="/assets/landing/galaxy/galaxy-bg-21x9.webp"
        />
        <source
          media="(min-width: 1100px)"
          srcSet="/assets/landing/galaxy/galaxy-bg-16x9.webp"
        />
        <source
          media="(min-width: 768px) and (orientation: landscape)"
          srcSet="/assets/landing/galaxy/galaxy-bg-4x3.webp"
        />
        <source
          media="(min-width: 768px) and (orientation: portrait)"
          srcSet="/assets/landing/galaxy/galaxy-bg-3x4.webp"
        />
        <img
          src="/assets/landing/galaxy/galaxy-bg-9x16.webp"
          alt=""
          decoding="async"
          loading="eager"
          fetchPriority="high"
          draggable={false}
        />
      </picture>

      <span className="landing-galaxy-contrast" />
      <span className="landing-galaxy-atmosphere" />

      <FrameStack className="landing-galaxy-breathing" frames={GALAXY_FRAMES} />

      <div className="landing-galaxy-twinkles">
        <FrameStack className="landing-galaxy-twinkle landing-galaxy-twinkle-a" frames={TWINKLE_FRAMES} />
        <FrameStack className="landing-galaxy-twinkle landing-galaxy-twinkle-b" frames={TWINKLE_FRAMES} />
        <FrameStack className="landing-galaxy-twinkle landing-galaxy-twinkle-c" frames={TWINKLE_FRAMES} />
      </div>
    </div>
  );
}
