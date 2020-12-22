import { IPoint } from "./interfaces/i-point";
import { ISize } from "./interfaces/i-size";
import { EShape } from "./parameters";
import { PlotterBase } from "./plotter/plotter-base";
import { Transformation } from "./transformation";

const MAX_SAFE_NUMBER = 9007199254740991;
const MAX_SIZE = 256; // pixels
const TWO_PI = 2 * Math.PI;
const LINE_OPACITY = 0.512 / 8;
const NB_PEGS = 256;

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

interface IThread {
    peg1: IPoint;
    peg2: IPoint;
}

/**
 * Class used to compute which thread is the best choice.
 */
class ThreadComputer {
    // private readonly sourceImage: HTMLImageElement;

    private readonly hiddenCanvas: HTMLCanvasElement;
    private readonly hiddenCanvasContext: CanvasRenderingContext2D;
    private hiddenCanvasData: Uint8ClampedArray = null;

    private readonly pegs: IPoint[];
    private readonly threadPegs: IPoint[] = [];

    public constructor(image: HTMLImageElement, pegsShape: EShape) {
        // this.sourceImage = image;

        this.hiddenCanvas = document.createElement("canvas");
        this.hiddenCanvasContext = this.hiddenCanvas.getContext("2d");

        const hiddenCanvasSize = ThreadComputer.computeBestSize(image, MAX_SIZE);
        this.hiddenCanvas.width = hiddenCanvasSize.width;
        this.hiddenCanvas.height = hiddenCanvasSize.height;
        this.hiddenCanvasContext.drawImage(image, 0, 0, hiddenCanvasSize.width, hiddenCanvasSize.height);

        this.pegs = ThreadComputer.computePegs(hiddenCanvasSize, NB_PEGS, pegsShape);
    }

    public draw(targetContext: CanvasRenderingContext2D): void {
        const transformation = this.computeTransformation(targetContext.canvas);
        targetContext.drawImage(this.hiddenCanvas, transformation.origin.x, transformation.origin.y, transformation.scaling * this.hiddenCanvas.width, transformation.scaling * this.hiddenCanvas.height);
    }

