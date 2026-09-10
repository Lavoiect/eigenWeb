import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    BarChart3,
    BellRing,
    Check,
    CheckCircle2,
    ChevronRight,
    CirclePlay,
    ClipboardCheck,
    FileText,
    Layers3,
    Search,
    Smartphone,
    Sparkles,
    Waypoints,
} from 'lucide-react';

import AppLogoIcon from '@/components/app-logo-icon';
import { Button } from '@/components/ui/button';
import { dashboard, login, register } from '@/routes';

type PageProps = {
    auth: {
        user: unknown | null;
    };
};

const platformFeatures = [
    {
        icon: Smartphone,
        title: 'Mobile-first training',
        description:
            'Give frontline employees a focused learning experience built for the device already in their pocket.',
    },
    {
        icon: Waypoints,
        title: 'Role-based pathways',
        description:
            'Automatically guide each employee through the right training for their job title, team, or location.',
    },
    {
        icon: ClipboardCheck,
        title: 'Courses and assessments',
        description:
            'Deliver full courses, quick microlearning, knowledge checks, and scored final assessments.',
    },
    {
        icon: FileText,
        title: 'Resources on demand',
        description:
            'Keep procedures, job aids, checklists, and videos searchable and current in one mobile resource portal.',
    },
    {
        icon: BarChart3,
        title: 'Reporting that drives action',
        description:
            'See completion, overdue training, assessment performance, and knowledge gaps without digging through exports.',
    },
    {
        icon: BellRing,
        title: 'Assignments and reminders',
        description:
            'Assign required training, set due dates, schedule recurrence, and keep learners moving with reminders.',
    },
];

const managedServices = [
    'Turn your procedures and expertise into clear, practical training',
    'Build courses, assessments, pathways, and mobile resources for you',
    'Organize learners, assignments, reporting, and ongoing updates',
    'Keep the LMS useful as your roles, teams, and procedures change',
];

const processSteps = [
    {
        number: '01',
        title: 'We learn your operation',
        description:
            'You bring the procedures, goals, and subject-matter expertise. We identify what each role needs to know and do.',
    },
    {
        number: '02',
        title: 'We build the experience',
        description:
            'Eigen turns that knowledge into courses, microlearning, assessments, pathways, and mobile-ready resources.',
    },
    {
        number: '03',
        title: 'Your team trains anywhere',
        description:
            'Employees sign in, complete assigned training, find procedures, and pick up where they left off from their phone.',
    },
    {
        number: '04',
        title: 'We help keep it working',
        description:
            'Managers get clear reporting while Eigen helps maintain the platform and improve training over time.',
    },
];

