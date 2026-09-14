import React from "react";
import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { ReferenceIdControl } from "./ReferenceIdControl";

describe("ReferenceIdControl", () => {
  it("copies the displayed reference without triggering the parent surface", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { clipboard: { writeText } },
    });

    const renderer = create(<ReferenceIdControl entityLabel="lista" referenceId="L-7M2Q9K" />);
    const button = renderer.root.findByType("button");
    const stopPropagation = vi.fn();

    await act(async () => {
      await button.props.onClick({ stopPropagation });
    });

    expect(button.props["aria-label"]).toContain("L-7M2Q9K");
    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(writeText).toHaveBeenCalledWith("L-7M2Q9K");
  });
});
