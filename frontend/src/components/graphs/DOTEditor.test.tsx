// Smoke tests for the Monaco-backed DOTEditor wrapper.
// Monaco itself is mocked: the real package needs Web Workers and Canvas APIs
// that jsdom does not provide. We only verify the wrapper passes value/theme
// through and forwards onChange.

let lastEditorProps: any = null;

jest.mock('@monaco-editor/react', () => ({
  __esModule: true,
  Editor: (props: any) => {
    lastEditorProps = props;
    return (
      <div
        data-testid="monaco-stub"
        data-theme={props.theme}
        data-language={props.language}
      >
        {props.value}
      </div>
    );
  },
}));

// monaco-editor is dynamically imported inside useEffect; provide a virtual
// stub so the import resolves without side effects (the package itself is not
// installed for jsdom tests).
jest.mock('monaco-editor', () => ({
  languages: {
    register: jest.fn(),
    setMonarchTokensProvider: jest.fn(),
  },
  editor: {
    defineTheme: jest.fn(),
  },
}), { virtual: true });

import React from 'react';
import { render, screen } from '@testing-library/react';
import DOTEditor from './DOTEditor';

beforeEach(() => {
  lastEditorProps = null;
});

describe('DOTEditor', () => {
  test('renders the underlying Monaco editor with the provided value', () => {
    render(<DOTEditor value="digraph G { A -> B }" />);
    const stub = screen.getByTestId('monaco-stub');
    expect(stub).toHaveTextContent('digraph G { A -> B }');
    expect(stub.getAttribute('data-language')).toBe('dot');
  });

  test('default theme is the dark one', () => {
    render(<DOTEditor value="" />);
    expect(screen.getByTestId('monaco-stub').getAttribute('data-theme')).toBe('dot-dark');
  });

  test('switches to the light theme when theme="vs"', () => {
    render(<DOTEditor value="" theme="vs" />);
    expect(screen.getByTestId('monaco-stub').getAttribute('data-theme')).toBe('dot-light');
  });

  test('forwards onChange when Monaco emits a value change', () => {
    const handler = jest.fn();
    render(<DOTEditor value="initial" onChange={handler} />);
    // Simulate Monaco invoking the onChange prop.
    lastEditorProps.onChange('updated');
    expect(handler).toHaveBeenCalledWith('updated');
  });

  test('does not call onChange when Monaco emits undefined', () => {
    const handler = jest.fn();
    render(<DOTEditor value="initial" onChange={handler} />);
    lastEditorProps.onChange(undefined);
    expect(handler).not.toHaveBeenCalled();
  });

  test('does not crash when no onChange is supplied', () => {
    render(<DOTEditor value="x" />);
    expect(() => lastEditorProps.onChange('still works')).not.toThrow();
  });

  test('passes essential editor options through to Monaco', () => {
    render(<DOTEditor value="" />);
    expect(lastEditorProps.options).toEqual(expect.objectContaining({
      lineNumbers: 'on',
      automaticLayout: true,
      wordWrap: 'on',
      bracketPairColorization: { enabled: true },
    }));
  });
});
