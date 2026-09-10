<?php

use App\Models\Course;
use App\Models\CourseProgress;
use App\Models\Lesson;
use App\Models\LessonCompletion;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

test('learners can view their transcript with saved scores', function () {
    $organization = Organization::factory()->create();
    $learner = User::factory()->learner($organization)->create();

    $course = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $learner->id,
        'title' => 'Safety basics',
        'slug' => 'safety-basics',
        'description' => 'Intro course',
        'passing_score' => 80,
        'status' => 'published',
        'published_at' => now(),
    ]);

    $lesson = Lesson::create([
        'course_id' => $course->id,
        'title' => 'Lesson 1',
        'slug' => 'lesson-1',
        'body' => 'Body',
        'position' => 1,
        'status' => 'published',
        'published_at' => now(),
    ]);

    LessonCompletion::create([
        'lesson_id' => $lesson->id,
        'user_id' => $learner->id,
        'completed_at' => now(),
    ]);

    CourseProgress::create([
        'course_id' => $course->id,
        'user_id' => $learner->id,
        'status' => 'completed',
        'completed_lessons_count' => 1,
        'total_lessons_count' => 1,
        'progress_percent' => 100,
        'score_percent' => 80,
        'scored_questions_count' => 5,
        'correct_questions_count' => 4,
        'passed' => true,
        'last_completed_lesson_id' => $lesson->id,
        'completed_at' => now(),
    ]);

    $this->actingAs($learner)
        ->get(route('learning.transcript'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('learning/transcript')
            ->where('summary.total_courses', 1)
            ->where('summary.completed_courses', 1)
            ->where('summary.passed_courses', 1)
            ->where('summary.average_score_percent', 80)
            ->has('records', 1)
            ->where('records.0.course.title', 'Safety basics')
            ->where('records.0.progress.score_percent', 80)
            ->where('records.0.progress.passed', true)
            ->where('records.0.last_completed_lesson.title', 'Lesson 1'),
        );
});
