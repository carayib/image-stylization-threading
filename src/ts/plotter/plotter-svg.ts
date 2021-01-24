import { ILine } from "../interfaces/i-line";
import { IPoint } from "../interfaces/i-point";
import { PlotterBase, IPlotterInfo, ISize } from "./plotter-base";

const WIDTH = 1000;
const HEIGHT = 1000;

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
            const blurEffectId = "gaussianBlur";

            this.stringParts.push(`\t<defs>\n`);
            this.stringParts.push(`\t\t<filter id="${blurEffectId}" x="0" y="0">\n`);
            this.stringParts.push(`\t\t\t<feGaussianBlur in="SourceGraphic" stdDeviation="${infos.blur}"/>\n`);
            this.stringParts.push(`\t\t</filter>\n`);
            this.stringParts.push(`\t</defs>\n`);
            this.stringParts.push(`\t<g filter="url(#${blurEffectId})">\n`);
        }

        this.stringParts.push(`\t<rect fill="${infos.backgroundColor}" stroke="none" x="0" y="0" width="${WIDTH}" height="${HEIGHT}"/>\n`);
        this.stringParts.push(`\t<g fill="none" stroke-linecap="round">\n`);
    }

    public finalize(): void {
        if (this.hasBlur) {
            this.stringParts.push(`\t\t</g>\n`);
        }

        this.stringParts.push(`\t</g>\n`);
        this.stringParts.push(`</svg>\n`);
    }

    public drawLines(lines: ILine[], color: string, thickness: number): void {
        if (lines.length >= 1) {
            this.stringParts.push(`\t\t<g stroke="${color}" stroke-width="${thickness}" fill="none">\n`);

            for (const line of lines) {
                this.stringParts.push(`\t\t\t<line x1="${line.from.x.toFixed(1)}" y1="${line.from.y.toFixed(1)}" x2="${line.to.x.toFixed(1)}" y2="${line.to.y.toFixed(1)}"/>\n`);
            }

            this.stringParts.push(`\t\t</g>\n`);
        }
    }

    // public drawBrokenLine(points: IPoint[], color: string, thickness: number): void {
    //     if (points.length >= 2) {
    //         this.stringParts.push(`\t\t<polyline stroke="${color}" stroke-width="${thickness}" fill="none" points="`);

    //         for (const point of points) {
    //             this.stringParts.push(`${point.x.toFixed(1)},${point.y.toFixed(1)} `);
    //         }

    //         this.stringParts.push(`"/>\n`);
    //     }
    // }

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
