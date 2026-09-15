import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { StudyReviewFlagButton } from "./StudyReviewFlagButton";

function buttonOf(renderer: ReactTestRenderer) {
  return renderer.root.findAllByType("button")[0];
}

function render(props: Partial<React.ComponentProps<typeof StudyReviewFlagButton>> = {}) {
  const onToggle = props.onToggle ?? vi.fn();
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<StudyReviewFlagButton isFlagged={false} onToggle={onToggle} {...props} />);
  });
  return { renderer, onToggle };
}

describe("StudyReviewFlagButton", () => {
  it("um clique dispara exatamente uma mutation e não propaga para o card", () => {
    const parentClick = vi.fn();
    const onToggle = vi.fn();
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        <div onClick={parentClick}>
          <StudyReviewFlagButton isFlagged={false} onToggle={onToggle} />
        </div>,
      );
    });

    const stopPropagation = vi.fn();
    act(() => {
      buttonOf(renderer).props.onClick({ preventDefault: vi.fn(), stopPropagation });
    });

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(parentClick).not.toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
  });

  it("não deixa o clique chegar ao deck por pointer/touch", () => {
    const { renderer } = render();
    const stopPropagation = vi.fn();
    act(() => {
      buttonOf(renderer).props.onPointerDown({ stopPropagation });
      buttonOf(renderer).props.onTouchStart({ stopPropagation });
    });
    expect(stopPropagation).toHaveBeenCalledTimes(2);
  });

  it("pending bloqueia o clique duplo", () => {
    const onToggle = vi.fn();
    const { renderer } = render({ isPending: true, onToggle });
    const button = buttonOf(renderer);
    expect(button.props.disabled).toBe(true);
    act(() => {
      button.props.onClick({ preventDefault: vi.fn(), stopPropagation: vi.fn() });
    });
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("mostra o estado marcado de forma acessível e distinta da Lista Vermelha", () => {
    const { renderer } = render({ isFlagged: true });
    const button = buttonOf(renderer);
    expect(button.props["data-review-flagged"]).toBe("true");
    expect(button.props["aria-pressed"]).toBe(true);
    expect(button.props["aria-label"]).toBe("Marcado para revisão");
    expect(button.props.type).toBe("button");
  });
});
