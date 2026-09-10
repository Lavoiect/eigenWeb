<?php

use App\Models\Course;
use App\Models\Organization;
use App\Models\Team;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

test('organization admins can access organization admin routes', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();

    $this->actingAs($admin)
        ->get(route('organizations.invitations.index', $organization))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('organizations/invitations/index'));
});

test('organization admins can access the training management page', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'title' => 'Safety basics',
        'slug' => 'safety-basics',
        'description' => 'Intro course',
        'status' => 'draft',
        'published_at' => null,
    ]);

    $this->actingAs($admin)
        ->get(route('organizations.courses.index', $organization))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('organizations/courses/index')
            ->where('organization.id', $organization->id)
            ->has('courses', 1),
        );
});

test('managers cannot access the training management page', function () {
    $organization = Organization::factory()->create();
    $manager = User::factory()->manager($organization)->create();

    $this->actingAs($manager)
        ->get(route('organizations.courses.index', $organization))
        ->assertForbidden();
});

test('managers cannot access organization admin routes', function () {
    $organization = Organization::factory()->create();
    $manager = User::factory()->manager($organization)->create();

    $this->actingAs($manager)
        ->get(route('organizations.invitations.index', $organization))
        ->assertForbidden();
});

test('managers can access their assigned team routes', function () {
    $organization = Organization::factory()->create();
    $team = Team::factory()->create(['organization_id' => $organization->id]);
    $manager = User::factory()->manager($organization)->create();

    $manager->managedTeams()->attach($team);

    $this->actingAs($manager)
        ->get(route('teams.reports.index', $team))
        ->assertOk()
        ->assertJson([
            'team' => [
                'id' => $team->id,
                'name' => $team->name,
            ],
            'area' => 'manager',
        ]);
});

test('managers cannot access team routes outside their assignment', function () {
    $organization = Organization::factory()->create();
    $team = Team::factory()->create(['organization_id' => $organization->id]);
    $manager = User::factory()->manager($organization)->create();

    $this->actingAs($manager)
        ->get(route('teams.reports.index', $team))
        ->assertForbidden();
});
