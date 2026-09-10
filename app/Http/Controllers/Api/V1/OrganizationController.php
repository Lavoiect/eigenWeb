<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\FormatsMobileApiResponses;
use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\Team;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class OrganizationController extends Controller
{
    use FormatsMobileApiResponses;

    public function show(Request $request): JsonResponse
    {
        $user = $request->user()->loadMissing('organization');
        $organization = $this->organizationOrFail($user);

        return response()->json([
            'organization' => $this->organizationPayload($organization),
            'abilities' => $this->abilitiesPayload($user, $organization),
            'summary' => [
                'users' => $organization->users()->count(),
                'teams' => $organization->teams()->count(),
                'invitations' => $organization->invitations()->count(),
            ],
        ]);
    }

    public function users(Request $request): JsonResponse
    {
        $user = $request->user()->loadMissing('organization');
        $organization = $this->organizationOrFail($user);

        $visibleUsers = $this->visibleUsers($user, $organization);

        return response()->json([
            'users' => $visibleUsers
                ->map(fn (User $visibleUser): array => $this->visibleUserPayload($user, $visibleUser))
                ->values(),
        ]);
    }

    public function teams(Request $request): JsonResponse
    {
        $user = $request->user()->loadMissing('organization');
        $organization = $this->organizationOrFail($user);

        return response()->json([
            'teams' => $this->visibleTeams($user, $organization)
                ->map(fn (Team $team): array => $this->teamPayload($team, $this->userScope($user)))
                ->values(),
        ]);
    }

    public function invitations(Request $request): JsonResponse
    {
        $user = $request->user()->loadMissing('organization');
        $organization = $this->organizationOrFail($user);

        $this->authorize('inviteMembers', $organization);

        $invitations = $organization->invitations()
            ->with(['invitedBy', 'acceptedBy'])
            ->latest()
            ->get()
            ->map(fn (OrganizationInvitation $invite): array => [
                'id' => $invite->id,
                'email' => $invite->email,
                'organization_role' => $invite->organization_role->value,
                'organization_role_label' => $invite->organization_role->label(),
                'status' => $invite->status(),
                'status_label' => $invite->statusLabel(),
                'invite_url' => route('invitations.show', ['invite' => $invite->token]),
                'created_at' => $invite->created_at?->toIso8601String(),
                'expires_at' => $invite->expires_at?->toIso8601String(),
                'accepted_at' => $invite->accepted_at?->toIso8601String(),
                'revoked_at' => $invite->revoked_at?->toIso8601String(),
                'invited_by' => $invite->invitedBy?->only('id', 'name', 'email'),
                'accepted_by' => $invite->acceptedBy?->only('id', 'name', 'email'),
            ]);

        return response()->json([
            'invitations' => $invitations->values(),
        ]);
    }

    private function organizationOrFail(User $user): Organization
    {
        abort_unless($user->organization !== null, 403, 'This account is not attached to an organization.');

        return $user->organization;
    }

    /**
     * @return Collection<int, User>
     */
    private function visibleUsers(User $user, Organization $organization): Collection
    {
        if ($user->isOrganizationAdmin() || $user->isSuperAdmin()) {
            return $organization->users()
                ->with(['teams', 'managedTeams'])
                ->orderBy('name')
                ->get();
        }

        if ($user->isManager()) {
            return $user->managedTeams()
                ->with(['members', 'members.teams', 'members.managedTeams'])
                ->get()
                ->flatMap(fn (Team $team): Collection => $team->members)
                ->push($user)
                ->unique('id')
                ->values();
        }

        return collect([$user->loadMissing(['teams', 'managedTeams'])]);
    }

    /**
     * @return Collection<int, Team>
     */
    private function visibleTeams(User $user, Organization $organization): Collection
    {
        if ($user->isOrganizationAdmin() || $user->isSuperAdmin()) {
            return $organization->teams()->orderBy('name')->get();
        }

        if ($user->isManager()) {
            return $user->managedTeams()->orderBy('teams.name')->get();
        }

        return $user->teams()->orderBy('teams.name')->get();
    }

    private function visibleUserPayload(User $currentUser, User $visibleUser): array
    {
        $assignedTeams = $visibleUser->isManager()
            ? $visibleUser->managedTeams
            : $visibleUser->teams;

        return [
            ...$this->userPayload($visibleUser),
            'is_current_user' => $currentUser->is($visibleUser),
            'team_assignment_mode' => $visibleUser->isOrganizationAdmin()
                ? 'admin'
                : ($visibleUser->isManager() ? 'manager' : 'learner'),
            'assigned_team_ids' => $assignedTeams?->pluck('id')->values()->all() ?? [],
            'assigned_team_names' => $assignedTeams?->pluck('name')->values()->all() ?? [],
        ];
    }
}
