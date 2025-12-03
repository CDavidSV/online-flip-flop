"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Flag } from "lucide-react";
import { Board } from "../board";
import { GameType, PlayerColor } from "@/types/types";
import { useParams, useRouter } from "next/navigation";
import { useGameRoom } from "@/context/roomContext";
import { useWebSocket } from "@/context/wsContext";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import FlipFlopLoader from "@/components/FlipFlopLoader/FlipFlopLoader";
import { toast } from "sonner";
import { isWSError, getErrorInfo, isErrorCode } from "@/lib/errorHandler";
import { ErrorCode } from "@/types/types";
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
import { Spinner } from "@/components/ui/spinner";
import { useEffect, useState } from "react";
import { Chat } from "@/components/Chat/Chat";

const initialMoves = [
    { id: 1, player: 1, notation: "e1-e4" },
    { id: 2, player: 2, notation: "e5-e3" },
    { id: 3, player: 1, notation: "a1-a4" },
    { id: 4, player: 2, notation: "a7-a3" },
];

const usernameFormSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters long"),
});

export default function GamePage() {
    const { game_id } = useParams<{ game_id: string }>();
    const { username, inRoom, gameType, gameMode, joinRoom } = useGameRoom();
    const { isConnected } = useWebSocket();
    const router = useRouter();

    const [moves, setMoves] = useState(initialMoves);
    const [copied, setCopied] = useState(false);
    const [usernameDialogOpen, setUsernameDialogOpen] = useState(false);
    const [gameLoading, setGameLoading] = useState(false);
    const [joinLoading, setJoinLoading] = useState(false);
    const [showLoadingOverlay, setShowLoadingOverlay] = useState(true);
    const [loadingOverlayMsg, setLoadingOverlayMsg] = useState(
        "Connecting to server..."
    );

    const usernameform = useForm<z.infer<typeof usernameFormSchema>>({
        resolver: zodResolver(usernameFormSchema),
        defaultValues: {
            username: "",
        },
    });

    useEffect(() => {
        // Redirect to home if game_id is not provided
        if (!game_id || game_id.length !== 4) {
            router.push("/");
            return;
        }

        if (isConnected) {
            // If roomId exists and user is already in the room
            if (inRoom) {
                setShowLoadingOverlay(false);
                return;
            } else {
                setLoadingOverlayMsg("Joining game...");
            }

            if (!username) {
                setUsernameDialogOpen(true);
                return;
            }
        }

        setShowLoadingOverlay(true);
        setLoadingOverlayMsg("Connecting to server...");
    }, [isConnected, username, inRoom, game_id, router]);

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
                setUsernameDialogOpen(false);
                setJoinLoading(false);
            })
            .catch((error) => {
                setJoinLoading(false);
                if (isWSError(error)) {
                    const errorInfo = getErrorInfo(error);

                    if (
                        isErrorCode(error, ErrorCode.VALIDATION_FAILED) &&
                        error.details
                    ) {
                        const validationErrors = error.details as Record<
                            string,
                            string
                        >;

                        if (validationErrors.username) {
                            usernameform.setError("username", {
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

                    switch (errorInfo.code) {
                        case ErrorCode.ROOM_NOT_FOUND:
                            toast.error(errorInfo.message);
                            router.push("/");
                            break;
                        case ErrorCode.ROOM_CLOSED:
                            toast.error(errorInfo.message);
                            router.push("/");
                            break;
                        case ErrorCode.ALREADY_IN_GAME:
                            usernameform.setError("root", {
                                type: "manual",
                                message: errorInfo.message,
                            });
                            break;
                        default:
                            usernameform.setError("root", {
                                type: "manual",
                                message: errorInfo.message,
                            });
                            break;
                    }
                } else {
                    console.error("Error joining game:", error);
                    usernameform.setError("root", {
                        type: "manual",
                        message: "An error occurred while joining the game.",
                    });
                }
            });
    };

    const handleForfeit = () => {};

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
                                usernameFormSubmit
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
                            <DialogFooter>
                                <Button
                                    className='w-full'
                                    type='submit'
                                    disabled={joinLoading}
                                >
                                    {joinLoading && <Spinner />}
                                    {joinLoading ? "Joining..." : "Submit"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
            <>
                {gameLoading || !gameType || !gameMode ? (
                    <div className='h-screen flex justify-center items-center'>
                        <FlipFlopLoader />
                    </div>
                ) : (
                    <div className='md:flex flex-col md:flex-row md:h-screen min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-50 font-inter p-4 gap-4'>
                        {/* Main Game Area */}
                        <div className='md:flex flex-1 mb-4 md:mb-0 bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 flex-col items-center justify-between overflow-hidden'>
                            <div className='flex items-center text-lg font-semibold text-red-500 dark:text-red-400 mb-4'>
                                Waiting for opponent to join...
                            </div>

                            <div className='flex items-center justify-center w-full max-w-[80vh] and max-h-[80vh] aspect-square bg-gray-200 dark:bg-gray-700 rounded-xl shadow-inner border-4 border-gray-300 dark:border-gray-600 '>
                                <Board
                                    type={gameType}
                                    side={PlayerColor.WHITE}
                                />
                            </div>

                            <div className='flex items-center text-lg font-semibold text-blue-600 dark:text-blue-400 mt-4'>
                                {username || "PLAYER 1 (YOU)"}
                            </div>
                        </div>

                        <div className='flex flex-col w-full md:w-96 gap-4 mb-4 md:mb-0 md:min-h-0'>
                            <Card className='flex-shrink-0'>
                                <CardHeader>
                                    <CardTitle className='flex items-center justify-between'>
                                        Game Room
                                        <Badge variant='secondary'>
                                            Waiting For Players
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
                                    <ScrollArea className='h-full rounded-md'>
                                        <div className='px-4'>
                                            {moves.map((move) => (
                                                <div
                                                    key={move.id}
                                                    className={`flex items-center justify-between py-1 px-2 rounded-md transition-colors mt-1 ${
                                                        move.player === 1
                                                            ? "bg-blue-50 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200"
                                                            : "bg-green-50 dark:bg-green-900/50 text-green-800 dark:text-green-200"
                                                    }`}
                                                >
                                                    <span className='text-sm font-medium w-1/4'>
                                                        {Math.ceil(move.id / 2)}
                                                        .
                                                        <span className='ml-1 text-xs'>
                                                            {move.player === 1
                                                                ? "P1"
                                                                : "P2"}
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
