<?php

namespace App\Actions\Fortify;

use App\Concerns\PasswordValidationRules;
use App\Concerns\ProfileValidationRules;
use App\Enums\OrganizationRole;
use App\Models\OrganizationInvitation;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Contracts\CreatesNewUsers;

class CreateNewUser implements CreatesNewUsers
{
    use PasswordValidationRules, ProfileValidationRules;

    /**
     * Validate and create a newly registered user.
     *
     * @param  array<string, string>  $input
     */
    public function create(array $input): User
    {
        Validator::make($input, [
            ...$this->profileRules(),
            'password' => $this->passwordRules(),
            'invite_token' => ['required', 'string'],
        ])->validate();

        return DB::transaction(function () use ($input): User {
            $user = User::create([
                'name' => $input['name'],
                'email' => Str::lower($input['email']),
                'password' => $input['password'],
                'organization_role' => OrganizationRole::Learner,
            ]);

            $invitation = OrganizationInvitation::query()
                ->where('token', $input['invite_token'])
                ->whereNull('accepted_at')
                ->whereNull('revoked_at')
                ->first();

            if (! $invitation || $invitation->isExpired()) {
                throw ValidationException::withMessages([
                    'invite_token' => 'This invitation is no longer valid.',
                ]);
            }

            if (Str::lower($user->email) !== $invitation->email) {
                throw ValidationException::withMessages([
                    'email' => 'This invitation was sent to a different email address.',
                ]);
            }

            $user->forceFill([
                'organization_id' => $invitation->organization_id,
                'organization_role' => $invitation->organization_role,
            ])->save();

            $invitation->accept($user);

            return $user;
        });
    }
}
