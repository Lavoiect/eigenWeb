<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'organization_id',
    'course_id',
    'revision_number',
    'submitted_by_id',
    'reviewer_id',
    'status',
    'snapshot',
    'content_hash',
    'submitter_note',
    'due_at',
    'submitted_at',
    'decided_at',
    'decision_note',
])]
class CourseReview extends Model
{
    public const STATUS_IN_REVIEW = 'in_review';

    public const STATUS_CHANGES_REQUESTED = 'changes_requested';

    public const STATUS_APPROVED = 'approved';

    protected function casts(): array
    {
        return [
            'snapshot' => 'array',
            'revision_number' => 'integer',
            'due_at' => 'date',
            'submitted_at' => 'datetime',
            'decided_at' => 'datetime',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(CourseReviewComment::class)->oldest();
    }

    public function statusLabel(): string
    {
        return match ($this->status) {
            self::STATUS_APPROVED => 'Approved',
            self::STATUS_CHANGES_REQUESTED => 'Changes requested',
            default => 'In review',
        };
    }
}
