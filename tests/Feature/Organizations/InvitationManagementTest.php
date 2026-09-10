<?php

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

test('organization admins can view the invitation management screen', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();

    OrganizationInvitation::factory()->create([
        'organization_id' => $organization->id,
        'email' => 'learner@example.com',
        'organization_role' => OrganizationRole::Learner->value,
    ]);

    $this->actingAs($admin)
        ->get(route('organizations.invitations.index', $organization))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('organizations/invitations/index')
            ->where('organization.id', $organization->id)
            ->has('invitations', 1)
            ->where('invitations.0.email', 'learner@example.com')
            ->where('invitations.0.status', 'pending'),
        );
});

test('organization admins can revoke pending invitations', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $invite = OrganizationInvitation::factory()->create([
        'organization_id' => $organization->id,
        'email' => 'manager@example.com',
        'organization_role' => OrganizationRole::Manager->value,
    ]);

    $response = $this->actingAs($admin)
        ->from(route('organizations.invitations.index', $organization))
        ->delete(route('organizations.invitations.destroy', [$organization, $invite]));

    $response->assertRedirect(route('organizations.invitations.index', $organization));

    expect($invite->refresh()->revoked_at)->not->toBeNull();
});
