import * as Helpers from "./helpers";

import { Parameters } from "./parameters";

import { PlotterCanvas2D } from "./plotter/plotter-canvas-2d";
import { PlotterSVG } from "./plotter/plotter-svg";

import { ThreadComputer } from "./threading/thread-computer";
import { ThreadPlotter } from "./threading/thread-plotter";

import "./page-interface-generated";

function main(): void {
    const MAX_COMPUTING_TIME_PER_FRAME = 20; // ms
    const canvasPlotter = new PlotterCanvas2D();
    let threadPlotter: ThreadPlotter = null;
    let threadComputer: ThreadComputer = null;
    let needToReset = true;

    Parameters.addRedrawObserver(() => { threadPlotter?.reset(); });
    Parameters.addResetObserver(() => { needToReset = true; });

    function mainLoop(): void {
        if (needToReset) {
            threadComputer.reset(Parameters.linesOpacity, Parameters.linesThickness);
            threadPlotter.reset()
            needToReset = false;
        }

        const computedSomething = threadComputer.computeNextSegments(MAX_COMPUTING_TIME_PER_FRAME);

        if (computedSomething && Parameters.showIndicators) {
            threadComputer.updateIndicators(Page.Canvas.setIndicatorText);
        }

        threadPlotter.plot();

        if (Parameters.debug) {
            threadComputer.drawDebugView(canvasPlotter.context);
        }

        requestAnimationFrame(mainLoop);
    }

    function updateBlur(blur: number): void {
        canvasPlotter.blur = blur;
    }
    Parameters.addBlurChangeObserver(updateBlur);
    updateBlur(Parameters.blur);

    function onNewImage(image: HTMLImageElement): void {
        Page.Canvas.showLoader(false);
        threadComputer = new ThreadComputer(image);
        threadPlotter = new ThreadPlotter(canvasPlotter, threadComputer);
        needToReset = true;
    }
    Parameters.addFileUploadObserver(onNewImage);

    Page.Canvas.showLoader(true);
    const defaultImage = new Image();
    defaultImage.addEventListener("load", () => {
        onNewImage(defaultImage);
        requestAnimationFrame(mainLoop);
    });
    defaultImage.src = "./resources/cat.jpg";

    Parameters.addDownloadObserver(() => {
        const svgPlotter = new PlotterSVG();
        const plotter = new ThreadPlotter(svgPlotter, threadComputer);
        plotter.plot();
        const svgString = svgPlotter.export();
        const filename = "image-as-threading.svg";
        Helpers.downloadTextFile(svgString, filename);
    });

    Parameters.addDownloadInstructionsObserver(() => {
        const text = threadComputer.instructions;
        const filename = "image-as-threading_instructions.txt";
        Helpers.downloadTextFile(text, filename);
    });
}

Helpers.declarePolyfills();
main();
