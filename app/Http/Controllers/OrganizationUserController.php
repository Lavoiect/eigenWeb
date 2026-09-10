<?php

namespace App\Http\Controllers;

use App\Enums\OrganizationRole;
use App\Http\Controllers\Api\V1\Concerns\FormatsLearningApiResponses;
use App\Models\CourseAssignment;
use App\Models\CourseProgress;
use App\Models\JobTitle;
use App\Models\LessonCompletion;
use App\Models\Location;
use App\Models\Organization;
use App\Models\Pathway;
use App\Models\Team;
use App\Models\User;
use App\Notifications\OrganizationInvitationNotification;
use App\Services\PathwayAssignmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class OrganizationUserController extends Controller
{
    use FormatsLearningApiResponses;

    public function index(Request $request, Organization $organization): Response
    {
        $this->authorize('manageUsers', $organization);

        $teams = $organization->teams()
            ->withCount(['members', 'managers'])
            ->orderBy('name')
            ->get()
            ->map(fn (Team $team): array => [
                'id' => $team->id,
                'name' => $team->name,
                'description' => $team->description,
                'member_count' => $team->members_count,
                'manager_count' => $team->managers_count,
            ]);

        $jobTitles = $organization->jobTitles()
            ->with(['pathway'])
            ->withCount('users')
            ->orderBy('name')
            ->get()
            ->map(fn (JobTitle $jobTitle): array => $jobTitle->only(['id', 'name', 'description', 'pathway_id']) + [
                'employee_count' => $jobTitle->users_count,
                'pathway' => $jobTitle->pathway?->only(['id', 'name']),
            ]);

        $locations = $organization->locations()
            ->withCount('users')
            ->orderBy('name')
            ->get()
            ->map(fn (Location $location): array => $location->only(['id', 'name', 'description']) + [
                'employee_count' => $location->users_count,
            ]);

        $pathways = $organization->pathways()
            ->withCount(['jobTitles', 'courses', 'items', 'milestones'])
            ->orderBy('name')
            ->get()
            ->map(fn (Pathway $pathway): array => $pathway->only(['id', 'name', 'description']) + [
                'job_title_count' => $pathway->job_titles_count,
                'course_count' => $pathway->courses_count,
                'item_count' => $pathway->items_count,
                'milestone_count' => $pathway->milestones_count,
                'sequential_completion' => $pathway->sequential_completion,
                'expected_completion_days' => $pathway->expected_completion_days,
            ]);

        $filters = [
            'search' => trim($request->string('search')->toString()),
            'role' => trim($request->string('role')->toString()),
            'team' => $request->integer('team') ?: null,
            'training_status' => trim($request->string('training_status')->toString()),
        ];

        $assignments = CourseAssignment::query()
            ->with(['course'])
            ->whereHas('course', fn ($query) => $query->where('organization_id', $organization->getKey()))
            ->get();

        $progressByUser = CourseProgress::query()
            ->with(['course'])
            ->whereHas('course', fn ($query) => $query->where('organization_id', $organization->getKey()))
            ->get()
            ->groupBy('user_id');

        $userRows = $organization->users()
            ->with([
                'teams' => fn ($query) => $query->orderBy('name'),
                'managedTeams' => fn ($query) => $query->orderBy('name'),
                'jobTitle.pathway',
                'location',
            ])
            ->orderBy('name')
            ->get()
            ->map(fn (User $user): array => $this->userRow(
                $user,
                $request->user(),
                $assignments,
                $progressByUser,
            ))
            ->values();

        $summary = [
            'total' => $userRows->count(),
            'active' => $userRows->where('account_status', 'active')->count(),
            'active_learners' => $userRows
                ->where('account_status', 'active')
                ->where('organization_role', OrganizationRole::Learner->value)
                ->count(),
            'needs_attention' => $userRows
                ->filter(fn (array $user): bool => $user['training_summary']['overdue_courses'] > 0)
                ->count(),
            'deactivated' => $userRows->where('account_status', 'deactivated')->count(),
            'admins' => $userRows->where('organization_role', OrganizationRole::OrganizationAdmin->value)->count(),
            'managers' => $userRows->where('organization_role', OrganizationRole::Manager->value)->count(),
            'learners' => $userRows->where('organization_role', OrganizationRole::Learner->value)->count(),
        ];

        $users = $userRows;

        return Inertia::render('organizations/users/index', [
            'organization' => $organization->only(['id', 'name', 'slug']),
            'teams' => $teams,
            'jobTitles' => $jobTitles,
            'locations' => $locations,
            'pathways' => $pathways,
            'users' => $users,
            'summary' => $summary,
            'filters' => $filters,
            'trainingStatusOptions' => [
                ['value' => '', 'label' => 'All training statuses'],
                ['value' => 'unassigned', 'label' => 'Unassigned'],
                ['value' => 'in_progress', 'label' => 'In progress'],
                ['value' => 'overdue', 'label' => 'Overdue'],
                ['value' => 'completed', 'label' => 'Completed'],
            ],
            'roleOptions' => [
                ['value' => '', 'label' => 'All roles'],
                ['value' => OrganizationRole::OrganizationAdmin->value, 'label' => OrganizationRole::OrganizationAdmin->label()],
                ['value' => OrganizationRole::Manager->value, 'label' => OrganizationRole::Manager->label()],
                ['value' => OrganizationRole::Learner->value, 'label' => OrganizationRole::Learner->label()],
            ],
        ]);
    }

    public function show(Request $request, Organization $organization, User $user): Response
    {
        $this->authorize('manageUsers', $organization);

        abort_unless($user->organization_id === $organization->getKey(), 404);

        return Inertia::render('organizations/users/show', [
            'organization' => $organization->only(['id', 'name', 'slug']),
            'user' => $this->userRow($user, $request->user()),
            'transcript' => $this->transcriptPayload($user),
            'pathway_progress' => $this->pathwayProgressSummary($user),
        ]);
    }

    public function transcript(Request $request, Organization $organization, User $user): Response
    {
        $this->authorize('manageUsers', $organization);

        abort_unless($user->organization_id === $organization->getKey(), 404);

        return Inertia::render('organizations/users/transcript', [
            'organization' => $organization->only(['id', 'name', 'slug']),
            'user' => $this->userRow($user, $request->user()),
            'transcript' => $this->transcriptPayload($user),
            'pathway_progress' => $this->pathwayProgressSummary($user),
        ]);
    }

    public function updateRole(Request $request, Organization $organization, User $user): RedirectResponse
    {
        $this->authorize('manageUsers', $organization);

        abort_unless($user->organization_id === $organization->getKey(), 404);

        $validated = $request->validate([
            'organization_role' => ['required', 'in:'.implode(',', [
                OrganizationRole::OrganizationAdmin->value,
                OrganizationRole::Manager->value,
                OrganizationRole::Learner->value,
            ])],
        ]);

        $user->forceFill([
            'organization_role' => $validated['organization_role'],
        ])->save();

        $user->teams()->detach();
        $user->managedTeams()->detach();

        return back()->with('status', 'User role updated.');
    }

    public function deactivate(Request $request, Organization $organization, User $user): RedirectResponse|JsonResponse
    {
        $this->authorize('manageUsers', $organization);

        abort_unless($user->organization_id === $organization->getKey(), 404);

        if ($request->user()->is($user)) {
            throw ValidationException::withMessages([
                'user' => 'You cannot deactivate your own account from this page.',
            ]);
        }

        if ($user->isDeactivated()) {
            return back()->with('status', 'User is already deactivated.');
        }

        $user->forceFill([
            'deactivated_at' => now(),
        ])->save();

        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'User deactivated.',
            ]);
        }

        return back()->with('status', 'User deactivated.');
    }

    public function bulkUpdate(
        Request $request,
        Organization $organization,
        PathwayAssignmentService $pathwayAssignments,
    ): RedirectResponse {
        $this->authorize('manageUsers', $organization);

        $validated = $request->validate([
            'user_ids' => ['required', 'array', 'min:1', 'max:500'],
            'user_ids.*' => [
                'required',
                'integer',
                'distinct',
                Rule::exists('users', 'id')->where(
                    fn ($query) => $query->where('organization_id', $organization->getKey()),
                ),
            ],
            'action' => ['required', Rule::in([
                'set_job_title',
                'set_location',
                'add_team',
                'set_account_status',
            ])],
            'value_id' => ['nullable', 'integer'],
            'account_status' => ['nullable', Rule::in(['active', 'deactivated'])],
        ]);

        $action = $validated['action'];
        $valueId = isset($validated['value_id']) ? (int) $validated['value_id'] : null;

        if ($action === 'set_job_title' && $valueId !== null) {
            abort_unless($organization->jobTitles()->whereKey($valueId)->exists(), 422);
        }

        if ($action === 'set_location' && $valueId !== null) {
            abort_unless($organization->locations()->whereKey($valueId)->exists(), 422);
        }

        if ($action === 'add_team') {
            abort_unless($valueId !== null && $organization->teams()->whereKey($valueId)->exists(), 422);
        }

        if ($action === 'set_account_status' && empty($validated['account_status'])) {
            throw ValidationException::withMessages([
                'account_status' => 'Choose an account status.',
            ]);
        }

        $users = $organization->users()
            ->whereKey($validated['user_ids'])
            ->get();

        DB::transaction(function () use ($request, $users, $action, $valueId, $validated, $pathwayAssignments): void {
            foreach ($users as $user) {
                if ($action === 'set_job_title') {
                    $user->forceFill(['job_title_id' => $valueId])->save();
                    $pathwayAssignments->syncUser($user);
                }

                if ($action === 'set_location') {
                    $user->forceFill(['location_id' => $valueId])->save();
                }

                if ($action === 'add_team' && $user->isManager()) {
                    $user->managedTeams()->syncWithoutDetaching([
                        $valueId => ['assigned_by_id' => $request->user()->getKey()],
                    ]);
                }

                if ($action === 'add_team' && $user->isLearner()) {
                    $user->teams()->syncWithoutDetaching([
                        $valueId => ['created_by_id' => $request->user()->getKey()],
                    ]);
                }

                if ($action === 'set_account_status') {
                    if ($request->user()->is($user) && $validated['account_status'] === 'deactivated') {
                        continue;
                    }

                    $user->forceFill([
                        'deactivated_at' => $validated['account_status'] === 'deactivated' ? now() : null,
                    ])->save();
                }
            }
        });

        return back()->with('status', 'Selected employees updated.');
    }

    public function bulkStore(Request $request, Organization $organization): RedirectResponse|JsonResponse
    {
        $this->authorize('manageUsers', $organization);

        $validated = $request->validate([
            'employees' => ['required', 'string', 'max:20000'],
        ]);

        $rows = $this->parseEmployeeRows($validated['employees']);
        $result = $this->importEmployeeRows($request, $organization, $rows);

        return $this->importResponse($request, $result, 'Bulk invite completed.');
    }

    public function importCsv(Request $request, Organization $organization): RedirectResponse|JsonResponse
    {
        $this->authorize('manageUsers', $organization);

        $validated = $request->validate([
            'csv_file' => ['required', 'file', 'mimes:csv,txt'],
        ]);

        $handle = fopen($validated['csv_file']->getRealPath(), 'r');

        if ($handle === false) {
            throw ValidationException::withMessages([
                'csv_file' => 'The CSV file could not be read.',
            ]);
        }

        $headers = null;
        $rows = [];

        while (($row = fgetcsv($handle)) !== false) {
            if ($headers === null) {
                $headers = array_map(fn ($header) => Str::snake(trim((string) $header)), $row);

                continue;
            }

            if (count(array_filter($row, fn ($value) => filled($value))) === 0) {
                continue;
            }

            $rows[] = array_combine(
                $headers,
                array_map(fn ($value) => is_string($value) ? trim($value) : $value, array_pad($row, count($headers), null)),
            );
        }

        fclose($handle);

        $result = $this->importEmployeeRows($request, $organization, $rows);

        return $this->importResponse($request, $result, 'CSV import completed.');
    }

    public function downloadImportTemplate(Organization $organization): StreamedResponse
    {
        $this->authorize('manageUsers', $organization);

        return $this->streamCsvDownload(
            Str::slug($organization->name).'-employee-import-template.csv',
            ['name', 'email', 'role', 'temporary_password', 'team_ids'],
        );
    }

    public function downloadImportSample(Organization $organization): StreamedResponse
    {
        $this->authorize('manageUsers', $organization);

        $teams = $organization->teams()
            ->orderBy('name')
            ->limit(2)
            ->get()
            ->values();

        $firstTeamIds = $teams->take(1)->pluck('id')->all();
        $firstTeamNames = $teams->take(1)->pluck('name')->all();
        $secondTeamIds = $teams->take(2)->pluck('id')->all();
        $secondTeamNames = $teams->take(2)->pluck('name')->all();

        return $this->streamCsvDownload(
            Str::slug($organization->name).'-employee-import-sample.csv',
            ['name', 'email', 'role', 'temporary_password', 'team_ids', 'team_names'],
            [
                ['Mia Carter', 'mia.carter@example.com', OrganizationRole::Learner->value, 'TempPass123', implode('|', $secondTeamIds), implode('|', $secondTeamNames)],
                ['Jordan Lee', 'jordan.lee@example.com', OrganizationRole::Manager->value, '', implode('|', $firstTeamIds), implode('|', $firstTeamNames)],
            ],
        );
    }

    public function syncTeams(Request $request, Organization $organization, User $user): RedirectResponse
    {
        $this->authorize('manageTeams', $organization);

        abort_unless($user->organization_id === $organization->getKey(), 404);

        $validated = $request->validate([
            'team_ids' => ['array'],
            'team_ids.*' => ['integer', 'exists:teams,id'],
        ]);

        $teamIds = collect($validated['team_ids'] ?? [])
            ->map(fn ($teamId) => (int) $teamId)
            ->unique()
            ->values();

        $teams = $organization->teams()
            ->whereIn('id', $teamIds)
            ->pluck('id');

        if ($user->isManager()) {
            $user->teams()->detach();
            $user->managedTeams()->syncWithPivotValues($teams->all(), [
                'assigned_by_id' => $request->user()->getKey(),
            ]);
        } elseif ($user->isLearner()) {
            $user->managedTeams()->detach();
            $user->teams()->syncWithPivotValues($teams->all(), [
                'created_by_id' => $request->user()->getKey(),
            ]);
        } else {
            $user->teams()->detach();
            $user->managedTeams()->detach();
        }

        return back()->with('status', 'Team assignments updated.');
    }

    public function storePathway(Request $request, Organization $organization): RedirectResponse
    {
        $this->authorize('manageUsers', $organization);

        $validated = $request->validate([
            'pathway_name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('pathways', 'name')->where(fn ($query) => $query->where('organization_id', $organization->getKey())),
            ],
            'pathway_description' => ['nullable', 'string', 'max:500'],
            'sequential_completion' => ['sometimes', 'boolean'],
            'expected_completion_days' => ['nullable', 'integer', 'min:1', 'max:3650'],
        ]);

        $organization->pathways()->create([
            'created_by_id' => $request->user()->getKey(),
            'name' => $validated['pathway_name'],
            'description' => $validated['pathway_description'] ?? null,
            'sequential_completion' => $validated['sequential_completion'] ?? false,
            'expected_completion_days' => $validated['expected_completion_days'] ?? null,
        ]);

        return back()->with('status', 'Pathway created.');
    }

    public function storeTeam(Request $request, Organization $organization): RedirectResponse
    {
        $this->authorize('manageTeams', $organization);

        $validated = $request->validate([
            'team_name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('teams', 'name')->where(fn ($query) => $query->where('organization_id', $organization->getKey())),
            ],
        ]);

        $organization->teams()->create([
            'name' => $validated['team_name'],
        ]);

        return back()->with('status', 'Team created.');
    }

    public function storeJobTitle(Request $request, Organization $organization): RedirectResponse
    {
        $this->authorize('manageUsers', $organization);

        $validated = $request->validate([
            'job_title_name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('job_titles', 'name')->where(fn ($query) => $query->where('organization_id', $organization->getKey())),
            ],
        ]);

        $organization->jobTitles()->create([
            'created_by_id' => $request->user()->getKey(),
            'name' => $validated['job_title_name'],
        ]);

        return back()->with('status', 'Job title created.');
    }

    public function storeLocation(Request $request, Organization $organization): RedirectResponse
    {
        $this->authorize('manageUsers', $organization);

        $validated = $request->validate([
            'location_name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('locations', 'name')->where(fn ($query) => $query->where('organization_id', $organization->getKey())),
            ],
        ]);

        $organization->locations()->create([
            'created_by_id' => $request->user()->getKey(),
            'name' => $validated['location_name'],
        ]);

        return back()->with('status', 'Location created.');
    }

    public function syncStructure(Request $request, Organization $organization, User $user, PathwayAssignmentService $pathwayAssignments): RedirectResponse
    {
        $this->authorize('manageUsers', $organization);

        abort_unless($user->organization_id === $organization->getKey(), 404);

        $validated = $request->validate([
            'job_title_id' => [
                'nullable',
                'integer',
                Rule::exists('job_titles', 'id')->where(fn ($query) => $query->where('organization_id', $organization->getKey())),
            ],
            'location_id' => [
                'nullable',
                'integer',
                Rule::exists('locations', 'id')->where(fn ($query) => $query->where('organization_id', $organization->getKey())),
            ],
        ]);

        $user->forceFill([
            'job_title_id' => $validated['job_title_id'] ?? null,
            'location_id' => $validated['location_id'] ?? null,
        ])->save();

        $pathwayAssignments->syncUser($user);

        return back()->with('status', 'Employee structure updated.');
    }

    public function syncJobTitlePathway(
        Request $request,
        Organization $organization,
        JobTitle $jobTitle,
        PathwayAssignmentService $pathwayAssignments,
    ): RedirectResponse {
        $this->authorize('manageUsers', $organization);

        abort_unless($jobTitle->organization_id === $organization->getKey(), 404);

        $validated = $request->validate([
            'pathway_id' => [
                'nullable',
                'integer',
                Rule::exists('pathways', 'id')->where(fn ($query) => $query->where('organization_id', $organization->getKey())),
            ],
        ]);

        $jobTitle->forceFill([
            'pathway_id' => $validated['pathway_id'] ?? null,
        ])->save();

        $pathwayAssignments->syncJobTitle($jobTitle);

        return back()->with('status', 'Job title pathway updated.');
    }

    /**
     * @param  array<int, array<string, mixed>>  $rows
     * @return array{created_logins:int, invitations_sent:int, updated:int}
     */
    private function importEmployeeRows(Request $request, Organization $organization, array $rows): array
    {
        $invitations = [];

        $result = DB::transaction(function () use ($request, $organization, $rows, &$invitations): array {
            $createdLogins = 0;
            $invitationsSent = 0;
            $updated = 0;

            foreach ($rows as $row) {
                $data = $this->normalizeEmployeeRow($row);
                $user = User::query()->where('email', $data['email'])->first();

                if ($user !== null) {
                    throw ValidationException::withMessages([
                        'csv_file' => "A user with email {$data['email']} already exists.",
                    ]);
                }

                $pendingInvitation = $organization->invitations()
                    ->where('email', $data['email'])
                    ->whereNull('accepted_at')
                    ->whereNull('revoked_at')
                    ->latest()
                    ->first();

                if ($data['role'] !== OrganizationRole::Learner->value
                    && $pendingInvitation?->isPending()) {
                    throw ValidationException::withMessages([
                        'csv_file' => "A pending invitation for {$data['email']} already exists.",
                    ]);
                }

                if ($data['role'] === OrganizationRole::Learner->value) {

                    $user = User::create([
                        'name' => $data['name'],
                        'email' => $data['email'],
                        'password' => $data['temporary_password'],
                        'organization_id' => $organization->getKey(),
                        'organization_role' => OrganizationRole::Learner,
                        'account_status' => 'active',
                        'activated_at' => now(),
                        'email_verified_at' => now(),
                        'must_change_password' => true,
                    ]);

                    $organization->invitations()
                        ->where('email', $data['email'])
                        ->whereNull('accepted_at')
                        ->whereNull('revoked_at')
                        ->update(['revoked_at' => now()]);

                    $user->teams()->syncWithPivotValues($data['team_ids'], [
                        'created_by_id' => $request->user()->getKey(),
                    ]);

                    $createdLogins++;

                    continue;
                }

                $invitation = $organization->invitations()->create([
                    'invited_by_id' => $request->user()->getKey(),
                    'email' => $data['email'],
                    'organization_role' => $data['role'],
                    'token' => Str::uuid()->toString(),
                    'expires_at' => now()->addDays(14),
                ]);
                $invitations[] = $invitation;

                $invitationsSent++;
            }

            return [
                'created_logins' => $createdLogins,
                'invitations_sent' => $invitationsSent,
                'updated' => $updated,
            ];
        });

        foreach ($invitations as $invitation) {
            Notification::route('mail', $invitation->email)
                ->notify(new OrganizationInvitationNotification($invitation));
        }

        return $result;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function parseEmployeeRows(string $input): array
    {
        return collect(preg_split('/\r\n|\r|\n/', $input) ?: [])
            ->map(fn (string $line): string => trim($line))
            ->filter()
            ->map(function (string $line): array {
                $parts = array_map('trim', str_getcsv($line));

                return [
                    'name' => $parts[0] ?? '',
                    'email' => $parts[1] ?? '',
                    'role' => $parts[2] ?? OrganizationRole::Learner->value,
                    'temporary_password' => $parts[3] ?? '',
                    'team_ids' => $parts[4] ?? '',
                ];
            })
            ->all();
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array{name:string,email:string,role:string,temporary_password:string,team_ids:array<int>}
     */
    private function normalizeEmployeeRow(array $row): array
    {
        $email = Str::lower(trim((string) ($row['email'] ?? '')));
        $role = trim((string) ($row['role'] ?? OrganizationRole::Learner->value));
        $name = trim((string) ($row['name'] ?? ''));
        $temporaryPassword = trim((string) ($row['temporary_password'] ?? ''));
        $teamIdsRaw = (string) ($row['team_ids'] ?? '');

        if (! in_array($role, [
            OrganizationRole::OrganizationAdmin->value,
            OrganizationRole::Manager->value,
            OrganizationRole::Learner->value,
        ], true)) {
            throw ValidationException::withMessages([
                'employees' => 'Each row must use organization_admin, manager, or learner as the role.',
            ]);
        }

        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw ValidationException::withMessages([
                'employees' => 'Each row must include a valid email address.',
            ]);
        }

        if ($name === '') {
            $name = Str::headline(Str::before($email, '@'));
        }

        if ($role === OrganizationRole::Learner->value && strlen($temporaryPassword) < 8) {
            throw ValidationException::withMessages([
                'employees' => 'Learner rows must include a temporary password with at least 8 characters.',
            ]);
        }

        $teamIds = collect(preg_split('/[|,;]/', $teamIdsRaw) ?: [])
            ->map(fn (string $teamId) => (int) trim($teamId))
            ->filter()
            ->unique()
            ->values()
            ->all();

        return [
            'name' => $name,
            'email' => $email,
            'role' => $role,
            'temporary_password' => $temporaryPassword,
            'team_ids' => $teamIds,
        ];
    }

    /**
     * @param  array{created_logins:int, invitations_sent:int, updated:int}  $result
     */
    private function importResponse(Request $request, array $result, string $message): RedirectResponse|JsonResponse
    {
        $summary = trim(sprintf(
            '%s %s learner login%s created and %s web invitation%s sent.',
            $message,
            $result['created_logins'],
            $result['created_logins'] === 1 ? '' : 's',
            $result['invitations_sent'],
            $result['invitations_sent'] === 1 ? '' : 's',
        ));

        if ($request->expectsJson()) {
            return response()->json([
                'message' => $summary,
                'summary' => $result,
            ], 201);
        }

        return back()->with('status', $summary);
    }

    /**
     * @param  array<int, string>  $headers
     * @param  array<int, array<int, string|int|null>>  $rows
     */
    private function streamCsvDownload(string $fileName, array $headers, array $rows = []): StreamedResponse
    {
        return response()->streamDownload(function () use ($headers, $rows): void {
            $output = fopen('php://output', 'w');

            if ($output === false) {
                return;
            }

            fwrite($output, "\xEF\xBB\xBF");
            fputcsv($output, $headers);

            foreach ($rows as $row) {
                fputcsv($output, $row);
            }

            fclose($output);
        }, $fileName, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    /**
     * Build the payload used across the employee pages.
     */
    private function userRow(User $user, ?User $viewer = null, ?Collection $assignments = null, ?Collection $progressByUser = null): array
    {
        $teamIds = $user->teams->pluck('id')->values()->all();
        $managedTeamIds = $user->managedTeams->pluck('id')->values()->all();
        $filterTeamIds = collect([...$teamIds, ...$managedTeamIds])->unique()->values()->all();
        $viewer ??= $user;

        $userProgresses = $progressByUser?->get($user->getKey(), collect()) ?? collect();
        $lastActiveAt = $userProgresses->max('updated_at');

        [$trainingStatus, $trainingSummary] = $this->trainingSummary(
            $user,
            $assignments ?? collect(),
            $progressByUser ?? collect(),
        );

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'organization_role' => $user->organization_role?->value,
            'organization_role_label' => $user->organization_role?->label(),
            'account_status' => $user->isDeactivated() ? 'deactivated' : 'active',
            'account_status_label' => $user->isDeactivated() ? 'Deactivated' : 'Active',
            'must_change_password' => (bool) $user->must_change_password,
            'created_at' => $user->created_at?->toIso8601String(),
            'last_active_at' => $lastActiveAt?->toIso8601String(),
            'is_current_user' => $viewer->is($user),
            'job_title_id' => $user->job_title_id,
            'job_title' => $user->jobTitle === null
                ? null
                : $user->jobTitle->only(['id', 'name']) + [
                    'pathway' => $user->jobTitle->pathway?->only(['id', 'name']),
                ],
            'location_id' => $user->location_id,
            'location' => $user->location?->only(['id', 'name']),
            'team_assignment_mode' => $user->isManager()
                ? 'manager'
                : ($user->isLearner() ? 'learner' : 'admin'),
            'assigned_team_ids' => $user->isManager()
                ? $managedTeamIds
                : ($user->isLearner()
                    ? $teamIds
                    : []),
            'filter_team_ids' => $filterTeamIds,
            'teams' => $user->teams->map(fn (Team $team): array => $team->only(['id', 'name'])),
            'managed_teams' => $user->managedTeams->map(fn (Team $team): array => $team->only(['id', 'name'])),
            'training_status' => $trainingStatus,
            'training_status_label' => Str::headline(str_replace('_', ' ', $trainingStatus)),
            'training_summary' => $trainingSummary,
        ];
    }

    /**
     * @return array{0:string,1:array<string,int|null>}
     */
    private function trainingSummary(User $user, Collection $assignments, Collection $progressByUser): array
    {
        $userTeamIds = $user->teams->pluck('id')->values()->all();
        $jobTitleId = $user->job_title_id;
        $locationId = $user->location_id;

        $relevantAssignments = $assignments->filter(function (CourseAssignment $assignment) use ($user, $userTeamIds, $jobTitleId, $locationId): bool {
            if ($assignment->assigned_to_user_id === $user->getKey()) {
                return true;
            }

            if ($assignment->assigned_to_team_id !== null && in_array((int) $assignment->assigned_to_team_id, $userTeamIds, true)) {
                return true;
            }

            if ($jobTitleId !== null && $assignment->assigned_to_job_title_id === $jobTitleId) {
                return true;
            }

            return $locationId !== null
                && $assignment->assigned_to_location_id === $locationId;
        });

        $userProgresses = $progressByUser->get($user->getKey(), collect());
        $completedByCourse = $userProgresses
            ->filter(fn (CourseProgress $progress) => $progress->status === 'completed' || $progress->passed === true)
            ->keyBy('course_id');
        $relevantAssignmentsByCourse = $relevantAssignments->groupBy('course_id');
        $overdueCount = $relevantAssignmentsByCourse->filter(function (Collection $courseAssignments, int $courseId) use ($completedByCourse): bool {
            if ($completedByCourse->has($courseId)) {
                return false;
            }

            return $courseAssignments->contains(
                fn (CourseAssignment $assignment): bool => $assignment->due_at !== null && $assignment->due_at->isPast(),
            );
        })->count();
        $assignedCourseCount = $relevantAssignmentsByCourse->count();
        $completedCourseCount = $completedByCourse->count();
        $scores = $userProgresses
            ->pluck('score_percent')
            ->filter(fn ($score) => $score !== null)
            ->values();

        $averageScore = $scores->isEmpty()
            ? null
            : (int) round($scores->avg());

        $status = match (true) {
            $assignedCourseCount === 0 && $userProgresses->isEmpty() => 'unassigned',
            $overdueCount > 0 => 'overdue',
            $assignedCourseCount > 0 && $completedCourseCount >= $assignedCourseCount => 'completed',
            default => 'in_progress',
        };

        return [
            $status,
            [
                'assigned_courses' => $assignedCourseCount,
                'completed_courses' => $completedCourseCount,
                'overdue_courses' => $overdueCount,
                'average_score_percent' => $averageScore,
                'completion_percent' => $assignedCourseCount === 0
                    ? null
                    : min(100, (int) round(($completedCourseCount / $assignedCourseCount) * 100)),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function transcriptPayload(User $user): array
    {
        $records = CourseProgress::query()
            ->with([
                'course' => fn ($query) => $query->withCount('lessons'),
                'lastCompletedLesson',
            ])
            ->where('user_id', $user->getKey())
            ->orderByDesc('updated_at')
            ->get();

        $summary = [
            'total_courses' => $records->count(),
            'completed_courses' => $records->where('status', 'completed')->count(),
            'passed_courses' => $records->where('passed', true)->count(),
            'average_score_percent' => $this->averageScore($records),
            'latest_completion_at' => $records->first()?->completed_at?->toIso8601String(),
        ];

        return [
            'summary' => $summary,
            'records' => $records->map(fn (CourseProgress $progress): array => [
                'id' => $progress->id,
                'course' => $this->coursePayload($progress->course, $progress),
                'progress' => $this->progressPayload($progress),
                'last_completed_lesson' => $progress->lastCompletedLesson?->only([
                    'id',
                    'title',
                    'slug',
                ]),
            ])->values(),
        ];
    }

    private function averageScore(Collection $records): ?int
    {
        $scores = $records
            ->pluck('score_percent')
            ->filter(fn ($score) => $score !== null)
            ->values();

        if ($scores->isEmpty()) {
            return null;
        }

        return (int) round($scores->avg());
    }

    /**
     * @return array<string, mixed>|null
     */
    private function pathwayProgressSummary(User $user): ?array
    {
        $user->loadMissing([
            'jobTitle.pathway.items.course',
            'jobTitle.pathway.items.lesson.course',
            'jobTitle.pathway.milestones',
            'location',
        ]);

        $pathway = $user->jobTitle?->pathway;

        if ($pathway === null) {
            return null;
        }

        $items = $pathway->items->values();
        $milestones = $pathway->milestones->values();
        $courseIds = $items->where('item_type', 'course')->pluck('course_id')->filter()->all();
        $lessonIds = $items->where('item_type', 'microlearning')->pluck('lesson_id')->filter()->all();

        $courseProgresses = CourseProgress::query()
            ->where('user_id', $user->getKey())
            ->when($courseIds !== [], fn ($query) => $query->whereIn('course_id', $courseIds))
            ->get()
            ->keyBy('course_id');

        $lessonCompletions = LessonCompletion::query()
            ->where('user_id', $user->getKey())
            ->when($lessonIds !== [], fn ($query) => $query->whereIn('lesson_id', $lessonIds))
            ->get()
            ->keyBy('lesson_id');

        $requiredCount = $items->where('is_required', true)->count();
        $completedRequiredCount = 0;
        $firstIncompleteRequiredIndex = null;
        $currentItem = null;

        foreach ($items as $index => $item) {
            $isComplete = $item->item_type === 'course'
                ? $this->isCourseItemComplete($courseProgresses->get($item->course_id))
                : $lessonCompletions->has($item->lesson_id);

            if ($item->is_required && $isComplete) {
                $completedRequiredCount++;
            }

            if ($item->is_required && ! $isComplete && $firstIncompleteRequiredIndex === null) {
                $firstIncompleteRequiredIndex = $index;
                $currentItem = [
                    'id' => $item->id,
                    'item_type' => $item->item_type,
                    'title' => $item->title,
                ];
            }
        }

        $completionPercent = $requiredCount > 0
            ? (int) round(($completedRequiredCount / $requiredCount) * 100)
            : 0;

        return [
            'pathway' => [
                'id' => $pathway->id,
                'name' => $pathway->name,
                'description' => $pathway->description,
            ],
            'completion_percent' => $completionPercent,
            'required_item_count' => $requiredCount,
            'completed_required_count' => $completedRequiredCount,
            'current_item' => $currentItem,
            'sequential_completion' => $pathway->sequential_completion,
            'expected_completion_days' => $pathway->expected_completion_days,
            'milestones' => $milestones->map(function ($milestone, $index) use ($milestones, $completionPercent): array {
                $milestoneCount = max(1, $milestones->count());
                $threshold = (int) ceil((($index + 1) / $milestoneCount) * 100);

                return [
                    'id' => $milestone->id,
                    'title' => $milestone->title,
                    'description' => $milestone->description,
                    'threshold_percent' => $threshold,
                    'reached' => $completionPercent >= $threshold,
                ];
            })->values(),
        ];
    }

    private function isCourseItemComplete(?CourseProgress $progress): bool
    {
        return $progress?->completed_at !== null
            || $progress?->status === 'completed'
            || $progress?->passed === true;
    }
}
