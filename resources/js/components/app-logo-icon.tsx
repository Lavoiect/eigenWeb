import type { ImgHTMLAttributes } from 'react';

export default function AppLogoIcon({
    alt = 'Eigen Learning',
    className,
    ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
    return (
        <img
            {...props}
            src="/eigen_logo.png"
            alt={alt}
            className={`object-contain ${className ?? ''}`}
        />
    );
}
