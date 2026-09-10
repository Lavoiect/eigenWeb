import { Link, usePage } from '@inertiajs/react';
import {
    BarChart3,
    BookOpen,
    FolderOpen,
    LayoutGrid,
    Network,
    Users,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { dashboard } from '@/routes';
import { index as organizationUsers } from '@/routes/organizations/users';
import type { Auth, NavItem } from '@/types';

export function AppSidebar() {
    const { auth } = usePage<{ auth: Auth }>().props;
    const organizationId =
        auth.managed_organization?.id ?? auth.user?.organization_id ?? null;
    const mainNavItems: NavItem[] = [
        ...(auth.is_super_admin
            ? [
                  {
                      title: 'Organizations',
                      href: '/platform/organizations',
                      icon: Network,
                  },
              ]
            : []),
        {
            title: 'Dashboard',
            href: dashboard(),
            icon: LayoutGrid,
        },
        ...(auth.abilities?.can_manage_users && organizationId !== null
            ? [
                  {
                      title: 'Users',
                      href: organizationUsers(organizationId),
                      icon: Users,
                  },
              ]
            : []),
        ...(auth.abilities?.can_view_organization_reporting &&
        organizationId !== null
            ? [
                  {
                      title: 'Reports',
                      href: `/organizations/${organizationId}/reports`,
                      icon: BarChart3,
                  },
              ]
            : []),
        ...(auth.abilities?.can_author_training && organizationId !== null
            ? [
                  {
                      title: 'Training',
                      href: `/organizations/${organizationId}/courses`,
                      icon: BookOpen,
                  },
              ]
            : []),
        ...(auth.abilities?.can_manage_resources && organizationId !== null
            ? [
                  {
                      title: 'Resources',
                      href: `/organizations/${organizationId}/resources`,
                      icon: FolderOpen,
                  },
              ]
            : []),
    ];

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
