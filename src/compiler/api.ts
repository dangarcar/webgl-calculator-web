import { parseLatex } from "./parser";
import * as Ast from './ast';
import { simplifyTree } from "./simplifier";
import { astUnknowns, compile } from "./compiler";

export const functionMap: Map<string, Ast.Node> = new Map;
const variableMap: Map<string, number> = new Map;

export interface Response {
    code: string,
    num?: number,
}

export function processCompiler(eq: string, exprIdx: number): Response {
    const root = parseLatex(eq);
    Ast.printTree(root);

    const response = processAst(root, exprIdx);
    if(response.num !== undefined) 
        console.log(`Expression ${eq} evaluates to ${response.num}`);
    else
        console.log(`Expression ${eq} has been compiled to ${response.code}`);
    return response;
}

export function addVariableCompiler(name: string, content: string, exprIdx: number): number {
    variableMap.delete(name);

    const root = parseLatex(content);
    Ast.printTree(root);
    const val = processAst(root, exprIdx).num;
    if(val === undefined)
        throw Error(`The variable ${name} couldn't be evaluated to a value: ${content}`);

    variableMap.set(name, val);

    console.log(variableMap); //FIXME:

    return val;
}

export function addFunctionCompiler(name: string, content: string, exprIdx: number): Response {
    const fnName = name[0];
    const unknown = name[1];
    
    functionMap.delete(name);

    const root = parseLatex(content);
    const [x, y] = astUnknowns(root);
    if(!((x && unknown === 'x') || (y && unknown === 'y')))
        throw Error(`The function ${fnName} does not match its unknowns`);

    const response = processAst(root, exprIdx);
    if(response.num !== undefined)
        console.log(`Expression ${content} evaluates to ${response.num}`);
    else
        console.log(`Expression ${content} has been compiled to ${response.code}`);

    functionMap.set(fnName, root);

    console.log(functionMap); //FIXME:

    return response;
}
  
export function deleteFunctionCompiler(name: string): void {
    if(!functionMap.delete(name))
        throw Error(`Function ${name} wasn't deleted`);
}


export function deleteVariableCompiler(name: string): void {
    if(!variableMap.delete(name))
        throw Error(`Variable ${name} wasn't deleted`);
}

export function getVariableValue(name: string): number | undefined {
    return variableMap.get(name);
}

function processAst(root: Ast.Node, exprIdx: number) {
    const [rootTmp, numericValue] = simplifyTree(root);
    root = rootTmp;
    Ast.printTree(root);

    let response: Response;
    
    if(numericValue !== undefined) {
        response = {
            code: "",
            num: numericValue
        }
    } else {
        response = {
            code: compile(root, exprIdx)
        }
    }

    return response;
}