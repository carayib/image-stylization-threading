import * as Helpers from "./helpers";

import { Parameters } from "./parameters";

import { IPlotterInfo, PlotterBase } from "./plotter/plotter-base";
import { PlotterCanvas2D } from "./plotter/plotter-canvas-2d";
import { PlotterSVG } from "./plotter/plotter-svg";

import { ThreadComputer } from "./threading/thread-computer";

import "./page-interface-generated";

const MAX_COMPUTING_TIME_PER_FRAME = 20; // ms

function plot(threadComputer: ThreadComputer, plotter: PlotterBase, nbSegmentsToIgnore: number): void {
    if (nbSegmentsToIgnore >= threadComputer.nbSegments) {
        return;
    }

    const drawFromScratch = (nbSegmentsToIgnore === 0);
    if (drawFromScratch) {
        const plotterInfos: IPlotterInfo = {
            backgroundColor: Parameters.invertColors ? "black" : "white",
            blur: Parameters.blur,
        };

        plotter.resize();
        plotter.initialize(plotterInfos);

        if (Parameters.displayPegs) {
            threadComputer.drawPegs(plotter);
        }

        threadComputer.drawThread(plotter, 0);
        plotter.finalize();
    } else {
        threadComputer.drawThread(plotter, nbSegmentsToIgnore);
    }
}

function main(): void {
    const canvasPlotter = new PlotterCanvas2D();
    let threadComputer: ThreadComputer = null;
    let needToReset = true;

    Parameters.addRedrawObserver(() => nbSegmentsToIgnore = 0);
    Parameters.addResetObserver(() => needToReset = true);

    let nbSegmentsToIgnore = 0;
    let indicatorsNeedUpdate = true;
    function mainLoop(): void {
        if (threadComputer !== null) {
            if (needToReset) {
                threadComputer.reset(Parameters.linesOpacity, Parameters.linesThickness);
                needToReset = false;
                nbSegmentsToIgnore = 0;
            }

            const computedSomething = threadComputer.computeNextSegments(MAX_COMPUTING_TIME_PER_FRAME);

            indicatorsNeedUpdate = indicatorsNeedUpdate || computedSomething;
            if (indicatorsNeedUpdate && Parameters.showIndicators) {
                threadComputer.updateIndicators(Page.Canvas.setIndicatorText);
                indicatorsNeedUpdate = false;
            }

            if (nbSegmentsToIgnore >  threadComputer.nbSegments) {
                // if the nb of segment went down, no other choice that redrawing all from scratch
                nbSegmentsToIgnore = 0;
            }
            plot(threadComputer, canvasPlotter, nbSegmentsToIgnore);
            nbSegmentsToIgnore = threadComputer.nbSegments;

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
        threadComputer = new ThreadComputer(image);
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
        plot(threadComputer, svgPlotter, 0);
        const svgString = svgPlotter.export();
        const filename = "image-as-threading.svg";
        Helpers.downloadTextFile(svgString, filename);
    });
}

main();
