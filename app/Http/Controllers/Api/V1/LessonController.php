<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\FormatsLearningApiResponses;
use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\CourseProgress;
use App\Models\Lesson;
use App\Models\LessonCompletion;
use App\Models\LessonQuestionAttempt;
use App\Models\User;
use App\Services\ExpoPushService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LessonController extends Controller
{
    use FormatsLearningApiResponses;

    public function show(Request $request, Course $course, Lesson $lesson): JsonResponse
    {
        $user = $request->user()->loadMissing('organization');
        $this->assertContentContext($user);
        $this->authorize('view', $lesson);
        abort_unless($lesson->course_id === $course->id, 404);

        $lesson->loadMissing([
            'completions' => fn ($query) => $query->where('user_id', $user->getKey()),
        ]);

        $completion = $lesson->completions->first();

        return response()->json([
            'lesson' => $this->lessonPayload($lesson, $completion),
        ]);
    }

    public function complete(
        Request $request,
        Course $course,
        Lesson $lesson,
        ExpoPushService $pushService,
    ): JsonResponse {
        $user = $request->user()->loadMissing('organization');
        $this->assertContentContext($user);
        $this->authorize('complete', $lesson);
        abort_unless($lesson->course_id === $course->id, 404);

        $validated = $request->validate([
            'score_percent' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:100'],
            'scored_questions_count' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'correct_questions_count' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'passed' => ['sometimes', 'nullable', 'boolean'],
            'question_attempts' => ['sometimes', 'array'],
            'question_attempts.*.question_key' => ['required_with:question_attempts', 'string', 'max:255'],
            'question_attempts.*.question_type' => ['required_with:question_attempts', 'string', 'max:50'],
            'question_attempts.*.question_prompt' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'question_attempts.*.attempts_count' => ['sometimes', 'integer', 'min:1'],
            'question_attempts.*.missed_attempts_count' => ['sometimes', 'integer', 'min:0'],
            'question_attempts.*.correct_attempts_count' => ['sometimes', 'integer', 'min:0'],
            'question_attempts.*.was_correct' => ['sometimes', 'boolean'],
        ]);
        $scoreSummary = $validated;

        $completion = null;
        $progress = null;

        DB::transaction(function () use (
            $lesson,
            $course,
            $user,
            $scoreSummary,
            $validated,
            &$completion,
            &$progress,
        ): void {
            $completion = LessonCompletion::query()->updateOrCreate(
                [
                    'lesson_id' => $lesson->getKey(),
                    'user_id' => $user->getKey(),
                ],
                [
                    'completed_at' => now(),
                ],
            );

            if (array_key_exists('question_attempts', $validated)) {
                $this->syncQuestionAttempts(
                    $completion,
                    $course,
                    $lesson,
                    $user,
                    is_array($validated['question_attempts'])
                        ? $validated['question_attempts']
                        : [],
                );
            }

            $progress = $this->updateProgress($course, $user, $lesson, $scoreSummary);
        });

        $lesson->unsetRelation('completions');
        $lesson->load([
            'completions' => fn ($query) => $query->where('user_id', $user->getKey()),
        ]);

        if ($progress !== null && $progress->status === 'completed') {
            $pushService->sendToUsers(
                [$user],
                'Completion confirmed',
                sprintf('You completed %s.', $course->title),
                [
                    'type' => 'completion_confirmation',
                    'url' => '/transcript',
                    'courseId' => (string) $course->id,
                ],
            );
        }

        return response()->json([
            'message' => 'Lesson completed.',
            'lesson' => $this->lessonPayload($lesson, $lesson->completions->first()),
            'progress' => $this->progressPayload($progress),
        ]);
    }

    private function assertContentContext(User $user): void
    {
        abort_unless(
            $user->isSuperAdmin() || $user->organization_id !== null,
            403,
            'This account is not attached to an organization.',
        );
    }

    /**
     * @param array{
     *     score_percent?: int|null,
     *     scored_questions_count?: int|null,
     *     correct_questions_count?: int|null,
     *     passed?: bool|null,
     *     question_attempts?: array<int, array<string, mixed>>
     * } $scoreSummary
     */
    private function updateProgress(
        Course $course,
        User $user,
        Lesson $lesson,
        array $scoreSummary = [],
    ): CourseProgress {
        $finalAssessmentId = $course->lessons()
            ->where('is_final_assessment', true)
            ->value('id');
        $scoreApplies = $finalAssessmentId === null
            || (int) $finalAssessmentId === $lesson->getKey();

        if (! $scoreApplies) {
            $scoreSummary = array_key_exists('question_attempts', $scoreSummary)
                ? ['question_attempts' => $scoreSummary['question_attempts']]
                : [];
        }

        $visibleLessonQuery = $course->lessons();

        if (! $user->isSuperAdmin() && ! $user->isOrganizationAdmin()) {
            $visibleLessonQuery->where('status', 'published');
        }

        $totalLessons = (int) $visibleLessonQuery->count();
        $completedLessonIds = LessonCompletion::query()
            ->where('user_id', $user->getKey())
            ->whereHas('lesson', function ($query) use ($course, $user): void {
                $query->where('course_id', $course->getKey());

                if (! $user->isSuperAdmin() && ! $user->isOrganizationAdmin()) {
                    $query->where('status', 'published');
                }
            })
            ->pluck('lesson_id');

        $completedCount = $completedLessonIds->count();
        $progressPercent = $totalLessons > 0
            ? (int) floor(($completedCount / $totalLessons) * 100)
            : 0;

        $status = $completedCount > 0 ? 'in_progress' : 'not_started';
        $completedAt = null;

        if ($totalLessons > 0 && $completedCount >= $totalLessons) {
            $status = 'completed';
            $completedAt = now();
            $progressPercent = 100;
        }

        $progress = CourseProgress::query()->updateOrCreate(
            [
                'course_id' => $course->getKey(),
                'user_id' => $user->getKey(),
            ],
            [
                'status' => $status,
                'completed_lessons_count' => $completedCount,
                'total_lessons_count' => $totalLessons,
                'progress_percent' => $progressPercent,
                'last_completed_lesson_id' => $lesson->getKey(),
                'completed_at' => $completedAt,
            ],
        );

        $scoreUpdates = [];

        if (array_key_exists('scored_questions_count', $scoreSummary)) {
            $scoreUpdates['scored_questions_count'] = $scoreSummary['scored_questions_count'] ?? 0;
        }

        if (array_key_exists('correct_questions_count', $scoreSummary)) {
            $scoreUpdates['correct_questions_count'] = $scoreSummary['correct_questions_count'] ?? 0;
        }

        if (array_key_exists('score_percent', $scoreSummary)) {
            $scoreUpdates['score_percent'] = $scoreSummary['score_percent'];
        } elseif (
            array_key_exists('scored_questions_count', $scoreSummary)
            && array_key_exists('correct_questions_count', $scoreSummary)
            && ($scoreSummary['scored_questions_count'] ?? 0) > 0
        ) {
            $scoreUpdates['score_percent'] = (int) round(
                (($scoreSummary['correct_questions_count'] ?? 0)
                    / max(1, (int) $scoreSummary['scored_questions_count'])) * 100,
            );
        }

        if (array_key_exists('passed', $scoreSummary)) {
            $scoreUpdates['passed'] = $scoreSummary['passed'];
        } elseif (
            array_key_exists('score_percent', $scoreUpdates)
            && $scoreUpdates['score_percent'] !== null
            && $course->passing_score !== null
        ) {
            $scoreUpdates['passed'] = $scoreUpdates['score_percent'] >= $course->passing_score;
        }

        if ($scoreUpdates !== []) {
            $progress->fill($scoreUpdates);
            $progress->save();
        }

        if (array_key_exists('question_attempts', $scoreSummary)) {
            $questionSummary = LessonQuestionAttempt::query()
                ->where('course_id', $course->getKey())
                ->where('user_id', $user->getKey())
                ->when(
                    $finalAssessmentId !== null,
                    fn ($query) => $query->where('lesson_id', $finalAssessmentId),
                )
                ->selectRaw('COUNT(*) as scored_questions_count')
                ->selectRaw('COALESCE(SUM(CASE WHEN was_correct = 1 THEN 1 ELSE 0 END), 0) as correct_questions_count')
                ->first();

            $scoredQuestionsCount = (int) ($questionSummary?->scored_questions_count ?? 0);
            $correctQuestionsCount = (int) ($questionSummary?->correct_questions_count ?? 0);
            $scorePercent = $scoredQuestionsCount > 0
                ? (int) round(($correctQuestionsCount / $scoredQuestionsCount) * 100)
                : null;

            $progress->fill([
                'scored_questions_count' => $scoredQuestionsCount,
                'correct_questions_count' => $correctQuestionsCount,
                'score_percent' => $scorePercent,
                'passed' => $scorePercent !== null && $course->passing_score !== null
                    ? $scorePercent >= $course->passing_score
                    : null,
            ]);
            $progress->save();
        }

        return $progress;
    }

    /**
     * @param array<int, array{
     *     question_key:string,
     *     question_type:string,
     *     question_prompt?:string|null,
     *     attempts_count?:int,
     *     missed_attempts_count?:int,
     *     correct_attempts_count?:int,
     *     was_correct?:bool
     * }> $questionAttempts
     */
    private function syncQuestionAttempts(
        LessonCompletion $completion,
        Course $course,
        Lesson $lesson,
        User $user,
        array $questionAttempts,
    ): void {
        LessonQuestionAttempt::query()
            ->where('lesson_completion_id', $completion->getKey())
            ->delete();

        if ($questionAttempts === []) {
            return;
        }

        $completedAt = $completion->completed_at ?? now();

        $rows = array_map(function (array $attempt) use ($completion, $course, $lesson, $user, $completedAt): array {
            $attemptsCount = max(1, (int) ($attempt['attempts_count'] ?? 1));
            $missedAttemptsCount = max(0, (int) ($attempt['missed_attempts_count'] ?? 0));
            $correctAttemptsCount = array_key_exists('correct_attempts_count', $attempt)
                ? max(0, (int) ($attempt['correct_attempts_count'] ?? 0))
                : max(0, $attemptsCount - $missedAttemptsCount);
            $wasCorrect = array_key_exists('was_correct', $attempt)
                ? (bool) $attempt['was_correct']
                : $correctAttemptsCount > 0;

            return [
                'lesson_completion_id' => $completion->getKey(),
                'organization_id' => $course->organization_id,
                'course_id' => $course->getKey(),
                'lesson_id' => $lesson->getKey(),
                'user_id' => $user->getKey(),
                'question_key' => $attempt['question_key'],
                'question_type' => $attempt['question_type'],
                'question_prompt' => $attempt['question_prompt'] ?? null,
                'attempts_count' => $attemptsCount,
                'missed_attempts_count' => $missedAttemptsCount,
                'correct_attempts_count' => $correctAttemptsCount,
                'was_correct' => $wasCorrect,
                'completed_at' => $completedAt,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }, $questionAttempts);

        LessonQuestionAttempt::query()->insert($rows);
    }
}
