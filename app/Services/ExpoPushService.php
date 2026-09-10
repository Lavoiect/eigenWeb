<?php

namespace App\Services;

use App\Models\PushDevice;
use App\Models\User;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ExpoPushService
{
    /**
     * @param iterable<User> $users
     */
    public function sendToUsers(iterable $users, string $title, string $body, array $data = []): void
    {
        $userIds = collect($users)
            ->filter()
            ->map(fn (User $user): int => $user->getKey())
            ->unique()
            ->values();

        if ($userIds->isEmpty()) {
            return;
        }

        $tokens = PushDevice::query()
            ->whereIn('user_id', $userIds->all())
            ->where('enabled', true)
            ->pluck('expo_push_token')
            ->unique()
            ->values();

        if ($tokens->isEmpty()) {
            return;
        }

        collect($tokens)
            ->chunk(100)
            ->each(function (Collection $chunk) use ($title, $body, $data): void {
                $messages = $chunk->map(fn (string $token): array => [
                    'to' => $token,
                    'sound' => 'default',
                    'title' => $title,
                    'body' => $body,
                    'data' => $data,
                    'priority' => 'high',
                ])->all();

                try {
                    $response = Http::timeout(10)->post('https://exp.host/--/api/v2/push/send', $messages);

                    if (! $response->successful()) {
                        Log::warning('Expo push notification request failed.', [
                            'status' => $response->status(),
                            'body' => $response->body(),
                        ]);
                    }
                } catch (ConnectionException $exception) {
                    Log::warning('Expo push notification request could not connect.', [
                        'message' => $exception->getMessage(),
                    ]);
                }
            });
    }
}
