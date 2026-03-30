import React from 'react';

export function TechGridPattern({ opacity = 0.03 }) {
    return (
        <div className="absolute inset-0 pointer-events-none" style={{ opacity }}>
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="tech-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path
                            d="M 40 0 L 0 0 0 40"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1"
                            className="text-[hsl(var(--pm-text))]"
                        />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#tech-grid)" />
            </svg>
        </div>
    );
}
