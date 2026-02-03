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
                        className={`flex items-center justify-between py-1 px-2 rounded-md transition-colors mt-1 ${
                            isSpectator
                                ? "bg-gray-50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-200"
                                : move.player === currentPlayerUsername
                                  ? "bg-blue-50 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200"
                                  : "bg-red-50 dark:bg-red-900/50 text-red-800 dark:text-red-200"
                        }`}
                    >
                        <span className='text-sm font-medium w-1/4'>
                            {move.id}.
                            <span className='ml-1 text-xs'>{move.player}</span>
                        </span>
                        <span className='font-mono text-sm w-3/4 text-right'>
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
