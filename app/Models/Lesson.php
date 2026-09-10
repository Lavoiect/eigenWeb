<?php

namespace App\Models;

use Database\Factories\LessonFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $course_id
 * @property string $title
 * @property string $slug
 * @property string|null $body
 * @property int $position
 * @property bool $is_final_assessment
 * @property Carbon|null $published_at
 * @property Carbon|null $deleted_at
 */
#[Fillable([
    'course_id',
    'title',
    'slug',
    'body',
    'content',
    'position',
    'duration_minutes',
    'is_final_assessment',
    'status',
    'published_at',
])]
class Lesson extends Model
{
    /** @use HasFactory<LessonFactory> */
    use HasFactory, SoftDeletes;

    protected function casts(): array
    {
        return [
            'content' => 'array',
            'is_final_assessment' => 'boolean',
            'published_at' => 'datetime',
            'deleted_at' => 'datetime',
        ];
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function completions(): HasMany
    {
        return $this->hasMany(LessonCompletion::class);
    }

    public function isPublished(): bool
    {
        return $this->status === 'published' && $this->published_at !== null;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function blocks(): array
    {
        if (is_array($this->content) && $this->content !== []) {
            return array_values($this->content);
        }

        if (filled($this->body)) {
            return [[
                'id' => 'legacy-text',
                'type' => 'text',
                'text' => $this->body,
            ]];
        }

        return [];
    }

    /**
     * @param  array<int, array<string, mixed>>  $blocks
     */
    public function fillBlocks(array $blocks): void
    {
        $this->content = array_values($blocks);
        $this->body = $this->bodyFromBlocks($blocks);
    }

    /**
     * @param  array<int, array<string, mixed>>  $blocks
     */
    public function bodyFromBlocks(array $blocks): ?string
    {
        $text = collect($blocks)
            ->map(function (array $block): ?string {
                return match ($block['type'] ?? null) {
                    'text' => trim((string) ($block['text'] ?? '')),
                    'callout' => trim((string) ($block['text'] ?? '')),
                    'multiple_choice' => trim((string) ($block['prompt'] ?? '')),
                    'question' => trim((string) ($block['prompt'] ?? '')),
                    'video' => trim((string) ($block['caption'] ?? $block['url'] ?? '')),
                    'document' => trim((string) ($block['title'] ?? $block['url'] ?? '')),
                    'image' => trim((string) ($block['caption'] ?? $block['alt'] ?? $block['url'] ?? '')),
                    'scenario', 'ordering', 'matching', 'true_false' => trim((string) ($block['prompt'] ?? $block['statement'] ?? '')),
                    default => null,
                };
            })
            ->filter()
            ->join("\n\n");

        return $text !== '' ? $text : null;
    }
}
