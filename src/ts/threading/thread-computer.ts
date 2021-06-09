import { IPoint } from "../interfaces/i-point";
import { ISize } from "../interfaces/i-size";
import { EMode, EShape, Parameters } from "../parameters";
import { PlotterBase } from "../plotter/plotter-base";
import { Transformation } from "./transformation";
import { applyCanvasCompositing, EColor, ECompositingOperation, resetCanvasCompositing } from "../plotter/compositing";

import { ThreadMonochrome } from "./thread/thread-monochrome";
import { ThreadRedBlueGreen } from "./thread/thread-red-green-blue";
import { ThreadBase } from "./thread/thread-base";

const MIN_SAFE_NUMBER = -9007199254740991;
const TWO_PI = 2 * Math.PI;

function clamp(x: number, min: number, max: number): number {
    if (x < min) {
        return min;
    } else if (x > max) {
        return max;
    }
    return x;
}

function mix(a: number, b: number, x: number): number {
    return a * (1 - x) + b * x;
}

function distance(p1: IPoint, p2: IPoint): number {
    const dX = p1.x - p2.x;
    const dY = p1.y - p2.y;
    return Math.sqrt(dX * dX + dY * dY);
}

function randomItem<T>(list: T[]): T {
    if (list.length === 0) {
        return null;
    }
    const randomIndex = Math.floor(Math.random() * list.length);
    return list[randomIndex];
}

interface IPeg {
    x: number;
    y: number;
}

interface ISegment {
    peg1: IPeg;
    peg2: IPeg;
}

interface IErrorMeasure {
    average: number;
    variance: number;
    meanSquare: number;
}

type IndicatorUpdateFunction = (indicatorId: string, indicatorValue: string) => unknown;

/**
 * Class used to compute which thread path is the best choice.
 */
class ThreadComputer {
    private readonly sourceImage: HTMLImageElement;
    private readonly hiddenCanvas: HTMLCanvasElement;
    private readonly hiddenCanvasContext: CanvasRenderingContext2D;
    private hiddenCanvasData: ImageData = null
    private hiddenCanvasScale: number;

    private error: IErrorMeasure;

    private pegs: IPeg[];

    private lineOpacity: number; // in the final result
    private lineOpacityInternal: number;
    private lineThickness: number; // abstract unit

    private thread: ThreadBase;

    private arePegsTooClose: (peg1: IPeg, peg2: IPeg) => boolean;

    public constructor(image: HTMLImageElement) {
        this.sourceImage = image;

        this.hiddenCanvas = document.createElement("canvas");
        this.hiddenCanvasContext = this.hiddenCanvas.getContext("2d");

        this.reset(16 / 256, 1);
    }

    public drawThread(plotter: PlotterBase, nbSegmentsToIgnore: number): void {
        const transformation = this.computeTransformation(plotter.size);
        const lineWidth = (transformation.scaling * this.hiddenCanvasScale) * this.lineThickness;
        const compositing = Parameters.invertColors ? ECompositingOperation.LIGHTEN : ECompositingOperation.DARKEN;

        this.thread.iterateOnThreads(nbSegmentsToIgnore, (thread: IPeg[], color: EColor) => {
            const points: IPoint[] = [];
            for (const peg of thread) {
                points.push(transformation.transform(peg));
            }

            plotter.drawBrokenLine(points, color, this.lineOpacity, compositing, lineWidth);
        });
    }

    public drawPegs(plotter: PlotterBase): void {
        const transformation = this.computeTransformation(plotter.size);
        const pointSize = 0.5 * (transformation.scaling * this.hiddenCanvasScale);

        const points: IPoint[] = [];
        for (const peg of this.pegs) {
            points.push(transformation.transform(peg));
        }

        plotter.drawPoints(points, "red", pointSize);
    }

    public drawDebugView(targetContext: CanvasRenderingContext2D): void {
        targetContext.drawImage(this.hiddenCanvas, 0, 0, this.hiddenCanvas.width, this.hiddenCanvas.height);
    }

