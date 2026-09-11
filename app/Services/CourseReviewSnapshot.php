<?php

namespace App\Services;

use App\Models\Course;

class CourseReviewSnapshot
{
    /**
     * @return array<string, mixed>
     */
    public function make(Course $course): array
    {
        $course->loadMissing([
            'assets',
            'lessons' => fn ($query) => $query->orderBy('position'),
        ]);

        return [
            'course' => [
                'id' => $course->id,
                'title' => $course->title,
                'slug' => $course->slug,
                'content_type' => $course->content_type,
                'subject' => $course->subject,
                'description' => $course->description,
                'learning_objectives' => array_values($course->learning_objectives ?? []),
                'estimated_minutes' => $course->estimated_minutes,
                'passing_score' => $course->passing_score,
                'pathway_id' => $course->pathway_id,
            ],
            'lessons' => $course->lessons->map(fn ($lesson): array => [
                'id' => $lesson->id,
                'title' => $lesson->title,
                'slug' => $lesson->slug,
                'body' => $lesson->body,
                'position' => $lesson->position,
                'duration_minutes' => $lesson->duration_minutes,
                'is_final_assessment' => $lesson->is_final_assessment,
                'content' => $lesson->blocks(),
            ])->values()->all(),
            'assets' => $course->assets->map(fn ($asset): array => [
                'id' => $asset->id,
                'kind' => $asset->kind,
                'url' => $asset->url,
                'original_name' => $asset->original_name,
                'mime_type' => $asset->mime_type,
                'size_bytes' => $asset->size_bytes,
                'updated_at' => $asset->updated_at?->toIso8601String(),
            ])->values()->all(),
        ];
    }

    /**
     * @param  array<string, mixed>  $snapshot
     */
    public function hash(array $snapshot): string
    {
        return hash('sha256', json_encode(
            $snapshot,
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE,
        ));
    }

    public function hashCourse(Course $course): string
    {
        return $this->hash($this->make($course));
    }
}
