import { getVariableValue } from './api';
import * as Ast from './ast';

export function simplifyTree(root: Ast.Node): [Ast.Node, number | undefined] {
    switch(root.type){
    case 'unknown':
        return [root, undefined];
    case 'constant':
        return [root, root.value];
    case 'variable':
        return [root, getVariableValue(root.name)];
    
    case 'unary':
        const [child, num] = simplifyTree(root.child);
        root.child = child;

        if(num !== undefined) {
            const f = Ast.UNARY_OP_FUNC_TABLE.get(root.op)!;
            root = Ast.createConstant(f(num));
            return [root, f(num)];
        } else {
            return [root, undefined];
        }
    
    case 'binary':
        const [left, lhs] = simplifyTree(root.left);
        root.left = left;
        
        const [right, rhs] = simplifyTree(root.right);
        root.right = right;

        if(lhs !== undefined && rhs !== undefined) {
            const f = Ast.BINARY_OP_FUNC_TABLE.get(root.op)!;
            root = Ast.createConstant(f(lhs, rhs));
            return [root, f(lhs, rhs)];
        } else if(rhs !== undefined && root.op === Ast.BinaryOps.Power) {
            if(rhs === 0)
                return [Ast.createConstant(1), 1];
            if(rhs === 1)
                return [root.left, undefined];
            else
                return [root, undefined];
        } else {
            return [root, undefined];
        }

    case 'nary':
        const childrenSimp = root.children.flatMap(e => {
            //@ts-ignore IDk why ts marks this
            if(e.type === 'nary' && e.op === root.op)
                return e.children;
            return [e];
        }).map(e => 
            simplifyTree(e)
        );

        //Push constants together
        const constValArr = childrenSimp
            .map(e => e[1])
            .filter(e => e !== undefined);

        //Remove constants from children
        let children = childrenSimp
            .filter(e => e[1] === undefined)
            .map(e => e[0]);

        //Add constants to children again
        if(constValArr.length > 0) {
            const f = Ast.BINARY_OP_FUNC_TABLE.get(root.op)!;
            const constVal = constValArr.reduce((prev, curr, _idx, _arr) => f(prev!, curr!));
            children.push(Ast.createConstant(constVal!));
        }

        if(root.op === Ast.BinaryOps.Add) {
            children = children.filter(e => 
                !(e.type === 'constant' && e.value === 0.0)
            );
        }else if(root.op === Ast.BinaryOps.Multiply) {
            if(children.some(e => e.type === 'constant' && e.value === 0.0)) {
                children = [];
            }

            children = children.filter(e => 
                !(e.type === 'constant' && e.value === 1.0)
            );
        }

        if(children.length === 0) {
            root = Ast.createConstant(0.0);
            return [root, 0.0];
        } else if(children.length === 1) {
            root = children[0];

            if(root.type === 'constant')
                return [root, root.value];
            else
                return [root, undefined];
        } else {
            root = Ast.createNary(root.op, children); 
            return [root, undefined];
        }
    }
}

// Substitute the unknowns of the tree by the variable
export function substituteFunc(root: Ast.Node, variable: Ast.Node): Ast.Node {
    switch(root.type) {
    case 'unknown':
        return variable;

    case 'unary': 
        const child = substituteFunc(root.child, variable);
        return Ast.createUnary(root.op, child);
    
    case 'binary':
        const left = substituteFunc(root.left, variable);
        const right = substituteFunc(root.right, variable);
        return Ast.createBinary(root.op, left, right);
    
    case 'nary': 
        const val = Ast.createNary(root.op, []);
        for(let c of root.children) {
            val.children.push(substituteFunc(c, variable));
        }
        return val;
    
    case 'constant':
    case 'variable':
        return root;
    }
}

