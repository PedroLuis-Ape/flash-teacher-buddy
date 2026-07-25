import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LayeredCardHintButton } from "./LayeredCardHintButton";

describe("LayeredCardHintButton", () => {
  it("renders nothing when the card has a single layer", () => {
    const { container } = render(
      <LayeredCardHintButton layerCount={1} onOpen={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows remaining count and accessible label with multiple layers", () => {
    render(<LayeredCardHintButton layerCount={3} visitedCount={0} onOpen={() => {}} />);
    const button = screen.getByRole("button", { name: /explorar camadas deste card/i });
    expect(button.textContent).toContain("+3");
  });

  it("switches to visited state when all layers were seen", () => {
    render(<LayeredCardHintButton layerCount={3} visitedCount={3} onOpen={() => {}} />);
    const button = screen.getByRole("button", { name: /explorar camadas deste card/i });
    expect(button.textContent).toContain("Camadas vistas");
  });

  it("invokes onOpen when clicked", () => {
    const onOpen = vi.fn();
    render(<LayeredCardHintButton layerCount={2} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: /explorar camadas deste card/i }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});