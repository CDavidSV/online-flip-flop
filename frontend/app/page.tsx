"use client";

import MenuButton from "@/components/ui/menuButton";
import { useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PInput } from "@/components/ui/p-input";
import { z } from "zod";
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
import { GameType, GameMode } from "@/types/types";
import RulesDialog from "@/app/rulesDialog";

const createGameFormSchema = z.object({
    username: z.string().min(3, "Player name is required"),
    password: z.string().optional(),
});

const joinGameFormSchema = z.object({
    username: z.string().min(3, "Player name is required"),
    roomId: z.string().length(4, "Room ID must be 4 characters"),
});

const passwordFormSchema = z.object({
    password: z.string().min(1, "Password is required"),
});

export default function Home() {
    const [newGameDialogOpen, setNewGameDialogOpen] = useState(false);
    const [joinGameDialogOpen, setJoinGameDialogOpen] = useState(false);
    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
    const [rulesDialogOpen, setRulesDialogOpen] = useState(false);

    const [gameType, setGameType] = useState<GameType | null>(null);
    const [gameMode, setGameMode] = useState<GameMode | null>(null);

    const [carouselApi, setCarouselApi] = useState<
        ReturnType<typeof useEmblaCarousel>[1] | null
    >(null);

    const createGameform = useForm<z.infer<typeof createGameFormSchema>>({
        resolver: zodResolver(createGameFormSchema),
        defaultValues: {
            username: "",
            password: "",
        },
    });

    const joinGameform = useForm<z.infer<typeof joinGameFormSchema>>({
        resolver: zodResolver(joinGameFormSchema),
        defaultValues: {
            username: "",
            roomId: "",
        },
    });

    const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
        resolver: zodResolver(passwordFormSchema),
        defaultValues: {
            password: "",
        },
    });

    const createGameFormSubmit = (
        data: z.infer<typeof createGameFormSchema>
    ) => {
        const createGameRequest: any = {
            username: data.username,
            game_type: gameType,
            game_mode: gameMode,
        };

        if (data.password && data.password.length > 0) {
            createGameRequest.password = data.password;
        }

        // Submit create game request to backend
    };

    const joinGameFormSubmit = (data: z.infer<typeof joinGameFormSchema>) => {};

    const passwordFormSubmit = (data: z.infer<typeof passwordFormSchema>) => {};

    return (
        <>
            <RulesDialog open={rulesDialogOpen} onOpenChange={setRulesDialogOpen} />
            {/* Create Game Dialog */}
            <Dialog
                open={newGameDialogOpen}
                onOpenChange={(open) => setNewGameDialogOpen(open)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create a New Game</DialogTitle>
                        <DialogDescription>
                            Enter your player name and an optional password to
                            create a new game.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...createGameform}>
                        <form
                            onSubmit={createGameform.handleSubmit(
                                createGameFormSubmit
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
                            <FormField
                                control={createGameform.control}
                                name='password'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Room Password</FormLabel>
                                        <FormControl>
                                            <PInput
                                                placeholder='Enter a password (optional)'
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            ></FormField>
                            <DialogFooter>
                                <Button className='w-full' type='submit'>
                                    Create Game
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
                                joinGameFormSubmit
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
                            <DialogFooter>
                                <Button className='w-full' type='submit'>
                                    Join Game
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Password prompt dialog */}
            <Dialog
                open={passwordDialogOpen}
                onOpenChange={(open) => setPasswordDialogOpen(open)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Enter Room Password</DialogTitle>
                        <DialogDescription>
                            This room is protected by a password. Please enter
                            the password to join the game.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...passwordForm}>
                        <form
                            onSubmit={passwordForm.handleSubmit(
                                passwordFormSubmit
                            )}
                            className='space-y-8'
                        >
                            <FormField
                                control={passwordForm.control}
                                name='password'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Password</FormLabel>
                                        <FormControl>
                                            <PInput
                                                placeholder='Enter the room password'
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <DialogFooter>
                                <Button className='w-full' type='submit'>
                                    Submit
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Main Menu */}
            <main className='min-h-screen flex flex-col items-center justify-center'>
                <h1 className='text-7xl mb-8'>FlipFlop</h1>

                <Carousel
                    opts={{ watchDrag: false, duration: 10 }}
                    className='w-screen'
                    setApi={(api) => setCarouselApi(api)}
                >
                    <CarouselContent>
                        <CarouselItem className='flex justify-center flex-row gap-4'>
                            <MenuButton
                                text='Create Game'
                                onClick={() =>
                                    carouselApi && carouselApi.scrollNext()
                                }
                            />
                            <MenuButton
                                text='Join Game'
                                onClick={() => setJoinGameDialogOpen(true)}
                            />
                            <MenuButton text='Rules' onClick={() => setRulesDialogOpen(true)} />
                        </CarouselItem>
                        <CarouselItem className='flex justify-center items-center flex-col gap-4'>
                            <div className='flex justify-center flex-row gap-4'>
                                <MenuButton
                                    text='Singleplayer'
                                    disabled
                                    onClick={() => {
                                        setGameMode(GameMode.SINGLEPLAYER);
                                        carouselApi && carouselApi.scrollNext();
                                    }}
                                />
                                <MenuButton
                                    text='Multiplayer'
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
                            <div className='flex justify-center flex-row gap-4'>
                                <MenuButton
                                    text='FlipFlop 3x3'
                                    onClick={() => {
                                        setGameType(GameType.FLIPFLOP_3x3);
                                        setNewGameDialogOpen(true);
                                    }}
                                />
                                <MenuButton
                                    text='FlipFlop 5x5'
                                    onClick={() => {
                                        setGameType(GameType.FLIPFLOP_5x5);
                                        setNewGameDialogOpen(true);
                                    }}
                                />
                                <MenuButton
                                    text='FlipFour'
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
            </main>
        </>
    );
}
