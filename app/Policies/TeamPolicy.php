<?php

namespace App\Policies;

use App\Models\Team;
use App\Models\User;

class TeamPolicy
{
    public function view(User $user, Team $team): bool
    {
        return $user->canViewTeam($team);
    }

    public function viewMembers(User $user, Team $team): bool
    {
        return $user->canViewTeam($team);
    }

    public function assignTraining(User $user, Team $team): bool
    {
        return $user->canAssignTraining($team);
    }

    public function viewReporting(User $user, Team $team): bool
    {
        return $user->canViewTeamReporting($team);
    }

    public function sendReminders(User $user, Team $team): bool
    {
        return $user->canViewTeamReporting($team);
    }
}
