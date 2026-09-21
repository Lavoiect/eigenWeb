<?php

namespace App\Providers;

use App\Models\Course;
use App\Models\CourseReview;
use App\Models\Lesson;
use App\Models\Organization;
use App\Models\Team;
use App\Policies\CoursePolicy;
use App\Policies\CourseReviewPolicy;
use App\Policies\LessonPolicy;
use App\Policies\OrganizationPolicy;
use App\Policies\TeamPolicy;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\DevCommands;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        DevCommands::artisan('queue:listen --tries=3 --timeout=0', 'queue')->green();
        DevCommands::artisan('schedule:work', 'scheduler')->purple();
        $this->configureDefaults();
        $this->configureAuthorization();
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }

    protected function configureAuthorization(): void
    {
        Gate::policy(Organization::class, OrganizationPolicy::class);
        Gate::policy(Course::class, CoursePolicy::class);
        Gate::policy(CourseReview::class, CourseReviewPolicy::class);
        Gate::policy(Lesson::class, LessonPolicy::class);
        Gate::policy(Team::class, TeamPolicy::class);
    }
}
