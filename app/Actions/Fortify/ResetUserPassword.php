<?php

namespace App\Actions\Fortify;

use App\Concerns\PasswordValidationRules;
use App\Enums\AccountStatus;
use App\Models\User;
use Illuminate\Support\Facades\Validator;
use Laravel\Fortify\Contracts\ResetsUserPasswords;

class ResetUserPassword implements ResetsUserPasswords
{
    use PasswordValidationRules;

    /**
     * Validate and reset the user's forgotten password.
     *
     * @param  array<string, string>  $input
     */
    public function reset(User $user, array $input): void
    {
        Validator::make($input, [
            'password' => $this->passwordRules(),
        ])->validate();

        $attributes = ['password' => $input['password']];

        if ($user->account_status === AccountStatus::Pending) {
            $attributes = [
                ...$attributes,
                'account_status' => AccountStatus::Active,
                'activated_at' => $user->activated_at ?? now(),
                'email_verified_at' => $user->email_verified_at ?? now(),
            ];
        }

        $user->forceFill($attributes)->save();
    }
}
