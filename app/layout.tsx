import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'LEAVE X — College leave workspace', description: 'A shared college leave workflow for students, mentors, and HODs.' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
