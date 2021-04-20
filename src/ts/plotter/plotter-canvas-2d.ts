import { ILine } from "../interfaces/i-line";
import { IPoint } from "../interfaces/i-point";
import { ISize } from "../interfaces/i-size";
import { applyCanvasCompositing, EColor, ECompositingOperation, resetCanvasCompositing } from "./compositing";
import { IPlotterInfo, PlotterBase } from "./plotter-base";

import "../page-interface-generated";

class PlotterCanvas2D extends PlotterBase {
    private readonly canvas: HTMLCanvasElement;
    public readonly context: CanvasRenderingContext2D;
    private readonly cssPixel: number;

    public constructor() {
        super();

        this.canvas = Page.Canvas.getCanvas();
        this.context = this.canvas.getContext("2d", { alpha: false });
        this.cssPixel = window.devicePixelRatio ?? 1;
    }

    public resize(): void {
        const actualWidth = Math.floor(this.cssPixel * this.canvas.clientWidth);
        const actualHeight = Math.floor(this.cssPixel * this.canvas.clientHeight);

        if (this.canvas.width !== actualWidth || this.canvas.height !== actualHeight) {
            this.canvas.width = actualWidth;
            this.canvas.height = actualHeight;
        }
    }

    public initialize(infos: IPlotterInfo): void {
        this.context.fillStyle = infos.backgroundColor;
        this.context.lineJoin = "round";
        resetCanvasCompositing(this.context);
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // tslint:disable-next-line:no-empty
    public finalize(): void { }

    public set blur(value: number) {
        if (value === 0) {
            this.canvas.style.filter = "";
        } else {
            this.canvas.style.filter = `blur(${value}px)`; // simple blur supported everywhere but with artifacts on the edges
            // artifact-free blur, but not supported everywhere
            this.canvas.style.filter = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='a' x='0' y='0' width='1' height='1'%3E%3CfeGaussianBlur stdDeviation='${value}' result='b'/%3E%3CfeMorphology operator='dilate' radius='${value}'/%3E %3CfeMerge%3E%3CfeMergeNode/%3E%3CfeMergeNode in='b'/%3E%3C/feMerge%3E%3C/filter%3E%3C/svg%3E#a")`;
        }
    }

    public drawLines(lines: ILine[], color: EColor, opacity: number, operation: ECompositingOperation, thickness: number): void {
        if (lines.length >= 1) {
            applyCanvasCompositing(this.context, color, opacity, operation);

            this.context.lineWidth = thickness * this.cssPixel;

            for (const line of lines) {
                this.context.beginPath();
                this.context.moveTo(line.from.x * this.cssPixel, line.from.y * this.cssPixel);
                this.context.lineTo(line.to.x * this.cssPixel, line.to.y * this.cssPixel);
                this.context.stroke();
                this.context.closePath();
            }

            resetCanvasCompositing(this.context);
        }
    }

    public drawPoints(points: IPoint[], color: string, diameter: number): void {
        if (points.length > 0) {
            this.context.fillStyle = color;
            this.context.strokeStyle = "none";

            for (const point of points) {
                this.context.beginPath();
                this.context.arc(point.x * this.cssPixel, point.y * this.cssPixel, 0.5 * diameter * this.cssPixel, 0, 2 * Math.PI);
                this.context.fill();
                this.context.closePath();
            }
        }
    }

    public get size(): ISize {
        return {
            width: Math.floor(this.canvas.width / this.cssPixel),
            height: Math.floor(this.canvas.height / this.cssPixel),
        };
    }
}

export { PlotterCanvas2D };

