<?php

use App\Models\Course;
use App\Models\CourseAssignment;
use App\Models\CourseProgress;
use App\Models\Lesson;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

test('organization admins can manage courses and lessons from the web dashboard', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();

    $this->actingAs($admin)
        ->get(route('organizations.courses.index', $organization))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('organizations/courses/index'));

    $this->actingAs($admin)
        ->post(route('organizations.courses.store', $organization), [
            'title' => 'New Course',
            'slug' => 'new-course',
            'content_type' => 'microlearning',
            'description' => 'Draft course',
            'learning_objectives' => "Identify hazards\nUse PPE",
            'status' => 'draft',
        ])
        ->assertRedirect();

    $course = Course::query()->where('slug', 'new-course')->firstOrFail();

    expect($course->content_type)->toBe('microlearning');
    expect($course->learning_objectives)->toBe(['Identify hazards', 'Use PPE']);

    $this->actingAs($admin)
        ->patch(route('organizations.courses.update', [$organization, $course]), [
            'title' => 'Published Course',
            'content_type' => 'course',
            'learning_objectives' => "Identify hazards\nUse PPE\nReport issues",
            'status' => 'published',
        ])
        ->assertRedirect();

    $course->refresh();

    expect($course->title)->toBe('Published Course');
    expect($course->status)->toBe('published');
    expect($course->content_type)->toBe('course');
    expect($course->learning_objectives)->toBe([
        'Identify hazards',
        'Use PPE',
        'Report issues',
    ]);

    $this->actingAs($admin)
        ->post(route('organizations.courses.duplicate', [$organization, $course]))
        ->assertRedirect();

    $duplicate = Course::query()
        ->where('organization_id', $organization->id)
        ->where('slug', 'published-course-copy')
        ->firstOrFail();

    expect($duplicate->title)->toBe('Published Course Copy');
    expect($duplicate->status)->toBe('draft');
    expect($duplicate->content_type)->toBe('course');
    expect($duplicate->learning_objectives)->toBe([
        'Identify hazards',
        'Use PPE',
        'Report issues',
    ]);

    $this->actingAs($admin)
        ->patch(route('organizations.courses.archive', [$organization, $duplicate]))
        ->assertRedirect();

    $duplicate->refresh();

    expect($duplicate->status)->toBe('archived');
    expect($duplicate->archived_at)->not->toBeNull();

    $this->actingAs($admin)
        ->post(route('organizations.courses.lessons.store', [$organization, $course]), [
            'title' => 'Intro Lesson',
            'slug' => 'intro-lesson',
            'body' => 'Welcome',
            'position' => 1,
            'status' => 'draft',
        ])
        ->assertRedirect();

    $lesson = Lesson::query()->where('slug', 'intro-lesson')->firstOrFail();

    $this->actingAs($admin)
        ->patch(route('organizations.courses.lessons.update', [$organization, $course, $lesson]), [
            'status' => 'published',
        ])
        ->assertRedirect();

    $lesson->refresh();

    expect($lesson->status)->toBe('published');

    $this->actingAs($admin)
        ->delete(route('organizations.courses.lessons.destroy', [$organization, $course, $lesson]))
        ->assertRedirect();

    $this->assertSoftDeleted($lesson);

    $this->actingAs($admin)
        ->delete(route('organizations.courses.destroy', [$organization, $course]))
        ->assertSessionHasErrors('course');

    $this->assertDatabaseHas('courses', [
        'id' => $course->id,
    ]);

    $disposableDraft = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'title' => 'Disposable Draft',
        'slug' => 'disposable-draft',
        'content_type' => 'course',
        'status' => 'draft',
    ]);

    $this->actingAs($admin)
        ->delete(route('organizations.courses.destroy', [$organization, $disposableDraft]))
        ->assertRedirect(route('organizations.courses.index', $organization));

    $this->assertDatabaseMissing('courses', [
        'id' => $disposableDraft->id,
    ]);
});

