<?php

namespace App\Models;

use App\Enums\AccountStatus;
use App\Enums\OrganizationRole;
use App\Enums\PlatformRole;
use App\Notifications\AccountActivation;
// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Auth\Notifications\ResetPassword as ResetPasswordNotification;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Laravel\Sanctum\HasApiTokens;

/**
 * @property int $id
 * @property string $name
 * @property string $email
 * @property Carbon|null $email_verified_at
 * @property string $password
 * @property string|null $two_factor_secret
 * @property string|null $two_factor_recovery_codes
 * @property Carbon|null $two_factor_confirmed_at
 * @property string|null $remember_token
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'email', 'password', 'organization_id', 'organization_role', 'platform_role', 'account_status', 'activated_at', 'job_title_id', 'location_id', 'must_change_password', 'deactivated_at'])]
#[Hidden(['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'organization_role' => OrganizationRole::class,
            'platform_role' => PlatformRole::class,
            'account_status' => AccountStatus::class,
            'activated_at' => 'datetime',
            'must_change_password' => 'boolean',
            'deactivated_at' => 'datetime',
        ];
    }

    public function requiresPasswordChange(): bool
    {
        return (bool) $this->must_change_password;
    }

    public function isDeactivated(): bool
    {
        return $this->deactivated_at !== null;
    }

    public function canLogin(): bool
    {
        return ! $this->isDeactivated()
            && $this->account_status === AccountStatus::Active
            && ($this->isSuperAdmin() || ! $this->organization?->isSuspended());
    }

    public function sendPasswordResetNotification($token): void
    {
        $notification = $this->account_status === AccountStatus::Pending
            ? new AccountActivation($token)
            : new ResetPasswordNotification($token);

        $this->notify($notification);
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function jobTitle(): BelongsTo
    {
        return $this->belongsTo(JobTitle::class);
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function teams(): BelongsToMany
    {
        return $this->belongsToMany(Team::class, 'team_memberships')
            ->withPivot(['created_by_id'])
            ->withTimestamps();
    }

    public function managedTeams(): BelongsToMany
    {
        return $this->belongsToMany(Team::class, 'team_manager_assignments')
            ->withPivot(['assigned_by_id'])
            ->withTimestamps();
    }

    public function invitationsSent(): HasMany
    {
        return $this->hasMany(OrganizationInvitation::class, 'invited_by_id');
    }

    public function courseAssignments(): HasMany
    {
        return $this->hasMany(CourseAssignment::class, 'assigned_to_user_id');
    }

    public function courseProgresses(): HasMany
    {
        return $this->hasMany(CourseProgress::class);
    }

    public function lessonCompletions(): HasMany
    {
        return $this->hasMany(LessonCompletion::class);
    }

    public function pushDevices(): HasMany
    {
        return $this->hasMany(PushDevice::class);
    }

    public function isSuperAdmin(): bool
    {
        return $this->platform_role === PlatformRole::SuperAdmin;
    }

    public function isOrganizationAdmin(): bool
    {
        return $this->organization_role === OrganizationRole::OrganizationAdmin;
    }

    public function isManager(): bool
    {
        return $this->organization_role === OrganizationRole::Manager;
    }

    public function isLearner(): bool
    {
        return $this->organization_role === OrganizationRole::Learner;
    }

    public function canAccessPlatformAdministration(): bool
    {
        return $this->isSuperAdmin();
    }

    public function canAccessOrganization(?Organization $organization = null): bool
    {
        if ($this->isSuperAdmin()) {
            return true;
        }

        if ($organization === null) {
            return $this->organization_id !== null;
        }

        return $this->organization_id === $organization->getKey();
    }

    public function canManageOrganizationSettings(?Organization $organization = null): bool
    {
        return $this->isSuperAdmin()
            || ($this->isOrganizationAdmin() && $this->canAccessOrganization($organization));
    }

    public function canManageUsers(?Organization $organization = null): bool
    {
        return $this->canManageOrganizationSettings($organization);
    }

    public function canManageTeams(?Organization $organization = null): bool
    {
        return $this->canManageOrganizationSettings($organization);
    }

    public function canAuthorTraining(?Organization $organization = null): bool
    {
        return $this->canManageOrganizationSettings($organization);
    }

    public function canAssignTraining(Organization|Team|null $scope = null): bool
    {
        if ($this->isSuperAdmin() || $this->isOrganizationAdmin()) {
            return $scope === null || $this->canAccessScope($scope);
        }

        if ($scope instanceof Team) {
            return $this->isManager() && $this->canAccessScope($scope) && $this->managesTeam($scope);
        }

        return false;
    }

    public function canManageResources(?Organization $organization = null): bool
    {
        return $this->canManageOrganizationSettings($organization);
    }

    public function canViewOrganizationReporting(?Organization $organization = null): bool
    {
        return $this->canManageOrganizationSettings($organization)
            || ($this->isManager() && $this->canAccessOrganization($organization));
    }

    public function canViewKnowledgeGaps(?Organization $organization = null): bool
    {
        return $this->canViewOrganizationReporting($organization);
    }

    public function canManageMicrolearning(?Organization $organization = null): bool
    {
        return $this->canManageOrganizationSettings($organization);
    }

    public function canInviteMembers(?Organization $organization = null): bool
    {
        return $this->canManageUsers($organization);
    }

    public function canViewCourse(Course $course): bool
    {
        if (! $this->canAccessOrganization($course->organization)) {
            return false;
        }

        if ($this->isSuperAdmin() || $this->isOrganizationAdmin()) {
            return true;
        }

        if (! $course->isPublished()) {
            return false;
        }

        if ($this->isManager()) {
            $jobTitleIds = $this->visibleJobTitleIds($course->organization);
            $locationIds = $this->visibleLocationIds($course->organization);

            return $course->assignments()
                ->where(function ($query) use ($jobTitleIds, $locationIds): void {
                    $query->where('assigned_to_user_id', $this->getKey())
                        ->orWhereIn('assigned_to_team_id', $this->managedTeams()->select('teams.id'));

                    if ($jobTitleIds->isNotEmpty()) {
                        $query->orWhereIn('assigned_to_job_title_id', $jobTitleIds->all());
                    }

                    if ($locationIds->isNotEmpty()) {
                        $query->orWhereIn('assigned_to_location_id', $locationIds->all());
                    }
                })
                ->exists();
        }

        if ($this->isLearner()) {
            $jobTitleIds = $this->visibleJobTitleIds($course->organization);
            $locationIds = $this->visibleLocationIds($course->organization);

            return $course->assignments()
                ->where(function ($query) use ($jobTitleIds, $locationIds): void {
                    $query->where('assigned_to_user_id', $this->getKey())
                        ->orWhereIn('assigned_to_team_id', $this->teams()->select('teams.id'));

                    if ($jobTitleIds->isNotEmpty()) {
                        $query->orWhereIn('assigned_to_job_title_id', $jobTitleIds->all());
                    }

                    if ($locationIds->isNotEmpty()) {
                        $query->orWhereIn('assigned_to_location_id', $locationIds->all());
                    }
                })
                ->exists();
        }

        return false;
    }

    public function canViewLesson(Lesson $lesson): bool
    {
        if (! $this->canViewCourse($lesson->course)) {
            return false;
        }

        return $this->isSuperAdmin()
            || $this->isOrganizationAdmin()
            || $lesson->isPublished();
    }

    public function canCompleteLesson(Lesson $lesson): bool
    {
        return $this->canViewLesson($lesson);
    }

    public function canViewTeam(?Team $team = null): bool
    {
        if ($this->isSuperAdmin() || $this->isOrganizationAdmin()) {
            return $team === null || $this->canAccessScope($team);
        }

        if ($team === null) {
            return $this->isManager() || $this->isLearner();
        }

        return $this->isManager()
            ? $this->managesTeam($team)
            : $team->members()->whereKey($this->getKey())->exists();
    }

    public function canViewTeamReporting(?Team $team = null): bool
    {
        if ($this->isSuperAdmin() || $this->isOrganizationAdmin()) {
            return $team === null || $this->canAccessScope($team);
        }

        return $team !== null && $this->isManager() && $this->managesTeam($team);
    }

    public function canViewOwnTraining(): bool
    {
        return $this->isLearner() || $this->isManager() || $this->isOrganizationAdmin() || $this->isSuperAdmin();
    }

    public function canManageTeamMembers(?Team $team = null): bool
    {
        return $this->canViewTeamReporting($team);
    }

    public function visibleJobTitleIds(?Organization $organization = null): Collection
    {
        $organization ??= $this->organization;

        if ($organization === null) {
            return collect();
        }

        if ($this->isSuperAdmin() || $this->isOrganizationAdmin()) {
            return $organization->users()
                ->whereNotNull('job_title_id')
                ->distinct()
                ->pluck('job_title_id')
                ->values();
        }

        if ($this->isManager()) {
            $teamIds = $this->managedTeams()->select('teams.id');

            return $organization->users()
                ->where(function ($query) use ($teamIds): void {
                    $query->whereKey($this->getKey())
                        ->orWhereHas('teams', fn ($teamQuery) => $teamQuery->whereIn('teams.id', $teamIds));
                })
                ->whereNotNull('job_title_id')
                ->distinct()
                ->pluck('job_title_id')
                ->values();
        }

        return collect([$this->job_title_id])
            ->filter()
            ->unique()
            ->values();
    }

    public function visibleLocationIds(?Organization $organization = null): Collection
    {
        $organization ??= $this->organization;

        if ($organization === null) {
            return collect();
        }

        if ($this->isSuperAdmin() || $this->isOrganizationAdmin()) {
            return $organization->users()
                ->whereNotNull('location_id')
                ->distinct()
                ->pluck('location_id')
                ->values();
        }

        if ($this->isManager()) {
            $teamIds = $this->managedTeams()->select('teams.id');

            return $organization->users()
                ->where(function ($query) use ($teamIds): void {
                    $query->whereKey($this->getKey())
                        ->orWhereHas('teams', fn ($teamQuery) => $teamQuery->whereIn('teams.id', $teamIds));
                })
                ->whereNotNull('location_id')
                ->distinct()
                ->pluck('location_id')
                ->values();
        }

        return collect([$this->location_id])
            ->filter()
            ->unique()
            ->values();
    }

    public function managesTeam(Team $team): bool
    {
        return $this->managedTeams()
            ->whereKey($team->getKey())
            ->exists();
    }

    protected function canAccessScope(Organization|Team $scope): bool
    {
        if ($scope instanceof Organization) {
            return $this->canAccessOrganization($scope);
        }

        return $this->canAccessOrganization($scope->organization) && (
            $this->isOrganizationAdmin() || $this->managesTeam($scope)
        );
    }
}
