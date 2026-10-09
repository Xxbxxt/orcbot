import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    formatBreadcrumbs,
    getAppVersion,
    isSplashShown,
    resetSplashState,
    renderSplash,
    renderCompactHeader,
    renderScreenHeader,
    clearScreen,
    banner,
} from '../src/cli/ui/Header';

describe('Header UI Component', () => {
    beforeEach(() => {
        resetSplashState();
        vi.restoreAllMocks();
    });

    describe('formatBreadcrumbs', () => {
        it('formats single screen title with cyan bold accent', () => {
            const result = formatBreadcrumbs('Tools Manager');
            expect(result).toContain('Tools Manager');
            // Contains cyan ANSI code
            expect(result).toContain('\x1b[96m');
        });

        it('formats nested breadcrumbs with parent and child separation', () => {
            const result = formatBreadcrumbs(['Tools', 'Approve']);
            expect(result).toContain('Tools');
            expect(result).toContain('Approve');
            expect(result).toContain('›');
        });

        it('handles empty breadcrumbs gracefully', () => {
            const result = formatBreadcrumbs([]);
            expect(result).toBe('');
        });
    });

    describe('Splash gatekeeper', () => {
        it('tracks whether splash has been shown', () => {
            expect(isSplashShown()).toBe(false);
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            renderSplash();
            expect(isSplashShown()).toBe(true);
            expect(consoleSpy).toHaveBeenCalled();
        });

        it('renderSplash does not re-render full ASCII art on second call unless forced', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            renderSplash();
            const firstCallCount = consoleSpy.mock.calls.length;
            expect(firstCallCount).toBeGreaterThan(5); // ASCII logo + taglines

            consoleSpy.mockClear();
            renderSplash(); // second call without force
            const secondCallCount = consoleSpy.mock.calls.length;
            // Should be compact (2-3 lines), not full ASCII art (10+ lines)
            expect(secondCallCount).toBeLessThan(firstCallCount);
        });

        it('banner() delegates to splash on first call and compact header on subsequent calls', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            banner();
            expect(isSplashShown()).toBe(true);

            consoleSpy.mockClear();
            banner(); // second call
            const calls = consoleSpy.mock.calls.flat().join(' ');
            expect(calls).toContain('orcbot');
            // Shouldn't contain the big ASCII block lines
            expect(calls).not.toContain('██████╗');
        });
    });

    describe('renderScreenHeader', () => {
        const originalIsTTY = process.stdout.isTTY;

        /** isTTY is absent, not merely falsy, when stdout is piped. */
        function setTTY(value: boolean | undefined) {
            Object.defineProperty(process.stdout, 'isTTY', { value, configurable: true, writable: true });
        }

        afterEach(() => {
            setTTY(originalIsTTY);
        });

        it('outputs breadcrumb header and separator rule', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
            setTTY(true);

            renderScreenHeader(['Home', 'Settings'], { clear: true });

            expect(stdoutSpy).toHaveBeenCalledWith('\x1b[H\x1b[2J');
            const output = consoleSpy.mock.calls.flat().join(' ');
            expect(output).toContain('orcbot');
            expect(output).toContain('Home');
            expect(output).toContain('Settings');
        });

        it('can skip clear sequence when clear is false', () => {
            vi.spyOn(console, 'log').mockImplementation(() => {});
            const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
            setTTY(true);

            renderScreenHeader('Status', { clear: false });
            expect(stdoutSpy).not.toHaveBeenCalledWith('\x1b[H\x1b[2J');
        });

        it('emits no escape codes when stdout is not a TTY, but still prints the header', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
            setTTY(undefined);

            renderScreenHeader('Status', { clear: true });

            expect(stdoutSpy).not.toHaveBeenCalledWith('\x1b[H\x1b[2J');
            expect(consoleSpy.mock.calls.flat().join(' ')).toContain('orcbot');
        });
    });

    describe('clearScreen', () => {
        const originalIsTTY = process.stdout.isTTY;

        afterEach(() => {
            Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, configurable: true, writable: true });
        });

        it('writes the clear sequence on a TTY', () => {
            const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
            Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true, writable: true });

            clearScreen();

            expect(stdoutSpy).toHaveBeenCalledWith('\x1b[H\x1b[2J');
        });

        it('is a no-op when stdout is not a TTY', () => {
            const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
            Object.defineProperty(process.stdout, 'isTTY', { value: undefined, configurable: true, writable: true });

            clearScreen();

            expect(stdoutSpy).not.toHaveBeenCalled();
        });
    });

    describe('getAppVersion', () => {
        it('returns a non-empty semantic version string', () => {
            const ver = getAppVersion();
            expect(ver).toMatch(/^\d+\.\d+\.\d+/);
        });
    });
});
