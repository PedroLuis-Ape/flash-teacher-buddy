import { describe, expect, it } from "vitest";
import { naturalSort } from "./sorting";

describe("naturalSort", () => {
  it("puts the most recently used item first", () => {
    const result = naturalSort(
      [
        { id: "older", title: "A", last_activity: "2026-06-20T10:00:00Z", order_index: 1 },
        { id: "newer", title: "Z", last_activity: "2026-06-21T10:00:00Z", order_index: 99 },
        { id: "unused", title: "B", last_activity: null, order_index: 2 },
      ],
      (item) => item.title,
    );

    expect(result.map((item) => item.id)).toEqual(["newer", "older", "unused"]);
  });

  it("uses saved positions before titles when there is no activity", () => {
    const result = naturalSort(
      [
        { id: "a", title: "A", order_index: 2 },
        { id: "z", title: "Z", order_index: 1 },
      ],
      (item) => item.title,
    );

    expect(result.map((item) => item.id)).toEqual(["z", "a"]);
  });

  it("falls back to natural title order for legacy items without a positive position", () => {
    const result = naturalSort(
      [
        { title: "Lista 10", order_index: 0 },
        { title: "Lista 2", order_index: null },
      ],
      (item) => item.title,
    );

    expect(result.map((item) => item.title)).toEqual(["Lista 2", "Lista 10"]);
  });

  it("treats an invalid activity timestamp as no activity", () => {
    const result = naturalSort(
      [
        { title: "Lista 10", last_activity: "invalid" },
        { title: "Lista 2", last_activity: null },
      ],
      (item) => item.title,
    );

    expect(result.map((item) => item.title)).toEqual(["Lista 2", "Lista 10"]);
  });
});
