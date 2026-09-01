import type {Metadata} from 'next';
import { Newsreader, Inter } from 'next/font/google';
import './globals.css';
import SubscriptionGuard from '@/components/SubscriptionGuard';
import { ThemeProvider } from '@/lib/ThemeContext';
import MediaProtection from '@/components/MediaProtection';

const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['200', '300', '400', '500', '600', '700', '800'],
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Canva com IA - O Desafio',
  description: 'Canva com IA - O Desafio',
  icons: {
    icon: 'https://curso.curtatche.com.br/icone_coaet.png',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-br" className={`${newsreader.variable} ${inter.variable} dark`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var savedTheme = localStorage.getItem('app_theme');
              if (savedTheme === 'light') {
                document.documentElement.classList.remove('dark');
                document.documentElement.classList.add('light');
              } else {
                document.documentElement.classList.add('dark');
                document.documentElement.classList.remove('light');
              }
            } catch (e) {}

            var originalFetch = window.fetch;
            try {
              Object.defineProperty(window, 'fetch', {
                get: function() { return originalFetch; },
                set: function(v) { console.warn('Attempt to override fetch blocked:', v); },
                configurable: true
              });
            } catch (e) {}
          })();
        ` }} />
      </head>
      <body className="bg-[#f7f6f8] dark:bg-[#000000] text-slate-900 dark:text-slate-100 min-h-screen font-sans transition-colors duration-200" suppressHydrationWarning>
        <MediaProtection />
        <ThemeProvider>
          <SubscriptionGuard>
            {children}
          </SubscriptionGuard>
        </ThemeProvider>
      </body>
    </html>
  );
}
