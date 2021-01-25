enum ECompositingOperation {
    DARKEN,
    LIGHTEN,
}

let supportsAdvancedCompositing = true;
function useAdvancedCompositing(): boolean {
    return supportsAdvancedCompositing;
}

/**
 * @param opacity in [0, 1]
 */
function applyCanvasCompositing(context: CanvasRenderingContext2D, opacity: number, operation: ECompositingOperation): void {
    if (supportsAdvancedCompositing) {
        const value = Math.ceil(255 * opacity);
        context.strokeStyle = `rgb(${value},${value},${value})`;

        const targetOperation = (operation === ECompositingOperation.LIGHTEN) ? "lighter" : "difference";
        context.globalCompositeOperation = targetOperation;
        if (context.globalCompositeOperation === targetOperation) {
            return; // success
        } else {
            supportsAdvancedCompositing = false;
            Page.Demopage.setErrorMessage("advanced-compositing-not-supported", `Your browser does not support canvas2D compositing '${targetOperation}'. The project will not run as expected.`);
        }
    }

    // basic compositing
    {
        resetCanvasCompositing(context);
        const value = (operation === ECompositingOperation.LIGHTEN) ? 255 : 0;
        context.strokeStyle = `rgba(${value}, ${value}, ${value}, ${opacity})`;
    }
}

function resetCanvasCompositing(context: CanvasRenderingContext2D): void {
    context.globalCompositeOperation = "source-over";
}

export {
    ECompositingOperation,
    applyCanvasCompositing,
    resetCanvasCompositing,
    useAdvancedCompositing,
};
