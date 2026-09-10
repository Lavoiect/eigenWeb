<?php

use App\Enums\OrganizationRole;
use App\Models\JobTitle;
use App\Models\Location;
use App\Models\Organization;
use App\Models\Pathway;
use App\Models\Team;
use App\Models\User;
use App\Notifications\OrganizationInvitationNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

test('organization admins can view the users management page', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $manager = User::factory()->manager($organization)->create();
    $team = Team::factory()->create(['organization_id' => $organization->id]);

    $manager->managedTeams()->attach($team);

    $this->actingAs($admin)
        ->get(route('organizations.users.index', $organization))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('organizations/users/index')
            ->where('organization.id', $organization->id)
            ->has('users', 2)
            ->has('teams', 1)
            ->where('summary.total', 2)
            ->where('summary.active_learners', 0)
            ->where('summary.needs_attention', 0)
            ->has('users.0.created_at')
            ->has('users.0.last_active_at')
            ->has('users.0.must_change_password')
            ->has('users.0.training_summary.completion_percent'),
        );
});

test('managers cannot access the users management page', function () {
    $organization = Organization::factory()->create();
    $manager = User::factory()->manager($organization)->create();

    $this->actingAs($manager)
        ->get(route('organizations.users.index', $organization))
        ->assertForbidden();
});

test('organization admins can change a users role and clear old assignments', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $user = User::factory()->learner($organization)->create();
    $team = Team::factory()->create(['organization_id' => $organization->id]);

    $user->teams()->attach($team, [
        'created_by_id' => $admin->id,
    ]);

    $response = $this->actingAs($admin)
        ->patch(route('organizations.users.update-role', [$organization, $user]), [
            'organization_role' => OrganizationRole::Manager->value,
        ]);

    $response->assertRedirect();

    $user->refresh();

    expect($user->organization_role)->toBe(OrganizationRole::Manager);
    $this->assertDatabaseMissing('team_memberships', [
        'team_id' => $team->id,
        'user_id' => $user->id,
    ]);
    $this->assertDatabaseMissing('team_manager_assignments', [
        'team_id' => $team->id,
        'user_id' => $user->id,
    ]);
});

test('organization admins can sync manager team assignments', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $manager = User::factory()->manager($organization)->create();
    $teamA = Team::factory()->create(['organization_id' => $organization->id]);
    $teamB = Team::factory()->create(['organization_id' => $organization->id]);

    $response = $this->actingAs($admin)
        ->put(route('organizations.users.sync-teams', [$organization, $manager]), [
            'team_ids' => [$teamA->id, $teamB->id],
        ]);

    $response->assertRedirect();

    $this->assertDatabaseHas('team_manager_assignments', [
        'team_id' => $teamA->id,
        'user_id' => $manager->id,
    ]);

    $this->assertDatabaseHas('team_manager_assignments', [
        'team_id' => $teamB->id,
        'user_id' => $manager->id,
    ]);
});

test('organization admins can sync learner team memberships', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $learner = User::factory()->learner($organization)->create();
    $team = Team::factory()->create(['organization_id' => $organization->id]);

    $response = $this->actingAs($admin)
        ->put(route('organizations.users.sync-teams', [$organization, $learner]), [
            'team_ids' => [$team->id],
        ]);

    $response->assertRedirect();

    $this->assertDatabaseHas('team_memberships', [
        'team_id' => $team->id,
        'user_id' => $learner->id,
    ]);
});

test('organization admins can create job titles locations and teams and assign employee structure', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $employee = User::factory()->learner($organization)->create();

    $this->actingAs($admin)
        ->post(route('organizations.job-titles.store', $organization), [
            'job_title_name' => 'Store Manager',
        ])
        ->assertRedirect();

    $this->actingAs($admin)
        ->post(route('organizations.locations.store', $organization), [
            'location_name' => 'North Warehouse',
        ])
        ->assertRedirect();

    $this->actingAs($admin)
        ->post(route('organizations.teams.store', $organization), [
            'team_name' => 'Field Support',
        ])
        ->assertRedirect();

    $jobTitle = JobTitle::query()->where('organization_id', $organization->id)->firstOrFail();
    $location = Location::query()->where('organization_id', $organization->id)->firstOrFail();

    $this->actingAs($admin)
        ->put(route('organizations.users.sync-structure', [$organization, $employee]), [
            'job_title_id' => $jobTitle->id,
            'location_id' => $location->id,
        ])
        ->assertRedirect();

    $employee->refresh();

    expect($employee->job_title_id)->toBe($jobTitle->id)
        ->and($employee->location_id)->toBe($location->id);
});

