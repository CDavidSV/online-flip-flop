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
                className='absolute right-4 top-4 border border-solid rounded-2xl p-1.5 w-12 h-12 flex transition-all duration-300 ease-in-out'
                href='https://github.com/CDavidSV/online-flip-flop'
            >
                <svg
                    role='img'
                    className='fill-white'
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
                                                type='text'
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
                                                type='text'
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
                                                type='text'
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
            <main className='h-full w-full flex flex-col items-center justify-center'>
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
                    className='mb-6 p-6'
                    priority
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
                                onClick={() => setOpenDialog("join")}
                            />
                            <MenuButton
                                text='Rules'
                                icon={<BookOpen className='size-8' />}
                                onClick={() => setOpenDialog("rules")}
                            />
                        </CarouselItem>
                        <CarouselItem className='flex justify-center items-center flex-col gap-4'>
                            <div className='flex justify-center flex-row gap-4 flex-wrap'>
                                <MenuButton
                                    text='Singleplayer'
                                    icon={<User className='size-8' />}
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
                                    icon={<Users2 className='size-8' />}
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
                                    text='Easy'
                                    icon={<Smile className='size-8' />}
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
                                    icon={<Meh className='size-8' />}
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
                                    icon={<Frown className='size-8' />}
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
                    <p>v{packageJson.version}</p>
                </div>
            </main>
        </>
    );
}
