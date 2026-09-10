<?php

namespace App\Policies;

use App\Models\Organization;
use App\Models\User;

class OrganizationPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isSuperAdmin();
    }

    public function view(User $user, Organization $organization): bool
    {
        return $user->canAccessOrganization($organization);
    }

    public function create(User $user): bool
    {
        return $user->isSuperAdmin();
    }

    public function update(User $user, Organization $organization): bool
    {
        return $user->canManageOrganizationSettings($organization);
    }

    public function manageUsers(User $user, Organization $organization): bool
    {
        return $user->canManageUsers($organization);
    }

    public function manageTeams(User $user, Organization $organization): bool
    {
        return $user->canManageTeams($organization);
    }

    public function authorTraining(User $user, Organization $organization): bool
    {
        return $user->canAuthorTraining($organization);
    }

    public function assignTraining(User $user, Organization $organization): bool
    {
        return $user->canAssignTraining($organization);
    }

    public function manageResources(User $user, Organization $organization): bool
    {
        return $user->canManageResources($organization);
    }

    public function viewReporting(User $user, Organization $organization): bool
    {
        return $user->canViewOrganizationReporting($organization);
    }

    public function viewKnowledgeGaps(User $user, Organization $organization): bool
    {
        return $user->canViewKnowledgeGaps($organization);
    }

    public function manageMicrolearning(User $user, Organization $organization): bool
    {
        return $user->canManageMicrolearning($organization);
    }

    public function inviteMembers(User $user, Organization $organization): bool
    {
        return $user->canInviteMembers($organization);
    }
}
