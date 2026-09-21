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
        if ($course->isArchived()) {
            $course->assignments()->delete();

            return;
        }

        if (
            $previousPathwayId !== null
            && $previousPathwayId !== $course->pathway_id
        ) {
            $course->assignments()
                ->where('assigned_to_pathway_id', $previousPathwayId)
                ->delete();
        }

        if (! $course->isPublished() || $course->pathway_id === null) {
            $course->assignments()
                ->whereNotNull('assigned_to_pathway_id')
                ->delete();

            return;
        }

        $pathway = $course->pathway()->first();

        if ($pathway === null) {
            return;
        }

        $users = $course->organization->users()
            ->with(['jobTitle'])
            ->whereHas('jobTitle', fn ($query) => $query->where('pathway_id', $pathway->getKey()))
            ->get();

        $currentAssignments = $course->assignments()
            ->where('assigned_to_pathway_id', $pathway->getKey());

        if ($users->isEmpty()) {
            $currentAssignments->delete();
        } else {
            $currentAssignments
                ->whereNotIn('assigned_to_user_id', $users->pluck('id')->all())
                ->delete();
        }

        foreach ($users as $user) {
            $this->createAssignmentIfMissing($course, $user, $pathway);
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

        $pathway = $user->jobTitle?->pathway;

        if ($pathway === null) {
            $user->courseAssignments()
                ->whereNotNull('assigned_to_pathway_id')
                ->delete();

            return;
        }

        $user->courseAssignments()
            ->whereNotNull('assigned_to_pathway_id')
            ->where('assigned_to_pathway_id', '!=', $pathway->getKey())
            ->delete();

        $courses = $pathway->courses()
            ->where('status', 'published')
            ->get();

        $currentAssignments = $user->courseAssignments()
            ->where('assigned_to_pathway_id', $pathway->getKey());

        if ($courses->isEmpty()) {
            $currentAssignments->delete();
        } else {
            $currentAssignments
                ->whereNotIn('course_id', $courses->pluck('id')->all())
                ->delete();
        }

        foreach ($courses as $course) {
            $this->createAssignmentIfMissing($course, $user, $pathway);
        }
    }

    private function createAssignmentIfMissing(Course $course, User $user, Pathway $pathway): void
    {
        $course->assignments()->firstOrCreate(
            [
                'assigned_to_user_id' => $user->getKey(),
                'assigned_to_pathway_id' => $pathway->getKey(),
            ],
            [
                'assigned_by_id' => null,
                'due_at' => $pathway->completionDueAt(),
            ],
        );
    }
}
