// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// @panzoom/panzoom is installed by the generated Docusaurus site, not by this monorepo.
const panzoom = vi.hoisted(() => {
    const instance = { zoomIn: vi.fn(), zoomOut: vi.fn(), reset: vi.fn(), zoomWithWheel: vi.fn() };
    return { instance, Panzoom: vi.fn<(element: Element, options: object) => typeof instance>(() => instance) };
});
vi.mock('@panzoom/panzoom', () => ({ default: panzoom.Panzoom }));

// @ts-expect-error - plain JS client module that is copied into generated Docusaurus sites
import { onRouteDidUpdate } from './mermaid-zoom.js';

function addDiagram(viewBox = '0 0 2000 1000'): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'docusaurus-mermaid-container';
    container.innerHTML = `<svg viewBox="${viewBox}"></svg>`;
    document.body.append(container);
    return container;
}

const flushObserver = () => new Promise((resolve) => setTimeout(resolve));

describe('mermaid-zoom client module', () => {
    // jsdom empties the page on teardown, which would fire the module's observer after `document` is gone.
    const observers: MutationObserver[] = [];
    vi.stubGlobal('MutationObserver', class extends MutationObserver {
        constructor(callback: MutationCallback) {
            super(callback);
            observers.push(this);
        }
    });
    afterAll(() => observers.forEach((observer) => observer.disconnect()));

    beforeEach(() => {
        document.body.innerHTML = '';
        vi.clearAllMocks();
    });

    it('adds pan/zoom and a toolbar to a diagram already on the page', () => {
        const container = addDiagram();

        onRouteDidUpdate();

        expect(panzoom.Panzoom).toHaveBeenCalledTimes(1);
        expect(panzoom.Panzoom.mock.calls[0][0]).toBe(container.querySelector('svg'));
        expect(container.querySelectorAll('.mermaid-zoom-toolbar button')).toHaveLength(3);
    });

    it('adds pan/zoom to a diagram that Mermaid renders after the route update', async () => {
        onRouteDidUpdate();
        const container = addDiagram();
        await flushObserver();

        expect(panzoom.Panzoom).toHaveBeenCalledTimes(1);
        expect(container.querySelector('.mermaid-zoom-toolbar')).not.toBeNull();
    });

    it('does not add pan/zoom twice to the same diagram', async () => {
        const container = addDiagram();
        onRouteDidUpdate();
        onRouteDidUpdate();
        await flushObserver();

        expect(panzoom.Panzoom).toHaveBeenCalledTimes(1);
        expect(container.querySelectorAll('.mermaid-zoom-toolbar')).toHaveLength(1);
    });

    it('adds pan/zoom again when Mermaid replaces the diagram on a colour mode change', async () => {
        const container = addDiagram();
        onRouteDidUpdate();

        container.innerHTML = '<svg viewBox="0 0 2000 1000"></svg>';
        await flushObserver();

        expect(panzoom.Panzoom).toHaveBeenCalledTimes(2);
        expect(container.querySelectorAll('.mermaid-zoom-toolbar')).toHaveLength(1);
    });

    it('ignores Mermaid containers without an SVG', () => {
        const container = document.createElement('div');
        container.className = 'docusaurus-mermaid-container';
        document.body.append(container);

        onRouteDidUpdate();

        expect(panzoom.Panzoom).not.toHaveBeenCalled();
    });

    it('zooms on Ctrl/Cmd+wheel but leaves a plain wheel to scroll the page', () => {
        const svg = addDiagram().querySelector('svg')!;
        onRouteDidUpdate();

        svg.dispatchEvent(new WheelEvent('wheel', { deltaY: -100 }));
        expect(panzoom.instance.zoomWithWheel).not.toHaveBeenCalled();

        svg.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, ctrlKey: true }));
        svg.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, metaKey: true }));
        expect(panzoom.instance.zoomWithWheel).toHaveBeenCalledTimes(2);
    });

    it('wires the toolbar buttons and double-click to zoom in, zoom out and reset', () => {
        const container = addDiagram();
        onRouteDidUpdate();
        const [zoomIn, zoomOut, reset] = container.querySelectorAll('button');

        zoomIn.click();
        zoomOut.click();
        reset.click();
        container.querySelector('svg')!.dispatchEvent(new MouseEvent('dblclick'));

        expect(panzoom.instance.zoomIn).toHaveBeenCalledTimes(1);
        expect(panzoom.instance.zoomOut).toHaveBeenCalledTimes(1);
        expect(panzoom.instance.reset).toHaveBeenCalledTimes(2);
        expect(reset.getAttribute('aria-label')).toBe('Reset zoom');
    });

    it('lets a shrunken diagram zoom to twice its natural size', () => {
        const svg = addDiagram('0 0 2000 1000').querySelector('svg')!;
        svg.getBoundingClientRect = () => ({ width: 400 }) as DOMRect;

        onRouteDidUpdate();

        expect(panzoom.Panzoom.mock.calls[0][1]).toMatchObject({ minScale: 1, maxScale: 10 });
    });

    it('falls back to a 4x zoom limit when the diagram size is unknown', () => {
        addDiagram('');

        onRouteDidUpdate();

        expect(panzoom.Panzoom.mock.calls[0][1]).toMatchObject({ maxScale: 4 });
    });
});
