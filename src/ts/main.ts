import * as Helpers from "./helpers";

import { Parameters } from "./parameters";

import { IPlotterInfo, PlotterBase } from "./plotter/plotter-base";
import { PlotterCanvas2D } from "./plotter/plotter-canvas-2d";
import { PlotterSVG } from "./plotter/plotter-svg";

import { ThreadComputer } from "./threading/thread-computer";

import * as Statistics from "./statistics/statistics";

import "./page-interface-generated";

function plot(threadComputer: ThreadComputer, plotter: PlotterBase): void {
    Statistics.startTimer("main.plot");
    const plotterInfos: IPlotterInfo = {
        backgroundColor: Parameters.invertColors ? "black" : "white",
        blur: Parameters.blur,
    };

    plotter.resize();
    plotter.initialize(plotterInfos);

    threadComputer.drawThread(plotter);
    if (Parameters.displayPegs) {
        threadComputer.drawPegs(plotter);
    }

    plotter.finalize();
    Statistics.stopTimer("main.plot");
}

function main(): void {
    const canvasPlotter = new PlotterCanvas2D();
    let threadComputer: ThreadComputer = null;
    let needToRedraw = true;
    let needToReset = true;

    Parameters.addRedrawObserver(() => needToRedraw = true);
    Parameters.addResetObserver(() => needToReset = true);

    // let i = 0;
    let indicatorsNeedUpdate = true;
    function mainLoop(): void {
        if (threadComputer !== null) {
            if (needToReset) {
                threadComputer.reset(Parameters.linesOpacity, Parameters.linesThickness);
                needToReset = false;
                needToRedraw = true;
            }

            const computedSomething = threadComputer.computeNextSegments(20);
            needToRedraw = needToRedraw || computedSomething;

            indicatorsNeedUpdate = indicatorsNeedUpdate || computedSomething;
            if (indicatorsNeedUpdate && Parameters.showIndicators) {
                threadComputer.updateIndicators(canvasPlotter, Page.Canvas.setIndicatorText);
                indicatorsNeedUpdate = false;
            }

            if (needToRedraw) {
                plot(threadComputer, canvasPlotter);
                needToRedraw = !computedSomething;
            }

            if (Parameters.debug) {
                threadComputer.drawDebugView(canvasPlotter.context);
            }

            // i++;
            // if (i % 500 === 0) {
            //     Statistics.print(console.log);
            // }
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
        threadComputer = new ThreadComputer(image);
        needToReset = true;
    }
    Parameters.addFileUploadObserver(onNewImage);

    Page.Canvas.showLoader(true);
    const defaultImage = new Image();
    defaultImage.addEventListener("load", () => {
        Statistics.stopTimer("load-default-image");
        onNewImage(defaultImage);
    });
    Statistics.startTimer("load-default-image", true);
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
