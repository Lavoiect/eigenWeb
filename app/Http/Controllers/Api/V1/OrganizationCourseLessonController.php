<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\FormatsLearningApiResponses;
use App\Http\Controllers\Api\V1\Concerns\ResolvesOrganizationContentContext;
use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Lesson;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;

class OrganizationCourseLessonController extends Controller
{
    use FormatsLearningApiResponses;
    use ResolvesOrganizationContentContext;

    public function store(Request $request, Course $course): JsonResponse
    {
        $user = $request->user()->loadMissing('organization');
        $organization = $this->organizationOrFail($user);
        $this->assertCanAuthorTraining($user, $organization);
        $this->ensureCourseInOrganization($course, $organization);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255'],
            'body' => ['nullable', 'string'],
            'content' => ['nullable', 'array'],
            'position' => ['nullable', 'integer', 'min:0'],
            'duration_minutes' => ['nullable', 'integer', 'min:1'],
            'status' => ['nullable', 'in:draft,published'],
            'published_at' => ['nullable', 'date'],
        ]);

        $content = $validated['content'] ?? null;
        $body = is_array($content)
            ? (new Lesson)->bodyFromBlocks($content)
            : ($validated['body'] ?? null);

        $lesson = Lesson::create([
            'course_id' => $course->getKey(),
            'title' => $validated['title'],
            'slug' => $this->uniqueLessonSlug($course, $validated['slug'] ?? $validated['title']),
            'body' => $body,
            'content' => $content,
            'position' => $validated['position'] ?? $this->nextLessonPosition($course),
            'duration_minutes' => $validated['duration_minutes'] ?? null,
            'status' => $validated['status'] ?? 'draft',
            'published_at' => $this->resolvePublishedAt(
                $validated['status'] ?? 'draft',
                $validated['published_at'] ?? null,
            ),
        ]);

        return response()->json([
            'lesson' => $this->lessonPayload($lesson),
        ], 201);
    }

    public function update(Request $request, Course $course, Lesson $lesson): JsonResponse
    {
        $user = $request->user()->loadMissing('organization');
        $organization = $this->organizationOrFail($user);
        $this->assertCanAuthorTraining($user, $organization);
        $this->ensureCourseInOrganization($course, $organization);
        $this->ensureLessonInCourse($lesson, $course);

        $validated = $request->validate([
            'title' => ['sometimes', 'filled', 'string', 'max:255'],
            'slug' => ['sometimes', 'nullable', 'string', 'max:255'],
            'body' => ['sometimes', 'nullable', 'string'],
            'content' => ['sometimes', 'nullable', 'array'],
            'position' => ['sometimes', 'integer', 'min:0'],
            'duration_minutes' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'status' => ['sometimes', 'in:draft,published'],
            'published_at' => ['sometimes', 'nullable', 'date'],
        ]);

        if (array_key_exists('title', $validated)) {
            $lesson->title = $validated['title'];
        }

        if (array_key_exists('slug', $validated)) {
            $slugSource = $validated['slug'] ?? $lesson->title;
            $lesson->slug = $this->uniqueLessonSlug($course, $slugSource, $lesson);
        }

        if (array_key_exists('body', $validated)) {
            $lesson->body = $validated['body'];
        }

        if (array_key_exists('content', $validated)) {
            $lesson->content = $validated['content'];
            if (is_array($validated['content'])) {
                $lesson->body = $lesson->bodyFromBlocks($validated['content']);
            }
        }

        if (array_key_exists('position', $validated)) {
            $lesson->position = $validated['position'];
        }

        if (array_key_exists('duration_minutes', $validated)) {
            $lesson->duration_minutes = $validated['duration_minutes'];
        }

        if (array_key_exists('status', $validated)) {
            $lesson->status = $validated['status'];
        }

        $lesson->published_at = $this->resolvePublishedAt(
            $lesson->status,
            $validated['published_at'] ?? null,
            $lesson->published_at,
        );

        $lesson->save();

        return response()->json([
            'lesson' => $this->lessonPayload($lesson),
        ]);
    }

    public function destroy(Request $request, Course $course, Lesson $lesson): Response
    {
        $user = $request->user()->loadMissing('organization');
        $organization = $this->organizationOrFail($user);
        $this->assertCanAuthorTraining($user, $organization);
        $this->ensureCourseInOrganization($course, $organization);
        $this->ensureLessonInCourse($lesson, $course);

        $lesson->delete();

        return response()->noContent();
    }

    private function uniqueLessonSlug(
        Course $course,
        string $source,
        ?Lesson $ignoreLesson = null,
    ): string {
        $baseSlug = Str::slug($source) ?: 'lesson';
        $candidate = $baseSlug;
        $counter = 2;

        while (
            $course->lessons()
                ->when($ignoreLesson !== null, fn ($query) => $query->whereKeyNot($ignoreLesson->getKey()))
                ->where('slug', $candidate)
                ->exists()
        ) {
            $candidate = "{$baseSlug}-{$counter}";
            $counter++;
        }

        return $candidate;
    }

    private function nextLessonPosition(Course $course): int
    {
        return (int) $course->lessons()->max('position') + 1;
    }

    private function resolvePublishedAt(
        string $status,
        mixed $publishedAt = null,
        mixed $fallback = null,
    ): mixed {
        if ($status !== 'published') {
            return null;
        }

        if ($publishedAt !== null && $publishedAt !== '') {
            return $publishedAt;
        }

        return $fallback ?? now();
    }
}
