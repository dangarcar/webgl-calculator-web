import numeral from "numeral";

export const SIDE = 768, SIDE_2 = SIDE/2, V_ZOOM = 10;
const SQR_MANTS = [1, 2, 5], SQR_SUBS = [5, 4, 5];
const DEFAULT_MANT = SQR_MANTS[1]!, DEFAULT_EXP = 0, DEFAULT_SIZE = 150;

interface BackgroundState {
    x: number,
    y: number,
    exp: number,
    mant: number,
    size: number,
}

export let backState: BackgroundState = {
    x: SIDE_2,
    y: SIDE_2,
    exp: DEFAULT_EXP,
    mant: DEFAULT_MANT,
    size: DEFAULT_SIZE,
};

export const returnHome = () => {
    backState = {
        x: SIDE/2,
        y: SIDE/2,
        exp: DEFAULT_EXP,
        mant: DEFAULT_MANT,
        size: DEFAULT_SIZE,
    }
} 

const app = document.getElementById('app');
app?.addEventListener('wheel', e => {
    const state = backState;
    const v = (e.deltaY < 0)? V_ZOOM : -V_ZOOM;
    
    state.x = backState.x + (backState.x - e.pageX) * v / backState.size;
    state.y = backState.y + (backState.y - e.pageY) * v / backState.size;
    
    state.size = backState.size + v;

    if(state.size <= 100) {
        let i = SQR_MANTS.findIndex(e => e == state.mant);
        i++;
        if(i > 2) {
            i = 0;
            state.exp++;
            state.size = 2*state.size;
        } else {
            //@ts-ignore
            state.size = (SQR_MANTS[i] * state.size) / SQR_MANTS[i-1];
        }

        state.mant = SQR_MANTS[i]!;
    }

    if(state.size >= 200) {
        let i = SQR_MANTS.findIndex(e => e == state.mant);
        i--;
        if(i < 0) {
            i = 2;
            state.exp--;
            state.size = state.size/2;
        } else {
            //@ts-ignore
            state.size = (SQR_MANTS[i] * state.size) / SQR_MANTS[i+1];
        }

        state.mant = SQR_MANTS[i]!;
    }

    //FIXME: This isn't good at all 
    //@ts-ignore
    const fx = Math.ceil(-state.x/state.size), fy = Math.floor(state.y/state.size);
    backState = state;
});

let pageX = 0;
let pageY = 0;
let mouseDown = false;
app?.addEventListener('mousedown', e => {
    pageX = e.pageX;
    pageY = e.pageY;
    mouseDown = true;
});

app?.addEventListener('mouseup', _e => {
    mouseDown = false;
});

app?.addEventListener('mousemove', e => {
    if(!mouseDown) return;

    const deltaX = e.pageX - pageX;
    const deltaY = e.pageY - pageY;
    pageX = e.pageX;
    pageY = e.pageY;

    backState.x += deltaX;
    backState.y += deltaY;
})

export const drawBack = () => {
    const back = <HTMLCanvasElement> document.getElementById('calculator-back');
    const ctx = back?.getContext('2d');

    if(!ctx) {
        throw Error("There are no canvas to draw the background on");
    }

    ctx.clearRect(0, 0, SIDE, SIDE);
    
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#F4F4ED";
    ctx.beginPath();
    ctx.moveTo(0, backState.y-1);
    ctx.lineTo(SIDE, backState.y-1);
    ctx.stroke();
    ctx.moveTo(backState.x-1, 0);
    ctx.lineTo(backState.x-1, SIDE);
    ctx.stroke();

    drawAxes(ctx, backState.x, false, drawCoordX, (x: number, a: number) => {
        ctx.strokeStyle = hexToRGB("#F4F4ED", a);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, SIDE);
        ctx.stroke();
    });
    drawAxes(ctx, backState.y, true, drawCoordY, (y: number, a: number) => {
        ctx.strokeStyle = hexToRGB("#F4F4ED", a);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(SIDE, y);
        ctx.stroke();
    });
}

