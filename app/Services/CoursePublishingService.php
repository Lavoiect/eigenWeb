<?php

namespace App\Services;

use App\Models\Course;

class CoursePublishingService
{
    /**
     * @param  array<int, int>  $publishedLessonIds
     */
    public function syncLessons(Course $course, array $publishedLessonIds): void
    {
        $publishedLessonIds = collect($publishedLessonIds)
            ->map(fn (int|string $lessonId): int => (int) $lessonId)
            ->unique()
            ->values()
            ->all();

        $course->lessons()
            ->whereNotIn('id', $publishedLessonIds)
            ->update([
                'status' => 'draft',
                'published_at' => null,
            ]);

        if ($publishedLessonIds === []) {
            return;
        }

        $course->lessons()
            ->whereIn('id', $publishedLessonIds)
            ->whereNull('published_at')
            ->update(['published_at' => now()]);

        $course->lessons()
            ->whereIn('id', $publishedLessonIds)
            ->update(['status' => 'published']);
    }
}
