"use client";

import MenuButton from "@/components/ui/menuButton";
import { useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import packageJson from "../package.json";
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
import { GameType, GameMode, ErrorCode, AIDDifficulty } from "@/types/types";
import { isWSError, getErrorInfo, isErrorCode } from "@/lib/errorHandler";
import FlipFlopLoader from "@/components/FlipFlopLoader/FlipFlopLoader";
import Image from "next/image";
import {
    Sparkles,
    DoorOpen,
    BookOpen,
    User,
    Users2,
    Smile,
    Meh,
    Frown,
    ArrowLeft,
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
    const { isConnected } = useWebSocket();
    const { createGameRoom, joinRoom, username } = useGameRoom();

    const [openDialog, setOpenDialog] = useState<
        "create" | "join" | "rules" | null
    >(null);
    const [isLoading, setIsLoading] = useState(false);
    const [gameConfig, setGameConfig] = useState({
        type: GameType.FLIPFLOP_3x3,
        mode: GameMode.MULTIPLAYER,
        difficulty: AIDDifficulty.MEDIUM,
    });
    const [carouselApi, setCarouselApi] = useState<
        ReturnType<typeof useEmblaCarousel>[1] | null
    >(null);

    const createGameform = useForm<z.infer<typeof createGameFormSchema>>({
        resolver: zodResolver(createGameFormSchema),
        defaultValues: {
            username: username || "",
        },
    });

    const joinGameform = useForm<z.infer<typeof joinGameFormSchema>>({
        resolver: zodResolver(joinGameFormSchema),
        defaultValues: {
            username: username || "",
            roomId: "",
        },
    });

    const createGameFormSubmit = (
        data: z.infer<typeof createGameFormSchema>,
    ) => {
        setIsLoading(true);

        // Submit create game request to backend
        createGameRoom(
            data.username,
            gameConfig.type,
            gameConfig.mode,
            gameConfig.difficulty,
        )
            .then((response) => {
                // Redirect user to game page
                router.push(`/game/${response}`);
            })
            .catch((error) => {
                setIsLoading(false);
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
                    console.error("Error creating game:", error);
                    toast.error("An error occurred while creating the game.");
                }
            });
    };

    const joinGameFormSubmit = (data: z.infer<typeof joinGameFormSchema>) => {
        setIsLoading(true);

        joinRoom(data.roomId, data.username)
            .then(() => {
                // Redirect user to game page
                router.push(`/game/${data.roomId}`);
            })
            .catch((error) => {
                setIsLoading(false);
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
                        case ErrorCode.ROOM_FULL:
                            joinGameform.setError("roomId", {
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
            <a
                target='_blank'
                aria-label='Open FlipFlop on GitHub'
                rel='noreferrer'
                className='absolute right-4 top-4 z-10 flex size-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] p-2 text-white/80 transition-colors hover:border-violet-400/50 hover:bg-violet-500/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400'
                href='https://github.com/CDavidSV/online-flip-flop'
            >
                <svg
                    role='img'
                    className='size-5 fill-current'
                    viewBox='0 0 24 24'
                    xmlns='http://www.w3.org/2000/svg'
                >
                    <title>GitHub</title>
                    <path d='M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12'></path>
                </svg>
            </a>
            <RulesDialog
                open={openDialog === "rules"}
                onOpenChange={(open) => setOpenDialog(open ? "rules" : null)}
            />
            {/* Create Game Dialog */}
            <Dialog
                open={openDialog === "create"}
                onOpenChange={(open) => setOpenDialog(open ? "create" : null)}
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
                            className='space-y-5'
                        >
                            <FormField
                                control={createGameform.control}
                                name='username'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Player Name</FormLabel>
                                        <FormControl>
                                            <Input
                                                type='text'
                                                placeholder='Enter your player name'
                                                autoComplete='nickname'
                                                className='border-white/10 bg-black/25 placeholder:text-muted-foreground/60 focus-visible:border-violet-400 focus-visible:ring-violet-400/25'
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            ></FormField>
                            {createGameform.formState.errors.root && (
                                <div role='alert' className='rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-medium text-red-200'>
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
                                    disabled={isLoading}
                                >
                                    {isLoading && <Spinner />}
                                    {isLoading
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
                open={openDialog === "join"}
                onOpenChange={(open) => setOpenDialog(open ? "join" : null)}
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
                            className='space-y-5'
                        >
                            <FormField
                                control={joinGameform.control}
                                name='username'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Player Name</FormLabel>
                                        <FormControl>
                                            <Input
                                                type='text'
                                                placeholder='Enter your player name'
                                                autoComplete='nickname'
                                                className='border-white/10 bg-black/25 placeholder:text-muted-foreground/60 focus-visible:border-violet-400 focus-visible:ring-violet-400/25'
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
                                                type='text'
                                                placeholder='Enter the Room ID'
                                                autoComplete='off'
                                                className='border-white/10 bg-black/25 uppercase placeholder:text-muted-foreground/60 focus-visible:border-violet-400 focus-visible:ring-violet-400/25'
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            ></FormField>
                            {joinGameform.formState.errors.root && (
                                <div role='alert' className='rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-medium text-red-200'>
                                    {joinGameform.formState.errors.root.message}
                                </div>
                            )}
                            <DialogFooter>
                                <Button
                                    className='w-full'
                                    type='submit'
                                    disabled={isLoading}
                                >
                                    {isLoading && <Spinner />}
                                    {isLoading ? "Joining Game" : "Join Game"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Main Menu */}
            <main className='menu-stage relative flex min-h-dvh w-full flex-col items-center justify-center px-4 py-16 sm:py-20'>
                {!isConnected && (
                    <div className='fixed inset-0 bg-background z-50 flex flex-col justify-center items-center gap-2'>
                        <FlipFlopLoader />
                        <p className='text-muted-foreground'>
                            Connecting to server...
                        </p>
                    </div>
                )}
                <Image
                    src='/assets/FlipFlop.svg'
                    alt='FlipFlop'
                    width={442}
                    height={142}
                    className='relative z-0 mb-7 h-auto w-[min(72vw,18rem)] drop-shadow-[0_0_24px_rgba(168,85,247,0.25)]'
                    priority
                />

                <Carousel
                    opts={{ watchDrag: false, duration: 10, skipSnaps: true }}
                    className='relative z-0 w-full max-w-4xl'
                    setApi={(api) => setCarouselApi(api)}
                >
                    <CarouselContent>
                        <CarouselItem className='flex flex-col items-center justify-center gap-5 px-2'>
                            <div className='flex flex-row flex-wrap justify-center gap-3 sm:gap-4'>
                            <MenuButton
                                text='Create Game'
                                description='Start a new match'
                                icon={<Sparkles className='size-7' />}
                                onClick={() =>
                                    carouselApi && carouselApi.scrollNext()
                                }
                            />
                            <MenuButton
                                text='Join Game'
                                description='Enter a room code'
                                icon={<DoorOpen className='size-7' />}
                                onClick={() => setOpenDialog("join")}
                            />
                            <MenuButton
                                text='Rules'
                                description='Learn how to play'
                                icon={<BookOpen className='size-7' />}
                                onClick={() => setOpenDialog("rules")}
                            />
                            </div>
                        </CarouselItem>
                        <CarouselItem className='flex flex-col items-center justify-center gap-5 px-2'>
                            <div className='text-center'>
                                <p className='text-xs font-medium uppercase tracking-[0.18em] text-violet-300'>New game</p>
                                <h2 className='mt-1 text-xl font-semibold tracking-tight text-white'>Choose a game mode</h2>
                            </div>
                            <div className='flex flex-row flex-wrap justify-center gap-3 sm:gap-4'>
                                <MenuButton
                                    text='Singleplayer'
                                    description='Play against the computer'
                                    selected={gameConfig.mode === GameMode.SINGLEPLAYER}
                                    icon={<User className='size-7' />}
                                    onClick={() => {
                                        setGameConfig((prev) => ({
                                            ...prev,
                                            mode: GameMode.SINGLEPLAYER,
                                        }));
                                        carouselApi?.scrollNext();
                                    }}
                                />
                                <MenuButton
                                    text='Multiplayer'
                                    description='Play with other players'
                                    selected={gameConfig.mode === GameMode.MULTIPLAYER}
                                    icon={<Users2 className='size-7' />}
                                    onClick={() => {
                                        setGameConfig((prev) => ({
                                            ...prev,
                                            mode: GameMode.MULTIPLAYER,
                                        }));
                                        carouselApi?.scrollNext();
                                    }}
                                />
                            </div>
                            <Button
                                variant='ghost'
                                className='h-9 text-muted-foreground hover:text-white'
                                onClick={() =>
                                    carouselApi && carouselApi.scrollPrev()
                                }
                            >
                                <ArrowLeft className='size-4' /> Back
                            </Button>
                        </CarouselItem>
                        <CarouselItem className='flex flex-col items-center justify-center gap-5 px-2'>
                            <div className='text-center'>
                                <p className='text-xs font-medium uppercase tracking-[0.18em] text-violet-300'>New game</p>
                                <h2 className='mt-1 text-xl font-semibold tracking-tight text-white'>Choose a board size</h2>
                            </div>
                            <div className='flex flex-row flex-wrap justify-center gap-3 sm:gap-4'>
                                <MenuButton
                                    text='FlipFlop 3x3'
                                    description='A smaller, faster game'
                                    selected={gameConfig.type === GameType.FLIPFLOP_3x3}
                                    icon={
                                        <span
                                            aria-hidden='true'
                                            className='grid size-7 grid-cols-3 gap-[2px]'
                                        >
                                            {Array.from({ length: 9 }, (_, index) => (
                                                <span
                                                    key={index}
                                                    className='rounded-[1px] border border-current'
                                                />
                                            ))}
                                        </span>
                                    }
                                    onClick={() => {
                                        setGameConfig((prev) => ({
                                            ...prev,
                                            type: GameType.FLIPFLOP_3x3,
                                        }));
                                        if (
                                            gameConfig.mode ===
                                            GameMode.SINGLEPLAYER
                                        ) {
                                            carouselApi?.scrollNext();
                                        } else {
                                            setOpenDialog("create");
                                        }
                                    }}
                                />
                                <MenuButton
                                    text='FlipFlop 5x5'
                                    description='A deeper, strategic game'
                                    selected={gameConfig.type === GameType.FLIPFLOP_5x5}
                                    icon={
                                        <span
                                            aria-hidden='true'
                                            className='grid size-7 grid-cols-5 gap-[2px]'
                                        >
                                            {Array.from({ length: 25 }, (_, index) => (
                                                <span
                                                    key={index}
                                                    className='rounded-[1px] border border-current'
                                                />
                                            ))}
                                        </span>
                                    }
                                    onClick={() => {
                                        setGameConfig((prev) => ({
                                            ...prev,
                                            type: GameType.FLIPFLOP_5x5,
                                        }));
                                        if (
                                            gameConfig.mode ===
                                            GameMode.SINGLEPLAYER
                                        ) {
                                            carouselApi?.scrollNext();
                                        } else {
                                            setOpenDialog("create");
                                        }
                                    }}
                                />
                            </div>
                            <Button
                                variant='ghost'
                                className='h-9 text-muted-foreground hover:text-white'
                                onClick={() =>
                                    carouselApi && carouselApi.scrollPrev()
                                }
                            >
                                <ArrowLeft className='size-4' /> Back
                            </Button>
                        </CarouselItem>
                        <CarouselItem className='flex flex-col items-center justify-center gap-5 px-2'>
                            <div className='text-center'>
                                <p className='text-xs font-medium uppercase tracking-[0.18em] text-violet-300'>Singleplayer</p>
                                <h2 className='mt-1 text-xl font-semibold tracking-tight text-white'>Choose a difficulty</h2>
                            </div>
                            <div className='flex flex-row flex-wrap justify-center gap-3 sm:gap-4'>
                                <MenuButton
                                    text='Easy'
                                    description='A relaxed match'
                                    selected={gameConfig.difficulty === AIDDifficulty.EASY}
                                    icon={<Smile className='size-7' />}
                                    onClick={() => {
                                        setGameConfig((prev) => ({
                                            ...prev,
                                            difficulty: AIDDifficulty.EASY,
                                        }));
                                        setOpenDialog("create");
                                    }}
                                />
                                <MenuButton
                                    text='Medium'
                                    description='A balanced challenge'
                                    selected={gameConfig.difficulty === AIDDifficulty.MEDIUM}
                                    icon={<Meh className='size-7' />}
                                    onClick={() => {
                                        setGameConfig((prev) => ({
                                            ...prev,
                                            difficulty: AIDDifficulty.MEDIUM,
                                        }));
                                        setOpenDialog("create");
                                    }}
                                />
                                <MenuButton
                                    text='Hard'
                                    description='A tough opponent'
                                    selected={gameConfig.difficulty === AIDDifficulty.HARD}
                                    icon={<Frown className='size-7' />}
                                    onClick={() => {
                                        setGameConfig((prev) => ({
                                            ...prev,
                                            difficulty: AIDDifficulty.HARD,
                                        }));
                                        setOpenDialog("create");
                                    }}
                                />
                            </div>
                            <Button
                                variant='ghost'
                                className='h-9 text-muted-foreground hover:text-white'
                                onClick={() =>
                                    carouselApi && carouselApi.scrollPrev()
                                }
                            >
                                <ArrowLeft className='size-4' /> Back
                            </Button>
                        </CarouselItem>
                    </CarouselContent>
                </Carousel>
                <div className='absolute bottom-0 left-0 z-0 flex w-full items-center justify-between px-3 py-2 text-xs text-muted-foreground/70'>
                    <p>v{packageJson.version}</p>
                </div>
            </main>
        </>
    );
}