export default function Welcome() {
    const { auth } = usePage<PageProps>().props;
    const isSignedIn = Boolean(auth.user);

    return (
        <>
            <Head title="Mobile-first workforce training">
                <meta
                    name="description"
                    content="Eigen Learning combines a mobile-first LMS with course creation and LMS management for companies without an in-house training team."
                />
            </Head>

            <style>{`
                @keyframes eigen-rise {
                    from { opacity: 0; transform: translateY(18px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes eigen-float {
                    0%, 100% { transform: translateY(0) rotate(1.5deg); }
                    50% { transform: translateY(-8px) rotate(0.5deg); }
                }
                @media (prefers-reduced-motion: reduce) {
                    .eigen-rise, .eigen-float { animation: none !important; }
                }
            `}</style>

            <div className="min-h-screen overflow-hidden bg-[#f4f3ed] font-sans text-[#11251e] selection:bg-[#d8ff68] selection:text-[#11251e]">
                <a
                    href="#main-content"
                    className="sr-only z-50 rounded-md bg-white px-4 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
                >
                    Skip to content
                </a>

                <header className="relative z-40 border-b border-[#173c2f]/10 bg-[#f4f3ed]/90 backdrop-blur-xl">
                    <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
                        <Link
                            href="/"
                            className="flex items-center gap-3"
                            aria-label="Eigen Learning home"
                        >
                            <span className="flex size-10 items-center justify-center rounded-xl bg-[#123d31] text-[#dfff72] shadow-[0_8px_24px_rgba(18,61,49,0.18)]">
                                <AppLogoIcon className="size-6 fill-current" />
                            </span>
                            <span>
                                <span className="block text-base leading-none font-bold tracking-[-0.02em]">
                                    Eigen
                                </span>
                                <span className="mt-1 block text-[0.66rem] leading-none font-semibold tracking-[0.17em] text-[#4f675e] uppercase">
                                    Learning
                                </span>
                            </span>
                        </Link>

                        <nav
                            className="hidden items-center gap-8 text-sm font-medium text-[#486057] md:flex"
                            aria-label="Main navigation"
                        >
                            <a
                                href="#platform"
                                className="transition-colors hover:text-[#11251e]"
                            >
                                Platform
                            </a>
                            <a
                                href="#managed-service"
                                className="transition-colors hover:text-[#11251e]"
                            >
                                Managed training
                            </a>
                            <a
                                href="#how-it-works"
                                className="transition-colors hover:text-[#11251e]"
                            >
                                How it works
                            </a>
                        </nav>

                        <div className="flex items-center gap-2 sm:gap-3">
                            {isSignedIn ? (
                                <Button
                                    asChild
                                    className="h-11 rounded-full bg-[#123d31] px-5 text-white hover:bg-[#0d3026]"
                                >
                                    <Link href={dashboard()}>
                                        Dashboard
                                        <ArrowRight className="size-4" />
                                    </Link>
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        asChild
                                        variant="ghost"
                                        className="hidden rounded-full text-[#27473b] hover:bg-[#173c2f]/5 sm:inline-flex"
                                    >
                                        <Link href={login()}>Log in</Link>
                                    </Button>
                                    <Button
                                        asChild
                                        className="h-11 rounded-full bg-[#123d31] px-5 text-white hover:bg-[#0d3026]"
                                    >
                                        <Link href={register()}>
                                            Get started
                                            <ArrowRight className="size-4" />
                                        </Link>
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                <main id="main-content">
                    <section className="relative overflow-hidden border-b border-[#173c2f]/10">
                        <div className="absolute -top-48 right-[-10rem] h-[48rem] w-[48rem] rounded-full bg-[#dfff72]/30 blur-2xl" />
                        <div className="absolute top-10 right-[-2rem] h-[43rem] w-[43rem] rounded-full border border-white/40 bg-[#d9efcf]/35" />
                        <div className="absolute right-[-12rem] bottom-[-20rem] h-[40rem] w-[62rem] -rotate-12 bg-[#92cdb5]/25 blur-2xl" />
                        <div className="absolute bottom-0 left-0 h-72 w-72 -translate-x-1/2 translate-y-1/3 rounded-full bg-[#8fc9b2]/25 blur-3xl" />

                        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-16 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:py-[4.25rem]">
                            <div className="eigen-rise max-w-3xl [animation:eigen-rise_700ms_ease-out_both]">
                                <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#1d4a3a]/15 bg-white/70 px-4 py-2 text-xs font-bold tracking-[0.13em] text-[#31594a] uppercase shadow-sm">
                                    <Smartphone className="size-4" />
                                    Mobile-first workforce learning
                                </div>

                                <h1 className="max-w-3xl text-[3.2rem] leading-[0.96] font-semibold tracking-[-0.055em] text-balance sm:text-6xl lg:text-[5.4rem]">
                                    Your training team,{' '}
                                    <span className="mt-2 block text-[#2d765d]">
                                        without building one.
                                    </span>
                                </h1>

                                <p className="mt-7 max-w-2xl text-lg leading-8 text-[#52675f] sm:text-xl">
                                    Eigen combines a mobile-first LMS with the
                                    people to build your training and manage the
                                    platform. Your workforce gets the knowledge
                                    it needs, without requiring an in-house
                                    training department.
                                </p>

                                <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                                    <Button
                                        asChild
                                        size="lg"
                                        className="h-14 rounded-full bg-[#123d31] px-7 text-base text-white shadow-[0_14px_35px_rgba(18,61,49,0.2)] hover:bg-[#0d3026]"
                                    >
                                        <Link
                                            href={
                                                isSignedIn
                                                    ? dashboard()
                                                    : register()
                                            }
                                        >
                                            {isSignedIn
                                                ? 'Open your dashboard'
                                                : 'Start with Eigen'}
                                            <ArrowRight className="size-5" />
                                        </Link>
                                    </Button>
                                    <Button
                                        asChild
                                        size="lg"
                                        variant="outline"
                                        className="h-14 rounded-full border-[#1f4b3b]/20 bg-white/60 px-7 text-base text-[#183c30] hover:bg-white"
                                    >
                                        <a href="#how-it-works">
                                            See how it works
                                            <ChevronRight className="size-4" />
                                        </a>
                                    </Button>
                                </div>

                                <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-[#52675f]">
                                    {[
                                        'LMS setup',
                                        'Custom course creation',
                                        'Ongoing management',
                                    ].map((item) => (
                                        <span
                                            key={item}
                                            className="flex items-center gap-2"
                                        >
                                            <Check className="size-4 text-[#2d765d]" />
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="relative mx-auto w-full max-w-[35rem] lg:mr-0">
                                <div className="absolute top-16 -left-10 hidden rounded-2xl border border-white/80 bg-white/85 p-4 shadow-[0_18px_60px_rgba(31,65,52,0.16)] backdrop-blur lg:block">
                                    <div className="flex items-center gap-3">
                                        <span className="flex size-10 items-center justify-center rounded-full bg-[#e9ffd0] text-[#2a674f]">
                                            <CheckCircle2 className="size-5" />
                                        </span>
                                        <span>
                                            <span className="block text-xs font-semibold tracking-wide text-[#6b7b75] uppercase">
                                                Progress saved
                                            </span>
                                            <span className="block text-sm font-bold">
                                                Continue anytime
                                            </span>
                                        </span>
                                    </div>
                                </div>

                                <div className="eigen-float relative ml-auto w-[18.5rem] rotate-[1.5deg] [animation:eigen-float_6s_ease-in-out_infinite] rounded-[2.9rem] border-[8px] border-[#0b211b] bg-[#f8f8f4] p-2 shadow-[0_35px_80px_rgba(24,59,46,0.25)] sm:w-[21rem]">
                                    <div className="overflow-hidden rounded-[2.1rem] bg-[#f8f8f4]">
                                        <div className="flex items-center justify-between bg-[#123d31] px-6 pt-5 pb-4 text-white">
                                            <span className="text-[0.65rem] font-semibold">
                                                9:41
                                            </span>
                                            <div className="h-5 w-20 rounded-full bg-[#071611]" />
                                            <span className="text-[0.62rem] font-semibold">
                                                100%
                                            </span>
                                        </div>
                                        <div className="bg-[#123d31] px-5 pt-3 pb-7 text-white">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="flex size-8 items-center justify-center rounded-lg bg-[#dfff72] text-[#123d31]">
                                                        <AppLogoIcon className="size-5 fill-current" />
                                                    </span>
                                                    <span className="font-bold">
                                                        Eigen
                                                    </span>
                                                </div>
                                                <span className="flex size-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-xs font-bold">
                                                    JL
                                                </span>
                                            </div>
                                            <p className="mt-7 text-xs font-semibold tracking-[0.13em] text-[#b7d0c6] uppercase">
                                                Today's training
                                            </p>
                                            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                                                Pick up where you left off.
                                            </h2>
                                        </div>

                                        <div className="space-y-4 px-4 py-5">
                                            <div className="rounded-3xl border border-[#dce4df] bg-white p-4 shadow-[0_8px_25px_rgba(27,55,45,0.08)]">
                                                <div className="flex items-start justify-between gap-3">
                                                    <span className="rounded-full bg-[#fff3cb] px-2.5 py-1 text-[0.62rem] font-bold tracking-wide text-[#745916] uppercase">
                                                        Required
                                                    </span>
                                                    <span className="text-xs font-semibold text-[#66766f]">
                                                        8 min left
                                                    </span>
                                                </div>
                                                <h3 className="mt-4 text-lg font-bold tracking-tight">
                                                    Equipment safety basics
                                                </h3>
                                                <p className="mt-1 text-xs leading-5 text-[#6c7974]">
                                                    Continue lesson 3 of 4
                                                </p>
                                                <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e8ece9]">
                                                    <div className="h-full w-2/3 rounded-full bg-[#66a98e]" />
                                                </div>
                                                <button
                                                    type="button"
                                                    className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#123d31] text-sm font-bold text-white"
                                                >
                                                    <CirclePlay className="size-4" />
                                                    Continue training
                                                </button>
                                            </div>

                                            <div>
                                                <div className="mb-2 flex items-center justify-between px-1">
                                                    <h3 className="text-sm font-bold">
                                                        Up next
                                                    </h3>
                                                    <span className="text-[0.68rem] font-semibold text-[#38755f]">
                                                        View all
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 rounded-2xl border border-[#e0e5e2] bg-white p-3">
                                                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#e7f4ef] text-[#2d765d]">
                                                        <Layers3 className="size-5" />
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate text-sm font-bold">
                                                            Daily equipment
                                                            check
                                                        </span>
                                                        <span className="mt-1 block text-[0.68rem] text-[#77837e]">
                                                            Microlearning · 3
                                                            min
                                                        </span>
                                                    </span>
                                                    <ChevronRight className="size-4 text-[#7f8b86]" />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-4 gap-1 border-t border-[#e3e8e5] pt-3 text-center text-[0.58rem] font-semibold text-[#7b8882]">
                                                {[
                                                    'Home',
                                                    'Training',
                                                    'Resources',
                                                    'Profile',
                                                ].map((item, index) => (
                                                    <span
                                                        key={item}
                                                        className={
                                                            index === 0
                                                                ? 'text-[#27684f]'
                                                                : ''
                                                        }
                                                    >
                                                        <span
                                                            className={`mx-auto mb-1 block size-1.5 rounded-full ${index === 0 ? 'bg-[#4b9878]' : 'bg-[#c9d0cd]'}`}
                                                        />
                                                        {item}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="absolute right-0 bottom-16 hidden rounded-2xl bg-[#dfff72] p-4 shadow-[0_18px_50px_rgba(31,65,52,0.14)] sm:block lg:-right-8">
                                    <div className="flex items-center gap-3">
                                        <span className="flex size-10 items-center justify-center rounded-xl bg-[#123d31] text-white">
                                            <Search className="size-5" />
                                        </span>
                                        <span>
                                            <span className="block text-xs font-semibold tracking-wide text-[#4d6439] uppercase">
                                                Resource portal
                                            </span>
                                            <span className="block text-sm font-bold">
                                                Answers in the field
                                            </span>
                                        </span>
                                    </div>
                                </div>

                                <div className="absolute top-44 -right-24 hidden w-28 rotate-[-7deg] text-center [font-family:'Bradley_Hand','Segoe_Print',cursive] text-sm leading-5 font-medium text-[#395a4e] xl:block">
                                    Real progress.
                                    <br />A stronger workforce.
                                    <Sparkles className="mx-auto mt-2 size-5 text-[#9fca27]" />
                                </div>
                            </div>
                        </div>
                    </section>

                    <section
                        id="managed-service"
                        className="relative overflow-hidden bg-[#0f4a3b] text-white"
                    >
                        <div className="absolute inset-0 opacity-70">
                            <div className="absolute -bottom-72 -left-32 h-[36rem] w-[60rem] rotate-[11deg] rounded-[50%] border border-[#5c9b84]/25 bg-[#174f42]" />
                            <div className="absolute -right-24 -bottom-72 h-[34rem] w-[66rem] -rotate-[8deg] rounded-[50%] border border-[#75ae98]/15 bg-[#0b3f33]" />
                        </div>
                        <div className="relative z-10 mx-auto grid w-full max-w-7xl gap-12 px-5 py-16 sm:px-8 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:px-10 lg:py-[3.75rem]">
                            <div>
                                <p className="text-xs font-bold tracking-[0.18em] text-[#dfff72] uppercase">
                                    More than software
                                </p>
                                <h2 className="mt-5 max-w-xl text-4xl leading-[1.05] font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
                                    The LMS is only useful when the training is
                                    useful.
                                </h2>
                                <p className="mt-6 max-w-xl text-lg leading-8 text-[#b9cec6]">
                                    Most platforms give you tools and leave the
                                    rest to your team. Eigen can create the
                                    training, structure the learning program,
                                    and help run the system alongside you.
                                </p>
                            </div>

                            <div className="grid gap-3">
                                {managedServices.map((service, index) => (
                                    <div
                                        key={service}
                                        className="group flex items-start gap-5 rounded-2xl border border-white/15 bg-white/[0.055] p-5 transition-colors hover:bg-white/[0.09] lg:px-6 lg:py-4"
                                    >
                                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#dfff72] text-sm font-extrabold text-[#123d31]">
                                            {index + 1}
                                        </span>
                                        <p className="pt-1 text-base leading-7 font-medium text-[#eff7f4] sm:text-lg">
                                            {service}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="pointer-events-none absolute -bottom-5 left-1/2 h-10 w-[115%] -translate-x-1/2 rounded-[50%] bg-[#fbfcf9]" />
                    </section>

                    <section id="platform" className="bg-[#fbfcf9]">
                        <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 sm:py-20 lg:px-10 lg:py-12">
                            <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-end">
                                <div>
                                    <p className="text-xs font-bold tracking-[0.18em] text-[#2d765d] uppercase">
                                        One connected platform
                                    </p>
                                    <h2 className="mt-5 max-w-3xl text-4xl leading-[1.05] font-semibold tracking-[-0.04em] text-balance text-[#11251e] sm:text-5xl">
                                        Everything your workforce needs to
                                        learn, perform, and stay current.
                                    </h2>
                                </div>
                                <p className="max-w-xl text-lg leading-8 text-[#62716b] lg:justify-self-end">
                                    Simple for learners in the field. Clear for
                                    managers. Powerful enough for the people
                                    responsible for training across the
                                    organization.
                                </p>
                            </div>

                            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                                {platformFeatures.map((feature) => {
                                    const Icon = feature.icon;

                                    return (
                                        <article
                                            key={feature.title}
                                            className="group rounded-3xl border border-[#dfe6e2]/80 bg-white p-7 shadow-[0_14px_42px_rgba(32,61,49,0.07)] transition-all hover:-translate-y-1 hover:bg-[#f7fbf8] hover:shadow-[0_18px_50px_rgba(32,61,49,0.1)] lg:p-6"
                                        >
                                            <div className="flex size-12 items-center justify-center rounded-2xl bg-[#e2f2eb] text-[#286f55] transition-transform group-hover:-translate-y-1">
                                                <Icon className="size-6" />
                                            </div>
                                            <h3 className="mt-6 text-xl font-bold tracking-[-0.02em]">
                                                {feature.title}
                                            </h3>
                                            <p className="mt-3 text-sm leading-7 text-[#65746e]">
                                                {feature.description}
                                            </p>
                                        </article>
                                    );
                                })}
                            </div>
                        </div>
                    </section>

                    <section
                        id="how-it-works"
                        className="relative overflow-hidden border-y border-[#173c2f]/10 bg-[#edf1ea]"
                    >
                        <div className="absolute -top-32 left-1/2 h-48 w-[120%] -translate-x-1/2 rounded-[50%] bg-[#fbfcf9]" />
                        <div className="absolute top-1/3 -left-36 h-96 w-96 rounded-full bg-[#dcebdd]/45 blur-3xl" />
                        <div className="absolute right-[-12rem] bottom-[-12rem] h-[34rem] w-[54rem] -rotate-12 rounded-[50%] bg-[#f8fbf4]/80" />
                        <div className="relative mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 sm:py-16 lg:px-10 lg:py-6">
                            <div className="max-w-3xl">
                                <p className="text-xs font-bold tracking-[0.18em] text-[#2d765d] uppercase">
                                    From know-how to know-how-to
                                </p>
                                <h2 className="mt-5 text-4xl leading-[1.05] font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
                                    Bring us what your team knows. We help turn
                                    it into training that works.
                                </h2>
                            </div>

                            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                                {processSteps.map((step) => (
                                    <article
                                        key={step.number}
                                        className="relative overflow-hidden rounded-3xl border border-[#254b3c]/10 bg-white p-6 shadow-[0_12px_40px_rgba(32,61,49,0.06)]"
                                    >
                                        <span className="text-5xl font-semibold tracking-[-0.06em] text-[#d4e1da]">
                                            {step.number}
                                        </span>
                                        <h3 className="mt-5 text-xl font-bold tracking-[-0.02em]">
                                            {step.title}
                                        </h3>
                                        <p className="mt-3 text-sm leading-6 text-[#65746e]">
                                            {step.description}
                                        </p>
                                    </article>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section className="relative overflow-hidden bg-[#dfff72]">
                        <div className="absolute -right-32 -bottom-72 h-[34rem] w-[56rem] -rotate-12 rounded-[50%] border border-white/30 bg-[#c8fa59]/60" />
                        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-8 px-5 py-12 sm:px-8 sm:py-12 lg:grid-cols-[1fr_auto] lg:px-10 lg:py-4">
                            <div>
                                <div className="flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-[#45602c] uppercase">
                                    <Sparkles className="size-4" />A practical
                                    path forward
                                </div>
                                <h2 className="mt-4 max-w-4xl text-4xl leading-[1.05] font-semibold tracking-[-0.045em] text-balance text-[#11251e] sm:text-5xl">
                                    You do not need a training department to
                                    build a trained workforce.
                                </h2>
                            </div>
                            <Button
                                asChild
                                size="lg"
                                className="h-14 w-full rounded-full bg-[#123d31] px-8 text-base text-white shadow-[0_14px_30px_rgba(18,61,49,0.18)] hover:bg-[#0d3026] sm:w-auto"
                            >
                                <Link
                                    href={isSignedIn ? dashboard() : register()}
                                >
                                    {isSignedIn
                                        ? 'Go to dashboard'
                                        : 'Build with Eigen'}
                                    <ArrowRight className="size-5" />
                                </Link>
                            </Button>
                        </div>
                    </section>
                </main>

                <footer className="bg-[#0d2b22] text-white">
                    <div className="mx-auto grid w-full max-w-7xl gap-7 px-5 py-9 sm:px-8 md:grid-cols-[auto_1fr_auto] md:items-center lg:h-24 lg:px-10 lg:py-0">
                        <div className="flex items-center gap-3">
                            <span className="flex size-9 items-center justify-center rounded-xl bg-[#dfff72] text-[#123d31]">
                                <AppLogoIcon className="size-5 fill-current" />
                            </span>
                            <span>
                                <span className="block text-sm leading-none font-bold">
                                    Eigen
                                </span>
                                <span className="mt-1 block text-[0.55rem] font-semibold tracking-[0.17em] text-[#9eb9af] uppercase">
                                    Learning
                                </span>
                            </span>
                        </div>

                        <p className="max-w-lg text-xs leading-5 text-[#9eb9af] md:justify-self-center">
                            Mobile-first learning technology and managed
                            training for the modern workforce.
                        </p>

                        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-[#b8cec6] md:justify-end">
                            <a href="#platform" className="hover:text-white">
                                Platform
                            </a>
                            <a
                                href="#managed-service"
                                className="hover:text-white"
                            >
                                Services
                            </a>
                            {!isSignedIn && (
                                <Link
                                    href={login()}
                                    className="hover:text-white"
                                >
                                    Log in
                                </Link>
                            )}
                            <span className="text-[#78968b]">
                                © {new Date().getFullYear()} Eigen Learning
                            </span>
                        </div>
                    </div>
                </footer>
            </div>
        </>
    );
}
