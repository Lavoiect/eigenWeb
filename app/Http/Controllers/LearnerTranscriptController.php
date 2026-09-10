<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Api\V1\Concerns\FormatsLearningApiResponses;
use App\Models\CourseProgress;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class LearnerTranscriptController extends Controller
{
    use FormatsLearningApiResponses;

    public function index(Request $request): Response
    {
        $user = $request->user()->loadMissing('organization');

        abort_unless($user->canViewOwnTraining(), 403);

        $records = CourseProgress::query()
            ->with([
                'course' => fn ($query) => $query->with([
                    'pathway',
                ])->withCount('lessons'),
                'lastCompletedLesson',
            ])
            ->where('user_id', $user->getKey())
            ->orderByDesc('updated_at')
            ->get();

        $summary = [
            'total_courses' => $records->count(),
            'completed_courses' => $records->where('status', 'completed')->count(),
            'passed_courses' => $records->where('passed', true)->count(),
            'average_score_percent' => $this->averageScore($records),
            'latest_completion_at' => $records->first()?->completed_at?->toIso8601String(),
        ];

        return Inertia::render('learning/transcript', [
            'summary' => $summary,
            'records' => $records->map(fn (CourseProgress $progress): array => [
                'id' => $progress->id,
                'course' => $this->coursePayload($progress->course, $progress),
                'progress' => $this->progressPayload($progress),
                'last_completed_lesson' => $progress->lastCompletedLesson?->only([
                    'id',
                    'title',
                    'slug',
                ]),
            ])->values(),
        ]);
    }

    private function averageScore(Collection $records): ?int
    {
        $scores = $records
            ->pluck('score_percent')
            ->filter(fn ($score) => $score !== null)
            ->values();

        if ($scores->isEmpty()) {
            return null;
        }

        return (int) round($scores->avg());
    }
}
