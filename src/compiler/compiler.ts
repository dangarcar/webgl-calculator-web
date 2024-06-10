import { getVariableValue } from './api';
import * as Ast from './ast';

export function compile(root: Ast.Node, exprIdx: number): string {
    const unknowns = astUnknowns(root);
    if(unknowns[0] === false && unknowns[1] === false)
        throw Error("This equation doesn't have any unknowns");

    const denominators: string[] = [];
    let code = "";
    
    if(root.type === 'binary' && root.op === Ast.BinaryOps.Equal) {
        console.log("The equation has an equal sign");

        const left = _compile(root.left, denominators, exprIdx);
        const right = _compile(root.right, denominators, exprIdx);

        code = `${left} - ${right}`;
    } else {
        const compiled = _compile(root, denominators, exprIdx);

        if(unknowns[0] === false)
            code = `${compiled} - x`;
        if(unknowns[1] === false)
            code = `${compiled} - y`;
    }
    
    return handleDenominators(code, denominators, exprIdx);
}

function _compile(root: Ast.Node, denominators: string[], exprIdx: number): string {
    switch(root.type) {
        case 'constant':
            return `float(${root.value})`;

        case 'variable':
            const v = getVariableValue(root.name);
            if(!v)
                throw Error(`There are no variables called ${root.name}`);
            return `float(${v})`;

        case 'unknown':
            return root.name;

        case 'unary':
            const compiledChild = _compile(root.child, denominators, exprIdx);

            switch(root.op) {
                //Std functions
                case Ast.UnaryOps.Minus: return `-${compiledChild}`;
                case Ast.UnaryOps.Sin: return `sin(${compiledChild})`;
                case Ast.UnaryOps.Cos: return `cos(${compiledChild})`;
                case Ast.UnaryOps.Floor: return `floor(${compiledChild})`;
                case Ast.UnaryOps.Abs: return `abs(${compiledChild})`;
                case Ast.UnaryOps.Ceil: return `ceil(${compiledChild})`;
                
                //Custom functions
                case Ast.UnaryOps.Log: return `log10(${compiledChild})`;
                case Ast.UnaryOps.Ln: return `ln(${compiledChild})`;
                case Ast.UnaryOps.Sqrt: return `sqrtf(${compiledChild})`;
                case Ast.UnaryOps.Tan: return compileDiv(`sin(${compiledChild})`, `cos(${compiledChild})`, denominators, exprIdx);
            }

        case 'binary':
            const compiledLeft = _compile(root.left, denominators, exprIdx);
            const compiledRight = _compile(root.right, denominators, exprIdx);

            switch(root.op) {
                case Ast.BinaryOps.Division:
                    return compileDiv(compiledLeft, compiledRight, denominators, exprIdx);
                
                case Ast.BinaryOps.Power:
                    if(root.right.type === 'constant' && Number.isInteger(root.right.value)) 
                        return compilePowInteger(compiledLeft, root.right.value, denominators, exprIdx);
                    else
                        return `pow(${compiledLeft}, ${compiledRight})`;

                case Ast.BinaryOps.Equal:
                    throw Error("Equal is not an operation in this context");
                
                default: 
                    throw Error("wtf?");
            }

        case 'nary':
            const op = (root.op === Ast.BinaryOps.Add)? "+": "*";

            if(root.children.length < 2)
                throw Error(`A ${root.op} cannot be of less than two terms`);
        
            let code = _compile(root.children[0], denominators, exprIdx);

            for(let i=1; i<root.children.length; i++) {
                code += ` ${op} ${_compile(root.children[i], denominators, exprIdx)}`;
            }

            return `(${code})`;
    }
}

function compileDiv(num: string, den: string, denominators: string[], exprIdx: number): string {
    denominators.push(den);
    return `(${num} / var_${exprIdx}_${denominators.length-1})`;
}

function compilePowInteger(code: string, times: number, denominators: string[], exprIdx: number): string {
    if(times === 0)
        return "1.0";
    else if(times < 0)
        return compileDiv(
            "1.0", 
            compilePowInteger(code, Math.abs(times), denominators, exprIdx), 
            denominators, exprIdx
        );
    else if(times === 1)
        return code;
    else if(times === 2)
        return `${code} * ${code}`;
    else 
        return `${code} * ${compilePowInteger(code, times-1, denominators, exprIdx)}`;
}

function handleDenominators(code: string, denominators: string[], exprIdx: number):string {
    if(denominators.length > 32) 
        throw Error("A function can't have more than 32 denominators");

    let dens = '';
    for(let i in denominators) {
        dens += `
        float var_${exprIdx}_${i} = ${denominators[i]};
        ret.y <<= 1;
        ret.y |= int(fneg(var_${exprIdx}_${i}));`
    }

    console.log(dens)

    return `${dens}
        ret.x = int(fneg(${code}));`;
}

export function astUnknowns(root: Ast.Node): [boolean, boolean] {
    switch(root.type) {
    case 'unknown':
        return [root.name === 'x', root.name === 'y'];    

    case 'unary':
        return astUnknowns(root.child);

    case 'binary':
        const l = astUnknowns(root.left);
        const r = astUnknowns(root.right);
        return [l[0] || r[0],   l[1] || r[1]];

    case 'nary':
        let ret: [boolean, boolean] = [false, false];
        for(let e of root.children) {
            const a = astUnknowns(e);
            ret = [ret[0] || a[0],  ret[1] || a[1]];
        }
        return ret;

    default:
        return [false, false];
    }
}