export function deriveFunction(root: Ast.Node): Ast.Node {
    switch(root.type) {
    case 'unknown':
        return Ast.createConstant(1.0);
    
    case 'constant':
    case 'variable':
        return Ast.createConstant(0.0);

    case 'unary':
        return deriveUnaryFunction(root);

    case 'binary':
        switch(root.op) {
        case Ast.BinaryOps.Power:
            if(root.right.type === 'constant') { // a*f(x)^(a-1)*f'(x)
                return Ast.createNary(Ast.BinaryOps.Multiply, [
                    Ast.createConstant(root.right.value), // a
                    Ast.createBinary(Ast.BinaryOps.Power, // f(x)^(a-1)
                        root.left, // f(x)
                        Ast.createConstant(root.right.value - 1) // a-1
                    ),
                    deriveFunction(root.left), // f'(x)
                ]);
            } else { //f(x)^g(x) * (g'(x)*ln(f(x)) + g(x)*f'(x)/f(x))
                const chain = Ast.createNary(Ast.BinaryOps.Add, [
                    Ast.createNary(Ast.BinaryOps.Multiply, [ // g'(x)*ln(f(x))
                        deriveFunction(root.right),
                        Ast.createUnary(Ast.UnaryOps.Ln, root.left)
                    ]),
                    Ast.createNary(Ast.BinaryOps.Multiply, [ // g(x)* f'(x)/f(x)
                        root.right,
                        Ast.createBinary(Ast.BinaryOps.Division, 
                            deriveFunction(root.left), root.left
                        )
                    ]),
                ]);

                return Ast.createNary(Ast.BinaryOps.Multiply, [root, chain]);
            }

        case Ast.BinaryOps.Division: // (f'(x)*g(x) - f(x)*g'(x)) / g(x)^2
            const numerator = Ast.createNary(Ast.BinaryOps.Add, [
                Ast.createNary(Ast.BinaryOps.Multiply, [
                    deriveFunction(root.left), root.right
                ]),
                Ast.createUnary(Ast.UnaryOps.Minus, 
                    Ast.createNary(Ast.BinaryOps.Multiply, [
                        root.left, deriveFunction(root.right)
                    ])
                )
            ]);  
            return Ast.createBinary(Ast.BinaryOps.Division,
                numerator,
                Ast.createNary(Ast.BinaryOps.Multiply, [root.right, root.right])
            ) 

        default:
            throw Error("You can't derive an equal sign");
        }

    case 'nary':
        if(root.op === Ast.BinaryOps.Add) {
            const derivatives = root.children.map(e => deriveFunction(e));
            return Ast.createNary(root.op, 
                derivatives
            );
        } 
        else if(root.op === Ast.BinaryOps.Multiply) {
            const derivatives: Ast.NAry[] = [];
            for(let i=0; i<root.children.length; i++) {
                const product = [];
                for(let j=0; j<root.children.length; j++) {
                    if(i === j) {
                        product.push(deriveFunction(root.children[j]));
                    } else {
                        product.push(root.children[j]);
                    }
                }

                derivatives.push(Ast.createNary(Ast.BinaryOps.Multiply, product));
            }

            return Ast.createNary(Ast.BinaryOps.Add, 
                derivatives
            );
        } else {
            throw Error(`${root.op} is not a conmutative operation`);
        }
    }
}

function deriveUnaryFunction(root: Ast.Unary): Ast.Node {
    switch(root.op) {
    case Ast.UnaryOps.Minus:
        return root;

    case Ast.UnaryOps.Ln: // f'(x)/f(x)
        return Ast.createBinary(Ast.BinaryOps.Division,
            deriveFunction(root.child),
            root.child
        );

    case Ast.UnaryOps.Sin: // cos(f(x)) * f'(x)
        return Ast.createNary(Ast.BinaryOps.Multiply, [
            Ast.createUnary(Ast.UnaryOps.Cos, root.child),
            deriveFunction(root.child)
        ]);

    case Ast.UnaryOps.Cos: // -sin(x) * f'(x)
        return Ast.createNary(Ast.BinaryOps.Multiply, [
            Ast.createUnary(Ast.UnaryOps.Minus, 
                Ast.createUnary(Ast.UnaryOps.Sin, root.child)
            ),
            deriveFunction(root.child)
        ]);

    case Ast.UnaryOps.Tan: // 1 / cos(x)^2
        return Ast.createBinary(Ast.BinaryOps.Division, 
            Ast.createConstant(1.0),
            Ast.createNary(Ast.BinaryOps.Multiply, [root.child, root.child])
        );
    
    case Ast.UnaryOps.Sqrt: // f'(x) / 2*sqrt(f(x))
        return Ast.createBinary(Ast.BinaryOps.Division,
            deriveFunction(root.child),
            Ast.createNary(Ast.BinaryOps.Multiply, [
                Ast.createConstant(2.0),
                Ast.createUnary(Ast.UnaryOps.Sqrt, root.child)
            ])
        );
        
    case Ast.UnaryOps.Log: // f'(x) / ln10*f(x)
        return Ast.createBinary(Ast.BinaryOps.Division,
            deriveFunction(root.child),
            Ast.createNary(Ast.BinaryOps.Multiply, [
                Ast.createConstant(Math.LN10),
                Ast.createUnary(Ast.UnaryOps.Sqrt, root.child)
            ])
        )

    case Ast.UnaryOps.Floor:
    case Ast.UnaryOps.Abs:
    case Ast.UnaryOps.Ceil:
        throw Error(`Function ${root.op} is not derivable in R`);
    }
}