import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';

export function DashboardLayout() {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 md:pl-64">
        <div className="mx-auto max-w-7xl p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
