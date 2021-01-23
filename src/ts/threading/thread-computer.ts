import { IPoint } from "../interfaces/i-point";
import { ISize } from "../interfaces/i-size";
import { EShape, Parameters } from "../parameters";
import { PlotterBase } from "../plotter/plotter-base";
import { Transformation } from "./transformation";

import * as Statistics from "../statistics/statistics";

const MIN_SAFE_NUMBER = -9007199254740991;
const HIDDEN_CANVAS_SIZE = 256; // pixels
const TWO_PI = 2 * Math.PI;

const DEFAULT_COMPOSITING = "source-over";
const ADDITIVE_COMPOSITING = "lighter";

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

type IndicatorUpdateFunction = (indicatorId: string, indicatorValue: string) => unknown;

/**
 * Class used to compute which thread path is the best choice.
 */
class ThreadComputer {
    private readonly sourceImage: HTMLImageElement;
    private readonly hiddenCanvas: HTMLCanvasElement;
    private readonly hiddenCanvasContext: CanvasRenderingContext2D;
    private hiddenCanvasData: ImageData = null

    private pegsShape: EShape;
    private pegsSpacing: number;
    private pegs: IPeg[];

    private lineOpacity: number;
    private lineThickness: number;

    private threadPegs: IPeg[];
    private threadLength: number;
    private arePegsTooClose: (peg1: IPeg, peg2: IPeg) => boolean;

    public constructor(image: HTMLImageElement) {
        this.sourceImage = image;

        this.hiddenCanvas = document.createElement("canvas");
        this.hiddenCanvasContext = this.hiddenCanvas.getContext("2d");

        this.reset(16 / 256, 1);
    }

    public drawThread(plotter: PlotterBase): void {
        const transformation = this.computeTransformation(plotter.size);
        const lineWidth = 1 * transformation.scaling * this.lineThickness;

        const points: IPoint[] = [];
        for (const peg of this.threadPegs) {
            points.push(transformation.transform(peg));
        }

        const baseColor = Parameters.invertColors ? "255,255,255" : "0,0,0";
        const lineColor = `rgba(${baseColor}, ${this.lineOpacity})`;
        plotter.drawBrokenLine(points, lineColor, lineWidth);
    }

    public drawPegs(plotter: PlotterBase): void {
        const transformation = this.computeTransformation(plotter.size);
        const pointSize = 3 * transformation.scaling;

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
            if (targetNbSegments > 0) {
                this.threadPegs.length = targetNbSegments + 1;
            } else {
                this.threadPegs.length = 0;
            }

            this.resetHiddenCanvas();
            this.initializeHiddenCanvasCompositing();
            for (let iPeg = 0; iPeg + 1 < this.threadPegs.length; iPeg++) {
                this.drawSegmentOnHiddenCanvas(this.threadPegs[iPeg], this.threadPegs[iPeg + 1]);
            }
            return true;
        }

        this.initializeHiddenCanvasCompositing();

        while (this.nbSegments < targetNbSegments && performance.now() - start < maxMillisecondsTaken) {
            this.computeSegment();
        }

