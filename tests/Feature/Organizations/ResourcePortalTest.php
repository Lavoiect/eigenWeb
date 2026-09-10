<?php

use App\Enums\OrganizationRole;
use App\Models\Course;
use App\Models\JobTitle;
use App\Models\Location;
use App\Models\Organization;
use App\Models\OrganizationResource;
use App\Models\OrganizationResourceVersion;
use App\Models\Team;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    config()->set([
        'services.cloudinary.cloud_name' => 'demo',
        'services.cloudinary.api_key' => 'key',
        'services.cloudinary.api_secret' => 'secret',
    ]);

    Http::fake(function (HttpRequest $request) {
        $data = $request->data();
        $publicId = (string) ($data['public_id'] ?? 'assets/organizations/demo/resources/1/v1');

        return Http::response([
            'public_id' => $publicId,
            'secure_url' => 'https://res.cloudinary.com/demo/'.$publicId,
        ]);
    });
});

test('organization admins can open the resource portal', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $course = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'title' => 'Safety Orientation',
        'slug' => 'safety-orientation',
        'status' => 'published',
        'published_at' => now(),
    ]);

    OrganizationResource::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'updated_by_id' => $admin->id,
        'course_id' => $course->id,
        'title' => 'PPE checklist',
        'description' => 'Use before each shift.',
        'category' => 'Safety',
        'tags' => ['ppe', 'checklist'],
        'featured' => true,
        'organization_role' => OrganizationRole::Learner->value,
        'revision_date' => now()->toDateString(),
        'status' => 'active',
        'current_version' => 1,
    ]);

    $this->actingAs($admin)
        ->get(route('organizations.resources.index', $organization))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('organizations/resources/index')
            ->where('organization.id', $organization->id)
            ->where('resources.0.title', 'PPE checklist')
            ->where('resources.0.latest_version', null)
            ->where('roleOptions.2.label', 'Manager'));
});

test('organization admins can upload replace and archive resource versions', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $course = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'title' => 'Safety Orientation',
        'slug' => 'safety-orientation',
        'status' => 'published',
        'published_at' => now(),
    ]);

    $uploadResponse = $this->actingAs($admin)
        ->post(route('organizations.resources.store', $organization), [
            'title' => 'PPE checklist',
            'description' => 'Use before each shift.',
            'category' => 'Safety',
            'tags' => 'ppe, checklist',
            'featured' => true,
            'organization_role' => OrganizationRole::Learner->value,
            'course_id' => $course->id,
            'revision_date' => now()->toDateString(),
            'file' => UploadedFile::fake()->create('ppe-checklist.pdf', 128, 'application/pdf'),
        ]);

    $uploadResponse->assertRedirect();
    Http::assertSentCount(1);

    $resource = OrganizationResource::query()->firstOrFail();

    expect($resource->current_version)->toBe(1)
        ->and($resource->featured)->toBeTrue()
        ->and($resource->tags)->toBe(['ppe', 'checklist']);

    expect(OrganizationResourceVersion::query()->where('organization_resource_id', $resource->id)->count())->toBe(1);

    $this->actingAs($admin)
        ->patch(route('organizations.resources.update', [$organization, $resource]), [
            'title' => 'PPE checklist',
            'description' => 'Use before each shift. Updated for winter.',
            'category' => 'Safety',
            'tags' => 'ppe, checklist, winter',
            'featured' => true,
            'organization_role' => OrganizationRole::Learner->value,
            'course_id' => $course->id,
            'revision_date' => now()->addDay()->toDateString(),
            'file' => UploadedFile::fake()->create('ppe-checklist-v2.pdf', 192, 'application/pdf'),
        ])
        ->assertRedirect();

    Http::assertSentCount(2);

    $resource->refresh();

    expect($resource->current_version)->toBe(2)
        ->and($resource->revision_date?->toDateString())->toBe(now()->addDay()->toDateString());

    expect(OrganizationResourceVersion::query()->where('organization_resource_id', $resource->id)->count())->toBe(2);

    $this->actingAs($admin)
        ->patch(route('organizations.resources.archive', [$organization, $resource]), [])
        ->assertRedirect();

    $resource->refresh();

    expect($resource->status)->toBe('archived')
        ->and($resource->archived_at)->not->toBeNull();

    expect(OrganizationResourceVersion::query()->where('organization_resource_id', $resource->id)->count())->toBe(2);

    $this->actingAs($admin)
        ->get(route('organizations.resources.index', $organization))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('organizations/resources/index')
            ->where('resources.0.version_count', 2)
            ->where('resources.0.status', 'archived'));
});

test('organization admins can publish a targeted mobile quick guide', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $jobTitle = JobTitle::factory()->create(['organization_id' => $organization->id]);
    $team = Team::factory()->create(['organization_id' => $organization->id]);
    $location = Location::factory()->create(['organization_id' => $organization->id]);
    $firstCourse = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'title' => 'Field onboarding',
        'slug' => 'field-onboarding',
        'status' => 'published',
        'published_at' => now(),
    ]);
    $secondCourse = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'title' => 'Annual field refresher',
        'slug' => 'annual-field-refresher',
        'status' => 'published',
        'published_at' => now(),
    ]);

    $this->actingAs($admin)
        ->post(route('organizations.resources.store', $organization), [
            'resource_type' => 'quick_guide',
            'title' => 'Five-Point Job Completion Check',
            'description' => 'Use before closing every work order.',
            'category' => 'Field procedures',
            'tags' => 'close job, quality, checklist',
            'featured' => true,
            'audience_everyone' => false,
            'job_title_ids' => [$jobTitle->id],
            'team_ids' => [$team->id],
            'location_ids' => [$location->id],
            'course_ids' => [$firstCourse->id, $secondCourse->id],
            'review_date' => now()->subDay()->toDateString(),
            'quick_guide_content' => [
                [
                    'id' => 'heading-1',
                    'type' => 'heading',
                    'text' => 'Before closing the work order',
                ],
                [
                    'id' => 'checklist-1',
                    'type' => 'checklist',
                    'items' => ['Confirm the work', 'Capture required photos'],
                ],
            ],
        ])
        ->assertRedirect();

    Http::assertSentCount(0);

    $resource = OrganizationResource::query()->firstOrFail();

    expect($resource->resource_type)->toBe('quick_guide')
        ->and($resource->current_version)->toBe(0)
        ->and($resource->quick_guide_content)->toHaveCount(2)
        ->and($resource->job_title_ids)->toBe([$jobTitle->id])
        ->and($resource->team_ids)->toBe([$team->id])
        ->and($resource->location_ids)->toBe([$location->id])
        ->and($resource->course_ids)->toBe([$firstCourse->id, $secondCourse->id]);

    $this->actingAs($admin)
        ->get(route('organizations.resources.index', $organization))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('resources.0.resource_type', 'quick_guide')
            ->where('resources.0.needs_review', true)
            ->where('resources.0.related_courses.1.id', $secondCourse->id)
            ->where('resources.0.job_titles.0', $jobTitle->name)
            ->where('resources.0.teams.0', $team->name)
            ->where('resources.0.locations.0', $location->name));
});

test('managers cannot access the resource portal', function () {
    $organization = Organization::factory()->create();
    $manager = User::factory()->manager($organization)->create();

    $this->actingAs($manager)
        ->get(route('organizations.resources.index', $organization))
        ->assertForbidden();
});