    /** Returns true if there is nothing more to compute */
    public computeNextSegments(maxMillisecondsTaken: number): boolean {
        const start = performance.now();

        const targetNbSegments = Parameters.nbLines;
        if (this.nbSegments === targetNbSegments) {
            // no new segment to compute
            return false;
        } else if (this.nbSegments > targetNbSegments) {
            // we drew too many lines already, removes the excess
            this.thread.lowerNbSegments(targetNbSegments);

            // redraw the hidden canvas from scratch
            this.resetHiddenCanvas();
            this.thread.iterateOnThreads(0, (thread: IPeg[], color: EColor) => {
                applyCanvasCompositing(this.hiddenCanvasContext, color, this.lineOpacityInternal, ECompositingOperation.LIGHTEN);

                for (let iPeg = 0; iPeg + 1 < thread.length; iPeg++) {
                    this.drawSegmentOnHiddenCanvas(thread[iPeg], thread[iPeg + 1]);
                }
            });

            this.computeError();
            return true;
        }

        let lastColor: EColor = null;
        while (this.nbSegments < targetNbSegments && performance.now() - start < maxMillisecondsTaken) {
            const threadToGrow = this.thread.getThreadToGrow();

            if (lastColor !== threadToGrow.color) {
                applyCanvasCompositing(this.hiddenCanvasContext, threadToGrow.color, this.lineOpacityInternal, ECompositingOperation.LIGHTEN);
                this.thread.enableSamplingFor(threadToGrow.color);
                lastColor = threadToGrow.color;
            }
            this.computeSegment(threadToGrow.thread);

            if (this.nbSegments % 100 === 0) {
                this.computeError();
            }
        }

        return true;
    }

    /**
     * @param opacity in [0,1]
     * @returns true if at least one parameter changed
     */
    public reset(opacity: number, linethickness: number): void {
        this.lineOpacity = opacity;
        this.lineThickness = linethickness;

        this.hiddenCanvasScale = Parameters.quality;

        if (Parameters.mode === EMode.MONOCHROME) {
            this.thread = new ThreadMonochrome();
        } else {
            this.thread = new ThreadRedBlueGreen();
        }
        this.resetHiddenCanvas();

        this.pegs = this.computePegs();
    }

    public updateIndicators(updateFunction: IndicatorUpdateFunction): void {
        updateFunction("pegs-count", this.pegs.length.toString());
        updateFunction("segments-count", this.nbSegments.toString());
        updateFunction("error-average", this.error.average.toString());
        updateFunction("error-mean-square", this.error.meanSquare.toString());
        updateFunction("error-variance", this.error.variance.toString());
    }

    public get nbSegments(): number {
        return this.thread.totalNbSegments;
    }

    public get instructions(): string {
        if (Parameters.mode !== EMode.MONOCHROME) {
            return "Instructions are only available for monochrome mode.";
        }
        if (Parameters.invertColors) {
            return "Instructions are only available for black thread.";
        }

        let domainWidth = -1;
        let domainHeight = -1;
        for (const peg of this.pegs) {
            if (domainWidth < peg.x) {
                domainWidth = peg.x;
            }
            if (domainHeight < peg.y) {
                domainHeight = peg.y;
            }
        }

        const instructions: string[] = [];
        instructions.push("Generated by https://piellardj.github.io/image-stylization-threading.\n");
        instructions.push("Here are instructions to reproduce this in real life. For the best result, make sure you used the website at the highest quality mode and the highest thread opacity.\n");

        instructions.push(`Space units used below are abstract, just scale it to whatever size you want. Typically, you can choose 1 unit = 1 millimeter.`);
        instructions.push(`Computed for a total size of ${domainWidth}x${domainHeight}.`);
        const threadThickness = this.lineThickness * this.hiddenCanvasScale;
        instructions.push(`Computed for a black thread of width ${threadThickness} and opacity ${this.lineOpacity} (this is equivalent to an opaque thread of width ${threadThickness * this.lineOpacity}).`);

        instructions.push("\nFirst here are the positions of the pegs:");

        interface INamedPeg extends IPeg {
            name: string;
        }

        const namedPegs = this.pegs as INamedPeg[];
        for (let iP = 0; iP < namedPegs.length; iP++) {
            namedPegs[iP].name = `PEG_${iP}`;
            instructions.push(`  - ${namedPegs[iP].name}: x=${namedPegs[iP].x.toFixed(2)} ; y=${namedPegs[iP].y.toFixed(2)}`);
        }

        instructions.push("\nThen here are the steps of the thread:");

        this.thread.iterateOnThreads(0, (thread: IPeg[]) => {
            const namedThread = thread as INamedPeg[];
            instructions.push(`  - First start from ${namedThread[0].name}`);
            for (let iP = 1; iP < namedThread.length; iP++) {
                instructions.push(`  - then go to ${namedThread[iP].name} (this is segment ${iP} / ${namedThread.length - 1})`);
            }
        });

        return instructions.join("\n");
    }