function drawAxes(
        ctx: CanvasRenderingContext2D, 
        t0: number, 
        inverted: boolean, 
        drawCoordFunc: (ctx:CanvasRenderingContext2D, text:string, t:number) => void, 
        drawLineFunc: (t: number, alpha: number) => void
) {
    ctx.lineWidth = 1;
    const subs = SQR_SUBS[SQR_MANTS.findIndex(e=>e==backState.mant)] !;
    const dt = backState.size/subs;

    const k = Math.ceil(-t0/dt);
    let xt = k * dt;
    let nt = Math.floor((k-1)/subs + 1) * backState.mant!;
    if(inverted) nt = -nt; 
    while(t0 + xt <= SIDE) {
        const t = t0 + xt;

        if(Math.abs(xt % backState.size) < 1) {
            const text = squareToString(nt, backState.exp);

            if(nt != 0) {
                drawCoordFunc(ctx, text, t);
                drawLineFunc(t, 0.65);
            }

            nt += inverted? -backState.mant!: backState.mant!;
        } else {
            const alpha = Math.max(0, (dt-20)*0.01);
            drawLineFunc(t, alpha);
        }

        xt += dt;
    }
}

function drawCoordX(ctx: CanvasRenderingContext2D, text: string, x: number) {
    const textMetrics = ctx.measureText(text);
    let color = "#F4F4ED";
    ctx.font = '18px sans-serif';

    let wx = x - textMetrics.width/2;
    if(wx < 5) {
        wx = 5;
        color = "#babaab";
    } else if(wx > SIDE - 5 - textMetrics.width) {
        wx = SIDE - 5 - textMetrics.width;
        color = "#babaab";
    }

    let wy = backState.y + 20;
    if(wy < 25) {
        wy = 25;
        color = "#babaab";
    } else if(wy > SIDE - 5) {
        wy = SIDE - 5;
        color = "#babaab";
    }

    ctx.fillStyle = "rgba(15, 15, 15, 50%)";
    ctx.fillRect(wx, wy-18, textMetrics.width, 20);
    ctx.fillStyle = color;
    ctx.fillText(text, wx, wy);
}

function drawCoordY(ctx: CanvasRenderingContext2D, text: string, y: number) {
    const textMetrics = ctx.measureText(text);
    let color = "#F4F4ED";
    ctx.font = '18px sans-serif';

    let wx = backState.x - textMetrics.width - 10;
    if(wx < 5) {
        wx = 5;
        color = "#babaab";
    } else if(wx > SIDE - 5- textMetrics.width) {
        wx = SIDE - 5 - textMetrics.width;
        color = "#babaab";
    }

    let wy = y + 6;
    if(wy < 20) {
        wy = 20;
        color = "#babaab";
    } else if(wy > SIDE - 5) {
        wy = SIDE - 5;
        color = "#babaab";
    }

    ctx.fillStyle = "rgba(15, 15, 15, 50%)";
    ctx.fillRect(wx, wy, textMetrics.width, 20);
    ctx.fillStyle = color;
    ctx.fillText(text, wx, wy);
}

const sup = [8304, 185, 178, 179, 8308, 8309, 8310, 8311, 8312, 8313];

function squareToString(mant: number, exp: number) {
    const number = numeral(mant);
    const ends = number.format('0.0000e+0').split("e");
    const f = parseFloat(ends[0]? ends[0]:"0");
    const e = parseInt(ends[1]? ends[1]:"0") + exp;

    if(e > -5 && e < 7) {
        let n = f * Math.pow(10, e);
        return numeral(n).format('0[.][000000]');
    }

    const eF = [...e.toString()].map(c => {
        if(c == '-') 
            return String.fromCharCode(8315);

        const t = sup[(c.charCodeAt(0) - '0'.charCodeAt(0)) % 10];
        return t? String.fromCharCode(t):'';
    }).toString().replace(",", "");

    const text = f + "·10" + eF;
    return text;
}

function hexToRGB(hex: string, alpha: number) {
    const r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);

    return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
}