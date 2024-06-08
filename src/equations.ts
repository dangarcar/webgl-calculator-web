import numeral from "numeral";
import { UndefVariableBar } from "./variables";
import { deleteFunction, deleteVariable, processChangeEvent } from "./main";

//@ts-ignore this is a IDE error, because of it being an old JQuery library
const MQ = MathQuill.getInterface(2);

export const expressions : Map<number, EquationBox> = new Map();
export const functionSet: Map<string, number> = new Map();
export const variableSet: Map<string, number> = new Map();

export enum EditAction {
    ADD, REMOVE, REFRESH
}

const AUTO_FUNCTIONS = 'sin cos tan sec csc cosec cotan floor abs ceil log ln';
const AUTO_COMMANDS = 'pi theta sqrt sum rho phi lambda';

export const DEFAULT_MATH_CONFIG = {
    spaceBehavesLikeTab: true,
    autoCommands: AUTO_COMMANDS,
    autoOperatorNames: AUTO_FUNCTIONS,
    handlers: <any> null,
};

export class EquationBox {
    static currNumber = 0;
    static currHue = 0;
    static createNew(): EquationBox {
        const eq = new EquationBox(this.currNumber, this.currHue);
        expressions.set(this.currNumber, eq);

        const conf = DEFAULT_MATH_CONFIG;
        conf.handlers = { edit: eq.refresh };
        eq.mathField.config(conf);

        this.currNumber++;
        this.currHue = (this.currHue + 49) % 360;

        return eq;
    }
    
    number: number;
    color: string;
    drawable = false;
    visible = true;
    error = false;
    htmlElement: HTMLElement;
    mathField?: any;
    oldLatex: string;
    solutionBox?: HTMLElement;
    undefVarsBar: UndefVariableBar;
    code?: string;

    constructor(number: number, hue: number) {
        this.number = number;
        this.color = `hsl(${hue} 69% 69%)`;
        this.oldLatex = '';
        this.undefVarsBar = new UndefVariableBar([]);
        
        this.htmlElement = this.#createEqBox();
    }

    #createEqBox() {
        this.htmlElement = document.createElement('div');
        this.htmlElement.className = 'expr';
        this.htmlElement.id = 'eq-bar-' + this.number;
    
        const container = document.createElement('div');
        container.className = 'expr-container';
    
        const btn = document.createElement('div');
        btn.className = 'expr-button';
        btn.id = 'expr-button-' + this.number;
        container.append(btn);
    
        const span = document.createElement('span');
        span.className = 'math-field';
        this.mathField = MQ.MathField(span);
        container.append(span);
    
        const close = document.createElement('button');
        close.insertAdjacentHTML('beforeend', '<span><i class="fa-solid fa-xmark"></i></span>');
        close.className = 'close-button';
        close.addEventListener('click', this.close);
        container.append(close);
    
        this.htmlElement.append(container);
    
        const exprBottom = document.createElement('div');
        exprBottom.className = 'expr-bottom';

        this.solutionBox = document.createElement('span');
        this.solutionBox.className = 'solution-box';
        exprBottom?.appendChild(this.solutionBox);
        this.hideSolutionBox();

        exprBottom.append(this.undefVarsBar.html);

        this.htmlElement.append(exprBottom);

