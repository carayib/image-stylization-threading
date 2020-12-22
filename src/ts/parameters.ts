import "./page-interface-generated";

const controlId = {
    UPLOAD_INPUT_IMAGE: "input-image-upload-button",
    SHAPE: "shape-tabs-id",
    NB_PEGS: "pegs-range-id",
    INTENSITY: "intensity-range-id",
    DISPLAY_PEGS: "display-pegs-checkbox-id",
    LINE_THICKNESS: "line-thickness-range-id",
    INVERT_COLORS: "invert-colors-checkbox-id",
    BLUR: "blur-range-id",
    DOWNLOAD: "result-download-id",
};

enum EShape {
    RECTANGLE = "0",
    ELLIPSIS = "1",
}

type RedrawObserver = () => unknown;
const redrawObservers: RedrawObserver[] = [];
function triggerRedraw(): void {
    for (const observer of redrawObservers) {
        observer();
    }
}

Page.Tabs.addObserver(controlId.SHAPE, triggerRedraw);
Page.Range.addLazyObserver(controlId.NB_PEGS, triggerRedraw);
Page.Range.addObserver(controlId.INTENSITY, triggerRedraw);
Page.Checkbox.addObserver(controlId.DISPLAY_PEGS, triggerRedraw);
Page.Range.addLazyObserver(controlId.LINE_THICKNESS, triggerRedraw);
Page.Checkbox.addObserver(controlId.INVERT_COLORS, triggerRedraw);
Page.Canvas.Observers.canvasResize.push(triggerRedraw);

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

    public static get shape(): EShape {
        return Page.Tabs.getValues(controlId.SHAPE)[0] as EShape;
    }

    public static get nbPegs(): number {
        const rawNbPegs = Page.Range.getValue(controlId.NB_PEGS);
        return rawNbPegs * 10;
    }

    public static get intensity(): number {
        const rawIntensity = Page.Range.getValue(controlId.INTENSITY);
        return rawIntensity * 100;
    }

    public static get displayPegs(): boolean {
        return Page.Checkbox.isChecked(controlId.DISPLAY_PEGS);
    }

    public static get lineThickness(): number {
        return Page.Range.getValue(controlId.LINE_THICKNESS);
    }

    public static get invertColors(): boolean {
        return Page.Checkbox.isChecked(controlId.INVERT_COLORS);
    }

    public static addRedrawObserver(callback: RedrawObserver): void {
        redrawObservers.push(callback);
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
