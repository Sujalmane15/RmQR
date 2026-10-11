import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'RMQR — Dynamic QR Codes, Digital Menus, Landing Pages & Google Review Growth',
  description:
    'Create, customize, manage, and track dynamic QR codes, mobile business landing pages, AI digital restaurant menus, and Google Review growth flows with RMQR.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col font-sans">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
