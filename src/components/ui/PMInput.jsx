import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

const PMInput = forwardRef(
    ({ className, label, error, leftIcon, rightIcon, ...props }, ref) => {
        return (
            <div className="space-y-2">
                {label && (
                    <label className="text-xs font-medium text-[hsl(var(--pm-text))]">
                        {label}
                        {props.required && <span className="text-[hsl(var(--pm-error))] ml-1">*</span>}
                    </label>
                )}

                <div className="relative group">
                    {/* Focus glow */}
                    <div className="absolute -inset-[2px] rounded-md opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none ring-2 ring-[hsl(var(--pm-primary))]/35" />

                    <div className="relative flex items-center">
                        {leftIcon && (
                            <div className="absolute left-3 text-[hsl(var(--pm-text-muted))] flex items-center justify-center">
                                {leftIcon}
                            </div>
                        )}

                        <input
                            ref={ref}
                            className={cn(
                                'w-full h-10 px-3 bg-[hsl(var(--pm-surface))] border border-[hsl(var(--pm-border))] rounded-md',
                                'text-[hsl(var(--pm-text))] placeholder:text-[hsl(var(--pm-text-muted))]',
                                'focus:outline-none focus:border-[hsl(var(--pm-primary))] focus:ring-2 focus:ring-[hsl(var(--pm-primary))]/20',
                                'transition-colors duration-200',
                                leftIcon && 'pl-10',
                                rightIcon && 'pr-10',
                                error && 'border-[hsl(var(--pm-error))] focus:ring-[hsl(var(--pm-error))]/20',
                                className
                            )}
                            {...props}
                        />

                        {rightIcon && (
                            <div className="absolute right-3 text-[hsl(var(--pm-text-muted))] flex items-center justify-center">
                                {rightIcon}
                            </div>
                        )}
                    </div>
                </div>

                {error && (
                    <p className="text-xs text-[hsl(var(--pm-error))] flex items-center gap-1">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        {error}
                    </p>
                )}
            </div>
        );
    }
);

PMInput.displayName = 'PMInput';

export { PMInput };
