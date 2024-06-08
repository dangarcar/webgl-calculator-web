import { returnHome } from "./background";
import { addFunctionCompiler, addVariableCompiler, deleteFunctionCompiler, deleteVariableCompiler, processCompiler } from "./compiler/api";
import { EditAction, EquationBox, expressions, functionSet, variableSet } from "./equations";
import { draw } from "./renderer";

const moreBtn = document.getElementById("more");
const sidebar = document.getElementById("sidebar");
moreBtn?.addEventListener("click", () => {
    const eq = EquationBox.createNew();
    sidebar?.appendChild(eq.htmlElement);
    
    eq.htmlElement.addEventListener('keydown', e => {
        if(e.key == "ArrowUp") {
            const i = [...expressions.keys()].indexOf(eq.number) - 1;
            if(i >= 0) 
                [...expressions.values()][i]?.focus();
        } else if(e.key == "ArrowDown") {
            const i = [...expressions.keys()].indexOf(eq.number) + 1;
            if(i < expressions.size) 
                [...expressions.values()][i]?.focus();
        }
    });
    
    eq.focus();
    draw();
});

const homeBtn = document.getElementById('home');
homeBtn?.addEventListener('click', returnHome);

window.addEventListener('DOMContentLoaded', () => {
    draw();
})

export function processChangeEvent(id: number, latex: string, action: EditAction) {
    const eq = expressions.get(id);

    if(!eq) throw Error("There isn't any equations to edit");
    //Suppose there aren't any errors right now, we'll discover them later
    eq.error = false;

    //Suppose this equation has no code
    eq.code = undefined;

    if(action == EditAction.ADD)
        eq.writeFunctionBrackets();

    let exprIdx = Array.from(expressions, ([_k, v]) => v.number)
        .findIndex(eId => eId == id);

    let variables: Set<string>;
    try {
        const varName = eq.variableCharacter();
        const fnName = eq.functionCharacter(); 
        variables = eq.getVariables();

        if(eq.showUndefinedVariables(variables) > 0) {
            eq.toggleError();
            return;
        }

        if(varName) {
            eq.hideSolutionBox();
            if(variableSet.has(varName) && variableSet.get(varName) !== id)
                throw Error("There's already a function with this name");

            eq.setDrawable(false);

            variableSet.set(varName, id);
            const val = addVariable(varName, eq, latex.substring(2), action, exprIdx);
            eq.setSolutionValue(val!);
            eq.toggleError();
            return;
        } else {
            eq.setDrawable(true);
        }

        if(fnName) {
            if(functionSet.has(fnName) && functionSet.get(fnName) !== id)
                throw Error("There's already a function with this name");

            if([...variables].some(e => e == fnName))
                throw Error("A variable can't be called like a function");
            
            variables.delete(fnName);
            eq.showUndefinedVariables(variables)

            functionSet.set(fnName, id);
            addFunction(fnName, latex, eq, action, exprIdx);
            eq.toggleError();
            return;
        }
    } catch (error) {
        console.warn(error);
        eq.writeError(error);
        return;
    }

    try {
        const response = processCompiler(latex, exprIdx);

        if(response.num !== null && response.num !== undefined) {
            eq.setSolutionValue(response.num);
        } else {
            eq.hideSolutionBox();

            eq.code = response.code;
        }

        draw();
    } catch(error) {
        console.warn(error);
        eq.writeError(error);
        return;
    }

    eq.toggleError();
}

function addFunction(fnName: string, latex: string, eq: EquationBox, action: EditAction, exprIdx: number) {
    const code = latex.substring(latex.indexOf('=')+1);
    const unknown = Math.min(latex.indexOf('x')>0? latex.indexOf('x'):1e9, latex.indexOf('y')>0? latex.indexOf('y'):1e9);

    try {
        fnName += latex[unknown]!;
        const response = addFunctionCompiler(fnName, code, exprIdx);

        if(action != EditAction.REFRESH)
            for(let id of expressions.keys())
                if(id != eq.number)
                    expressions.get(id)?.refresh();

        eq.code = response.code;
        draw();
    } catch(error) {
        console.warn(error);
        eq.writeError(error);
        return;
    }
}

export function deleteFunction(fnName: string, eq: EquationBox) {
    try {
        deleteFunctionCompiler(fnName);
        expressions.forEach(e => e.refresh());

    } catch (error) {
        console.warn(error);
        eq.writeError(error);
    }
}

function addVariable(varName: string, eq: EquationBox, latex: string, action: EditAction, exprIdx: number) {
    const vars = eq.getVariables();
    if(vars.has('x') || vars.has('y')) {
        eq.writeError(new Error("A variable can't have x nor y because it has to be constant"));
        return;
    }
    
    try {
        const val = addVariableCompiler(varName, latex, exprIdx);
        if(action != EditAction.REFRESH)
            expressions.forEach(e => e.refresh());
        
        return val;
    } catch(error) {
        console.warn(error);
        eq.writeError(error);
    }
}

export function deleteVariable(varName: string, eq: EquationBox) {
    try {
        deleteVariableCompiler(varName);
        expressions.forEach(e => e.refresh());

    } catch (error) {
        console.warn(error);
        eq.writeError(error);
    }
}
