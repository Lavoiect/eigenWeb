<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\CourseAssignment;
use App\Models\CourseProgress;
use App\Models\LessonCompletion;
use App\Models\Organization;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function show(Request $request): Response|RedirectResponse
    {
        $user = $request->user()->loadMissing(['organization', 'teams', 'managedTeams']);
        $rangeKey = $this->resolveRangeKey($request->string('range')->toString());
        $range = $this->resolveRange($rangeKey);

        if ($user->isSuperAdmin()) {
            $managedOrganizationId = (int) $request->session()->get('managed_organization_id');

            if (! $managedOrganizationId) {
                return redirect()->route('platform.organizations.index');
            }

            $organization = Organization::query()->find($managedOrganizationId);

            if (! $organization) {
                $request->session()->forget('managed_organization_id');

                return redirect()->route('platform.organizations.index');
            }
        } else {
            $organization = $user->organization;
        }

        if ($organization === null) {
            abort(403, 'Your account is not assigned to an organization.');
        }

        $payload = $this->buildPayload($user, $organization, $rangeKey, $range);

        return Inertia::render('dashboard', $payload);
    }

    private function buildPayload(
        User $user,
        Organization $organization,
        string $rangeKey,
        array $range,
    ): array {
        $isOrganizationScope = $user->isSuperAdmin() || $user->isOrganizationAdmin();
        $visibleUsers = $this->visibleUsers($user, $organization);
        $visibleTeams = $this->visibleTeams($user, $organization);
        $courseSummaries = $this->courseSummaries(
            $organization,
            $visibleUsers,
            $visibleTeams,
            $isOrganizationScope,
        );

        $recentActivity = $this->recentActivity(
            $organization,
            $visibleUsers,
            $visibleTeams,
            $range,
            $isOrganizationScope,
        );
        $activeLearnerIds = $this->activeLearnerIds($visibleUsers, $range);

        $teamComparison = $this->teamComparison(
            $organization,
            $visibleTeams,
            $visibleUsers,
            $range,
        );

        $metrics = $this->metrics($visibleUsers, $courseSummaries, $activeLearnerIds);

        return [
            'overview' => [
                'scope_label' => $this->scopeLabel($user, $organization),
                'scope_description' => $this->scopeDescription($user),
                'date_range' => [
                    'key' => $rangeKey,
                    'label' => $range['label'],
                    'display_label' => $range['display_label'],
                    'start' => $range['start']?->toIso8601String(),
                    'end' => $range['end']->toIso8601String(),
                    'options' => $this->rangeOptions(),
                ],
                'metrics' => $metrics,
                'training_progress' => $this->trainingProgress($courseSummaries),
                'attention_items' => $courseSummaries
                    ->filter(fn (array $summary): bool => $summary['needs_attention'])
                    ->sortByDesc('priority')
                    ->take(4)
                    ->values()
                    ->all(),
                'recent_activity' => $recentActivity->take(5)->values()->all(),
                'team_comparison' => $teamComparison->take(4)->values()->all(),
            ],
        ];
    }

    /**
     * @return Collection<int, User>
     */
    private function visibleUsers(User $user, Organization $organization): Collection
    {
        if ($user->isSuperAdmin() || $user->isOrganizationAdmin()) {
            return $organization->users()
                ->with(['teams', 'managedTeams'])
                ->orderBy('name')
                ->get();
        }

        if ($user->isManager()) {
            $teamIds = $user->managedTeams()->select('teams.id');

            return $organization->users()
                ->where(function ($query) use ($user, $teamIds): void {
                    $query->whereKey($user->getKey())
                        ->orWhereHas('teams', fn ($teamQuery) => $teamQuery->whereIn('teams.id', $teamIds));
                })
                ->with(['teams', 'managedTeams'])
                ->orderBy('name')
                ->get();
        }

        return $organization->users()
            ->whereKey($user->getKey())
            ->with(['teams', 'managedTeams'])
            ->get();
    }

    /**
     * @return Collection<int, Team>
     */
    private function visibleTeams(User $user, Organization $organization): Collection
    {
        if ($user->isSuperAdmin() || $user->isOrganizationAdmin()) {
            return $organization->teams()
                ->with(['members', 'managers'])
                ->orderBy('name')
                ->get();
        }

        if ($user->isManager()) {
            return $user->managedTeams()
                ->with(['members', 'managers'])
                ->orderBy('teams.name')
                ->get();
        }

        return $user->teams()
            ->with(['members', 'managers'])
            ->orderBy('teams.name')
            ->get();
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function courseSummaries(
        Organization $organization,
        Collection $visibleUsers,
        Collection $visibleTeams,
        bool $organizationScope,
    ): Collection {
        $courses = $organization->courses()
            ->with([
                'assignments.assignedToUser',
                'assignments.assignedToTeam.members',
                'assignments.assignedToJobTitle',
                'assignments.assignedToLocation',
                'progressRecords.user',
                'lessons',
            ])
            ->orderBy('title')
            ->get();

        $teamIds = $visibleTeams->pluck('id')->all();
        $userIds = $visibleUsers->pluck('id')->all();

        return $courses->map(function (Course $course) use ($organization, $teamIds, $userIds, $visibleUsers, $organizationScope): array {
            $recipients = $this->courseRecipients($course, $visibleUsers, $userIds, $teamIds);
            $progressRecords = $course->progressRecords
                ->filter(fn (CourseProgress $progress): bool => isset($recipients[$progress->user_id]))
                ->keyBy('user_id');
            $completedRecords = $progressRecords->filter(fn (CourseProgress $progress): bool => $progress->completed_at !== null || $progress->status === 'completed');
            $scoreValues = $progressRecords->pluck('score_percent')->filter(fn ($score): bool => $score !== null)->values();
            $averageScore = $scoreValues->isNotEmpty()
                ? (int) round($scoreValues->avg())
                : null;
            $recipientCount = count($recipients);
            $completedCount = $completedRecords->count();
            $statusCounts = [
                'completed' => 0,
                'in_progress' => 0,
                'overdue' => 0,
                'not_started' => 0,
            ];
            $affectedUserIds = collect();

            foreach ($recipients as $recipient) {
                $progress = $progressRecords->get($recipient['user_id']);
                $isCompleted = $progress !== null
                    && ($progress->completed_at !== null || $progress->status === 'completed');
                $isOverdue = ! $isCompleted
                    && $recipient['due_at'] !== null
                    && $recipient['due_at']->isPast();

                if ($isCompleted) {
                    $statusCounts['completed']++;
                } elseif ($isOverdue) {
                    $statusCounts['overdue']++;
                    $affectedUserIds->push($recipient['user_id']);
                } elseif ($progress !== null && ($progress->status === 'in_progress' || $progress->progress_percent > 0)) {
                    $statusCounts['in_progress']++;
                } else {
                    $statusCounts['not_started']++;
                }
            }

            $overdueCount = $statusCounts['overdue'];
            $completionRate = $recipientCount > 0
                ? (int) round(($completedCount / $recipientCount) * 100)
                : 0;

            $reasons = [];

            if ($overdueCount > 0) {
                $reasons[] = $overdueCount.' overdue '.($overdueCount === 1 ? 'assignment' : 'assignments');
            }

            if ($averageScore !== null && $course->passing_score !== null && $averageScore < $course->passing_score) {
                $reasons[] = "average score {$averageScore}% is below the {$course->passing_score}% passing score";

                $progressRecords
                    ->filter(fn (CourseProgress $progress): bool => $progress->score_percent !== null && $progress->score_percent < $course->passing_score)
                    ->each(fn (CourseProgress $progress) => $affectedUserIds->push($progress->user_id));
            }

            if ($recipientCount > 0 && $completionRate < 75) {
                $reasons[] = "completion is at {$completionRate}%";

                collect($recipients)
                    ->reject(function (array $recipient) use ($progressRecords): bool {
                        $progress = $progressRecords->get($recipient['user_id']);

                        return $progress !== null
                            && ($progress->completed_at !== null || $progress->status === 'completed');
                    })
                    ->each(fn (array $recipient) => $affectedUserIds->push($recipient['user_id']));
            }

            $isRelevant = $organizationScope
                || $recipientCount > 0
                || $progressRecords->isNotEmpty();

            return [
                'id' => $course->id,
                'title' => $course->title,
                'subject' => $course->subject,
                'course' => $course->subject ?: 'Course',
                'passing_score' => $course->passing_score,
                'recipient_count' => $recipientCount,
                'affected_learners' => $affectedUserIds->unique()->count(),
                'completed_count' => $completedCount,
                'in_progress_count' => $statusCounts['in_progress'],
                'not_started_count' => $statusCounts['not_started'],
                'overdue_count' => $overdueCount,
                'completion_rate' => $completionRate,
                'average_score' => $averageScore,
                'needs_attention' => $reasons !== [],
                'priority' => ($overdueCount * 3) + ($averageScore !== null && $course->passing_score !== null && $averageScore < $course->passing_score ? 2 : 0) + ($recipientCount > 0 && $completionRate < 75 ? 1 : 0),
                'reasons' => $reasons,
                'reason' => ucfirst(implode('; ', $reasons)).($reasons === [] ? '' : '.'),
                'last_activity_at' => $course->updated_at?->toIso8601String(),
                'is_relevant' => $isRelevant,
                'course_url' => "/organizations/{$organization->getKey()}/courses/{$course->getKey()}",
            ];
        });
    }

    /**
     * @return array<int, array{user_id:int,due_at:CarbonImmutable|null}>
     */
    private function courseRecipients(Course $course, Collection $visibleUsers, array $visibleUserIds, array $visibleTeamIds): array
    {
        $recipients = [];

        foreach ($course->assignments as $assignment) {
            if ($assignment->assigned_to_user_id !== null) {
                if (! in_array($assignment->assigned_to_user_id, $visibleUserIds, true)) {
                    continue;
                }

                $current = $recipients[$assignment->assigned_to_user_id] ?? null;
                $dueAt = $assignment->due_at?->toImmutable();

                if ($current === null || ($dueAt !== null && ($current['due_at'] === null || $dueAt->isBefore($current['due_at'])))) {
                    $recipients[$assignment->assigned_to_user_id] = [
                        'user_id' => $assignment->assigned_to_user_id,
                        'due_at' => $dueAt,
                    ];
                }

                continue;
            }

            if ($assignment->assigned_to_team_id !== null) {
                if (! in_array($assignment->assigned_to_team_id, $visibleTeamIds, true)) {
                    continue;
                }

                foreach ($assignment->assignedToTeam?->members ?? [] as $member) {
                    if (! in_array($member->id, $visibleUserIds, true)) {
                        continue;
                    }

                    $current = $recipients[$member->id] ?? null;
                    $dueAt = $assignment->due_at?->toImmutable();

                    if ($current === null || ($dueAt !== null && ($current['due_at'] === null || $dueAt->isBefore($current['due_at'])))) {
                        $recipients[$member->id] = [
                            'user_id' => $member->id,
                            'due_at' => $dueAt,
                        ];
                    }
                }

                continue;
            }

            if ($assignment->assigned_to_job_title_id === null) {
                if ($assignment->assigned_to_location_id === null) {
                    continue;
                }

                $dueAt = $assignment->due_at?->toImmutable();

                foreach ($visibleUsers as $member) {
                    if ($member->location_id !== $assignment->assigned_to_location_id) {
                        continue;
                    }

                    $current = $recipients[$member->id] ?? null;

                    if ($current === null || ($dueAt !== null && ($current['due_at'] === null || $dueAt->isBefore($current['due_at'])))) {
                        $recipients[$member->id] = [
                            'user_id' => $member->id,
                            'due_at' => $dueAt,
                        ];
                    }
                }

                continue;
            }

            $dueAt = $assignment->due_at?->toImmutable();

            foreach ($visibleUsers as $member) {
                if ($member->job_title_id !== $assignment->assigned_to_job_title_id) {
                    continue;
                }

                $current = $recipients[$member->id] ?? null;

                if ($current === null || ($dueAt !== null && ($current['due_at'] === null || $dueAt->isBefore($current['due_at'])))) {
                    $recipients[$member->id] = [
                        'user_id' => $member->id,
                        'due_at' => $dueAt,
                    ];
                }
            }
        }

        return $recipients;
    }

    /**
     * @param  array<int, array<string, mixed>>  $courseSummaries
     */
    private function metrics(Collection $visibleUsers, Collection $courseSummaries, Collection $activeLearnerIds): array
    {
        $totalEmployees = $visibleUsers->count();
        $activeLearners = $visibleUsers->filter(function (User $visibleUser) use ($activeLearnerIds): bool {
            return $visibleUser->isLearner()
                && $activeLearnerIds->contains($visibleUser->getKey());
        })->count();

        $recipientCount = $courseSummaries->sum('recipient_count');
        $completedCount = $courseSummaries->sum('completed_count');
        $completionRate = $recipientCount > 0
            ? (int) round(($completedCount / $recipientCount) * 100)
            : 0;

        $overdueAssignments = $courseSummaries->sum('overdue_count');
        $averageScoreValues = $courseSummaries->pluck('average_score')->filter(fn ($score): bool => $score !== null)->values();
        $averageScore = $averageScoreValues->isNotEmpty()
            ? (int) round($averageScoreValues->avg())
            : null;
        $attentionCount = $courseSummaries->where('needs_attention', true)->count();

        return [
            'total_employees' => $totalEmployees,
            'active_learners' => $activeLearners,
            'completion_rate' => $completionRate,
            'overdue_assignments' => $overdueAssignments,
            'average_assessment_score' => $averageScore,
            'training_requiring_attention' => $attentionCount,
        ];
    }

    private function trainingProgress(Collection $courseSummaries): array
    {
        return [
            'completed' => $courseSummaries->sum('completed_count'),
            'in_progress' => $courseSummaries->sum('in_progress_count'),
            'overdue' => $courseSummaries->sum('overdue_count'),
            'not_started' => $courseSummaries->sum('not_started_count'),
        ];
    }

    private function activeLearnerIds(Collection $visibleUsers, array $range): Collection
    {
        $userIds = $visibleUsers->pluck('id')->all();

        $lessonCompletionUserIds = LessonCompletion::query()
            ->whereIn('user_id', $userIds)
            ->when($range['start'] !== null, fn ($query) => $query->whereBetween('completed_at', [$range['start'], $range['end']]))
            ->when($range['start'] === null, fn ($query) => $query->where('completed_at', '<=', $range['end']))
            ->pluck('user_id');

        $courseCompletionUserIds = CourseProgress::query()
            ->whereIn('user_id', $userIds)
            ->whereNotNull('completed_at')
            ->when($range['start'] !== null, fn ($query) => $query->whereBetween('completed_at', [$range['start'], $range['end']]))
            ->when($range['start'] === null, fn ($query) => $query->where('completed_at', '<=', $range['end']))
            ->pluck('user_id');

        return $lessonCompletionUserIds
            ->merge($courseCompletionUserIds)
            ->unique()
            ->values();
    }

    private function recentActivity(
        Organization $organization,
        Collection $visibleUsers,
        Collection $visibleTeams,
        array $range,
        bool $organizationScope,
    ): Collection {
        $userIds = $visibleUsers->pluck('id')->all();
        $teamIds = $visibleTeams->pluck('id')->all();
        $jobTitleIds = $visibleUsers->pluck('job_title_id')->filter()->unique()->values()->all();
        $locationIds = $visibleUsers->pluck('location_id')->filter()->unique()->values()->all();

        $assignments = CourseAssignment::query()
            ->with(['course', 'assignedToUser', 'assignedToTeam', 'assignedToJobTitle', 'assignedToLocation', 'assignedToPathway'])
            ->whereHas('course', fn ($query) => $query->where('organization_id', $organization->getKey()))
            ->when($range['start'] !== null, fn ($query) => $query->whereBetween('created_at', [$range['start'], $range['end']]))
            ->when($range['start'] === null, fn ($query) => $query->where('created_at', '<=', $range['end']))
            ->when(! $organizationScope, function ($query) use ($userIds, $teamIds, $jobTitleIds, $locationIds): void {
                $query->where(function ($nested) use ($userIds, $teamIds, $jobTitleIds, $locationIds): void {
                    $nested->whereIn('assigned_to_user_id', $userIds)
                        ->orWhereIn('assigned_to_team_id', $teamIds);

                    if ($jobTitleIds !== []) {
                        $nested->orWhereIn('assigned_to_job_title_id', $jobTitleIds);
                    }

                    if ($locationIds !== []) {
                        $nested->orWhereIn('assigned_to_location_id', $locationIds);
                    }
                });
            })
            ->latest('created_at')
            ->limit(6)
            ->get()
            ->map(function (CourseAssignment $assignment): array {
                $recipientLabel = match (true) {
                    $assignment->assigned_to_user_id !== null => $assignment->assignedToUser?->name ?? 'User',
                    $assignment->assigned_to_pathway_id !== null => $assignment->assignedToPathway?->name ?? 'Pathway',
                    $assignment->assigned_to_team_id !== null => $assignment->assignedToTeam?->name ?? 'Team',
                    $assignment->assigned_to_location_id !== null => $assignment->assignedToLocation?->name ?? 'Location',
                    default => $assignment->assignedToJobTitle?->name ?? 'Job title',
                };

                return [
                    'type' => 'assignment_created',
                    'type_label' => 'Assignment created',
                    'title' => $assignment->course->title.' assigned to '.$recipientLabel,
                    'detail' => $assignment->due_at
                        ? 'Due '.$assignment->due_at->format('M j, Y')
                        : 'No due date set',
                    'timestamp' => $assignment->created_at?->toIso8601String(),
                    'user_id' => $assignment->assigned_to_user_id,
                ];
            });

        $lessonCompletions = LessonCompletion::query()
            ->with(['lesson.course', 'user'])
            ->whereIn('user_id', $userIds)
            ->when($range['start'] !== null, fn ($query) => $query->whereBetween('completed_at', [$range['start'], $range['end']]))
            ->when($range['start'] === null, fn ($query) => $query->where('completed_at', '<=', $range['end']))
            ->latest('completed_at')
            ->limit(6)
            ->get()
            ->map(function (LessonCompletion $completion): array {
                return [
                    'type' => 'lesson_completed',
                    'type_label' => 'Lesson completed',
                    'title' => $completion->user->name.' completed “'.$completion->lesson->title.'”',
                    'detail' => 'Lesson in '.$completion->lesson->course->title,
                    'timestamp' => $completion->completed_at?->toIso8601String(),
                    'user_id' => $completion->user_id,
                ];
            });

        $courseCompletions = CourseProgress::query()
            ->with(['course', 'user'])
            ->whereIn('user_id', $userIds)
            ->whereNotNull('completed_at')
            ->when($range['start'] !== null, fn ($query) => $query->whereBetween('completed_at', [$range['start'], $range['end']]))
            ->when($range['start'] === null, fn ($query) => $query->where('completed_at', '<=', $range['end']))
            ->latest('completed_at')
            ->limit(6)
            ->get()
            ->map(function (CourseProgress $progress): array {
                return [
                    'type' => 'course_completed',
                    'type_label' => 'Course completed',
                    'title' => $progress->user->name.' completed “'.$progress->course->title.'”',
                    'detail' => $progress->score_percent !== null
                        ? 'Score: '.$progress->score_percent.'%'
                        : 'No score recorded',
                    'timestamp' => $progress->completed_at?->toIso8601String(),
                    'user_id' => $progress->user_id,
                ];
            });

        return $assignments
            ->concat($lessonCompletions)
            ->concat($courseCompletions)
            ->sortByDesc('timestamp')
            ->take(6)
            ->values();
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function teamComparison(
        Organization $organization,
        Collection $visibleTeams,
        Collection $visibleUsers,
        array $range,
    ): Collection {
        if ($visibleTeams->isEmpty()) {
            return collect();
        }

        return $visibleTeams->map(function (Team $team) use ($organization, $visibleUsers, $range): array {
            $teamUsers = $team->members
                ->merge($team->managers)
                ->unique('id')
                ->values();
            $teamVisibleUsers = $visibleUsers->whereIn('id', $teamUsers->pluck('id')->all())->values();
            $teamVisibleTeams = collect([$team]);
            $summaries = $this->courseSummaries(
                $organization,
                $teamVisibleUsers,
                $teamVisibleTeams,
                false,
            )->filter(fn (array $summary): bool => $summary['is_relevant']);

            $recipientCount = $summaries->sum('recipient_count');
            $completedCount = $summaries->sum('completed_count');
            $completionRate = $recipientCount > 0
                ? (int) round(($completedCount / $recipientCount) * 100)
                : 0;
            $averageScoreValues = $summaries->pluck('average_score')->filter(fn ($score): bool => $score !== null)->values();
            $averageScore = $averageScoreValues->isNotEmpty()
                ? (int) round($averageScoreValues->avg())
                : null;
            $activeLearners = $this->activeLearnerIds($teamVisibleUsers, $range)
                ->intersect($teamVisibleUsers->filter(fn (User $member): bool => $member->isLearner())->pluck('id'))
                ->count();

            return [
                'id' => $team->id,
                'name' => $team->name,
                'member_count' => $teamUsers->count(),
                'active_learners' => $activeLearners,
                'completion_rate' => $completionRate,
                'overdue_assignments' => $summaries->sum('overdue_count'),
                'average_score' => $averageScore,
            ];
        })->sortByDesc('completion_rate')->values();
    }

    private function resolveRangeKey(string $rangeKey): string
    {
        $allowed = array_column($this->rangeOptions(), 'value');

        return in_array($rangeKey, $allowed, true) ? $rangeKey : '30d';
    }

    private function resolveRange(string $rangeKey): array
    {
        $end = CarbonImmutable::now()->endOfDay();

        return match ($rangeKey) {
            '7d' => $this->buildRange('7d', 'Last 7 days', $end->subDays(6)->startOfDay(), $end),
            '30d' => $this->buildRange('30d', 'Last 30 days', $end->subDays(29)->startOfDay(), $end),
            '90d' => $this->buildRange('90d', 'Last 90 days', $end->subDays(89)->startOfDay(), $end),
            'qtd' => $this->buildRange('qtd', 'Quarter to date', $end->startOfQuarter(), $end),
            'ytd' => $this->buildRange('ytd', 'Year to date', $end->startOfYear(), $end),
            default => $this->buildRange('all', 'All time', null, $end),
        };
    }

    private function buildRange(string $key, string $label, ?CarbonImmutable $start, CarbonImmutable $end): array
    {
        $displayLabel = $start
            ? $start->format('M j, Y').' - '.$end->format('M j, Y')
            : 'All available activity';

        return [
            'key' => $key,
            'label' => $label,
            'display_label' => $displayLabel,
            'start' => $start,
            'end' => $end,
        ];
    }

    /**
     * @return array<int, array{value: string, label: string}>
     */
    private function rangeOptions(): array
    {
        return [
            ['value' => '7d', 'label' => 'Last 7 days'],
            ['value' => '30d', 'label' => 'Last 30 days'],
            ['value' => '90d', 'label' => 'Last 90 days'],
            ['value' => 'qtd', 'label' => 'Quarter to date'],
            ['value' => 'ytd', 'label' => 'Year to date'],
            ['value' => 'all', 'label' => 'All time'],
        ];
    }

    private function scopeLabel(User $user, Organization $organization): string
    {
        if ($user->isOrganizationAdmin() || $user->isSuperAdmin()) {
            return $organization->name;
        }

        if ($user->isManager()) {
            $teamNames = $user->managedTeams->pluck('name')->filter()->values();

            if ($teamNames->isNotEmpty()) {
                return $teamNames->count() === 1
                    ? $teamNames->first()
                    : $teamNames->take(2)->implode(', ').($teamNames->count() > 2 ? ' +' : '');
            }
        }

        return $user->name;
    }

    private function scopeDescription(User $user): string
    {
        if ($user->isOrganizationAdmin() || $user->isSuperAdmin()) {
            return 'Organization-wide metrics, training progress, and attention items.';
        }

        if ($user->isManager()) {
            return 'Metrics scoped to your assigned teams and the people you manage.';
        }

        return 'Your personal learning progress and training activity.';
    }
}
