<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\PasswordUpdateRequest;
use App\Http\Requests\Settings\TwoFactorAuthenticationRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class SecurityController extends Controller
{
    /**
     * Show the user's security settings page.
     */
    public function edit(TwoFactorAuthenticationRequest $request): Response
    {
        return $this->renderSecurityPage(false, $request);
    }

    /**
     * Show the forced password change page for temporary logins.
     */
    public function forceEdit(TwoFactorAuthenticationRequest $request): Response
    {
        return $this->renderSecurityPage(true, $request);
    }

    /**
     * Update the user's password.
     */
    public function update(PasswordUpdateRequest $request): RedirectResponse
    {
        $requiresPasswordChange = $request->user()->requiresPasswordChange();

        $request->user()->update([
            'password' => $request->password,
            'must_change_password' => false,
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Password updated.')]);

        return $requiresPasswordChange
            ? redirect()->route('dashboard')
            : back();
    }

    private function renderSecurityPage(bool $mustChangePassword, TwoFactorAuthenticationRequest $request): Response
    {
        $props = [
            'passwordRules' => Password::defaults()->toPasswordRulesString(),
            'mustChangePassword' => $mustChangePassword,
        ];

        return Inertia::render('settings/security', $props);
    }
}
