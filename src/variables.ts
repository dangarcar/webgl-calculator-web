import { EquationBox } from "./equations";

export class UndefVariableBar {
    #elements: Map<string, HTMLElement>;
    html: HTMLElement;

    constructor(array: string[]) {
        this.html = document.createElement('div');
        this.html.className = 'expr-variable-bar';

        this.#elements = new Map();
        this.ofArray(array);
    }

    #createVariableButton(name: string): HTMLElement {
        const btn = document.createElement('button');
        btn.className = 'expr-variable-btn';
        btn.textContent = name;

        btn.onclick = () => {
            this.delete(name);

            const box = EquationBox.createNew();
            box.mathField.write(`${name}=`);
            const sidebar = document.getElementById('sidebar');
            sidebar?.appendChild(box.htmlElement);
            box.focus();
        }

        return btn;
    }

    ofArray(array: string[]) {
        const toDelete = [...this.#elements.keys()].filter(e => !array.includes(e));
        const toAdd = array.filter(e => !this.#elements.has(e));

        for(const v of toDelete)
            this.delete(v);

        for(const v of toAdd)
            this.add(v);
    }

    delete(name: string) {
        const btn = this.#elements.get(name);
        btn?.remove();
        this.#elements.delete(name);
    }

    add(name: string) {
        const btn = this.#createVariableButton(name);
        this.#elements.set(name, btn);
        this.html.appendChild(btn);
    }
}