// Smoke tests for the CodeMirror-backed DOTCodeMirrorEditor wrapper.
// The real CodeMirror needs DOM features (contenteditable, ResizeObserver,
// requestAnimationFrame timing) that jsdom only partially supports. We mock
// the @uiw/react-codemirror entry so we only assert that the wrapper passes
// `value` through and forwards onChange.

let lastCmProps: any = null;

jest.mock('@uiw/react-codemirror', () => ({
  __esModule: true,
  default: (props: any) => {
    lastCmProps = props;
    return (
      <div data-testid="cm-stub">{props.value}</div>
    );
  },
}));

// Stub the language/theme/lint imports — DOTCodeMirrorEditor only needs the
// shapes, not actual behaviour.
jest.mock('@codemirror/theme-one-dark', () => ({ oneDark: 'oneDark-stub' }));
jest.mock('@codemirror/view', () => ({
  EditorView: { theme: jest.fn(() => 'theme-stub') },
}));
jest.mock('@codemirror/language', () => ({
  StreamLanguage: { define: jest.fn(() => 'lang-stub') },
  LanguageSupport: jest.fn(() => 'support-stub'),
}));
jest.mock('@codemirror/lint', () => ({
  linter: jest.fn(() => 'linter-stub'),
}));

import React from 'react';
import { render, screen } from '@testing-library/react';
import DOTCodeMirrorEditor from './DOTCodeMirrorEditor';

beforeEach(() => {
  lastCmProps = null;
});

describe('DOTCodeMirrorEditor', () => {
  test('renders the underlying CodeMirror with the provided value', () => {
    render(<DOTCodeMirrorEditor value="digraph G { A -> B }" onChange={() => {}} />);
    expect(screen.getByTestId('cm-stub')).toHaveTextContent('digraph G { A -> B }');
  });

  test('forwards onChange when CodeMirror emits a value change', () => {
    const handler = jest.fn();
    render(<DOTCodeMirrorEditor value="initial" onChange={handler} />);
    lastCmProps.onChange('updated');
    expect(handler).toHaveBeenCalledWith('updated');
  });

  test('passes the configured theme through to CodeMirror', () => {
    render(<DOTCodeMirrorEditor value="" onChange={() => {}} />);
    expect(lastCmProps.theme).toBe('oneDark-stub');
  });

  test('enables the expected basicSetup features', () => {
    render(<DOTCodeMirrorEditor value="" onChange={() => {}} />);
    expect(lastCmProps.basicSetup).toEqual(expect.objectContaining({
      lineNumbers: true,
      bracketMatching: true,
      closeBrackets: true,
      autocompletion: true,
      foldGutter: true,
      history: true,
    }));
  });

  test('supplies a non-empty extensions array', () => {
    // Whether each individual extension equals the stubbed return value is
    // brittle (depends on how `new`/factory calls are wired through jest mocks).
    // We just assert that the wrapper plumbed something through.
    render(<DOTCodeMirrorEditor value="" onChange={() => {}} />);
    expect(Array.isArray(lastCmProps.extensions)).toBe(true);
    expect(lastCmProps.extensions.length).toBeGreaterThanOrEqual(3);
  });
});
