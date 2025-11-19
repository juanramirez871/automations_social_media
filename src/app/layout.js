import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata = {
  title: 'ChatLevel',
  description: 'ChatLevel es una plataforma de chatbot para redes sociales.',
};

export default function RootLayout({ children }) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.addEventListener('DOMContentLoaded', () => { if (window.HSStaticMethods && window.HSStaticMethods.autoInit) { window.HSStaticMethods.autoInit(); } });`,
          }}
        />
      </body>
    </html>
  );
}
