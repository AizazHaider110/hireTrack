import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAppSelector, useAppDispatch } from '@/app/hooks';
import { selectCurrentUser } from '@/features/auth';
import { toggleSidebar, selectSidebarCollapsed } from '@/features/ui';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const user = useAppSelector(selectCurrentUser);
  const collapsed = useAppSelector(selectSidebarCollapsed);
  const dispatch = useAppDispatch();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  const handleToggleSidebar = () => {
    dispatch(toggleSidebar());
  };

  const handleMobileMenuClick = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <div className="relative min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar
          collapsed={collapsed}
          onToggle={handleToggleSidebar}
          userRole={user?.role}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed left-0 top-0 z-50 h-screen md:hidden">
            <Sidebar
              collapsed={false}
              onToggle={() => setMobileMenuOpen(false)}
              userRole={user?.role}
            />
          </div>
        </>
      )}

      {/* Main Content */}
      <div
        className={cn(
          'flex min-h-screen flex-col transition-all duration-300',
          'md:ml-16',
          !collapsed && 'md:ml-64'
        )}
      >
        <Header onMenuClick={handleMobileMenuClick} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
