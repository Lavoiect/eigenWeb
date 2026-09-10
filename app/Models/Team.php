<?php

namespace App\Models;

use Database\Factories\TeamFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $organization_id
 * @property string $name
 */
#[Fillable(['organization_id', 'name', 'description'])]
class Team extends Model
{
    /** @use HasFactory<TeamFactory> */
    use HasFactory;

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'team_memberships')
            ->withPivot(['created_by_id'])
            ->withTimestamps();
    }

    public function managers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'team_manager_assignments')
            ->withPivot(['assigned_by_id'])
            ->withTimestamps();
    }

    public function membershipRecords(): HasMany
    {
        return $this->hasMany(TeamMembership::class);
    }

    public function managerAssignments(): HasMany
    {
        return $this->hasMany(TeamManagerAssignment::class);
    }

    public function courseAssignments(): HasMany
    {
        return $this->hasMany(CourseAssignment::class, 'assigned_to_team_id');
    }

    public function isManagedBy(User $user): bool
    {
        if ($user->isSuperAdmin() || $user->isOrganizationAdmin()) {
            return true;
        }

        return $this->managers()->whereKey($user->getKey())->exists();
    }
}
