// VortexFlow Frontend - Éditeur DOT avec Coloration Syntaxique
// Composant d'édition DOT avec highlighting personnalisé

import React, { useEffect } from 'react';
import { Editor } from '@monaco-editor/react';
import { editor } from 'monaco-editor';

interface DOTEditorProps {
  value: string;
  onChange?: (value: string) => void;
  height?: string | number;
  theme?: string;
}

const DOTEditor: React.FC<DOTEditorProps> = ({ 
  value, 
  onChange, 
  height = '100%',
  theme = 'vs-dark' 
}) => {
  useEffect(() => {
    // Configuration du langage DOT personnalisé
    const defineLanguage = async () => {
      const monaco = await import('monaco-editor');
      
      // Enregistrer le langage DOT
      monaco.languages.register({ id: 'dot' });
      
      // Définir la coloration syntaxique
      monaco.languages.setMonarchTokensProvider('dot', {
        tokenizer: {
          root: [
            // Commentaires
            [/\/\/.*$/, 'comment'],
            [/\/\*[\s\S]*?\*\//, 'comment'],
            
            // Mots-clés DOT
            [/\b(digraph|graph|subgraph|node|edge|strict)\b/, 'keyword'],
            
            // Attributs courants
            [/\b(label|color|shape|style|fontsize|fontname|fillcolor|penwidth)\b/, 'type'],
            
            // Valeurs d'attributs
            [/\b(box|circle|ellipse|diamond|triangle|pentagon|hexagon|octagon)\b/, 'string'],
            [/\b(solid|dashed|dotted|bold|filled|rounded)\b/, 'string'],
            [/\b(red|blue|green|yellow|orange|purple|pink|gray|black|white|lightblue|lightgreen|lightgray)\b/, 'string'],
            
            // Chaînes de caractères
            [/"([^"\\]|\\.)*$/, 'string.invalid'],
            [/"/, 'string', '@string'],
            
            // Nombres
            [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
            [/\d+/, 'number'],
            
            // Opérateurs et délimiteurs
            [/->/, 'operator.arrow'],
            [/--/, 'operator.line'],
            [/[{}[\]()]/, 'delimiter.bracket'],
            [/[;,]/, 'delimiter'],
            [/=/, 'operator'],
            
            // Identifiants (noms de nœuds)
            [/[A-Za-z_]\w*/, 'identifier'],
          ],
          
          string: [
            [/[^\\"]+/, 'string'],
            [/\\./, 'string.escape'],
            [/"/, 'string', '@pop'],
          ],
        },
      });
      
      // Définir le thème de couleurs
      monaco.editor.defineTheme('dot-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
          { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
          { token: 'type', foreground: '4EC9B0' },
          { token: 'string', foreground: 'CE9178' },
          { token: 'number', foreground: 'B5CEA8' },
          { token: 'operator.arrow', foreground: 'D4D4D4', fontStyle: 'bold' },
          { token: 'operator.line', foreground: 'D4D4D4', fontStyle: 'bold' },
          { token: 'identifier', foreground: '9CDCFE' },
          { token: 'delimiter.bracket', foreground: 'FFD700' },
          { token: 'delimiter', foreground: 'D4D4D4' },
        ],
        colors: {
          'editor.background': '#1e1e1e',
          'editor.foreground': '#d4d4d4',
        }
      });
      
      monaco.editor.defineTheme('dot-light', {
        base: 'vs',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '008000', fontStyle: 'italic' },
          { token: 'keyword', foreground: '0000FF', fontStyle: 'bold' },
          { token: 'type', foreground: '267F99' },
          { token: 'string', foreground: 'A31515' },
          { token: 'number', foreground: '098658' },
          { token: 'operator.arrow', foreground: '000000', fontStyle: 'bold' },
          { token: 'operator.line', foreground: '000000', fontStyle: 'bold' },
          { token: 'identifier', foreground: '001080' },
          { token: 'delimiter.bracket', foreground: 'AF00DB' },
          { token: 'delimiter', foreground: '000000' },
        ],
        colors: {
          'editor.background': '#ffffff',
          'editor.foreground': '#000000',
        }
      });
    };
    
    defineLanguage();
  }, []);

  const handleEditorChange = (newValue: string | undefined) => {
    if (onChange && newValue !== undefined) {
      onChange(newValue);
    }
  };

  return (
    <Editor
      height={height}
      language="dot"
      value={value}
      onChange={handleEditorChange}
      theme={theme === 'vs-dark' ? 'dot-dark' : 'dot-light'}
      options={{
        minimap: { enabled: false },
        fontSize: 16,
        lineNumbers: 'on',
        roundedSelection: false,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: 'on',
        fontFamily: 'Monaco, "Courier New", monospace',
        bracketPairColorization: { enabled: true },
        matchBrackets: 'always',
        folding: true,
        foldingStrategy: 'indentation',
        showFoldingControls: 'mouseover',
        lineHeight: 22,
        padding: { top: 10, bottom: 10 },
        suggest: {
          showKeywords: true,
          showSnippets: true,
        },
        quickSuggestions: {
          other: true,
          comments: false,
          strings: false
        }
      }}
    />
  );
};

export default DOTEditor;
