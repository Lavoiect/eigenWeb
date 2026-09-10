<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureOrganizationAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $organization = $request->route('organization');
        $user = $request->user();

        abort_unless($user && $organization, 404);
        abort_unless($user->canManageOrganizationSettings($organization), 403);

        if ($user->isSuperAdmin()) {
            abort_unless(
                (int) $request->session()->get('managed_organization_id') === $organization->getKey(),
                403,
                'Enter this organization from the Eigen platform dashboard before managing it.',
            );
        }

        return $next($request);
    }
}
