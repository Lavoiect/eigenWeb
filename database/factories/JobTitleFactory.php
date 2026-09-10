<?php

namespace Database\Factories;

use App\Models\JobTitle;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<JobTitle>
 */
class JobTitleFactory extends Factory
{
    protected $model = JobTitle::class;

    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'created_by_id' => User::factory(),
            'name' => fake()->jobTitle(),
            'description' => fake()->optional()->sentence(),
        ];
    }
}
