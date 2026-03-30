import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

const PMButton = forwardRef(
    ({ className, variant = 'primary', size = 'md', isLoading, children, ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    // Base styles
                    'inline-flex items-center justify-center gap-2',
                    'font-medium transition-colors duration-200',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--pm-primary))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--pm-bg))]',

                    // Variants
                    {
                        'bg-[hsl(var(--pm-primary))] text-white hover:bg-[hsl(var(--pm-primary-hover))] active:bg-[hsl(var(--pm-primary-active))]':
                            variant === 'primary',
                        'bg-[hsl(var(--pm-surface))] border border-[hsl(var(--pm-border))] text-[hsl(var(--pm-text))] hover:bg-[hsl(var(--pm-bg))]':
                            variant === 'secondary',
                        'bg-transparent text-[hsl(var(--pm-text))] hover:bg-[hsl(var(--pm-bg))]':
                            variant === 'ghost',
                        'bg-[hsl(var(--pm-error))] text-white hover:brightness-95 active:brightness-90':
                            variant === 'danger',
                    },

                    // Sizes
                    {
                        'h-8 px-3 text-sm rounded-md': size === 'sm',
                        'h-10 px-4 text-sm rounded-md': size === 'md',
                        'h-12 px-6 text-base rounded-lg': size === 'lg',
                    },

                    className
                )}
                disabled={isLoading || props.disabled}
                {...props}
            >
                {isLoading && (
                    <Loader2 className="animate-spin h-4 w-4" />
                )}
                {children}
            </button>
        );
    }
);

PMButton.displayName = 'PMButton';

export { PMButton };
