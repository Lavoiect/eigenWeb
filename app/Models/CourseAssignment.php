<?php

namespace App\Models;

use Database\Factories\CourseAssignmentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $course_id
 * @property int|null $assigned_to_user_id
 * @property int|null $assigned_to_team_id
 * @property int|null $assigned_to_job_title_id
 * @property int|null $assigned_to_location_id
 * @property int|null $assigned_to_pathway_id
 * @property Carbon|null $due_at
 */
#[Fillable([
    'course_id',
    'assigned_by_id',
    'assigned_to_user_id',
    'assigned_to_team_id',
    'assigned_to_job_title_id',
    'assigned_to_location_id',
    'assigned_to_pathway_id',
    'due_at',
    'is_required',
    'recurs_every_days',
    'reminder_count',
    'last_reminded_at',
])]
class CourseAssignment extends Model
{
    /** @use HasFactory<CourseAssignmentFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'due_at' => 'datetime',
            'is_required' => 'boolean',
            'recurs_every_days' => 'integer',
            'reminder_count' => 'integer',
            'last_reminded_at' => 'datetime',
        ];
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function assignedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by_id');
    }

    public function assignedToUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to_user_id');
    }

    public function assignedToTeam(): BelongsTo
    {
        return $this->belongsTo(Team::class, 'assigned_to_team_id');
    }

    public function assignedToJobTitle(): BelongsTo
    {
        return $this->belongsTo(JobTitle::class, 'assigned_to_job_title_id');
    }

    public function assignedToLocation(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'assigned_to_location_id');
    }

    public function assignedToPathway(): BelongsTo
    {
        return $this->belongsTo(Pathway::class, 'assigned_to_pathway_id');
    }

    public function sourceType(): string
    {
        return match (true) {
            $this->assigned_to_pathway_id !== null => 'pathway',
            $this->assigned_to_user_id !== null => 'direct',
            $this->assigned_to_team_id !== null => 'team',
            $this->assigned_to_job_title_id !== null => 'job_title',
            $this->assigned_to_location_id !== null => 'location',
            default => 'direct',
        };
    }
}
