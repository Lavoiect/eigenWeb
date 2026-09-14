<?php

use App\Models\Course;
use App\Models\CourseAssignment;
use App\Models\CourseProgress;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

test('an organization admin sees completed assigned and overdue employee training', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $learner = User::factory()->learner($organization)->create([
        'name' => 'Taylor Morgan',
    ]);

    $completedCourse = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'title' => 'Equipment Safety',
        'slug' => 'equipment-safety',
        'passing_score' => 80,
        'status' => 'published',
        'published_at' => now(),
    ]);
    $assignedCourse = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'title' => 'Customer Service Basics',
        'slug' => 'customer-service-basics',
        'status' => 'published',
        'published_at' => now(),
    ]);
    $overdueCourse = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'title' => 'Emergency Procedures',
        'slug' => 'emergency-procedures',
        'status' => 'published',
        'published_at' => now(),
    ]);

    foreach ([$completedCourse, $assignedCourse, $overdueCourse] as $course) {
        CourseAssignment::create([
            'course_id' => $course->id,
            'assigned_by_id' => $admin->id,
            'assigned_to_user_id' => $learner->id,
            'due_at' => $course->is($overdueCourse)
                ? now()->subDays(3)
                : now()->addDays(7),
            'is_required' => true,
        ]);
    }

    CourseProgress::create([
        'course_id' => $completedCourse->id,
        'user_id' => $learner->id,
        'status' => 'completed',
        'completed_lessons_count' => 3,
        'total_lessons_count' => 3,
        'progress_percent' => 100,
        'score_percent' => 90,
        'scored_questions_count' => 10,
        'correct_questions_count' => 9,
        'passed' => true,
        'completed_at' => now()->subDay(),
    ]);

    $this->actingAs($admin)
        ->get(route('organizations.users.transcript', [$organization, $learner]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('organizations/users/transcript')
            ->where('training.summary.completed_courses', 1)
            ->where('training.summary.assigned_courses', 1)
            ->where('training.summary.overdue_courses', 1)
            ->where('training.summary.average_score_percent', 90)
            ->where('training.completed.0.course.title', 'Equipment Safety')
            ->where('training.completed.0.certificate.view_url', route(
                'organizations.users.certificate',
                [$organization, $learner, $completedCourse],
            ))
            ->where('training.assigned.0.course.title', 'Customer Service Basics')
            ->where('training.overdue.0.course.title', 'Emergency Procedures')
        );
});

test('an organization admin can view and download a completed course certificate', function () {
    $organization = Organization::factory()->create([
        'name' => 'Northwind Operations',
    ]);
    $admin = User::factory()->organizationAdmin($organization)->create();
    $learner = User::factory()->learner($organization)->create([
        'name' => 'Taylor Morgan',
    ]);
    $course = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'title' => 'Equipment Safety',
        'slug' => 'equipment-safety',
        'status' => 'published',
        'published_at' => now(),
    ]);

    CourseProgress::create([
        'course_id' => $course->id,
        'user_id' => $learner->id,
        'status' => 'completed',
        'progress_percent' => 100,
        'score_percent' => 90,
        'passed' => true,
        'completed_at' => now(),
    ]);

    $certificateRoute = route('organizations.users.certificate', [
        $organization,
        $learner,
        $course,
    ]);

    $this->actingAs($admin)
        ->get($certificateRoute)
        ->assertOk()
        ->assertHeader('content-type', 'image/svg+xml; charset=UTF-8')
        ->assertHeader(
            'content-disposition',
            'inline; filename="taylor-morgan-equipment-safety-certificate.svg"',
        )
        ->assertSee('Taylor Morgan', false)
        ->assertSee('Equipment Safety', false)
        ->assertSee('Northwind Operations', false);

    $this->get($certificateRoute.'?download=1')
        ->assertOk()
        ->assertHeader(
            'content-disposition',
            'attachment; filename="taylor-morgan-equipment-safety-certificate.svg"',
        );
});

test('a certificate cannot be generated for incomplete training', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $learner = User::factory()->learner($organization)->create();
    $course = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'title' => 'Equipment Safety',
        'slug' => 'equipment-safety',
        'status' => 'published',
        'published_at' => now(),
    ]);

    CourseProgress::create([
        'course_id' => $course->id,
        'user_id' => $learner->id,
        'status' => 'in_progress',
        'progress_percent' => 50,
    ]);

    $this->actingAs($admin)
        ->get(route('organizations.users.certificate', [
            $organization,
            $learner,
            $course,
        ]))
        ->assertNotFound();
});
