"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Flag } from "lucide-react";
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
    const [openDialog, setOpenDialog] = useState<"username" | "forfeit" | null>(
        null,
    );
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
            joinGameResponse.move_history.forEach((move) => {
                const player = joinGameResponse.game_state.players.find(
                    (p) => p.id === move.player_id,
                )?.username;
                moves.push({
                    id: moves.length + 1,
                    player: player,
                    notation: `${move.from}-${move.to}`,
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
            }).finally(() => {
                setOpenDialog(null);
                setForfeitLoading(false);
            });
    };

    const handleMoveMade = (from: string, to: string) => {
        addMove(from, to, currentPlayer?.username || "Unknown");
    };

    const handleReturnToMenu = () => {
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

            {/* Game End Popup */}
            {showGameEnd && gameEndResult && (
                <div className='fixed inset-0 flex items-center justify-center z-40 transition-all duration-300 animate-in fade-in zoom-in-95'>
                    <div className='fixed inset-0 bg-black/60 backdrop-blur-sm' />

                    <div className='relative z-10'>
                        {isSpectator && (
                            <div className='bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-500 rounded-3xl shadow-2xl border-8 border-yellow-200 p-12 text-center min-w-[400px] animate-in slide-in-from-bottom-10 duration-700'>
                                <h2 className='text-6xl font-black text-yellow-900 mb-4 tracking-wider drop-shadow-lg'>
                                    GAME OVER
                                </h2>
                                <p className='text-3xl text-yellow-800 font-bold'>
                                    {gameEndResult.winner ===
                                    currentPlayer?.color
                                        ? currentPlayer?.username
                                        : opponentPlayer?.username}{" "}
                                    Wins!
                                </p>
                                <button
                                    onClick={handleReturnToMenu}
                                    className='mt-8 px-8 py-4 bg-yellow-900 text-yellow-100 font-bold text-xl rounded-xl hover:bg-yellow-800 transition-all duration-200 hover:scale-105 shadow-lg cursor-pointer'
                                >
                                    Leave Game
                                </button>
                            </div>
                        )}

                        {!isSpectator && (
                            <div
                                className={cn(
                                    "rounded-3xl shadow-2xl border-8 p-12 text-center min-w-[400px] duration-700",
                                    gameEndResult.reason === "draw"
                                        ? "bg-gradient-to-br from-gray-400 to-gray-600 border-gray-300 animate-in spin-in-180"
                                        : gameEndResult.winner ===
                                            currentPlayer?.color
                                          ? "bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-500 border-yellow-200 animate-in slide-in-from-bottom-10"
                                          : "bg-gradient-to-br from-red-500 via-red-600 to-red-700 border-red-400 animate-in slide-in-from-top-10",
                                )}
                            >
                                <h2
                                    className={cn(
                                        "font-black mb-4 tracking-wider drop-shadow-lg",
                                        gameEndResult.reason === "draw"
                                            ? "text-5xl text-white"
                                            : "text-6xl",
                                        gameEndResult.winner ===
                                            currentPlayer?.color
                                            ? "text-yellow-900"
                                            : "text-white",
                                    )}
                                >
                                    {gameEndResult.reason === "draw"
                                        ? "DRAW!"
                                        : gameEndResult.winner ===
                                            currentPlayer?.color
                                          ? "VICTORY!"
                                          : "DEFEAT"}
                                </h2>

                                {gameEndResult.reason === "draw" ? (
                                    <p className='text-2xl text-gray-100 font-semibold'>
                                        Well Played!
                                    </p>
                                ) : gameEndResult.winner ===
                                  currentPlayer?.color ? (
                                    <p className='text-3xl text-yellow-800 font-bold'>
                                        You Win!
                                    </p>
                                ) : (
                                    <>
                                        <p className='text-3xl text-red-100 font-bold'>
                                            You Lose
                                        </p>
                                        <p className='text-xl text-red-200 mt-4'>
                                            Better luck next time!
                                        </p>
                                    </>
                                )}

                                <div className='flex flex-row gap-4 justify-center flex-wrap'>
                                    <button
                                        onClick={handleReturnToMenu}
                                        className={cn(
                                            "mt-8 px-8 py-4 font-bold text-xl rounded-xl transition-all duration-200 hover:scale-105 shadow-lg cursor-pointer",
                                            gameEndResult.reason === "draw"
                                                ? "bg-white text-gray-800 hover:bg-gray-100"
                                                : gameEndResult.winner ===
                                                    currentPlayer?.color
                                                  ? "bg-yellow-900 text-yellow-100 hover:bg-yellow-800"
                                                  : "bg-white text-red-600 hover:bg-red-50",
                                        )}
                                    >
                                        Leave Game
                                    </button>
                                    <button
                                        onClick={() => setShowGameEnd(false)}
                                        className={cn(
                                            "mt-8 px-8 py-4 font-bold text-xl rounded-xl transition-all duration-200 hover:scale-105 shadow-lg cursor-pointer",
                                            gameEndResult.reason === "draw"
                                                ? "bg-white text-gray-800 hover:bg-gray-100"
                                                : gameEndResult.winner ===
                                                    currentPlayer?.color
                                                  ? "bg-yellow-900 text-yellow-100 hover:bg-yellow-800"
                                                  : "bg-white text-red-600 hover:bg-red-50",
                                        )}
                                    >
                                        Go back
                                    </button>
                                </div>
                                <button
                                    onClick={() =>
                                        rematch !== "requested"
                                            ? requestRematch()
                                            : cancelRematchRequest()
                                    }
                                    className={cn(
                                        "mt-4 px-8 py-4 font-bold text-xl rounded-xl transition-all duration-200 hover:scale-105 shadow-lg cursor-pointer",
                                        gameEndResult.reason === "draw"
                                            ? "bg-white text-gray-800 hover:bg-gray-100"
                                            : gameEndResult.winner ===
                                                currentPlayer?.color
                                              ? "bg-yellow-900 text-yellow-100 hover:bg-yellow-800"
                                              : "bg-white text-red-600 hover:bg-red-50",
                                    )}
                                >
                                    {rematch === "opponent_requested"
                                        ? "Accept Rematch?"
                                        : rematch === "requested"
                                          ? "Cancel Rematch"
                                          : "Rematch?"}
                                </button>
                            </div>
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
                    <div className='md:flex flex-col md:flex-row md:h-screen min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-50 font-inter p-4 gap-4'>
                        {/* Main Game Area */}
                        <div className='flex flex-1 mb-4 md:mb-0 bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-9 md:p-10 flex-col items-center justify-between overflow-hidden relative'>
                            {gameStatus === "ongoing" && (
                                <div className='absolute top-3 left-3 md:top-4 md:left-4'>
                                    <div
                                        className={`px-2 py-1 md:px-4 md:py-2 rounded-md md:rounded-lg font-semibold text-xs md:text-sm transition-all ${
                                            isMyTurn
                                                ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 animate-pulse"
                                                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
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
                                </div>
                            )}

                            <div className='flex items-center justify-center text-lg font-semibold text-red-500 dark:text-red-400 mb-4'>
                                {opponentPlayer && gameStatus !== "waiting_for_players"
                                    ? opponentPlayer?.username
                                    : "Waiting for opponent player to join..."}
                            </div>

                            <div className='flex items-center justify-center w-full max-w-[80vh] max-h-[80vh]'>
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

                            <div className='flex items-center justify-center text-lg font-semibold text-blue-600 dark:text-blue-400 mt-4'>
                                {currentPlayer?.username || "PLAYER 1 (YOU)"}
                            </div>
                        </div>

                        <div className='flex flex-col w-full md:w-96 gap-4 mb-4 md:mb-0 md:min-h-0 overflow-y-auto'>
                            <Card className='flex-shrink-0'>
                                <CardHeader>
                                    <CardTitle className='flex items-center justify-between'>
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
                                    <CardDescription className='text-sm'>
                                        Share this ID to invite a friend.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className='flex flex-col gap-3'>
                                    <div className='flex items-center justify-between bg-gray-100 dark:bg-gray-700 p-2 rounded-lg'>
                                        <span className='font-mono text-base truncate'>
                                            {game_id}
                                        </span>
                                        <Button
                                            variant='ghost'
                                            size='icon'
                                            onClick={copyRoomId}
                                            className='ml-2 w-8 h-8 flex-shrink-0 hover:bg-gray-200 dark:hover:bg-gray-600'
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
                                <CardFooter className='pt-0'>
                                    {!isSpectator && gameStatus !== "ended" && (
                                        <Button
                                            onClick={handleForfeit}
                                            variant='destructive'
                                            disabled={gameStatus !== "ongoing"}
                                            className='w-full text-white rounded-lg transition-all shadow-md hover:shadow-lg hover:scale-[1.01]'
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
                                            className='w-full text-white rounded-lg transition-all shadow-md hover:shadow-lg hover:scale-[1.01]'
                                        >
                                            {rematch === "opponent_requested"
                                                ? "Accept Rematch?"
                                                : rematch === "requested"
                                                  ? "Cancel Rematch"
                                                  : "Rematch?"}
                                        </Button>
                                    )}
                                </CardFooter>
                            </Card>

                            {/* Move History Card */}
                            <Card className='flex-shrink-0'>
                                <CardHeader>
                                    <CardTitle className='text-base'>
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
                            <Chat initialMessages={initialChatMessages} />
                        </div>
                    </div>
                )}
            </>
        </>
    );
}
