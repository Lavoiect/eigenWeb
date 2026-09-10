<?php

namespace App\Http\Controllers;

use App\Enums\AccountStatus;
use App\Enums\OrganizationRole;
use App\Enums\OrganizationStatus;
use App\Models\Organization;
use App\Models\User;
use App\Services\CloudinaryResourceStorage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class PlatformOrganizationController extends Controller
{
    public function index(Request $request): Response
    {
        $organizations = Organization::query()
            ->withCount([
                'users',
                'courses',
                'pathways',
                'resources',
                'users as learner_count' => fn ($query) => $query->where('organization_role', OrganizationRole::Learner->value),
            ])
            ->with(['users' => fn ($query) => $query
                ->where('organization_role', OrganizationRole::OrganizationAdmin->value)
                ->orderBy('name')])
            ->orderBy('name')
            ->get()
            ->map(fn (Organization $organization): array => [
                'id' => $organization->id,
                'name' => $organization->name,
                'slug' => $organization->slug,
                'logo_url' => $organization->logo_url,
                'status' => $organization->status->value,
                'status_label' => $organization->status->label(),
                'user_count' => $organization->users_count,
                'learner_count' => $organization->learner_count,
                'course_count' => $organization->courses_count,
                'pathway_count' => $organization->pathways_count,
                'resource_count' => $organization->resources_count,
                'updated_at' => $organization->updated_at?->toIso8601String(),
                'administrators' => $organization->users->map(fn (User $user): array => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'account_status' => $user->account_status->value,
                    'account_status_label' => $user->account_status->label(),
                ])->values(),
            ])
            ->values();

        return Inertia::render('platform/organizations/index', [
            'organizations' => $organizations,
            'managedOrganizationId' => (int) $request->session()->get('managed_organization_id') ?: null,
        ]);
    }

    public function store(
        Request $request,
        CloudinaryResourceStorage $storage,
    ): RedirectResponse {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:120', 'alpha_dash', Rule::unique('organizations', 'slug')],
            'logo' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ]);

        $name = Str::squish($validated['name']);
        $baseSlug = filled($validated['slug'] ?? null)
            ? Str::lower($validated['slug'])
            : Str::slug($name);
        $slug = $baseSlug;
        $suffix = 2;

        while (Organization::query()->where('slug', $slug)->exists()) {
            $slug = $baseSlug.'-'.$suffix;
            $suffix++;
        }

        $logoUrl = null;
        $logo = $request->file('logo');

        if ($logo instanceof UploadedFile) {
            try {
                $upload = $storage->upload(
                    $logo,
                    'company_logos',
                    $slug.'-'.Str::lower(Str::random(12)),
                );
                $logoUrl = $upload['url'];
            } catch (\Throwable $exception) {
                report($exception);

                throw ValidationException::withMessages([
                    'logo' => 'The logo could not be uploaded. Please try again.',
                ]);
            }
        }

        Organization::create([
            'created_by_id' => $request->user()->getKey(),
            'name' => $name,
            'slug' => $slug,
            'logo_url' => $logoUrl,
            'status' => OrganizationStatus::Setup,
        ]);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Organization created and ready for setup.',
        ]);

        return back();
    }

    public function manage(Request $request, Organization $organization): RedirectResponse
    {
        $request->session()->put('managed_organization_id', $organization->getKey());

        return redirect()->route('dashboard');
    }

    public function exit(Request $request): RedirectResponse
    {
        $request->session()->forget('managed_organization_id');

        return redirect()->route('platform.organizations.index');
    }

    public function updateStatus(Request $request, Organization $organization): RedirectResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::enum(OrganizationStatus::class)],
        ]);
        $status = OrganizationStatus::from($validated['status']);

        $organization->forceFill([
            'status' => $status,
            'suspended_at' => $status === OrganizationStatus::Suspended ? now() : null,
        ])->save();

        if ($status === OrganizationStatus::Suspended
            && (int) $request->session()->get('managed_organization_id') === $organization->getKey()) {
            $request->session()->forget('managed_organization_id');
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Organization status updated.',
        ]);

        return back();
    }

    public function storeAdministrator(Request $request, Organization $organization): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', Rule::unique('users', 'email')],
        ]);

        $user = User::create([
            'name' => Str::squish($validated['name']),
            'email' => Str::lower($validated['email']),
            'password' => Str::random(64),
            'organization_id' => $organization->getKey(),
            'organization_role' => OrganizationRole::OrganizationAdmin,
            'account_status' => AccountStatus::Pending,
        ]);

        Password::sendResetLink(['email' => $user->email]);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Administrator created. The activation email has been sent.',
        ]);

        return back();
    }

    public function resendActivation(Organization $organization, User $user): RedirectResponse
    {
        abort_unless($user->organization_id === $organization->getKey(), 404);
        abort_unless($user->organization_role === OrganizationRole::OrganizationAdmin, 404);
        abort_unless($user->account_status === AccountStatus::Pending, 422);

        Password::sendResetLink(['email' => $user->email]);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Activation email sent again.',
        ]);

        return back();
    }
}
