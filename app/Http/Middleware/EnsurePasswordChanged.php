<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePasswordChanged
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->requiresPasswordChange()) {
            return $next($request);
        }

        $routeName = $request->route()?->getName();

        if ($routeName !== null && in_array($routeName, [
            'security.force-edit',
            'user-password.update',
            'api.v1.me.show',
            'api.v1.me.password.update',
            'api.v1.auth.token.destroy',
        ], true)) {
            return $next($request);
        }

        if ($request->is('logout')) {
            return $next($request);
        }

        if ($request->expectsJson() || $request->is('api/*')) {
            return response()->json([
                'message' => 'Password change required.',
            ], 423);
        }

        return redirect()->route('security.force-edit');
    }
}
