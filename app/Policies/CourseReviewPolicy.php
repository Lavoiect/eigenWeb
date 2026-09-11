<?php

namespace App\Policies;

use App\Models\CourseReview;
use App\Models\User;

class CourseReviewPolicy
{
    public function view(User $user, CourseReview $review): bool
    {
        if (! $user->canAccessOrganization($review->organization)) {
            return false;
        }

        return $user->isSuperAdmin()
            || $user->isOrganizationAdmin()
            || $review->submitted_by_id === $user->getKey()
            || $review->reviewer_id === $user->getKey();
    }

    public function comment(User $user, CourseReview $review): bool
    {
        return $this->view($user, $review);
    }

    public function decide(User $user, CourseReview $review): bool
    {
        return $review->reviewer_id === $user->getKey()
            && $user->canReviewTraining($review->organization);
    }
}