    private initializeHiddenCanvasLineProperties(): void {
        const theoricalThicknes = this.lineThickness * this.hiddenCanvasScale;

        if (theoricalThicknes <= 1) {
            // do not go below a line width of 1 because it creates artifact.
            // instead, lower the lines opacity.
            this.lineOpacityInternal = 0.5 * this.lineOpacity * theoricalThicknes;
            this.hiddenCanvasContext.lineWidth = 1;
        } else {
            this.lineOpacityInternal = 0.5 * this.lineOpacity;
            this.hiddenCanvasContext.lineWidth = theoricalThicknes;
        }
    }

    private computeSegment(thread: IPeg[]): void {
        let lastPeg: IPeg;
        let nextPeg: IPeg;

        if (thread.length === 0) {
            const startingSegment = this.computeBestStartingSegment();
            thread.push(startingSegment.peg1);
            lastPeg = startingSegment.peg1;
            nextPeg = startingSegment.peg2;
        } else {
            lastPeg = thread[thread.length - 1];
            const HISTORY_SIZE = Math.min(thread.length, 20);
            const prevousPegs = thread.slice(-HISTORY_SIZE);
            nextPeg = this.computeBestNextPeg(lastPeg, prevousPegs);
        }

        thread.push(nextPeg);
        this.drawSegmentOnHiddenCanvas(lastPeg, nextPeg);
    }

    private resetHiddenCanvas(): void {
        const wantedSize = ThreadComputer.computeBestSize(this.sourceImage, 100 * this.hiddenCanvasScale);
        this.hiddenCanvas.width = wantedSize.width;
        this.hiddenCanvas.height = wantedSize.height;

        resetCanvasCompositing(this.hiddenCanvasContext);
        this.hiddenCanvasContext.drawImage(this.sourceImage, 0, 0, wantedSize.width, wantedSize.height);

        // change the base level so that pure white becomes medium grey
        const imageData = this.hiddenCanvasContext.getImageData(0, 0, wantedSize.width, wantedSize.height);
        this.thread.adjustCanvasData(imageData.data, Parameters.invertColors);
        this.hiddenCanvasContext.putImageData(imageData, 0, 0);
        this.computeError();

        this.initializeHiddenCanvasLineProperties();
    }

    private computeError(): void {
        this.uploadCanvasDataToCPU();

        this.error = {
            average: 0,
            variance: 0,
            meanSquare: 0,
        };

        const nbPixels = this.hiddenCanvasData.width * this.hiddenCanvasData.height;
        const nbSamples = 3 * nbPixels;
        for (let iP = 0; iP < nbPixels; iP++) {
            const errorRed = 127 - this.hiddenCanvasData.data[4 * iP + 0];
            const errorGreen = 127 - this.hiddenCanvasData.data[4 * iP + 1];
            const errorBlue = 127 - this.hiddenCanvasData.data[4 * iP + 2];

            this.error.average += errorRed + errorGreen + errorBlue;
            this.error.meanSquare += (errorRed * errorRed) + (errorGreen * errorGreen) + (errorBlue * errorBlue);
        }
        this.error.average = Math.round(this.error.average / nbSamples);
        this.error.meanSquare = Math.round(this.error.meanSquare / nbSamples);

        for (let iP = 0; iP < nbPixels; iP++) {
            const errorRed = 127 - this.hiddenCanvasData.data[4 * iP + 0];
            const errorGreen = 127 - this.hiddenCanvasData.data[4 * iP + 1];
            const errorBlue = 127 - this.hiddenCanvasData.data[4 * iP + 2];
            const error = (errorRed + errorGreen + errorBlue) / 3;
            const distancetoError = error - this.error.average;
            this.error.variance += distancetoError * distancetoError;
        }
        this.error.variance = Math.round(this.error.variance / nbSamples);
    }

    private computeTransformation(targetSize: ISize): Transformation {
        return new Transformation(targetSize, this.hiddenCanvas);
    }

