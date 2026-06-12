import Editor from "@monaco-editor/react";

function CodeEditor({
  code,
  onChange
}) {

  return (
    <Editor
      height="500px"
      defaultLanguage="javascript"
      value={code}
      onChange={onChange}
      theme="vs-dark"
    />
  );

}

export default CodeEditor;