<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\FormatsLearningApiResponses;
use App\Http\Controllers\Controller;
use App\Models\CourseProgress;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProgressController extends Controller
{
    use FormatsLearningApiResponses;

    public function index(Request $request): JsonResponse
    {
        $user = $request->user()->loadMissing('organization');
        $this->assertContentContext($user);

        $progress = CourseProgress::query()
            ->with(['course.pathway', 'lastCompletedLesson'])
            ->where('user_id', $user->getKey())
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (CourseProgress $record): array => [
                ...$this->progressPayload($record),
                'course' => $this->coursePayload($record->course, $record),
            ]);

        return response()->json([
            'progress' => $progress,
        ]);
    }

    private function assertContentContext(User $user): void
    {
        abort_unless(
            $user->isSuperAdmin() || $user->organization_id !== null,
            403,
            'This account is not attached to an organization.',
        );
    }
}
