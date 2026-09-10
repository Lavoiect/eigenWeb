<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\FormatsMobileApiResponses;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

class AuthTokenController
{
    use FormatsMobileApiResponses;

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:255'],
        ]);

        $user = User::query()
            ->where('email', Str::lower($validated['email']))
            ->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => 'The provided credentials are incorrect.',
            ]);
        }

        if (! $user->canLogin()) {
            throw ValidationException::withMessages([
                'email' => 'This account has been deactivated.',
            ]);
        }

        if ($user->organization_id === null) {
            throw ValidationException::withMessages([
                'email' => 'This account is not attached to an organization yet.',
            ]);
        }

        $tokenName = trim((string) ($validated['device_name'] ?? 'mobile'));
        $token = $user->createToken($tokenName === '' ? 'mobile' : $tokenName, ['mobile-api']);

        return response()->json([
            'token_type' => 'Bearer',
            'token' => $token->plainTextToken,
            'user' => $this->userPayload($user->loadMissing('organization')),
            'organization' => $this->organizationPayload($user->organization),
            'abilities' => $this->abilitiesPayload($user, $user->organization),
        ], 201);
    }

    public function destroy(Request $request): Response
    {
        $token = $request->user()?->currentAccessToken();

        abort_unless($token, 400, 'This endpoint requires a personal access token.');

        $token->delete();

        return response()->noContent();
    }
}
