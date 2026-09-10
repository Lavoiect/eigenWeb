<?php

namespace App\Http\Controllers\Api\V1\Concerns;

use App\Models\Course;
use App\Models\CourseAsset;
use App\Models\CourseAssignment;
use App\Models\CourseProgress;
use App\Models\Lesson;
use App\Models\LessonCompletion;
use App\Models\User;

trait FormatsLearningApiResponses
{
    protected function coursePayload(
        Course $course,
        ?CourseProgress $progress = null,
        array $assignmentSources = [],
        array $assetUsageCounts = [],
        array $assetUsageDetails = [],
    ): array {
        return [
            'id' => $course->id,
            'organization_id' => $course->organization_id,
            'pathway_id' => $course->pathway_id,
            'content_type' => $course->content_type ?? 'course',
            'pathway' => $course->relationLoaded('pathway') && $course->pathway !== null
                ? [
                    'id' => $course->pathway->id,
                    'name' => $course->pathway->name,
                    'description' => $course->pathway->description,
                ]
                : null,
            'title' => $course->title,
            'slug' => $course->slug,
            'subject' => $course->subject,
            'description' => $course->description,
            'learning_objectives' => array_values(array_filter(
                is_array($course->learning_objectives)
                    ? $course->learning_objectives
                    : [],
                fn ($objective): bool => filled($objective),
            )),
            'estimated_minutes' => $course->estimated_minutes,
            'passing_score' => $course->passing_score,
            'status' => $course->status,
            'status_label' => ucfirst($course->status),
            'published_at' => $course->published_at?->toIso8601String(),
            'archived_at' => $course->archived_at?->toIso8601String(),
            'assets' => $course->relationLoaded('assets')
                ? $course->assets->map(function (CourseAsset $asset) use ($assetUsageCounts, $assetUsageDetails): array {
                    $usageDetails = $assetUsageDetails[$asset->id] ?? [];

                    return [
                        'id' => $asset->id,
                        'course_id' => $asset->course_id,
                        'uploaded_by_id' => $asset->uploaded_by_id,
                        'kind' => $asset->kind,
                        'sort_order' => $asset->sort_order,
                        'disk' => $asset->disk,
                        'path' => $asset->path,
                        'url' => $asset->url,
                        'original_name' => $asset->original_name,
                        'mime_type' => $asset->mime_type,
                        'size_bytes' => $asset->size_bytes,
                        'usage_count' => $assetUsageCounts[$asset->id] ?? ($usageDetails['usage_count'] ?? 0),
                        'usage_lessons' => $usageDetails['usage_lessons'] ?? [],
                        'created_at' => $asset->created_at?->toIso8601String(),
                        'updated_at' => $asset->updated_at?->toIso8601String(),
                    ];
                })->values()
                : [],
            'lesson_count' => $course->getAttribute('lessons_count')
                ?? ($course->relationLoaded('lessons')
                    ? $course->lessons->count()
                    : $course->lessons()->count()),
            'assignment_sources' => array_values(array_unique($assignmentSources)),
            'progress' => $progress ? $this->progressPayload($progress) : null,
        ];
    }

    /**
     * @return array<int, int>
     */
    protected function courseAssetUsageCounts(Course $course): array
    {
        return collect($this->courseAssetUsageDetails($course))
            ->mapWithKeys(fn (array $details, int $assetId): array => [
                $assetId => $details['usage_count'] ?? 0,
            ])
            ->all();
    }

    protected function courseAssetUsageCount(Course $course, string $url): int
    {
        $course->loadMissing('lessons');
        $count = 0;

        foreach ($course->lessons as $lesson) {
            foreach ($lesson->blocks() as $block) {
                if (trim((string) ($block['url'] ?? '')) === $url) {
                    $count++;
                }
            }
        }

        return $count;
    }

    /**
     * @return array<int, array{usage_count:int,usage_lessons:array<int, array{lesson_id:int,lesson_title:string,block_count:int}>}>
     */
    protected function courseAssetUsageDetails(Course $course): array
    {
        $course->loadMissing(['assets', 'lessons']);

        $assetsByUrl = $course->assets->keyBy('url');
        $usage = [];

        foreach ($course->lessons as $lesson) {
            $lessonUsage = [];

            foreach ($lesson->blocks() as $block) {
                $url = trim((string) ($block['url'] ?? ''));

                if ($url === '') {
                    continue;
                }

                $asset = $assetsByUrl->get($url);

                if ($asset === null) {
                    continue;
                }

                $lessonUsage[$asset->id] = ($lessonUsage[$asset->id] ?? 0) + 1;
            }

            foreach ($lessonUsage as $assetId => $blockCount) {
                $usage[$assetId]['usage_count'] = ($usage[$assetId]['usage_count'] ?? 0) + $blockCount;
                $usage[$assetId]['usage_lessons'][$lesson->id] = [
                    'lesson_id' => $lesson->id,
                    'lesson_title' => $lesson->title,
                    'block_count' => $blockCount,
                ];
            }
        }

        return collect($usage)
            ->map(fn (array $details): array => [
                'usage_count' => $details['usage_count'] ?? 0,
                'usage_lessons' => array_values($details['usage_lessons'] ?? []),
            ])
            ->all();
    }

