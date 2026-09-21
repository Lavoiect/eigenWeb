<?php

use App\Models\CourseAssignment;
use App\Models\JobTitle;
use App\Models\Organization;
use App\Models\Pathway;
use App\Models\Team;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

test('organization admins can author training content', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $manager = User::factory()->manager($organization)->create();
    $learner = User::factory()->learner($organization)->create();
    $team = Team::factory()->create([
        'organization_id' => $organization->id,
    ]);

    $manager->managedTeams()->attach($team, [
        'assigned_by_id' => $admin->id,
    ]);
    $learner->teams()->attach($team, [
        'created_by_id' => $admin->id,
    ]);

    Sanctum::actingAs($admin, ['mobile-api']);

    $course = $this->postJson('/api/v1/organization/courses', [
        'title' => 'New Course',
        'description' => 'Draft course',
        'completion_window_days' => 10,
    ])
        ->assertCreated()
        ->assertJsonPath('course.title', 'New Course')
        ->assertJsonPath('course.completion_window_days', 10)
        ->assertJsonPath('course.status', 'draft')
        ->json('course');

    $this->patchJson("/api/v1/organization/courses/{$course['id']}", [
        'title' => 'Published Course',
        'status' => 'published',
    ])
        ->assertOk()
        ->assertJsonPath('course.title', 'Published Course')
        ->assertJsonPath('course.status', 'published');

    $lesson = $this->postJson("/api/v1/organization/courses/{$course['id']}/lessons", [
        'title' => 'Intro Lesson',
        'body' => 'Welcome',
        'position' => 1,
    ])
        ->assertCreated()
        ->assertJsonPath('lesson.title', 'Intro Lesson')
        ->assertJsonPath('lesson.status', 'draft')
        ->json('lesson');

    $this->patchJson("/api/v1/organization/courses/{$course['id']}/lessons/{$lesson['id']}", [
        'body' => 'Welcome to the course.',
    ])
        ->assertOk()
        ->assertJsonPath('lesson.body', 'Welcome to the course.');

    $this->patchJson("/api/v1/organization/courses/{$course['id']}", [
        'status' => 'published',
        'published_lesson_ids' => [$lesson['id']],
    ])
        ->assertOk()
        ->assertJsonPath('course.status', 'published');

    $this->assertDatabaseHas('lessons', [
        'id' => $lesson['id'],
        'status' => 'published',
    ]);

    $assignment = $this->postJson("/api/v1/organization/courses/{$course['id']}/assignments", [
        'assigned_to_user_id' => $learner->id,
        'due_at' => now()->addWeek()->toIso8601String(),
    ])
        ->assertCreated()
        ->assertJsonPath('assignment.assigned_to.type', 'user')
        ->assertJsonPath('assignment.assigned_to.id', $learner->id)
        ->json('assignment');

    $this->getJson("/api/v1/organization/courses/{$course['id']}")
        ->assertOk()
        ->assertJsonPath('course.id', $course['id'])
        ->assertJsonPath('course.assignment_count', 1)
        ->assertJsonCount(1, 'course.lessons')
        ->assertJsonCount(1, 'course.assignments');

    $this->deleteJson("/api/v1/organization/courses/{$course['id']}/assignments/{$assignment['id']}")
        ->assertNoContent();

    $this->assertDatabaseMissing('course_assignments', [
        'id' => $assignment['id'],
    ]);
});

test('managers cannot access org admin authoring endpoints', function () {
    $organization = Organization::factory()->create();
    $manager = User::factory()->manager($organization)->create();

    Sanctum::actingAs($manager, ['mobile-api']);

    $this->postJson('/api/v1/organization/courses', [
        'title' => 'Blocked Course',
    ])
        ->assertForbidden();
});

test('archiving a course through the API removes its assignments', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $learner = User::factory()->learner($organization)->create();

    Sanctum::actingAs($admin, ['mobile-api']);

    $course = $this->postJson('/api/v1/organization/courses', [
        'title' => 'Temporary Training',
        'status' => 'published',
    ])
        ->assertCreated()
        ->json('course');

    $this->postJson("/api/v1/organization/courses/{$course['id']}/assignments", [
        'assigned_to_user_id' => $learner->id,
    ])->assertCreated();

    $this->patchJson("/api/v1/organization/courses/{$course['id']}", [
        'status' => 'archived',
    ])
        ->assertOk()
        ->assertJsonPath('course.status', 'archived')
        ->assertJsonPath('course.assignment_count', 0);

    expect(CourseAssignment::query()
        ->where('course_id', $course['id'])
        ->exists())->toBeFalse();
});

test('job title assignments are visible to learners with that title', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $jobTitle = JobTitle::factory()->create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'name' => 'Store Associate',
    ]);
    $learner = User::factory()->learner($organization)->create([
        'job_title_id' => $jobTitle->id,
    ]);
    $course = $this->actingAs($admin)
        ->postJson('/api/v1/organization/courses', [
            'title' => 'Job Title Course',
            'status' => 'published',
        ])
        ->assertCreated()
        ->json('course');

    $this->actingAs($admin)
        ->postJson("/api/v1/organization/courses/{$course['id']}/assignments", [
            'assigned_to_job_title_id' => $jobTitle->id,
        ])
        ->assertCreated()
        ->assertJsonPath('assignment.assigned_to.type', 'job_title')
        ->assertJsonPath('assignment.assigned_to.id', $jobTitle->id);

    Sanctum::actingAs($learner, ['mobile-api']);

    $this->getJson('/api/v1/assignments')
        ->assertOk()
        ->assertJsonCount(1, 'assignments')
        ->assertJsonPath('assignments.0.assigned_to.type', 'job_title')
        ->assertJsonPath('assignments.0.assigned_to.id', $jobTitle->id);
});

test('published pathway courses are assigned to learners through their job title', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $pathway = Pathway::factory()->create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'name' => 'Retail Pathway',
    ]);
    $jobTitle = JobTitle::factory()->create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'name' => 'Store Associate',
        'pathway_id' => $pathway->id,
    ]);
    $learner = User::factory()->learner($organization)->create([
        'job_title_id' => $jobTitle->id,
    ]);

    $course = $this->actingAs($admin)
        ->postJson('/api/v1/organization/courses', [
            'title' => 'Pathway Course',
            'status' => 'published',
            'pathway_id' => $pathway->id,
        ])
        ->assertCreated()
        ->assertJsonPath('course.pathway_id', $pathway->id)
        ->json('course');

    $this->assertDatabaseHas('course_assignments', [
        'course_id' => $course['id'],
        'assigned_to_user_id' => $learner->id,
        'assigned_to_pathway_id' => $pathway->id,
    ]);

    Sanctum::actingAs($learner, ['mobile-api']);

    $this->getJson('/api/v1/assignments')
        ->assertOk()
        ->assertJsonCount(1, 'assignments')
        ->assertJsonPath('assignments.0.source', 'pathway')
        ->assertJsonPath('assignments.0.source_label', 'Pathway')
        ->assertJsonPath('assignments.0.course.pathway_id', $pathway->id);
});
