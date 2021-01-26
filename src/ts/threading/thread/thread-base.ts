import { EColor } from "../../plotter/compositing";
import { IPeg } from "../thread-computer";

type ThreadsIterator = (thread: IPeg[], color: EColor) => unknown;

type SamplingFunction = (data: Uint8ClampedArray, index: number) => number;

interface IThreadToGrow {
    thread: IPeg[];
    color: EColor;
}

abstract class ThreadBase {
    public abstract get totalNbSegments(): number;

    public abstract lowerNbSegments(targetNumber: number): void;

    public abstract iterateOnThreads(nbSegmentsToIgnore: number, callback: ThreadsIterator): void;

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

    protected static computeNbSegments(thread: IPeg[]): number {
        return (thread.length > 1) ? thread.length - 1 : 0;
    }

    public static iterateOnThread(thread: IPeg[], color: EColor, fromSegmentNumber: number, callback: ThreadsIterator): void {
        const threadLength = ThreadBase.computeNbSegments(thread);
        if (fromSegmentNumber < threadLength) {
            const threadPart = thread.slice(fromSegmentNumber);
            callback(threadPart, color);
        }
    }
}

export {
    IThreadToGrow,
    ThreadBase,
    ThreadsIterator,
};
