<?php

namespace App\Services;

use App\Models\OutreachLead;

class OutreachPersonalization
{
    public function render(string $content, OutreachLead $lead): string
    {
        return strtr($content, [
            '{{first_name}}' => $lead->first_name ?? '',
            '{{last_name}}' => $lead->last_name ?? '',
            '{{company}}' => $lead->company ?? '',
            '{{job_title}}' => $lead->job_title ?? '',
            '{{city}}' => $lead->city ?? '',
            '{{industry}}' => $lead->industry ?? '',
            '{{custom_1}}' => $lead->custom_1 ?? '',
        ]);
    }
}
