"use client";

import { useGameRoom } from "@/context/roomContext";
import { useWebSocket } from "@/context/wsContext";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlayerColor } from "@/types/types";

export const DevOverlay = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({ x: 16, y: 16 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const { isConnected, clientId, latency } = useWebSocket();
    const {
        roomId,
        username,
        inRoom,
        isSpectator,
        gameStatus,
        gameType,
        gameMode,
        currentPlayer,
        opponentPlayer,
        currentTurn,
        activePlayer,
    } = useGameRoom();

    useEffect(() => {
        // Toggle with Ctrl+Shift+D
        const handleKeyDown = (event: KeyboardEvent) => {
            if (
                event.key === "D" &&
                event.shiftKey &&
                (event.ctrlKey || event.metaKey)
            ) {
                event.preventDefault();
                setIsVisible((prev) => !prev);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Handle dragging
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                setPosition({
                    x: e.clientX - dragOffset.x,
                    y: e.clientY - dragOffset.y,
                });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
        }

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isDragging, dragOffset]);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.parentElement?.getBoundingClientRect();
        if (rect) {
            setDragOffset({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            });
            setIsDragging(true);
        }
    };

    if (!isVisible) return null;

    const InfoRow = ({ label, value }: { label: string; value: any }) => (
        <div className='flex justify-between gap-4 py-1 border-b border-gray-700'>
            <span className='font-semibold text-gray-300'>{label}:</span>
            <span className='text-gray-100 font-mono text-sm'>
                {value !== null && value !== undefined ? value : "null"}
            </span>
        </div>
    );

    const Section = ({
        title,
        children,
    }: {
        title: string;
        children: React.ReactNode;
    }) => (
        <div className='mb-4'>
            <h3 className='text-lg font-bold text-white mb-2 border-b-2 border-blue-500 pb-1'>
                {title}
            </h3>
            <div className='space-y-1'>{children}</div>
        </div>
    );

    return (
        <div
            className='fixed z-[9999] max-h-[80vh] overflow-auto'
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                cursor: isDragging ? "grabbing" : "default",
            }}
        >
            <div className='bg-black/70 backdrop-blur-sm text-white p-4 rounded-lg shadow-2xl border border-gray-700 min-w-[400px] max-w-[500px]'>
                <div
                    className='flex justify-between items-center mb-4 border-b-2 border-gray-600 pb-2 cursor-grab active:cursor-grabbing'
                    onMouseDown={handleMouseDown}
                >
                    <h2 className='text-xl font-bold text-blue-400'>
                        Dev Overlay
                    </h2>
                    <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => setIsVisible(false)}
                        className='h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-800'
                    >
                        <X className='h-4 w-4' />
                    </Button>
                </div>

                <Section title='WebSocket'>
                    <InfoRow
                        label='Connected'
                        value={isConnected ? "Yes" : "No"}
                    />
                    <InfoRow
                        label='Client ID'
                        value={clientId || "Not assigned"}
                    />
                    <InfoRow label='Latency' value={`${latency} ms`} />
                </Section>

                <Section title='Room Info'>
                    <InfoRow label='Room ID' value={roomId || "Not in room"} />
                    <InfoRow label='Username' value={username || "Not set"} />
                    <InfoRow label='In Room' value={inRoom ? "Yes" : "No"} />
                    <InfoRow
                        label='Is Spectator'
                        value={isSpectator ? "Yes" : "No"}
                    />
                </Section>

                <Section title='Game State'>
                    <InfoRow label='Status' value={gameStatus} />
                    <InfoRow label='Game Type' value={gameType || "Not set"} />
                    <InfoRow label='Game Mode' value={gameMode || "Not set"} />
                    <InfoRow
                        label='Current Turn'
                        value={
                            currentTurn !== null
                                ? `${currentTurn === PlayerColor.WHITE ? "White" : "Black"} (${currentTurn})`
                                : "Not started"
                        }
                    />
                </Section>

                <Section title='Players'>
                    {currentPlayer ? (
                        <>
                            <div className='bg-blue-900/30 p-2 rounded mb-2'>
                                <div className='text-blue-300 font-semibold mb-1'>
                                    You:
                                </div>
                                <InfoRow
                                    label='Name'
                                    value={currentPlayer.username || "Unknown"}
                                />
                                <InfoRow
                                    label='Color'
                                    value={
                                        currentPlayer.color !== null
                                            ? `${currentPlayer.color === PlayerColor.WHITE ? "White" : "Black"} (${currentPlayer.color})`
                                            : "Not assigned"
                                    }
                                />
                                <InfoRow
                                    label='Is Active'
                                    value={
                                        currentPlayer.is_active ? "Yes" : "No"
                                    }
                                />
                            </div>
                        </>
                    ) : (
                        <div className='text-gray-500 italic'>
                            No player data
                        </div>
                    )}

                    {opponentPlayer ? (
                        <>
                            <div className='bg-purple-900/30 p-2 rounded'>
                                <div className='text-purple-300 font-semibold mb-1'>
                                    Opponent:
                                </div>
                                <InfoRow
                                    label='Name'
                                    value={opponentPlayer.username || "Unknown"}
                                />
                                <InfoRow
                                    label='Color'
                                    value={
                                        opponentPlayer.color !== null
                                            ? `${opponentPlayer.color === PlayerColor.WHITE ? "White" : "Black"} (${opponentPlayer.color})`
                                            : "Not assigned"
                                    }
                                />
                                <InfoRow
                                    label='Is Active'
                                    value={
                                        opponentPlayer.is_active ? "Yes" : "No"
                                    }
                                />
                            </div>
                        </>
                    ) : (
                        <div className='text-gray-500 italic'>
                            No opponent data
                        </div>
                    )}

                    {activePlayer && (
                        <div className='mt-2 bg-green-900/30 p-2 rounded'>
                            <div className='text-green-300 font-semibold mb-1'>
                                Active Player:
                            </div>
                            <InfoRow
                                label='Name'
                                value={activePlayer.username || "Unknown"}
                            />
                            <InfoRow
                                label='Color'
                                value={
                                    activePlayer.color !== null
                                        ? `${activePlayer.color === PlayerColor.WHITE ? "White" : "Black"} (${activePlayer.color})`
                                        : "Not assigned"
                                }
                            />
                        </div>
                    )}
                </Section>

                <div className='mt-4 text-xs text-gray-500 text-center'>
                    Last updated: {new Date().toLocaleTimeString()}
                </div>
            </div>
        </div>
    );
};
