<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\FormatsMobileApiResponses;
use App\Http\Requests\Settings\PasswordUpdateRequest;
use Illuminate\Http\JsonResponse;

class MePasswordController
{
    use FormatsMobileApiResponses;

    public function update(PasswordUpdateRequest $request): JsonResponse
    {
        $user = $request->user();

        $user->update([
            'password' => $request->password,
            'must_change_password' => false,
        ]);

        $user->loadMissing('organization');

        return response()->json([
            'message' => 'Password updated.',
            'user' => $this->userPayload($user),
            'organization' => $this->organizationPayload($user->organization),
            'abilities' => $this->abilitiesPayload($user, $user->organization),
        ]);
    }
}
