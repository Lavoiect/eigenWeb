<?php

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\Team;
use App\Models\User;
use App\Notifications\OrganizationInvitationNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Fortify\Features;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->skipUnlessFortifyHas(Features::registration());
});

test('organization admins can invite managers to their organization', function () {
    Notification::fake();

    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();

    $response = $this->actingAs($admin)->post(
        route('organizations.invitations.store', $organization),
        [
            'email' => 'manager@example.com',
            'organization_role' => OrganizationRole::Manager->value,
        ]
    );

    $response->assertRedirect();

    $this->assertDatabaseHas('organization_invitations', [
        'organization_id' => $organization->id,
        'invited_by_id' => $admin->id,
        'email' => 'manager@example.com',
        'organization_role' => OrganizationRole::Manager->value,
    ]);

    Notification::assertSentOnDemand(OrganizationInvitationNotification::class);
});

test('organization admins can invite another organization admin', function () {
    Notification::fake();

    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();

    $this->actingAs($admin)->post(
        route('organizations.invitations.store', $organization),
        [
            'name' => 'Second Admin',
            'email' => 'second-admin@example.com',
            'organization_role' => OrganizationRole::OrganizationAdmin->value,
        ]
    )->assertRedirect();

    $this->assertDatabaseHas('organization_invitations', [
        'organization_id' => $organization->id,
        'email' => 'second-admin@example.com',
        'organization_role' => OrganizationRole::OrganizationAdmin->value,
    ]);

    Notification::assertSentOnDemand(OrganizationInvitationNotification::class);
});

test('organization admins can create learner logins with temporary passwords', function () {
    Notification::fake();

    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();

    $response = $this->actingAs($admin)->post(
        route('organizations.invitations.store', $organization),
        [
            'email' => 'learner@example.com',
            'organization_role' => OrganizationRole::Learner->value,
            'temporary_password' => 'TempPass123!',
        ]
    );

    $response->assertRedirect();

    $user = User::query()->where('email', 'learner@example.com')->firstOrFail();

    expect($user->organization_id)->toBe($organization->id)
        ->and($user->organization_role)->toBe(OrganizationRole::Learner)
        ->and($user->account_status->value)->toBe('active')
        ->and($user->activated_at)->not->toBeNull()
        ->and($user->must_change_password)->toBeTrue()
        ->and($user->email_verified_at)->not->toBeNull()
        ->and(Hash::check('TempPass123!', $user->password))->toBeTrue();

    $this->assertDatabaseMissing('organization_invitations', [
        'organization_id' => $organization->id,
        'email' => 'learner@example.com',
    ]);

    Notification::assertNothingSent();
});

test('an invitation cannot reassign an existing user from another organization', function () {
    Notification::fake();

    $organization = Organization::factory()->create();
    $otherOrganization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $existingUser = User::factory()->manager($otherOrganization)->create();

    $this->actingAs($admin)->post(
        route('organizations.invitations.store', $organization),
        [
            'email' => $existingUser->email,
            'organization_role' => OrganizationRole::Manager->value,
        ]
    )->assertSessionHasErrors('email');

    $this->assertDatabaseMissing('organization_invitations', [
        'organization_id' => $organization->id,
        'email' => $existingUser->email,
    ]);

    Notification::assertNothingSent();
});

test('an invite opened by a different signed-in user offers a safe account switch', function () {
    $organization = Organization::factory()->create();
    $currentUser = User::factory()->organizationAdmin($organization)->create();
    $invitation = OrganizationInvitation::factory()->create([
        'organization_id' => $organization->id,
        'email' => 'second-user@example.com',
        'organization_role' => OrganizationRole::Manager,
    ]);

    $this->actingAs($currentUser)
        ->get(route('invitations.show', $invitation))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/invitation-account-conflict')
            ->where('invitation.email', 'second-user@example.com')
            ->where('currentUser.email', $currentUser->email)
            ->where('organization.name', $organization->name));

    $this->post(route('invitations.switch-account', $invitation))
        ->assertRedirect(route('register', [
            'invite' => $invitation->token,
            'email' => $invitation->email,
        ]));

    $this->assertGuest();
    expect($invitation->fresh()->isPending())->toBeTrue();
});

test('managers are only authorized for the teams assigned to them', function () {
    $organization = Organization::factory()->create();
    $teamA = Team::factory()->create(['organization_id' => $organization->id]);
    $teamB = Team::factory()->create(['organization_id' => $organization->id]);
    $manager = User::factory()->manager($organization)->create();

    $manager->managedTeams()->attach($teamA);

    expect($manager->canManageUsers($organization))->toBeFalse()
        ->and($manager->canViewTeamReporting($teamA))->toBeTrue()
        ->and($manager->canViewTeamReporting($teamB))->toBeFalse()
        ->and($manager->canAssignTraining($teamA))->toBeTrue()
        ->and($manager->canAssignTraining($teamB))->toBeFalse();
});

test('registration with an invitation attaches the invited organization and role', function () {
    $organization = Organization::factory()->create();
    $invitation = OrganizationInvitation::factory()->create([
        'organization_id' => $organization->id,
        'email' => 'learner@example.com',
        'organization_role' => OrganizationRole::Learner->value,
    ]);

    $response = $this->post(route('register.store'), [
        'name' => 'Invited Learner',
        'email' => 'learner@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
        'invite_token' => $invitation->token,
    ]);

    $response->assertRedirect(route('dashboard', absolute: false));

    $this->assertAuthenticated();

    $user = User::query()->where('email', 'learner@example.com')->firstOrFail();

    expect($user->organization_id)->toBe($organization->id)
        ->and($user->organization_role)->toBe(OrganizationRole::Learner);

    $this->assertDatabaseHas('organization_invitations', [
        'id' => $invitation->id,
        'accepted_by_id' => $user->id,
    ]);
});

test('self-serve registration is disabled', function () {
    $response = $this->post(route('register.store'), [
        'organization_name' => 'Acme Learning',
        'name' => 'Org Admin',
        'email' => 'admin@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    $response->assertSessionHasErrors('invite_token');
    $this->assertGuest();
    $this->assertDatabaseMissing('users', ['email' => 'admin@example.com']);
});
