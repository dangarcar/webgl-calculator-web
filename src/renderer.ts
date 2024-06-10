import { ColorTranslator } from "colortranslator";
import { SIDE, backState, drawBack } from "./background";
import { expressions } from "./equations";
import { T_FRAGMENT_GLSL } from "./t_fragment.glsl.ts";

let shaderProgram: WebGLProgram | null;

const canvas = <HTMLCanvasElement> document.getElementById("calculator")!;
const gl = canvas.getContext("webgl2", {premultipliedAlpha: false})!;

let updateCanvas = true;
export function draw() {
    updateCanvas = true;
}

startRendering();

function startRendering() {
    let positionLocation: number;
    let positionBuffer: WebGLBuffer;
    let fsSource: string;

    let oldTime = performance.now();
    let frames = 0;
    (function render() {
        drawBack();

        if(updateCanvas) {
            try {
                console.time("update");
                updateDraw();
                console.timeEnd("update");
            } catch(e) {
                console.error(e);
            } finally {
                updateCanvas = false;
            }
        }

        window.requestAnimationFrame(render);
        printFPS();
        
        gl.clearColor(1.0, 1.0, 0.0, 1.0);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Setup the positions for the vertex shader
        //@ts-ignore
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        //@ts-ignore
        gl.enableVertexAttribArray(positionLocation);
        //@ts-ignore 
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        if(!shaderProgram) throw Error("There is no webgl shader program");

        // Give location to my variables
        const originLocation = gl.getUniformLocation(shaderProgram, 'origin');
        gl.uniform2i(originLocation, backState.x, backState.y);
        
        const squareMantLocation = gl.getUniformLocation(shaderProgram, 'squareMant');
        const squareExpLocation = gl.getUniformLocation(shaderProgram, 'squareExp');
        const squareSizeLocation = gl.getUniformLocation(shaderProgram, 'squareSize');
        gl.uniform1i(squareMantLocation, backState.mant);
        gl.uniform1i(squareExpLocation, backState.exp);
        gl.uniform1i(squareSizeLocation, backState.size);

        const express = Array.from(expressions, ([_k, v]) => {
            const rgb = new ColorTranslator(v.color);
            return [rgb.R/255, rgb.G/255, rgb.B/255, v.visible? 1.0:0.0];
        });
        const maxExprLocation = gl.getUniformLocation(shaderProgram, 'maxExpr');
        const expressionsLocation = gl.getUniformLocation(shaderProgram, 'expressions');
        gl.uniform1i(maxExprLocation, express.length);
        if(express.length > 0)
            gl.uniform4fv(expressionsLocation, express.flat(1));

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    })();

    function updateDraw() {
        fsSource = getFragmentShaderSource();
        initShaders(gl, fsSource);

        positionLocation = gl.getAttribLocation(shaderProgram!, "a_position");
        
        positionBuffer = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([
                -1.0, -1.0,
                1.0, -1.0,
                -1.0, 1.0,
                -1.0, 1.0,
                1.0, -1.0,
                1.0, 1.0]),
                gl.STATIC_DRAW
        );
    }

    function printFPS() {
        let t = performance.now();
        let dt = t - oldTime;
        if(dt > 1000) {
            const fps = document.getElementById('fps')!;
            fps.innerHTML = `FPS: ${frames}`;
            oldTime = t;
            frames = 0;
        }

        frames++;
    }
}

function createShader(gl: WebGL2RenderingContext, type: number, source: string) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Error compiling shader:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

function initShaders(gl: WebGL2RenderingContext, fsSource: string) {
    const vtSource = `#version 300 es
    in vec4 a_position;
    void main() { gl_Position = a_position; }`;

    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource)!;
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vtSource)!;

    shaderProgram = gl.createProgram()!;
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
    gl.useProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error(`Unable to initialize the shader program: ${gl.getProgramInfoLog(shaderProgram)}`,);
        return null;
    }
}

function getFragmentShaderSource() {
    let fsSource = T_FRAGMENT_GLSL;
    fsSource = fsSource.replace("%side%", SIDE.toString());

    const func = compileEvalFunction();
    fsSource = fsSource.replace("%REPLACE_CODE%", func);

    return fsSource;
}

function compileEvalFunction() {    
    const evals = Array.from(expressions, ([_k, v]) => v.code);
    let code = "";
    for(let i in evals) {
        if(evals[i]) {
            code += `
            case ${i}:
                ${evals[i]}
                break;
            `;
        }
    }

    console.log(code); //FIXME:

    return code;
}