<?php

namespace App\Http\Controllers\Api\V1\Concerns;

use App\Enums\PlatformRole;
use App\Models\Organization;
use App\Models\Team;
use App\Models\User;

trait FormatsMobileApiResponses
{
    protected function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'organization_id' => $user->organization_id,
            'organization_role' => $user->organization_role?->value,
            'organization_role_label' => $user->organization_role?->label(),
            'platform_role' => $user->platform_role?->value,
            'platform_role_label' => $user->platform_role?->label(),
            'must_change_password' => $user->must_change_password,
            'deactivated_at' => $user->deactivated_at?->toIso8601String(),
            'email_verified_at' => $user->email_verified_at?->toIso8601String(),
        ];
    }

    protected function organizationPayload(?Organization $organization): ?array
    {
        if ($organization === null) {
            return null;
        }

        return [
            'id' => $organization->id,
            'name' => $organization->name,
            'slug' => $organization->slug,
            'logo_url' => $organization->logo_url,
            'primary_color' => $organization->primary_color,
        ];
    }

    protected function abilitiesPayload(User $user, ?Organization $organization): array
    {
        return [
            'can_manage_users' => $user->canManageUsers($organization),
            'can_author_training' => $user->isSuperAdmin() || $user->isOrganizationAdmin(),
            'can_assign_training' => $user->isSuperAdmin()
                || $user->isOrganizationAdmin()
                || $user->isManager(),
            'can_view_organization_reporting' => $user->isSuperAdmin()
                || $user->isOrganizationAdmin(),
            'can_view_team_reporting' => $user->isSuperAdmin()
                || $user->isOrganizationAdmin()
                || $user->isManager(),
            'can_manage_resources' => $user->isSuperAdmin() || $user->isOrganizationAdmin(),
            'can_view_team' => $user->canViewTeam(),
            'can_view_own_training' => $user->canViewOwnTraining(),
            'is_super_admin' => $user->platform_role === PlatformRole::SuperAdmin,
            'organization_role' => $user->organization_role?->value,
            'organization_role_label' => $user->organization_role?->label(),
        ];
    }

    protected function teamPayload(Team $team, string $scope): array
    {
        return [
            'id' => $team->id,
            'organization_id' => $team->organization_id,
            'name' => $team->name,
            'description' => $team->description,
            'scope' => $scope,
        ];
    }

    protected function userScope(User $user): string
    {
        return match (true) {
            $user->isOrganizationAdmin() => 'organization',
            $user->isManager() => 'managed',
            default => 'self',
        };
    }
}
