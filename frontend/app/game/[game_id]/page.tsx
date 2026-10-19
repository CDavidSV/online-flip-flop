"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Flag, LogOut } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useGameRoom } from "@/context/roomContext";
import { useWebSocket } from "@/context/wsContext";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import FlipFlopLoader from "@/components/FlipFlopLoader/FlipFlopLoader";
import { toast } from "sonner";
import { isWSError, getErrorInfo, isErrorCode } from "@/lib/errorHandler";
import { ErrorCode } from "@/types/types";
import { Spinner } from "@/components/ui/spinner";
import { useEffect, useState, useCallback } from "react";
import { Chat } from "@/components/Chat/Chat";
import { FlipFlop } from "@/components/FlipFlop/FlipFlop";
import { MoveHistory } from "@/components/FlipFlop/MoveHistory";
import { cn } from "@/lib/utils";
import z from "zod";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    ChatMessage,
    GameMoveMsg,
    GameEndMsg,
    JoinGameResponse,
    PlayerColor,
} from "@/types/types";

const usernameFormSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters long"),
});

export default function GamePage() {
    const { game_id } = useParams<{ game_id: string }>();
    const { isConnected, on, sendRequest } = useWebSocket();
    const router = useRouter();
    const {
        inRoom,
        gameType,
        gameMode,
        gameStatus,
        joinRoom,
        forfeitGame,
        currentPlayer,
        opponentPlayer,
        currentTurn,
        setCurrentTurn,
        isSpectator,
        activePlayer,
        username,
    } = useGameRoom();

    const [copied, setCopied] = useState(false);
    const [openDialog, setOpenDialog] = useState<
        "username" | "forfeit" | "leave" | null
    >(null);
    const [joinLoading, setJoinLoading] = useState(false);
    const [forfeitLoading, setForfeitLoading] = useState(false);
    const [showLoadingOverlay, setShowLoadingOverlay] = useState(true);
    const [loadingOverlayMsg, setLoadingOverlayMsg] = useState(
        "Connecting to server...",
    );
    const [attemptedRejoin, setAttemptedRejoin] = useState(false);
    const [hasLeftRoom, setHasLeftRoom] = useState(false);

    // Game end state
    const [rematch, setRematch] = useState<
        "requested" | "opponent_requested" | null
    >(null);
    const [showGameEnd, setShowGameEnd] = useState(false);
    const [gameEndResult, setGameEndResult] = useState<{
        winner: PlayerColor | null;
        reason: string;
    } | null>(null);

    // Initial game variables
    const [moves, setMoves] = useState<
        { id: number; player: string; notation: string }[]
    >([]);
    const [initialGameBoard, setInitialGameBoard] = useState<
        string | undefined
    >(undefined);
    const [initialChatMessages, setInitialChatMessages] = useState<
        ChatMessage[]
    >([]);
    const [initialSpectatorCount, setInitialSpectatorCount] = useState(0);

    const isMyTurn = !isSpectator && currentTurn === currentPlayer?.color;

    const usernameform = useForm<z.infer<typeof usernameFormSchema>>({
        resolver: zodResolver(usernameFormSchema),
        defaultValues: {
            username: username || "",
        },
    });

    const handleRoomError = useCallback(
        (error: unknown, formContext?: typeof usernameform) => {
            if (!isWSError(error)) {
                toast.error("An error occurred while joining the game");
                return;
            }

            const errorInfo = getErrorInfo(error);

            // Handle validation errors if form context provided
            if (
                formContext &&
                isErrorCode(error, ErrorCode.VALIDATION_FAILED) &&
                error.details
            ) {
                const validationErrors = error.details as Record<
                    string,
                    string
                >;

                if (validationErrors.username) {
                    formContext.setError("username", {
                        type: "manual",
                        message: validationErrors.username,
                    });
                }
                if (validationErrors.room_id) {
                    toast.error(validationErrors.room_id);
                    setTimeout(() => router.push("/"), 2000);
                }
                return;
            }

            // Handle common error cases
            switch (errorInfo.code) {
                case ErrorCode.ROOM_NOT_FOUND:
                case ErrorCode.ROOM_CLOSED:
                case ErrorCode.GAME_ENDED:
                case ErrorCode.ROOM_FULL:
                    toast.error(errorInfo.message);
                    router.push("/");
                    break;
                default:
                    if (formContext) {
                        formContext.setError("root", {
                            type: "manual",
                            message: errorInfo.message,
                        });
                    } else {
                        toast.error(errorInfo.message || "Failed to join game");
                    }
                    break;
            }
        },
        [router],
    );

    const addMove = (from: string, to: string, playerName: string) => {
        setMoves((prevMoves) => {
            const moveNumber = prevMoves.length + 1;
            return [
                ...prevMoves,
                {
                    id: moveNumber,
                    player: playerName,
                    notation: `${from}-${to}`,
                },
            ];
        });
    };

    const rebuildMoveHistory = useCallback(
        (joinGameResponse: JoinGameResponse) => {
            const moves: any = [];
            joinGameResponse.game_state.move_history.forEach((move) => {
                const player = joinGameResponse.game_state.players.find(
                    (p) => p.color === move.player,
                )?.username;
                moves.push({
                    id: moves.length + 1,
                    player: player,
                    notation: move.notation,
                });
            });

            setMoves(moves);
        },
        [],
    );

    const handleGameEnd = useCallback(
        (winner: PlayerColor | null, reason: string) => {
            setGameEndResult({ winner, reason });
            setShowGameEnd(true);
        },
        [],
    );

    const copyRoomId = async () => {
        try {
            await navigator.clipboard.writeText(game_id);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy text: ", err);
        }
    };

    const usernameFormSubmit = (data: z.infer<typeof usernameFormSchema>) => {
        if (!game_id) {
            router.push("/");
            return;
        }

        setJoinLoading(true);

        joinRoom(game_id, data.username)
            .then((value: JoinGameResponse) => {
                setShowLoadingOverlay(false);
                setOpenDialog(null);
                setJoinLoading(false);
                setInitialChatMessages(value.messages || []);
                setInitialSpectatorCount(value.spectator_count || 0);

                if (value.is_spectator) {
                    setInitialGameBoard(value.game_state.board);
                    rebuildMoveHistory(value);
                }
            })
            .catch((error) => {
                console.error("Error joining room:", error);
                setJoinLoading(false);
                handleRoomError(error, usernameform);
            });
    };

    const handleForfeit = () => {
        setOpenDialog("forfeit");
    };

    const confirmForfeit = () => {
        setForfeitLoading(true);

        forfeitGame()
            .then(() => {
                toast.success("You have forfeited the game");
                setOpenDialog(null);
            })
            .catch((error: unknown) => {
                if (isWSError(error)) {
                    const errorInfo = getErrorInfo(error);
                    toast.error(errorInfo.message || "Failed to forfeit game");
                } else {
                    toast.error("An error occurred while forfeiting the game");
                }
            })
            .finally(() => {
                setOpenDialog(null);
                setForfeitLoading(false);
            });
    };

    const handleMoveMade = (from: string, to: string) => {
        addMove(from, to, currentPlayer?.username || "Unknown");
    };

    const handleReturnToMenu = () => {
        setOpenDialog("leave");
    };

    const confirmLeaveGame = () => {
        setShowGameEnd(false);
        router.push("/");
    };

    const requestRematch = () => {
        if (rematch === "requested") return;

        sendRequest("rematch", null)
            .then(() => {
                setRematch("requested");
            })
            .catch((reason: unknown) => {
                console.error("Rematch request failed:", reason);
                toast.error("Failed to request rematch.");
            });
    };

    const cancelRematchRequest = () => {
        if (rematch !== "requested") return;

        sendRequest("cancel_rematch", null)
            .then(() => {
                setRematch(null);
            })
            .catch((reason: unknown) => {
                console.error("Cancel rematch request failed:", reason);
                toast.error("Failed to cancel rematch request.");
            });
    };

    useEffect(() => {
        if (gameStatus === "closed") {
            setHasLeftRoom(true);
            return;
        }

        // Redirect to home if game_id is not provided
        if (!game_id || game_id.length !== 4) {
            router.push("/");
            return;
        }

        if (isConnected) {
            // If user is already in the room, hide loading overlay
            if (inRoom) {
                setShowLoadingOverlay(false);
                return;
            }

            // Don't attempt to rejoin if player left the room
            if (hasLeftRoom) return;

            // First, attempt to rejoin without username (for reconnecting players)
            if (!attemptedRejoin) {
                setLoadingOverlayMsg("Joining game...");
                setAttemptedRejoin(true);

                joinRoom(game_id)
                    .then((value: JoinGameResponse) => {
                        // Successfully rejoined
                        setShowLoadingOverlay(false);
                        setInitialGameBoard(value.game_state.board);
                        setInitialChatMessages(value.messages || []);
                        rebuildMoveHistory(value);
                    })
                    .catch((error) => {
                        if (
                            isWSError(error) &&
                            isErrorCode(error, ErrorCode.USERNAME_REQUIRED)
                        ) {
                            // Username required
                            setOpenDialog("username");
                        } else {
                            setShowLoadingOverlay(false);
                            handleRoomError(error);
                        }
                    });
            }
        } else {
            setShowLoadingOverlay(true);
            setLoadingOverlayMsg("Connecting to server...");
        }
    }, [
        isConnected,
        inRoom,
        game_id,
        router,
        attemptedRejoin,
        hasLeftRoom,
        gameStatus,
        joinRoom,
        handleRoomError,
    ]);

    useEffect(() => {
        if (!isConnected) return;

        const cleanupMove = on("move", (payload: GameMoveMsg) => {
            if (payload.move.from && payload.move.to) {
                // Get player from id
                const player =
                    currentPlayer?.id === payload.player_id
                        ? currentPlayer
                        : opponentPlayer;

                addMove(
                    payload.move.from,
                    payload.move.to,
                    player?.username || "Unknown",
                );
            }
        });

        const cleanupStart = on("start", () => {
            // Game has started, white always starts
            setCurrentTurn(PlayerColor.WHITE);
            setMoves([]);
            setShowGameEnd(false);
            setRematch(null);
        });

        const cleanupEnd = on("end", (payload: GameEndMsg) => {
            handleGameEnd(payload.winner, payload.reason || "normal");
        });

        const cleanupRematch = on("rematch_requested", () => {
            setRematch("opponent_requested");
        });

        const cleanupRematchCancelled = on("rematch_cancelled", () => {
            setRematch(null);
        });

        return () => {
            cleanupMove();
            cleanupStart();
            cleanupEnd();
            cleanupRematch();
            cleanupRematchCancelled();
        };
    }, [
        isConnected,
        on,
        opponentPlayer,
        currentPlayer,
        isSpectator,
        setCurrentTurn,
        handleGameEnd,
    ]);

    return (
        <>
            {showLoadingOverlay && (
                <div className='absolute w-full h-full bg-background z-50 flex flex-col justify-center items-center gap-2'>
                    <FlipFlopLoader />
                    <p className='text-muted-foreground'>{loadingOverlayMsg}</p>
                </div>
            )}
            <Dialog open={openDialog === "username"}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Join Game</DialogTitle>
                        <DialogDescription>
                            Enter your player name to join the game.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...usernameform}>
                        <form
                            onSubmit={usernameform.handleSubmit(
                                usernameFormSubmit,
                            )}
                            className='space-y-8'
                        >
                            <FormField
                                control={usernameform.control}
                                name='username'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Player Name</FormLabel>
                                        <FormControl>
                                            <Input
                                                type='text'
                                                placeholder='Enter your player name'
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            ></FormField>
                            {usernameform.formState.errors.root && (
                                <div className='text-sm font-medium text-destructive'>
                                    {usernameform.formState.errors.root.message}
                                </div>
                            )}
                            <DialogFooter className='flex-col sm:flex-col gap-2'>
                                <Button
                                    className='w-full'
                                    type='submit'
                                    disabled={joinLoading}
                                >
                                    {joinLoading && <Spinner />}
                                    {joinLoading ? "Joining..." : "Submit"}
                                </Button>
                                <Button
                                    className='w-full'
                                    variant='outline'
                                    type='button'
                                    onClick={() => router.push("/")}
                                >
                                    Go Back
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
            <Dialog
                open={openDialog === "forfeit"}
                onOpenChange={(open) => setOpenDialog(open ? "forfeit" : null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Forfeit Game</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to forfeit this game?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className='flex-col sm:flex-col gap-2'>
                        <Button
                            className='w-full'
                            variant='destructive'
                            onClick={confirmForfeit}
                            disabled={forfeitLoading}
                        >
                            {forfeitLoading && <Spinner />}
                            {forfeitLoading ? "Forfeiting..." : "Yes, Forfeit"}
                        </Button>
                        <Button
                            className='w-full'
                            variant='outline'
                            onClick={() => setOpenDialog(null)}
                            disabled={forfeitLoading}
                        >
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog
                open={openDialog === "leave"}
                onOpenChange={(open) => setOpenDialog(open ? "leave" : null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Leave Game</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to leave this game?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className='flex-col sm:flex-col gap-2'>
                        <Button
                            className='w-full'
                            variant='destructive'
                            onClick={confirmLeaveGame}
                        >
                            Yes, Leave Game
                        </Button>
                        <Button
                            className='w-full'
                            variant='outline'
                            onClick={() => setOpenDialog(null)}
                        >
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Game End Popup */}
            {showGameEnd && gameEndResult && (
                <div className='fixed inset-0 z-40 flex items-center justify-center p-4 animate-in fade-in duration-300'>
                    <div className='fixed inset-0 bg-black/75 backdrop-blur-sm' />
                    <div
                        role='dialog'
                        aria-modal='true'
                        aria-labelledby='game-end-title'
                        className={cn(
                            "relative z-10 w-full max-w-md rounded-xl border bg-[#100d18]/95 p-6 text-center shadow-2xl backdrop-blur-xl sm:p-8",
                            gameEndResult.reason === "draw"
                                ? "border-white/10"
                                : gameEndResult.winner === currentPlayer?.color
                                  ? "border-emerald-400/30 shadow-[0_24px_80px_-32px_rgba(16,185,129,0.3)]"
                                  : "border-rose-400/25",
                        )}
                    >
                        <p
                            className={cn(
                                "text-xs font-semibold uppercase tracking-[0.18em]",
                                gameEndResult.reason === "draw"
                                    ? "text-muted-foreground"
                                    : gameEndResult.winner ===
                                        currentPlayer?.color
                                      ? "text-emerald-300"
                                      : "text-rose-300",
                            )}
                        >
                            {isSpectator ? "Game over" : "Match complete"}
                        </p>
                        <h2
                            id='game-end-title'
                            className={cn(
                                "mt-3 text-3xl font-bold sm:text-4xl",
                                gameEndResult.reason === "draw"
                                    ? "text-white"
                                    : gameEndResult.winner ===
                                        currentPlayer?.color
                                      ? "text-emerald-100"
                                      : "text-rose-100",
                            )}
                        >
                            {isSpectator
                                ? "GAME OVER"
                                : gameEndResult.reason === "draw"
                                  ? "DRAW"
                                  : gameEndResult.winner ===
                                      currentPlayer?.color
                                    ? "VICTORY"
                                    : "DEFEAT"}
                        </h2>
                        <p className='mt-3 text-sm leading-6 text-muted-foreground sm:text-base'>
                            {isSpectator
                                ? gameEndResult.winner === null
                                    ? "The match ended in a draw."
                                    : `${gameEndResult.winner === PlayerColor.WHITE ? "White" : "Black"} wins the match.`
                                : gameEndResult.reason === "draw"
                                  ? "Well played. The match ended in a draw."
                                  : gameEndResult.winner ===
                                      currentPlayer?.color
                                    ? "You won the match. Ready for another?"
                                    : "This one got away. Ready to try again?"}
                        </p>

                        {isSpectator ? (
                            <Button
                                onClick={handleReturnToMenu}
                                className='mt-7 h-10 w-full rounded-md bg-violet-600 text-white hover:bg-violet-500'
                            >
                                Leave Game
                            </Button>
                        ) : (
                            <>
                                <div className='mt-7 flex flex-col justify-center gap-2 sm:flex-row'>
                                    <Button
                                        variant='outline'
                                        onClick={handleReturnToMenu}
                                        className='h-10 border-white/10 bg-white/2.5 hover:border-violet-300/30 hover:bg-violet-500/[0.07] sm:flex-1'
                                    >
                                        Leave Game
                                    </Button>
                                    <Button
                                        variant='outline'
                                        onClick={() => setShowGameEnd(false)}
                                        className='h-10 border-white/10 bg-white/2.5 hover:border-violet-300/30 hover:bg-violet-500/[0.07] sm:flex-1'
                                    >
                                        Back to game
                                    </Button>
                                </div>
                                <div className='mt-3 border-t border-white/10 pt-3'>
                                    <Button
                                        onClick={() =>
                                            rematch !== "requested"
                                                ? requestRematch()
                                                : cancelRematchRequest()
                                        }
                                        className='h-10 w-full bg-violet-600 text-white hover:bg-violet-500'
                                    >
                                        {rematch === "opponent_requested"
                                            ? "Accept Rematch?"
                                            : rematch === "requested"
                                              ? "Cancel Rematch"
                                              : "Rematch?"}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
            <>
                {!gameType || !gameMode ? (
                    <div className='h-screen flex justify-center items-center'>
                        <FlipFlopLoader />
                    </div>
                ) : (
                    <div className='game-stage flex min-h-dvh flex-col gap-3 p-3 text-foreground md:h-dvh md:flex-row md:gap-4 md:overflow-hidden md:p-4'>
                        {/* Main Game Area */}
                        <div className='relative mb-0 flex min-w-0 flex-1 flex-col items-center justify-start rounded-lg border border-white/10 bg-white/2.5 p-3 shadow-[0_20px_70px_-38px_rgba(0,0,0,0.8)] md:overflow-hidden md:p-5'>
                            <div className='w-full'>
                                {gameStatus === "ongoing" && (
                                    <div
                                        className={`w-fit px-2 py-1 md:px-4 md:py-2 rounded-md md:rounded-lg font-semibold text-xs shadow-lg md:text-sm transition-all ${
                                            currentTurn === currentPlayer?.color
                                                ? "bg-blue-600/90 text-white shadow-blue-950/40 animate-pulse"
                                                : "bg-red-600/90 text-white shadow-red-950/30"
                                        }`}
                                    >
                                        {!isSpectator && (
                                            <>
                                                {isMyTurn
                                                    ? "Your Turn"
                                                    : "Opponent's Turn"}
                                            </>
                                        )}
                                        {isSpectator &&
                                            currentTurn !== null &&
                                            `${activePlayer?.username || "Unknown"} is playing`}
                                    </div>
                                )}
                            </div>

                            <div className='mb-4 text-center text-sm font-semibold text-red-300'>
                                {opponentPlayer && opponentPlayer.is_active
                                    ? opponentPlayer?.username
                                    : "Waiting for player to join..."}
                            </div>

                            <div className='w-full aspect-square md:aspect-auto md:flex-1 md:min-h-0 flex items-center justify-center md:@container-size'>
                                <div className='w-full h-full md:h-auto md:aspect-square md:w-[min(100cqw,100cqh)]'>
                                    <FlipFlop
                                        type={gameType}
                                        side={
                                            currentPlayer?.color ||
                                            PlayerColor.WHITE
                                        }
                                        initialBoardState={initialGameBoard}
                                        onMoveMade={handleMoveMade}
                                    />
                                </div>
                            </div>

                            <div className='mt-4 text-sm font-medium text-blue-300'>
                                {currentPlayer && currentPlayer.is_active
                                    ? currentPlayer?.username
                                    : "Waiting for player to join..."}
                            </div>
                        </div>

                        <div className='mb-0 flex w-full flex-col gap-3 overflow-y-auto md:min-h-0 md:w-88 md:gap-4'>
                            <Card className='shrink-0 gap-0 overflow-hidden rounded-lg border-white/10 bg-white/2.5 py-0 shadow-[0_14px_42px_-30px_rgba(0,0,0,0.8)]'>
                                <CardHeader className='gap-1 px-4 py-4'>
                                    <CardTitle className='flex items-center justify-between text-sm font-semibold text-slate-100'>
                                        Game Room
                                        <Badge variant='secondary'>
                                            {gameStatus ===
                                            "waiting_for_players"
                                                ? "Waiting For Players"
                                                : gameStatus === "ongoing"
                                                  ? "Game In Progress"
                                                  : "Game Ended"}
                                        </Badge>
                                    </CardTitle>
                                    <CardDescription className='text-xs leading-5 text-slate-400'>
                                        Share this ID to invite a friend.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className='flex flex-col gap-3 px-4'>
                                    <div className='flex items-center justify-between rounded-md border border-white/8 bg-black/25 p-2'>
                                        <span className='font-mono text-base truncate'>
                                            {game_id}
                                        </span>
                                        <Button
                                            variant='ghost'
                                            size='icon'
                                            onClick={copyRoomId}
                                            className='ml-2 h-8 w-8 shrink-0 text-slate-300 hover:bg-violet-500/10 hover:text-white'
                                        >
                                            {copied ? (
                                                <Check
                                                    size={16}
                                                    className='text-green-500'
                                                />
                                            ) : (
                                                <Copy size={16} />
                                            )}
                                        </Button>
                                    </div>
                                </CardContent>
                                <CardFooter className='flex flex-col gap-2 px-4 pb-4 pt-1'>
                                    {!isSpectator && gameStatus !== "ended" && (
                                        <Button
                                            onClick={handleForfeit}
                                            variant='destructive'
                                            disabled={gameStatus !== "ongoing"}
                                            className='w-full transition-all hover:shadow-[0_8px_24px_-12px_rgba(220,38,38,0.45)]'
                                        >
                                            <Flag size={18} className='mr-2' />
                                            Forfeit Game
                                        </Button>
                                    )}
                                    {!isSpectator && gameStatus === "ended" && (
                                        <Button
                                            onClick={() =>
                                                rematch !== "requested"
                                                    ? requestRematch()
                                                    : cancelRematchRequest()
                                            }
                                            className='w-full transition-all hover:shadow-[0_8px_24px_-12px_rgba(139,52,255,0.45)]'
                                        >
                                            {rematch === "opponent_requested"
                                                ? "Accept Rematch?"
                                                : rematch === "requested"
                                                  ? "Cancel Rematch"
                                                  : "Rematch?"}
                                        </Button>
                                    )}
                                    <Button
                                        onClick={() => handleReturnToMenu()}
                                        className='w-full border border-violet-200/10 bg-[#201b29] font-semibold text-zinc-200 shadow-sm transition-all hover:border-violet-300/30 hover:bg-[#292232] focus-visible:ring-violet-400'
                                    >
                                        <LogOut size={18} className='mr-2' />
                                        Leave Game
                                    </Button>
                                </CardFooter>
                            </Card>

                            {/* Move History Card */}
                            <Card className='shrink-0 gap-0 overflow-hidden rounded-lg border-white/10 bg-white/2.5 py-0 shadow-[0_14px_42px_-30px_rgba(0,0,0,0.8)]'>
                                <CardHeader className='px-4 py-4'>
                                    <CardTitle className='text-sm font-semibold text-slate-100'>
                                        Move History
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className='h-48 p-0'>
                                    <MoveHistory
                                        moves={moves}
                                        currentPlayerUsername={
                                            currentPlayer?.username
                                        }
                                        isSpectator={isSpectator}
                                    />
                                </CardContent>
                            </Card>

                            {/* Chat Card */}
                            <Chat
                                initialMessages={initialChatMessages}
                                initialSpectatorCount={initialSpectatorCount}
                            />
                        </div>
                    </div>
                )}
            </>
        </>
    );
}
