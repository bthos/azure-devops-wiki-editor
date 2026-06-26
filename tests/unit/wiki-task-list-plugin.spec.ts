/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from 'vitest';

import { isTaskListCheckboxHit } from '../../src/editor/wiki-task-list-plugin';

function mockLiRect(li: HTMLElement, left: number, width = 400): void {
    vi.spyOn(li, 'getBoundingClientRect').mockReturnValue({
        left,
        top: 0,
        width,
        height: 24,
        right: left + width,
        bottom: 24,
        x: left,
        y: 0,
        toJSON: () => ({}),
    } as DOMRect);
}

describe('isTaskListCheckboxHit', () => {
    it('returns true only inside the left padding gutter', () => {
        document.body.innerHTML =
            '<ul><li data-checked="false" style="padding-left:24px;width:320px">Task text here</li></ul>';
        const li = document.querySelector('li')!;
        mockLiRect(li, 100);

        expect(isTaskListCheckboxHit(li, 108)).toBe(true);
        expect(isTaskListCheckboxHit(li, 100)).toBe(true);
        expect(isTaskListCheckboxHit(li, 124)).toBe(true);

        expect(isTaskListCheckboxHit(li, 125)).toBe(false);
        expect(isTaskListCheckboxHit(li, 200)).toBe(false);
    });
});
