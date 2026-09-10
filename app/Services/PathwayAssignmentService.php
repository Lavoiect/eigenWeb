<?php

namespace App\Services;

use App\Models\Course;
use App\Models\JobTitle;
use App\Models\Pathway;
use App\Models\User;

class PathwayAssignmentService
{
    public function syncCourse(Course $course, ?int $previousPathwayId = null): void
    {
        if ($previousPathwayId !== null) {
            $course->assignments()
                ->where('assigned_to_pathway_id', $previousPathwayId)
                ->delete();
        }

        if (! $course->isPublished()) {
            return;
        }

        $pathway = $course->pathway;

        if ($pathway === null) {
            return;
        }

        $users = $course->organization->users()
            ->with(['jobTitle'])
            ->whereHas('jobTitle', fn ($query) => $query->where('pathway_id', $pathway->getKey()))
            ->get();

        foreach ($users as $user) {
            $this->upsertAssignment($course, $user, $pathway->getKey());
        }
    }

    public function syncJobTitle(JobTitle $jobTitle): void
    {
        $users = $jobTitle->users()
            ->with(['organization', 'jobTitle'])
            ->get();

        foreach ($users as $user) {
            $this->syncUser($user);
        }
    }

    public function syncUser(User $user): void
    {
        $user->load(['jobTitle.pathway']);

        $user->courseAssignments()
            ->whereNotNull('assigned_to_pathway_id')
            ->delete();

        $pathway = $user->jobTitle?->pathway;

        if ($pathway === null) {
            return;
        }

        $courses = $pathway->courses()
            ->where('status', 'published')
            ->get();

        foreach ($courses as $course) {
            $this->upsertAssignment($course, $user, $pathway->getKey());
        }
    }

    private function upsertAssignment(Course $course, User $user, int $pathwayId): void
    {
        $course->assignments()->updateOrCreate(
            [
                'assigned_to_user_id' => $user->getKey(),
                'assigned_to_pathway_id' => $pathwayId,
            ],
            [
                'assigned_by_id' => null,
                'due_at' => null,
            ],
        );
    }
}
