import { StopWatch } from "./stop-watch";

interface ITimer {
    stopwatch: StopWatch;
    singleUse: boolean;
}

let timers: { [name: string]: ITimer } = {};
let iteration = 1;

function reset(): void {
    timers = {};
}

function startTimer(name: string, singleUse?: boolean): void {
    if (typeof timers[name] === "undefined") {
        timers[name] = { stopwatch: new StopWatch(), singleUse: !!singleUse };
    }
    timers[name].stopwatch.start();
}

function stopTimer(name: string): void {
    const timer = timers[name];
    timer.stopwatch.stop();
}

function addIteration(): void {
    iteration++;
}

type PrintingFunction = (text: string) => unknown;
function print(printFunction: PrintingFunction): void {
    interface IPrintableTimer {
        name: string;
        stopwatch: StopWatch,
    }

    const list: IPrintableTimer[] = [];

    Object.keys(timers).forEach((name: string) => {
        const timer = timers[name];
        if (timer.singleUse) {
            printFunction(`${name}:\t${timer.stopwatch.totalTime} ms (once)`);
        } else {
            list.push({ name, stopwatch: timer.stopwatch });
        }
    });

    list.sort((a: IPrintableTimer, b: IPrintableTimer) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

    for (const item of list) {
        printFunction(`${item.name}:\t${item.stopwatch.totalTime / iteration} ms (average)`);
    }
}

export {
    reset,
    startTimer,
    stopTimer,
    addIteration,
    print,
};
