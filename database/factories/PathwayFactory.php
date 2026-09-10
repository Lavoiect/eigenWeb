<?php

namespace Database\Factories;

use App\Models\Organization;
use App\Models\Pathway;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Pathway>
 */
class PathwayFactory extends Factory
{
    protected $model = Pathway::class;

    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'created_by_id' => User::factory(),
            'name' => fake()->unique()->words(2, true),
            'description' => fake()->optional()->sentence(),
        ];
    }
}
