import Editor from "@monaco-editor/react";

function CodeEditor({
  code,
  onChange,
  language
}) {
  return (
    <Editor
      key={language}
      height="100%"
      language={language}
      value={code}
      onChange={onChange}
      theme="vs-dark"
      options={{
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
        scrollBeyondLastLine: false,
      }}
    />
  );
}

export default CodeEditor;
