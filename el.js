/**
 * Functions for creating elements
 */

function E(tag, o) {
    let e = document.createElement(tag);

    if (o) {
        for (let prop in o) {
            if (prop === 'child' || prop === 'children') continue;
            if (prop === 'click') continue;
            e[prop] = o[prop];
        }
        if (o.child) {
            o.children = [o.child];
        }
        if (o.children) {
            o.children.forEach(c => e.appendChild(c));
        }

        if (o.click) {
            e.addEventListener('click', o.click);
        }
    }
    return e;
}

