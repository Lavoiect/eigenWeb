<?php

namespace App\Http\Controllers;

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use App\Notifications\OrganizationInvitationNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class OrganizationInvitationController extends Controller
{
    public function index(Organization $organization): Response
    {
        $this->authorize('inviteMembers', $organization);

        $invitations = $organization->invitations()
            ->with(['invitedBy', 'acceptedBy'])
            ->latest()
            ->get()
            ->map(fn (OrganizationInvitation $invite): array => [
                'id' => $invite->id,
                'email' => $invite->email,
                'organization_role' => $invite->organization_role->value,
                'organization_role_label' => $invite->organization_role->label(),
                'status' => $invite->status(),
                'status_label' => $invite->statusLabel(),
                'token' => $invite->token,
                'invite_url' => route('invitations.show', ['invite' => $invite->token]),
                'created_at' => $invite->created_at?->toIso8601String(),
                'expires_at' => $invite->expires_at?->toIso8601String(),
                'accepted_at' => $invite->accepted_at?->toIso8601String(),
                'revoked_at' => $invite->revoked_at?->toIso8601String(),
                'invited_by' => $invite->invitedBy?->only('id', 'name', 'email'),
                'accepted_by' => $invite->acceptedBy?->only('id', 'name', 'email'),
            ]);

        return Inertia::render('organizations/invitations/index', [
            'organization' => $organization->only(['id', 'name', 'slug']),
            'invitations' => $invitations,
        ]);
    }

    public function store(Request $request, Organization $organization): RedirectResponse|JsonResponse
    {
        $this->authorize('inviteMembers', $organization);

        $role = $request->input('organization_role');

        $rules = [
            'name' => ['nullable', 'string', 'max:255'],
            'email' => ['required', 'email'],
            'organization_role' => ['required', 'in:'.implode(',', [
                OrganizationRole::OrganizationAdmin->value,
                OrganizationRole::Manager->value,
                OrganizationRole::Learner->value,
            ])],
        ];

        $rules['email'][] = Rule::unique('users', 'email');

        if ($role === OrganizationRole::Learner->value) {
            $rules['temporary_password'] = ['required', 'string', 'min:8'];
        }

        $validated = $request->validate($rules);

        $email = Str::lower($validated['email']);
        $existingInvitation = $organization->invitations()
            ->where('email', $email)
            ->whereNull('accepted_at')
            ->whereNull('revoked_at')
            ->latest()
            ->first();

        if ($validated['organization_role'] !== OrganizationRole::Learner->value
            && $existingInvitation?->isPending()) {
            throw ValidationException::withMessages([
                'email' => 'A pending invitation already exists for this email address.',
            ]);
        }

        if ($existingInvitation?->isExpired()) {
            $existingInvitation->forceFill(['revoked_at' => now()])->save();
        }

        if ($validated['organization_role'] === OrganizationRole::Learner->value) {
            $user = DB::transaction(function () use ($organization, $validated, $email): User {
                $user = User::create([
                    'name' => filled($validated['name'] ?? null)
                        ? $validated['name']
                        : Str::headline(Str::before($email, '@')),
                    'email' => $email,
                    'password' => $validated['temporary_password'],
                    'organization_id' => $organization->getKey(),
                    'organization_role' => OrganizationRole::Learner,
                    'account_status' => 'active',
                    'activated_at' => now(),
                    'must_change_password' => true,
                ])->forceFill([
                    'email_verified_at' => now(),
                ]);

                $user->save();

                OrganizationInvitation::query()
                    ->where('organization_id', $organization->getKey())
                    ->where('email', $email)
                    ->whereNull('accepted_at')
                    ->whereNull('revoked_at')
                    ->update(['revoked_at' => now()]);

                return $user;
            });

            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'Learner login created.',
                    'user' => $user->only(['id', 'name', 'email']),
                ], 201);
            }

            Inertia::flash('toast', [
                'type' => 'success',
                'message' => 'Learner login created.',
            ]);

            return back();
        }

        $invitation = $organization->invitations()->create([
            'invited_by_id' => $request->user()->getKey(),
            'email' => $email,
            'organization_role' => $validated['organization_role'],
            'token' => Str::uuid()->toString(),
            'expires_at' => now()->addDays(14),
        ]);

        Notification::route('mail', $invitation->email)
            ->notify(new OrganizationInvitationNotification($invitation));

        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'Invitation sent.',
                'invite_url' => route('invitations.show', ['invite' => $invitation->token]),
            ], 201);
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Invitation sent.',
        ]);

        return back();
    }

    public function destroy(Request $request, Organization $organization, OrganizationInvitation $invite): RedirectResponse|JsonResponse
    {
        $this->authorize('inviteMembers', $organization);

        abort_unless($invite->organization_id === $organization->getKey(), 404);

        if ($invite->accepted_at !== null || $invite->revoked_at !== null) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'Invitation cannot be revoked.',
                ], 422);
            }

            Inertia::flash('toast', [
                'type' => 'error',
                'message' => 'Invitation cannot be revoked.',
            ]);

            return back();
        }

        $invite->forceFill([
            'revoked_at' => now(),
        ])->save();

        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'Invitation revoked.',
            ]);
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Invitation revoked.',
        ]);

        return back();
    }

    public function show(Request $request, OrganizationInvitation $invite): RedirectResponse|Response
    {
        if (! $invite->isPending()) {
            abort(404);
        }

        if ($request->user()) {
            if (Str::lower($request->user()->email) !== $invite->email) {
                return Inertia::render('auth/invitation-account-conflict', [
                    'organization' => $invite->organization->only(['name']),
                    'invitation' => [
                        'email' => $invite->email,
                        'role_label' => $invite->organization_role->label(),
                        'switch_url' => route('invitations.switch-account', $invite),
                    ],
                    'currentUser' => $request->user()->only(['name', 'email']),
                ]);
            }

            $this->accept($request, $invite);

            return redirect()->route('dashboard');
        }

        return redirect()->route('register', [
            'invite' => $invite->token,
            'email' => $invite->email,
        ]);
    }

    public function switchAccount(Request $request, OrganizationInvitation $invite): RedirectResponse
    {
        abort_unless($invite->isPending(), 404);

        if ($request->user()
            && Str::lower($request->user()->email) === $invite->email) {
            return $this->accept($request, $invite);
        }

        if ($request->user()) {
            Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return redirect()->route('register', [
            'invite' => $invite->token,
            'email' => $invite->email,
        ]);
    }

    public function accept(Request $request, OrganizationInvitation $invite): RedirectResponse
    {
        abort_unless($request->user(), 403);

        abort_unless($invite->isPending(), 404);
        abort_unless(Str::lower($request->user()->email) === $invite->email, 403);

        $user = $request->user();

        $user->forceFill([
            'organization_id' => $invite->organization_id,
            'organization_role' => $invite->organization_role,
        ])->save();

        $invite->accept($user);

        return redirect()->route('dashboard');
    }
}
