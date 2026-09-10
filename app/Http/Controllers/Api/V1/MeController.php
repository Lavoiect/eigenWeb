<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\FormatsMobileApiResponses;
use App\Models\Team;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeController
{
    use FormatsMobileApiResponses;

    public function show(Request $request): JsonResponse
    {
        $user = $request->user()->loadMissing('organization');

        return response()->json([
            'user' => $this->userPayload($user),
            'organization' => $this->organizationPayload($user->organization),
            'abilities' => $this->abilitiesPayload($user, $user->organization),
            'teams' => $user->requiresPasswordChange()
                ? []
                : $this->visibleTeamsPayload($user),
        ]);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function visibleTeamsPayload(User $user): array
    {
        if ($user->organization_id === null) {
            return [];
        }

        if ($user->isOrganizationAdmin() || $user->isSuperAdmin()) {
            return $user->organization
                ->teams()
                ->orderBy('name')
                ->get()
                ->map(fn (Team $team): array => $this->teamPayload($team, 'organization'))
                ->all();
        }

        if ($user->isManager()) {
            return $user->managedTeams()
                ->orderBy('teams.name')
                ->get()
                ->map(fn (Team $team): array => $this->teamPayload($team, 'managed'))
                ->all();
        }

        return $user->teams()
            ->orderBy('teams.name')
            ->get()
            ->map(fn (Team $team): array => $this->teamPayload($team, 'self'))
            ->all();
    }
}
