<?php

namespace App\Console\Commands;

use App\Services\OutreachBirdService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use RuntimeException;
use Throwable;

class ConfigureBirdWebhook extends Command
{
    protected $signature = 'outreach:configure-bird-webhook
        {--url= : Public webhook URL; defaults to APP_URL/webhooks/bird}
        {--no-write : Print the signing secret instead of saving it to .env}
        {--skip-test : Create or update the webhook without sending a test event}';

    protected $description = 'Create or update the Bird webhook used by Eigen outreach campaigns.';

    public function handle(OutreachBirdService $bird): int
    {
        if (blank(config('services.bird.api_key'))) {
            $this->error('BIRD_API_KEY is missing. Add it to .env, then run php artisan optimize:clear.');

            return self::FAILURE;
        }

        $url = trim((string) ($this->option('url') ?: rtrim((string) config('app.url'), '/').'/webhooks/bird'));

        if (! filter_var($url, FILTER_VALIDATE_URL) || ! str_starts_with($url, 'https://')) {
            $this->error('The Bird webhook URL must be a public HTTPS URL.');

            return self::FAILURE;
        }

        try {
            $existing = collect($bird->webhooks())->firstWhere('url', $url);

            if (is_array($existing) && filled($existing['id'] ?? null)) {
                $webhookId = (string) $existing['id'];
                $bird->updateWebhook($webhookId, $url);
                $secret = filled(config('services.bird.webhook_secret'))
                    ? (string) config('services.bird.webhook_secret')
                    : $bird->rotateWebhookSecret($webhookId);
                $this->info("Updated Bird webhook {$webhookId}.");
            } else {
                $created = $bird->createWebhook($url);
                $webhookId = (string) $created['id'];
                $secret = (string) $created['secret'];
                $this->info("Created Bird webhook {$webhookId}.");
            }

            if ($this->option('no-write')) {
                $this->warn('Add this value to the application environment:');
                $this->line('BIRD_WEBHOOK_SECRET='.$secret);
            } else {
                $this->writeEnvironmentSecret($secret);
                config(['services.bird.webhook_secret' => $secret]);
                Artisan::call('config:clear');
                $this->info('Saved BIRD_WEBHOOK_SECRET to .env and cleared the configuration cache.');
            }

            if (! $this->option('skip-test')) {
                $result = $bird->testWebhook($webhookId);
                $status = (string) ($result['status'] ?? 'unknown');
                $this->line("Bird webhook test status: {$status}");
            }

            $this->newLine();
            $this->info('Bird webhook setup is complete.');

            return self::SUCCESS;
        } catch (Throwable $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }
    }

    private function writeEnvironmentSecret(string $secret): void
    {
        $path = base_path('.env');
        $contents = file_get_contents($path);

        if ($contents === false) {
            throw new RuntimeException('The application .env file could not be read.');
        }

        $line = 'BIRD_WEBHOOK_SECRET="'.addcslashes($secret, '"\\').'"';
        $pattern = '/^BIRD_WEBHOOK_SECRET=.*$/m';

        if (preg_match($pattern, $contents) === 1) {
            $updated = preg_replace($pattern, $line, $contents);
        } else {
            $updated = rtrim($contents).PHP_EOL.$line.PHP_EOL;
        }

        if (! is_string($updated) || file_put_contents($path, $updated) === false) {
            throw new RuntimeException('The Bird webhook secret could not be saved to .env.');
        }
    }
}