    private drawSegmentOnHiddenCanvas(peg1: IPeg, peg2: IPeg): void {
        this.hiddenCanvasContext.beginPath();
        this.hiddenCanvasContext.moveTo(peg1.x, peg1.y);
        this.hiddenCanvasContext.lineTo(peg2.x, peg2.y);
        this.hiddenCanvasContext.stroke();
        this.hiddenCanvasContext.closePath();

        // invalidate CPU data
        this.hiddenCanvasData = null;
    }

    private computeBestStartingSegment(): ISegment {
        let candidates: ISegment[] = [];
        let bestScore = MIN_SAFE_NUMBER;

        const step = 1 + Math.floor(this.pegs.length / 100);
        for (let iPegId1 = 0; iPegId1 < this.pegs.length; iPegId1 += step) {
            for (let iPegId2 = iPegId1 + 1; iPegId2 < this.pegs.length; iPegId2 += step) {
                const peg1 = this.pegs[iPegId1];
                const peg2 = this.pegs[iPegId2];

                if (!this.arePegsTooClose(peg1, peg2)) {
                    const candidateScore = this.computeSegmentPotential(peg1, peg2);
                    if (candidateScore > bestScore) {
                        bestScore = candidateScore;
                        candidates = [{ peg1, peg2, }];
                    } else if (candidateScore === bestScore) {
                        candidates.push({ peg1, peg2, });
                    }
                }
            }
        }

        return randomItem(candidates);
    }

    private computeBestNextPeg(currentPeg: IPeg, pegsToAvoid: IPeg[]): IPeg {
        let candidates: IPeg[] = [];
        let bestScore = MIN_SAFE_NUMBER;

        for (const peg of this.pegs) {
            if (!this.arePegsTooClose(currentPeg, peg) && !pegsToAvoid.includes(peg)) {
                const candidateScore = this.computeSegmentPotential(currentPeg, peg);
                if (candidateScore > bestScore) {
                    bestScore = candidateScore;
                    candidates = [peg];
                } else if (candidateScore === bestScore) {
                    candidates.push(peg);
                }
            }
        }

        return randomItem(candidates);
    }

    private uploadCanvasDataToCPU(): void {
        if (this.hiddenCanvasData === null) {
            const width = this.hiddenCanvas.width;
            const height = this.hiddenCanvas.height;
            this.hiddenCanvasData = this.hiddenCanvasContext.getImageData(0, 0, width, height);
        }
    }

    /* The higher the result, the better a choice the thread is. */
    private computeSegmentPotential(peg1: IPeg, peg2: IPeg): number {
        this.uploadCanvasDataToCPU();

        let potential = 0;

        const segmentLength = distance(peg1, peg2);
        const nbSamples = Math.ceil(segmentLength);
        for (let iSample = 0; iSample < nbSamples; iSample++) {
            const r = (iSample + 1) / (nbSamples + 1);
            const sample: IPoint = {
                x: mix(peg1.x, peg2.x, r),
                y: mix(peg1.y, peg2.y, r),
            };

            const imageValue = this.sampleCanvasData(sample);
            const finalValue = imageValue + (this.lineOpacityInternal * 255);
            const contribution = 127 - finalValue;
            potential += contribution;
        }

        return potential / nbSamples;
    }

    /** Linear interpolation. Returns a result in [0, 255] */
    private sampleCanvasData(coords: IPoint): number {
        const width = this.hiddenCanvasData.width;
        const height = this.hiddenCanvasData.height;

        const minX = clamp(Math.floor(coords.x), 0, width - 1);
        const maxX = clamp(Math.ceil(coords.x), 0, width - 1);
        const minY = clamp(Math.floor(coords.y), 0, height - 1);
        const maxY = clamp(Math.ceil(coords.y), 0, height - 1);

        const topLeft = this.sampleCanvasPixel(minX, minY);
        const topRight = this.sampleCanvasPixel(maxX, minY);
        const bottomLeft = this.sampleCanvasPixel(minX, maxY);
        const bottomRight = this.sampleCanvasPixel(maxX, maxY);

        const fractX = coords.x % 1;
        const top = mix(topLeft, topRight, fractX);
        const bottom = mix(bottomLeft, bottomRight, fractX);

        const fractY = coords.y % 1;
        return mix(top, bottom, fractY);
    }

