<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\CourseProgress;
use App\Models\LessonCompletion;
use App\Models\LessonQuestionAttempt;
use App\Models\Organization;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class OrganizationReportingController extends Controller
{
    public function index(Request $request, Organization $organization): Response
    {
        $this->authorize('viewReporting', $organization);

        $rangeKey = $this->resolveRangeKey($request->string('range')->toString());
        $range = $this->resolveRange($rangeKey);
        $filters = $this->resolveFilters($request, $organization);

        return Inertia::render('organizations/reports/index', [
            'organization' => $organization->only(['id', 'name', 'slug']),
            'reporting' => $this->buildReportingPayload($organization, $rangeKey, $range, $filters),
        ]);
    }

    public function export(Request $request, Organization $organization): StreamedResponse
    {
        $this->authorize('viewReporting', $organization);

        $rangeKey = $this->resolveRangeKey($request->string('range')->toString());
        $range = $this->resolveRange($rangeKey);
        $filters = $this->resolveFilters($request, $organization);
        $reporting = $this->buildReportingPayload($organization, $rangeKey, $range, $filters);
        $reportKey = $request->string('report')->toString();
        $reportKey = in_array($reportKey, ['completion', 'overdue', 'assessments', 'employees', 'knowledge_gaps'], true)
            ? $reportKey
            : 'current-view';
        $filename = Str::slug($organization->name).'-'.$reportKey.'-'.$rangeKey.'.csv';

        return response()->streamDownload(function () use ($reporting, $reportKey): void {
            $handle = fopen('php://output', 'w');

            fputcsv($handle, [
                'section',
                'label',
                'employees',
                'assigned',
                'completed',
                'completion_rate',
                'overdue',
                'average_score',
                'notes',
            ]);

            $writeRows = function (string $section, array $rows) use ($handle): void {
                foreach ($rows as $row) {
                    fputcsv($handle, [
                        $this->csvValue($section),
                        $this->csvValue((string) ($row['label'] ?? $row['name'] ?? '')),
                        $this->csvValue((string) ($row['employees'] ?? '')),
                        $this->csvValue((string) ($row['assigned'] ?? '')),
                        $this->csvValue((string) ($row['completed'] ?? '')),
                        $this->csvValue(isset($row['completion_rate']) ? $row['completion_rate'].'%' : ''),
                        $this->csvValue((string) ($row['overdue'] ?? '')),
                        $this->csvValue(isset($row['average_score']) && $row['average_score'] !== null ? $row['average_score'].'%' : ''),
                        $this->csvValue((string) ($row['notes'] ?? '')),
                    ]);
                }
            };

            match ($reportKey) {
                'completion' => $writeRows('completion_by_course', $reporting['completion_by_course']),
                'overdue' => $writeRows('overdue_training', $reporting['overdue_training']),
                'assessments' => $writeRows('assessment_scores', $reporting['assessment_scores']),
                'employees' => $writeRows('employees', $reporting['employee_rows']),
                'knowledge_gaps' => $writeRows('missed_questions', $reporting['missed_questions']),
                default => $writeRows('completion_by_course', $reporting['completion_by_course']),
            };

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function buildReportingPayload(Organization $organization, string $rangeKey, array $range, array $filters): array
    {
        $users = $organization->users()
            ->with(['jobTitle.pathway', 'location', 'teams'])
            ->when($filters['employee_status'] === 'active', fn ($query) => $query->whereNull('deactivated_at'))
            ->when($filters['employee_status'] === 'deactivated', fn ($query) => $query->whereNotNull('deactivated_at'))
            ->when($filters['job_title_id'] !== null, fn ($query) => $query->where('job_title_id', $filters['job_title_id']))
            ->when($filters['location_id'] !== null, fn ($query) => $query->where('location_id', $filters['location_id']))
            ->when($filters['pathway_id'] !== null, fn ($query) => $query->whereHas('jobTitle', fn ($jobTitleQuery) => $jobTitleQuery->where('pathway_id', $filters['pathway_id'])))
            ->when($filters['team_id'] !== null, fn ($query) => $query->whereHas('teams', fn ($teamQuery) => $teamQuery->whereKey($filters['team_id'])))
            ->orderBy('name')
            ->get();

        $courses = $organization->courses()
            ->with([
                'assignments.assignedToUser',
                'assignments.assignedToTeam.members',
                'assignments.assignedToJobTitle',
                'assignments.assignedToLocation',
                'assignments.assignedToPathway',
                'progressRecords',
            ])
            ->when($filters['course_id'] !== null, fn ($query) => $query->whereKey($filters['course_id']))
            ->orderBy('title')
            ->get();

        $userStats = $users->mapWithKeys(function (User $user): array {
            return [$user->id => [
                'user' => $user,
                'assigned_count' => 0,
                'completed_count' => 0,
                'overdue_count' => 0,
                'scores' => [],
                'last_active_at' => null,
            ]];
        });

        $courseRows = [];
        $assignmentStatus = [
            'completed' => 0,
            'in_progress' => 0,
            'not_started' => 0,
            'overdue' => 0,
        ];
        $scoredAssessmentCount = 0;
        $passedAssessmentCount = 0;
        $failedAssessmentCount = 0;
        $assessmentScoreValues = [];

        foreach ($courses as $course) {
            $recipientMap = $this->courseRecipients($course, $users);
            $progressByUser = $course->progressRecords->keyBy('user_id');
            $recipientCount = count($recipientMap);
            $completedCount = 0;
            $overdueCount = 0;
            $scoreValues = [];

            foreach ($recipientMap as $userId => $dueAt) {
                $progress = $progressByUser->get($userId);
                $completedByRange = $progress !== null
                    && $progress->completed_at !== null
                    && $progress->completed_at->lessThanOrEqualTo($range['end']);
                $completedInPeriod = $completedByRange
                    && ($range['start'] === null || $progress->completed_at->greaterThanOrEqualTo($range['start']));

                if ($completedByRange) {
                    $completedCount++;
                }

                if ($completedInPeriod && $progress->score_percent !== null) {
                    $scoreValues[] = $progress->score_percent;
                    $assessmentScoreValues[] = $progress->score_percent;
                    $scoredAssessmentCount++;

                    if ($progress->passed === true) {
                        $passedAssessmentCount++;
                    } elseif ($progress->passed === false) {
                        $failedAssessmentCount++;
                    }
                }

                $isOverdue = $dueAt !== null && $dueAt->lessThanOrEqualTo($range['end']) && ! $completedByRange;

                if ($isOverdue) {
                    $overdueCount++;
                }

                if ($completedByRange) {
                    $assignmentStatus['completed']++;
                } elseif ($isOverdue) {
                    $assignmentStatus['overdue']++;
                } elseif ($progress !== null && ($progress->progress_percent > 0 || $progress->status === 'in_progress')) {
                    $assignmentStatus['in_progress']++;
                } else {
                    $assignmentStatus['not_started']++;
                }

                /** @var array{user:User,assigned_count:int,completed_count:int,overdue_count:int,scores:array<int,int>} $stats */
                $stats = $userStats->get($userId, []);

                if ($stats !== []) {
                    $stats['assigned_count']++;

                    if ($completedByRange) {
                        $stats['completed_count']++;
                    }

                    if ($isOverdue) {
                        $stats['overdue_count']++;
                    }

                    if ($completedInPeriod && $progress?->score_percent !== null) {
                        $stats['scores'][] = $progress->score_percent;
                    }

                    if ($progress?->updated_at !== null && ($stats['last_active_at'] === null || $progress->updated_at->isAfter($stats['last_active_at']))) {
                        $stats['last_active_at'] = $progress->updated_at;
                    }

                    $userStats->put($userId, $stats);
                }
            }

            $averageScore = $scoreValues !== []
                ? (int) round(collect($scoreValues)->avg())
                : null;
            $completionRate = $recipientCount > 0
                ? (int) round(($completedCount / $recipientCount) * 100)
                : null;
            $passingScore = $course->passing_score;
            $reasons = [];

            if ($overdueCount > 0) {
                $reasons[] = $overdueCount.' overdue '.($overdueCount === 1 ? 'assignment' : 'assignments');
            }

            if ($averageScore !== null && $passingScore !== null && $averageScore < $passingScore) {
                $reasons[] = "average score {$averageScore}% is below the {$passingScore}% passing score";
            }

            if ($recipientCount > 0 && $completionRate !== null && $completionRate < 75) {
                $reasons[] = "completion is at {$completionRate}%";
            }

            $courseRows[] = [
                'id' => $course->id,
                'label' => $course->title,
                'employees' => $recipientCount,
                'assigned' => $recipientCount,
                'completed' => $completedCount,
                'completion_rate' => $completionRate,
                'overdue' => $overdueCount,
                'average_score' => $averageScore,
                'notes' => $reasons !== [] ? implode('; ', $reasons) : 'On track',
                'needs_attention' => $reasons !== [],
                'priority' => ($overdueCount * 3) + ($averageScore !== null && $passingScore !== null && $averageScore < $passingScore ? 2 : 0) + ($recipientCount > 0 && $completionRate < 75 ? 1 : 0),
                'passing_score' => $passingScore,
                'detail_url' => route('organizations.courses.show', [$organization, $course]),
            ];
        }

        $userRows = $users->map(function (User $user) use ($userStats, $organization): array {
            /** @var array{user:User,assigned_count:int,completed_count:int,overdue_count:int,scores:array<int,int>} $stats */
            $stats = $userStats->get($user->id);
            $averageScore = $stats['scores'] !== []
                ? (int) round(collect($stats['scores'])->avg())
                : null;
            $completionRate = $stats['assigned_count'] > 0
                ? (int) round(($stats['completed_count'] / $stats['assigned_count']) * 100)
                : null;

            return [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->organization_role?->value ?? 'unassigned',
                'role_label' => $user->organization_role?->label() ?? 'Unassigned',
                'job_title' => $user->jobTitle?->name,
                'location' => $user->location?->name,
                'employees' => 1,
                'assigned' => $stats['assigned_count'],
                'completed' => $stats['completed_count'],
                'completion_rate' => $completionRate,
                'overdue' => $stats['overdue_count'],
                'average_score' => $averageScore,
                'last_active_at' => $stats['last_active_at']?->toIso8601String(),
                'account_status' => $user->isDeactivated() ? 'deactivated' : 'active',
                'needs_attention' => $stats['overdue_count'] > 0 || ($averageScore !== null && $averageScore < 75) || ($stats['assigned_count'] > 0 && $completionRate !== null && $completionRate < 50),
                'notes' => $this->interventionReason($stats['overdue_count'], $averageScore, $completionRate, $stats['assigned_count']),
                'detail_url' => route('organizations.users.show', [$organization, $user]),
            ];
        })->values();

        $activeLearnerIds = $this->activeLearnerIds($users, $range, $courses->pluck('id'));

        $completionByJobTitle = $this->groupSummary(
            $users->groupBy(fn (User $user): string => (string) ($user->job_title_id ?? 'unassigned')),
            $userRows,
            fn (User $user): string => $user->jobTitle?->name ?? 'No job title',
        );

        $completionByLocation = $this->groupSummary(
            $users->groupBy(fn (User $user): string => (string) ($user->location_id ?? 'unassigned')),
            $userRows,
            fn (User $user): string => $user->location?->name ?? 'Unassigned',
        );

        $completionByPathway = $this->groupSummary(
            $users->groupBy(fn (User $user): string => (string) ($user->jobTitle?->pathway_id ?? 'unassigned')),
            $userRows,
            fn (User $user): string => $user->jobTitle?->pathway?->name ?? 'No pathway',
        );

        $teamGroups = collect();
        $teamLabels = [];

        foreach ($users as $user) {
            foreach ($user->teams as $userTeam) {
                $teamKey = (string) $userTeam->id;
                $teamLabels[$teamKey] = $userTeam->name;
                $teamGroups->put($teamKey, ($teamGroups->get($teamKey, collect()))->push($user));
            }
        }

        $completionByTeam = $this->groupSummary(
            $teamGroups,
            $userRows,
            fn (User $user, string $groupKey): string => $teamLabels[$groupKey] ?? 'Team',
        );

        $assessmentScores = collect($courseRows)
            ->filter(fn (array $row): bool => $row['average_score'] !== null)
            ->sortByDesc('average_score')
            ->values()
            ->map(fn (array $row): array => [
                'id' => $row['id'],
                'label' => $row['label'],
                'employees' => $row['employees'],
                'assigned' => $row['assigned'],
                'completed' => $row['completed'],
                'completion_rate' => $row['completion_rate'],
                'overdue' => $row['overdue'],
                'average_score' => $row['average_score'],
                'notes' => 'Average score across completed learners',
                'detail_url' => $row['detail_url'],
            ])
            ->all();

        $overdueTraining = collect($courseRows)
            ->filter(fn (array $row): bool => $row['overdue'] > 0)
            ->sortByDesc('overdue')
            ->values()
            ->map(fn (array $row): array => [
                'id' => $row['id'],
                'label' => $row['label'],
                'employees' => $row['employees'],
                'assigned' => $row['assigned'],
                'completed' => $row['completed'],
                'completion_rate' => $row['completion_rate'],
                'overdue' => $row['overdue'],
                'average_score' => $row['average_score'],
                'notes' => $row['notes'],
                'detail_url' => $row['detail_url'],
            ])
            ->all();

        $trainingGapSummary = collect($courseRows)
            ->filter(fn (array $row): bool => $row['needs_attention'])
            ->sortByDesc('priority')
            ->take(5)
            ->values()
            ->map(fn (array $row): array => [
                'id' => $row['id'],
                'label' => $row['label'],
                'employees' => $row['employees'],
                'assigned' => $row['assigned'],
                'completed' => $row['completed'],
                'completion_rate' => $row['completion_rate'],
                'overdue' => $row['overdue'],
                'average_score' => $row['average_score'],
                'notes' => $row['notes'],
                'detail_url' => $row['detail_url'],
            ])
            ->all();

        $interventionEmployees = $userRows
            ->filter(fn (array $row): bool => $row['needs_attention'])
            ->sortByDesc(fn (array $row): int => ($row['overdue'] * 3) + ($row['average_score'] !== null && $row['average_score'] < 75 ? 2 : 0) + ($row['completion_rate'] < 50 ? 1 : 0))
            ->take(8)
            ->values()
            ->map(function (array $row): array {
                return [
                    'id' => $row['id'],
                    'label' => $row['name'],
                    'employees' => 1,
                    'assigned' => $row['assigned'],
                    'completed' => $row['completed'],
                    'completion_rate' => $row['completion_rate'],
                    'overdue' => $row['overdue'],
                    'average_score' => $row['average_score'],
                    'notes' => trim(implode(' • ', array_filter([
                        $row['role_label'],
                        $row['job_title'],
                        $row['location'],
                        $row['notes'],
                    ]))),
                    'detail_url' => $row['detail_url'],
                ];
            })
            ->all();

        $attentionItems = collect($courseRows)
            ->flatMap(function (array $row): array {
                $items = [];

                if ($row['overdue'] > 0) {
                    $items[] = [
                        'issue' => 'Overdue training',
                        'severity' => 'high',
                        'affected' => $row['overdue'],
                        'affected_label' => Str::plural('learner', $row['overdue']),
                        'details' => $row['label'],
                        'action_label' => 'Send reminder',
                        'action_url' => $row['detail_url'].'?assignment_focus=1',
                    ];
                }

                if ($row['average_score'] !== null && $row['passing_score'] !== null && $row['average_score'] < $row['passing_score']) {
                    $items[] = [
                        'issue' => 'Low assessment score',
                        'severity' => 'medium',
                        'affected' => $row['employees'],
                        'affected_label' => Str::plural('learner', $row['employees']),
                        'details' => $row['label'].' averages '.$row['average_score'].'%',
                        'action_label' => 'Assign refresher',
                        'action_url' => $row['detail_url'].'?assignment_focus=1',
                    ];
                }

                if ($row['assigned'] > 0 && $row['completion_rate'] !== null && $row['completion_rate'] < 50 && $row['overdue'] === 0) {
                    $items[] = [
                        'issue' => 'Stalled training',
                        'severity' => 'medium',
                        'affected' => $row['employees'] - $row['completed'],
                        'affected_label' => Str::plural('learner', max(0, $row['employees'] - $row['completed'])),
                        'details' => $row['label'].' is '.$row['completion_rate'].'% complete',
                        'action_label' => 'View learners',
                        'action_url' => $row['detail_url'].'?assignment_focus=1',
                    ];
                }

                return $items;
            })
            ->sortByDesc(fn (array $item): int => ($item['severity'] === 'high' ? 1000 : 0) + $item['affected'])
            ->values()
            ->when($interventionEmployees !== [], function (Collection $items) use ($interventionEmployees, $organization): Collection {
                return $items->push([
                    'issue' => 'Learners requiring intervention',
                    'severity' => 'medium',
                    'affected' => count($interventionEmployees),
                    'affected_label' => Str::plural('learner', count($interventionEmployees)),
                    'details' => 'Low scores, overdue work, or stalled completion',
                    'action_label' => 'View employees',
                    'action_url' => route('organizations.users.index', $organization),
                ]);
            })
            ->all();

        $missedQuestionAttempts = LessonQuestionAttempt::query()
            ->where('organization_id', $organization->getKey())
            ->whereIn('user_id', $users->pluck('id')->all())
            ->whereIn('course_id', $courses->pluck('id')->all())
            ->when($range['start'] !== null, fn ($query) => $query->whereBetween('completed_at', [$range['start'], $range['end']]))
            ->when($range['start'] === null, fn ($query) => $query->where('completed_at', '<=', $range['end']))
            ->with([
                'course:id,title,subject',
                'lesson:id,title,content',
                'user:id,name,location_id',
                'user.location:id,name',
                'user.teams:id,name',
            ])
            ->get()
            ->groupBy(fn (LessonQuestionAttempt $attempt): string => $attempt->lesson_id.'|'.$attempt->question_key)
            ->map(function (Collection $attempts) use ($organization): array {
                /** @var LessonQuestionAttempt $firstAttempt */
                $firstAttempt = $attempts->first();
                $misses = $attempts->sum('missed_attempts_count');
                $attemptsCount = $attempts->sum('attempts_count');
                $correctAttempts = $attempts->sum('correct_attempts_count');
                $learnerCount = $attempts
                    ->filter(fn (LessonQuestionAttempt $attempt): bool => $attempt->missed_attempts_count > 0)
                    ->pluck('user_id')
                    ->unique()
                    ->count();

                $successRate = $attemptsCount > 0
                    ? (int) round(($correctAttempts / $attemptsCount) * 100)
                    : 0;

                $failureRate = $attemptsCount > 0
                    ? (int) round(($misses / $attemptsCount) * 100)
                    : 0;

                $teamCounts = [];
                $locationCounts = [];
                $affectedLearners = [];

                foreach ($attempts as $attempt) {
                    if ($attempt->missed_attempts_count <= 0 || $attempt->user === null) {
                        continue;
                    }

                    $affectedLearners[$attempt->user_id] = $attempt->user->name;

                    $location = $attempt->user->location;
                    if ($location !== null) {
                        $locationCounts[$location->id] = [
                            'label' => $location->name,
                            'count' => ($locationCounts[$location->id]['count'] ?? 0) + 1,
                        ];
                    }

                    $teamLabels = $attempt->user->teams?->pluck('name')->filter()->values()->all() ?? [];
                    $teamIds = $attempt->user->teams?->pluck('id')->values()->all() ?? [];

                    if ($teamLabels === []) {
                        $teamCounts['unassigned'] = [
                            'label' => 'Unassigned',
                            'count' => ($teamCounts['unassigned']['count'] ?? 0) + 1,
                        ];

                        continue;
                    }

                    foreach ($teamLabels as $index => $teamLabel) {
                        $teamId = $teamIds[$index] ?? null;

                        if ($teamId === null) {
                            continue;
                        }

                        $teamCounts[$teamId] = [
                            'label' => $teamLabel,
                            'count' => ($teamCounts[$teamId]['count'] ?? 0) + 1,
                        ];
                    }
                }

                $topTeam = $this->topCountEntry($teamCounts);
                $topLocation = $this->topCountEntry($locationCounts);
                $procedureLabel = $firstAttempt->course?->subject ?: ($firstAttempt->course?->title ?? 'Procedure');
                $competencyLabel = $firstAttempt->lesson?->title ?? 'Competency';
                $refresherTargetType = 'user';
                $refresherTargetId = array_key_first($affectedLearners);
                $refresherTargetLabel = $refresherTargetId !== null
                    ? ($affectedLearners[$refresherTargetId] ?? 'Selected learner')
                    : 'Selected learner';

                if ($topTeam['id'] !== null && $topTeam['label'] !== 'Unassigned') {
                    $refresherTargetType = 'team';
                    $refresherTargetId = $topTeam['id'];
                    $refresherTargetLabel = $topTeam['label'];
                } elseif ($topLocation['id'] !== null && $topLocation['label'] !== 'Unassigned') {
                    $refresherTargetType = 'location';
                    $refresherTargetId = $topLocation['id'];
                    $refresherTargetLabel = $topLocation['label'];
                }

                $refresherDueAt = now()->addDays(7)->toDateString();
                $refresherActionUrl = route('organizations.courses.show', [
                    'organization' => $organization,
                    'course' => $firstAttempt->course_id,
                    'lesson' => $firstAttempt->lesson_id,
                    'gap' => $firstAttempt->question_key,
                    'assignment_focus' => 1,
                    'assignment_target_type' => $refresherTargetType,
                    'assignment_target_id' => $refresherTargetId,
                    'assignment_due_at' => $refresherDueAt,
                ]);
                $evidence = 'Stored question attempts only. Failure rate = '.$misses.' missed attempts out of '.$attemptsCount.' total attempts.';
                $correctAnswer = $this->correctAnswerForQuestion($firstAttempt);

                return [
                    'label' => $firstAttempt->question_prompt ?? Str::headline($firstAttempt->question_key),
                    'course_label' => $firstAttempt->course?->title ?? 'Course',
                    'lesson_label' => $firstAttempt->lesson?->title ?? 'Lesson',
                    'procedure_label' => $procedureLabel,
                    'competency_label' => $competencyLabel,
                    'question_type_label' => $this->questionTypeLabel($firstAttempt->question_type),
                    'employees' => $learnerCount,
                    'assigned' => $attemptsCount,
                    'completed' => $correctAttempts,
                    'completion_rate' => $successRate,
                    'failure_rate' => $failureRate,
                    'overdue' => $misses,
                    'average_score' => null,
                    'top_team_label' => $topTeam['label'],
                    'top_team_id' => $topTeam['id'],
                    'top_location_label' => $topLocation['label'],
                    'top_location_id' => $topLocation['id'],
                    'affected_learners' => array_values($affectedLearners),
                    'refresher_target_type' => $refresherTargetType,
                    'refresher_target_id' => $refresherTargetId,
                    'refresher_target_label' => $refresherTargetLabel,
                    'refresher_action_url' => $refresherActionUrl,
                    'notes' => trim(implode(' • ', array_filter([
                        $this->questionTypeLabel($firstAttempt->question_type),
                        $procedureLabel,
                        $competencyLabel,
                        $topTeam['label'] !== 'Unassigned' ? 'Top team: '.$topTeam['label'] : null,
                        $topLocation['label'] !== 'Unassigned' ? 'Top location: '.$topLocation['label'] : null,
                    ]))),
                    'evidence' => $evidence,
                    'correct_answer' => $correctAnswer,
                ];
            })
            ->sortByDesc(fn (array $row): int => (($row['failure_rate'] ?? 0) * 1000) + ($row['overdue'] ?? 0))
            ->values()
            ->filter(fn (array $row): bool => $row['assigned'] >= 5)
            ->values()
            ->all();

        $insufficientQuestionGroups = LessonQuestionAttempt::query()
            ->where('organization_id', $organization->getKey())
            ->whereIn('user_id', $users->pluck('id')->all())
            ->whereIn('course_id', $courses->pluck('id')->all())
            ->when($range['start'] !== null, fn ($query) => $query->whereBetween('completed_at', [$range['start'], $range['end']]))
            ->when($range['start'] === null, fn ($query) => $query->where('completed_at', '<=', $range['end']))
            ->get()
            ->groupBy(fn (LessonQuestionAttempt $attempt): string => $attempt->lesson_id.'|'.$attempt->question_key)
            ->filter(fn (Collection $attempts): bool => $attempts->sum('attempts_count') < 5)
            ->count();

        $completedLessonCompletions = LessonCompletion::query()
            ->whereIn('user_id', $users->pluck('id')->all())
            ->whereHas('lesson', fn ($query) => $query->whereIn('course_id', $courses->pluck('id')->all()))
            ->when($range['start'] !== null, fn ($query) => $query->whereBetween('completed_at', [$range['start'], $range['end']]))
            ->when($range['start'] === null, fn ($query) => $query->where('completed_at', '<=', $range['end']))
            ->count();

        $completedCourseProgress = CourseProgress::query()
            ->whereIn('user_id', $users->pluck('id')->all())
            ->whereIn('course_id', $courses->pluck('id')->all())
            ->whereNotNull('completed_at')
            ->when($range['start'] !== null, fn ($query) => $query->whereBetween('completed_at', [$range['start'], $range['end']]))
            ->when($range['start'] === null, fn ($query) => $query->where('completed_at', '<=', $range['end']))
            ->count();

        $averageAssessmentScore = $assessmentScoreValues !== []
            ? (int) round(collect($assessmentScoreValues)->avg())
            : null;
        $assignedTotal = $userRows->sum('assigned');
        $completedTotal = $userRows->sum('completed');
        $overdueTotal = $userRows->sum('overdue');
        $completionRate = $assignedTotal > 0
            ? (int) round(($completedTotal / $assignedTotal) * 100)
            : null;
        $assignedLearners = $userRows->where('assigned', '>', 0)->count();
        $passFailTotal = $passedAssessmentCount + $failedAssessmentCount;
        $passRate = $passFailTotal > 0
            ? (int) round(($passedAssessmentCount / $passFailTotal) * 100)
            : null;
        $filterOptions = $this->filterOptions($organization);
        $activeFilterLabels = $this->activeFilterLabels($filters, $filterOptions);
        $exportQuery = http_build_query(array_filter([
            'range' => $rangeKey,
            'job_title' => $filters['job_title_id'],
            'team' => $filters['team_id'],
            'location' => $filters['location_id'],
            'pathway' => $filters['pathway_id'],
            'course' => $filters['course_id'],
            'employee_status' => $filters['employee_status'] !== 'active' ? $filters['employee_status'] : null,
        ], fn ($value): bool => $value !== null && $value !== ''));

        return [
            'demo_mode' => false,
            'scope_label' => $organization->name,
            'scope_description' => 'Monitor completion, assessment performance, overdue training, and knowledge gaps.',
            'date_range' => [
                'key' => $rangeKey,
                'label' => $range['label'],
                'display_label' => $range['display_label'],
                'start' => $range['start']?->toIso8601String(),
                'end' => $range['end']->toIso8601String(),
                'options' => $this->rangeOptions(),
            ],
            'summary' => [
                'total_employees' => $users->count(),
                'assigned_learners' => $assignedLearners,
                'active_learners' => $users->filter(fn (User $user): bool => $user->isLearner() && $activeLearnerIds->contains($user->id))->count(),
                'completion_rate' => $completionRate,
                'overdue_training' => $overdueTotal,
                'average_assessment_score' => $averageAssessmentScore,
                'employees_requiring_intervention' => count($interventionEmployees),
                'training_gap_summary' => count($trainingGapSummary),
                'completed_lessons' => $completedLessonCompletions,
                'completed_courses' => $completedCourseProgress,
                'scored_assessments' => $scoredAssessmentCount,
            ],
            'assignment_status' => $assignmentStatus,
            'assessment_summary' => [
                'scored_assessments' => $scoredAssessmentCount,
                'passed' => $passedAssessmentCount,
                'failed' => $failedAssessmentCount,
                'pass_rate' => $passRate,
            ],
            'completion_by_course' => collect($courseRows)
                ->filter(fn (array $row): bool => $row['assigned'] > 0)
                ->sortBy('completion_rate')
                ->values()
                ->map(fn (array $row): array => [
                    'id' => $row['id'],
                    'label' => $row['label'],
                    'employees' => $row['employees'],
                    'assigned' => $row['assigned'],
                    'completed' => $row['completed'],
                    'completion_rate' => $row['completion_rate'],
                    'overdue' => $row['overdue'],
                    'average_score' => $row['average_score'],
                    'notes' => $row['notes'],
                    'detail_url' => $row['detail_url'],
                ])
                ->all(),
            'completion_by_job_title' => $completionByJobTitle,
            'completion_by_team' => $completionByTeam,
            'completion_by_location' => $completionByLocation,
            'completion_by_pathway' => $completionByPathway,
            'overdue_training' => $overdueTraining,
            'assessment_scores' => $assessmentScores,
            'employees_requiring_intervention' => $interventionEmployees,
            'training_gap_summary' => $trainingGapSummary,
            'attention_items' => $attentionItems,
            'employee_rows' => $userRows->all(),
            'missed_questions' => $missedQuestionAttempts,
            'knowledge_gap_threshold' => 5,
            'insufficient_question_groups' => $insufficientQuestionGroups,
            'definitions' => $this->definitions(),
            'filters' => $filters,
            'filter_options' => $filterOptions,
            'active_filter_labels' => $activeFilterLabels,
            'export_url' => "/organizations/{$organization->id}/reports/export?{$exportQuery}",
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function groupSummary(
        Collection $groups,
        Collection $userRows,
        ?callable $labelResolver = null,
    ): array {
        $labelResolver ??= fn (User $user): string => $user->organization_role?->label() ?? 'Unassigned';

        return $groups->map(function (Collection $users, string $groupKey) use ($userRows, $labelResolver): array {
            $rows = $userRows->filter(function (array $row) use ($users): bool {
                return $row['assigned'] > 0 && $users->contains('id', $row['id']);
            });

            $assigned = $rows->sum('assigned');
            $completed = $rows->sum('completed');
            $overdue = $rows->sum('overdue');
            $scoreValues = $rows->pluck('average_score')->filter(fn ($score): bool => $score !== null)->values();
            $averageScore = $scoreValues->isNotEmpty()
                ? (int) round($scoreValues->avg())
                : null;
            $completionRate = $assigned > 0
                ? (int) round(($completed / $assigned) * 100)
                : null;

            /** @var User $firstUser */
            $firstUser = $users->first();

            return [
                'id' => is_numeric($groupKey) ? (int) $groupKey : null,
                'label' => $labelResolver($firstUser, $groupKey),
                'employees' => $rows->count(),
                'assigned' => $assigned,
                'completed' => $completed,
                'completion_rate' => $completionRate,
                'overdue' => $overdue,
                'average_score' => $averageScore,
                'notes' => $groupKey,
                'detail_url' => null,
            ];
        })
            ->filter(fn (array $row): bool => $row['assigned'] > 0)
            ->sortByDesc('completion_rate')
            ->values()
            ->all();
    }

    /**
     * @return array<int, array{label:string,description:string}>
     */
    private function definitions(): array
    {
        return [
            [
                'label' => 'Completion by course',
                'description' => 'Percent of assigned learners who finished the course by the selected date range.',
            ],
            [
                'label' => 'Completion rate',
                'description' => 'Completed assignments divided by assigned training. Employees with no assigned training are excluded.',
            ],
            [
                'label' => 'Completion by job title',
                'description' => 'Aggregated assignment completion for learners grouped by workforce job title, not system permissions.',
            ],
            [
                'label' => 'Completion by location',
                'description' => 'Aggregated completion across learners grouped by work location.',
            ],
            [
                'label' => 'Overdue training',
                'description' => 'Assignments with due dates on or before the selected range end that are still incomplete.',
            ],
            [
                'label' => 'Assessment scores',
                'description' => 'Average of scored course assessments completed during the selected period.',
            ],
            [
                'label' => 'Employees requiring intervention',
                'description' => 'People with overdue items, low scores, or very low completion progress.',
            ],
            [
                'label' => 'Training-gap summary',
                'description' => 'Courses that need attention because of overdue learners, low scores, or weak completion.',
            ],
            [
                'label' => 'Most frequently missed questions',
                'description' => 'Ranks stored question attempts by failure rate and shows the matching procedure, competency, team, and location.',
            ],
        ];
    }

    private function interventionReason(int $overdueCount, ?int $averageScore, ?int $completionRate, int $assignedCount): string
    {
        if ($assignedCount === 0) {
            return 'No assigned training yet';
        }

        $reasons = [];

        if ($overdueCount > 0) {
            $reasons[] = $overdueCount.' overdue';
        }

        if ($averageScore !== null && $averageScore < 75) {
            $reasons[] = 'average score '.$averageScore.'%';
        }

        if ($completionRate !== null && $completionRate < 50) {
            $reasons[] = 'completion '.$completionRate.'%';
        }

        return $reasons !== [] ? implode(' • ', $reasons) : 'On track';
    }

    /**
     * @return array<int, int|string|null>
     */
    private function courseRecipients(Course $course, Collection $organizationUsers): array
    {
        $recipients = [];

        foreach ($course->assignments as $assignment) {
            $matchedUsers = match (true) {
                $assignment->assigned_to_user_id !== null => $organizationUsers->where('id', $assignment->assigned_to_user_id),
                $assignment->assigned_to_team_id !== null => $assignment->assignedToTeam?->members
                    ? $organizationUsers->whereIn('id', $assignment->assignedToTeam->members->pluck('id')->all())
                    : collect(),
                $assignment->assigned_to_job_title_id !== null => $organizationUsers->where('job_title_id', $assignment->assigned_to_job_title_id),
                $assignment->assigned_to_location_id !== null => $organizationUsers->where('location_id', $assignment->assigned_to_location_id),
                $assignment->assigned_to_pathway_id !== null => $organizationUsers->filter(function (User $user) use ($assignment): bool {
                    return $user->jobTitle?->pathway_id === $assignment->assigned_to_pathway_id;
                })->values(),
                default => collect(),
            };

            foreach ($matchedUsers as $user) {
                $dueAt = $assignment->due_at?->toImmutable();
                $current = $recipients[$user->id] ?? null;

                if ($current === null || ($dueAt !== null && ($current === null || $dueAt->isBefore($current)))) {
                    $recipients[$user->id] = $dueAt;
                }
            }
        }

        return $recipients;
    }

    private function questionTypeLabel(string $type): string
    {
        return match ($type) {
            'multiple_choice' => 'Multiple choice',
            'true_false' => 'True / false',
            'ordering' => 'Ordering',
            'matching' => 'Matching',
            'scenario' => 'Scenario',
            default => Str::headline($type),
        };
    }

    private function topCountEntry(array $counts): array
    {
        if ($counts === []) {
            return ['id' => null, 'label' => 'Unassigned', 'count' => 0];
        }

        uasort($counts, fn (array $left, array $right): int => $right['count'] <=> $left['count']);
        $id = array_key_first($counts);
        $entry = $counts[$id];

        return [
            'id' => is_numeric($id) ? (int) $id : null,
            'label' => is_string($entry['label'] ?? null) && $entry['label'] !== '' ? $entry['label'] : 'Unassigned',
            'count' => (int) ($entry['count'] ?? 0),
        ];
    }

    private function activeLearnerIds(Collection $users, array $range, Collection $courseIds): Collection
    {
        $userIds = $users->pluck('id')->all();

        $lessonCompletionUserIds = LessonCompletion::query()
            ->whereIn('user_id', $userIds)
            ->whereHas('lesson', fn ($query) => $query->whereIn('course_id', $courseIds->all()))
            ->when($range['start'] !== null, fn ($query) => $query->whereBetween('completed_at', [$range['start'], $range['end']]))
            ->when($range['start'] === null, fn ($query) => $query->where('completed_at', '<=', $range['end']))
            ->pluck('user_id');

        $courseCompletionUserIds = CourseProgress::query()
            ->whereIn('user_id', $userIds)
            ->whereIn('course_id', $courseIds->all())
            ->whereNotNull('completed_at')
            ->when($range['start'] !== null, fn ($query) => $query->whereBetween('completed_at', [$range['start'], $range['end']]))
            ->when($range['start'] === null, fn ($query) => $query->where('completed_at', '<=', $range['end']))
            ->pluck('user_id');

        return $lessonCompletionUserIds->merge($courseCompletionUserIds)->unique()->values();
    }

    /**
     * @return array{job_title_id:?int,team_id:?int,location_id:?int,pathway_id:?int,course_id:?int,employee_status:string}
     */
    private function resolveFilters(Request $request, Organization $organization): array
    {
        $jobTitleId = $request->integer('job_title') ?: null;
        $teamId = $request->integer('team') ?: null;
        $locationId = $request->integer('location') ?: null;
        $pathwayId = $request->integer('pathway') ?: null;
        $courseId = $request->integer('course') ?: null;
        $employeeStatus = $request->string('employee_status')->toString();

        return [
            'job_title_id' => $jobTitleId !== null && $organization->jobTitles()->whereKey($jobTitleId)->exists() ? $jobTitleId : null,
            'team_id' => $teamId !== null && $organization->teams()->whereKey($teamId)->exists() ? $teamId : null,
            'location_id' => $locationId !== null && $organization->locations()->whereKey($locationId)->exists() ? $locationId : null,
            'pathway_id' => $pathwayId !== null && $organization->pathways()->whereKey($pathwayId)->exists() ? $pathwayId : null,
            'course_id' => $courseId !== null && $organization->courses()->whereKey($courseId)->exists() ? $courseId : null,
            'employee_status' => in_array($employeeStatus, ['active', 'deactivated', 'all'], true) ? $employeeStatus : 'active',
        ];
    }

    /**
     * @return array<string, array<int, array{value:string,label:string}>>
     */
    private function filterOptions(Organization $organization): array
    {
        $options = fn ($query): array => $query
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn ($model): array => ['value' => (string) $model->id, 'label' => $model->name])
            ->all();

        return [
            'job_titles' => $options($organization->jobTitles()),
            'teams' => $options($organization->teams()),
            'locations' => $options($organization->locations()),
            'pathways' => $options($organization->pathways()),
            'courses' => $organization->courses()
                ->orderBy('title')
                ->get(['id', 'title'])
                ->map(fn (Course $course): array => ['value' => (string) $course->id, 'label' => $course->title])
                ->all(),
            'employee_statuses' => [
                ['value' => 'active', 'label' => 'Active employees'],
                ['value' => 'all', 'label' => 'All employees'],
                ['value' => 'deactivated', 'label' => 'Deactivated employees'],
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @param  array<string, array<int, array{value:string,label:string}>>  $options
     * @return array<int, string>
     */
    private function activeFilterLabels(array $filters, array $options): array
    {
        $labels = [];
        $map = [
            'job_title_id' => 'job_titles',
            'team_id' => 'teams',
            'location_id' => 'locations',
            'pathway_id' => 'pathways',
            'course_id' => 'courses',
        ];

        foreach ($map as $filterKey => $optionKey) {
            if ($filters[$filterKey] === null) {
                continue;
            }

            $option = collect($options[$optionKey])->firstWhere('value', (string) $filters[$filterKey]);

            if ($option !== null) {
                $labels[] = $option['label'];
            }
        }

        if ($filters['employee_status'] !== 'active') {
            $status = collect($options['employee_statuses'])->firstWhere('value', $filters['employee_status']);

            if ($status !== null) {
                $labels[] = $status['label'];
            }
        }

        return $labels;
    }

    private function correctAnswerForQuestion(LessonQuestionAttempt $attempt): ?string
    {
        $blocks = $attempt->lesson?->blocks() ?? [];
        $block = collect($blocks)->first(fn (array $candidate): bool => (string) ($candidate['id'] ?? '') === $attempt->question_key);

        if (! is_array($block)) {
            return null;
        }

        return match ($block['type'] ?? $attempt->question_type) {
            'multiple_choice', 'scenario' => $this->choiceLabel(
                ($block['choices'] ?? [])[(int) ($block['correct_index'] ?? 0)] ?? null,
            ),
            'true_false' => (bool) ($block['correct_answer'] ?? true) ? 'True' : 'False',
            'ordering' => collect($block['items'] ?? [])->map(fn ($item): string => (string) $item)->filter()->join(' → '),
            'matching' => collect($block['pairs'] ?? [])->map(function ($pair): ?string {
                if (! is_array($pair)) {
                    return null;
                }

                return trim((string) ($pair['left'] ?? '')).' → '.trim((string) ($pair['right'] ?? ''));
            })->filter()->join('; '),
            default => null,
        } ?: null;
    }

    private function choiceLabel(mixed $choice): ?string
    {
        if (is_string($choice) || is_numeric($choice)) {
            return trim((string) $choice) ?: null;
        }

        if (is_array($choice)) {
            $label = trim((string) ($choice['label'] ?? $choice['text'] ?? ''));

            return $label !== '' ? $label : null;
        }

        return null;
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

    private function csvValue(mixed $value): string
    {
        $value = (string) $value;

        if ($value !== '' && in_array($value[0], ['=', '+', '-', '@'], true)) {
            return "'".$value;
        }

        return $value;
    }
}
