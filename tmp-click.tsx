interface Props { onRun: () => void; }
export function Clicker({ onRun }: Props) {
  return <button onClick={onRun}>Run</button>;
}
