import type { Metadata, Viewport } from 'next';
import { Newsreader, Inter } from 'next/font/google';
import './globals.css';
import SubscriptionGuard from '@/components/SubscriptionGuard';
import { ThemeProvider } from '@/lib/ThemeContext';
import { SessionProvider } from '@/lib/SessionContext';
import { ToastProvider } from '@/components/ToastProvider';

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
  title: 'Portal de Cursos Online · Plataforma de Aprendizado & IA',
  description:
    'Plataforma completa de cursos online, mentorias, desafios práticos e consultoria com inteligência artificial.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Portal do Aluno',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: 'https://curso.curtatche.com.br/icone_coaet.png',
    apple: 'https://curso.curtatche.com.br/icone_coaet.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
    { media: '(prefers-color-scheme: light)', color: '#f7f6f8' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-br" className={`${newsreader.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        {/*
          Aplica o tema salvo antes do primeiro paint (evita o flash escuro→claro).
          Esta é a ÚNICA fonte de verdade inicial; o ThemeProvider assume depois.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('app_theme')==='light'?'light':'dark';var r=document.documentElement;r.classList.add(t);r.classList.remove(t==='dark'?'light':'dark');r.style.colorScheme=t;}catch(e){document.documentElement.classList.add('dark');}})();`,
          }}
        />
      </head>
      <body
        className="bg-[#f7f6f8] dark:bg-[#000000] text-slate-900 dark:text-slate-100 min-h-screen font-sans transition-colors duration-200"
        suppressHydrationWarning
      >
        <SessionProvider>
          <ThemeProvider>
            <ToastProvider>
              <SubscriptionGuard>{children}</SubscriptionGuard>
            </ToastProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
