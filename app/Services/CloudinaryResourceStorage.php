<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

class CloudinaryResourceStorage
{
    /**
     * @return array{disk:string,path:string,url:string,original_name:string,mime_type:string|null,size_bytes:int|null,public_id:string}
     */
    public function upload(UploadedFile $file, string $folder, string $publicId): array
    {
        $cloudName = config('services.cloudinary.cloud_name');
        $apiKey = config('services.cloudinary.api_key');
        $apiSecret = config('services.cloudinary.api_secret');

        if ($cloudName === null || $apiKey === null || $apiSecret === null) {
            throw new RuntimeException('Cloudinary is not configured.');
        }

        $timestamp = now()->timestamp;
        $uploadParameters = [
            'folder' => $folder,
            'public_id' => $publicId,
            'resource_type' => 'auto',
            'timestamp' => $timestamp,
        ];

        $signature = $this->signature($uploadParameters, $apiSecret);
        $fileContents = file_get_contents($file->getRealPath());

        if ($fileContents === false) {
            throw new RuntimeException('Unable to read the uploaded file.');
        }

        $response = Http::attach(
            'file',
            $fileContents,
            $file->getClientOriginalName(),
        )->post(
            sprintf('https://api.cloudinary.com/v1_1/%s/auto/upload', $cloudName),
            [
                ...$uploadParameters,
                'api_key' => $apiKey,
                'signature' => $signature,
            ],
        );

        $response->throw();

        $payload = $response->json();
        $secureUrl = $payload['secure_url'] ?? $payload['url'] ?? null;

        if (! is_string($secureUrl) || $secureUrl === '') {
            throw new RuntimeException('Cloudinary did not return a file URL.');
        }

        return [
            'disk' => 'cloudinary',
            'path' => (string) ($payload['public_id'] ?? $publicId),
            'url' => $secureUrl,
            'original_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType(),
            'size_bytes' => $file->getSize() !== false ? $file->getSize() : null,
            'public_id' => (string) ($payload['public_id'] ?? $publicId),
        ];
    }

    /**
     * @param array<string, int|string|bool|null> $parameters
     */
    private function signature(array $parameters, string $apiSecret): string
    {
        $filtered = collect($parameters)
            ->reject(static fn ($value, string $key): bool => in_array($key, ['file', 'api_key', 'signature', 'resource_type'], true) || $value === null || $value === '')
            ->sortKeys()
            ->map(fn ($value, string $key): string => $key.'='.$value)
            ->implode('&');

        return sha1($filtered.$apiSecret);
    }
}
