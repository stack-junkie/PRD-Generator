'use client';

import { Inter } from 'next/font/google';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from '../contexts/SessionContext';
import './globals.css';

// Font configuration
const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});


// Since this is now a client component, we'll handle metadata differently

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
      <body className="min-h-screen bg-gradient-to-br from-gray-50 to-white text-gray-900 antialiased">
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            {/* Error boundary would go here */}
            <div className="flex flex-col min-h-screen">
              <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-sm">P</span>
                      </div>
                      <h1 className="text-xl font-bold text-gray-900 m-0">PRD-Maker</h1>
                    </div>
                    <nav className="hidden md:flex items-center space-x-6">
                      <a href="/" className="text-gray-600 hover:text-gray-900 transition-colors">Home</a>
                      <a href="/library" className="text-gray-600 hover:text-gray-900 transition-colors">Library</a>
                      <a href="/templates" className="text-gray-600 hover:text-gray-900 transition-colors">Templates</a>
                    </nav>
                  </div>
                </div>
              </header>
              <main className="flex-1">{children}</main>
              <footer className="bg-gray-50 border-t border-gray-200 py-8">
                <div className="container mx-auto px-4 text-center text-gray-600">
                  <p>© 2024 PRD-Maker. Built with AI assistance.</p>
                </div>
              </footer>
            </div>
          </SessionProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}