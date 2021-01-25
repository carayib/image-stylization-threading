import { EColor } from "../plotter/compositing";
import { IPeg } from "./thread-computer";

import { IThreadToGrow, ThreadComputerSpecific, ThreadsIterator } from "./thread-computer-specific";

class ThreadComputerMonochrome extends ThreadComputerSpecific {
    private threadPegs: IPeg[] = [];

    public get totalNbSegments(): number {
        return this.threadPegs.length > 1 ? this.threadPegs.length - 1 : 0;
    }

    public lowerNbSegments(targetNumber: number): void {
        ThreadComputerSpecific.lowerNbSegmentsForThread(this.threadPegs, targetNumber);
    }

    public iterateOnThreads(callback: ThreadsIterator): void {
        callback(this.threadPegs, EColor.MONOCHROME);
    }

    public getThreadToGrow(): IThreadToGrow {
        return {
            thread: this.threadPegs,
            color: EColor.MONOCHROME,
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
            const averageSourceValue = (data[4 * i + 0] + data[4 * i + 1] + data[4 * i + 2]) / 3;
            const adjustedValue = computeAdjustedValue(averageSourceValue);
            data[4 * i + 0] = adjustedValue;
            data[4 * i + 1] = adjustedValue;
            data[4 * i + 2] = adjustedValue;
        }
    }

    public enableSamplingFor(): void {
        if (this.sampleCanvas === null) {
            this.sampleCanvas = (data: Uint8ClampedArray, index: number) => {
                return data[index + 0]; // only check the red channel because the hidden canvas is in black and white
            }
        }
    }
}

export { ThreadComputerMonochrome };

