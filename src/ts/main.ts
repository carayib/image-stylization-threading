import * as Helpers from "./helpers";
import { InputImage } from "./input-image";
import { Parameters } from "./parameters";

import { PlotterBase } from "./plotter/plotter-base";
import { PlotterCanvas2D } from "./plotter/plotter-canvas-2d";
import { PlotterSVG } from "./plotter/plotter-svg";

import "./page-interface-generated";
import { ThreadComputer } from "./thread-computer";

function plot(image: InputImage, plotter: PlotterBase): void {
    const start = performance.now();

    if (image == null) {
        console.log("Image not loaded!");
        return;
    }

    plotter.resize();
    plotter.initialize({ backgroundColor: "white", blur: 0 });

    const threadComputer = new ThreadComputer(image.sourceImage, Parameters.shape);
    threadComputer.computeNextThreads(2000);

    if (Parameters.displayPegs) {
        threadComputer.drawPegs(plotter);
    }
    threadComputer.drawThreads(plotter);

    plotter.finalize();
    console.log(`Plotting took ${performance.now() - start} ms.`);
}

let inputImage: InputImage = null;
const canvasPlotter = new PlotterCanvas2D();

function plotOnCanvas(): void {
    plot(inputImage, canvasPlotter);
}
Parameters.addRedrawObserver(plotOnCanvas);

function updateBlur(blur: number): void {
    canvasPlotter.blur = blur;
}
Parameters.addBlurChangeObserver(updateBlur);
updateBlur(Parameters.blur);

Parameters.addDownloadObserver(() => {
    const svgPlotter = new PlotterSVG();
    plot(inputImage, svgPlotter);
    const svgString = svgPlotter.export();
    const filename = "image-as-threading.svg";
    Helpers.downloadTextFile(svgString, filename);
});

function onImageLoad(image: HTMLImageElement): void {
    inputImage = new InputImage(image);
    Page.Canvas.showLoader(false);
    plotOnCanvas();
}
Parameters.addFileUploadObserver(onImageLoad);

Page.Canvas.showLoader(true);
const defaultImage = new Image();
defaultImage.addEventListener("load", () => {
    onImageLoad(defaultImage);
});
defaultImage.src = "./resources/cat.jpg";
