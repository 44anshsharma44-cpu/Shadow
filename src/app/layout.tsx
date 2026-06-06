import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import ClientLayout from '@/components/ClientLayout';
import Navbar from '@/components/Navbar';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Shadow Boxing AI — Real-time Motion Web Game',
  description:
    'Track your real-world punches, hooks, and blocks through your webcam using MediaPipe AI and compete in an animated boxing ring right in your browser.',
  keywords: 'shadow boxing, AI pose detection, webcam game, media pipe, web boxing game, browser game, shadow cricket style',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full dark`}>
      <body className="min-h-full flex flex-col bg-[#0b0c10] text-[#c5c6c7] antialiased">
        <ClientLayout>
          <Navbar />
          <main className="flex-1 flex flex-col">{children}</main>
        </ClientLayout>
      </body>
    </html>
  );
}
