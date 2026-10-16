"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Move {
    id: number;
    player: string;
    notation: string;
}

interface MoveHistoryProps {
    moves: Move[];
    currentPlayerUsername?: string;
    isSpectator: boolean;
}

export function MoveHistory({
    moves,
    currentPlayerUsername,
    isSpectator,
}: MoveHistoryProps) {
    const viewportRef = useRef<HTMLDivElement>(null);
    const moveHistoryEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (viewportRef.current) {
            viewportRef.current.scrollTo({
                top: viewportRef.current.scrollHeight,
                behavior: "smooth",
            });
        }
    }, [moves]);

    return (
        <ScrollArea className='h-full rounded-md' viewportRef={viewportRef}>
            <div className='px-4'>
                {moves.map((move) => (
                    <div
                        key={move.id}
                                                className={`mt-1 flex items-center justify-between rounded-md border-l-2 px-3 py-2 transition-colors ${
                            isSpectator
                                                                ? "border-slate-400/60 bg-slate-500/10 text-slate-100"
                                : move.player === currentPlayerUsername
                                                                    ? "border-violet-400/70 bg-violet-500/15 text-violet-100"
                                                                    : "border-red-400/60 bg-red-500/10 text-red-100"
                        }`}
                    >
                        <span className='text-sm font-medium w-3/4'>
                            {move.id}.
                            <span className='ml-1 text-xs'>{move.player}</span>
                        </span>
                        <span className='font-mono text-sm w-1/4 text-right'>
                            {move.notation}
                        </span>
                    </div>
                ))}
                {moves.length === 0 && (
                    <p className='text-center text-sm text-gray-500 dark:text-gray-400 py-4'>
                        No moves played yet.
                    </p>
                )}
                <div ref={moveHistoryEndRef} />
            </div>
        </ScrollArea>
    );
}
