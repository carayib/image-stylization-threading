import * as Helpers from "./helpers";

import { Parameters } from "./parameters";

import { PlotterBase } from "./plotter/plotter-base";
import { PlotterCanvas2D } from "./plotter/plotter-canvas-2d";
import { PlotterSVG } from "./plotter/plotter-svg";

import { ThreadComputer } from "./thread-computer";

import "./page-interface-generated";

function plot(threadComputer: ThreadComputer, plotter: PlotterBase): void {
    plotter.resize();
    plotter.initialize({ backgroundColor: "white", blur: 0 });

    if (Parameters.displayPegs) {
        threadComputer.drawPegs(plotter);
    }
    threadComputer.drawThreads(plotter);

    plotter.finalize();
}

function main(): void {
    const canvasPlotter = new PlotterCanvas2D();
    let threadComputer: ThreadComputer = null;
    let needToRedraw = true;
    let needToReset = true;

    Parameters.addRedrawObserver(() => needToRedraw = true);
    Parameters.addResetObserver(() => needToReset = true);

    function mainLoop(): void {
        if (threadComputer !== null) {
            if (needToReset) {
                threadComputer.reset();
                needToReset = false;
                needToRedraw = true;
            }

            const computedEverything = threadComputer.computeNextThreads(20);
            needToRedraw = needToRedraw || computedEverything;

            if (needToRedraw) {
                plot(threadComputer, canvasPlotter);
                needToRedraw = !computedEverything;

                Page.Canvas.setIndicatorText("pegs-count", threadComputer.nbPegs.toString());
                Page.Canvas.setIndicatorText("segments-count", threadComputer.nbSegments.toString());
                Page.Canvas.setIndicatorText("thread-length", threadComputer.threadLength(canvasPlotter).toFixed(0) + " pixels");
            }

            if (Parameters.debug) {
                threadComputer.drawDebugView(canvasPlotter.context);
            }
        }

        requestAnimationFrame(mainLoop);
    }
    requestAnimationFrame(mainLoop);

    function updateBlur(blur: number): void {
        canvasPlotter.blur = blur;
    }
    Parameters.addBlurChangeObserver(updateBlur);
    updateBlur(Parameters.blur);


    function onNewImage(image: HTMLImageElement): void {
        Page.Canvas.showLoader(false);
        threadComputer = new ThreadComputer(image, Parameters.shape, Parameters.pegsSpacing);
        needToReset = true;
    }
    Parameters.addFileUploadObserver(onNewImage);

    Page.Canvas.showLoader(true);
    const defaultImage = new Image();
    defaultImage.addEventListener("load", () => {
        onNewImage(defaultImage);
    });
    defaultImage.src = "./resources/cat.jpg";

    Parameters.addDownloadObserver(() => {
        const svgPlotter = new PlotterSVG();
        plot(threadComputer, svgPlotter);
        const svgString = svgPlotter.export();
        const filename = "image-as-threading.svg";
        Helpers.downloadTextFile(svgString, filename);
    });
}

main();
