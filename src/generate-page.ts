import * as fs from "fs";
import * as fse from "fs-extra";
import * as path from "path";
import { Demopage } from "webpage-templates";

const data = {
    title: "Lines",
    description: "Transformation of a picture into lines.",
    introduction: [
        "This is a simple tool that turns images into lines.",
        "The result can be exported in the SVG format."
    ],
    githubProjectName: "image-stylization-sines",
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
            id: "thread-length",
            label: "Thread length"
        },
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
            title: "Parameters",
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
                    title: "Pegs",
                    id: "pegs-range-id",
                    min: 1,
                    max: 10,
                    value: 10,
                    step: 0.5
                },
                {
                    type: Demopage.supportedControls.Range,
                    title: "Intensity",
                    id: "intensity-range-id",
                    min: 1,
                    max: 100,
                    value: 1,
                    step: 1
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
                    checked: false
                },
                {
                    type: Demopage.supportedControls.Range,
                    title: "Thickness",
                    id: "line-thickness-range-id",
                    min: 1,
                    max: 10,
                    value: 1,
                    step: 0.5
                },
                {
                    type: Demopage.supportedControls.Checkbox,
                    title: "Invert",
                    id: "invert-colors-checkbox-id",
                    checked: false
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