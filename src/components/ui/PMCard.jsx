import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

const PMCard = forwardRef(
    ({ className, withGlow = true, withBorder = true, children, ...props }, ref) => {
        return (
            <div className="relative group" ref={ref} {...props}>
                {/* Glow effect on hover */}
                {withGlow && (
                    <div className="absolute -inset-[1px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 ring-1 ring-[hsl(var(--pm-primary))]/15" />
                )}

                {/* Main card */}
                <div
                    className={cn(
                        'relative bg-[hsl(var(--pm-surface))] rounded-xl',
                        'transition-colors duration-200',
                        withBorder && 'border border-[hsl(var(--pm-border))]',
                        withGlow && 'group-hover:shadow-sm',
                        className
                    )}
                >
                    {children}
                </div>
            </div>
        );
    }
);

PMCard.displayName = 'PMCard';

export { PMCard };
