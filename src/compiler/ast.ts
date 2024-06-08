declare interface BaseNode {
    type: string
}

export declare type Node = Constant | Variable | Unknown | Unary | Binary | NAry;

export declare interface Constant extends BaseNode {
    type: "constant",
    value: number
}
export function createConstant(value: number): Constant {
    return {
        type: "constant",
        value,
    }
}

export declare interface Variable extends BaseNode {
    type: "variable",
    name: string,
}
export function createVariable(name: string): Variable {
    return {
        type: "variable",
        name,
    }
}

export declare interface Unknown extends BaseNode {
    type: "unknown",
    name: string
}
export function createUnknown(name: string): Unknown {
    return {
        type: "unknown",
        name,
    }
}

export declare interface Unary extends BaseNode {
    type: "unary",
    op: UnaryOps,

    child: Node,
}
export function createUnary(op: UnaryOps, child: Node): Unary {
    return {
        type: "unary", 
        op, child,
    }
}

export declare interface Binary extends BaseNode {
    type: "binary",
    op: BinaryOps,

    left: Node,
    right: Node,
}
export function createBinary(op: BinaryOps, left: Node, right: Node): Binary {
    return {
        type: "binary",
        op, left, right,
    }
} 

export declare interface NAry extends BaseNode {
    type: "nary",
    op: BinaryOps,

    children: Node[],
}
export function createNary(op: BinaryOps, children: Node[]): NAry {
    return {
        type: "nary",
        op, children,
    }
}

export const startUnary = 1000;
export enum UnaryOps {
    Minus = 1000, 
    Sin, 
    Cos, 
    Tan, 
    Floor, 
    Abs, 
    Ceil, 
    Log, 
    Ln, 
    Sqrt
};

export enum BinaryOps {
    Add = 0, 
    Multiply, 
    Division, 
    Power, 
    Equal    
}

export const OP_NAME_TABLE = new Map<string, BinaryOps | UnaryOps>([
    ["+", BinaryOps.Add],
    ["-", UnaryOps.Minus],
    ["?",  BinaryOps.Power],
    
    ["frac", BinaryOps.Division],
    ["sin", UnaryOps.Sin], 
    ["cos", UnaryOps.Cos],
    ["tan", UnaryOps.Tan],
    ["floor", UnaryOps.Floor], 
    ["abs", UnaryOps.Abs], 
    ["ceil", UnaryOps.Ceil],
    ["log", UnaryOps.Log],
    ["ln", UnaryOps.Ln], 
    ["sqrt", UnaryOps.Sqrt],
]);

export const UNARY_OP_FUNC_TABLE = new Map<UnaryOps, (a: number) => number>([
    [UnaryOps.Minus, a => -a], 
    [UnaryOps.Sin, a => Math.sin(a)], 
    [UnaryOps.Cos, a => Math.cos(a)], 
    [UnaryOps.Tan, a => Math.tan(a)], 
    [UnaryOps.Floor, a => Math.floor(a)], 
    [UnaryOps.Abs, a => Math.abs(a)], 
    [UnaryOps.Ceil, a => Math.ceil(a)], 
    [UnaryOps.Log, a => Math.log10(a)], 
    [UnaryOps.Ln, a => Math.log(a)], 
    [UnaryOps.Sqrt, a => Math.sqrt(a)]
]);

export const BINARY_OP_FUNC_TABLE = new Map<BinaryOps, (a: number, b: number) => number>([
    [BinaryOps.Add, (a,b) => a+b], 
    [BinaryOps.Multiply, (a,b) => a*b], 
    [BinaryOps.Division, (a,b) => a/b], 
    [BinaryOps.Power, (a,b) => Math.pow(a,b)],  
]);

export function printTree(root: Node): void {
    console.log(_printTree("", root, true, "-Root\n"));
}

function _printTree(prefix: string, root: Node, last: boolean, output: string): string {
    output += `${prefix}${last? "└──":"├──"} ${printNode(root)}\n`;

    const newPrefix = prefix + (last? "    " : "|   "); 
    switch(root.type) {
    case "unary":
        output = _printTree(newPrefix, root.child, true, output);
        break;
    case "binary":
        output = _printTree(newPrefix, root.left, false, output);
        output = _printTree(newPrefix, root.right, true, output);
        break;
    case "nary":
        for(let i=0; i<root.children.length; i++) {
            output = _printTree(newPrefix, root.children[i], i==(root.children.length-1), output);
        }
        break;
        
    default:
    }

    return output;
}

function printNode(node: Node): string {
    switch(node.type) {
    case "nary":
    case "binary": 
        return `${node.type}: ${BinaryOps[node.op]}`;
    
    case "unary":
        return `unary: ${UnaryOps[node.op]}`;

    case "constant":
        return `constant: ${node.value}`;
    
    case "variable":
    case "unknown":
        return `${node.type}: ${node.name}`;
    }
}

/*declare type UnaryOp =  (a: number) => number;
declare type BinaryOp = (a: number, b: number) => number;*/

/*const Minus: UnaryOp = a => -a;
const Add: BinaryOp = (a, b) => a + b;*/