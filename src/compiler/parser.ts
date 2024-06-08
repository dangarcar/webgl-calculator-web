import * as Parser from '@unified-latex/unified-latex-types';
import { parseMath } from "@unified-latex/unified-latex-util-parse";
import * as Ast from './ast';
import { functionMap } from './api';
import { deriveFunction, simplifyTree, substituteFunc } from './simplifier';

export function parseLatex(eq: string): Ast.Node {
    if(eq.includes('=')) {
        const split = eq.split('=');

        if(split.length > 2)
            throw Error("There can't be more than one equal sign");
        
        const lhs = parseLatex(split[0]);
        const rhs = parseLatex(split[1]);

        return Ast.createBinary(Ast.BinaryOps.Equal, lhs, rhs);
    } else {
        const tokens = tokenizeString(eq);        
        console.log(tokens) //FIXME: 

        const root = buildTree(tokens);
        return root;
    }
}
        
function buildTree(tokens: Parser.Node[]): Ast.Node {
    const terms = getTerms(tokens);
    if(terms.length === 0)
        throw Error("Empty error");

    const termTrees = terms.map(t => {
        if(t[0].type === "string" && t[0].content === "-")
            return Ast.createUnary(Ast.UnaryOps.Minus, buildTerm(t.slice(1)));
        else
            return buildTerm(t);
    });

    if(termTrees.length === 1)
        return termTrees[0];
    else
        return Ast.createNary(Ast.BinaryOps.Add, termTrees);
}

function buildTerm(tokens: Parser.Node[]): Ast.Node {
    let factors: Ast.Node[] = [];
    let index = 0;
    while(index < tokens.length) {
        const [result, i] = buildFactor(tokens, index);
        factors.push(result);
        index = i;
    }

    switch(factors.length) {
    case 0: 
        throw Error("Empty error");
    case 1: 
        return factors[0];
    default: 
        return Ast.createNary(Ast.BinaryOps.Multiply, factors);
    }
}

function buildFactor(tokens: Parser.Node[], index: number): [Ast.Node, number] {
    const token = tokens[index];
    index++;

    let node: Ast.Node;
    switch(token.type) {
    case 'group':
        node = buildTree(token.content);
        break;
    
    case 'macro':
        if(token.content == "pi"){
            node = Ast.createConstant(Math.PI);
            break;
        }

        const op = Ast.OP_NAME_TABLE.get(token.content)!;
        if(op < Ast.startUnary) { //Binary
            const [lhs, l] = buildFactor(tokens, index);
            index = l;
            const [rhs, r] = buildFactor(tokens, index);
            index = r;

            node = Ast.createBinary(<Ast.BinaryOps> op, lhs, rhs);
        } else { //Unary
            const [child, i] = buildFactor(tokens, index);
            index = i;

            node = Ast.createUnary(<Ast.UnaryOps> op, child);
        }
        break;
    
    case 'string':
        if(!isNaN(parseFloat(token.content))) {
            node = Ast.createConstant(parseFloat(token.content));
        } else if(token.content === 'e') {
            node = Ast.createConstant(Math.E);
        } else if(token.content === 'x' || token.content === 'y') {
            node = Ast.createUnknown(token.content);
        } else if(functionMap.has(token.content)) {
            let derivateLevel = 0;
            while(tokens[index].type == 'string') {
                if((<Parser.String>tokens[index]).content == "'") {
                    derivateLevel++;
                    index++;
                }
            }

            let [child, i] = buildFactor(tokens, index);
            index = i;

            let func = functionMap.get(token.content);
            if(!func)
                throw Error(`The aren't any functions called ${token.content}`);

            let f = func!;
            for(let i=0; i<derivateLevel; ++i) {
                const [node, _tmp] = simplifyTree(deriveFunction(f));
                f = node;
                Ast.printTree(f); //FIXME:
            }

            console.log(`function ${token.content}`);
            console.log(child);

            node = substituteFunc(f, child);
        } else {
            node = Ast.createVariable(token.content);
        }
        break;
    
    default:
        throw Error(`Unknown type ${token.type}`);
    }

    let nextNode = node;
    if(tokens[index] !== undefined) { // Handle exponentiation
        const t = tokens[index];
        if(t.type === 'string' && t.content === EXP_SYMBOL) {
            index++;
            const [right, i] = buildFactor(tokens, index);
            index = i;
            
            nextNode = Ast.createBinary(Ast.BinaryOps.Power, node, right);
        }
    }

    return [nextNode, index];
}

function getTerms(tokens: Parser.Node[]): Parser.Node[][] {
    const symbols = tokens
        .map((e, i) => <[Parser.Node, number]> [e, i])
        .filter(v => {
            if(v[0].type === "string") {
                return (v[0].content == '+') || (v[0].content == '-');
            }

            return false;
        })

    let terms: Parser.Node[][] = [];

    let i = 0;
    for(let e of symbols) {
        if((<Parser.String> tokens[i]).content == '+') 
            i++;
        terms.push(tokens.slice(i, e[1]));

        i = e[1];
    }

    if((<Parser.String> tokens[i]).content == '+') 
        i++;
    terms.push(tokens.slice(i));

    return terms.filter(t => t[0] != undefined);
}

export const EXP_SYMBOL = '?';

function tokenizeString(eq: string): Parser.Node[] {
    eq = sanitizeString(eq);

    const latexDoc = parseMath(eq);

    console.log(latexDoc);

    return filterTokenStream(latexDoc);
}

function filterTokenStream(tokens: Parser.Node[]): Parser.Node[] {
    let filtered = tokens
        .filter(e => e.type !== "whitespace") //Remove whitespaces
        .filter(e => (e.type === "macro")? (e.content !== "cdot") : true) //Remove multiply symbols
    
    for(let v of filtered) {
        if(v.type === "group") {
            v.content = filterTokenStream(v.content)
        }
    }

    const splitStream: Parser.Node[] = [];
    for(let e of filtered) {
        if(e.type === "string" && isNaN(parseFloat(e.content))) {
            for(let i=0; i<e.content.length; i++) {
                const node: Parser.Node = <Parser.String> { type: "string", content: e.content[i] };
                splitStream.push(node);
            }
        } else {
            splitStream.push(e);
        }
    }

    return splitStream;
}

function sanitizeString(eq: string): string {
    eq = eq.replace(/\^/g, EXP_SYMBOL);

    //Replace \operatorname{name} with \name for simplicity
    while(eq.includes("operatorname{")) {
        const i = eq.indexOf("operatorname{");
        if(eq.includes("}")) {
            const j = eq.indexOf("}");
            const name = eq.substring(i + "operatorname{".length, j);
            eq = eq.substring(0, i) + name + eq.substring(j+1);
        } else {
            throw Error("Missing '}'");
        }
    }
    
    //For simplicity in the parser library, as {} are recognized as groups
    eq = eq.replace(/\\left\(/g, "{");
    eq = eq.replace(/\\right\)/g, "}");

    for(let i=1; i<eq.length; i++) {
        if('0' <= eq[i-1] && eq[i-1] <= '9'
        && eq[i].match(/[a-zA-Z]/i)) {
            eq = eq.slice(0, i) + "\\cdot " + eq.slice(i);
        }
    }

    return `{${eq}}`;
}