        return true;
    }

    /**
     * @param opacity in [0,1]
     * @returns true if at least one parameter changed
     */
    public reset(opacity: number, linethickness: number): void {
        this.pegsShape = Parameters.shape;
        this.pegsSpacing = Parameters.pegsSpacing;
        this.pegs = this.computePegs();

        this.lineOpacity = opacity;
        this.lineThickness = linethickness;

        this.threadPegs = [];
        this.threadLength = 0;
        this.resetHiddenCanvas();
    }

    public updateIndicators(plotter: PlotterBase, updateFunction: IndicatorUpdateFunction): void {
        const transformation = this.computeTransformation(plotter.size);
        const totalLength = this.threadLength * transformation.scaling;

        updateFunction("pegs-count", this.pegs.length.toString());
        updateFunction("segments-count", this.nbSegments.toString());
        updateFunction("thread-length", totalLength.toFixed(0) + " pixels");

    }

    private initializeHiddenCanvasCompositing(): void {
        let opacity: number;
        if (this.lineThickness <= 1) {
            // do not go below a line width of 1 because it creates artifact.
            // instead, lower the lines opacity.
            opacity = this.lineOpacity * this.lineThickness;
            this.hiddenCanvasContext.lineWidth = 1;
        } else {
            opacity = this.lineOpacity;
            this.hiddenCanvasContext.lineWidth = this.lineThickness;
        }
        opacity *= 0.5;

        this.hiddenCanvasContext.globalCompositeOperation = ADDITIVE_COMPOSITING;
        if (this.hiddenCanvasContext.globalCompositeOperation === ADDITIVE_COMPOSITING) {
            this.hiddenCanvasContext.strokeStyle = `rgb(${255 * opacity}, ${255 * opacity}, ${255 * opacity})`;
        } else {
            Page.Demopage.setErrorMessage("best-compositing-not-supported", `Your browser does not support canvas2D compositing ${ADDITIVE_COMPOSITING}, which might lead to artifacts.`);
            this.hiddenCanvasContext.strokeStyle = `rgba(255,255,255,${opacity})`;
            this.hiddenCanvasContext.globalCompositeOperation = DEFAULT_COMPOSITING;
        }
    }

    private get nbSegments(): number {
        return this.threadPegs.length > 1 ? this.threadPegs.length - 1 : 0;
    }

    private computeSegment(): void {
        let lastPeg: IPeg;
        let nextPeg: IPeg;

        if (this.threadPegs.length === 0) {
            const startingSegment = this.computeBestStartingSegment();
            this.threadPegs.push(startingSegment.peg1);
            lastPeg = startingSegment.peg1;
            nextPeg = startingSegment.peg2;
        } else {
            lastPeg = this.threadPegs[this.threadPegs.length - 1];
            nextPeg = this.computeBestNextPeg(lastPeg);
        }

        this.threadPegs.push(nextPeg);
        this.threadLength += distance(lastPeg, nextPeg);
        this.drawSegmentOnHiddenCanvas(lastPeg, nextPeg);
    }

    private resetHiddenCanvas(): void {
        Statistics.startTimer("thread-computer.resetHiddenCanvas", true);
        const wantedSize = ThreadComputer.computeBestSize(this.sourceImage, HIDDEN_CANVAS_SIZE);
        this.hiddenCanvas.width = wantedSize.width;
        this.hiddenCanvas.height = wantedSize.height;

        this.hiddenCanvasContext.globalCompositeOperation = DEFAULT_COMPOSITING;
        this.hiddenCanvasContext.drawImage(this.sourceImage, 0, 0, wantedSize.width, wantedSize.height);

        let computeAdjustedValue: (r: number, g: number, b: number) => number;
        if (Parameters.invertColors) {
            computeAdjustedValue = (r: number, g: number, b: number) => 128 - (r + g + b) / 3 / 2;
        } else {
            computeAdjustedValue = (r: number, g: number, b: number) => (r + g + b) / 3 / 2;
        }

        // change the base level so that pure white becomes medium grey
        const imageData = this.hiddenCanvasContext.getImageData(0, 0, wantedSize.width, wantedSize.height);
        const canvasData = imageData.data;
        const nbPixels = wantedSize.width * wantedSize.height;
        for (let i = 0; i < nbPixels; i++) {
            const adjustedValue = computeAdjustedValue(canvasData[4 * i + 0], canvasData[4 * i + 1], canvasData[4 * i + 2]);
            canvasData[4 * i + 0] = adjustedValue;
            canvasData[4 * i + 1] = adjustedValue;
            canvasData[4 * i + 2] = adjustedValue;
        }
        this.hiddenCanvasContext.putImageData(imageData, 0, 0);

        Statistics.stopTimer("thread-computer.resetHiddenCanvas");
    }

    private computeTransformation(targetSize: ISize): Transformation {
        return new Transformation(targetSize, this.hiddenCanvas);
    }

    private drawSegmentOnHiddenCanvas(peg1: IPeg, peg2: IPeg): void {
        Statistics.startTimer("thread-computer.drawSegmentOnHiddenCanvas", true);

        this.hiddenCanvasContext.beginPath();
        this.hiddenCanvasContext.moveTo(peg1.x, peg1.y);
        this.hiddenCanvasContext.lineTo(peg2.x, peg2.y);
        this.hiddenCanvasContext.stroke();
        this.hiddenCanvasContext.closePath();

        // invalidate CPU data
        this.hiddenCanvasData = null;
        Statistics.stopTimer("thread-computer.drawSegmentOnHiddenCanvas");
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

    private computeBestNextPeg(currentPeg: IPeg): IPeg {
        let candidates: IPeg[] = [];
        let bestScore = MIN_SAFE_NUMBER;

        for (const peg of this.pegs) {
            if (!this.arePegsTooClose(currentPeg, peg)) {
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
        Statistics.startTimer("thread-computer.computeSegmentPotential.uploadCanvasDataToCPU", true);
        if (this.hiddenCanvasData === null) {
            const width = this.hiddenCanvas.width;
            const height = this.hiddenCanvas.height;
            this.hiddenCanvasData = this.hiddenCanvasContext.getImageData(0, 0, width, height);
        }
        Statistics.stopTimer("thread-computer.computeSegmentPotential.uploadCanvasDataToCPU");
    }

    /* The higher the result, the better a choice the thread is. */
    private computeSegmentPotential(peg1: IPeg, peg2: IPeg): number {
        Statistics.startTimer("thread-computer.computeSegmentPotential", true);
        this.uploadCanvasDataToCPU();

        let squaredError = 0;

        const segmentLength = distance(peg1, peg2);
        const nbSamples = Math.ceil(segmentLength);
        for (let iSample = 0; iSample < nbSamples; iSample++) {
            const r = (iSample + 1) / (nbSamples + 1);
            const sample: IPoint = {
                x: mix(peg1.x, peg2.x, r),
                y: mix(peg1.y, peg2.y, r),
            };

            const imageValue = this.sampleCanvasData(sample);
            const finalValue = imageValue + (0.5 * this.lineOpacity * 255);
            const contribution = 127 - finalValue;
            squaredError += contribution;
        }
        Statistics.stopTimer("thread-computer.computeSegmentPotential");
        return squaredError / nbSamples;
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

    // no interpolation
    private sampleCanvasPixel(pixelX: number, pixelY: number): number {
        const index = 4 * (pixelX + pixelY * this.hiddenCanvasData.width);
        return this.hiddenCanvasData.data[index]; // only check the red channel because the hidden canvas is in black and white
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
        Statistics.startTimer("thread-computer.computePegs", true);

        const domainSize: ISize = this.hiddenCanvas;
        const pegs: IPeg[] = [];

        if (this.pegsShape === EShape.RECTANGLE) {
            this.arePegsTooClose = (peg1: IPeg, peg2: IPeg) => {
                return peg1.x === peg2.x || peg1.y === peg2.y;
            };

            const maxX = domainSize.width;
            const maxY = domainSize.height;
            // corners
            pegs.push({ x: 0, y: 0 });
            pegs.push({ x: maxX, y: 0 });
            pegs.push({ x: maxX, y: maxY });
            pegs.push({ x: 0, y: maxY });

            // sides
            const nbPegsPerWidth = Math.ceil(domainSize.width / this.pegsSpacing);
            for (let iW = 1; iW < nbPegsPerWidth; iW++) {
                const x = maxX * (iW / nbPegsPerWidth);
                pegs.push({ x, y: 0 });
                pegs.push({ x, y: maxY });
            }

            const nbPegsPerHeight = Math.ceil(domainSize.height / this.pegsSpacing);
            for (let iH = 1; iH < nbPegsPerHeight; iH++) {
                const y = maxY * (iH / nbPegsPerHeight);
                pegs.push({ x: 0, y });
                pegs.push({ x: maxX, y });
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
            const nbPegs = Math.ceil(0.5 * TWO_PI * maxSize / this.pegsSpacing);
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

        Statistics.stopTimer("thread-computer.computePegs");
        return pegs;
    }
}

export { ThreadComputer };
