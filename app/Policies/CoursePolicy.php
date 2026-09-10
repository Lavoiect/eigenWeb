<?php

namespace App\Policies;

use App\Models\Course;
use App\Models\Organization;
use App\Models\User;

class CoursePolicy
{
    public function viewAny(User $user, Organization $organization): bool
    {
        return $user->canAccessOrganization($organization);
    }

    public function view(User $user, Course $course): bool
    {
        return $user->canViewCourse($course);
    }

    public function completeLesson(User $user, Course $course): bool
    {
        return $user->canViewCourse($course);
    }

    public function manage(User $user, Organization $organization): bool
    {
        return $user->canAuthorTraining($organization);
    }

    public function assign(User $user, Organization $organization): bool
    {
        return $user->canAssignTraining($organization);
    }
}
