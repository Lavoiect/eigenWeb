<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\FormatsLearningApiResponses;
use App\Http\Controllers\Api\V1\Concerns\ResolvesOrganizationContentContext;
use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\CourseAssignment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use App\Services\ExpoPushService;
use App\Services\NotificationRecipientResolver;

class OrganizationCourseAssignmentController extends Controller
{
    use FormatsLearningApiResponses;
    use ResolvesOrganizationContentContext;

    public function store(
        Request $request,
        Course $course,
        ExpoPushService $pushService,
        NotificationRecipientResolver $recipientResolver,
    ): JsonResponse {
        $user = $request->user()->loadMissing('organization');
        $organization = $this->organizationOrFail($user);
        $this->assertCanAssignTraining($user, $organization);
        $this->ensureCourseInOrganization($course, $organization);

        $validated = $request->validate([
            'assigned_to_user_id' => [
                'nullable',
                'integer',
                Rule::exists('users', 'id')->where(fn ($query) => $query->where('organization_id', $organization->getKey())),
            ],
            'assigned_to_team_id' => [
                'nullable',
                'integer',
                Rule::exists('teams', 'id')->where(fn ($query) => $query->where('organization_id', $organization->getKey())),
            ],
            'assigned_to_job_title_id' => [
                'nullable',
                'integer',
                Rule::exists('job_titles', 'id')->where(fn ($query) => $query->where('organization_id', $organization->getKey())),
            ],
            'assigned_to_location_id' => [
                'nullable',
                'integer',
                Rule::exists('locations', 'id')->where(fn ($query) => $query->where('organization_id', $organization->getKey())),
            ],
            'due_at' => ['nullable', 'date'],
            'is_required' => ['sometimes', 'boolean'],
            'recurs_every_days' => ['nullable', 'integer', 'min:1', 'max:365'],
        ]);

        $hasUserTarget = filled($validated['assigned_to_user_id'] ?? null);
        $hasTeamTarget = filled($validated['assigned_to_team_id'] ?? null);
        $hasJobTitleTarget = filled($validated['assigned_to_job_title_id'] ?? null);
        $hasLocationTarget = filled($validated['assigned_to_location_id'] ?? null);

        if (($hasUserTarget ? 1 : 0) + ($hasTeamTarget ? 1 : 0) + ($hasJobTitleTarget ? 1 : 0) + ($hasLocationTarget ? 1 : 0) !== 1) {
            throw ValidationException::withMessages([
                'assigned_to_user_id' => ['Choose exactly one target for the assignment.'],
                'assigned_to_team_id' => ['Choose exactly one target for the assignment.'],
                'assigned_to_job_title_id' => ['Choose exactly one target for the assignment.'],
                'assigned_to_location_id' => ['Choose exactly one target for the assignment.'],
            ]);
        }

        $assignment = CourseAssignment::query()->updateOrCreate(
            [
                'course_id' => $course->getKey(),
                'assigned_to_user_id' => $validated['assigned_to_user_id'] ?? null,
                'assigned_to_team_id' => $validated['assigned_to_team_id'] ?? null,
                'assigned_to_job_title_id' => $validated['assigned_to_job_title_id'] ?? null,
                'assigned_to_location_id' => $validated['assigned_to_location_id'] ?? null,
            ],
            [
                'assigned_by_id' => $user->getKey(),
                'due_at' => $validated['due_at'] ?? null,
                'is_required' => $validated['is_required'] ?? true,
                'recurs_every_days' => $validated['recurs_every_days'] ?? null,
            ],
        );

        $assignment->load(['course', 'assignedBy', 'assignedToUser', 'assignedToTeam', 'assignedToJobTitle', 'assignedToLocation', 'assignedToPathway']);

        if ($assignment->wasRecentlyCreated) {
            $pushService->sendToUsers(
                $recipientResolver->forAssignment($assignment),
                'New assignment',
                sprintf('New training assigned: %s', $assignment->course->title),
                [
                    'type' => 'new_assignment',
                    'url' => sprintf('/training?courseId=%s', $assignment->course->id),
                    'courseId' => (string) $assignment->course->id,
                    'assignmentId' => (string) $assignment->id,
                ],
            );
        }

        return response()->json([
            'assignment' => $this->assignmentPayload($assignment, $user),
        ], $assignment->wasRecentlyCreated ? 201 : 200);
    }

    public function destroy(Request $request, Course $course, CourseAssignment $assignment): Response
    {
        $user = $request->user()->loadMissing('organization');
        $organization = $this->organizationOrFail($user);
        $this->assertCanAssignTraining($user, $organization);
        $this->ensureCourseInOrganization($course, $organization);
        $this->ensureAssignmentInCourse($assignment, $course);

        $assignment->delete();

        return response()->noContent();
    }
}
