<?php

namespace App\Console\Commands;

use App\Enums\AccountStatus;
use App\Enums\PlatformRole;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

class MakePlatformSuperAdmin extends Command
{
    protected $signature = 'platform:make-super-admin
        {email : Email address for the Eigen platform operator}
        {--name= : Full name when creating a new account}
        {--detach : Remove an existing customer organization membership}';

    protected $description = 'Create or promote an organization-less Eigen Super Admin account.';

    public function handle(): int
    {
        $email = mb_strtolower(trim((string) $this->argument('email')));
        $emailValidator = Validator::make(['email' => $email], [
            'email' => ['required', 'email'],
        ]);

        if ($emailValidator->fails()) {
            $this->error($emailValidator->errors()->first('email'));

            return self::FAILURE;
        }

        $user = User::query()->where('email', $email)->first();

        if ($user && $user->organization_id !== null && ! $this->option('detach')) {
            $this->error('This user belongs to a customer organization. Re-run with --detach only if that membership should be removed.');

            return self::FAILURE;
        }

        if (! $user) {
            $name = trim((string) ($this->option('name') ?: $this->ask('Full name')));
            $password = (string) $this->secret('Password (minimum 8 characters)');
            $passwordConfirmation = (string) $this->secret('Confirm password');

            $validator = Validator::make([
                'name' => $name,
                'password' => $password,
                'password_confirmation' => $passwordConfirmation,
            ], [
                'name' => ['required', 'string', 'max:255'],
                'password' => ['required', 'string', 'min:8', 'confirmed'],
            ]);

            if ($validator->fails()) {
                foreach ($validator->errors()->all() as $error) {
                    $this->error($error);
                }

                return self::FAILURE;
            }

            $user = User::create([
                'name' => $name,
                'email' => $email,
                'password' => $password,
                'email_verified_at' => now(),
            ]);
        }

        $user->forceFill([
            'organization_id' => null,
            'organization_role' => null,
            'platform_role' => PlatformRole::SuperAdmin,
            'account_status' => AccountStatus::Active,
            'activated_at' => $user->activated_at ?? now(),
            'email_verified_at' => $user->email_verified_at ?? now(),
            'deactivated_at' => null,
            'must_change_password' => false,
        ])->save();

        $this->info("{$user->email} is now an Eigen Super Admin.");

        return self::SUCCESS;
    }
}
