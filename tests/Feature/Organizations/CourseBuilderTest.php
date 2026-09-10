<?php

use App\Models\Course;
use App\Models\CourseAsset;
use App\Models\CourseAssignment;
use App\Models\Lesson;
use App\Models\LessonCompletion;
use App\Models\Organization;
use App\Models\Team;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

test('creating an assignment returns to the training page', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $learner = User::factory()->learner($organization)->create();
    $course = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'title' => 'Safety Basics',
        'slug' => 'safety-basics',
        'content_type' => 'course',
        'status' => 'published',
        'published_at' => now(),
    ]);

    $this->actingAs($admin)
        ->post(route('organizations.courses.assignments.store', [$organization, $course]), [
            'assigned_to_user_id' => $learner->id,
            'due_at' => now()->addWeek()->toDateString(),
            'is_required' => true,
            'recurs_every_days' => null,
        ])
        ->assertRedirect(route('organizations.courses.index', $organization));

    expect(CourseAssignment::query()
        ->where('course_id', $course->id)
        ->where('assigned_to_user_id', $learner->id)
        ->exists())->toBeTrue();
});

test('organization admins can open the course builder and save block-based lessons', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $team = Team::create([
        'organization_id' => $organization->id,
        'name' => 'Shift Leads',
        'description' => 'Frontline supervisors',
    ]);

    $course = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'content_type' => 'course',
        'title' => 'Forklift Safety',
        'slug' => 'forklift-safety',
        'subject' => 'Warehouse Safety',
        'description' => 'Draft training',
        'estimated_minutes' => 15,
        'passing_score' => 80,
        'status' => 'draft',
        'published_at' => null,
    ]);

    $lesson = Lesson::create([
        'course_id' => $course->id,
        'title' => 'PPE Basics',
        'slug' => 'ppe-basics',
        'body' => 'Wear the right gear.',
        'position' => 1,
        'status' => 'draft',
        'published_at' => null,
    ]);
    $secondLesson = Lesson::create([
        'course_id' => $course->id,
        'title' => 'Forklift Checks',
        'slug' => 'forklift-checks',
        'body' => 'Inspect before use.',
        'position' => 2,
        'status' => 'draft',
        'published_at' => null,
    ]);

    $this->actingAs($admin)
        ->get(route('organizations.courses.show', [
            $organization,
            $course,
            'lesson' => $lesson->id,
            'assignment_target_type' => 'team',
            'assignment_target_id' => $team->id,
            'assignment_due_at' => now()->addDays(7)->toDateString(),
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('organizations/courses/show')
            ->where('selected_lesson_id', $lesson->id)
            ->where('selected_assignment_target_type', 'team')
            ->where('selected_assignment_target_id', $team->id)
            ->where('selected_assignment_due_at', now()->addDays(7)->toDateString())
            ->where('course.content_type', 'course')
            ->where('course.subject', 'Warehouse Safety')
            ->has('lessons', 2));

    $this->actingAs($admin)
        ->patch(route('organizations.courses.lessons.reorder', [$organization, $course]), [
            'lesson_ids' => [$secondLesson->id, $lesson->id],
        ])
        ->assertRedirect();

    $lesson->refresh();
    $secondLesson->refresh();

    expect($secondLesson->position)->toBe(1);
    expect($lesson->position)->toBe(2);

    $this->actingAs($admin)
        ->patch(route('organizations.courses.update', [$organization, $course]), [
            'subject' => 'Frontline Safety',
            'estimated_minutes' => 20,
            'passing_score' => 85,
        ])
        ->assertRedirect();

    $course->refresh();

    expect($course->subject)->toBe('Frontline Safety');
    expect($course->estimated_minutes)->toBe(20);
    expect($course->passing_score)->toBe(85);

    $this->actingAs($admin)
        ->patch(route('organizations.courses.lessons.update', [$organization, $course, $lesson]), [
            'content' => [
                [
                    'id' => 'block_text',
                    'type' => 'text',
                    'text' => 'Wear the right PPE before starting.',
                    'rich_text' => '<h1>Required PPE</h1><p>Wear the <strong>right PPE</strong> before starting.</p>',
                ],
                [
                    'id' => 'block_callout',
                    'type' => 'callout',
                    'style' => 'warning',
                    'text' => 'Stop work if protective equipment is damaged.',
                ],
                [
                    'id' => 'block_mc',
                    'type' => 'multiple_choice',
                    'prompt' => 'Which item is required?',
                    'choices' => ['Hard hat', 'Sneakers'],
                    'correct_index' => 0,
                    'correct_feedback' => 'Correct.',
                    'incorrect_feedback' => 'Review the PPE checklist.',
                ],
            ],
            'duration_minutes' => 12,
        ])
        ->assertRedirect();

    $lesson->refresh();

    expect($lesson->content)->toHaveCount(3);
    expect($lesson->content[0]['rich_text'])->toContain('<strong>right PPE</strong>');
    expect($lesson->body)->toContain('Wear the right PPE before starting.');
    expect($lesson->body)->toContain('Stop work if protective equipment is damaged.');
    expect($lesson->body)->toContain('Which item is required?');

    Storage::fake('public');

    $assetOne = $this->actingAs($admin)
        ->post(route('organizations.courses.assets.store', [$organization, $course]), [
            'asset_kind' => 'document',
            'file' => UploadedFile::fake()->create('safety-guide.pdf', 128, 'application/pdf'),
        ])
        ->assertOk()
        ->assertJsonPath('kind', 'document')
        ->assertJsonPath('asset.original_name', 'safety-guide.pdf')
        ->json('asset');

    $assetTwo = $this->actingAs($admin)
        ->post(route('organizations.courses.assets.store', [$organization, $course]), [
            'asset_kind' => 'document',
            'file' => UploadedFile::fake()->create('safety-checklist.pdf', 128, 'application/pdf'),
        ])
        ->assertOk()
        ->assertJsonPath('kind', 'document')
        ->assertJsonPath('asset.original_name', 'safety-checklist.pdf')
        ->json('asset');

    $this->actingAs($admin)
        ->patch(route('organizations.courses.lessons.update', [$organization, $course, $lesson]), [
            'content' => [
                [
                    'id' => 'block_text',
                    'type' => 'text',
                    'text' => 'Wear the right PPE before starting.',
                ],
                [
                    'id' => 'block_doc',
                    'type' => 'document',
                    'url' => $assetOne['url'],
                    'title' => $assetOne['original_name'],
                ],
            ],
            'duration_minutes' => 12,
        ])
        ->assertRedirect();

    $secondLesson->refresh();

    $this->actingAs($admin)
        ->patch(route('organizations.courses.lessons.update', [$organization, $course, $secondLesson]), [
            'content' => [
                [
                    'id' => 'block_doc_2',
                    'type' => 'document',
                    'url' => $assetOne['url'],
                    'title' => $assetOne['original_name'],
                ],
            ],
            'duration_minutes' => 8,
        ])
        ->assertRedirect();

    $this->actingAs($admin)
        ->patch(route('organizations.courses.assets.reorder', [$organization, $course]), [
            'kind' => 'document',
            'asset_ids' => [$assetTwo['id'], $assetOne['id']],
        ])
        ->assertRedirect();

    expect(CourseAsset::query()->findOrFail($assetTwo['id'])->sort_order)->toBe(1);
    expect(CourseAsset::query()->findOrFail($assetOne['id'])->sort_order)->toBe(2);

    $this->actingAs($admin)
        ->get(route('organizations.courses.show', [
            $organization,
            $course,
            'lesson' => $lesson->id,
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('organizations/courses/show')
            ->has('course.assets', 2)
            ->where('course.assets.0.original_name', 'safety-checklist.pdf')
            ->where('course.assets.1.original_name', 'safety-guide.pdf')
            ->where('course.assets.1.usage_count', 2)
            ->has('course.assets.1.usage_lessons', 2)
            ->where('course.assets.1.usage_lessons.0.lesson_title', 'Forklift Checks'));

    Storage::disk('public')->assertExists($assetOne['path']);
    Storage::disk('public')->assertExists($assetTwo['path']);

    $replacedAsset = $this->actingAs($admin)
        ->patch(route('organizations.courses.assets.update', [$organization, $course, $assetOne['id']]), [
            'file' => UploadedFile::fake()->create('safety-guide-updated.pdf', 256, 'application/pdf'),
        ])
        ->assertOk()
        ->assertJsonPath('asset.original_name', 'safety-guide-updated.pdf')
        ->json('asset');

    expect($replacedAsset['url'])->toBe($assetOne['url']);
    expect($replacedAsset['path'])->toBe($assetOne['path']);
    Storage::disk('public')->assertExists($replacedAsset['path']);

    $this->actingAs($admin)
        ->delete(route('organizations.courses.assets.destroy', [$organization, $course, $assetTwo['id']]))
        ->assertOk()
        ->assertJsonPath('deleted', true);

    $this->actingAs($admin)
        ->delete(route('organizations.courses.assets.destroy', [$organization, $course, $assetOne['id']]))
        ->assertOk()
        ->assertJsonPath('deleted', true);

    Storage::disk('public')->assertMissing($assetOne['path']);
    Storage::disk('public')->assertMissing($assetTwo['path']);
    $this->assertDatabaseMissing('course_assets', [
        'id' => $assetOne['id'],
    ]);
    $this->assertDatabaseMissing('course_assets', [
        'id' => $assetTwo['id'],
    ]);

    $this->actingAs($admin)
        ->get(route('organizations.courses.show', [
            $organization,
            $course,
            'lesson' => $lesson->id,
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('organizations/courses/show')
            ->has('course.assets', 0));
});

test('organization admins can duplicate a lesson beneath the source lesson', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $course = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'title' => 'Safety Basics',
        'slug' => 'safety-basics',
        'content_type' => 'course',
        'status' => 'draft',
    ]);
    $lesson = $course->lessons()->create([
        'title' => 'PPE Basics',
        'slug' => 'ppe-basics',
        'position' => 1,
        'duration_minutes' => 5,
        'status' => 'draft',
        'content' => [[
            'id' => 'ppe-copy-block',
            'type' => 'text',
            'text' => 'Inspect PPE before use.',
        ]],
    ]);

    $this->actingAs($admin)
        ->post(route('organizations.courses.lessons.duplicate', [
            $organization,
            $course,
            $lesson,
        ]))
        ->assertRedirect();

    $duplicate = $course->lessons()
        ->where('title', 'PPE Basics Copy')
        ->firstOrFail();

    expect($duplicate->position)->toBe(2)
        ->and($duplicate->status)->toBe('draft')
        ->and($duplicate->content)->toBe($lesson->content);
});

test('new lessons insert beneath the selected lesson', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $course = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'title' => 'Equipment Safety',
        'slug' => 'equipment-safety',
        'content_type' => 'course',
        'status' => 'draft',
    ]);
    $firstLesson = $course->lessons()->create([
        'title' => 'First lesson',
        'slug' => 'first-lesson',
        'position' => 1,
        'status' => 'draft',
    ]);
    $lastLesson = $course->lessons()->create([
        'title' => 'Last lesson',
        'slug' => 'last-lesson',
        'position' => 2,
        'status' => 'draft',
    ]);

    $this->actingAs($admin)
        ->post(route('organizations.courses.lessons.store', [
            $organization,
            $course,
        ]), [
            'title' => 'Inserted lesson',
            'position' => $firstLesson->position + 1,
            'status' => 'draft',
        ])
        ->assertRedirect();

    expect($course->lessons()->orderBy('position')->pluck('title')->all())
        ->toBe(['First lesson', 'Inserted lesson', 'Last lesson'])
        ->and($lastLesson->fresh()->position)->toBe(3);
});

