import { EColor } from "../plotter/compositing";
import { IPeg } from "./thread-computer";

import { IThreadToGrow, ThreadComputerSpecific, ThreadsIterator } from "./thread-computer-specific";

class ThreadComputerRedBlueGreen extends ThreadComputerSpecific {
    private threadPegsRed: IPeg[] = [];
    private threadPegsGreen: IPeg[] = [];
    private threadPegsBlue: IPeg[] = [];

    public get totalNbSegments(): number {
        const totalNbPegs = this.threadPegsRed.length + this.threadPegsGreen.length + this.threadPegsBlue.length;
        return totalNbPegs > 3 ? totalNbPegs - 3 : 0;
    }

    public lowerNbSegments(targetNumber: number): void {
        const baseSegmentsCount = Math.floor(targetNumber / 3);
        const nbThreadsForRed = baseSegmentsCount + ((targetNumber % 3 >= 1) ? 1 : 0);
        const nbThreadsForGreen = baseSegmentsCount + ((targetNumber % 3 >= 2) ? 1 : 0);
        const nbThreadsForBlue = baseSegmentsCount;

        ThreadComputerSpecific.lowerNbSegmentsForThread(this.threadPegsRed, nbThreadsForRed);
        ThreadComputerSpecific.lowerNbSegmentsForThread(this.threadPegsGreen, nbThreadsForGreen);
        ThreadComputerSpecific.lowerNbSegmentsForThread(this.threadPegsBlue, nbThreadsForBlue);
    }

    public iterateOnThreads(callback: ThreadsIterator): void {
        callback(this.threadPegsRed, EColor.RED);
        callback(this.threadPegsGreen, EColor.GREEN);
        callback(this.threadPegsBlue, EColor.BLUE);
    }

    public getThreadToGrow(): IThreadToGrow {
        const segmentId = this.totalNbSegments % 3;
        if (segmentId === 0) {
            return {
                thread: this.threadPegsRed,
                color: EColor.RED,
            };
        } else if (segmentId === 1) {
            return {
                thread: this.threadPegsGreen,
                color: EColor.GREEN,
            };
        } else {
            return {
                thread: this.threadPegsBlue,
                color: EColor.BLUE,
            };
        }
    }

    public adjustCanvasData(data: Uint8ClampedArray, blackBackground: boolean): void {
        let computeAdjustedValue: (rawValue: number) => number;
        if (blackBackground) {
            computeAdjustedValue = (rawValue: number) => (255 - rawValue) / 2;
        } else {
            computeAdjustedValue = (rawValue: number) => rawValue / 2;
        }

        const nbPixels = data.length / 4;
        for (let i = 0; i < nbPixels; i++) {
            data[4 * i + 0] = computeAdjustedValue(data[4 * i + 0]);
            data[4 * i + 1] = computeAdjustedValue(data[4 * i + 1]);
            data[4 * i + 2] = computeAdjustedValue(data[4 * i + 2]);
        }
    }

    public enableSamplingFor(color: EColor): void {
        let channel: number;
        if (color === EColor.RED) {
            channel = 0;
        } else if (color === EColor.GREEN) {
            channel = 1;
        } else {
            channel = 2;
        }

        this.sampleCanvas = (data: Uint8ClampedArray, index: number) => {
            return data[index + channel];
        }
    }
}

export { ThreadComputerRedBlueGreen };
