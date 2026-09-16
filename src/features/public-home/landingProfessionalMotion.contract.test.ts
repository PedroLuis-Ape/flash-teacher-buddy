import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const landing = readFileSync(path.join(process.cwd(), "src/components/landing/LandingHome.tsx"), "utf8");
const motion = readFileSync(path.join(process.cwd(), "src/features/public-home/LandingMotion.tsx"), "utf8");
const styles = readFileSync(path.join(process.cwd(), "src/styles/landing-home.css"), "utf8");

describe("public landing professional motion contract", () => {
  it("keeps semantic editorial content and native demo disclosure in the source", () => {
    expect(landing).toContain("{page.audience}");
    expect(landing).toContain("{page.h1.replace");
    expect(landing).toContain("{page.intro[0]}");
    expect(landing).toContain('<details className="landing-demo-answer">');
    expect(landing).toContain("{demo.answer}");
  });

  it("provides progressive reveals that do not require JavaScript to make content visible", () => {
    expect(motion).toContain("Progressive-enhancement reveal");
    expect(motion).toContain('data-motion-enabled={enabled ? "true" : "false"}');
    expect(styles).toContain('.landing-motion-reveal[data-motion-enabled="true"][data-in-view="false"]');
    expect(styles).not.toContain('.landing-motion-reveal[data-in-view="false"] { opacity: 0');
  });

  it("supports reduced motion and coarse/mobile fallbacks", () => {
    expect(motion).toContain("(prefers-reduced-motion: reduce)");
    expect(motion).toContain("(pointer: fine)");
    expect(motion).toContain("(min-width: 761px)");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toContain("@media (max-width: 760px)");
  });

  it("uses passive observation only and never hijacks wheel or touch scrolling", () => {
    expect(motion).toContain('window.addEventListener("scroll", update, { passive: true })');
    expect(motion).not.toContain('addEventListener("wheel"');
    expect(motion).not.toContain('addEventListener("touchmove"');
    expect(motion).not.toContain("preventDefault()");
  });

  it("keeps 3D tilt restrained and adds a three-step scroll story", () => {
    expect(landing).toContain("usePointerTilt<HTMLDivElement>({ maxTilt: 4");
    expect(landing).toContain("useLandingStoryProgress<HTMLElement>");
    expect(landing).toContain('className="landing-story-visual"');
    expect(styles).toContain("perspective(1100px)");
    expect(styles).toContain('.landing-story-visual[data-active-step="2"]');
  });
});
