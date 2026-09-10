<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\FormatsMobileApiResponses;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TeamController
{
    use FormatsMobileApiResponses;

    public function index(Request $request): JsonResponse
    {
        $user = $request->user()->loadMissing('organization');

        if ($user->organization_id === null) {
            return response()->json([
                'teams' => [],
            ]);
        }

        $teams = match (true) {
            $user->isOrganizationAdmin(), $user->isSuperAdmin() => $user->organization
                ->teams()
                ->orderBy('name')
                ->get()
                ->map(fn (Team $team): array => $this->teamPayload($team, 'organization'))
                ->all(),
            $user->isManager() => $user->managedTeams()
                ->orderBy('teams.name')
                ->get()
                ->map(fn (Team $team): array => $this->teamPayload($team, 'managed'))
                ->all(),
            default => $user->teams()
                ->orderBy('teams.name')
                ->get()
                ->map(fn (Team $team): array => $this->teamPayload($team, 'self'))
                ->all(),
        };

        return response()->json([
            'teams' => $teams,
        ]);
    }

    public function show(Request $request, Team $team): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->canViewTeam($team), 403);

        return response()->json([
            'team' => $this->teamPayload($team, $this->userScope($user)),
        ]);
    }
}