    private sampleCanvasPixel(pixelX: number, pixelY: number): number {
        const index = 4 * (pixelX + pixelY * this.hiddenCanvasData.width);
        return this.thread.sampleCanvas(this.hiddenCanvasData.data, index);
    }

    private static computeBestSize(sourceImageSize: ISize, maxSize: number): ISize {
        const maxSourceSide = Math.max(sourceImageSize.width, sourceImageSize.height);
        const sizingFactor = maxSize / maxSourceSide;
        return {
            width: Math.ceil(sourceImageSize.width * sizingFactor),
            height: Math.ceil(sourceImageSize.height * sizingFactor),
        };
    }

    private computePegs(): IPeg[] {
        /* First, compute pegs for a fixed-size canvas*/
        let domainSize: ISize;
        {
            const DEFAULT_CANVAS_SIZE_FOR_PEGS = 1000;
            const aspectRatio = this.hiddenCanvas.width / this.hiddenCanvas.height;
            if (aspectRatio > 1) {
                domainSize = { width: DEFAULT_CANVAS_SIZE_FOR_PEGS, height: Math.round(DEFAULT_CANVAS_SIZE_FOR_PEGS / aspectRatio) };
            } else {
                domainSize = { width: Math.round(DEFAULT_CANVAS_SIZE_FOR_PEGS * aspectRatio), height: DEFAULT_CANVAS_SIZE_FOR_PEGS };
            }
        }
        const pegsShape = Parameters.shape;
        const pegsSpacing = 20 * Parameters.pegsSpacing;

        const pegs: IPeg[] = [];

        if (pegsShape === EShape.RECTANGLE) {
            this.arePegsTooClose = (peg1: IPeg, peg2: IPeg) => {
                return peg1.x === peg2.x || peg1.y === peg2.y;
            };

            const maxX = domainSize.width;
            const maxY = domainSize.height;

            const nbPegsPerWidth = Math.ceil(maxX / pegsSpacing);
            const nbPegsPerHeight = Math.ceil(maxY / pegsSpacing);

            pegs.push({ x: 0, y: 0 });

            for (let iW = 1; iW < nbPegsPerWidth; iW++) {
                pegs.push({ x: maxX * (iW / nbPegsPerWidth), y: 0 });
            }

            pegs.push({ x: maxX, y: 0 });

            for (let iH = 1; iH < nbPegsPerHeight; iH++) {
                pegs.push({ x: maxX, y: maxY * (iH / nbPegsPerHeight) });
            }

            pegs.push({ x: maxX, y: maxY });

            for (let iW = nbPegsPerWidth - 1; iW >= 1; iW--) {
                pegs.push({ x: maxX * (iW / nbPegsPerWidth), y: maxY });
            }

            pegs.push({ x: 0, y: maxY });

            for (let iH = nbPegsPerHeight - 1; iH >= 1; iH--) {
                pegs.push({ x: 0, y: maxY * (iH / nbPegsPerHeight) });
            }
        } else {
            interface IPegCircle extends IPeg {
                angle: number;
            }

            this.arePegsTooClose = (peg1: IPeg, peg2: IPeg) => {
                const absDeltaAngle = Math.abs((peg1 as IPegCircle).angle - (peg2 as IPegCircle).angle);
                const minAngle = Math.min(absDeltaAngle, TWO_PI - absDeltaAngle);
                return minAngle <= TWO_PI / 16;
            };

            const maxSize = Math.max(domainSize.width, domainSize.height);
            const nbPegs = Math.ceil(0.5 * TWO_PI * maxSize / pegsSpacing);
            const baseDeltaAngle = TWO_PI / nbPegs;
            for (let iPeg = 0; iPeg < nbPegs; iPeg++) {
                const angle = iPeg * baseDeltaAngle;
                const peg: IPegCircle = {
                    x: 0.5 * domainSize.width * (1 + Math.cos(angle)),
                    y: 0.5 * domainSize.height * (1 + Math.sin(angle)),
                    angle,
                }
                pegs.push(peg);
            }
        }

        /* Then adjust the pegs to the actual canvas size */
        for (const peg of pegs) {
            peg.x *= this.hiddenCanvas.width / domainSize.width;
            peg.y *= this.hiddenCanvas.height / domainSize.height;
        }

        return pegs;
    }
}

export { ThreadComputer, IPeg };
