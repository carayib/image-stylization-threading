import { PlotterBase, IPlotterInfo } from "./plotter-base";
import { IPoint } from "../interfaces/i-point";
import { ISize } from "../interfaces/i-size";

import "../page-interface-generated";
import { ILine } from "../interfaces/i-line";

class PlotterCanvas2D extends PlotterBase {
    private readonly canvas: HTMLCanvasElement;
    private readonly context: CanvasRenderingContext2D;
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
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // tslint:disable-next-line:no-empty
    public finalize(): void { }

    public set blur(value: number) {
        if (value === 0) {
            this.canvas.style.filter = "";
        } else {
            this.canvas.style.filter = `blur(${value}px)`;
        }
    }

    public drawLines(lines: ILine[], color: string, thickness: number): void {
        if (lines.length >= 1) {
            this.context.strokeStyle = color;
            this.context.lineWidth = thickness;
            
            for (const line of lines) {
                this.context.beginPath();
                this.context.moveTo(line.from.x * this.cssPixel, line.from.y * this.cssPixel);
                this.context.lineTo(line.to.x * this.cssPixel, line.to.y * this.cssPixel);
                this.context.stroke();
                this.context.closePath();
            }
        }
    }

    // public drawBrokenLine(points: IPoint[], color: string, thickness: number): void {
    //     if (points.length >= 2) {
    //         this.context.strokeStyle = color;
    //         this.context.lineWidth = thickness;
    //         this.context.beginPath();

    //         this.context.moveTo(points[0].x * this.cssPixel, points[0].y * this.cssPixel);
    //         for (let iPoint = 1; iPoint < points.length; iPoint++) {
    //             this.context.lineTo(points[iPoint].x * this.cssPixel, points[iPoint].y * this.cssPixel);
    //         }

    //         this.context.stroke();
    //         this.context.closePath();
    //     }
    // }

    public drawPoints(points: IPoint[], color: string, diameter: number): void {
        if (points.length > 0) {
            this.context.fillStyle = color;
            this.context.strokeStyle = "none";

            for (const point of points) {
                this.context.beginPath();
                this.context.arc(point.x, point.y, 0.5 * diameter, 0, 2 * Math.PI);
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

export { PlotterCanvas2D }
