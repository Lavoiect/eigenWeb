<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $lesson_completion_id
 * @property int $organization_id
 * @property int $course_id
 * @property int $lesson_id
 * @property int $user_id
 * @property string $question_key
 * @property string $question_type
 * @property string|null $question_prompt
 * @property int $attempts_count
 * @property int $missed_attempts_count
 * @property int $correct_attempts_count
 * @property bool $was_correct
 * @property Carbon|null $completed_at
 */
#[Fillable([
    'lesson_completion_id',
    'organization_id',
    'course_id',
    'lesson_id',
    'user_id',
    'question_key',
    'question_type',
    'question_prompt',
    'attempts_count',
    'missed_attempts_count',
    'correct_attempts_count',
    'was_correct',
    'completed_at',
])]
class LessonQuestionAttempt extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'attempts_count' => 'integer',
            'missed_attempts_count' => 'integer',
            'correct_attempts_count' => 'integer',
            'was_correct' => 'boolean',
            'completed_at' => 'datetime',
        ];
    }

    public function lessonCompletion(): BelongsTo
    {
        return $this->belongsTo(LessonCompletion::class);
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function lesson(): BelongsTo
    {
        return $this->belongsTo(Lesson::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
