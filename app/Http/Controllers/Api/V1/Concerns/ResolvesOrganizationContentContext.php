<?php

namespace App\Http\Controllers\Api\V1\Concerns;

use App\Models\Course;
use App\Models\CourseAssignment;
use App\Models\Lesson;
use App\Models\Organization;
use App\Models\User;

trait ResolvesOrganizationContentContext
{
    protected function organizationOrFail(User $user): Organization
    {
        abort_unless($user->organization !== null, 403, 'This account is not attached to an organization.');

        return $user->organization;
    }

    protected function assertCanAuthorTraining(User $user, Organization $organization): void
    {
        $this->authorize('authorTraining', $organization);
    }

    protected function assertCanAssignTraining(User $user, Organization $organization): void
    {
        $this->authorize('assignTraining', $organization);
    }

    protected function ensureCourseInOrganization(Course $course, Organization $organization): Course
    {
        abort_unless($course->organization_id === $organization->getKey(), 404);

        return $course;
    }

    protected function ensureLessonInCourse(Lesson $lesson, Course $course): Lesson
    {
        abort_unless($lesson->course_id === $course->getKey(), 404);

        return $lesson;
    }

    protected function ensureAssignmentInCourse(CourseAssignment $assignment, Course $course): CourseAssignment
    {
        abort_unless($assignment->course_id === $course->getKey(), 404);

        return $assignment;
    }
}
