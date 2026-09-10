<?php

namespace App\Policies;

use App\Models\Lesson;
use App\Models\User;

class LessonPolicy
{
    public function view(User $user, Lesson $lesson): bool
    {
        return $user->canViewLesson($lesson);
    }

    public function complete(User $user, Lesson $lesson): bool
    {
        return $user->canCompleteLesson($lesson);
    }
}
