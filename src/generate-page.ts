import * as fs from "fs";
import * as fse from "fs-extra";
import * as path from "path";
import { Demopage } from "webpage-templates";

const data = {
    title: "Threading",
    description: "Transformation of a picture into string art.",
    introduction: [
        "This tool generates string art from any picture of your choice. Pegs are first placed on the frame, and then a single-color thread is repeatedly ran from peg to peg in a straight line. The stacked segments progressively recreate the original image. This process was popularized by Petros Vrellis.",
        "The monochrome mode uses a single thread, while the color mode uses 3 distinct threads. The result can be exported in the SVG format."
    ],
    githubProjectName: "image-stylization-threading",
    additionalLinks: [],
    styleFiles: [],
    scriptFiles: [
        "script/main.min.js"
    ],
    indicators: [
        {
            id: "pegs-count",
            label: "Pegs count"
        },
        {
            id: "segments-count",
            label: "Segments count"
        },
        {
            id: "error-average",
            label: "Error (average)"
        },
        {
            id: "error-mean-square",
            label: "Error (mean square)"
        },
        {
            id: "error-variance",
            label: "Error (variance)"
        }
    ],
    canvas: {
        width: 512,
        height: 512,
        enableFullscreen: true
    },
    controlsSections: [
        {
            title: "Input",
            controls: [
                {
                    type: Demopage.supportedControls.FileUpload,
                    id: "input-image-upload-button",
                    accept: [".png", ".jpg", ".bmp", ".webp"],
                    defaultMessage: "Upload an image"
                }
            ]
        },
        {
            title: "Pegs",
            controls: [
                {
                    type: Demopage.supportedControls.Tabs,
                    title: "Shape",
                    id: "shape-tabs-id",
                    unique: true,
                    options: [
                        {
                            label: "Rectangle",
                            value: "0",
                            checked: true,
                        },
                        {
                            label: "Ellipsis",
                            value: "1",
                            checked: false,
                        },
                    ]
                },
                {
                    type: Demopage.supportedControls.Range,
                    title: "Pegs density",
                    id: "pegs-range-id",
                    min: 0.1,
                    max: 1,
                    value: 0.6,
                    step: 0.05
                },
            ]
        },
        {
            title: "Parameters",
            controls: [
                {
                    type: Demopage.supportedControls.Tabs,
                    title: "Quality",
                    id: "quality-tabs-id",
                    unique: true,
                    options: [
                        {
                            label: "Low",
                            value: "1",
                            checked: true,
                        },
                        {
                            label: "Medium",
                            value: "2",
                            checked: false,
                        },
                        {
                            label: "High",
                            value: "3",
                            checked: false,
                        },
                    ]
                },
                {
                    type: Demopage.supportedControls.Tabs,
                    title: "Mode",
                    id: "thread-mode-tabs-id",
                    unique: true,
                    options: [
                        {
                            label: "Monochrome",
                            value: "0",
                            checked: true,
                        },
                        {
                            label: "Three colors",
                            value: "1",
                            checked: false,
                        },
                    ]
                },
                {
                    type: Demopage.supportedControls.Checkbox,
                    title: "Dark mode",
                    id: "invert-colors-checkbox-id",
                    checked: false
                },
                {
                    type: Demopage.supportedControls.Range,
                    title: "Segments count",
                    id: "lines-range-id",
                    min: 500,
                    max: 15000,
                    value: 2500,
                    step: 500
                },
                {
                    type: Demopage.supportedControls.Range,
                    title: "Opacity",
                    id: "opacity-range-id",
                    min: 1,
                    max: 5,
                    value: 2,
                    step: 1
                },
                {
                    type: Demopage.supportedControls.Range,
                    title: "Thickness",
                    id: "thickness-range-id",
                    min: 0.25,
                    max: 1,
                    value: 0.5,
                    step: 0.25
                },
            ]
        },
        {
            title: "Display",
            controls: [
                {
                    type: Demopage.supportedControls.Checkbox,
                    title: "Pegs",
                    id: "display-pegs-checkbox-id",
                    checked: true
                },
                {
                    type: Demopage.supportedControls.Checkbox,
                    title: "Show indicators",
                    id: "show-indicators-checkbox-id",
                    checked: true
                },
                {
                    type: Demopage.supportedControls.Range,
                    title: "Blur",
                    id: "blur-range-id",
                    min: 0,
                    max: 20,
                    value: 0,
                    step: 1
                },
            ]
        },
        {
            title: "Output",
            controls: [
                {
                    type: Demopage.supportedControls.FileDownload,
                    id: "result-download-id",
                    label: "Download as SVG",
                    flat: true
                },
                {
                    type: Demopage.supportedControls.FileDownload,
                    id: "instructions-download-id",
                    label: "Download instructions (beta)",
                    flat: true
                }
            ]
        }
    ]
};

const SRC_DIR = path.resolve(__dirname);
const DEST_DIR = path.resolve(__dirname, "..", "docs");
const minified = true;

const buildResult = Demopage.build(data, DEST_DIR, {
    debug: !minified,
});

// disable linting on this file because it is generated
buildResult.pageScriptDeclaration = "/* tslint:disable */\n" + buildResult.pageScriptDeclaration;

const SCRIPT_DECLARATION_FILEPATH = path.join(SRC_DIR, "ts", "page-interface-generated.ts");
fs.writeFileSync(SCRIPT_DECLARATION_FILEPATH, buildResult.pageScriptDeclaration);

fse.copySync(path.join(SRC_DIR, "resources"), path.join(DEST_DIR, "resources"));