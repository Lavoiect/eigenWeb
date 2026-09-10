<?php

use App\Actions\Fortify\ResetUserPassword;
use App\Enums\AccountStatus;
use App\Enums\OrganizationRole;
use App\Enums\OrganizationStatus;
use App\Models\Organization;
use App\Models\User;
use App\Notifications\AccountActivation;
use App\Services\CloudinaryResourceStorage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Mockery\MockInterface;

uses(RefreshDatabase::class);

test('only Eigen Super Admins can access platform organization management', function () {
    $organization = Organization::factory()->create();
    $customerAdmin = User::factory()->organizationAdmin($organization)->create();
    $superAdmin = User::factory()->superAdmin()->create();

    $this->actingAs($customerAdmin)
        ->get(route('platform.organizations.index'))
        ->assertForbidden();

    $this->actingAs($superAdmin)
        ->get(route('platform.organizations.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('platform/organizations/index')
            ->has('organizations', 1));
});

test('a Super Admin can create and explicitly enter an organization', function () {
    $superAdmin = User::factory()->superAdmin()->create();

    $this->actingAs($superAdmin)
        ->post(route('platform.organizations.store'), [
            'name' => 'Northwind Field Services',
        ])
        ->assertSessionHasNoErrors();

    $organization = Organization::query()
        ->where('slug', 'northwind-field-services')
        ->firstOrFail();

    expect($organization->created_by_id)->toBe($superAdmin->id)
        ->and($organization->status)->toBe(OrganizationStatus::Setup);

    $this->actingAs($superAdmin)
        ->get(route('organizations.users.index', $organization))
        ->assertForbidden();

    $this->post(route('platform.organizations.manage', $organization))
        ->assertRedirect(route('dashboard'))
        ->assertSessionHas('managed_organization_id', $organization->id);

    $this->get(route('organizations.users.index', $organization))
        ->assertOk();

    $this->delete(route('platform.organization-context.destroy'))
        ->assertRedirect(route('platform.organizations.index'))
        ->assertSessionMissing('managed_organization_id');
});

test('a Super Admin can upload a company logo while creating an organization', function () {
    $superAdmin = User::factory()->superAdmin()->create();
    $logo = UploadedFile::fake()->image('northwind-logo.png', 320, 320);

    $this->mock(
        CloudinaryResourceStorage::class,
        function (MockInterface $mock): void {
            $mock->shouldReceive('upload')
                ->once()
                ->withArgs(fn (UploadedFile $file, string $folder, string $publicId): bool => $file->getClientOriginalName() === 'northwind-logo.png'
                    && $folder === 'company_logos'
                    && str_starts_with($publicId, 'northwind-field-services-'))
                ->andReturn([
                    'disk' => 'cloudinary',
                    'path' => 'company_logos/northwind-field-services-logo',
                    'url' => 'https://res.cloudinary.com/eigen/image/upload/company_logos/northwind-logo.png',
                    'original_name' => 'northwind-logo.png',
                    'mime_type' => 'image/png',
                    'size_bytes' => 1024,
                    'public_id' => 'company_logos/northwind-field-services-logo',
                ]);
        },
    );

    $this->actingAs($superAdmin)
        ->post(route('platform.organizations.store'), [
            'name' => 'Northwind Field Services',
            'logo' => $logo,
        ])
        ->assertSessionHasNoErrors();

    $this->assertDatabaseHas('organizations', [
        'name' => 'Northwind Field Services',
        'logo_url' => 'https://res.cloudinary.com/eigen/image/upload/company_logos/northwind-logo.png',
    ]);
});

test('an org-less Super Admin is directed to the platform dashboard', function () {
    $superAdmin = User::factory()->superAdmin()->create();

    $this->actingAs($superAdmin)
        ->get(route('dashboard'))
        ->assertRedirect(route('platform.organizations.index'));
});

test('a Super Admin creates a pending organization administrator with an activation email', function () {
    Notification::fake();

    $superAdmin = User::factory()->superAdmin()->create();
    $organization = Organization::factory()->create();

    $this->actingAs($superAdmin)
        ->post(route('platform.organizations.administrators.store', $organization), [
            'name' => 'Jordan Lee',
            'email' => 'jordan@northwind.example',
        ])
        ->assertSessionHasNoErrors();

    $administrator = User::query()
        ->where('email', 'jordan@northwind.example')
        ->firstOrFail();

    expect($administrator->organization_id)->toBe($organization->id)
        ->and($administrator->organization_role)->toBe(OrganizationRole::OrganizationAdmin)
        ->and($administrator->account_status)->toBe(AccountStatus::Pending)
        ->and($administrator->activated_at)->toBeNull();

    Notification::assertSentTo($administrator, AccountActivation::class);

    $this->post(route('logout'));

    $this->post(route('login.store'), [
        'email' => $administrator->email,
        'password' => 'not-the-random-password',
    ])->assertSessionHasErrors('email');
});

test('setting a pending administrators password activates the account', function () {
    $organization = Organization::factory()->create();
    $administrator = User::factory()->organizationAdmin($organization)->create([
        'account_status' => AccountStatus::Pending,
        'activated_at' => null,
        'email_verified_at' => null,
    ]);

    app(ResetUserPassword::class)->reset($administrator, [
        'password' => 'new-secure-password',
        'password_confirmation' => 'new-secure-password',
    ]);

    $administrator->refresh();

    expect($administrator->account_status)->toBe(AccountStatus::Active)
        ->and($administrator->activated_at)->not->toBeNull()
        ->and($administrator->email_verified_at)->not->toBeNull()
        ->and($administrator->canLogin())->toBeTrue();
});

test('resetting a suspended users password does not reactivate the account', function () {
    $organization = Organization::factory()->create();
    $administrator = User::factory()->organizationAdmin($organization)->create([
        'account_status' => AccountStatus::Suspended,
    ]);

    app(ResetUserPassword::class)->reset($administrator, [
        'password' => 'new-secure-password',
        'password_confirmation' => 'new-secure-password',
    ]);

    expect($administrator->fresh()->account_status)->toBe(AccountStatus::Suspended);
});

test('the console command promotes an org-less account to Super Admin', function () {
    $user = User::factory()->create([
        'organization_id' => null,
        'organization_role' => null,
        'platform_role' => null,
    ]);

    $this->artisan('platform:make-super-admin', ['email' => $user->email])
        ->assertSuccessful();

    $user->refresh();

    expect($user->isSuperAdmin())->toBeTrue()
        ->and($user->organization_id)->toBeNull()
        ->and($user->organization_role)->toBeNull();
});

test('the console command will not silently detach a customer user', function () {
    $organization = Organization::factory()->create();
    $administrator = User::factory()->organizationAdmin($organization)->create();

    $this->artisan('platform:make-super-admin', ['email' => $administrator->email])
        ->assertFailed();

    expect($administrator->fresh()->isSuperAdmin())->toBeFalse()
        ->and($administrator->organization_id)->toBe($organization->id);
});

test('suspended organizations cannot authenticate customer users', function () {
    $organization = Organization::factory()->create([
        'status' => OrganizationStatus::Suspended,
        'suspended_at' => now(),
    ]);
    $administrator = User::factory()->organizationAdmin($organization)->create();

    $this->post(route('login.store'), [
        'email' => $administrator->email,
        'password' => 'password',
    ])->assertSessionHasErrors('email');

    $this->assertGuest();
});
