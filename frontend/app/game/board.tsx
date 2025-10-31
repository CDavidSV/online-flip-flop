import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { GameType } from "@/types/types";

export interface BoardProps {
    type?: GameType;
}

export function Board({ type }: BoardProps) {
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

    if (!type) {
        return (
            <div className='text-xl text-gray-500 dark:text-gray-400 font-bold p-8 text-center'>
                <Spinner className="size-8"/>
            </div>
        );
    }

    return (
        <div className={cn('w-full h-full grid gap-0.5 rounded-lg overflow-hidden', `${type === GameType.FLIPFLOP_3x3 ? 'grid-cols-3 grid-rows-3' : 'grid-cols-5 grid-rows-5'}`)}>
            {new Array(type === GameType.FLIPFLOP_3x3 ? 3 * 3 : 5 * 5).fill(null).map((_, index) => (
                <div
                    key={index}
                    className={goals.includes(index) ? 'border-4 border-red-600' : ''}
                    style={{ background: index % 2 === 0 ? colors.squarePrimaryColor : colors.squareSecondaryColor }}
                >
                </div>
            ))}
        </div>
    );
}
