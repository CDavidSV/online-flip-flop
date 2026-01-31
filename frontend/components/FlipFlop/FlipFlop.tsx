import { useGameRoom } from "@/context/roomContext";
import { useWebSocket } from "@/context/wsContext";
import { cn } from "@/lib/utils";
import {
    FFPiece,
    GameType,
    PlayerColor,
    PieceType,
    GameEndMsg,
} from "@/types/types";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export interface BoardProps {
    type: GameType;
    side: PlayerColor;
    initialBoardState?: string;
    onMoveMade?: (from: string, to: string) => void;
}

export function FlipFlop({
    type,
    side,
    initialBoardState,
    onMoveMade,
}: BoardProps) {
    const TURN_INDICATOR_DURATION = 2000; // Duration in milliseconds

    const router = useRouter();
    const colors = {
        squarePrimaryColor: "#891c7e",
        squareSecondaryColor: "#fff695",
    };

    let goals = [];
    const cols = ["A", "B", "C", "D", "E"];

    if (type === GameType.FLIPFLOP_3x3) {
        goals = [1, 7];
    } else {
        goals = [2, 22];
    }

    const { gameStatus, currentTurn, setCurrentTurn, resetRoom } = useGameRoom();
    const { sendRequest, on } = useWebSocket();

    const [gameBoard, setGameBoard] = useState<(FFPiece | null)[][]>([]);
    const [validMoves, setValidMoves] = useState<[number, number][]>([]);
    const [selectedPiece, setSelectedPiece] = useState<FFPiece | null>(null);
    const [showTurnIndicator, setShowTurnIndicator] = useState(false);
    const [isFadingOut, setIsFadingOut] = useState(false);
    const [showGameEnd, setShowGameEnd] = useState(false);
    const [gameEndResult, setGameEndResult] = useState<{
        winner: PlayerColor | null;
        reason: string;
    } | null>(null);
    const [isGameEndFadingOut, setIsGameEndFadingOut] = useState(false);
    const boardSize = type === GameType.FLIPFLOP_3x3 ? 3 : 5;

    useEffect(() => {
        const cleanupMove = on("move", (payload: any) => {
            if (payload.board) {
                const updatedBoard = parseBoardState(payload.board);
                setGameBoard(updatedBoard);

                setSelectedPiece(null);
                setValidMoves([]);

                // Show turn indicator
                setIsFadingOut(false);
                setShowTurnIndicator(true);
                setTimeout(() => {
                    setIsFadingOut(true);
                }, TURN_INDICATOR_DURATION - 300);
                setTimeout(() => {
                    setShowTurnIndicator(false);
                }, TURN_INDICATOR_DURATION);
            }
        });

        const cleanupEnd = on("end", (payload: GameEndMsg) => {
            setGameEndResult({
                winner: payload.winner,
                reason: payload.reason || "normal",
            });

            setIsGameEndFadingOut(false);
            setShowGameEnd(true);
        });

        if (initialBoardState) {
            const parsedBoard = parseBoardState(initialBoardState);
            setGameBoard(parsedBoard);
        } else {
            createBoard();
        }

        return () => {
            cleanupMove();
            cleanupEnd();
        };
    }, [side, on]);

    useEffect(() => {
        if (gameStatus === "ongoing") {
            // Show turn indicator when game starts
            setTimeout(() => {
                setIsFadingOut(false);
                setShowTurnIndicator(true);
                setTimeout(() => {
                    setIsFadingOut(true);
                }, TURN_INDICATOR_DURATION - 300);
                setTimeout(() => {
                    setShowTurnIndicator(false);
                }, TURN_INDICATOR_DURATION);
            }, 500);
        }
    }, [gameStatus]);

    const createBoard = () => {
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
                        id: crypto.randomUUID(),
                        selected: false,
                    } as FFPiece);
                } else if (i === boardSize - 1) {
                    row.push({
                        color: side,
                        side: PieceType.ROOK,
                        pos: [boardSize - 1, j],
                        captured: false,
                        id: crypto.randomUUID(),
                        selected: false,
                    } as FFPiece);
                } else {
                    row.push(null);
                }
            }

            board.push(row);
        }

        setGameBoard(board);
    };

    const parseBoardState = (fenString: string) => {
        // FEN format from backend:
        // o -> Empty square
        // a -> Black Rook
        // b -> Black Bishop
        // x -> White Rook
        // y -> White Bishop
        // / -> New row separator
        // Last character: 1 -> White turn, 2 -> Black turn
        // Example: "aoa/ybo/oxx1"

        // Extract the turn indicator (last character)
        const turnPart = fenString[fenString.length - 1];
        const boardPart = fenString.slice(0, -1);

        const rows = boardPart.split("/");
        const newBoard: (FFPiece | null)[][] = [];

        rows.forEach((rowStr, rowIndex) => {
            const row: (FFPiece | null)[] = [];
            for (let colIndex = 0; colIndex < rowStr.length; colIndex++) {
                const char = rowStr[colIndex];

                if (char === "o") {
                    row.push(null);
                } else {
                    let color: PlayerColor;
                    let pieceType: PieceType;

                    switch (char) {
                        case "a": // Black Rook
                            color = PlayerColor.BLACK;
                            pieceType = PieceType.ROOK;
                            break;
                        case "b": // Black Bishop
                            color = PlayerColor.BLACK;
                            pieceType = PieceType.BISHOP;
                            break;
                        case "x": // White Rook
                            color = PlayerColor.WHITE;
                            pieceType = PieceType.ROOK;
                            break;
                        case "y": // White Bishop
                            color = PlayerColor.WHITE;
                            pieceType = PieceType.BISHOP;
                            break;
                        default:
                            row.push(null);
                            continue;
                    }

                    row.push({
                        color,
                        side: pieceType,
                        pos: [rowIndex, colIndex],
                        captured: false,
                        id: crypto.randomUUID(),
                        selected: false,
                    } as FFPiece);
                }
            }
            newBoard.push(row);
        });

        // Update turn based on the turn indicator
        const newTurn =
            turnPart === "1" ? PlayerColor.WHITE : PlayerColor.BLACK;
        setCurrentTurn(newTurn);

        // Invert board for black player (they view the board from the opposite side)
        if (side === PlayerColor.BLACK) {
            const invertedBoard = newBoard
                .map((row) => [...row].reverse())
                .reverse();

            // Update piece positions to match inverted board
            invertedBoard.forEach((row, rowIndex) => {
                row.forEach((piece, colIndex) => {
                    if (piece) {
                        piece.pos = [rowIndex, colIndex];
                    }
                });
            });

            return invertedBoard;
        }

        return newBoard;
    };

    const calculateValidMoves = (piece: FFPiece) => {
        const moves: [number, number][] = [];
        const directions =
            piece.side === PieceType.ROOK
                ? [
                      [-1, 0],
                      [1, 0],
                      [0, -1],
                      [0, 1],
                  ]
                : [
                      [-1, -1],
                      [-1, 1],
                      [1, -1],
                      [1, 1],
                  ];

        for (const [dr, dc] of directions) {
            let r = piece.pos[0];
            let c = piece.pos[1];

            while (true) {
                r += dr;
                c += dc;

                if (r < 0 || r >= boardSize || c < 0 || c >= boardSize) break;

                const targetPiece = gameBoard[r][c];
                const targetIndex = r * boardSize + c;

                if (targetPiece) {
                    if (
                        goals.includes(targetIndex) &&
                        targetPiece.color !== piece.color
                    ) {
                        moves.push([r, c]);
                    }
                    break;
                } else {
                    moves.push([r, c]);
                }
            }
        }
        return moves;
    };

    const selectPiece = (piece: FFPiece) => {
        // Only allow selecting own pieces when game is ongoing and it's the player's turn
        if (
            piece.color !== side ||
            gameStatus != "ongoing" ||
            currentTurn !== side
        )
            return;

        gameBoard.forEach((row) =>
            row.forEach((p) => {
                if (p) {
                    p.selected = false;
                }
            }),
        );

        setSelectedPiece(piece);
        piece.selected = true;
        setGameBoard([...gameBoard]);

        const moves = calculateValidMoves(piece);
        setValidMoves(moves);
    };

    const executeMove = (isValidMove: boolean, targetPos: [number, number]) => {
        if (!isValidMove || !selectedPiece) return;

        let fromPos: string;
        let toPos: string;
        if (side === PlayerColor.WHITE) {
            fromPos = `${cols[selectedPiece.pos[1]]}${Math.abs(selectedPiece.pos[0] - boardSize)}`;
            toPos = `${cols[targetPos[1]]}${Math.abs(targetPos[0] - boardSize)}`;
        } else {
            fromPos = `${cols[boardSize - 1 - selectedPiece.pos[1]]}${selectedPiece.pos[0] + 1}`;
            toPos = `${cols[boardSize - 1 - targetPos[1]]}${targetPos[0] + 1}`;
        }

        // Update board state optimistically

        // First, we save the current board state
        const previousBoard = gameBoard.map((row) =>
            row.map((piece) => (piece ? { ...piece } : null)),
        );
        const newBoard = gameBoard.map((row) =>
            row.map((piece) => (piece ? { ...piece } : null)),
        );

        // Move the piece
        newBoard[selectedPiece.pos[0]][selectedPiece.pos[1]] = null;
        selectedPiece.pos = targetPos;
        selectedPiece.side =
            selectedPiece.side === PieceType.ROOK
                ? PieceType.BISHOP
                : PieceType.ROOK;
        newBoard[targetPos[0]][targetPos[1]] = selectedPiece;
        setGameBoard(newBoard);

        setSelectedPiece(null);
        setValidMoves([]);

        const prevTurn = currentTurn;
        setCurrentTurn((prev) =>
            prev === PlayerColor.WHITE ? PlayerColor.BLACK : PlayerColor.WHITE,
        );

        // Notify parent component of the move
        if (onMoveMade) {
            onMoveMade(fromPos, toPos);
        }

        // Change turn
        sendRequest("move", {
            from: fromPos,
            to: toPos,
        }).catch((reason: any) => {
            console.error("Move failed:", reason);

            // Reset the board to the previous state
            setGameBoard(previousBoard);

            // Revert the turn change
            setCurrentTurn(prevTurn);
        });
    };

    const handleReturnToMenu = () => {
        resetRoom();
        router.push("/");
    };

    return (
        <div className='relative w-full h-full aspect-square'>
            {/* Turn Indicator Banner */}
            {showTurnIndicator && (
                <div
                    className={cn(
                        "absolute top-0 left-1/2 -translate-x-1/2 z-50 transition-all duration-300",
                        isFadingOut
                            ? "animate-out fade-out slide-out-to-top-5"
                            : "animate-in fade-in slide-in-from-top-5",
                    )}
                >
                    <div
                        className={cn(
                            "px-8 py-4 rounded-b-2xl shadow-2xl backdrop-blur-sm border-4 border-t-0 flex items-center gap-3 min-w-[250px] justify-center",
                            currentTurn === PlayerColor.WHITE
                                ? "bg-white/95 border-gray-300 text-gray-900"
                                : "bg-gray-900/95 border-gray-700 text-white",
                        )}
                    >
                        <div
                            className={cn(
                                "w-4 h-4 rounded-full animate-pulse",
                                currentTurn === PlayerColor.WHITE
                                    ? "bg-gray-900"
                                    : "bg-white",
                            )}
                        />
                        <span className='font-bold text-lg tracking-wide'>
                            {currentTurn === side
                                ? "Your Turn"
                                : `${currentTurn === PlayerColor.WHITE ? "White" : "Black"}'s Turn`}
                        </span>
                        <div
                            className={cn(
                                "w-4 h-4 rounded-full animate-pulse",
                                currentTurn === PlayerColor.WHITE
                                    ? "bg-gray-900"
                                    : "bg-white",
                            )}
                        />
                    </div>
                </div>
            )}

            {/* Game End Popup */}
            {showGameEnd && gameEndResult && (
                <div
                    className={cn(
                        "fixed inset-0 flex items-center justify-center z-50 transition-all duration-300",
                        isGameEndFadingOut
                            ? "animate-out fade-out zoom-out-95"
                            : "animate-in fade-in zoom-in-95",
                    )}
                >
                    {/* Backdrop */}
                    <div className='fixed inset-0 bg-black/60 backdrop-blur-sm' />

                    {/* Popup Content */}
                    <div className='relative z-10'>
                        {gameEndResult.reason === "draw" ? (
                            // Draw popup
                            <div className='bg-gradient-to-br from-gray-400 to-gray-600 rounded-3xl shadow-2xl border-8 border-gray-300 p-12 text-center min-w-[400px] animate-in spin-in-180 duration-700'>
                                <h2 className='text-5xl font-black text-white mb-4 tracking-wider'>
                                    DRAW!
                                </h2>
                                <p className='text-2xl text-gray-100 font-semibold'>
                                    Well Played!
                                </p>
                                <button
                                    onClick={handleReturnToMenu}
                                    className='mt-8 px-8 py-4 bg-white text-gray-800 font-bold text-xl rounded-xl hover:bg-gray-100 transition-all duration-200 hover:scale-105 shadow-lg cursor-pointer'
                                >
                                    Return to Menu
                                </button>
                            </div>
                        ) : gameEndResult.winner === side ? (
                            // Victory popup
                            <div className='bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-500 rounded-3xl shadow-2xl border-8 border-yellow-200 p-12 text-center min-w-[400px] animate-in slide-in-from-bottom-10 duration-700'>
                                <h2 className='text-6xl font-black text-yellow-900 mb-4 tracking-wider drop-shadow-lg'>
                                    VICTORY!
                                </h2>
                                <p className='text-3xl text-yellow-800 font-bold'>
                                    You Win!
                                </p>
                                <button
                                    onClick={handleReturnToMenu}
                                    className='mt-8 px-8 py-4 bg-yellow-900 text-yellow-100 font-bold text-xl rounded-xl hover:bg-yellow-800 transition-all duration-200 hover:scale-105 shadow-lg cursor-pointer'
                                >
                                    Return to Menu
                                </button>
                            </div>
                        ) : (
                            // Defeat popup
                            <div className='bg-gradient-to-br from-red-500 via-red-600 to-red-700 rounded-3xl shadow-2xl border-8 border-red-400 p-12 text-center min-w-[400px] animate-in slide-in-from-top-10 duration-700'>
                                <h2 className='text-6xl font-black text-white mb-4 tracking-wider drop-shadow-lg'>
                                    DEFEAT
                                </h2>
                                <p className='text-3xl text-red-100 font-bold'>
                                    You Lose
                                </p>
                                <p className='text-xl text-red-200 mt-4'>
                                    Better luck next time!
                                </p>
                                <button
                                    onClick={handleReturnToMenu}
                                    className='mt-8 px-8 py-4 bg-white text-red-600 font-bold text-xl rounded-xl hover:bg-red-50 transition-all duration-200 hover:scale-105 shadow-lg cursor-pointer'
                                >
                                    Return to Menu
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
            <div
                className={cn(
                    "w-full h-full grid gap-0.5 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 shadow-inner border-4 border-gray-300 dark:border-gray-600",
                    `${
                        type === GameType.FLIPFLOP_3x3
                            ? "grid-cols-3 grid-rows-3"
                            : "grid-cols-5 grid-rows-5"
                    }`,
                )}
            >
                {gameBoard.map((row, rowIndex) =>
                    row.map((piece, colIndex) => {
                        const index = rowIndex * boardSize + colIndex;
                        const isValidMove = validMoves.some(
                            ([r, c]) => r === rowIndex && c === colIndex,
                        );

                        return (
                            <div
                                key={index}
                                className={cn(
                                    "flex items-center justify-center p-3 relative",
                                    goals.includes(index)
                                        ? "border-4 border-red-600"
                                        : "",
                                )}
                                style={{
                                    background:
                                        index % 2 === 0
                                            ? colors.squarePrimaryColor
                                            : colors.squareSecondaryColor,
                                }}
                                onClick={() =>
                                    executeMove(isValidMove, [
                                        rowIndex,
                                        colIndex,
                                    ])
                                }
                            >
                                {isValidMove && (
                                    <div className='absolute w-full h-full flex items-center justify-center cursor-pointer'>
                                        <div className='w-1/4 h-1/4 bg-green-500 rounded-full opacity-50 pointer-events-none z-10' />
                                    </div>
                                )}
                                {piece && (
                                    <img
                                        className={cn(
                                            "w-full h-full object-contain cursor-pointer transition-transform duration-200 relative z-20",
                                            piece.selected
                                                ? "scale-105"
                                                : "scale-100",
                                            isValidMove
                                                ? "animate-pulse"
                                                : "",
                                        )}
                                        onClick={() => selectPiece(piece)}
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
                                    />
                                )}
                            </div>
                        );
                    }),
                )}
            </div>
            <div className='absolute flex flex-row justify-around h-full w-full'>
                {Array.from({ length: boardSize }, (_, i) => (
                    <p
                        key={i}
                        className='text-lg font-bold text-muted-foreground md:text-2xl'
                    >
                        {side === PlayerColor.WHITE
                            ? cols[i]
                            : cols[boardSize - 1 - i]}
                    </p>
                ))}
            </div>
            <div className='absolute flex flex-col justify-around h-full -left-6 top-0'>
                {Array.from({ length: boardSize }, (_, i) => (
                    <p
                        key={i}
                        className='text-lg font-bold text-muted-foreground md:text-2xl'
                    >
                        {side === PlayerColor.WHITE
                            ? Math.abs(i - boardSize)
                            : Math.abs(boardSize - 1 - i - boardSize)}
                    </p>
                ))}
            </div>
        </div>
    );
}
