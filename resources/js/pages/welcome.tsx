import { Head } from '@inertiajs/react';
import {
    ArrowRight,
    BarChart3,
    BellRing,
    Check,
    ClipboardCheck,
    FileText,
    Menu,
    Network,
    Smartphone,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

const demoUrl = 'https://calendly.com/lavoiect/30min';

const services = [
    'Is this employee ready to work independently?',
    'Do they understand the correct procedure?',
    'Can they find the right answer while they’re in the field?',
    'Can we prove they completed and understood their training?',
];

const processSteps = [
    {
        title: 'Show us the problem',
        description:
            'Choose the role, team, or procedure creating the greatest risk or inconsistency.',
    },
    {
        title: 'Bring us what you have',
        description:
            'Share your manuals, SOPs, videos, checklists, and subject-matter experts.',
    },
    {
        title: 'We build the pilot',
        description:
            'Eigen creates and launches a focused mobile training experience.',
    },
    {
        title: 'You measure readiness',
        description:
            'Track participation, performance, knowledge gaps, and field-resource usage.',
    },
];

function Brand({ footer = false }: { footer?: boolean }) {
    return (
        <span className={`brand ${footer ? 'brand-footer' : ''}`}>
            <img
                className="brand-mark"
                src="/eigen_logo.png"
                alt=""
                aria-hidden="true"
            />
            <span className="brand-word">
                <span className="brand-name">Eigen</span>
                <span className="brand-sub">Learning</span>
            </span>
        </span>
    );
}

export default function Welcome() {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [headerScrolled, setHeaderScrolled] = useState(false);
    const [headerHidden, setHeaderHidden] = useState(false);

    useEffect(() => {
        let lastY = window.scrollY;

        const handleScroll = () => {
            const currentY = window.scrollY;
            setHeaderScrolled(currentY > 8);
            setHeaderHidden(currentY > 120 && currentY > lastY);
            lastY = currentY;
        };

        window.addEventListener('scroll', handleScroll, { passive: true });

        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const elements = document.querySelectorAll('.eigen-site .reveal');

        if (!('IntersectionObserver' in window)) {
            elements.forEach((element) => element.classList.add('is-visible'));

            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
        );

        elements.forEach((element) => observer.observe(element));

        return () => observer.disconnect();
    }, []);

    const closeMobileMenu = () => setMobileOpen(false);

    return (
        <>
            <Head title="Your training team, without building one">
                <meta
                    name="description"
                    content="Eigen combines a mobile-first LMS with the people to build your training and manage the platform. Your workforce gets the knowledge it needs, without requiring an in-house training department."
                />
                <meta
                    property="og:title"
                    content="Eigen Learning — Your training team, without building one"
                />
                <meta
                    property="og:description"
                    content="Mobile-first LMS plus managed training services for the modern workforce."
                />
                <meta property="og:type" content="website" />
                <link rel="icon" type="image/png" href="/eigen_logo.png" />
                <link rel="preconnect" href="https://api.fontshare.com" />
                <link
                    rel="stylesheet"
                    href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@500,700,800&f[]=general-sans@400,500,600&display=swap"
                />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link
                    rel="preconnect"
                    href="https://fonts.gstatic.com"
                    crossOrigin="anonymous"
                />
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/css2?family=Spline+Sans+Mono:wght@400;500&display=swap"
                />
            </Head>

            <style>{welcomeStyles}</style>

            <div className="eigen-site">
                <a className="skip-link" href="#main-content">
                    Skip to content
                </a>

                <header
                    className={`site-header ${headerScrolled ? 'is-scrolled' : ''} ${headerHidden ? 'is-hidden' : ''}`}
                >
                    <div className="site-container header-inner">
                        <a
                            href="#top"
                            className="brand-link"
                            aria-label="Eigen Learning home"
                        >
                            <Brand />
                        </a>

                        <nav className="site-nav" aria-label="Primary">
                            <a href="#platform">Platform</a>
                            <a href="#services">Managed training</a>
                            <a href="#how-it-works">How it works</a>
                        </nav>

                        <div className="header-actions">
                            <button
                                type="button"
                                className="nav-toggle"
                                aria-label={
                                    mobileOpen ? 'Close menu' : 'Open menu'
                                }
                                aria-expanded={mobileOpen}
                                aria-controls="mobile-menu"
                                onClick={() => setMobileOpen((open) => !open)}
                            >
                                {mobileOpen ? <X /> : <Menu />}
                            </button>
                            <a
                                href={demoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="site-button button-primary button-small desktop-cta"
                            >
                                Book a demo
                                <ArrowRight aria-hidden="true" />
                            </a>
                        </div>
                    </div>

                    {mobileOpen && (
                        <div className="mobile-menu" id="mobile-menu">
                            <nav className="site-container" aria-label="Mobile">
                                <a href="#platform" onClick={closeMobileMenu}>
                                    Platform
                                </a>
                                <a href="#services" onClick={closeMobileMenu}>
                                    Managed training
                                </a>
                                <a
                                    href="#how-it-works"
                                    onClick={closeMobileMenu}
                                >
                                    How it works
                                </a>
                                <a
                                    href={demoUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="site-button button-primary"
                                    onClick={closeMobileMenu}
                                >
                                    Book a demo
                                    <ArrowRight aria-hidden="true" />
                                </a>
                            </nav>
                        </div>
                    )}
                </header>

                <main id="main-content">
                    <section className="hero" id="top">
                        <div className="hero-grid-bg" aria-hidden="true" />
                        <div className="site-container hero-inner">
                            <div className="hero-copy">
                                <p className="eyebrow">
                                    <span
                                        className="eyebrow-dot"
                                        aria-hidden="true"
                                    />
                                    Mobile training for field and frontline teams
                                </p>
                                <h1 className="hero-title">
                                    Know they’re ready{' '}before they’re in <em> the field.</em>
                                    
                                </h1>
                                <p className="hero-lede">
                                    Eigen turns your procedures and expert knowledge into mobile training, assessments, and searchable job aids—so employees know what to do, managers can see where gaps exist, and preventable mistakes don’t become expensive problems.
                                </p>

                                <div className="hero-ctas">
                                    <a
                                        href={demoUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="site-button button-primary"
                                    >
                                        Book a demo
                                        <ArrowRight aria-hidden="true" />
                                    </a>
                                    <a
                                        href="#how-it-works"
                                        className="site-button button-ghost"
                                    >
                                        See how it works
                                    </a>
                                </div>

                                <ul className="hero-checklist" role="list">
                                    {[
                                        'Faster onboarding',
                                        'Consistent procedures',
                                        'Clear readiness reporting',
                                    ].map((item) => (
                                        <li key={item}>
                                            <Check aria-hidden="true" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </section>

                    <section className="value-section" id="services">
                        <div className="site-container">
                            <div className="value-head reveal">
                                <div>
                                    <p className="eyebrow eyebrow-light">
                                        The training gap
                                    </p>
                                    <h2 className="value-title">
                                        You shouldn’t discover a training gap <em>after something goes wrong.</em>
                                        
                                    </h2>
                                </div>
                                <p className="value-lede">
                                    Employees are often sent into the field after reading a manual, shadowing another employee, or receiving inconsistent instruction from different supervisors. The weakness only becomes visible after a safety incident, repeat service call, damaged equipment, or customer complaint.
                                    
                                </p>
                            </div>
                            <p className="eyebrow eyebrow-light pb-3">
                                    CAN YOUR MANAGERS CONFIDENTLY ANSWER?
                            </p>
                            <ol className="value-list" role="list">
                                {services.map((service, index) => (
                                    <li className="reveal" key={service}>
                                        <span className="value-num">
                                            {String(index + 1).padStart(2, '0')}
                                        </span>
                                        <p>{service}</p>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    </section>

                    <section className="platform-section" id="platform">
                        <div className="site-container">
                            <div className="section-head reveal">
                                <div>
                                    <p className="eyebrow">
                                        From training activity to workforce readiness
                                    </p>
                                    <h2 className="section-title">
                                        Give employees the knowledge they need—and managers the visibility they’re missing.
                                    </h2>
                                </div>
                                <p className="section-lede">
                                    Simple for learners in the field. Clear for
                                    managers. Powerful enough for the people
                                    responsible for training across the
                                    organization.
                                </p>
                            </div>

                            <FeatureGroup
                                index="A"
                                name="For learners"
                                description="In the field, on the phone they already carry."
                            >
                                <FeatureCard
                                    wide
                                    icon={Smartphone}
                                    title="Mobile-first training"
                                    description="Give frontline employees a focused learning experience built for the device already in their pocket."
                                >
                                    <div className="preview-phone">
                                        <span />
                                        <span />
                                        <span />
                                    </div>
                                </FeatureCard>
                                <FeatureCard
                                    icon={FileText}
                                    title="Resources on demand"
                                    description="Keep procedures, job aids, checklists, and videos searchable and current in one mobile resource portal."
                                />
                            </FeatureGroup>

                            <FeatureGroup
                                flip
                                index="B"
                                name="For managers"
                                description="Clarity without digging through exports."
                            >
                                <FeatureCard
                                    icon={BarChart3}
                                    title="Reporting that drives action"
                                    description="See completion, overdue training, assessment performance, and knowledge gaps without digging through exports."
                                />
                                <FeatureCard
                                    wide
                                    icon={BellRing}
                                    title="Assignments and reminders"
                                    description="Assign required training, set due dates, schedule recurrence, and keep learners moving with reminders."
                                >
                                    <div className="preview-assign">
                                        <span>
                                            Onboarding · due Sep 18
                                            <b>Scheduled</b>
                                        </span>
                                        <span>
                                            Safety refresh · quarterly
                                            <b>Recurring</b>
                                        </span>
                                    </div>
                                </FeatureCard>
                            </FeatureGroup>

                            <FeatureGroup
                                index="C"
                                name="For training operations"
                                description="The structure behind a running program."
                            >
                                <FeatureCard
                                    wide
                                    icon={Network}
                                    title="Role-based pathways"
                                    description="Automatically guide each employee through the right training for their job title, team, or location."
                                >
                                    <div className="preview-path">
                                        <span>Operator</span>
                                        <i />
                                        <span>Lead</span>
                                        <i />
                                        <span>Supervisor</span>
                                    </div>
                                </FeatureCard>
                                <FeatureCard
                                    icon={ClipboardCheck}
                                    title="Courses and assessments"
                                    description="Deliver full courses, quick microlearning, knowledge checks, and scored final assessments."
                                />
                            </FeatureGroup>
                        </div>
                    </section>

                    <section className="process-section" id="how-it-works">
                        <div className="site-container">
                            <div className="process-head reveal">
                                <p className="eyebrow">
                                    More than software
                                </p>
                                <h2 className="section-title">
                                    Your training team, without building one.
                                    Bring us what your team knows.{' '}
                                    <em>
                                        We help turn it into training that
                                        works.
                                    </em>
                                </h2>
                            </div>

                            <ol className="process-track" role="list">
                                {processSteps.map((step, index) => (
                                    <li
                                        className="process-step reveal"
                                        key={step.title}
                                    >
                                        <span className="step-num">
                                            {String(index + 1).padStart(2, '0')}
                                        </span>
                                        <h3>{step.title}</h3>
                                        <p>{step.description}</p>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    </section>

                    <section className="cta-section" id="cta">
                        <div className="site-container">
                            <div className="cta-panel reveal">
                                <div
                                    className="cta-grid-bg"
                                    aria-hidden="true"
                                />
                                <div className="cta-copy">
                                    <p className="eyebrow eyebrow-chartreuse">
                                        A practical path forward
                                    </p>
                                    <h2 className="cta-title">
                                        Before you send them into the field, know they’re ready.
                                    </h2>
                                    <div className="hero-lede w-full!"> 
                                            Let’s identify one training problem Eigen can turn into a focused mobile pilot.


                                        </div>
                                </div>
                                <div className="cta-action">
                                    <a
                                        href={demoUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="site-button button-chartreuse"
                                    >
                                        Book a demo
                                        <ArrowRight aria-hidden="true" />
                                    </a>
                                </div>
                            </div>
                        </div>
                    </section>
                </main>

                <footer className="site-footer">
                    <div className="site-container footer-inner">
                        <a
                            href="#top"
                            className="brand-link"
                            aria-label="Eigen Learning home"
                        >
                            <Brand footer />
                        </a>
                        <p className="footer-tagline">
                            Mobile-first learning technology and managed
                            training for the modern workforce.
                        </p>
                        <nav className="footer-nav" aria-label="Footer">
                            <a href="#platform">Platform</a>
                            <a href="#services">Services</a>
                        </nav>
                        <p className="footer-legal">
                            © {new Date().getFullYear()} Eigen Learning
                        </p>
                    </div>
                </footer>
            </div>
        </>
    );
}

type FeatureGroupProps = {
    index: string;
    name: string;
    description: string;
    flip?: boolean;
    children: React.ReactNode;
};

function FeatureGroup({
    index,
    name,
    description,
    flip = false,
    children,
}: FeatureGroupProps) {
    return (
        <div className={`feature-group reveal ${flip ? 'is-flipped' : ''}`}>
            <div className="group-label">
                <span className="group-index">{index}</span>
                <div>
                    <p className="group-name">{name}</p>
                    <p className="group-description">{description}</p>
                </div>
            </div>
            <div className="group-cards">{children}</div>
        </div>
    );
}

type FeatureCardProps = {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
    wide?: boolean;
    children?: React.ReactNode;
};

function FeatureCard({
    icon: Icon,
    title,
    description,
    wide = false,
    children,
}: FeatureCardProps) {
    return (
        <article className={`feature-card ${wide ? 'feature-card-wide' : ''}`}>
            <span className="feature-icon">
                <Icon />
            </span>
            <h3>{title}</h3>
            <p>{description}</p>
            {children && <div className="feature-preview">{children}</div>}
        </article>
    );
}

const welcomeStyles = String.raw`
.eigen-site {
    --site-bg: #07100e;
    --site-surface: #0d1916;
    --site-surface-2: #11201c;
    --site-offset: #091411;
    --site-border: #263c35;
    --site-divider: #1b302a;
    --site-ink: #edf5f0;
    --site-muted: #a2b4ad;
    --site-faint: #6c8178;
    --site-forest: #73df78;
    --site-forest-deep: #04100c;
    --site-chartreuse: #c7ef4b;
    --site-chartreuse-soft: #d9f58a;
    --site-sage: #142a22;
    --site-shadow: 0 24px 60px rgba(0, 0, 0, 0.48);
    min-height: 100vh;
    color: var(--site-ink);
    background: var(--site-bg);
    font-family: 'General Sans', 'Avenir Next', sans-serif;
    font-size: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);
    line-height: 1.6;
}
.eigen-site * { box-sizing: border-box; }
.eigen-site h1, .eigen-site h2, .eigen-site h3, .eigen-site p { margin: 0; }
.eigen-site h1, .eigen-site h2, .eigen-site h3 {
    font-family: 'Cabinet Grotesk', 'Avenir Next', sans-serif;
    font-weight: 800;
    letter-spacing: -0.015em;
    line-height: 1.12;
    text-wrap: balance;
}
.eigen-site a { color: inherit; text-decoration: none; }
.eigen-site button { font: inherit; }
.eigen-site svg { display: block; }
.eigen-site .site-container { width: min(1180px, calc(100% - 2.5rem)); margin-inline: auto; }
.skip-link { position: fixed; top: 12px; left: 12px; z-index: 100; transform: translateY(-200%); padding: 8px 14px; border-radius: 8px; background: var(--site-surface-2); }
.skip-link:focus { transform: none; }
.site-header { position: sticky; top: 0; z-index: 50; border-bottom: 1px solid transparent; background: rgba(4, 14, 11, .88); backdrop-filter: blur(18px); transition: transform 350ms ease, border-color 350ms ease; }
.site-header.is-scrolled { border-bottom-color: var(--site-divider); }
.site-header.is-hidden { transform: translateY(-100%); }
.header-inner { display: flex; height: 72px; align-items: center; justify-content: space-between; gap: 24px; }
.brand-link, .brand { display: inline-flex; align-items: center; }
.brand { gap: 12px; }
.brand-mark { display: block; width: 30px; height: 30px; flex: none; object-fit: contain; }
.site-header .brand-mark { width: 42px; height: 42px; }
.brand-word { display: flex; flex-direction: column; line-height: 1; }
.brand-name { font-family: 'Cabinet Grotesk', sans-serif; font-size: 1.15rem; font-weight: 800; }
.brand-sub, .eyebrow, .value-num, .group-name, .step-num, .footer-legal { font-family: 'Spline Sans Mono', monospace; }
.brand-sub { margin-top: 3px; color: var(--site-muted); font-size: .5625rem; letter-spacing: .34em; text-transform: uppercase; }
.site-nav { display: flex; gap: 32px; }
.site-nav a, .footer-nav a { color: var(--site-muted); font-size: .95rem; font-weight: 500; transition: color 180ms ease; }
.site-nav a:hover, .footer-nav a:hover { color: var(--site-ink); }
.header-actions { display: flex; align-items: center; gap: 12px; }
.nav-toggle { display: grid; width: 40px; height: 40px; place-items: center; border: 1px solid var(--site-border); border-radius: 10px; color: var(--site-muted); background: rgba(255, 255, 255, .025); cursor: pointer; }
.nav-toggle:hover { color: var(--site-chartreuse); border-color: #4b685e; }
.nav-toggle svg { width: 19px; height: 19px; }
.nav-toggle { display: none; }
.site-button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; padding: 12px 24px; border: 1px solid transparent; border-radius: 10px; font-size: .95rem; font-weight: 600; transition: transform 180ms ease, background 180ms ease, box-shadow 180ms ease; }
.site-button svg { width: 17px; height: 17px; transition: transform 180ms ease; }
.site-button:hover { transform: translateY(-1px); }
.site-button:hover svg { transform: translateX(3px); }
.button-small { min-height: 40px; padding: 8px 20px; }
.eigen-site .button-primary { color: #07110d; background: var(--site-chartreuse); }
.eigen-site .button-primary:hover { background: var(--site-chartreuse-soft); box-shadow: 0 10px 30px rgba(199,239,75,.18); }
.eigen-site .button-ghost { border-color: var(--site-border); color: var(--site-ink); background: transparent; }
.eigen-site .button-ghost:hover { background: var(--site-surface); }
.eigen-site .button-chartreuse { color: #071d15; background: var(--site-chartreuse); }
.eigen-site .button-chartreuse:hover { background: var(--site-chartreuse-soft); box-shadow: 0 8px 30px rgba(199,239,75,.25); }
.mobile-menu { border-top: 1px solid var(--site-divider); background: var(--site-bg); }
.mobile-menu nav { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding-block: 24px 32px; }
.mobile-menu nav > a:not(.site-button) { width: 100%; padding: 12px 0; border-bottom: 1px solid var(--site-divider); font-family: 'Cabinet Grotesk', sans-serif; font-size: 1.25rem; font-weight: 600; }
.mobile-menu .site-button { margin-top: 12px; }
.hero {
    position: relative;
    overflow: hidden;
    border-bottom: 1px solid var(--site-divider);
    background-image: url('/heroImage.png');
    background-position: center;
    background-repeat: no-repeat;
    background-size: cover;
}
.hero-grid-bg { display: none; }
.hero-inner { position: relative; display: grid; min-height: clamp(640px,calc(100svh - 72px),780px); grid-template-columns: minmax(0,590px) 1fr; gap: 64px; align-items: center; padding-block: clamp(52px,7vw,88px); }
.hero-copy { max-width: 590px; padding: clamp(28px,3.4vw,40px); border: 1px solid rgba(199,239,75,.16); border-radius: 22px; background: rgba(4,15,17,.48); box-shadow: 0 24px 64px rgba(0,0,0,.28); backdrop-filter: blur(8px); }
.eyebrow { display: flex; align-items: center; gap: 12px; color: var(--site-chartreuse); font-size: clamp(.75rem,.7rem + .25vw,.875rem); font-weight: 500; letter-spacing: .16em; text-shadow: 0 2px 18px rgba(0,0,0,.95); text-transform: uppercase; }
.eyebrow-dot { width: 7px; height: 7px; flex: none; border: 1px solid var(--site-chartreuse-soft); border-radius: 50%; background: var(--site-chartreuse); box-shadow: 0 0 16px rgba(199,239,75,.75); }
.hero-title { margin-top: 20px !important; color: #f5faf7; font-size: clamp(2.8rem,1.65rem + 3.2vw,4.2rem); text-shadow: 0 3px 28px rgba(0,0,0,.92); }
.hero-title em { color: #f5faf7; font-style: normal; text-decoration: underline; text-decoration-color: var(--site-chartreuse); text-decoration-thickness: .12em; text-underline-offset: .08em; }
.hero-lede { max-width: 46ch; margin-top: 20px !important; color: #d7e3de; font-size: clamp(1.02rem,.96rem + .34vw,1.18rem); line-height: 1.58; text-shadow: 0 2px 18px rgba(0,0,0,.95); }
.hero-ctas { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 28px; }
.hero-checklist { display: flex; flex-wrap: wrap; gap: 12px 24px; margin: 28px 0 0; padding: 0; list-style: none; }
.hero-checklist li { display: flex; align-items: center; gap: 8px; color: #c7d5cf; font-family: 'Spline Sans Mono', monospace; font-size: .72rem; letter-spacing: .08em; text-shadow: 0 2px 14px rgba(0,0,0,.95); text-transform: uppercase; }
.hero-checklist svg { width: 15px; height: 15px; color: var(--site-chartreuse); stroke-width: 2.5; }
.value-section { position: relative; overflow: hidden; padding-block: clamp(80px,8vw,128px); color: #e7f0e6; background: radial-gradient(ellipse 60% 50% at 85% 0%,rgba(115,223,120,.09),transparent 60%),#06130f; }
.value-section::after { position: absolute; inset: 0; content: ''; pointer-events: none; background-image: linear-gradient(to right,rgba(214,235,222,.14) 1px,transparent 1px); background-size: 72px 72px; mask-image: linear-gradient(to bottom,black,transparent 85%); }
.value-section .site-container { position: relative; z-index: 1; }
.value-head, .section-head { display: grid; grid-template-columns: 1.4fr 1fr; gap: 48px; margin-bottom: 64px; }
.eyebrow-light, .eyebrow-chartreuse { color: var(--site-chartreuse) !important; }
.value-title { margin-top: 20px !important; color: #f3f7ef; font-size: clamp(2.1rem,1.4rem + 2.6vw,3.6rem); }
.value-title em { color: var(--site-chartreuse); font-style: normal; }
.value-lede, .section-lede { max-width: 42ch; color: #a9bdaf; font-size: clamp(1.125rem,1rem + .75vw,1.5rem); line-height: 1.55; }
.value-list { margin: 0; padding: 0; border-top: 1px solid rgba(214,235,222,.14); list-style: none; }
.value-list li { display: grid; grid-template-columns: 90px 1fr; gap: 24px; align-items: baseline; padding-block: 24px; border-bottom: 1px solid rgba(214,235,222,.14); transition: padding 180ms ease,background 180ms ease; }
.value-list li:hover { padding-left: 16px; background: rgba(199,239,75,.04); }
.value-num { color: var(--site-chartreuse); font-size: .875rem; letter-spacing: .1em; }
.value-list p { max-width: 34ch; color: #dce9dc; font-family: 'Cabinet Grotesk',sans-serif; font-size: clamp(1.125rem,1rem + .75vw,1.5rem); font-weight: 500; line-height: 1.35; }
.platform-section { padding-block: clamp(80px,0,128px); background: radial-gradient(circle at 8% 15%,rgba(73,141,116,.09),transparent 28%),var(--site-bg); }
.section-title { max-width: 22ch; margin-top: 20px !important; font-size: clamp(1.8rem,1.25rem + 2vw,3rem); }
.section-title em { color: var(--site-chartreuse); font-style: normal; }
.section-lede { color: var(--site-muted); }
.feature-group { display: grid; grid-template-columns: 260px 1fr; gap: 40px; padding-block: 40px; border-top: 1px solid var(--site-divider); }
.feature-group:last-of-type { border-bottom: 1px solid var(--site-divider); }
.group-label { display: flex; align-items: flex-start; gap: 16px; }
.group-index { display: grid; width: 34px; height: 34px; flex: none; place-items: center; border: 1px solid var(--site-border); border-radius: 50%; color: var(--site-muted); background: var(--site-surface); font-family: 'Spline Sans Mono',monospace; font-size: .8125rem; }
.group-name { color: var(--site-forest); font-size: .8rem; font-weight: 500; letter-spacing: .14em; text-transform: uppercase; }
.group-description { margin-top: 8px !important; color: var(--site-muted); font-size: .95rem; line-height: 1.5; }
.group-cards { display: grid; grid-template-columns: 1.45fr 1fr; gap: 24px; }
.feature-group.is-flipped .group-cards { grid-template-columns: 1fr 1.45fr; }
.feature-group.is-flipped .feature-card-wide { grid-column: 2; }
.feature-group.is-flipped .feature-card:not(.feature-card-wide) { grid-row: 1; grid-column: 1; }
.feature-card { display: flex; flex-direction: column; gap: 16px; padding: 32px; border: 1px solid var(--site-border); border-radius: 14px; background: linear-gradient(145deg,rgba(255,255,255,.035),transparent 45%),var(--site-surface); box-shadow: inset 0 1px rgba(255,255,255,.025); transition: transform 180ms ease,box-shadow 180ms ease,border-color 180ms ease; }
.feature-card:hover { transform: translateY(-3px); border-color: #46695d; box-shadow: 0 18px 45px rgba(0,0,0,.24); }
.feature-icon { display: grid; width: 46px; height: 46px; place-items: center; border: 1px solid rgba(199,239,75,.14); border-radius: 10px; color: var(--site-chartreuse); background: var(--site-sage); }
.feature-icon svg { width: 22px; height: 22px; }
.feature-card h3 { font-size: clamp(1.125rem,1rem + .75vw,1.5rem); font-weight: 700; }
.feature-card > p { color: var(--site-muted); font-size: 1rem; line-height: 1.55; }
.feature-preview { margin-top: auto; padding-top: 20px; }
.preview-phone { display: flex; gap: 6px; }
.preview-phone span { width: 22%; height: 44px; border-radius: 6px; background: var(--site-offset); }
.preview-phone span:nth-child(2) { width: 54%; background: var(--site-sage); }
.preview-assign { display: flex; flex-direction: column; gap: 12px; }
.preview-assign > span { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 14px; border: 1px dashed var(--site-border); border-radius: 6px; color: var(--site-muted); font-family: 'Spline Sans Mono',monospace; font-size: .75rem; }
.preview-assign b { color: var(--site-chartreuse); font-size: .6875rem; font-weight: 500; letter-spacing: .08em; text-transform: uppercase; }
.preview-path { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.preview-path span { padding: 6px 14px; border: 1px solid var(--site-border); border-radius: 999px; color: var(--site-muted); background: var(--site-surface-2); font-family: 'Spline Sans Mono',monospace; font-size: .75rem; }
.preview-path span:first-child { color: var(--site-chartreuse); border-color: rgba(199,239,75,.55); }
.preview-path i { width: 26px; height: 1px; background: var(--site-faint); }
.process-section { padding-block: clamp(80px,8vw,128px); border-block: 1px solid var(--site-divider); background: radial-gradient(circle at 88% 20%,rgba(199,239,75,.06),transparent 28%),var(--site-offset); }
.process-head { max-width: 720px; margin-bottom: 64px; }
.process-track { position: relative; display: grid; grid-template-columns: repeat(4,1fr); gap: 32px; margin: 0; padding: 0; list-style: none; }
.process-track::before { position: absolute; top: 5px; right: 0; left: 0; height: 1px; content: ''; background: var(--site-border); }
.process-step { position: relative; padding-top: 32px; }
.step-num { position: absolute; top: -13px; left: 0; padding-right: 16px; color: var(--site-chartreuse); background: var(--site-offset); font-size: .875rem; font-weight: 500; letter-spacing: .1em; }
.process-step h3 { margin-bottom: 12px !important; font-size: clamp(1.125rem,1rem + .75vw,1.5rem); }
.process-step p { color: var(--site-muted); font-size: 1rem; line-height: 1.55; }
.cta-section { padding-block: clamp(64px,7vw,96px); }
.cta-panel { position: relative; display: grid; grid-template-columns: 1.6fr auto; gap: 48px; align-items: center; overflow: hidden; padding: clamp(48px,5vw,80px); border: 1px solid #29443a; border-radius: 20px; color: #eaf3e7; background: radial-gradient(ellipse 55% 90% at 100% 50%,rgba(199,239,75,.12),transparent 60%),var(--site-forest-deep); box-shadow: 0 30px 80px rgba(0,0,0,.3); }
.cta-grid-bg { position: absolute; inset: 0; pointer-events: none; background-image: linear-gradient(to right,rgba(214,235,222,.14) 1px,transparent 1px),linear-gradient(to bottom,rgba(214,235,222,.14) 1px,transparent 1px); background-size: 64px 64px; mask-image: radial-gradient(ellipse at 80% 50%,black,transparent 75%); }
.cta-copy, .cta-action { position: relative; }
.cta-title { max-width: 20ch; margin-top: 20px !important; color: #f3f7ef; font-size: clamp(2.1rem,1.4rem + 2.6vw,3.6rem); }
.cta-action .site-button { min-height: 54px; padding-inline: 32px; }
.site-footer { padding-block: 48px; border-top: 1px solid var(--site-divider); background: #050d0b; }
.footer-inner { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 24px 40px; }
.footer-tagline { max-width: 36ch; color: var(--site-muted); font-size: .9rem; }
.footer-nav { display: flex; gap: 24px; }
.footer-legal { color: var(--site-faint); font-size: .75rem; }
.reveal { opacity: 0; transform: translateY(18px); transition: opacity 700ms cubic-bezier(.16,1,.3,1),transform 700ms cubic-bezier(.16,1,.3,1); }
.reveal.is-visible { opacity: 1; transform: none; }
@media (max-width: 1080px) {
    .hero-inner { grid-template-columns: 1fr; }
    .hero-copy { max-width: 620px; }
    .hero-lede { max-width: 56ch; }
}
@media (max-width: 900px) {
    .site-nav { display: none; }
    .nav-toggle { display: grid; }
    .value-head, .section-head { grid-template-columns: 1fr; align-items: start; }
    .feature-group { grid-template-columns: 1fr; gap: 24px; }
    .group-cards, .feature-group.is-flipped .group-cards { grid-template-columns: 1fr; }
    .feature-group.is-flipped .feature-card-wide, .feature-group.is-flipped .feature-card:not(.feature-card-wide) { grid-row: auto; grid-column: auto; }
    .process-track { grid-template-columns: 1fr; gap: 40px; }
    .process-track::before { top: 0; bottom: 0; left: 5px; width: 1px; height: auto; }
    .process-step { padding-top: 0; padding-left: 32px; }
    .step-num { top: 2px; left: -13px; padding: 0; background: transparent; }
    .cta-panel { grid-template-columns: 1fr; }
}
@media (max-width: 720px) {
    .desktop-cta { display: none; }
    .hero-inner { gap: 56px; padding-block: 56px; }
    .hero {
        background-position: 12% center;
    }
    .hero-copy { padding: 26px 22px; border-radius: 18px; background: rgba(4,15,17,.56); backdrop-filter: blur(7px); }
    .hero-ctas .site-button { flex: 1 1 auto; }
    .value-list li { grid-template-columns: 56px 1fr; }
    .footer-inner { flex-direction: column; align-items: flex-start; }
}
@media (max-width: 480px) {
    .site-container { width: min(100% - 1.5rem,1180px) !important; }
    .feature-card { padding: 24px; }
}
@media (prefers-reduced-motion: reduce) {
    .eigen-site *, .eigen-site *::before, .eigen-site *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
    .reveal { opacity: 1; transform: none; }
}
`;
