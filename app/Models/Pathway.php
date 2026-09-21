<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Database\Factories\PathwayFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $organization_id
 * @property string $name
 */
#[Fillable([
    'organization_id',
    'created_by_id',
    'name',
    'description',
    'sequential_completion',
    'expected_completion_days',
])]
class Pathway extends Model
{
    /** @use HasFactory<PathwayFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'sequential_completion' => 'boolean',
            'expected_completion_days' => 'integer',
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

    public function jobTitles(): HasMany
    {
        return $this->hasMany(JobTitle::class);
    }

    public function courses(): HasMany
    {
        return $this->hasMany(Course::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(PathwayItem::class)->orderBy('sort_order')->orderBy('id');
    }

    public function milestones(): HasMany
    {
        return $this->hasMany(PathwayMilestone::class)->orderBy('sort_order')->orderBy('id');
    }

    public function completionDueAt(?CarbonInterface $assignedAt = null): ?CarbonInterface
    {
        if ($this->expected_completion_days === null) {
            return null;
        }

        return ($assignedAt ?? now())->copy()->addDays($this->expected_completion_days);
    }
}
