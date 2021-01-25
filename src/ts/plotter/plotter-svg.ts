import { ILine } from "../interfaces/i-line";
import { IPoint } from "../interfaces/i-point";
import { computeRawColor, EColor, ECompositingOperation, useAdvancedCompositing } from "./compositing";
import { PlotterBase, IPlotterInfo, ISize } from "./plotter-base";
import { XMLWriter } from "./xml-writer";

const WIDTH = 1000;
const HEIGHT = 1000;

const BLUR_EFFECT_ID = "gaussianBlur";

class PlotterSVG extends PlotterBase {
    private hasBlur: boolean;
    private writer: XMLWriter;

    public constructor() {
        super();
    }

    // tslint:disable-next-line:no-empty
    public resize(): void {
    }

    public initialize(infos: IPlotterInfo): void {
        this.writer = new XMLWriter();

        this.hasBlur = infos.blur > 0;

        this.writer.addLine(`<?xml version="1.0" encoding="UTF-8" standalone="no"?>`);
        this.writer.startBlock(`<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 ${WIDTH} ${HEIGHT}">`);

        if (this.hasBlur) {
            this.writer.startBlock(`<defs>`);
            this.writer.startBlock(`<filter id="${BLUR_EFFECT_ID}" x="0" y="0">`);
            this.writer.addLine(`<feGaussianBlur in="SourceGraphic" stdDeviation="${infos.blur}"/>`);
            this.writer.endBlock(`</filter>`);
            this.writer.endBlock(`</defs>`);

            this.writer.startBlock(`<g filter="url(#${BLUR_EFFECT_ID})">`);

        }

        const margin = 10;
        this.writer.addLine(`<rect fill="white" stroke="none" x="${-margin}" y="${-margin}" width="${WIDTH + 2 * margin}" height="${HEIGHT + 2 * margin}"/>`);
    }

    public finalize(): void {
        if (this.hasBlur) {
            this.writer.endBlock(`</g>`);
        }
        this.writer.endBlock(`</svg>`);
    }

    public drawLines(lines: ILine[], color: EColor, opacity: number, operation: ECompositingOperation, thickness: number): void {
        if (lines.length >= 1) {

            let strokeColor: string;
            if (useAdvancedCompositing()) {
                this.writer.startBlock(`<defs>`);
                this.writer.startBlock(`<style type="text/css">`);
                this.writer.startBlock(`<![CDATA[`);
                this.writer.addLine(`line { mix-blend-mode: difference; }`);
                if (operation === ECompositingOperation.LIGHTEN) {
                    this.writer.addLine(`svg { filter: invert(1); background: black; }`);
                }
                this.writer.endBlock(`]]>`);
                this.writer.endBlock(`</style>`);
                this.writer.endBlock(`</defs>`);

                const value = Math.ceil(255 * opacity);
                const rawRGB = computeRawColor(color);
                strokeColor = `rgb(${rawRGB.r * value}, ${rawRGB.g * value}, ${rawRGB.b * value})`;
            } else {
                const value = (useAdvancedCompositing()) ? 255 : 0;
                const rawRGB = computeRawColor(color);
                strokeColor = `rgba(${rawRGB.r * value}, ${rawRGB.g * value}, ${rawRGB.b * value}, ${opacity})`;
            }

            // lines container
            this.writer.startBlock(`<g stroke="${strokeColor}" stroke-width="${thickness}" stroke-linecap="round" fill="none">`);
            for (const line of lines) {
                this.writer.addLine(`<line x1="${line.from.x.toFixed(1)}" y1="${line.from.y.toFixed(1)}" x2="${line.to.x.toFixed(1)}" y2="${line.to.y.toFixed(1)}"/>`);
            }
            this.writer.endBlock(`</g>`);
        }
    }

    public drawPoints(points: IPoint[], color: string, diameter: number): void {
        if (points.length > 0) {
            this.writer.startBlock(`<g fill="${color}" stroke="none">`);
            for (const point of points) {
                this.writer.addLine(`<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${0.5 * diameter}"/>`);
            }
            this.writer.endBlock(`</g>`);
        }
    }

    public export(): string {
        const start = Date.now();
        const result = this.writer.result;
        console.log(`Concatenation took ${Date.now() - start} ms.`);
        return result;
    }

    public get size(): ISize {
        return {
            width: WIDTH,
            height: HEIGHT,
        };
    }
}

export { PlotterSVG }
