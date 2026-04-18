import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Quiniela Giro',
  description: 'Giro d\u2019Italia pickem',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
