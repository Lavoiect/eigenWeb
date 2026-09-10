<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\FormatsLearningApiResponses;
use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\CourseProgress;
use App\Models\Lesson;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CourseController extends Controller
{
    use FormatsLearningApiResponses;

    public function index(Request $request): JsonResponse
    {
        $user = $request->user()->loadMissing('organization');
        $this->assertContentContext($user);

        $courses = Course::query()
            ->visibleTo($user)
            ->with([
                'pathway',
                'assignments' => fn (HasMany|Builder $query) => $this->scopeVisibleAssignments($query, $user),
                'assignments.assignedToUser',
                'assignments.assignedToTeam',
                'assignments.assignedToJobTitle',
                'assignments.assignedToLocation',
                'assignments.assignedToPathway',
                'progressRecords' => fn ($query) => $query->where('user_id', $user->getKey()),
            ])
            ->withCount([
                'lessons' => function ($query) use ($user): void {
                    if (! $user->isSuperAdmin() && ! $user->isOrganizationAdmin()) {
                        $query->where('status', 'published');
                    }
                },
            ])
            ->orderBy('title')
            ->get()
            ->map(fn (Course $course): array => $this->coursePayload(
                $course,
                $course->progressRecords->first(),
                $course->assignments
                    ->map(fn ($assignment) => $assignment->sourceType())
                    ->unique()
                    ->values()
                    ->all(),
            ));

        return response()->json([
            'courses' => $courses->values(),
        ]);
    }

    public function show(Request $request, Course $course): JsonResponse
    {
        $user = $request->user()->loadMissing('organization');
        $this->assertContentContext($user);
        $this->authorize('view', $course);

        $course->load([
            'pathway',
            'assignments' => fn (HasMany|Builder $query) => $this->scopeVisibleAssignments($query, $user),
            'assignments.assignedToUser',
            'assignments.assignedToTeam',
            'assignments.assignedToJobTitle',
            'assignments.assignedToLocation',
            'assignments.assignedToPathway',
            'lessons' => function ($query) use ($user): void {
                $query->with([
                    'completions' => fn ($completionQuery) => $completionQuery->where(
                        'user_id',
                        $user->getKey(),
                    ),
                ]);

                if (! $user->isSuperAdmin() && ! $user->isOrganizationAdmin()) {
                    $query->where('status', 'published');
                }

                $query->orderBy('position');
            },
            'progressRecords' => fn ($query) => $query->where('user_id', $user->getKey()),
        ]);

        $progress = $course->progressRecords->first() ?? $this->makeDefaultProgress($course, $user);

        return response()->json([
            'course' => [
                ...$this->coursePayload(
                    $course,
                    $progress,
                    $course->assignments
                        ->map(fn ($assignment) => $assignment->sourceType())
                        ->unique()
                        ->values()
                        ->all(),
                ),
                'lessons' => $course->lessons->map(function (Lesson $lesson): array {
                    $completion = $lesson->completions->first();

                    return $this->lessonPayload($lesson, $completion);
                })->values(),
            ],
        ]);
    }

    private function assertContentContext(User $user): void
    {
        abort_unless(
            $user->isSuperAdmin() || $user->organization_id !== null,
            403,
            'This account is not attached to an organization.',
        );
    }

    private function makeDefaultProgress(Course $course, User $user): CourseProgress
    {
        $visibleLessonCount = $course->lessons()
            ->when(
                ! $user->isSuperAdmin() && ! $user->isOrganizationAdmin(),
                fn ($query) => $query->where('status', 'published'),
            )
            ->count();

        return new CourseProgress([
            'course_id' => $course->getKey(),
            'user_id' => $user->getKey(),
            'status' => 'not_started',
            'completed_lessons_count' => 0,
            'total_lessons_count' => $visibleLessonCount,
            'progress_percent' => 0,
            'score_percent' => null,
            'scored_questions_count' => 0,
            'correct_questions_count' => 0,
            'passed' => null,
            'completed_at' => null,
        ]);
    }

    private function scopeVisibleAssignments(Builder|HasMany $query, User $user): void
    {
        if ($user->isSuperAdmin() || $user->isOrganizationAdmin()) {
            return;
        }

        $locationIds = $user->visibleLocationIds();
        $jobTitleIds = $user->visibleJobTitleIds();

        $query->where(function (Builder $builder) use ($user, $locationIds, $jobTitleIds): void {
            $builder->where('assigned_to_user_id', $user->getKey())
                ->orWhereIn('assigned_to_team_id', $user->teams()->select('teams.id'));

            if ($user->isManager()) {
                $builder->orWhereIn(
                    'assigned_to_team_id',
                    $user->managedTeams()->select('teams.id'),
                );
            }

            if ($jobTitleIds->isNotEmpty()) {
                $builder->orWhereIn('assigned_to_job_title_id', $jobTitleIds->all());
            }

            if ($locationIds->isNotEmpty()) {
                $builder->orWhereIn('assigned_to_location_id', $locationIds->all());
            }
        });
    }
}
