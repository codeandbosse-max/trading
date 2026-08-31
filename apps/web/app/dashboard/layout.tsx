'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Topbar } from '@/components/dashboard/topbar';
import { SignalBridge } from '@/components/dashboard/signal-bridge';
import { StoreProvider } from '@/lib/store';
import { Toaster } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <StoreProvider>
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full animate-slide-in-right">
            <div className="relative h-full">
              <Sidebar />
              <button
                className="absolute right-3 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted"
                onClick={() => setMobileOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className={cn('mx-auto max-w-7xl p-4 md:p-6 lg:p-8')}>{children}</div>
        </main>
      </div>
      <SignalBridge />
      <Toaster />
    </div>
    </StoreProvider>
  );
}
