<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureTeamManager
{
    public function handle(Request $request, Closure $next): Response
    {
        $team = $request->route('team');
        $user = $request->user();

        abort_unless($user && $team, 404);
        abort_unless($user->canViewTeamReporting($team), 403);

        return $next($request);
    }
}
