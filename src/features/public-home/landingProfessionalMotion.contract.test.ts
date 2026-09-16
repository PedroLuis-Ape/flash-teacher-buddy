import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const landing = readFileSync(path.join(process.cwd(), "src/components/landing/LandingHome.tsx"), "utf8");
const motion = readFileSync(path.join(process.cwd(), "src/features/public-home/LandingMotion.tsx"), "utf8");
const miniGame = readFileSync(path.join(process.cwd(), "src/features/public-home/LandingMiniGame.tsx"), "utf8");
const styles = readFileSync(path.join(process.cwd(), "src/styles/landing-home.css"), "utf8");
const miniGameStyles = readFileSync(path.join(process.cwd(), "src/styles/landing-mini-game.css"), "utf8");

describe("public landing professional motion contract", () => {
  it("keeps semantic editorial content and turns the hero demo into a playable mini game", () => {
    expect(landing).toContain("{page.audience}");
    expect(landing).toContain("{page.h1.replace");
    expect(landing).toContain("{page.intro[0]}");
    expect(landing).toContain("<LandingMiniGame");
    expect(landing).toContain("continueHref={primaryHref}");
    expect(miniGame).toContain("demo.prompt");
    expect(miniGame).toContain("demo.answer");
  });

  it("runs a three-round gamified loop and reshuffles after a wrong answer", () => {
    expect(miniGame).toContain('prompt: "I worked all morning."');
    expect(miniGame).toContain('prompt: "Did you study yesterday?"');
    expect(miniGame).toContain('setStatus("wrong")');
    expect(miniGame).toContain("setOptions((previous) => rotate(previous");
    expect(miniGame).toContain("Misturando as opções");
    expect(miniGame).toContain('data-game-status="complete"');
    expect(miniGameStyles).toContain("@keyframes landing-mini-deck-mix");
    expect(miniGameStyles).toContain("@keyframes landing-mini-correct");
  });

  it("keeps the mini game keyboard accessible and announces feedback", () => {
    expect(miniGame).toContain('type="button"');
    expect(miniGame).toContain('aria-live="polite"');
    expect(miniGame).toContain("landing-mini-option:focus-visible").not;
    expect(miniGameStyles).toContain(".landing-mini-option:focus-visible");
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
    expect(miniGameStyles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(miniGameStyles).toContain("@media (max-width: 760px)");
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
