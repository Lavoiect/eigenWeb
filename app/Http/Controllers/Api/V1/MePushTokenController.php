<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PushDevice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MePushTokenController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'expo_push_token' => ['required', 'string', 'max:255'],
            'platform' => ['nullable', 'string', 'max:50'],
            'device_name' => ['nullable', 'string', 'max:255'],
        ]);

        PushDevice::query()->updateOrCreate(
            ['expo_push_token' => $validated['expo_push_token']],
            [
                'user_id' => $user->getKey(),
                'platform' => $validated['platform'] ?? null,
                'device_name' => $validated['device_name'] ?? null,
                'enabled' => true,
                'last_registered_at' => now(),
            ],
        );

        return response()->json([
            'message' => 'Push token saved.',
        ]);
    }
}
