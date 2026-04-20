export function Dot({ size = 8, color }: { size?: number; color: string }) {
  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: 999, background: color, flex: 'none' }} />;
}
