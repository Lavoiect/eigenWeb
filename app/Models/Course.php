<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Database\Factories\CourseFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $organization_id
 * @property string $content_type
 * @property string $title
 * @property string $slug
 * @property string|null $description
 * @property int|null $completion_window_days
 * @property string $status
 * @property Carbon|null $published_at
 * @property Carbon|null $archived_at
 */
#[Fillable([
    'organization_id',
    'created_by_id',
    'pathway_id',
    'content_type',
    'title',
    'slug',
    'subject',
    'description',
    'learning_objectives',
    'estimated_minutes',
    'completion_window_days',
    'passing_score',
    'status',
    'published_at',
    'archived_at',
])]
class Course extends Model
{
    /** @use HasFactory<CourseFactory> */
    use HasFactory;

    protected static function booted(): void
    {
        static::updated(function (Course $course): void {
            if ($course->wasChanged('status') && $course->isArchived()) {
                $course->assignments()->delete();
            }
        });
    }

    protected function casts(): array
    {
        return [
            'learning_objectives' => 'array',
            'estimated_minutes' => 'integer',
            'completion_window_days' => 'integer',
            'passing_score' => 'integer',
            'published_at' => 'datetime',
            'archived_at' => 'datetime',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_id');
    }

    public function pathway(): BelongsTo
    {
        return $this->belongsTo(Pathway::class);
    }

    public function lessons(): HasMany
    {
        return $this->hasMany(Lesson::class)->orderBy('position');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(CourseAssignment::class);
    }

    public function assets(): HasMany
    {
        return $this->hasMany(CourseAsset::class)
            ->orderByRaw("CASE kind WHEN 'video' THEN 0 WHEN 'document' THEN 1 ELSE 2 END")
            ->orderBy('sort_order')
            ->orderByDesc('created_at');
    }

    public function progressRecords(): HasMany
    {
        return $this->hasMany(CourseProgress::class);
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(CourseReview::class)->orderByDesc('revision_number');
    }

    public function isPublished(): bool
    {
        return $this->status === 'published' && $this->published_at !== null;
    }

    public function isMicrolearning(): bool
    {
        return $this->content_type === 'microlearning';
    }

    public function isFullCourse(): bool
    {
        return $this->content_type === 'course';
    }

    public function isArchived(): bool
    {
        return $this->status === 'archived';
    }

    public function completionDueAt(?CarbonInterface $assignedAt = null): ?CarbonInterface
    {
        if ($this->completion_window_days === null) {
            return null;
        }

        return ($assignedAt ?? now())->copy()->addDays($this->completion_window_days);
    }

    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->isSuperAdmin()) {
            return $query;
        }

        $query->where('organization_id', $user->organization_id);

        if ($user->isOrganizationAdmin()) {
            return $query;
        }

        if ($user->isManager()) {
            $jobTitleIds = $user->visibleJobTitleIds($user->organization);
            $locationIds = $user->visibleLocationIds($user->organization);

            return $query
                ->where('status', 'published')
                ->where(function (Builder $builder) use ($user, $jobTitleIds, $locationIds): void {
                    $builder->whereHas('assignments', function (Builder $assignmentQuery) use ($user): void {
                        $assignmentQuery->where('assigned_to_user_id', $user->getKey())
                            ->orWhereIn(
                                'assigned_to_team_id',
                                $user->managedTeams()->select('teams.id'),
                            );
                    });

                    if ($jobTitleIds->isNotEmpty()) {
                        $builder->orWhereHas('assignments', function (Builder $assignmentQuery) use ($jobTitleIds): void {
                            $assignmentQuery->whereIn('assigned_to_job_title_id', $jobTitleIds->all());
                        });
                    }

                    if ($locationIds->isNotEmpty()) {
                        $builder->orWhereHas('assignments', function (Builder $assignmentQuery) use ($locationIds): void {
                            $assignmentQuery->whereIn('assigned_to_location_id', $locationIds->all());
                        });
                    }
                });
        }

        $jobTitleIds = $user->visibleJobTitleIds($user->organization);
        $locationIds = $user->visibleLocationIds($user->organization);

        return $query
            ->where('status', 'published')
            ->where(function (Builder $builder) use ($user, $jobTitleIds, $locationIds): void {
                $builder->whereHas('assignments', function (Builder $assignmentQuery) use ($user): void {
                    $assignmentQuery->where('assigned_to_user_id', $user->getKey())
                        ->orWhereIn(
                            'assigned_to_team_id',
                            $user->teams()->select('teams.id'),
                        );
                });

                if ($jobTitleIds->isNotEmpty()) {
                    $builder->orWhereHas('assignments', function (Builder $assignmentQuery) use ($jobTitleIds): void {
                        $assignmentQuery->whereIn('assigned_to_job_title_id', $jobTitleIds->all());
                    });
                }

                if ($locationIds->isNotEmpty()) {
                    $builder->orWhereHas('assignments', function (Builder $assignmentQuery) use ($locationIds): void {
                        $assignmentQuery->whereIn('assigned_to_location_id', $locationIds->all());
                    });
                }
            });
    }
}
