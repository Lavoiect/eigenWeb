<?php

namespace App\Services;

use Illuminate\Support\Str;

class MicrolearningStarterTemplate
{
    public function defaultTemplateKey(): string
    {
        return 'quick_policy_refresher';
    }

    /**
     * @return array<string, array{label:string,description:string,duration_minutes:int,blocks:array<int, array<string, mixed>>}>
     */
    public function templates(): array
    {
        return [
            'quick_policy_refresher' => [
                'label' => 'Quick policy refresher',
                'description' => 'A fast compliance lesson with one reminder and one check.',
                'duration_minutes' => 5,
                'blocks' => [
                    [
                        'type' => 'text',
                        'text' => 'Keep this lesson focused on one policy update, one reminder, or one behavior.',
                    ],
                    [
                        'type' => 'multiple_choice',
                        'prompt' => 'What should you do when policy changes?',
                        'choices' => [
                            'Follow the updated guidance and ask if anything is unclear',
                            'Keep using the old process until someone complains',
                            'Ignore the change if the old way feels faster',
                        ],
                        'correct_index' => 0,
                        'correct_feedback' => 'Correct. Policy refreshers should reinforce the current standard.',
                        'incorrect_feedback' => 'The safest choice is to follow the updated guidance and clarify questions early.',
                    ],
                ],
            ],
            'sop_reminder' => [
                'label' => 'SOP reminder',
                'description' => 'A short process lesson that reinforces the right sequence.',
                'duration_minutes' => 7,
                'blocks' => [
                    [
                        'type' => 'text',
                        'text' => 'Use this template to remind teams of the exact steps in a standard operating procedure.',
                    ],
                    [
                        'type' => 'ordering',
                        'prompt' => 'Put the SOP steps in order',
                        'items' => [
                            'Prepare the workspace',
                            'Complete the task',
                            'Check the result',
                            'Reset for the next person',
                        ],
                    ],
                ],
            ],
            'new_hire_onboarding_nugget' => [
                'label' => 'New hire onboarding nugget',
                'description' => 'A friendly first-week lesson for new teammates.',
                'duration_minutes' => 5,
                'blocks' => [
                    [
                        'type' => 'text',
                        'text' => 'Teach one thing every new teammate should know on day one.',
                    ],
                    [
                        'type' => 'true_false',
                        'statement' => 'New hires should know where to find SOPs and who to ask for help.',
                        'correct_answer' => true,
                        'correct_feedback' => 'Correct. Clear support paths make onboarding feel safe and simple.',
                        'incorrect_feedback' => 'New hires should not be left guessing where to find help.',
                    ],
                ],
            ],
        ];
    }

    /**
     * @return array<int, array{
     *     key:string,
     *     label:string,
     *     description:string,
     *     duration_minutes:int,
     *     activity_count:int,
     *     block_types:array<int, string>
     * }>
     */
    public function options(): array
    {
        return collect($this->templates())
            ->map(fn (array $template, string $key): array => [
                'key' => $key,
                'label' => $template['label'],
                'description' => $template['description'],
                'duration_minutes' => $template['duration_minutes'],
                'activity_count' => count($template['blocks']),
                'block_types' => array_values(array_map(
                    fn (array $block): string => $block['type'],
                    $template['blocks'],
                )),
            ])
            ->values()
            ->all();
    }

    /**
     * @return array{label:string,description:string,duration_minutes:int,blocks:array<int, array<string, mixed>>}
     */
    public function template(?string $key = null): array
    {
        $templates = $this->templates();
        $resolvedKey = array_key_exists($key ?? '', $templates)
            ? $key
            : $this->defaultTemplateKey();

        return $templates[$resolvedKey];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function blocks(?string $key = null): array
    {
        return $this->instantiateBlocks($this->template($key)['blocks']);
    }

    public function title(?string $key = null): string
    {
        return $this->template($key)['label'];
    }

    public function slug(?string $key = null): string
    {
        return $key && array_key_exists($key, $this->templates())
            ? $key
            : $this->defaultTemplateKey();
    }

    public function durationMinutes(?string $key = null): int
    {
        return $this->template($key)['duration_minutes'];
    }

    /**
     * @param  array<int, array<string, mixed>>  $blocks
     * @return array<int, array<string, mixed>>
     */
    private function instantiateBlocks(array $blocks): array
    {
        return collect($blocks)
            ->map(function (array $block): array {
                $block['id'] = Str::uuid()->toString();

                return $block;
            })
            ->values()
            ->all();
    }
}
