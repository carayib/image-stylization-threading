function downloadTextFile(content: string, filename: string): void {
    const fileType = "text/plain";

    const blob = new Blob([content], { type: fileType });

    if (typeof window.navigator !== "undefined" && typeof window.navigator.msSaveBlob !== "undefined") { // for IE
        window.navigator.msSaveBlob(blob, filename);
    } else {
        const objectUrl = URL.createObjectURL(blob);

        const linkElement = document.createElement('a');
        linkElement.download = filename;
        linkElement.href = objectUrl;
        linkElement.dataset.downloadurl = `${fileType}:${linkElement.download}:${linkElement.href}`;
        linkElement.style.display = "none";
        document.body.appendChild(linkElement);
        linkElement.click();
        document.body.removeChild(linkElement);

        // don't forget to free the objectURL after a few seconds
        setTimeout(() => {
            URL.revokeObjectURL(objectUrl);
        }, 5000);
    }
}

function getQueryStringValue(name: string): string | null {
    const url = window.location.href;
    const queryStringStart = url.indexOf("?");
    if (queryStringStart >= 0) {
        const queryString = url.substring(queryStringStart + 1);
        if (queryString.length > 0) {
            const parameters = queryString.split("&");
            for (const parameter of parameters) {
                const keyValue = parameter.split("=");
                if (keyValue.length === 2) {
                    const decodedKey = decodeURIComponent(keyValue[0]);
                    if (decodedKey === name) {
                        return decodeURIComponent(keyValue[1]);
                    }
                }
            }
        }
    }

    return null;
}

function declareArrayIncludesPolyfill(): void {
    if (typeof Array.prototype.includes !== "function") {
        console.log("Declaring Array.includes polyfill...");
        Object.defineProperty(Array.prototype, "includes", {
            value<T>(this: T[], element: any): boolean {
                return this.indexOf(element) >= 0;
            }
        });
    }
}

function declareStringRepeatPolyfill(): void {
    if (typeof String.prototype.repeat !== "function") {
        console.log("Declaring String.repeat polyfill...");
        Object.defineProperty(String.prototype, "repeat", {
            value(this: string, count: number): string {
                if (count < 0 || count === Infinity) {
                    throw new RangeError();
                }

                let result = "";
                for (let i = 0; i < count; i++) {
                    result += this;
                }
                return result;
            }
        });
    }
}

function declarePolyfills(): void {
    declareArrayIncludesPolyfill();
    declareStringRepeatPolyfill();
}

export {
    declarePolyfills,
    downloadTextFile,
    getQueryStringValue,
};
