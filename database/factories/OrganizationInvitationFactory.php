<?php

namespace Database\Factories;

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<OrganizationInvitation>
 */
class OrganizationInvitationFactory extends Factory
{
    protected $model = OrganizationInvitation::class;

    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'invited_by_id' => User::factory(),
            'accepted_by_id' => null,
            'email' => fake()->unique()->safeEmail(),
            'organization_role' => OrganizationRole::Manager->value,
            'token' => Str::uuid()->toString(),
            'accepted_at' => null,
            'revoked_at' => null,
            'expires_at' => now()->addDays(14),
        ];
    }
}
