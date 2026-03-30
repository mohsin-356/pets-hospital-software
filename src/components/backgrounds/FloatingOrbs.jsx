import React from 'react';

export function FloatingOrbs() {
    return (
        <>
            <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-[hsl(var(--pm-primary))]/10 blur-3xl pointer-events-none" />
            <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-[hsl(var(--pm-secondary))]/10 blur-3xl pointer-events-none" />
        </>
    );
}
