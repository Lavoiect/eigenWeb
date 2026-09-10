<?php

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\Team;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

test('organization api exposes a scoped summary for authenticated users', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    Team::factory()->count(2)->create([
        'organization_id' => $organization->id,
    ]);
    OrganizationInvitation::factory()->count(1)->create([
        'organization_id' => $organization->id,
        'invited_by_id' => $admin->id,
    ]);

    Sanctum::actingAs($admin, ['mobile-api']);

    $this->getJson('/api/v1/organization')
        ->assertOk()
        ->assertJsonPath('organization.id', $organization->id)
        ->assertJsonPath('summary.users', 1)
        ->assertJsonPath('summary.teams', 2)
        ->assertJsonPath('summary.invitations', 1);
});

test('organization endpoints scope visible users and teams by role', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $manager = User::factory()->manager($organization)->create();
    $learner = User::factory()->learner($organization)->create();
    $teamA = Team::factory()->create([
        'organization_id' => $organization->id,
        'name' => 'Team A',
    ]);
    $teamB = Team::factory()->create([
        'organization_id' => $organization->id,
        'name' => 'Team B',
    ]);

    $manager->managedTeams()->attach($teamA, [
        'assigned_by_id' => $admin->id,
    ]);
    $learner->teams()->attach($teamA, [
        'created_by_id' => $admin->id,
    ]);

    Sanctum::actingAs($admin, ['mobile-api']);

    $this->getJson('/api/v1/organization/users')
        ->assertOk()
        ->assertJsonCount(3, 'users');

    $this->getJson('/api/v1/organization/teams')
        ->assertOk()
        ->assertJsonCount(2, 'teams');

    Sanctum::actingAs($manager, ['mobile-api']);

    $managerUsers = $this->getJson('/api/v1/organization/users')
        ->assertOk()
        ->assertJsonCount(2, 'users')
        ->json('users');

    expect(collect($managerUsers)->pluck('team_assignment_mode')->all())
        ->toContain('manager')
        ->toContain('learner');

    $this->getJson('/api/v1/organization/teams')
        ->assertOk()
        ->assertJsonCount(1, 'teams')
        ->assertJsonPath('teams.0.id', $teamA->id);

    $this->getJson('/api/v1/organization/invitations')
        ->assertForbidden();

    Sanctum::actingAs($learner, ['mobile-api']);

    $learnerUsers = $this->getJson('/api/v1/organization/users')
        ->assertOk()
        ->assertJsonCount(1, 'users')
        ->json('users');

    expect($learnerUsers[0]['is_current_user'])->toBeTrue();

    $this->getJson('/api/v1/organization/teams')
        ->assertOk()
        ->assertJsonCount(1, 'teams')
        ->assertJsonPath('teams.0.id', $teamA->id);
});

test('organization invitation endpoints are available to admins', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $invite = OrganizationInvitation::factory()->create([
        'organization_id' => $organization->id,
        'invited_by_id' => $admin->id,
        'organization_role' => OrganizationRole::Learner->value,
    ]);

    Sanctum::actingAs($admin, ['mobile-api']);

    $this->getJson('/api/v1/organization/invitations')
        ->assertOk()
        ->assertJsonCount(1, 'invitations')
        ->assertJsonPath('invitations.0.id', $invite->id)
        ->assertJsonPath('invitations.0.status', 'pending');
});
