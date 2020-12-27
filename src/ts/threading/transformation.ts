import { IPoint } from "../interfaces/i-point";
import { ISize } from "../interfaces/i-size";

class Transformation {
    public readonly scaling: number;
    public readonly origin: IPoint;

    public constructor(frameSize: ISize, elementSize: ISize) {
        const scaleToFitWidth = frameSize.width / elementSize.width;
        const scaleToFitHeight = frameSize.height / elementSize.height;

        this.scaling = Math.min(scaleToFitWidth, scaleToFitHeight);
        this.origin = {
            x: 0.5 * (frameSize.width - this.scaling * elementSize.width),
            y: 0.5 * (frameSize.height - this.scaling * elementSize.height)
        };
    }

    public transform(point: IPoint): IPoint {
        return {
            x: this.origin.x + point.x * this.scaling,
            y: this.origin.y + point.y * this.scaling,
        };
    }
}

export { Transformation };
