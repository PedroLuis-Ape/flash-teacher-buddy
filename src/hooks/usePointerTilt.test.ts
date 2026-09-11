import { describe, expect, it } from "vitest";
import { calculatePointerTilt } from "./usePointerTilt";

const rect = { left: 100, top: 50, width: 200, height: 100 };

describe("calculatePointerTilt", () => {
  it("maps the center to zero tilt and center highlight", () => {
    expect(calculatePointerTilt(rect, 200, 100)).toEqual({
      tiltX: 0,
      tiltY: 0,
      pointerX: 50,
      pointerY: 50,
    });
  });

  it("clamps pointer coordinates and respects the tilt limit", () => {
    expect(calculatePointerTilt(rect, 500, -100, 4)).toEqual({
      tiltX: 4,
      tiltY: 4,
      pointerX: 100,
      pointerY: 0,
    });
  });
});
