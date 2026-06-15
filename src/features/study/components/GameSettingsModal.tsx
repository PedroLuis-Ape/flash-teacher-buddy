import { lazy, Suspense, type ComponentProps } from "react";

export type { GameSettings } from "./GameSettingsModal.impl";

const LazyGameSettingsModal = lazy(() =>
  import("./GameSettingsModal.impl").then((module) => ({ default: module.GameSettingsModal }))
);

type GameSettingsModalProps = ComponentProps<typeof LazyGameSettingsModal>;

export const GameSettingsModal = (props: GameSettingsModalProps) => (
  <Suspense fallback={null}>
    <LazyGameSettingsModal {...props} />
  </Suspense>
);
