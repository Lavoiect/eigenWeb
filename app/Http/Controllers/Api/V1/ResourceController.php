<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\OrganizationRole;
use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\OrganizationResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class ResourceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user()->loadMissing('organization');
        $organization = $this->organizationOrFail($user);
        $teamIds = $user->teams()->pluck('teams.id')
            ->merge($user->managedTeams()->pluck('teams.id'))
            ->unique()
            ->values();

        $resources = OrganizationResource::query()
            ->with(['course', 'latestVersion'])
            ->where('organization_id', $organization->getKey())
            ->where('status', 'active')
            ->where(function ($query) use ($user): void {
                if ($user->isSuperAdmin() || $user->isOrganizationAdmin()) {
                    return;
                }

                $visibleRoles = $this->visibleResourceRoles($user);

                $query->whereNull('organization_role');

                if ($visibleRoles->isNotEmpty()) {
                    $query->orWhereIn('organization_role', $visibleRoles->all());
                }
            })
            ->orderByDesc('featured')
            ->orderByDesc('updated_at')
            ->get()
            ->filter(function (OrganizationResource $resource) use ($user, $teamIds): bool {
                if ($user->isSuperAdmin() || $user->isOrganizationAdmin() || $resource->audience_everyone) {
                    return true;
                }

                return in_array($user->job_title_id, $resource->job_title_ids ?? [], true)
                    || in_array($user->location_id, $resource->location_ids ?? [], true)
                    || $teamIds->intersect($resource->team_ids ?? [])->isNotEmpty();
            })
            ->map(fn (OrganizationResource $resource): array => $this->resourcePayload($resource))
            ->values();

        return response()->json([
            'resources' => $resources,
            'categories' => $resources
                ->pluck('category')
                ->filter()
                ->unique()
                ->sort()
                ->values(),
        ]);
    }

    private function organizationOrFail(User $user): Organization
    {
        abort_unless($user->organization !== null, 403, 'This account is not attached to an organization.');

        return $user->organization;
    }

    private function visibleResourceRoles(User $user): Collection
    {
        return match (true) {
            $user->isManager() => collect([
                OrganizationRole::Manager->value,
                OrganizationRole::Learner->value,
            ]),
            $user->isLearner() => collect([OrganizationRole::Learner->value]),
            default => collect(),
        };
    }

    private function resourcePayload(OrganizationResource $resource): array
    {
        $latestVersion = $resource->latestVersion;
        $resourceRole = $resource->organization_role !== null
            ? OrganizationRole::tryFrom($resource->organization_role)
            : null;

        return [
            'id' => $resource->id,
            'organization_id' => $resource->organization_id,
            'course_id' => $resource->course_id,
            'course' => $resource->course?->only(['id', 'title', 'slug', 'status', 'content_type']),
            'resource_type' => $resource->resource_type ?? 'file',
            'title' => $resource->title,
            'description' => $resource->description,
            'quick_guide_content' => $resource->quick_guide_content ?? [],
            'video_url' => $resource->video_url,
            'external_url' => $resource->external_url,
            'category' => $resource->category,
            'tags' => $resource->tags ?? [],
            'featured' => $resource->featured,
            'organization_role' => $resource->organization_role,
            'organization_role_label' => $resourceRole?->label(),
            'audience_everyone' => $resource->audience_everyone,
            'job_title_ids' => $resource->job_title_ids ?? [],
            'team_ids' => $resource->team_ids ?? [],
            'location_ids' => $resource->location_ids ?? [],
            'course_ids' => $resource->course_ids ?? ($resource->course_id ? [$resource->course_id] : []),
            'revision_date' => $resource->revision_date?->toDateString(),
            'effective_date' => $resource->effective_date?->toDateString(),
            'review_date' => $resource->review_date?->toDateString(),
            'expiration_date' => $resource->expiration_date?->toDateString(),
            'status' => $resource->status,
            'status_label' => $resource->isArchived() ? 'Archived' : 'Active',
            'archived_at' => $resource->archived_at?->toIso8601String(),
            'current_version' => $resource->current_version,
            'version_count' => $resource->versions->count(),
            'latest_version' => $latestVersion ? [
                'id' => $latestVersion->id,
                'version_number' => $latestVersion->version_number,
                'disk' => $latestVersion->disk,
                'path' => $latestVersion->path,
                'url' => $latestVersion->url,
                'original_name' => $latestVersion->original_name,
                'mime_type' => $latestVersion->mime_type,
                'size_bytes' => $latestVersion->size_bytes,
                'created_at' => $latestVersion->created_at?->toIso8601String(),
            ] : null,
            'created_by' => $resource->creator?->only('id', 'name', 'email'),
            'updated_by' => $resource->updater?->only('id', 'name', 'email'),
            'created_at' => $resource->created_at?->toIso8601String(),
            'updated_at' => $resource->updated_at?->toIso8601String(),
        ];
    }
}
