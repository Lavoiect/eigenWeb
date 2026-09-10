<?php

namespace App\Services;

use App\Models\CourseAssignment;
use App\Models\OrganizationResource;
use App\Models\User;
use Illuminate\Support\Collection;

class NotificationRecipientResolver
{
    /**
     * @return Collection<int, User>
     */
    public function forAssignment(CourseAssignment $assignment): Collection
    {
        $assignment->loadMissing([
            'assignedToUser',
            'assignedToTeam.members',
            'assignedToTeam.managers',
            'assignedToJobTitle.users',
            'assignedToLocation.users',
        ]);

        return match (true) {
            $assignment->assigned_to_user_id !== null => collect([$assignment->assignedToUser]),
            $assignment->assigned_to_team_id !== null => $assignment->assignedToTeam?->members
                ->concat($assignment->assignedToTeam?->managers ?? collect())
                ->filter()
                ->unique('id')
                ->values() ?? collect(),
            $assignment->assigned_to_job_title_id !== null => $assignment->assignedToJobTitle?->users
                ->filter()
                ->unique('id')
                ->values() ?? collect(),
            $assignment->assigned_to_location_id !== null => $assignment->assignedToLocation?->users
                ->filter()
                ->unique('id')
                ->values() ?? collect(),
            default => collect(),
        };
    }

    /**
     * @return Collection<int, User>
     */
    public function forResource(OrganizationResource $resource): Collection
    {
        $query = User::query()
            ->where('organization_id', $resource->organization_id)
            ->whereNull('deactivated_at');

        if ($resource->audience_everyone) {
            return $query->get()->unique('id')->values();
        }

        $jobTitleIds = $resource->job_title_ids ?? [];
        $teamIds = $resource->team_ids ?? [];
        $locationIds = $resource->location_ids ?? [];

        if ($jobTitleIds !== [] || $teamIds !== [] || $locationIds !== []) {
            $query->where(function ($recipientQuery) use ($jobTitleIds, $teamIds, $locationIds): void {
                if ($jobTitleIds !== []) {
                    $recipientQuery->whereIn('job_title_id', $jobTitleIds);
                }

                if ($locationIds !== []) {
                    $method = $jobTitleIds === [] ? 'whereIn' : 'orWhereIn';
                    $recipientQuery->{$method}('location_id', $locationIds);
                }

                if ($teamIds !== []) {
                    $method = $jobTitleIds === [] && $locationIds === [] ? 'whereHas' : 'orWhereHas';
                    $recipientQuery->{$method}('teams', fn ($teamQuery) => $teamQuery->whereIn('teams.id', $teamIds));
                }
            });

            return $query->get()->unique('id')->values();
        }

        $query->where(function ($recipientQuery) use ($resource): void {
            if ($resource->organization_role === null) {
                $recipientQuery->whereNotNull('id');
            } else {
                $recipientQuery->where('organization_role', $resource->organization_role);
            }

            if ($resource->course_id !== null) {
                $recipientQuery->orWhereHas('courseAssignments', function ($assignmentQuery) use ($resource): void {
                    $assignmentQuery->where('course_id', $resource->course_id);
                });
            }
        });

        return $query->get()->unique('id')->values();
    }
}
