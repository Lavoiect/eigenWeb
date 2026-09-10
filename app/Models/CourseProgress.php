<?php

namespace App\Models;

use Database\Factories\CourseProgressFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $course_id
 * @property int $user_id
 * @property string $status
 * @property int $completed_lessons_count
 * @property int $total_lessons_count
 * @property int $progress_percent
 * @property int|null $score_percent
 * @property int $scored_questions_count
 * @property int $correct_questions_count
 * @property bool|null $passed
 * @property Carbon|null $completed_at
 */
#[Fillable([
    'course_id',
    'user_id',
    'status',
    'completed_lessons_count',
    'total_lessons_count',
    'progress_percent',
    'score_percent',
    'scored_questions_count',
    'correct_questions_count',
    'passed',
    'last_completed_lesson_id',
    'completed_at',
])]
class CourseProgress extends Model
{
    /** @use HasFactory<CourseProgressFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'score_percent' => 'integer',
            'scored_questions_count' => 'integer',
            'correct_questions_count' => 'integer',
            'passed' => 'boolean',
            'completed_at' => 'datetime',
        ];
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function lastCompletedLesson(): BelongsTo
    {
        return $this->belongsTo(Lesson::class, 'last_completed_lesson_id');
    }
}
