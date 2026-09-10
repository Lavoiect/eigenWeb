<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\FormatsLearningApiResponses;
use App\Http\Controllers\Controller;
use App\Models\CourseAssignment;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AssignmentController extends Controller
{
    use FormatsLearningApiResponses;

    public function index(Request $request): JsonResponse
    {
        $user = $request->user()->loadMissing('organization');
        $this->assertContentContext($user);

        $assignmentQuery = CourseAssignment::query()
            ->with([
                'course.assignments.assignedToUser',
                'course.assignments.assignedToTeam',
                'course.assignments.assignedToJobTitle',
                'course.assignments.assignedToLocation',
                'course.assignments.assignedToPathway',
                'course.progressRecords' => fn ($query) => $query->where('user_id', $user->getKey()),
                'assignedToUser',
                'assignedToTeam',
                'assignedToJobTitle',
                'assignedToLocation',
                'assignedToPathway',
                'assignedBy',
            ])
            ->whereHas('course', fn ($query) => $query->visibleTo($user));

        if ($user->isOrganizationAdmin() || $user->isSuperAdmin()) {
            $assignments = $assignmentQuery
                ->orderByDesc('created_at')
                ->get()
                ->unique('id')
                ->values()
                ->map(function (CourseAssignment $assignment) use ($user): array {
                    $progress = $assignment->course->progressRecords->first();

                    return $this->assignmentPayload($assignment, $user, $progress);
                });
        } else {
            $assignments = $assignmentQuery
                ->where(function ($query) use ($user): void {
                    $query->where('assigned_to_user_id', $user->getKey())
                        ->orWhereIn('assigned_to_team_id', $user->teams()->select('teams.id'));

                    if ($user->isManager()) {
                        $query->orWhereIn('assigned_to_team_id', $user->managedTeams()->select('teams.id'));
                    }

                    $jobTitleIds = $user->visibleJobTitleIds();
                    $locationIds = $user->visibleLocationIds();

                    if ($jobTitleIds->isNotEmpty()) {
                        $query->orWhereIn('assigned_to_job_title_id', $jobTitleIds->all());
                    }

                    if ($locationIds->isNotEmpty()) {
                        $query->orWhereIn('assigned_to_location_id', $locationIds->all());
                    }
                })
                ->orderByDesc('created_at')
                ->get()
                ->unique('id')
                ->values()
                ->map(function (CourseAssignment $assignment) use ($user): array {
                    $progress = $assignment->course->progressRecords->first();

                    return $this->assignmentPayload($assignment, $user, $progress);
                });
        }

        return response()->json([
            'assignments' => $assignments,
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
}
