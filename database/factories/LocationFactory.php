<?php

namespace Database\Factories;

use App\Models\Location;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Location>
 */
class LocationFactory extends Factory
{
    protected $model = Location::class;

    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'created_by_id' => User::factory(),
            'name' => fake()->city(),
            'description' => fake()->optional()->sentence(),
        ];
    }
}
