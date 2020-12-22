import { IPoint } from "./interfaces/i-point";
import { ISize } from "./interfaces/i-size";

class InputImage {
    private _size: ISize;

    private readonly hiddenCanvas: HTMLCanvasElement;
    private readonly hiddenContext: CanvasRenderingContext2D;
    public readonly sourceImage: HTMLImageElement;
    private valueArray: Uint8ClampedArray;

    public constructor(image: HTMLImageElement) {
        this.hiddenCanvas = document.createElement("canvas");
        this.hiddenContext = this.hiddenCanvas.getContext("2d");
        this.sourceImage = image;
        this._size = {
            width: 0,
            height: 0,
        };

        this.resize({ width: image.width, height: image.height });
    }

    public get size(): ISize {
        return this._size;
    }

    public get width(): number {
        return this._size.width;
    }

    public get height(): number {
        return this._size.height;
    }

    public get sourceImageAspectRatio(): number {
        return this.sourceImage.width / this.sourceImage.height;
    }

    public resize(wantedSize: ISize): void {
        // the canvas handles image downsizing, however upsizing is handled manually in the sample method.
        const wantedWidth = Math.min(this.sourceImage.width, wantedSize.width);
        const wantedHeight = Math.min(this.sourceImage.height, wantedSize.height);

        if (this.width !== wantedWidth || this.height !== wantedHeight) {
            console.log(`Resize image from ${this.width}x${this.height} to ${wantedWidth}x${wantedHeight}.`);

            this._size.width = wantedWidth;
            this._size.height = wantedHeight;

            this.hiddenCanvas.width = this.width;
            this.hiddenCanvas.height = this.height;
            this.hiddenContext.drawImage(this.sourceImage, 0, 0, this.width, this.height);

            // retrieve all pixels at once because it is way faster that 1 by 1
            const fullPixelsArray = this.hiddenContext.getImageData(0, 0, this.width, this.height).data;
            this.valueArray = new Uint8ClampedArray(this.width * this.height);

            for (let i = 0; i < this.valueArray.length; i++) {
                const r = fullPixelsArray[4 * i];
                const g = fullPixelsArray[4 * i + 1];
                const b = fullPixelsArray[4 * i + 2];
                this.valueArray[i] = (r + g + b) / 3;
            }
        }
    }

    /**
     * @param from in [0,1]^2
     * @param to  in [0,1]^2
     */
    public averageValue(from: IPoint, to: IPoint): number {
        const dX = (to.x - from.x) * this._size.width;
        const dY = (to.y - from.y) * this._size.height;

        const lineLengthInPixels = Math.sqrt(dX * dX + dY * dY);
        const nbSamples = Math.max(1, Math.ceil(lineLengthInPixels));

        let cumulatedValue = 0;
        for (let iSample = 0; iSample < nbSamples; iSample++) {
            const relative = (1 + iSample) / (1 + nbSamples);
            const samplePoint: IPoint = {
                x: this.interpolate(from.x, to.x, relative),
                y: this.interpolate(from.y, to.y, relative),
            };
            cumulatedValue += this.sample(samplePoint);
        }

        return cumulatedValue / (nbSamples + 1);
    }

    /** Returns a value in [0, 1]. Performs linear interpolation. */
    private sample(normalizedCoords: IPoint): number {
        const pixelCoords: IPoint = {
            x: normalizedCoords.x * (this._size.width - 1),
            y: normalizedCoords.y * (this._size.height - 1),
        }

        const floorPixelCoords: IPoint = {
            x: Math.floor(pixelCoords.x),
            y: Math.floor(pixelCoords.y),
        };
        const fractPixelCoords: IPoint = {
            x: pixelCoords.x - floorPixelCoords.x,
            y: pixelCoords.y - floorPixelCoords.y,
        };

        const topLeft = this.getPixel(floorPixelCoords.x, floorPixelCoords.y);
        const topRight = this.getPixel(floorPixelCoords.x + 1, floorPixelCoords.y);
        const bottomLeft = this.getPixel(floorPixelCoords.x, floorPixelCoords.y + 1);
        const bottomRight = this.getPixel(floorPixelCoords.x + 1, floorPixelCoords.y + 1);

        const top = this.interpolate(topLeft, topRight, fractPixelCoords.x);
        const bottom = this.interpolate(bottomLeft, bottomRight, fractPixelCoords.x);

        const interpolated = this.interpolate(top, bottom, fractPixelCoords.y);

        return interpolated / 255;
    }

    private interpolate(a: number, b: number, x: number): number {
        return a * (1 - x) + b * x;
    }

    /** Returns a value in [0, 255]. No interpolation.
     * @param x in pixels, must be an integer
     * @param y in pixels, must be an integer
     */
    private getPixel(x: number, y: number): number {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
            return 0;
        }

        return this.valueArray[y * this.width + x];
    }
}

export { InputImage }