test('organization admins can create pathways and map job titles to them', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $jobTitle = JobTitle::factory()->create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'name' => 'Store Associate',
    ]);
    $pathway = Pathway::factory()->create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'name' => 'Retail Pathway',
    ]);

    $this->actingAs($admin)
        ->post(route('organizations.pathways.store', $organization), [
            'pathway_name' => 'Frontline Leader',
            'pathway_description' => 'Training for managers and leads.',
            'sequential_completion' => true,
            'expected_completion_days' => 30,
        ])
        ->assertRedirect();

    $createdPathway = Pathway::query()
        ->where('organization_id', $organization->id)
        ->where('name', 'Frontline Leader')
        ->firstOrFail();

    $this->actingAs($admin)
        ->put(route('organizations.job-titles.sync-pathway', [$organization, $jobTitle]), [
            'pathway_id' => $pathway->id,
        ])
        ->assertRedirect();

    $jobTitle->refresh();

    expect($jobTitle->pathway_id)->toBe($pathway->id);
    expect($createdPathway->description)->toBe('Training for managers and leads.')
        ->and($createdPathway->sequential_completion)->toBeTrue()
        ->and($createdPathway->expected_completion_days)->toBe(30);
});

test('organization admins can download a sample import csv with helper team names', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();

    $teamA = Team::factory()->create([
        'organization_id' => $organization->id,
        'name' => 'Backroom',
    ]);
    $teamB = Team::factory()->create([
        'organization_id' => $organization->id,
        'name' => 'North Store',
    ]);

    $response = $this->actingAs($admin)
        ->get(route('organizations.users.import-sample', $organization));

    $response->assertOk()
        ->assertDownload(Str::slug($organization->name).'-employee-import-sample.csv');

    $lines = array_values(array_filter(preg_split('/\r\n|\r|\n/', trim($response->streamedContent())) ?: []));

    expect($lines)->toHaveCount(3);

    $headers = str_getcsv(ltrim($lines[0], "\xEF\xBB\xBF"));
    expect($headers)->toBe(['name', 'email', 'role', 'temporary_password', 'team_ids', 'team_names']);

    $learner = str_getcsv($lines[1]);
    expect($learner)->toBe([
        'Mia Carter',
        'mia.carter@example.com',
        OrganizationRole::Learner->value,
        'TempPass123',
        $teamA->id.'|'.$teamB->id,
        'Backroom|North Store',
    ]);

    $manager = str_getcsv($lines[2]);
    expect($manager)->toBe([
        'Jordan Lee',
        'jordan.lee@example.com',
        OrganizationRole::Manager->value,
        '',
        (string) $teamA->id,
        'Backroom',
    ]);
});

test('bulk employee entry supports admins, managers, and immediate learner logins', function () {
    Notification::fake();

    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();

    $this->actingAs($admin)
        ->post(route('organizations.users.bulk-invite', $organization), [
            'employees' => implode("\n", [
                'Alex Smith,alex@example.com,organization_admin',
                'Jordan Lee,jordan@example.com,manager',
                'Mia Carter,mia@example.com,learner,TempPass123!',
            ]),
        ])
        ->assertRedirect();

    $this->assertDatabaseHas('organization_invitations', [
        'organization_id' => $organization->id,
        'email' => 'alex@example.com',
        'organization_role' => OrganizationRole::OrganizationAdmin->value,
    ]);
    $this->assertDatabaseHas('organization_invitations', [
        'organization_id' => $organization->id,
        'email' => 'jordan@example.com',
        'organization_role' => OrganizationRole::Manager->value,
    ]);
    $this->assertDatabaseHas('users', [
        'organization_id' => $organization->id,
        'email' => 'mia@example.com',
        'organization_role' => OrganizationRole::Learner->value,
        'must_change_password' => true,
    ]);

    Notification::assertSentOnDemandTimes(
        OrganizationInvitationNotification::class,
        2,
    );
});

test('organization admins can bulk update employee structure within their organization', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $learners = User::factory()->count(2)->learner($organization)->create();
    $jobTitle = JobTitle::factory()->create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
    ]);

    $this->actingAs($admin)
        ->patch(route('organizations.users.bulk-update', $organization), [
            'user_ids' => $learners->pluck('id')->all(),
            'action' => 'set_job_title',
            'value_id' => $jobTitle->id,
        ])
        ->assertRedirect();

    foreach ($learners as $learner) {
        expect($learner->refresh()->job_title_id)->toBe($jobTitle->id);
    }
});

test('bulk employee updates cannot cross organization boundaries', function () {
    $organization = Organization::factory()->create();
    $otherOrganization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $learner = User::factory()->learner($organization)->create();
    $foreignLearner = User::factory()->learner($otherOrganization)->create();

    $this->actingAs($admin)
        ->patch(route('organizations.users.bulk-update', $organization), [
            'user_ids' => [$learner->id, $foreignLearner->id],
            'action' => 'set_account_status',
            'account_status' => 'deactivated',
        ])
        ->assertSessionHasErrors('user_ids.1');

    expect($learner->refresh()->isDeactivated())->toBeFalse()
        ->and($foreignLearner->refresh()->isDeactivated())->toBeFalse();
});

test('bulk deactivation protects the current organization admin', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $learner = User::factory()->learner($organization)->create();

    $this->actingAs($admin)
        ->patch(route('organizations.users.bulk-update', $organization), [
            'user_ids' => [$admin->id, $learner->id],
            'action' => 'set_account_status',
            'account_status' => 'deactivated',
        ])
        ->assertRedirect();

    expect($admin->refresh()->isDeactivated())->toBeFalse()
        ->and($learner->refresh()->isDeactivated())->toBeTrue();
});
