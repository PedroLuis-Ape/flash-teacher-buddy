interface Props { amount: number; }
export function SmallComponent({ amount }: Props) {
  return (
    <div className="p-3">
      <p>Saldo</p>
      <strong>{amount}</strong>
    </div>
  );
}
