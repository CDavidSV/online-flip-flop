// components/RulesDialog.tsx

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface RulesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function RulesDialog({ open, onOpenChange }: RulesDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='max-h-[60vh] overflow-y-auto'>
                <DialogHeader>
                    <DialogTitle className='text-3xl font-bold'>
                        Game Rules
                    </DialogTitle>
                    <DialogDescription>
                        Rules for FlipFlop and FlipFour by Masahiro Nakajima.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue='flipflop' className='w-full'>
                    <TabsList className='grid w-full grid-cols-2'>
                        <TabsTrigger value='flipflop'>FlipFlop</TabsTrigger>
                        <TabsTrigger value='flipfour'>FlipFour</TabsTrigger>
                    </TabsList>

                    {/* ---------------------------------------------------------------- */}
                    {/* FLIPFLOP RULES TAB */}
                    {/* ---------------------------------------------------------------- */}
                    <TabsContent value='flipflop' className='p-2 space-y-6'>
                        <p>
                            FlipFlop is an abstract strategy game for 2 players,
                            invented in 2009 by Masahiro Nakajima. Its
                            distinctive characteristic is that the pieces move
                            differently every turn.
                        </p>

                        <section>
                            <h3 className='text-xl font-medium mt-4 mb-2'>
                                Goal
                            </h3>
                            <ul className='list-disc list-inside space-y-1 ml-4 text-sm'>
                                <li>
                                    You win when any of your pieces is in the{" "}
                                    <span className='font-semibold'>
                                        Goal space
                                    </span>{" "}
                                    on your opponent&apos;s side of the
                                    playfield at the end of your opponent&apos;s
                                    turn.
                                </li>
                                <li>
                                    You also win when your opponent has no legal
                                    moves.
                                </li>
                                <li>
                                    The game ends in a{" "}
                                    <span className='font-semibold'>draw</span>{" "}
                                    if the same configuration appears on the
                                    board three times.
                                </li>
                            </ul>
                        </section>

                        <section>
                            <h3 className='text-xl font-medium mt-4 mb-2'>
                                Setup
                            </h3>
                            <ul className='list-disc list-inside space-y-1 ml-4 text-sm'>
                                <li>
                                    The game is played on a checkered board (
                                    <span className='font-semibold'>3x3</span>{" "}
                                    or{" "}
                                    <span className='font-semibold'>5x5</span>).
                                </li>
                                <li>
                                    Each player has{" "}
                                    <span className='font-semibold'>
                                        5 double-sided pieces
                                    </span>
                                    . One side has an orthogonal{" "}
                                    <span className='font-semibold'>
                                        &quot;+&quot; cross (Rook-like movement)
                                    </span>
                                    , and the other has a diagonal{" "}
                                    <span className='font-semibold'>
                                        &quot;x&quot; cross (Bishop-like
                                        movement)
                                    </span>
                                    .
                                </li>
                                <li>
                                    Place a piece,{" "}
                                    <span className='font-semibold'>
                                        &quot;+&quot; side-up (Rook-side)
                                    </span>
                                    , in each space of the row closest to you.
                                </li>
                                <li>White plays first.</li>
                            </ul>
                        </section>

                        <section>
                            <h3 className='text-xl font-medium mt-4 mb-2'>
                                Play (Movement and Capturing)
                            </h3>
                            <ul className='list-disc list-inside space-y-3 ml-4 text-sm'>
                                <li>
                                    <span className='font-semibold'>
                                        Movement:
                                    </span>{" "}
                                    Players take turns moving one of their own
                                    pieces. A piece showing the{" "}
                                    <span className='font-semibold'>
                                        &quot;+&quot; (Rook)
                                    </span>{" "}
                                    moves{" "}
                                    <span className='font-semibold'>
                                        orthogonally
                                    </span>
                                    , and a piece showing the{" "}
                                    <span className='font-semibold'>
                                        &quot;x&quot; (Bishop)
                                    </span>{" "}
                                    moves{" "}
                                    <span className='font-semibold'>
                                        diagonally
                                    </span>
                                    . Move any distance through empty spaces.
                                </li>
                                <li>
                                    <span className='font-semibold'>
                                        No Jumping:
                                    </span>{" "}
                                    Jumping over other pieces is{" "}
                                    <span className='font-semibold'>
                                        not allowed
                                    </span>
                                    .
                                </li>
                                <li>
                                    <span className='font-semibold'>
                                        Flipping:
                                    </span>{" "}
                                    After you move your piece, you{" "}
                                    <span className='font-semibold'>
                                        must flip it over
                                    </span>{" "}
                                    (Rook-side becomes Bishop-side; Bishop-side
                                    becomes Rook-side).
                                </li>
                                <li>
                                    <span className='font-semibold'>
                                        Capturing:
                                    </span>{" "}
                                    You can capture an opponent&apos;s piece{" "}
                                    <span className='font-semibold'>
                                        only if it is in one of the Goal spaces
                                    </span>{" "}
                                    (yours or your opponent&apos;s). Capture by
                                    moving onto the Goal space it occupies and
                                    removing the captured piece from the board.
                                </li>
                                <li>
                                    <span className='font-semibold'>
                                        Passing:
                                    </span>{" "}
                                    Passing a turn is{" "}
                                    <span className='font-semibold'>
                                        not allowed
                                    </span>
                                    .
                                </li>
                            </ul>
                        </section>
                    </TabsContent>

                    {/* ---------------------------------------------------------------- */}
                    {/* FLIPFOUR RULES TAB */}
                    {/* ---------------------------------------------------------------- */}
                    <TabsContent value='flipfour' className='p-2 space-y-6'>
                        <p>
                            FlipFour is a four-in-a-row abstract strategy game
                            for 2 players, using only 4 pieces per player,
                            played on the{" "}
                            <span className='font-semibold'>5x5 board</span>.
                        </p>

                        <section>
                            <h3 className='text-xl font-medium mt-4 mb-2'>
                                Goal
                            </h3>
                            <ul className='list-disc list-inside space-y-1 ml-4 text-sm'>
                                <li>
                                    The first player to get{" "}
                                    <span className='font-semibold'>
                                        all 4 of their pieces in an orthogonal
                                        or diagonal line wins
                                    </span>
                                    . The orientation of the pieces (Rook-side
                                    or Bishop-side) does not matter for the win
                                    condition.
                                </li>
                            </ul>
                        </section>

                        <section>
                            <h3 className='text-xl font-medium mt-4 mb-2'>
                                How to Play
                            </h3>
                            <p className='text-sm mb-2'>
                                The board starts empty. Each player has 4
                                pieces. Players take turns either{" "}
                                <span className='font-semibold'>
                                    placing a new piece
                                </span>{" "}
                                or{" "}
                                <span className='font-semibold'>
                                    moving an existing piece
                                </span>
                                . White plays first.
                            </p>
                            <ul className='list-disc list-inside space-y-3 ml-4 text-sm'>
                                <li>
                                    <span className='font-semibold'>
                                        Placing:
                                    </span>{" "}
                                    When placing a new piece, it must be on an{" "}
                                    <span className='font-semibold'>
                                        empty space
                                    </span>
                                    . You can choose whether to place it{" "}
                                    <span className='font-semibold'>
                                        &quot;+&quot; side-up (Rook-side) or
                                        &quot;x&quot; side-up (Bishop-side)
                                    </span>
                                    .
                                </li>
                                <li>
                                    <span className='font-semibold'>
                                        Moving:
                                    </span>{" "}
                                    A piece showing the{" "}
                                    <span className='font-semibold'>
                                        &quot;+&quot; (Rook)
                                    </span>{" "}
                                    moves{" "}
                                    <span className='font-semibold'>
                                        orthogonally
                                    </span>
                                    , and a piece showing the{" "}
                                    <span className='font-semibold'>
                                        &quot;x&quot; (Bishop)
                                    </span>{" "}
                                    moves{" "}
                                    <span className='font-semibold'>
                                        diagonally
                                    </span>
                                    . Move to an{" "}
                                    <span className='font-semibold'>
                                        empty space
                                    </span>
                                    .
                                </li>
                                <li>
                                    <span className='font-semibold'>
                                        Jumping:
                                    </span>{" "}
                                    Pieces{" "}
                                    <span className='font-semibold'>
                                        can jump over other pieces
                                    </span>{" "}
                                    as long as the destination space is empty.
                                </li>
                                <li>
                                    <span className='font-semibold'>
                                        Flipping:
                                    </span>{" "}
                                    After you move your piece, you{" "}
                                    <span className='font-semibold'>
                                        must flip it over
                                    </span>{" "}
                                    (Rook-side becomes Bishop-side; Bishop-side
                                    becomes Rook-side).
                                </li>
                                <li>
                                    <span className='font-semibold'>
                                        Flexibility:
                                    </span>{" "}
                                    You can move your pieces before all of them
                                    are on the board.
                                </li>
                                <li>
                                    <span className='font-semibold'>
                                        Passing:
                                    </span>{" "}
                                    Passing a turn is{" "}
                                    <span className='font-semibold'>
                                        not allowed
                                    </span>
                                    .
                                </li>
                            </ul>
                        </section>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
