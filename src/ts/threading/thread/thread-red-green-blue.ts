import { EColor } from "../../plotter/compositing";
import { IPeg } from "../thread-computer";

import { IThreadToGrow, ThreadBase, ThreadsIterator } from "./thread-base";

interface ISegmentsRepartition {
    red: number;
    green: number;
    blue: number;
}

class ThreadRedBlueGreen extends ThreadBase {
    private threadPegsRed: IPeg[] = [];
    private threadPegsGreen: IPeg[] = [];
    private threadPegsBlue: IPeg[] = [];

    // indicators describing the colors repartition from the source image
    private frequencyRed: number;
    private frequencyGreen: number;
    private frequencyBlue: number;

    public get totalNbSegments(): number {
        return ThreadBase.computeNbSegments(this.threadPegsRed) +
            ThreadBase.computeNbSegments(this.threadPegsGreen) +
            ThreadBase.computeNbSegments(this.threadPegsBlue);
    }

    public lowerNbSegments(targetNumber: number): void {
        const repartition = this.computeIdealSegmentsRepartition(targetNumber);

        ThreadBase.lowerNbSegmentsForThread(this.threadPegsRed, repartition.red);
        ThreadBase.lowerNbSegmentsForThread(this.threadPegsGreen, repartition.green);
        ThreadBase.lowerNbSegmentsForThread(this.threadPegsBlue, repartition.blue);
    }

    public iterateOnThreads(nbSegmentsToIgnore: number, callback: ThreadsIterator): void {
        const repartition = this.computeIdealSegmentsRepartition(nbSegmentsToIgnore);

        ThreadBase.iterateOnThread(this.threadPegsRed, EColor.RED, repartition.red, callback);
        ThreadBase.iterateOnThread(this.threadPegsGreen, EColor.GREEN, repartition.green, callback);
        ThreadBase.iterateOnThread(this.threadPegsBlue, EColor.BLUE, repartition.blue, callback);
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

        if (!blackBackground) {
            cumulatedRed = 255 * nbPixels - cumulatedRed;
            cumulatedGreen = 255 * nbPixels - cumulatedGreen;
            cumulatedBlue = 255 * nbPixels - cumulatedBlue;
        }

        const totalColor = cumulatedRed + cumulatedGreen + cumulatedBlue;
        this.frequencyRed = cumulatedRed / totalColor;
        this.frequencyGreen = cumulatedGreen / totalColor;
        this.frequencyBlue = cumulatedBlue / totalColor;
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
            const currentFrequencyRed = repartition.red / Math.max(1, repartition.red + repartition.green + repartition.blue);
            const currentFrequencyGreen = repartition.green / Math.max(1, repartition.red + repartition.green + repartition.blue);
            const currentFrequencyBlue = repartition.blue / Math.max(1, repartition.red + repartition.green + repartition.blue);

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

export { ThreadRedBlueGreen };