    protected function lessonPayload(
        Lesson $lesson,
        ?LessonCompletion $completion = null,
    ): array {
        return [
            'id' => $lesson->id,
            'course_id' => $lesson->course_id,
            'title' => $lesson->title,
            'slug' => $lesson->slug,
            'body' => $lesson->body,
            'position' => $lesson->position,
            'duration_minutes' => $lesson->duration_minutes,
            'is_final_assessment' => $lesson->is_final_assessment,
            'status' => $lesson->status,
            'status_label' => ucfirst($lesson->status),
            'published_at' => $lesson->published_at?->toIso8601String(),
            'content' => $lesson->blocks(),
            'is_completed' => $completion !== null,
            'completed_at' => $completion?->completed_at?->toIso8601String(),
        ];
    }

    protected function progressPayload(CourseProgress $progress): array
    {
        return [
            'id' => $progress->id,
            'course_id' => $progress->course_id,
            'status' => $progress->status,
            'status_label' => ucfirst(str_replace('_', ' ', $progress->status)),
            'completed_lessons_count' => $progress->completed_lessons_count,
            'total_lessons_count' => $progress->total_lessons_count,
            'progress_percent' => $progress->progress_percent,
            'score_percent' => $progress->score_percent,
            'scored_questions_count' => $progress->scored_questions_count,
            'correct_questions_count' => $progress->correct_questions_count,
            'passed' => $progress->passed,
            'last_completed_lesson_id' => $progress->last_completed_lesson_id,
            'completed_at' => $progress->completed_at?->toIso8601String(),
            'updated_at' => $progress->updated_at?->toIso8601String(),
        ];
    }

    protected function assignmentPayload(
        CourseAssignment $assignment,
        User $viewer,
        ?CourseProgress $progress = null,
    ): array {
        $sourceType = $assignment->sourceType();
        $dueAt = $assignment->due_at?->toImmutable();
        $status = match (true) {
            $progress?->completed_at !== null || $progress?->status === 'completed' => 'completed',
            $dueAt !== null && $dueAt->isPast() => 'overdue',
            $progress !== null => 'in_progress',
            default => 'not_started',
        };

        return [
            'id' => $assignment->id,
            'course' => $this->coursePayload(
                $assignment->course,
                $progress,
                [$sourceType],
            ),
            'source' => $sourceType,
            'source_label' => match ($sourceType) {
                'team' => 'Team',
                'job_title' => 'Job title',
                'location' => 'Location',
                'pathway' => 'Pathway',
                default => 'Direct',
            },
            'assigned_to' => $assignment->assigned_to_user_id !== null
                ? [
                    'type' => 'user',
                    'id' => $assignment->assigned_to_user_id,
                    'name' => $assignment->assignedToUser?->name,
                ]
                : [
                    'type' => $assignment->assigned_to_team_id !== null
                        ? 'team'
                        : ($assignment->assigned_to_job_title_id !== null
                            ? 'job_title'
                            : 'location'),
                    'id' => $assignment->assigned_to_team_id !== null
                        ? $assignment->assigned_to_team_id
                        : ($assignment->assigned_to_job_title_id !== null
                            ? $assignment->assigned_to_job_title_id
                            : $assignment->assigned_to_location_id),
                    'name' => $assignment->assigned_to_team_id !== null
                        ? $assignment->assignedToTeam?->name
                        : ($assignment->assigned_to_job_title_id !== null
                            ? $assignment->assignedToJobTitle?->name
                            : $assignment->assignedToLocation?->name),
                ],
            'due_at' => $assignment->due_at?->toIso8601String(),
            'is_required' => $assignment->is_required,
            'recurs_every_days' => $assignment->recurs_every_days,
            'reminder_count' => $assignment->reminder_count,
            'last_reminded_at' => $assignment->last_reminded_at?->toIso8601String(),
            'status' => $status,
            'status_label' => match ($status) {
                'completed' => 'Completed',
                'overdue' => 'Overdue',
                'in_progress' => 'In progress',
                default => 'Not started',
            },
            'assigned_by' => $assignment->assignedBy?->only('id', 'name', 'email'),
            'viewer_role' => $viewer->organization_role?->value,
        ];
    }

    protected function courseAssetPayload(
        CourseAsset $asset,
        int $usageCount = 0,
        array $usageLessons = [],
    ): array {
        return [
            'id' => $asset->id,
            'course_id' => $asset->course_id,
            'uploaded_by_id' => $asset->uploaded_by_id,
            'kind' => $asset->kind,
            'sort_order' => $asset->sort_order,
            'disk' => $asset->disk,
            'path' => $asset->path,
            'url' => $asset->url,
            'original_name' => $asset->original_name,
            'mime_type' => $asset->mime_type,
            'size_bytes' => $asset->size_bytes,
            'usage_count' => $usageCount,
            'usage_lessons' => $usageLessons,
            'created_at' => $asset->created_at?->toIso8601String(),
            'updated_at' => $asset->updated_at?->toIso8601String(),
        ];
    }
}
