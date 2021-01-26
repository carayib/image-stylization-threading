import { EColor } from "../plotter/compositing";
import { IPeg } from "./thread-computer";

import { IThreadToGrow, ThreadComputerSpecific, ThreadsIterator } from "./thread-computer-specific";

interface ISegmentsRepartition {
    red: number;
    green: number;
    blue: number;
}

class ThreadComputerRedBlueGreen extends ThreadComputerSpecific {
    private threadPegsRed: IPeg[] = [];
    private threadPegsGreen: IPeg[] = [];
    private threadPegsBlue: IPeg[] = [];

    // indicators describing the colors repartition from the source image
    private frequencyRed: number;
    private frequencyGreen: number;
    private frequencyBlue: number;

    public get totalNbSegments(): number {
        return ThreadComputerSpecific.computeNbSegments(this.threadPegsRed) +
            ThreadComputerSpecific.computeNbSegments(this.threadPegsGreen) +
            ThreadComputerSpecific.computeNbSegments(this.threadPegsBlue);
    }

    public lowerNbSegments(targetNumber: number): void {
        const repartition = this.computeIdealSegmentsRepartition(targetNumber);

        ThreadComputerSpecific.lowerNbSegmentsForThread(this.threadPegsRed, repartition.red);
        ThreadComputerSpecific.lowerNbSegmentsForThread(this.threadPegsGreen, repartition.green);
        ThreadComputerSpecific.lowerNbSegmentsForThread(this.threadPegsBlue, repartition.blue);
    }

    public iterateOnThreads(callback: ThreadsIterator): void {
        callback(this.threadPegsRed, EColor.RED);
        callback(this.threadPegsGreen, EColor.GREEN);
        callback(this.threadPegsBlue, EColor.BLUE);
    }

    public getThreadToGrow(): IThreadToGrow {
        const repartition = this.computeIdealSegmentsRepartition(this.totalNbSegments + 1);
        if (repartition.red > 0 && this.threadPegsRed.length < repartition.red + 1) {
            return {
                thread: this.threadPegsRed,
                color: EColor.RED,
            };
        } else if (repartition.green > 0 && this.threadPegsGreen.length < repartition.green + 1) {
            return {
                thread: this.threadPegsGreen,
                color: EColor.GREEN,
            };
        }

        return {
            thread: this.threadPegsBlue,
            color: EColor.BLUE,
        };
    }

    public adjustCanvasData(data: Uint8ClampedArray, blackBackground: boolean): void {
        let cumulatedRed = 0;
        let cumulatedGreen = 0;
        let cumulatedBlue = 0;

        let computeAdjustedValue: (rawValue: number) => number;
        if (blackBackground) {
            computeAdjustedValue = (rawValue: number) => (255 - rawValue) / 2;
        } else {
            computeAdjustedValue = (rawValue: number) => rawValue / 2;
        }

        const nbPixels = data.length / 4;
        for (let i = 0; i < nbPixels; i++) {
            cumulatedRed += data[4 * i + 0];
            cumulatedGreen += data[4 * i + 1];
            cumulatedBlue += data[4 * i + 2];

            data[4 * i + 0] = computeAdjustedValue(data[4 * i + 0]);
            data[4 * i + 1] = computeAdjustedValue(data[4 * i + 1]);
            data[4 * i + 2] = computeAdjustedValue(data[4 * i + 2]);
        }

        this.frequencyRed = cumulatedRed / (cumulatedRed + cumulatedGreen + cumulatedBlue);
        this.frequencyGreen = cumulatedGreen / (cumulatedRed + cumulatedGreen + cumulatedBlue);
        this.frequencyBlue = cumulatedBlue / (cumulatedRed + cumulatedGreen + cumulatedBlue);
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

    private computeIdealSegmentsRepartition(totalNbSegments: number): ISegmentsRepartition {
        const idealRed = totalNbSegments * this.frequencyRed;
        const idealGreen = totalNbSegments * this.frequencyGreen;
        const idealBlue = totalNbSegments * this.frequencyBlue;

        const repartition = {
            red: Math.floor(idealRed),
            green: Math.floor(idealGreen),
            blue: Math.floor(idealBlue),
        };

        while (repartition.red + repartition.green + repartition.blue < totalNbSegments) {
            const currentFrequencyRed = repartition.red / (repartition.red + repartition.green + repartition.blue);
            const currentFrequencyGreen = repartition.green / (repartition.red + repartition.green + repartition.blue);
            const currentFrequencyBlue = repartition.blue / (repartition.red + repartition.green + repartition.blue);

            const gapRed = idealRed - currentFrequencyRed;
            const gapGreen = idealGreen - currentFrequencyGreen;
            const gapBlue = idealBlue - currentFrequencyBlue;

            if (gapRed > gapGreen && gapRed > gapBlue) {
                repartition.red++;
            } else if (gapGreen > gapRed && gapGreen > gapBlue) {
                repartition.green++;
            } else {
                repartition.blue++;
            }
        }

        return repartition;
    }
}

export { ThreadComputerRedBlueGreen };
