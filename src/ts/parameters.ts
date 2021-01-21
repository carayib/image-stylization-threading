import * as Helpers from "./helpers";

import "./page-interface-generated";

const controlId = {
    UPLOAD_INPUT_IMAGE: "input-image-upload-button",
    SHAPE: "shape-tabs-id",
    NB_PEGS: "pegs-range-id",
    NB_LINES: "lines-range-id",
    LINES_OPACITY: "opacity-range-id",
    LINES_THICKNESS: "thickness-range-id",
    DISPLAY_PEGS: "display-pegs-checkbox-id",
    INVERT_COLORS: "invert-colors-checkbox-id",
    SHOW_INDICATORS: "show-indicators-checkbox-id",
    BLUR: "blur-range-id",
    DOWNLOAD: "result-download-id",
};

enum EShape {
    RECTANGLE = "0",
    ELLIPSIS = "1",
}

type Observer = () => unknown;
const redrawObservers: Observer[] = [];
function triggerRedraw(): void {
    for (const observer of redrawObservers) {
        observer();
    }
}

const resetObservers: Observer[] = [];
function triggerReset(): void {
    for (const observer of resetObservers) {
        observer();
    }
}

Page.Tabs.addObserver(controlId.SHAPE, triggerReset);
Page.Range.addLazyObserver(controlId.NB_PEGS, triggerReset);
Page.Range.addLazyObserver(controlId.LINES_OPACITY, triggerReset);
Page.Range.addLazyObserver(controlId.LINES_THICKNESS, triggerReset);
Page.Checkbox.addObserver(controlId.DISPLAY_PEGS, triggerRedraw);
Page.Checkbox.addObserver(controlId.INVERT_COLORS, triggerReset);
Page.Canvas.Observers.canvasResize.push(triggerRedraw);

const isInDebug = Helpers.getQueryStringValue("debug") === "1";

function updateIndicatorsVisibility(): void {
    const shouldBeVisible = Page.Checkbox.isChecked(controlId.SHOW_INDICATORS);
    Page.Canvas.setIndicatorsVisibility(shouldBeVisible);
}
Page.Checkbox.addObserver(controlId.SHOW_INDICATORS, updateIndicatorsVisibility);
updateIndicatorsVisibility();

abstract class Parameters {
    public static addFileUploadObserver(callback: (image: HTMLImageElement) => unknown): void {
        Page.FileControl.addUploadObserver(controlId.UPLOAD_INPUT_IMAGE, (filesList: FileList) => {
            if (filesList.length === 1) {
                Page.Canvas.showLoader(true);
                const reader = new FileReader();
                reader.onload = () => {
                    const image = new Image();
                    image.addEventListener("load", () => {
                        callback(image);
                    })
                    image.src = reader.result as string;
                };
                reader.readAsDataURL(filesList[0]);
            }
        });
    }

    public static get debug(): boolean {
        return isInDebug;
    }

    public static get shape(): EShape {
        return Page.Tabs.getValues(controlId.SHAPE)[0] as EShape;
    }

    public static get pegsSpacing(): number {
        return 11 - Page.Range.getValue(controlId.NB_PEGS);
    }

    public static get nbLines(): number {
        return 500 * Page.Range.getValue(controlId.NB_LINES);
    }

    public static get linesOpacity(): number {
        const raw = Page.Range.getValue(controlId.LINES_OPACITY);
        return Math.pow(2, raw - 7); // 2^(raw+2) / 256
    }

    public static get linesThickness(): number {
        return Page.Range.getValue(controlId.LINES_THICKNESS);
    }

    public static get displayPegs(): boolean {
        return Page.Checkbox.isChecked(controlId.DISPLAY_PEGS);
    }

    public static get invertColors(): boolean {
        return Page.Checkbox.isChecked(controlId.INVERT_COLORS);
    }

    public static get showIndicators(): boolean {
        return Page.Checkbox.isChecked(controlId.SHOW_INDICATORS);
    }

    public static addRedrawObserver(callback: Observer): void {
        redrawObservers.push(callback);
    }

    public static addResetObserver(callback: Observer): void {
        resetObservers.push(callback);
    }

    public static get blur(): number {
        return Page.Range.getValue(controlId.BLUR);
    }
    public static addBlurChangeObserver(callback: (newBlur: number) => unknown): void {
        Page.Range.addObserver(controlId.BLUR, callback);
    }

    public static addDownloadObserver(callback: () => unknown): void {
        Page.FileControl.addDownloadObserver(controlId.DOWNLOAD, callback);
    }
}

export { Parameters, EShape }
