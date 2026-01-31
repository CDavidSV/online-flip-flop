"use client";

import MenuButton from "@/components/ui/menuButton";
import { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { z } from "zod";
import RulesDialog from "@/app/rulesDialog";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useWebSocket } from "@/context/wsContext";
import { GameType, GameMode, ErrorCode } from "@/types/types";
import { isWSError, getErrorInfo, isErrorCode } from "@/lib/errorHandler";
import FlipFlopLoader from "@/components/FlipFlopLoader/FlipFlopLoader";
import Image from "next/image";
import {
    Sparkles,
    DoorOpen,
    BookOpen,
    User,
    Users2,
    Grid3x3,
    Grid2x2,
} from "lucide-react";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
} from "@/components/ui/carousel";
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
import { useGameRoom } from "@/context/roomContext";

const createGameFormSchema = z.object({
    username: z.string().min(3, "Player name is required"),
});

const joinGameFormSchema = z.object({
    username: z.string().min(3, "Player name is required"),
    roomId: z.string().length(4, "Room ID must be 4 characters"),
});

export default function Home() {
    const router = useRouter();
    const { isConnected, clientId } = useWebSocket();
    const { createGameRoom, joinRoom, leaveRoom, inRoom } = useGameRoom();

    const [newGameDialogOpen, setNewGameDialogOpen] = useState(false);
    const [joinGameDialogOpen, setJoinGameDialogOpen] = useState(false);
    const [rulesDialogOpen, setRulesDialogOpen] = useState(false);

    const [createLoading, setCreateLoading] = useState(false);
    const [infoLoading, setInfoLoading] = useState(false);

    const [gameType, setGameType] = useState<GameType>(GameType.FLIPFLOP_3x3);
    const [gameMode, setGameMode] = useState<GameMode>(GameMode.MULTIPLAYER);

    const [carouselApi, setCarouselApi] = useState<
        ReturnType<typeof useEmblaCarousel>[1] | null
    >(null);

    const createGameform = useForm<z.infer<typeof createGameFormSchema>>({
        resolver: zodResolver(createGameFormSchema),
        defaultValues: {
            username: "",
        },
    });

    const joinGameform = useForm<z.infer<typeof joinGameFormSchema>>({
        resolver: zodResolver(joinGameFormSchema),
        defaultValues: {
            username: "",
            roomId: "",
        },
    });

    useEffect(() => {
        if (inRoom) {
            leaveRoom();
        }
    }, []);

    const createGameFormSubmit = (
        data: z.infer<typeof createGameFormSchema>,
    ) => {
        setCreateLoading(true);

        // Submit create game request to backend
        createGameRoom(data.username, gameType, gameMode)
            .then((response) => {
                // Redirect user to game page
                router.push(`/game/${response}`);
            })
            .catch((error) => {
                setCreateLoading(false);
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
                            createGameform.setError("username", {
                                type: "manual",
                                message: validationErrors.username,
                            });
                            return;
                        }
                    }

                    switch (errorInfo.code) {
                        case ErrorCode.ALREADY_IN_GAME:
                            createGameform.setError("root", {
                                type: "manual",
                                message: errorInfo.message,
                            });
                            break;
                        case ErrorCode.ID_GENERATION_FAILED:
                            toast.error(errorInfo.message);
                            break;
                        default:
                            toast.error(errorInfo.message);
                            break;
                    }
                } else {
                    // Handle non-WebSocket errors

                    console.error("Error creating game:", error);
                    toast.error("An error occurred while creating the game.");
                }
            });
    };

    const joinGameFormSubmit = (data: z.infer<typeof joinGameFormSchema>) => {
        setInfoLoading(true);

        joinRoom(data.roomId, data.username)
            .then(() => {
                // Redirect user to game page
                router.push(`/game/${data.roomId}`);
            })
            .catch((error) => {
                setInfoLoading(false);
                if (isWSError(error)) {
                    const errorInfo = getErrorInfo(error);

                    // Handle specific validation errors for individual fields
                    if (
                        isErrorCode(error, ErrorCode.VALIDATION_FAILED) &&
                        error.details
                    ) {
                        const validationErrors = error.details as Record<
                            string,
                            string
                        >;

                        if (validationErrors.username) {
                            joinGameform.setError("username", {
                                type: "manual",
                                message: validationErrors.username,
                            });
                        }
                        if (validationErrors.room_id) {
                            joinGameform.setError("roomId", {
                                type: "manual",
                                message: validationErrors.room_id,
                            });
                        }
                        // If there are validation errors not tied to specific fields
                        if (
                            !validationErrors.username &&
                            !validationErrors.room_id
                        ) {
                            joinGameform.setError("root", {
                                type: "manual",
                                message: errorInfo.message,
                            });
                        }
                        return;
                    }

                    // Handle specific error codes
                    switch (errorInfo.code) {
                        case ErrorCode.ROOM_NOT_FOUND:
                            joinGameform.setError("roomId", {
                                type: "manual",
                                message: errorInfo.message,
                            });
                            break;
                        case ErrorCode.ROOM_CLOSED:
                            joinGameform.setError("roomId", {
                                type: "manual",
                                message: errorInfo.message,
                            });
                            break;
                        case ErrorCode.ALREADY_IN_GAME:
                            joinGameform.setError("root", {
                                type: "manual",
                                message: errorInfo.message,
                            });
                            break;
                        default:
                            joinGameform.setError("root", {
                                type: "manual",
                                message: errorInfo.message,
                            });
                            break;
                    }
                } else {
                    console.error("Error joining game:", error);
                    joinGameform.setError("root", {
                        type: "manual",
                        message: "An error occurred while joining the game.",
                    });
                }
            });
    };

    return (
        <>
            <RulesDialog
                open={rulesDialogOpen}
                onOpenChange={setRulesDialogOpen}
            />
            {/* Create Game Dialog */}
            <Dialog
                open={newGameDialogOpen}
                onOpenChange={(open) => setNewGameDialogOpen(open)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create a New Game</DialogTitle>
                        <DialogDescription>
                            Enter your player name to create a new game.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...createGameform}>
                        <form
                            onSubmit={createGameform.handleSubmit(
                                createGameFormSubmit,
                            )}
                            className='space-y-8'
                        >
                            <FormField
                                control={createGameform.control}
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
                            {createGameform.formState.errors.root && (
                                <div className='text-sm font-medium text-destructive'>
                                    {
                                        createGameform.formState.errors.root
                                            .message
                                    }
                                </div>
                            )}
                            <DialogFooter>
                                <Button
                                    className='w-full'
                                    type='submit'
                                    disabled={createLoading}
                                >
                                    {createLoading && <Spinner />}
                                    {createLoading
                                        ? "Creating Game"
                                        : "Create Game"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Join Game Dialog */}
            <Dialog
                open={joinGameDialogOpen}
                onOpenChange={(open) => setJoinGameDialogOpen(open)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Join a Game</DialogTitle>
                        <DialogDescription>
                            Enter your player name and the Room ID to join an
                            existing game.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...joinGameform}>
                        <form
                            onSubmit={joinGameform.handleSubmit(
                                joinGameFormSubmit,
                            )}
                            className='space-y-8'
                        >
                            <FormField
                                control={joinGameform.control}
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
                            <FormField
                                control={joinGameform.control}
                                name='roomId'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Room ID</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder='Enter the Room ID'
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            ></FormField>
                            {joinGameform.formState.errors.root && (
                                <div className='text-sm font-medium text-destructive'>
                                    {joinGameform.formState.errors.root.message}
                                </div>
                            )}
                            <DialogFooter>
                                <Button
                                    className='w-full'
                                    type='submit'
                                    disabled={infoLoading}
                                >
                                    {infoLoading && <Spinner />}
                                    {infoLoading ? "Joining Game" : "Join Game"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Main Menu */}
            <main className='min-h-screen flex flex-col items-center justify-center'>
                {!isConnected && (
                    <div className='absolute w-full h-full bg-background z-50 flex flex-col justify-center items-center gap-2'>
                        <FlipFlopLoader />
                        <p className='text-muted-foreground'>
                            Connecting to server...
                        </p>
                    </div>
                )}
                <Image
                    src="/assets/FlipFlop.svg"
                    alt="FlipFlop"
                    width={442}
                    height={142}
                    className="mb-6 p-6"
                />

                <Carousel
                    opts={{ watchDrag: false, duration: 10 }}
                    className='w-screen'
                    setApi={(api) => setCarouselApi(api)}
                >
                    <CarouselContent>
                        <CarouselItem className='flex justify-center flex-row gap-4 flex-wrap'>
                            <MenuButton
                                text='Create Game'
                                icon={<Sparkles className='size-8' />}
                                onClick={() =>
                                    carouselApi && carouselApi.scrollNext()
                                }
                            />
                            <MenuButton
                                text='Join Game'
                                icon={<DoorOpen className='size-8' />}
                                onClick={() => setJoinGameDialogOpen(true)}
                            />
                            <MenuButton
                                text='Rules'
                                icon={<BookOpen className='size-8' />}
                                onClick={() => setRulesDialogOpen(true)}
                            />
                        </CarouselItem>
                        <CarouselItem className='flex justify-center items-center flex-col gap-4'>
                            <div className='flex justify-center flex-row gap-4 flex-wrap'>
                                <MenuButton
                                    text='Singleplayer'
                                    icon={<User className='size-8' />}
                                    disabled
                                    onClick={() => {
                                        setGameMode(GameMode.SINGLEPLAYER);
                                        carouselApi && carouselApi.scrollNext();
                                    }}
                                />
                                <MenuButton
                                    text='Multiplayer'
                                    icon={<Users2 className='size-8' />}
                                    onClick={() => {
                                        setGameMode(GameMode.MULTIPLAYER);
                                        carouselApi && carouselApi.scrollNext();
                                    }}
                                />
                            </div>
                            <Button
                                className='w-fit'
                                onClick={() =>
                                    carouselApi && carouselApi.scrollPrev()
                                }
                            >
                                Go Back
                            </Button>
                        </CarouselItem>
                        <CarouselItem className='flex justify-center items-center flex-col gap-4'>
                            <div className='flex justify-center flex-row gap-4 flex-wrap'>
                                <MenuButton
                                    text='FlipFlop 3x3'
                                    icon={<Grid3x3 className='size-8' />}
                                    onClick={() => {
                                        setGameType(GameType.FLIPFLOP_3x3);
                                        setNewGameDialogOpen(true);
                                    }}
                                />
                                <MenuButton
                                    text='FlipFlop 5x5'
                                    icon={<Grid2x2 className='size-8' />}
                                    onClick={() => {
                                        setGameType(GameType.FLIPFLOP_5x5);
                                        setNewGameDialogOpen(true);
                                    }}
                                />
                                <MenuButton
                                    text='FlipFour'
                                    icon={<Grid2x2 className='size-8' />}
                                    disabled
                                    onClick={() => {
                                        setGameType(GameType.FLIPFOUR);
                                        setNewGameDialogOpen(true);
                                    }}
                                />
                            </div>
                            <Button
                                className='w-fit'
                                onClick={() =>
                                    carouselApi && carouselApi.scrollPrev()
                                }
                            >
                                Go Back
                            </Button>
                        </CarouselItem>
                    </CarouselContent>
                </Carousel>
                <div className='absolute bottom-0 right-0 w-full px-2 flex flex-row gap-4 text-muted-foreground text-xs'>
                    <p>v{process.env.NEXT_PUBLIC_APP_VERSION}</p>
                </div>
            </main>
        </>
    );
}
