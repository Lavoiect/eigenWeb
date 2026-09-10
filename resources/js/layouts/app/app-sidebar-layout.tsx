import { router, usePage } from '@inertiajs/react';
import { Building2, LogOut } from 'lucide-react';
import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { AppSidebar } from '@/components/app-sidebar';
import { AppSidebarHeader } from '@/components/app-sidebar-header';
import { Button } from '@/components/ui/button';
import type { AppLayoutProps, Auth } from '@/types';

export default function AppSidebarLayout({
    children,
    breadcrumbs = [],
}: AppLayoutProps) {
    const { auth } = usePage<{ auth: Auth }>().props;
    const managedOrganization = auth.managed_organization;

    return (
        <AppShell variant="sidebar">
            <AppSidebar />
            <AppContent variant="sidebar" className="min-w-0 overflow-x-clip">
                <AppSidebarHeader breadcrumbs={breadcrumbs} />
                {managedOrganization && (
                    <div className="mx-4 mt-4 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm sm:mx-6 sm:flex-row sm:items-center sm:justify-between dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                        <div className="flex items-center gap-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-200/70 dark:bg-amber-800/60">
                                <Building2 className="size-4" />
                            </span>
                            <div>
                                <p className="text-xs font-semibold tracking-[0.16em] uppercase opacity-70">
                                    Customer workspace
                                </p>
                                <p className="font-semibold">
                                    Managing: {managedOrganization.name}
                                </p>
                            </div>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="border-amber-400 bg-white/70 hover:bg-white dark:border-amber-700 dark:bg-amber-950/60"
                            onClick={() =>
                                router.delete(
                                    '/platform/organization-context',
                                )
                            }
                        >
                            <LogOut />
                            Exit organization
                        </Button>
                    </div>
                )}
                {children}
            </AppContent>
        </AppShell>
    );
}
