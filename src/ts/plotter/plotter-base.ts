import { ILine } from "../interfaces/i-line";
import { IPoint } from "../interfaces/i-point";
import { ISize } from "../interfaces/i-size";
import { EColor, ECompositingOperation } from "./compositing";

interface IPlotterInfo {
    backgroundColor: string;
    blur: number;
}

interface IImageFitting {
    sizeInPlotter: ISize;
    imageRelativeToCanvasPixel: (relativeCoords: IPoint) => IPoint;
};

abstract class PlotterBase {
    public abstract resize(): void;
    public abstract initialize(infos: IPlotterInfo): void;
    public abstract finalize(): void;

    public abstract drawLines(lines: ILine[], color: EColor, opacity: number, operation: ECompositingOperation, thickness: number): void;
    public abstract drawPoints(points: IPoint[], color: string, diameter: number): void;

    public abstract get size(): ISize;

    public drawBrokenLine(points: IPoint[], color: EColor, opacity: number, operation: ECompositingOperation, thickness: number): void {
        const lines: ILine[] = [];

        for (let i = 0; i < points.length - 1; i++) {
            lines.push({ from: points[i], to: points[i + 1] });
        }
        this.drawLines(lines, color, opacity, operation, thickness);
    }
}

export { PlotterBase, IImageFitting, IPlotterInfo, ISize }
