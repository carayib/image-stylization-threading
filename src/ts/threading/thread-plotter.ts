import { Parameters } from "../parameters";
import { IPlotterInfo, PlotterBase } from "../plotter/plotter-base";
import { ThreadComputer } from "./thread-computer";

class ThreadPlotter {
    private nbSegmentsDrawn: number = 0;

    public constructor(private readonly plotter: PlotterBase, private readonly threadComputer: ThreadComputer) { }

    public reset(): void {
        this.nbSegmentsDrawn = 0;
    }

    public plot(): void {
        if (this.nbSegmentsDrawn === this.threadComputer.nbSegments) {
            // nothing more to do
            return;
        } else if (this.nbSegmentsDrawn > this.threadComputer.nbSegments) {
            // if the nb of segment went down, no other choice that redrawing all from scratch
            this.nbSegmentsDrawn = 0;
        }

        const drawFromScratch = (this.nbSegmentsDrawn === 0);
        if (drawFromScratch) {
            const plotterInfos: IPlotterInfo = {
                backgroundColor: Parameters.invertColors ? "black" : "white",
                blur: Parameters.blur,
            };

            this.plotter.resize();
            this.plotter.initialize(plotterInfos);

            if (Parameters.displayPegs) {
                this.threadComputer.drawPegs(this.plotter);
            }

            this.threadComputer.drawThread(this.plotter, 0);
            this.plotter.finalize();
        } else {
            this.threadComputer.drawThread(this.plotter, this.nbSegmentsDrawn);
        }

        this.nbSegmentsDrawn = this.threadComputer.nbSegments;
    }
}

export { ThreadPlotter };
