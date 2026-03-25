import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Calendar,
  Mail,
  BarChart3,
  UsersRound,
  Database,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { UserRole } from '@ats/types';

export interface NavItem {
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: number;
  requiredRoles?: UserRole[];
}

const navigationItems: NavItem[] = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/',
    requiredRoles: ['ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'VIEWER'],
  },
  {
    label: 'Pipeline',
    icon: Users,
    path: '/pipeline',
    requiredRoles: ['ADMIN', 'RECRUITER', 'HIRING_MANAGER'],
  },
  {
    label: 'Candidates',
    icon: Users,
    path: '/candidates',
    requiredRoles: ['ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER'],
  },
  {
    label: 'Jobs',
    icon: Briefcase,
    path: '/jobs',
    requiredRoles: ['ADMIN', 'RECRUITER', 'HIRING_MANAGER'],
  },
  {
    label: 'Interviews',
    icon: Calendar,
    path: '/interviews',
    requiredRoles: ['ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER'],
  },
  {
    label: 'Communication',
    icon: Mail,
    path: '/communication',
    requiredRoles: ['ADMIN', 'RECRUITER', 'HIRING_MANAGER'],
  },
  {
    label: 'Analytics',
    icon: BarChart3,
    path: '/analytics',
    requiredRoles: ['ADMIN', 'HIRING_MANAGER'],
  },
  {
    label: 'Teams',
    icon: UsersRound,
    path: '/teams',
    requiredRoles: ['ADMIN', 'HIRING_MANAGER'],
  },
  {
    label: 'Talent Pool',
    icon: Database,
    path: '/talent-pool',
    requiredRoles: ['ADMIN', 'RECRUITER', 'HIRING_MANAGER'],
  },
  {
    label: 'Settings',
    icon: Settings,
    path: '/settings',
    requiredRoles: ['ADMIN'],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  userRole?: UserRole;
}

export function Sidebar({ collapsed, onToggle, userRole }: SidebarProps) {
  const location = useLocation();
  
  // Filter navigation items based on user role
  const filteredItems = userRole
    ? navigationItems.filter((item) =>
        !item.requiredRoles || item.requiredRoles.includes(userRole)
      )
    : navigationItems;

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen border-r bg-background transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo/Brand */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <span className="text-sm font-bold">ATS</span>
              </div>
              <span className="text-lg font-semibold">Recruit</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className={cn('h-8 w-8', collapsed && 'mx-auto')}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">
            {filteredItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;

              return (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    className={cn(
                      'w-full justify-start',
                      collapsed && 'justify-center px-2'
                    )}
                  >
                    <Icon className={cn('h-5 w-5', !collapsed && 'mr-3')} />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.badge !== undefined && item.badge > 0 && (
                          <Badge variant="secondary" className="ml-auto">
                            {item.badge}
                          </Badge>
                        )}
                      </>
                    )}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </ScrollArea>
      </div>
    </aside>
  );
}