test('full courses can add one final assessment that remains last', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $course = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'title' => 'Equipment Safety',
        'slug' => 'equipment-safety-assessment',
        'content_type' => 'course',
        'status' => 'draft',
    ]);
    $lesson = $course->lessons()->create([
        'title' => 'Safety fundamentals',
        'slug' => 'safety-fundamentals',
        'position' => 1,
        'status' => 'draft',
    ]);

    $this->actingAs($admin)
        ->post(route('organizations.courses.lessons.store', [$organization, $course]), [
            'title' => 'Final assessment',
            'position' => 2,
            'is_final_assessment' => true,
            'status' => 'draft',
        ])
        ->assertRedirect();

    $assessment = $course->lessons()->where('is_final_assessment', true)->firstOrFail();

    expect($assessment->position)->toBe(2)
        ->and($assessment->is_final_assessment)->toBeTrue();

    $this->actingAs($admin)
        ->post(route('organizations.courses.lessons.store', [$organization, $course]), [
            'title' => 'Additional practice',
            'position' => 3,
            'status' => 'draft',
        ])
        ->assertRedirect();

    expect($course->lessons()->orderBy('position')->pluck('title')->all())
        ->toBe(['Safety fundamentals', 'Additional practice', 'Final assessment'])
        ->and($assessment->fresh()->position)->toBe(3);

    $this->actingAs($admin)
        ->from(route('organizations.courses.show', [$organization, $course]))
        ->post(route('organizations.courses.lessons.store', [$organization, $course]), [
            'title' => 'Another final assessment',
            'is_final_assessment' => true,
            'status' => 'draft',
        ])
        ->assertSessionHasErrors('is_final_assessment');

    $this->actingAs($admin)
        ->from(route('organizations.courses.show', [$organization, $course]))
        ->patch(route('organizations.courses.lessons.reorder', [$organization, $course]), [
            'lesson_ids' => [$assessment->id, $lesson->id, $course->lessons()->where('title', 'Additional practice')->value('id')],
        ])
        ->assertSessionHasErrors('lesson_ids');

    $this->actingAs($admin)
        ->from(route('organizations.courses.show', [$organization, $course]))
        ->patch(route('organizations.courses.update', [$organization, $course]), [
            'status' => 'published',
            'published_lesson_ids' => [$lesson->id, $assessment->id],
        ])
        ->assertSessionHasErrors('published_lesson_ids');

    $assessment->update([
        'content' => [[
            'id' => 'final-question',
            'type' => 'multiple_choice',
            'prompt' => 'Which step comes first?',
            'options' => ['Inspect the equipment', 'Start immediately'],
            'correct_index' => 0,
        ]],
    ]);

    $this->actingAs($admin)
        ->from(route('organizations.courses.show', [$organization, $course]))
        ->patch(route('organizations.courses.update', [$organization, $course]), [
            'status' => 'published',
            'published_lesson_ids' => [$lesson->id],
        ])
        ->assertSessionHasErrors('published_lesson_ids');

    $this->actingAs($admin)
        ->patch(route('organizations.courses.update', [$organization, $course]), [
            'status' => 'published',
            'published_lesson_ids' => [$lesson->id, $assessment->id],
        ])
        ->assertRedirect();

    expect($assessment->fresh()->status)->toBe('published')
        ->and($course->fresh()->status)->toBe('published');
});