test('course library includes learner outcomes readiness and deletion safety', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $learner = User::factory()->learner($organization)->create();
    $course = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'title' => 'Field Safety',
        'slug' => 'field-safety',
        'content_type' => 'course',
        'subject' => 'Safety',
        'description' => 'Core safety practices.',
        'estimated_minutes' => 12,
        'passing_score' => 80,
        'status' => 'published',
        'published_at' => now(),
    ]);

    $course->lessons()->create([
        'title' => 'Hazard check',
        'slug' => 'hazard-check',
        'position' => 1,
        'status' => 'published',
        'published_at' => now(),
        'content' => [[
            'id' => 'hazard-question',
            'type' => 'multiple_choice',
            'prompt' => 'What should you do first?',
            'options' => ['Stop work', 'Continue'],
            'correct_index' => 0,
        ]],
    ]);
    CourseAssignment::create([
        'course_id' => $course->id,
        'assigned_by_id' => $admin->id,
        'assigned_to_user_id' => $learner->id,
        'is_required' => true,
    ]);
    CourseProgress::create([
        'course_id' => $course->id,
        'user_id' => $learner->id,
        'status' => 'completed',
        'completed_lessons_count' => 1,
        'total_lessons_count' => 1,
        'progress_percent' => 100,
        'completed_at' => now(),
    ]);

    $this->actingAs($admin)
        ->get(route('organizations.courses.index', $organization))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('organizations/courses/index')
            ->where('courses.0.assigned_count', 1)
            ->where('courses.0.completed_count', 1)
            ->where('courses.0.completion_rate', 100)
            ->where('courses.0.assessment_count', 1)
            ->where('courses.0.health.tone', 'ready')
            ->where('courses.0.can_delete', false)
        );
});

test('microlearning courses seed a starter lesson and stay single lesson', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();

    $this->actingAs($admin)
        ->post(route('organizations.courses.store', $organization), [
            'title' => 'Quick Safety Tip',
            'content_type' => 'microlearning',
            'status' => 'draft',
        ])
        ->assertRedirect();

    $course = Course::query()->where('title', 'Quick Safety Tip')->firstOrFail();

    expect($course->content_type)->toBe('microlearning');
    expect($course->lessons()->count())->toBe(1);
    expect($course->lessons()->first()->title)->toBe('Quick policy refresher');
    expect($course->lessons()->first()->content)->toHaveCount(2);
    expect($course->lessons()->first()->content[1]['type'])->toBe('multiple_choice');

    $this->actingAs($admin)
        ->post(route('organizations.courses.lessons.store', [$organization, $course]), [
            'title' => 'Another lesson',
            'status' => 'draft',
        ])
        ->assertSessionHasErrors('title');

    $this->actingAs($admin)
        ->delete(route('organizations.courses.lessons.destroy', [
            $organization,
            $course,
            $course->lessons()->first(),
        ]))
        ->assertSessionHasErrors('lesson');
});

test('microlearning starter templates seed the selected preset', function (
    string $templateKey,
    string $expectedTitle,
    string $expectedBlockType,
) {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();

    $this->actingAs($admin)
        ->post(route('organizations.courses.store', $organization), [
            'title' => $expectedTitle,
            'content_type' => 'microlearning',
            'starter_template' => $templateKey,
            'status' => 'draft',
        ])
        ->assertRedirect();

    $course = Course::query()->where('title', $expectedTitle)->firstOrFail();
    $lesson = $course->lessons()->firstOrFail();

    expect($course->content_type)->toBe('microlearning');
    expect($lesson->title)->toBe($expectedTitle);
    expect($lesson->content)->toHaveCount(2);
    expect($lesson->content[1]['type'])->toBe($expectedBlockType);
})->with([
    ['quick_policy_refresher', 'Quick policy refresher', 'multiple_choice'],
    ['sop_reminder', 'SOP reminder', 'ordering'],
    ['new_hire_onboarding_nugget', 'New hire onboarding nugget', 'true_false'],
]);

test('organization admins can replace the starter template from the builder', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();

    $this->actingAs($admin)
        ->post(route('organizations.courses.store', $organization), [
            'title' => 'Starter Swap',
            'content_type' => 'microlearning',
            'starter_template' => 'quick_policy_refresher',
            'status' => 'draft',
        ])
        ->assertRedirect();

    $course = Course::query()->where('title', 'Starter Swap')->firstOrFail();
    $lesson = $course->lessons()->firstOrFail();

    expect($lesson->title)->toBe('Quick policy refresher');
    expect($lesson->content[1]['type'])->toBe('multiple_choice');

    $this->actingAs($admin)
        ->patch(route('organizations.courses.starter-template.update', [
            $organization,
            $course,
        ]), [
            'starter_template' => 'sop_reminder',
        ])
        ->assertRedirect();

    $lesson->refresh();

    expect($lesson->title)->toBe('SOP reminder');
    expect($lesson->duration_minutes)->toBe(7);
    expect($lesson->content[1]['type'])->toBe('ordering');
    expect($course->lessons()->count())->toBe(1);
});
