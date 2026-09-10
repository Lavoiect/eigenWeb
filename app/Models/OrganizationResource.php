<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $organization_id
 * @property string $title
 * @property string|null $description
 * @property string|null $category
 * @property array<int, string>|null $tags
 * @property bool $featured
 * @property string|null $organization_role
 * @property Carbon|null $revision_date
 * @property string $status
 * @property Carbon|null $archived_at
 */
#[Fillable([
    'organization_id',
    'created_by_id',
    'updated_by_id',
    'course_id',
    'resource_type',
    'title',
    'description',
    'quick_guide_content',
    'video_url',
    'external_url',
    'category',
    'tags',
    'featured',
    'organization_role',
    'audience_everyone',
    'job_title_ids',
    'team_ids',
    'location_ids',
    'course_ids',
    'revision_date',
    'effective_date',
    'review_date',
    'expiration_date',
    'published_at',
    'status',
    'archived_at',
    'current_version',
    'view_count',
])]
class OrganizationResource extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'tags' => 'array',
            'quick_guide_content' => 'array',
            'featured' => 'boolean',
            'audience_everyone' => 'boolean',
            'job_title_ids' => 'array',
            'team_ids' => 'array',
            'location_ids' => 'array',
            'course_ids' => 'array',
            'revision_date' => 'date',
            'effective_date' => 'date',
            'review_date' => 'date',
            'expiration_date' => 'date',
            'published_at' => 'datetime',
            'archived_at' => 'datetime',
            'current_version' => 'integer',
            'view_count' => 'integer',
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

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by_id');
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function versions(): HasMany
    {
        return $this->hasMany(OrganizationResourceVersion::class)
            ->orderByDesc('version_number')
            ->orderByDesc('created_at');
    }

    public function latestVersion(): HasOne
    {
        return $this->hasOne(OrganizationResourceVersion::class)
            ->latestOfMany('version_number');
    }

    public function isArchived(): bool
    {
        return $this->status === 'archived' || $this->archived_at !== null;
    }

    public function isFeatured(): bool
    {
        return $this->featured;
    }
}