test('deleting a lesson preserves its learner completion records', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $learner = User::factory()->learner($organization)->create();
    $course = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'title' => 'Safety History',
        'slug' => 'safety-history',
        'content_type' => 'course',
        'status' => 'published',
        'published_at' => now(),
    ]);
    $lesson = $course->lessons()->create([
        'title' => 'Completed lesson',
        'slug' => 'completed-lesson',
        'position' => 1,
        'status' => 'published',
        'published_at' => now(),
    ]);
    $completion = LessonCompletion::create([
        'lesson_id' => $lesson->id,
        'user_id' => $learner->id,
        'completed_at' => now(),
    ]);

    $this->actingAs($admin)
        ->delete(route('organizations.courses.lessons.destroy', [
            $organization,
            $course,
            $lesson,
        ]))
        ->assertRedirect();

    $this->assertSoftDeleted($lesson);
    $this->assertDatabaseHas('lesson_completions', [
        'id' => $completion->id,
        'lesson_id' => $lesson->id,
        'user_id' => $learner->id,
    ]);
});

test('publishing a course only publishes the selected lessons', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $course = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'title' => 'Selective Publishing',
        'slug' => 'selective-publishing',
        'description' => 'Publish lessons as they become ready.',
        'content_type' => 'course',
        'status' => 'draft',
    ]);
    $readyLesson = $course->lessons()->create([
        'title' => 'Ready lesson',
        'slug' => 'ready-lesson',
        'position' => 1,
        'status' => 'draft',
        'content' => [['id' => 'ready-copy', 'type' => 'text', 'text' => 'Ready']],
    ]);
    $laterLesson = $course->lessons()->create([
        'title' => 'Later lesson',
        'slug' => 'later-lesson',
        'position' => 2,
        'status' => 'draft',
        'content' => [['id' => 'later-copy', 'type' => 'text', 'text' => 'Later']],
    ]);

    $this->actingAs($admin)
        ->patch(route('organizations.courses.update', [$organization, $course]), [
            'status' => 'published',
            'published_lesson_ids' => [$readyLesson->id],
        ])
        ->assertRedirect();

    expect($course->fresh()->status)->toBe('published')
        ->and($course->fresh()->published_at)->not->toBeNull()
        ->and($readyLesson->fresh()->status)->toBe('published')
        ->and($readyLesson->fresh()->published_at)->not->toBeNull()
        ->and($laterLesson->fresh()->status)->toBe('draft')
        ->and($laterLesson->fresh()->published_at)->toBeNull();

    $this->actingAs($admin)
        ->patch(route('organizations.courses.update', [$organization, $course]), [
            'status' => 'published',
            'published_lesson_ids' => [$laterLesson->id],
        ])
        ->assertRedirect();

    expect($readyLesson->fresh()->status)->toBe('draft')
        ->and($readyLesson->fresh()->published_at)->toBeNull()
        ->and($laterLesson->fresh()->status)->toBe('published')
        ->and($laterLesson->fresh()->published_at)->not->toBeNull();
});
