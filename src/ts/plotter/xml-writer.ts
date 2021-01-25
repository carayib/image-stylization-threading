class XMLWriter {
    private indentationLevel: number = 0;
    private lines: string[] = [];

    public get result(): string {
        return this.lines.join("\n");
    }

    public startBlock(line: string): void {
        this.addLine(line);
        this.indentationLevel++;
    }

    public endBlock(line: string): void {
        this.indentationLevel--;
        this.addLine(line);
    }

    public addLine(line: string): void {
        this.lines.push(this.prefix + line);
    }

    private get prefix(): string {
        return "\t".repeat(this.indentationLevel);
    }
}

export { XMLWriter };