        return this.htmlElement;
    }
    
    close = async () => {
        const f = this.functionCharacter();
        const v = this.variableCharacter();

        if(f) {
            deleteFunction(f, this);
            functionSet.delete(f);
        }

        if(v) {
            deleteVariable(v, this);
            variableSet.delete(v);
        }

        this.htmlElement.remove();
        expressions.delete(this.number);
    }

    refresh = async () => {
        const latex = this.mathField.latex();
        
        let actionType;
        if(this.oldLatex.length < latex.length) 
            actionType = EditAction.ADD;
        else if(this.oldLatex == latex) 
            actionType = EditAction.REFRESH;
        else 
            actionType = EditAction.REMOVE;

        this.oldLatex = latex;

        processChangeEvent(this.number, latex, actionType);
    }

    focus() {
        this.mathField.focus();
    }

    toggleError() {
        const e = this.htmlElement.querySelector(".expr-button");

        const elems = e?.getElementsByTagName('i');
        if(elems) for(let i of elems) i.remove();
        
        if(this.error) {
            e?.insertAdjacentHTML('beforeend', `<i class="fa-solid fa-triangle-exclamation ${
                this.visible? "error-box":"error-box-inverted"
            }"></i>`);
        }
    }
    
    writeError(tooltip: any) {
        const e = this.htmlElement.querySelector(".expr-button");        
        this.error = true;

        const elems = e?.getElementsByTagName('i');
        if(elems) for(let i of elems) i.remove();

        e?.insertAdjacentHTML('beforeend', `<i class="fa-solid fa-triangle-exclamation ${
            this.visible? "error-box":"error-box-inverted"
        }" title="${tooltip}"></i>`);
    }

    /**
     * @throws An error if the function is named x, y or e
     * @returns The character of the name of the function or null otherwise
     */
    functionCharacter(): string | null {
        const fn = this.mathField.latex().match('[A-Za-z]\\\\left\\([x-y]\\\\right\\)=');
        if(!fn) 
            return null;
        
        const name = fn[0][0];
        if("xye".includes(name))
            throw Error(`A function can't be named ${name}, it's a reserved character`);
        if(variableSet.has(name))
            throw Error(`There is already a variable with that name: ${name}`);
        return name;
    }

    /**
     * @throws An error if the variable is named e
     * @returns The character of the name of the variable or null otherwise
     */
    variableCharacter(): string | null {
        const v = this.mathField.latex().match('[A-Za-z]=');
        if(!v) 
            return null;

        const name = v[0][0];
        if('xy'.includes(name)) 
            return null;
        if(name == 'e')
            throw Error("A variable can't be named e"); 
        if(functionSet.has(name))
            throw Error(`There's already a function with that name ${name}`);
        return name;
    }

    getVariables() {
        const fnName = this.functionCharacter();
        const varName = this.variableCharacter();

        const vars = Array.from(this.htmlElement.getElementsByTagName('var'))
                .filter(e => !e.classList.contains('mq-operator-name'))
                .map(e => e.textContent)
                .flatMap(e => e? e:[])
                .filter(e => !functionSet.has(e));
        
        if(fnName || varName)
            vars.splice(0, 1);

        return new Set(vars);
    }

    writeFunctionBrackets() {
        const cursor = this.htmlElement.querySelector(".mq-cursor");
        const prev = cursor?.previousElementSibling;
        if(prev && prev.classList.contains('mq-operator-name')) {
            this.mathField?.typedText('(');
        }
    }

    setSolutionValue(n: number) {
        if(!this.solutionBox) 
            throw Error("No solution box");
        this.solutionBox.style.display = 'inline';
        
        if(n > 0 && n < 1e-6) n = 0;
        this.solutionBox.textContent = numeral(n).format('0[.][000000]');
    }

    hideSolutionBox() {
        if(!this.solutionBox) 
            throw Error("No solution box");
        this.solutionBox.style.display = 'none';
    }

    /**
     * @returns The number of undefined variables
     */
    showUndefinedVariables(variables: Set<string>): number {
        const undefinedVariables = [...variables].filter(e => !variableSet.has(e))
            .filter(e => !"xye".includes(e));
        this.undefVarsBar.ofArray(undefinedVariables);
        return undefinedVariables.length;
    }

    setDrawable(drawable: boolean) {
        const btn = <HTMLDivElement> this.htmlElement.querySelector('.expr-button')!;

        if(drawable) {
            btn.style.background = this.color;
            btn.style.boxShadow = '0px 0px 5px 3px ' + this.color;
            btn.addEventListener('click', () => {
                this.visible = !this.visible;
                btn.style.background = this.visible? this.color : '#1d1d1d';
                this.toggleError();
            });
        } else {
            this.visible = false;
            btn.onclick = () => {};
            btn.style.background = 'transparent';
            btn.style.boxShadow = 'none';
        }

        this.drawable = drawable;
    }
}