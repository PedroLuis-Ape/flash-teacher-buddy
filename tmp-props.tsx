interface Props { title: string; }
export function Demo({ title }: Props) {
  return <section className="p-4">{title}</section>;
}
