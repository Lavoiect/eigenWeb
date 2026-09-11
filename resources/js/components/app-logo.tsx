import AppLogoIcon from '@/components/app-logo-icon';

export default function AppLogo() {
    return (
        <>
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-[#123d31] shadow-sm shadow-[#123d31]/20">
                <AppLogoIcon alt="" className="size-5" />
            </div>
            <div className="ml-1 grid flex-1 text-left">
                <span className="truncate text-sm leading-tight font-semibold tracking-tight">
                    Eigen
                </span>
                <span className="truncate text-[0.65rem] leading-tight text-sidebar-foreground/55">
                    Workforce learning
                </span>
            </div>
        </>
    );
}
