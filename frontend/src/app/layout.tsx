import { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { SessionProvider } from '../contexts/SessionContext';
import { DefaultSeo } from 'next-seo';
import './globals.css';

// Font configuration
const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

// SEO configuration
const SEO_CONFIG = {
  titleTemplate: '%s | PRD-Maker',
  defaultTitle: 'PRD-Maker - Professional PRD Generator',
  description: 'Create professional product requirement documents with AI assistance',
  canonical: 'https://prd-maker.example.com',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://prd-maker.example.com',
    siteName: 'PRD-Maker',
    title: 'PRD-Maker - Professional PRD Generator',
    description: 'Create professional product requirement documents with AI assistance',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'PRD-Maker',
      },
    ],
  },
  twitter: {
    handle: '@prdmaker',
    site: '@prdmaker',
    cardType: 'summary_large_image',
  },
};

// Metadata for SEO
export const metadata: Metadata = {
  title: 'PRD-Maker - Professional PRD Generator',
  description: 'Create professional product requirement documents with AI assistance',
  keywords: 'PRD, product requirements, documentation, AI, product management',
  authors: [{ name: 'PRD-Maker Team' }],
  viewport: 'width=device-width, initial-scale=1',
  icons: {
    icon: '/favicon.ico',
  },
};

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <DefaultSeo {...SEO_CONFIG} />
      </head>
      <body className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <QueryClientProvider client={queryClient}>
            <SessionProvider>
              {/* Error boundary would go here */}
              <div className="flex flex-col min-h-screen">
                {/* Header could go here */}
                <main className="flex-1">{children}</main>
                {/* Footer could go here */}
              </div>
            </SessionProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}