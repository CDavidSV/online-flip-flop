"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Flag } from "lucide-react";
import { GameMoveMsg, JoinGameResponse, PlayerColor } from "@/types/types";
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
import { useEffect, useState, useRef } from "react";
import { Chat } from "@/components/Chat/Chat";
import { FlipFlop } from "@/components/FlipFlop/FlipFlop";
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

const usernameFormSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters long"),
});

export default function GamePage() {
    const { game_id } = useParams<{ game_id: string }>();
    const { isConnected, on } = useWebSocket();
    const router = useRouter();
    const {
        inRoom,
        gameType,
        gameMode,
        gameStatus,
        joinRoom,
        currentPlayer,
        opponentPlayer,
        currentTurn,
        setCurrentTurn,
    } = useGameRoom();

    const [moves, setMoves] = useState<
        { id: number; player: string; notation: string }[]
    >([]);
    const [copied, setCopied] = useState(false);
    const [gameEnded, setGameEnded] = useState(false);
    const [usernameDialogOpen, setUsernameDialogOpen] = useState(false);
    const [joinLoading, setJoinLoading] = useState(false);
    const [showLoadingOverlay, setShowLoadingOverlay] = useState(true);
    const [loadingOverlayMsg, setLoadingOverlayMsg] = useState(
        "Connecting to server...",
    );
    const [attemptedRejoin, setAttemptedRejoin] = useState(false);
    const [initialGameBoard, setInitialGameBoard] = useState<
        string | undefined
    >(undefined);
    const [isMyTurn, setIsMyTurn] = useState<boolean>(false);
    const moveHistoryEndRef = useRef<HTMLDivElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);

    const usernameform = useForm<z.infer<typeof usernameFormSchema>>({
        resolver: zodResolver(usernameFormSchema),
        defaultValues: {
            username: "",
        },
    });

    const handleRoomError = (
        error: unknown,
        formContext?: typeof usernameform,
    ) => {
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
            const validationErrors = error.details as Record<string, string>;

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
    };

    useEffect(() => {
        if (gameEnded) return;

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

            // First, attempt to rejoin without username (for reconnecting players)
            if (!attemptedRejoin) {
                setLoadingOverlayMsg("Joining game...");
                setAttemptedRejoin(true);

                joinRoom(game_id)
                    .then((value: JoinGameResponse) => {
                        // Successfully rejoined
                        setShowLoadingOverlay(false);
                        setInitialGameBoard(value.game_state.board);

                        // Set initial turn state
                        const myPlayer = value.game_state.players.find(
                            (p) => p.id === currentPlayer?.id,
                        );
                        const myTurn = myPlayer
                            ? value.game_state.current_turn === myPlayer.color
                            : false;
                        setIsMyTurn(myTurn);
                    })
                    .catch((error) => {
                        if (
                            isWSError(error) &&
                            isErrorCode(error, ErrorCode.USERNAME_REQUIRED)
                        ) {
                            // Username required
                            setUsernameDialogOpen(true);
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
        gameEnded,
        joinRoom,
    ]);

    useEffect(() => {
        if (gameStatus === "closed") {
            setGameEnded(true);
        }
    }, [gameStatus]);

    // Sync isMyTurn with currentTurn from context
    useEffect(() => {
        if (currentTurn !== null && currentPlayer?.color !== null) {
            setIsMyTurn(currentTurn === currentPlayer?.color);
        }
    }, [currentTurn, currentPlayer]);

    useEffect(() => {
        if (viewportRef.current) {
            viewportRef.current.scrollTo({
                top: viewportRef.current.scrollHeight,
                behavior: "smooth",
            });
        }
    }, [moves]);

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

    useEffect(() => {
        if (!isConnected) return;

        const cleanupMove = on("move", (payload: GameMoveMsg) => {
            if (payload.move.from && payload.move.to) {
                addMove(
                    payload.move.from,
                    payload.move.to,
                    opponentPlayer?.username || "Unknown",
                );

                // Update current turn from server
                // After opponent's move, it's now your turn
                setIsMyTurn(currentPlayer?.color !== payload.color);
            }
        });

        const cleanupStart = on("start", () => {
            // Game has started, check if it's your turn
            const myTurn = currentPlayer?.color === PlayerColor.WHITE;
            setIsMyTurn(myTurn);
            setCurrentTurn(PlayerColor.WHITE); // White always starts
        });

        return () => {
            cleanupMove();
            cleanupStart();
        };
    }, [isConnected, on, opponentPlayer, currentPlayer]);

    const copyRoomId = () => {
        const textarea = document.createElement("textarea");
        textarea.value = game_id;
        document.body.appendChild(textarea);
        textarea.select();
        try {
            navigator.clipboard.writeText(game_id);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy text: ", err);
        }
        document.body.removeChild(textarea);
    };

    const usernameFormSubmit = (data: z.infer<typeof usernameFormSchema>) => {
        if (!game_id) {
            router.push("/");
            return;
        }

        setJoinLoading(true);

        joinRoom(game_id, data.username)
            .then(() => {
                setShowLoadingOverlay(false);
                setUsernameDialogOpen(false);
                setJoinLoading(false);
            })
            .catch((error) => {
                setJoinLoading(false);
                handleRoomError(error, usernameform);
            });
    };

    const handleForfeit = () => {};

    const handleMoveMade = (from: string, to: string) => {
        addMove(from, to, currentPlayer?.username || "Unknown");

        setIsMyTurn(false);
    };

    return (
        <>
            {showLoadingOverlay && (
                <div className='absolute w-full h-full bg-background z-50 flex flex-col justify-center items-center gap-2'>
                    <FlipFlopLoader />
                    <p className='text-muted-foreground'>{loadingOverlayMsg}</p>
                </div>
            )}
            <Dialog open={usernameDialogOpen}>
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
                                        {isMyTurn
                                            ? "Your Turn"
                                            : "Opponent's Turn"}
                                    </div>
                                </div>
                            )}

                            <div className='flex items-center justify-center text-lg font-semibold text-red-500 dark:text-red-400 mb-4'>
                                {gameStatus === "ongoing"
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

                        <div className='flex flex-col w-full md:w-96 gap-4 mb-4 md:mb-0 md:min-h-0'>
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
                                    <Button
                                        onClick={handleForfeit}
                                        variant='destructive'
                                        className='w-full text-white rounded-lg transition-all shadow-md hover:shadow-lg hover:scale-[1.01]'
                                    >
                                        <Flag size={18} className='mr-2' />
                                        Forfeit Game
                                    </Button>
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
                                    <ScrollArea
                                        className='h-full rounded-md'
                                        viewportRef={viewportRef}
                                    >
                                        <div className='px-4'>
                                            {moves.map((move) => (
                                                <div
                                                    key={move.id}
                                                    className={`flex items-center justify-between py-1 px-2 rounded-md transition-colors mt-1 ${
                                                        move.player ===
                                                        currentPlayer?.username
                                                            ? "bg-blue-50 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200"
                                                            : "bg-green-50 dark:bg-green-900/50 text-green-800 dark:text-green-200"
                                                    }`}
                                                >
                                                    <span className='text-sm font-medium w-1/4'>
                                                        {move.id}.
                                                        <span className='ml-1 text-xs'>
                                                            {move.player}
                                                        </span>
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
                                </CardContent>
                            </Card>

                            {/* Chat Card */}
                            <Chat />
                        </div>
                    </div>
                )}
            </>
        </>
    );
}
