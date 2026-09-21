<?php

use App\Models\Course;
use App\Models\CourseAssignment;
use App\Models\CourseProgress;
use App\Models\JobTitle;
use App\Models\Lesson;
use App\Models\LessonCompletion;
use App\Models\Organization;
use App\Models\Pathway;
use App\Models\User;
use App\Services\PathwayAssignmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

test('organization admins can manage pathway structure and settings', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $pathway = Pathway::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'name' => 'Frontline Leader',
        'description' => 'Leadership training for supervisors.',
        'sequential_completion' => false,
        'expected_completion_days' => null,
    ]);
    $course = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'pathway_id' => null,
        'title' => 'Coaching Basics',
        'slug' => 'coaching-basics',
        'subject' => 'Leadership',
        'description' => 'Course description.',
        'learning_objectives' => ['Practice coaching'],
        'estimated_minutes' => 12,
        'passing_score' => 80,
        'status' => 'published',
        'published_at' => now(),
    ]);
    $lesson = Lesson::create([
        'course_id' => $course->id,
        'title' => 'Quick check-in',
        'slug' => 'quick-check-in',
        'body' => 'Do a fast one-on-one.',
        'content' => [
            [
                'id' => 'block_1',
                'type' => 'text',
                'text' => 'Do a fast one-on-one.',
            ],
        ],
        'position' => 1,
        'duration_minutes' => 5,
        'status' => 'published',
        'published_at' => now(),
    ]);

    $this->actingAs($admin)
        ->get(route('organizations.pathways.show', [$organization, $pathway]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('organizations/pathways/show')
            ->where('pathway.id', $pathway->id)
            ->has('courseOptions', 1)
            ->has('lessonOptions', 1)
        );

    $this->actingAs($admin)
        ->patch(route('organizations.pathways.update', [$organization, $pathway]), [
            'name' => 'Frontline Leader',
            'description' => 'Leadership training for supervisors.',
            'sequential_completion' => true,
            'expected_completion_days' => 45,
        ])
        ->assertRedirect();

    $this->actingAs($admin)
        ->post(route('organizations.pathways.items.store', [$organization, $pathway]), [
            'item_type' => 'course',
            'course_id' => $course->id,
            'description' => 'Start here.',
            'is_required' => true,
        ])
        ->assertRedirect();

    $this->actingAs($admin)
        ->post(route('organizations.pathways.items.store', [$organization, $pathway]), [
            'item_type' => 'microlearning',
            'lesson_id' => $lesson->id,
            'title' => 'Manager quick tip',
            'description' => 'Short practice loop.',
            'is_required' => false,
        ])
        ->assertRedirect();

    $this->actingAs($admin)
        ->post(route('organizations.pathways.milestones.store', [$organization, $pathway]), [
            'title' => 'First week',
            'description' => 'Cover the basics.',
        ])
        ->assertRedirect();

    $this->assertDatabaseHas('pathways', [
        'id' => $pathway->id,
        'sequential_completion' => 1,
        'expected_completion_days' => 45,
    ]);

    $this->assertDatabaseHas('pathway_items', [
        'pathway_id' => $pathway->id,
        'item_type' => 'course',
        'course_id' => $course->id,
        'title' => 'Coaching Basics',
    ]);

    $this->assertDatabaseHas('pathway_items', [
        'pathway_id' => $pathway->id,
        'item_type' => 'microlearning',
        'lesson_id' => $lesson->id,
        'title' => 'Manager quick tip',
    ]);

    $this->assertDatabaseHas('pathway_milestones', [
        'pathway_id' => $pathway->id,
        'title' => 'First week',
    ]);

    $this->actingAs($admin)
        ->get(route('organizations.courses.index', $organization).'?tab=pathways')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('organizations/courses/index')
            ->where('active_tab', 'pathways')
            ->where('pathways.0.id', $pathway->id)
            ->where('pathways.0.item_count', 2)
            ->where('pathways.0.milestone_count', 1)
            ->where('pathways.0.sequential_completion', true)
            ->where('pathways.0.expected_completion_days', 45)
        );
});

