<?php

namespace App\Http\Middleware;

use App\Models\Organization;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();
        $managedOrganization = null;

        if ($user?->isSuperAdmin()) {
            $managedOrganization = Organization::query()
                ->find((int) $request->session()->get('managed_organization_id'));
        }

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $user,
                'is_super_admin' => $user?->isSuperAdmin() ?? false,
                'managed_organization' => $managedOrganization ? [
                    'id' => $managedOrganization->getKey(),
                    'name' => $managedOrganization->name,
                    'slug' => $managedOrganization->slug,
                    'status' => $managedOrganization->status->value,
                    'status_label' => $managedOrganization->status->label(),
                ] : null,
                'abilities' => $user ? [
                    'can_manage_users' => $user->canManageUsers(),
                    'can_author_training' => $user->canAuthorTraining(),
                    'can_assign_training' => $user->canAssignTraining(),
                    'can_view_organization_reporting' => $user->canManageOrganizationSettings(),
                    'can_view_team_reporting' => $user->canViewTeamReporting(),
                    'can_manage_resources' => $user->canManageResources(),
                    'can_view_own_training' => $user->canViewOwnTraining(),
                ] : null,
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];
    }
}
