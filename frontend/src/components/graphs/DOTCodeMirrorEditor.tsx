import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { LanguageSupport, StreamLanguage } from '@codemirror/language';
import { linter, Diagnostic } from '@codemirror/lint';

// Définition du langage DOT pour CodeMirror
const dotLanguage = StreamLanguage.define({
  name: 'dot',
  token: (stream, _state) => {
    // Mots-clés DOT
    if (stream.match(/\b(digraph|graph|node|edge|subgraph|strict|rankdir|size|ratio|label|shape|style|color|fillcolor|fontcolor|fontsize|fontname|penwidth|arrowhead|arrowtail|dir|weight|constraint|rank|ordering|orientation|splines|concentrate|compound|clusterrank|packmode|pack|sep|esep|nodesep|ranksep|mindist|K|maxiter|start|epsilon|overlap|prism|voro_margin|rotate|dimen|mode|model|mosek|quad|root|scale|bb|viewport|page|pagedir|quantum|nslimit|nslimit1|mclimit|beautify|normalize|center|layers|layer|layersep|outputorder|remap|stylesheet|URL|href|target|tooltip|nojustify|labeljust|labelloc|lhead|ltail|same|min|source|len|group|cluster|LR|RL|TB|BT|filled|solid|dashed|dotted|bold|rounded|diagonals|box|polygon|ellipse|oval|circle|point|egg|triangle|plaintext|diamond|trapezium|parallelogram|house|pentagon|hexagon|septagon|octagon|doublecircle|doubleoctagon|tripleoctagon|invtriangle|invtrapezium|invhouse|Mdiamond|Msquare|Mcircle|rect|rectangle|square|none|normal|inv|dot|invdot|odot|invodot|tee|empty|invempty|diamond|odiamond|ediamond|crow|box|obox|open|halfopen|vee)\b/)) {
      return 'keyword';
    }
    
    // Commentaires
    if (stream.match(/\/\/.*/) || stream.match(/\/\*[\s\S]*?\*\//)) {
      return 'comment';
    }
    
    // Chaînes de caractères
    if (stream.match(/"([^"\\]|\\.)*"/)) {
      return 'string';
    }
    
    // Identifiants (noms de nœuds)
    if (stream.match(/[a-zA-Z_][a-zA-Z0-9_]*/)) {
      return 'variable';
    }
    
    // Opérateurs DOT
    if (stream.match(/->|--|=/)) {
      return 'operator';
    }
    
    // Ponctuation
    if (stream.match(/[{}[\];,]/)) {
      return 'punctuation';
    }
    
    // Nombres
    if (stream.match(/\d+(\.\d+)?/)) {
      return 'number';
    }
    
    stream.next();
    return null;
  }
});

const dotSupport = new LanguageSupport(dotLanguage);

// Linter DOT personnalisé
const dotLinter = linter((view) => {
  const diagnostics: Diagnostic[] = [];
  const doc = view.state.doc;
  const text = doc.toString();
  
  // Vérifications de base de syntaxe DOT
  // Variables pour suivre l'état pendant l'analyse
  let braceBalance = 0;
  let inString = false;
  let inComment = false;
  let hasDigraphOrGraph = false;
  
  const lines = text.split('\n');
  let lineStart = 0;
  
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    let lineInString = false;
    let stringStartPos = -1;
    
    // Vérifier si la ligne contient digraph ou graph
    if (line.match(/^\s*(strict\s+)?(di)?graph\s+/)) {
      hasDigraphOrGraph = true;
    }
    
    // Analyser caractère par caractère
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const prevChar = i > 0 ? line[i - 1] : '';
      
      // Gestion des commentaires
      if (char === '/' && line[i + 1] === '/' && !inString && !lineInString) {
        // Commentaire de ligne, ignorer le reste
        break;
      }
      
      if (char === '/' && line[i + 1] === '*' && !inString && !lineInString) {
        inComment = true;
        continue;
      }
      
      if (char === '*' && line[i + 1] === '/' && inComment) {
        inComment = false;
        i++; // Skip the '/'
        continue;
      }
      
      if (inComment) continue;
      
      // Gestion des chaînes
      if (char === '"' && prevChar !== '\\') {
        if (lineInString) {
          // Fin de chaîne sur cette ligne
          lineInString = false;
          stringStartPos = -1;
        } else if (inString) {
          // Fin de chaîne multi-ligne
          inString = false;
        } else {
          // Début de chaîne
          if (inString) {
            // Chaîne multi-ligne continue
            continue;
          } else {
            // Nouvelle chaîne sur cette ligne
            lineInString = true;
            stringStartPos = i;
          }
        }
        continue;
      }
      
      if (inString || lineInString) continue;
      
      // Compter les accolades (seulement hors chaînes et commentaires)
      if (char === '{') {
        braceBalance++;
      } else if (char === '}') {
        braceBalance--;
        if (braceBalance < 0) {
          diagnostics.push({
            from: lineStart + i,
            to: lineStart + i + 1,
            severity: 'error',
            message: 'Accolade fermante sans accolade ouvrante correspondante'
          });
        }
      }
    }
    
    // Vérifier si une chaîne est restée ouverte sur cette ligne
    if (lineInString && stringStartPos >= 0) {
      diagnostics.push({
        from: lineStart + stringStartPos,
        to: lineStart + line.length,
        severity: 'error',
        message: 'Chaîne de caractères non fermée'
      });
    }
    
    // Vérifier les erreurs de syntaxe communes (seulement hors commentaires)
    if (line.includes('->') && line.includes('--') && !line.includes('//')) {
      diagnostics.push({
        from: lineStart,
        to: lineStart + line.length,
        severity: 'error',
        message: 'Mélange de flèches dirigées (->) et non-dirigées (--) dans la même ligne'
      });
    }
    
    lineStart += line.length + 1; // +1 pour le \n
  }
  
  // Vérifications globales
  if (!hasDigraphOrGraph && text.trim().length > 0) {
    diagnostics.push({
      from: 0,
      to: Math.min(50, doc.length),
      severity: 'error',
      message: 'Le graphique DOT doit commencer par "digraph" ou "graph"'
    });
  }
  
  if (braceBalance > 0) {
    diagnostics.push({
      from: doc.length - 1,
      to: doc.length,
      severity: 'error',
      message: `${braceBalance} accolade(s) ouvrante(s) non fermée(s)`
    });
  }
  
  return diagnostics;
});

interface DOTCodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string;
}

const DOTCodeMirrorEditor: React.FC<DOTCodeMirrorEditorProps> = ({
  value,
  onChange,
  height = '450px'
}) => {
  const extensions = [
    dotSupport,
    dotLinter,
    EditorView.theme({
      '&': {
        fontSize: '16px',
        fontFamily: 'Monaco, "Courier New", monospace',
      },
      '.cm-content': {
        padding: '10px',
        lineHeight: '1.4',
      },
      '.cm-editor': {
        height: height,
      },
      '.cm-scroller': {
        height: height,
      }
    })
  ];

  return (
    <CodeMirror
      value={value}
      onChange={(val) => onChange(val)}
      extensions={extensions}
      theme={oneDark}
      basicSetup={{
        lineNumbers: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: true,
        highlightSelectionMatches: false,
        foldGutter: true,
        dropCursor: false,
        allowMultipleSelections: false,
        indentOnInput: true,
        history: true,
        drawSelection: true,
        searchKeymap: true,
        lintKeymap: true,
      }}
    />
  );
};

export default DOTCodeMirrorEditor;
