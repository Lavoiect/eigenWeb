<?php

namespace App\Http\Controllers\Api\V1;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Fortify;

class AuthPasswordResetLinkController
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            Fortify::email() => ['required', 'email'],
        ]);

        $status = Password::broker(config('fortify.passwords'))->sendResetLink([
            Fortify::email() => $validated[Fortify::email()],
        ]);

        if ($status !== Password::RESET_LINK_SENT) {
            throw ValidationException::withMessages([
                Fortify::email() => 'We could not send a reset link right now. Try again in a moment.',
            ]);
        }

        return response()->json([
            'message' => 'If an account exists for that email, a password reset link has been sent.',
        ]);
    }
}
