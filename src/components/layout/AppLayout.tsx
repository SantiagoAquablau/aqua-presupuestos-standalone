import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';

export function AppLayout() {
  return (
    <div className="min-h-screen w-full bg-background">
      <AppSidebar />
      <div className="md:ml-[var(--sidebar-width,260px)] transition-all duration-300">
        <main className="flex-1 overflow-auto pb-20 md:pb-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
