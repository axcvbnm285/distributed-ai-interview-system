import Editor from "@monaco-editor/react";

function CodeEditor({
  code,
  onChange,
  language
}) {

  return (
    <Editor
      key={language}
      height="500px"
      language={language}
      value={code}
      onChange={onChange}
      theme="vs-dark"
    />
  );

}

export default CodeEditor;