test('organization admins can assign job titles from the pathway page', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $pathway = Pathway::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'name' => 'Safety Pathway',
        'description' => null,
        'sequential_completion' => true,
        'expected_completion_days' => 30,
    ]);
    $otherPathway = Pathway::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'name' => 'Operations Pathway',
        'description' => null,
        'sequential_completion' => false,
        'expected_completion_days' => null,
    ]);
    $currentlyAssigned = JobTitle::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'name' => 'Warehouse Associate',
        'description' => null,
        'pathway_id' => $pathway->id,
    ]);
    $assignedElsewhere = JobTitle::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'name' => 'Shift Lead',
        'description' => null,
        'pathway_id' => $otherPathway->id,
    ]);
    $unassigned = JobTitle::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'name' => 'Forklift Operator',
        'description' => null,
        'pathway_id' => null,
    ]);
    $learner = User::factory()->learner($organization)->create([
        'job_title_id' => $assignedElsewhere->id,
    ]);
    $course = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'pathway_id' => $pathway->id,
        'title' => 'Safety Essentials',
        'slug' => 'safety-essentials',
        'subject' => 'Safety',
        'description' => 'Required safety training.',
        'learning_objectives' => ['Work safely'],
        'estimated_minutes' => 10,
        'passing_score' => 80,
        'status' => 'published',
        'published_at' => now(),
    ]);

    $this->actingAs($admin)
        ->get(route('organizations.pathways.show', [$organization, $pathway]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('jobTitles', 3)
            ->where('jobTitles.1.name', 'Shift Lead')
            ->where('jobTitles.1.pathway.id', $otherPathway->id)
        );

    $this->actingAs($admin)
        ->put(route('organizations.pathways.job-titles.sync', [$organization, $pathway]), [
            'job_title_ids' => [$assignedElsewhere->id, $unassigned->id],
        ])
        ->assertRedirect()
        ->assertSessionHas('status', 'Pathway job titles updated.');

    expect($currentlyAssigned->fresh()->pathway_id)->toBeNull()
        ->and($assignedElsewhere->fresh()->pathway_id)->toBe($pathway->id)
        ->and($unassigned->fresh()->pathway_id)->toBe($pathway->id);

    $this->assertDatabaseHas('course_assignments', [
        'course_id' => $course->id,
        'assigned_to_user_id' => $learner->id,
        'assigned_to_pathway_id' => $pathway->id,
    ]);

    $assignment = CourseAssignment::query()
        ->where('course_id', $course->id)
        ->where('assigned_to_user_id', $learner->id)
        ->where('assigned_to_pathway_id', $pathway->id)
        ->firstOrFail();
    $originalDueAt = $assignment->due_at?->toIso8601String();

    expect($assignment->due_at?->toDateString())
        ->toBe(now()->addDays(30)->toDateString());

    $this->travel(2)->days();
    app(PathwayAssignmentService::class)->syncCourse($course);

    expect($assignment->fresh()->due_at?->toIso8601String())
        ->toBe($originalDueAt);
});

test('job titles from another organization cannot be assigned to a pathway', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $pathway = Pathway::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'name' => 'Safety Pathway',
        'description' => null,
        'sequential_completion' => false,
        'expected_completion_days' => null,
    ]);
    $otherOrganization = Organization::factory()->create();
    $outsideJobTitle = JobTitle::create([
        'organization_id' => $otherOrganization->id,
        'created_by_id' => User::factory()->organizationAdmin($otherOrganization)->create()->id,
        'name' => 'Outside Role',
        'description' => null,
        'pathway_id' => null,
    ]);

    $this->actingAs($admin)
        ->from(route('organizations.pathways.show', [$organization, $pathway]))
        ->put(route('organizations.pathways.job-titles.sync', [$organization, $pathway]), [
            'job_title_ids' => [$outsideJobTitle->id],
        ])
        ->assertRedirect(route('organizations.pathways.show', [$organization, $pathway]))
        ->assertSessionHasErrors('job_title_ids.0');

    expect($outsideJobTitle->fresh()->pathway_id)->toBeNull();
});

test('employee profiles show individual pathway progress', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $pathway = Pathway::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'name' => 'Store Manager Pathway',
        'description' => 'Leadership training for store managers.',
        'sequential_completion' => true,
        'expected_completion_days' => 30,
    ]);
    $jobTitle = JobTitle::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'name' => 'Store Manager',
        'description' => null,
        'pathway_id' => $pathway->id,
    ]);
    $course = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'pathway_id' => $pathway->id,
        'title' => 'Coaching Conversations',
        'slug' => 'coaching-conversations',
        'subject' => 'Leadership',
        'description' => 'Course description.',
        'learning_objectives' => ['Coach a teammate'],
        'estimated_minutes' => 15,
        'passing_score' => 80,
        'status' => 'published',
        'published_at' => now(),
    ]);
    $lesson = Lesson::create([
        'course_id' => $course->id,
        'title' => 'Coaching tip',
        'slug' => 'coaching-tip',
        'body' => 'Use a quick coaching loop.',
        'content' => [
            [
                'id' => 'block_1',
                'type' => 'text',
                'text' => 'Use a quick coaching loop.',
            ],
        ],
        'position' => 1,
        'duration_minutes' => 5,
        'status' => 'published',
        'published_at' => now(),
    ]);
    $learner = User::factory()->learner($organization)->create([
        'job_title_id' => $jobTitle->id,
    ]);

    $pathway->items()->createMany([
        [
            'item_type' => 'course',
            'course_id' => $course->id,
            'lesson_id' => null,
            'title' => $course->title,
            'description' => $course->description,
            'sort_order' => 1,
            'is_required' => true,
        ],
        [
            'item_type' => 'microlearning',
            'course_id' => null,
            'lesson_id' => $lesson->id,
            'title' => $lesson->title,
            'description' => $lesson->body,
            'sort_order' => 2,
            'is_required' => true,
        ],
    ]);

    $pathway->milestones()->create([
        'title' => 'Week one',
        'description' => 'Complete onboarding.',
        'sort_order' => 1,
    ]);

    CourseProgress::create([
        'course_id' => $course->id,
        'user_id' => $learner->id,
        'status' => 'completed',
        'completed_lessons_count' => 1,
        'total_lessons_count' => 1,
        'progress_percent' => 100,
        'score_percent' => 90,
        'scored_questions_count' => 1,
        'correct_questions_count' => 1,
        'passed' => true,
        'last_completed_lesson_id' => null,
        'completed_at' => now(),
    ]);

    LessonCompletion::create([
        'lesson_id' => $lesson->id,
        'user_id' => $learner->id,
        'completed_at' => now(),
    ]);

    $this->actingAs($admin)
        ->get(route('organizations.users.show', [$organization, $learner]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('organizations/users/show')
            ->where('pathway_progress.pathway.id', $pathway->id)
            ->where('pathway_progress.completion_percent', 100)
            ->where('pathway_progress.current_item', null)
        );
});
