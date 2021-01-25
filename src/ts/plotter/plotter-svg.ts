import { ILine } from "../interfaces/i-line";
import { IPoint } from "../interfaces/i-point";
import { ECompositingOperation, useAdvancedCompositing } from "./compositing";
import { PlotterBase, IPlotterInfo, ISize } from "./plotter-base";

const WIDTH = 1000;
const HEIGHT = 1000;

const BLUR_EFFECT_ID = "gaussianBlur";

class PlotterSVG extends PlotterBase {
    private stringParts: string[];
    private hasBlur: boolean;

    public constructor() {
        super();
    }

    // tslint:disable-next-line:no-empty
    public resize(): void {
    }

    public initialize(infos: IPlotterInfo): void {
        this.hasBlur = infos.blur > 0;

        this.stringParts = [];

        this.stringParts.push(`<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n`);
        this.stringParts.push(`<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 ${WIDTH} ${HEIGHT}">\n`);

        if (this.hasBlur) {
            this.stringParts.push(`\t<defs>\n`);
            this.stringParts.push(`\t\t<filter id="${BLUR_EFFECT_ID}" x="0" y="0">\n`);
            this.stringParts.push(`\t\t\t<feGaussianBlur in="SourceGraphic" stdDeviation="${infos.blur}"/>\n`);
            this.stringParts.push(`\t\t</filter>\n`);
            this.stringParts.push(`\t</defs>\n`);
        }
    }

    public finalize(): void {
        this.stringParts.push(`</svg>\n`);
    }

    public drawLines(lines: ILine[], opacity: number, operation: ECompositingOperation, thickness: number): void {
        if (lines.length >= 1) {
            const blurAttribute = this.hasBlur ? ` filter="url(#${BLUR_EFFECT_ID})"` : ``;

            if (this.hasBlur) {
                this.stringParts.push(`\t<g${blurAttribute}>\n`);
            }

            const margin = 10;
            this.stringParts.push(`\t\t<rect fill="white" stroke="none" x="${-margin}" y="${-margin}" width="${WIDTH + 2 * margin}" height="${HEIGHT + 2 * margin}"/>\n`);

            let strokeColor: string;
            if (useAdvancedCompositing()) {
                this.stringParts.push(`\t\t<defs>\n`);
                this.stringParts.push(`\t\t\t<style type="text/css">\n`);
                this.stringParts.push(`\t\t\t\t<![CDATA[\n`);
                this.stringParts.push(`\t\t\t\t\tline { mix-blend-mode: difference; }\n`);
                if (operation === ECompositingOperation.LIGHTEN) {
                    this.stringParts.push(`\t\t\t\t\tsvg { filter: invert(1); background: black; }\n`);
                }
                this.stringParts.push(`\t\t\t\t]]>\n`);
                this.stringParts.push(`\t\t\t</style>\n`);
                this.stringParts.push(`\t\t</defs>\n`);

                const value = Math.ceil(255 * opacity);
                strokeColor = `rgb(${value}, ${value}, ${value})`;
            } else {
                const value = (operation === ECompositingOperation.LIGHTEN) ? 255 : 0;
                strokeColor = `rgba(${value}, ${value}, ${value}, ${opacity})`;
            }

            // lines container
            this.stringParts.push(`\t\t<g stroke="${strokeColor}" stroke-width="${thickness}" stroke-linecap="round" fill="none">\n`);
            for (const line of lines) {
                this.stringParts.push(`\t\t\t<line x1="${line.from.x.toFixed(1)}" y1="${line.from.y.toFixed(1)}" x2="${line.to.x.toFixed(1)}" y2="${line.to.y.toFixed(1)}"/>\n`);
            }
            this.stringParts.push(`\t\t</g>\n`);

            if (this.hasBlur) {
                this.stringParts.push(`\t</g>\n`);
            }
        }
    }

    public drawPoints(points: IPoint[], color: string, diameter: number): void {
        if (points.length > 0) {
            this.stringParts.push(`\t\t<g fill="${color}" stroke="none">\n`);

            for (const point of points) {
                this.stringParts.push(`\t\t\t<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${0.5 * diameter}"/>\n`);
            }
            this.stringParts.push(`\t\t</g>\n`);
        }
    }

    public export(): string {
        const start = Date.now();
        const result = this.stringParts.join("");
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
