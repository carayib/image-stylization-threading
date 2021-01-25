import { EColor } from "../plotter/compositing";
import { IPeg } from "./thread-computer";

type ThreadsIterator = (thread: IPeg[], color: EColor) => unknown;

type SamplingFunction = (data: Uint8ClampedArray, index: number) => number;

interface IThreadToGrow {
    thread: IPeg[];
    color: EColor;
}

abstract class ThreadComputerSpecific {
    public abstract get totalNbSegments(): number;

    public abstract lowerNbSegments(targetNumber: number): void;

    public abstract iterateOnThreads(callback: ThreadsIterator): void;

    public abstract getThreadToGrow(): IThreadToGrow;

    public abstract adjustCanvasData(data: Uint8ClampedArray, blackBackground: boolean): void;

    public abstract enableSamplingFor(color: EColor): void;

    /**
     * @returns value in [0, 255]. Ideal value is 127
     */
    public sampleCanvas: SamplingFunction = null;

    protected static lowerNbSegmentsForThread(thread: IPeg[], targetNumber: number): void {
        if (targetNumber > 0) {
            thread.length = Math.min(thread.length, targetNumber + 1);
        } else {
            thread.length = 0;
        }
    }
}

export {
    IThreadToGrow,
    ThreadComputerSpecific,
    ThreadsIterator,
};
