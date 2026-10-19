import { Ellipsis, MessageSquare, Send } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { useWebSocket } from "@/context/wsContext";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useState, useRef, useEffect, KeyboardEvent, useCallback } from "react";
import { ChatMessage, MessageEvent, PlayerColor } from "@/types/types";
import { useGameRoom } from "@/context/roomContext";
import { Switch } from "../ui/switch";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "../ui/card";

type ChatEntry =
    | { kind: "message"; id: number; message: ChatMessage }
    | { kind: "status"; id: number; text: string };

export function Chat({
    initialMessages,
    initialSpectatorCount = 0,
}: {
    initialMessages?: ChatMessage[];
    initialSpectatorCount?: number;
}) {
    const { clientId, isConnected, on, sendRequest } = useWebSocket();
    const { isSpectator, gameStatus, currentPlayer, opponentPlayer } =
        useGameRoom();

    const nextEntryId = useRef(initialMessages?.length ?? 0);
    const [chatEntries, setChatEntries] = useState<ChatEntry[]>(() =>
        (initialMessages || []).map((message, id) => ({
            kind: "message",
            id,
            message,
        })),
    );
    const [spectatorCount, setSpectatorCount] = useState(initialSpectatorCount);
    const [messageInput, setMessageInput] = useState("");
    const [isChatMuted, setIsChatMuted] = useState(false);
    const [areSpectatorsMuted, setAreSpectatorsMuted] = useState(false);

    const bottomChatRef = useRef<HTMLSpanElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const hasReportedGameStartRef = useRef(gameStatus === "ongoing");
    const usernamesByIdRef = useRef(new Map<string, string>());
    const usernamesByColorRef = useRef(new Map<PlayerColor, string>());

    useEffect(() => {
        for (const player of [currentPlayer, opponentPlayer]) {
            if (!player) continue;
            usernamesByIdRef.current.set(player.id, player.username);
            if (player.color !== null) {
                usernamesByColorRef.current.set(player.color, player.username);
            }
        }
        for (const message of initialMessages || []) {
            usernamesByIdRef.current.set(message.client_id, message.username);
        }
    }, [currentPlayer, initialMessages, opponentPlayer]);

    const appendMessage = useCallback((message: ChatMessage) => {
        const id = nextEntryId.current++;
        setChatEntries((entries) => [
            ...entries,
            { kind: "message", id, message },
        ]);
    }, []);

    const appendStatus = useCallback((text: string) => {
        const id = nextEntryId.current++;
        setChatEntries((entries) => [...entries, { kind: "status", id, text }]);
    }, []);

    useEffect(() => {
        if (gameStatus === "ongoing" && !hasReportedGameStartRef.current) {
            hasReportedGameStartRef.current = true;
            appendStatus("Game started.");
        }
    }, [appendStatus, gameStatus]);

    const handleChatMuteChange = (muted: boolean) => {
        setIsChatMuted(muted);
        appendStatus(
            muted
                ? "Chat muted. Incoming messages are hidden and sending is disabled."
                : "Chat unmuted.",
        );
    };

    const handleSpectatorMuteChange = (muted: boolean) => {
        setAreSpectatorsMuted(muted);
        appendStatus(
            muted ? "Spectator messages muted." : "Spectator messages unmuted.",
        );
    };

    const handleSendMessage = () => {
        if (!isConnected || !clientId || isChatMuted) return;

        const messageCotent = messageInput.trim();
        if (messageCotent === "") return;

        setMessageInput("");

        sendRequest("message", { content: messageCotent })
            .then(() => {
                appendMessage({
                    client_id: clientId,
                    username: "You",
                    message: messageCotent,
                    is_spectator: isSpectator,
                });
            })
            .catch((error) => {
                console.error("Error sending message:", error);
            });
    };

    const handleKeyPress = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            handleSendMessage();
        }
    };

    const onMessageReceived = useCallback(
        (msg: MessageEvent) => {
            if (isChatMuted || (areSpectatorsMuted && msg.is_spectator)) return;

            usernamesByIdRef.current.set(msg.client_id, msg.username);
            const newMessage = {
                client_id: msg.client_id,
                username: msg.username,
                message: msg.message,
                is_spectator: msg.is_spectator,
            };
            appendMessage(newMessage);
        },
        [appendMessage, areSpectatorsMuted, isChatMuted],
    );

    useEffect(() => {
        if (isConnected && clientId) {
            const cleanup = on("chat", onMessageReceived);
            return cleanup;
        }
    }, [isConnected, clientId, on, onMessageReceived]);

    useEffect(() => {
        if (!isConnected) return;

        const cleanupJoined = on<{
            spectator_id: string;
            username: string;
            spectator_count: number;
        }>("spectator_joined", (payload) => {
            setSpectatorCount(payload.spectator_count);
            usernamesByIdRef.current.set(
                payload.spectator_id,
                payload.username,
            );
            appendStatus(`${payload.username} joined as a spectator.`);
        });
        const cleanupLeft = on<{
            spectator_id: string;
            spectator_count: number;
            username?: string;
        }>("spectator_left", (payload) => {
            setSpectatorCount(payload.spectator_count);
            const name =
                payload.username ||
                usernamesByIdRef.current.get(payload.spectator_id) ||
                "A spectator";
            appendStatus(`${name} left the room.`);
            usernamesByIdRef.current.delete(payload.spectator_id);
        });
        const cleanupPlayerLeft = on<{
            player_id: string;
            username?: string;
        }>("player_left", (payload) => {
            const name =
                payload.username ||
                usernamesByIdRef.current.get(payload.player_id) ||
                "A player";
            appendStatus(`${name} left the room.`);
        });
        const cleanupPlayerRejoined = on<{
            player_id: string;
            game_state: {
                players: { id: string; username: string; color: PlayerColor }[];
            };
        }>("player_rejoined", (payload) => {
            const player = payload.game_state.players.find(
                (item) => item.id === payload.player_id,
            );
            const name =
                player?.username ||
                usernamesByIdRef.current.get(payload.player_id) ||
                "A player";
            if (player) {
                usernamesByIdRef.current.set(player.id, player.username);
                usernamesByColorRef.current.set(player.color, player.username);
            }
            appendStatus(`${name} rejoined the room.`);
        });
        const cleanupStart = on<{
            players: { id: string; username: string; color: PlayerColor }[];
        }>("start", (payload) => {
            for (const player of payload.players) {
                const knownName = usernamesByIdRef.current.get(player.id);
                if (!knownName && player.id !== clientId) {
                    appendStatus(`${player.username} joined the room.`);
                }
                usernamesByIdRef.current.set(player.id, player.username);
                usernamesByColorRef.current.set(player.color, player.username);
            }
            hasReportedGameStartRef.current = true;
            appendStatus("Game started.");
        });
        const cleanupEnd = on<{
            reason: string;
            winner?: PlayerColor;
        }>("end", (payload) => {
            if (payload.reason === "draw" || payload.winner === undefined) {
                appendStatus("The game ended in a draw.");
                return;
            }
            const winnerName = usernamesByColorRef.current.get(payload.winner);
            appendStatus(
                winnerName ? `${winnerName} won the game.` : "The game ended.",
            );
        });

        return () => {
            cleanupJoined();
            cleanupLeft();
            cleanupPlayerLeft();
            cleanupPlayerRejoined();
            cleanupStart();
            cleanupEnd();
        };
    }, [appendStatus, clientId, isConnected, on]);

    useEffect(() => {
        if (viewportRef.current) {
            viewportRef.current.scrollTo({
                top: viewportRef.current.scrollHeight,
                behavior: "smooth",
            });
        }
    }, [chatEntries]);

    return (
        <Card className='flex flex-col gap-0 overflow-hidden rounded-lg border-white/10 bg-white/2.5 py-0 shadow-[0_14px_42px_-30px_rgba(0,0,0,0.85)] md:min-h-80 md:flex-1'>
            <CardHeader className='flex flex-row justify-between items-center gap-2 border-b border-white/[0.07] px-4 py-3!'>
                <CardTitle className='flex items-center text-sm font-semibold text-slate-100'>
                    <MessageSquare size={16} className='mr-2 text-violet-300' />
                    Room Chat
                    {spectatorCount > 0 && (
                        <span className='ml-2 rounded-full border border-white/10 bg-white/4 px-2 py-0.5 text-[10px] font-medium text-slate-400'>
                            {spectatorCount}{" "}
                            {spectatorCount === 1 ? "spectator" : "spectators"}
                        </span>
                    )}
                </CardTitle>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant='ghost'
                            size='icon'
                            aria-label='Chat options'
                            title='Chat options'
                            className='size-8 text-slate-400 hover:text-slate-100'
                        >
                            <Ellipsis size={18} />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='end' className='w-64'>
                        <DropdownMenuLabel>Chat options</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <div className='flex items-center justify-between gap-3 px-2 py-2'>
                            <div className='min-w-0'>
                                <label
                                    htmlFor='mute-chat'
                                    className='text-sm font-medium'
                                >
                                    Mute chat
                                </label>
                                <p className='text-xs text-muted-foreground'>
                                    Hide all messages and disable sending
                                </p>
                            </div>
                            <Switch
                                id='mute-chat'
                                checked={isChatMuted}
                                onCheckedChange={handleChatMuteChange}
                            />
                        </div>
                        <div className='flex items-center justify-between gap-3 px-2 py-2'>
                            <div className='min-w-0'>
                                <label
                                    htmlFor='mute-spectators'
                                    className='text-sm font-medium'
                                >
                                    Mute spectators
                                </label>
                                <p className='text-xs text-muted-foreground'>
                                    Hide messages from spectators
                                </p>
                            </div>
                            <Switch
                                id='mute-spectators'
                                checked={areSpectatorsMuted}
                                onCheckedChange={handleSpectatorMuteChange}
                            />
                        </div>
                    </DropdownMenuContent>
                </DropdownMenu>
            </CardHeader>
            <CardContent className='h-80 p-0 md:min-h-0 md:flex-1'>
                <ScrollArea
                    className='h-full px-3 py-4'
                    viewportRef={viewportRef}
                >
                    <div className='flex flex-col'>
                        {chatEntries.map((entry) =>
                            entry.kind === "status" ? (
                                <div
                                    key={entry.id}
                                    role='status'
                                    className='my-1 border-l-2 border-amber-300/40 px-2 py-1 text-xs text-amber-100/80'
                                >
                                    {entry.text}
                                </div>
                            ) : (
                                <div
                                    key={entry.id}
                                    className='rounded-sm px-2 py-0.5 hover:bg-white/[0.035]'
                                >
                                    <strong className='mr-1 text-sm font-semibold text-slate-100'>
                                        {entry.message.client_id === clientId
                                            ? "You"
                                            : entry.message.username}
                                    </strong>
                                    {entry.message.is_spectator && (
                                        <span className='mr-1 inline-flex items-center rounded-sm border border-amber-300/25 bg-amber-300/10 px-1.5 py-0.5 align-middle text-[9px] font-semibold leading-none text-amber-200'>
                                            spectator
                                        </span>
                                    )}
                                    <span className='wrap-anywhere whitespace-pre-wrap text-sm leading-5 text-slate-300'>
                                        {entry.message.message}
                                    </span>
                                </div>
                            ),
                        )}
                        <span ref={bottomChatRef}></span>
                    </div>
                </ScrollArea>
            </CardContent>
            <CardFooter className='border-t! border-white/8! p-3!'>
                <div className='flex w-full gap-2'>
                    <Input
                        placeholder={
                            isChatMuted ? "Chat is muted" : "Type a message..."
                        }
                        disabled={isChatMuted}
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        className='min-w-0 flex-1 border-white/10 bg-black/25 placeholder:text-slate-500 focus-visible:border-violet-400 focus-visible:ring-violet-400/25'
                    />
                    <Button
                        aria-label='Send message'
                        onClick={handleSendMessage}
                        disabled={isChatMuted || messageInput.trim() === ""}
                        className='bg-violet-600 text-white hover:bg-violet-500'
                    >
                        <Send size={18} />
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
}