    public drawThreads(plotter: PlotterBase): void {
        const transformation = this.computeTransformation(plotter.size);
        const lineWidth = 1 * transformation.scaling;

        const points: IPoint[] = [];
        for (const peg of this.threadPegs) {
            points.push(transformation.transform(peg));
        }
        plotter.drawBrokenLine(points, `rgba(0,0,0, ${LINE_OPACITY})`, lineWidth);
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

    public computeNextThreads(nbThreads: number): void {
        for (let iThread = 0; iThread < nbThreads; iThread++) {
            let lastPeg: IPoint;
            let nextPeg: IPoint;

            if (this.threadPegs.length === 0) {
                const startingThread = this.computeBestStartingThread();
                this.threadPegs.push(startingThread.peg1);
                lastPeg = startingThread.peg1;
                nextPeg = startingThread.peg2;
            } else {
                lastPeg = this.threadPegs[this.threadPegs.length - 1];
                nextPeg = this.computeBestNextPeg(lastPeg);
                this.threadPegs.push(nextPeg);
            }

            this.drawThread(lastPeg, nextPeg);
        }
    }

    private computeTransformation(targetSize: ISize): Transformation {
        return new Transformation(targetSize, this.hiddenCanvas);
    }

    private drawThread(peg1: IPoint, peg2: IPoint): void {
        this.hiddenCanvasContext.strokeStyle = `rgba(255,255,255, ${LINE_OPACITY})`;
        this.hiddenCanvasContext.lineWidth = 1;

        this.hiddenCanvasContext.beginPath();
        this.hiddenCanvasContext.moveTo(peg1.x, peg1.y);
        this.hiddenCanvasContext.lineTo(peg2.x, peg2.y);
        this.hiddenCanvasContext.stroke();
        this.hiddenCanvasContext.closePath();

        // invalidate CPU data
        this.hiddenCanvasData = null;
    }

    private computeBestStartingThread(): IThread {
        let candidates: IThread[] = [];
        let bestScore = MAX_SAFE_NUMBER;

        for (let iPegId1 = 0; iPegId1 < this.pegs.length; iPegId1++) {
            for (let iPegId2 = iPegId1 + 1; iPegId2 < this.pegs.length; iPegId2++) {
                const candidateScore = this.computeThreadPotential(this.pegs[iPegId1], this.pegs[iPegId2]);
                if (candidateScore < bestScore) {
                    bestScore = candidateScore;
                    candidates = [{
                        peg1: this.pegs[iPegId1],
                        peg2: this.pegs[iPegId2],
                    }];
                } else if (candidateScore === bestScore) {
                    candidates.push({
                        peg1: this.pegs[iPegId1],
                        peg2: this.pegs[iPegId2],
                    });
                }
            }
        }

        // if several equally good candidates, choose randomly
        const random = Math.floor(candidates.length * Math.random());
        return candidates[random];
    }

    private computeBestNextPeg(currentPeg: IPoint): IPoint {
        let candidates: IPoint[] = [];
        let bestScore = MAX_SAFE_NUMBER;

        for (const peg of this.pegs) {
            if (peg !== currentPeg) {
                const candidateScore = this.computeThreadPotential(currentPeg, peg);
                if (candidateScore < bestScore) {
                    bestScore = candidateScore;
                    candidates = [peg];
                } else if (candidateScore < bestScore) {
                    candidates.push(peg);
                }
            }
        }

        // if several equally good candidates, choose randomly
        const random = Math.floor(candidates.length * Math.random());
        return candidates[random];
    }

    private uploadCanvasDataToCPU(): void {
        if (this.hiddenCanvasData === null) {
            const width = this.hiddenCanvas.width;
            const height = this.hiddenCanvas.height;
            this.hiddenCanvasData = this.hiddenCanvasContext.getImageData(0, 0, width, height).data;
        }
    }

    /* The lower the result, the better a choice the thread is. */
    private computeThreadPotential(peg1: IPoint, peg2: IPoint): number {
        this.uploadCanvasDataToCPU();

        let squaredError = 0;

        const dX = peg2.x - peg1.x;
        const dY = peg2.y - peg1.y;
        const distance = Math.sqrt(dX * dX + dY * dY);
        const nbSamples = Math.ceil(distance);
        for (let iSample = 0; iSample < nbSamples; iSample++) {
            const r = (iSample + 1) / (nbSamples + 1);
            const sample: IPoint = {
                x: peg1.x + dX * r,
                y: peg1.y + dY * r,
            };

            const imageValue = this.sampleCanvasData(sample);
            const finalValue = imageValue + (LINE_OPACITY * 255);
            squaredError += finalValue;// * finalValue;
        }
        return squaredError / nbSamples;
    }

    /** Linear interpolation. Returns a result in [0, 255] */
    private sampleCanvasData(coords: IPoint): number {
        const width = this.hiddenCanvas.width;
        const height = this.hiddenCanvas.height;

        const minX = clamp(Math.floor(coords.x), 0, width - 1);
        const maxX = clamp(Math.ceil(coords.x), 0, width - 1);
        const minY = clamp(Math.floor(coords.y), 0, height - 1);
        const maxY = clamp(Math.ceil(coords.y), 0, height - 1);

        const topLeft = this.hiddenCanvasData[4 * (minX + minY * width)];
        const topRight = this.hiddenCanvasData[4 * (maxX + minY * width)];
        const bottomLeft = this.hiddenCanvasData[4 * (minX + maxY * width)];
        const bottomRight = this.hiddenCanvasData[4 * (maxX + maxY * width)];

        const fractX = coords.x % 1;
        const top = mix(topLeft, topRight, fractX);
        const bottom = mix(bottomLeft, bottomRight, fractX);

        const fractY = coords.y % 1;
        return mix(top, bottom, fractY);
    }

    private static computeBestSize(sourceImageSize: ISize, maxSize: number): ISize {
        const maxSourceSide = Math.max(sourceImageSize.width, sourceImageSize.height);
        if (maxSourceSide <= MAX_SIZE) {
            return sourceImageSize;
        }

        const downsizingFactor = maxSize / maxSourceSide;
        return {
            width: Math.ceil(sourceImageSize.width * downsizingFactor),
            height: Math.ceil(sourceImageSize.height * downsizingFactor),
        };
    }

    private static computePegs(domainSize: ISize, nbPegs: number, pegsShape: EShape): IPoint[] {
        const pegs: IPoint[] = [];

        if (pegsShape === EShape.RECTANGLE) {

        } else {
            for (let iPeg = 0; iPeg < nbPegs; iPeg++) {
                const angle = TWO_PI * iPeg / nbPegs;
                pegs.push({
                    x: 0.5 * domainSize.width * (1 + Math.cos(angle)),
                    y: 0.5 * domainSize.height * (1 + Math.sin(angle)),
                });
            }
        }

        return pegs;
    }
}

export { ThreadComputer };
