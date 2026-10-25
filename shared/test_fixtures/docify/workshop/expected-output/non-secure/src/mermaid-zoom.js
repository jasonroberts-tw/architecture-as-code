import Panzoom from '@panzoom/panzoom';

// Mermaid renders after hydration, and again when the colour mode changes,
// so new diagram SVGs are found by watching the page rather than once on load.
const DIAGRAM = 'div.docusaurus-mermaid-container > svg';

let observer;

export function onRouteDidUpdate() {
    observer ??= new MutationObserver(enableAll);
    observer.observe(document.body, { childList: true, subtree: true });
    enableAll();
}

function enableAll() {
    document.querySelectorAll(DIAGRAM).forEach(enableZoom);
}

function enableZoom(svg) {
    if (svg.dataset.zoom) return;
    svg.dataset.zoom = 'on';

    const panzoom = Panzoom(svg, { minScale: 1, maxScale: maxScale(svg), contain: 'outside' });
    // Ctrl/Cmd+wheel and trackpad pinch zoom the diagram; a plain wheel still scrolls the page.
    svg.addEventListener('wheel', (event) => {
        if (event.ctrlKey || event.metaKey) panzoom.zoomWithWheel(event);
    }, { passive: false });
    svg.addEventListener('dblclick', () => panzoom.reset());

    const container = svg.parentElement;
    const toolbar = document.createElement('div');
    toolbar.className = 'mermaid-zoom-toolbar';
    toolbar.append(
        button('+', 'Zoom in', () => panzoom.zoomIn()),
        button('−', 'Zoom out', () => panzoom.zoomOut()),
        button('⟲', 'Reset zoom', () => panzoom.reset()),
    );
    // iPhone Safari cannot show an element full screen, so it gets no button.
    if (document.fullscreenEnabled) {
        toolbar.append(fullScreenButton(container, svg, panzoom));
    }
    container.append(toolbar);
}

function fullScreenButton(container, svg, panzoom) {
    const toggle = button('⤢', 'Full screen', () => {
        if (document.fullscreenElement === container) document.exitFullscreen();
        else container.requestFullscreen();
    });
    container.addEventListener('fullscreenchange', () => {
        const label = document.fullscreenElement === container ? 'Exit full screen' : 'Full screen';
        toggle.title = label;
        toggle.setAttribute('aria-label', label);
        // The diagram's box changed size, so start again from the fitted view.
        panzoom.setOptions({ maxScale: maxScale(svg) });
        panzoom.reset();
    });
    return toggle;
}

// Lets readers reach twice the natural size, however far the column shrank the diagram.
function maxScale(svg) {
    const naturalWidth = Number(svg.getAttribute('viewBox')?.split(/[\s,]+/)[2]);
    const ratio = (2 * naturalWidth) / svg.getBoundingClientRect().width;
    return Number.isFinite(ratio) ? Math.max(4, ratio) : 4;
}

function button(label, title, onClick) {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = label;
    element.title = title;
    element.setAttribute('aria-label', title);
    element.addEventListener('click', onClick);
    return element;
}
