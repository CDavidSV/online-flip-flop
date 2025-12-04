import { cn } from "@/lib/utils";
import { FFPiece, GameType, PlayerColor, PieceType } from "@/types/types";
import { useEffect, useState } from "react";

export interface BoardProps {
    type: GameType;
    side: PlayerColor;
}

export function FlipFlop({ type, side }: BoardProps) {
    const colors = {
        squarePrimaryColor: "#891c7e",
        squareSecondaryColor: "#fff695",
    };

    let goals: number[];

    if (type === GameType.FLIPFLOP_3x3) {
        goals = [1, 7];
    } else {
        goals = [2, 22];
    }

    const [gameBoard, setGameBoard] = useState<(FFPiece | null)[][]>([]);
    const boardSize = type === GameType.FLIPFLOP_3x3 ? 3 : 5;

    useEffect(() => {
        const board: (FFPiece | null)[][] = [];
        for (let i = 0; i < boardSize; i++) {
            const row: (FFPiece | null)[] = [];
            for (let j = 0; j < boardSize; j++) {
                if (i === 0) {
                    row.push({
                        color:
                            side === PlayerColor.WHITE
                                ? PlayerColor.BLACK
                                : PlayerColor.WHITE,
                        side: PieceType.ROOK,
                        pos: [0, j],
                        captured: false,
                    } as FFPiece);
                } else if (i === boardSize - 1) {
                    row.push({
                        color: side,
                        side: PieceType.ROOK,
                        pos: [boardSize - 1, j],
                        captured: false,
                    } as FFPiece);
                } else {
                    row.push(null);
                }
            }

            board.push(row);
        }

        setGameBoard(board);
    }, [side]);

    return (
        <div
            className={cn(
                "w-full h-full grid gap-0.5 rounded-lg overflow-hidden",
                `${
                    type === GameType.FLIPFLOP_3x3
                        ? "grid-cols-3 grid-rows-3"
                        : "grid-cols-5 grid-rows-5"
                }`
            )}
        >
            {gameBoard.map((row, rowIndex) =>
                row.map((piece, colIndex) => {
                    const index = rowIndex * boardSize + colIndex;
                    return (
                        <div
                            key={index}
                            className={cn(
                                goals.includes(index)
                                    ? "border-4 border-red-600"
                                    : "",
                                "flex items-center justify-center p-3"
                            )}
                            style={{
                                background:
                                    index % 2 === 0
                                        ? colors.squarePrimaryColor
                                        : colors.squareSecondaryColor,
                            }}
                        >
                            {piece && (
                                <img
                                    src={`/assets/pieces/${
                                        piece.color === PlayerColor.WHITE
                                            ? "white"
                                            : "black"
                                    }_${
                                        piece.side === PieceType.ROOK
                                            ? "rook"
                                            : "bishop"
                                    }.svg`}
                                    alt={`${
                                        piece.color === PlayerColor.WHITE
                                            ? "White"
                                            : "Black"
                                    } ${
                                        piece.side === PieceType.ROOK
                                            ? "Rook"
                                            : "Bishop"
                                    }`}
                                    className='w-full h-full object-contain'
                                />
                            )}
                        </div>
                    );
                })
            )}
        </div>
    );
}
