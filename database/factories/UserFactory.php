<?php

namespace Database\Factories;

use App\Enums\AccountStatus;
use App\Enums\OrganizationRole;
use App\Enums\PlatformRole;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'remember_token' => Str::random(10),
            'organization_id' => null,
            'organization_role' => OrganizationRole::Learner->value,
            'platform_role' => null,
            'account_status' => AccountStatus::Active->value,
            'activated_at' => now(),
        ];
    }

    /**
     * Indicate that the model's email address should be unverified.
     */
    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }

    /**
     * Indicate that the model has two-factor authentication configured.
     */
    public function withTwoFactor(): static {}

    public function organizationAdmin(?Organization $organization = null): static
    {
        return $this->state(fn (): array => [
            'organization_id' => $organization?->getKey(),
            'organization_role' => OrganizationRole::OrganizationAdmin->value,
        ]);
    }

    public function manager(?Organization $organization = null): static
    {
        return $this->state(fn (): array => [
            'organization_id' => $organization?->getKey(),
            'organization_role' => OrganizationRole::Manager->value,
        ]);
    }

    public function learner(?Organization $organization = null): static
    {
        return $this->state(fn (): array => [
            'organization_id' => $organization?->getKey(),
            'organization_role' => OrganizationRole::Learner->value,
        ]);
    }

    public function superAdmin(): static
    {
        return $this->state(fn (): array => [
            'platform_role' => PlatformRole::SuperAdmin->value,
            'organization_id' => null,
            'organization_role' => null,
        ]);
    }
}
