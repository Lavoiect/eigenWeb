<?php

use App\Models\Organization;
use App\Models\Team;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

test('a mobile user can exchange credentials for a sanctum token', function () {
    $organization = Organization::factory()->create();
    $user = User::factory()->organizationAdmin($organization)->create([
        'email' => 'admin@example.com',
    ]);

    $response = $this->postJson('/api/v1/auth/token', [
        'email' => 'admin@example.com',
        'password' => 'password',
        'device_name' => 'iPhone 15',
    ]);

    $response
        ->assertCreated()
        ->assertJsonPath('token_type', 'Bearer')
        ->assertJsonPath('user.id', $user->id)
        ->assertJsonPath('user.must_change_password', false)
        ->assertJsonPath('organization.id', $organization->id)
        ->assertJsonPath('abilities.can_manage_users', true);

    expect($response->json('token'))->toBeString()->not->toBeEmpty();

    $this->assertDatabaseCount('personal_access_tokens', 1);
});

test('a mobile user can request a password reset link', function () {
    $organization = Organization::factory()->create();
    User::factory()->learner($organization)->create([
        'email' => 'learner@example.com',
    ]);

    $this->postJson('/api/v1/auth/password-reset-link', [
        'email' => 'learner@example.com',
    ])
        ->assertOk()
        ->assertJsonPath(
            'message',
            'If an account exists for that email, a password reset link has been sent.',
        );
});

test('authenticated mobile routes return the current user and scoped teams', function () {
    $organization = Organization::factory()->create();
    $teamA = Team::factory()->create([
        'organization_id' => $organization->id,
        'name' => 'Team A',
    ]);
    $teamB = Team::factory()->create([
        'organization_id' => $organization->id,
        'name' => 'Team B',
    ]);
    $admin = User::factory()->organizationAdmin($organization)->create();
    $manager = User::factory()->manager($organization)->create();
    $learner = User::factory()->learner($organization)->create();
    $forcedLearner = User::factory()->learner($organization)->create([
        'must_change_password' => true,
        'email' => 'temp-learner@example.com',
    ]);

    $manager->managedTeams()->attach($teamA, [
        'assigned_by_id' => $admin->id,
    ]);
    $learner->teams()->attach($teamB, [
        'created_by_id' => $admin->id,
    ]);

    Sanctum::actingAs($admin, ['mobile-api']);

    $this->getJson('/api/v1/me')
        ->assertOk()
        ->assertJsonPath('organization.id', $organization->id)
        ->assertJsonPath('abilities.can_manage_users', true)
        ->assertJsonCount(2, 'teams');

    $this->getJson('/api/v1/teams')
        ->assertOk()
        ->assertJsonCount(2, 'teams');

    Sanctum::actingAs($manager, ['mobile-api']);

    $this->getJson('/api/v1/teams')
        ->assertOk()
        ->assertJsonCount(1, 'teams')
        ->assertJsonPath('teams.0.id', $teamA->id)
        ->assertJsonPath('teams.0.scope', 'managed');

    $this->getJson("/api/v1/teams/{$teamB->id}")
        ->assertForbidden();

    Sanctum::actingAs($learner, ['mobile-api']);

    $this->getJson('/api/v1/teams')
        ->assertOk()
        ->assertJsonCount(1, 'teams')
        ->assertJsonPath('teams.0.id', $teamB->id)
        ->assertJsonPath('teams.0.scope', 'self');

    Sanctum::actingAs($forcedLearner, ['mobile-api']);

    $this->getJson('/api/v1/me')
        ->assertOk()
        ->assertJsonPath('user.must_change_password', true)
        ->assertJsonCount(0, 'teams');

    $this->getJson('/api/v1/teams')
        ->assertStatus(423)
        ->assertJsonPath('message', 'Password change required.');
});

test('a mobile user can change a temporary password', function () {
    $organization = Organization::factory()->create();
    $user = User::factory()->learner($organization)->create([
        'email' => 'learner@example.com',
        'must_change_password' => true,
    ]);
    $token = $user->createToken('iPhone', ['mobile-api']);

    $this->withToken($token->plainTextToken)
        ->putJson('/api/v1/me/password', [
            'current_password' => 'password',
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ])
        ->assertOk()
        ->assertJsonPath('user.must_change_password', false)
        ->assertJsonPath('organization.id', $organization->id);

    expect(Hash::check('new-password', $user->refresh()->password))->toBeTrue()
        ->and($user->must_change_password)->toBeFalse();
});

test('a current mobile token can be revoked', function () {
    $organization = Organization::factory()->create();
    $user = User::factory()->organizationAdmin($organization)->create();
    $token = $user->createToken('iPhone', ['mobile-api']);

    $this->withToken($token->plainTextToken)
        ->deleteJson('/api/v1/auth/token')
        ->assertNoContent();

    $this->assertDatabaseMissing('personal_access_tokens', [
        'id' => $token->accessToken->id,
    ]);
});

test('mobile token issuance rejects accounts without an organization', function () {
    $user = User::factory()->create([
        'email' => 'orphan@example.com',
        'organization_id' => null,
        'organization_role' => null,
    ]);

    $this->postJson('/api/v1/auth/token', [
        'email' => $user->email,
        'password' => 'password',
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['email']);
});
